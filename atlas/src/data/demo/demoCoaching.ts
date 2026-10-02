import { CALL_RUBRIC, COACHING } from "@/config/callRubric";
import { createFakeCoach, createFakeTranscription, humanGap, insights, weeklyAgenda, type CallMeta, type CoachProvider, type TranscriptionProvider } from "@/services/coach";
import { isoWeekKey, isoWeekRange, localDateKey, localHHMM, shiftDateKey, zonedToUtc } from "@/services/time";
import { hash01 } from "@/services/usagePortal";
import type { CallReview, CoachingSettings, OneOnOne, PersonCard, Scorecard, ScorecardComment, StatCell, TeamApi, TeamOverview } from "../coachTypes";
import type { Activity, Company, Contact, Lead } from "../leadTypes";
import type { Meeting } from "../queueTypes";
import type { Commission, DailyBdrReport, KpiRow } from "../salesTypes";
import type { Task, TaskActivity, TimeEntry } from "../taskTypes";
import { AccessError, ROLE_LABEL, type Notification, type User } from "../types";
import type { SystemTaskInput } from "./demoTasks";

const DAY = 86_400_000;

export interface CoachStore {
  leads: Lead[];
  companies: Company[];
  contacts: Contact[];
  activities: Activity[];
  meetings: Meeting[];
  commissions: Commission[];
  dailyReports: DailyBdrReport[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  taskActivity: TaskActivity[];
  callReviews: CallReview[];
  oneOnOnes: OneOnOne[];
  scorecardComments: ScorecardComment[];
  coachingSettings: CoachingSettings;
  rubricFlags: { reviewId: string; gap: number; at: string }[];
}

export const emptyCoachingState = () => ({
  callReviews: [] as CallReview[],
  oneOnOnes: [] as OneOnOne[],
  scorecardComments: [] as ScorecardComment[],
  coachingSettings: { aiScoringVerified: false, verifiedBy: null, verifiedAt: null, recordingDays: COACHING.recordingDays, transcriptDays: COACHING.transcriptDays } as CoachingSettings,
  rubricFlags: [] as { reviewId: string; gap: number; at: string }[],
});

interface Ctx<S extends CoachStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  /** Weekly KPIs (services/reports computeReport) for a person and ISO week. */
  weekKpis: (s: S, userId: string, week: string) => KpiRow[];
  addSystemTask: (s: S, input: SystemTaskInput) => Task;
  transcription?: TranscriptionProvider;
  coach?: CoachProvider;
}

const GUARDRAILS = [
  "Work data only: CRM, company phone lines, tasks and GitHub. No screen recording, keystrokes, webcam or location.",
  "No single employee score and no ranking. Each area is shown against its target.",
  "AI suggests, people decide. Pay, bonuses and commissions come only from the fixed rules (approved meetings, cash collected), never from AI scores.",
  "No emotion, sentiment, tone-of-voice or biometric analysis.",
  "Everyone sees their own scorecard exactly as founders do, and can comment on or dispute any score.",
  "A founder checks 3 random scored calls a week; a gap over 15 points flags the rubric for review.",
  "Recordings are kept 90 days; transcripts and scores 12 months, then anonymised.",
];

export const createDemoCoaching = <S extends CoachStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify } = ctx;
  const transcription = ctx.transcription ?? createFakeTranscription();
  const coach = ctx.coach ?? createFakeCoach();
  const iso = (t = now()) => new Date(t).toISOString();
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
  const admins = () => users.filter((u) => u.role === "admin" && u.active);
  const cofounder = () => users.find((u) => u.id === "u-cofounder" && u.active) ?? admins()[0];
  const tzOf = (userId: string | null) => users.find((u) => u.id === userId)?.timezone ?? "UTC";
  const weekOf = (at: string, tz: string) => isoWeekKey(localDateKey(new Date(at), tz));
  const currentWeek = (tz: string) => isoWeekKey(localDateKey(now(), tz));
  const prevWeek = (week: string) => isoWeekKey(shiftDateKey(isoWeekRange(week).start, -7));
  const weekLabel = (week: string) => {
    const { start, end } = isoWeekRange(week);
    const f = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
    return `W${Number(week.slice(6))} · ${f(start)} – ${f(end)}`;
  };

  // ---------------------------------------------------------------- pipeline

  const metaFor = (s: S, a: Activity): CallMeta | null => {
    if (!a.userId) return null;
    const lead = s.leads.find((l) => l.id === a.leadId);
    const company = s.companies.find((c) => c.id === lead?.companyId);
    const contact = s.contacts.find((c) => c.id === lead?.primaryContactId);
    const tz = company?.timezone ?? "UTC";
    return {
      activityId: a.id, userId: a.userId, repName: nameOf(a.userId) ?? "Rep", prospectName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : "", company: company?.name ?? "—",
      disposition: a.disposition, durationS: a.durationS ?? 0, at: a.at, localHour: Number(localHHMM(new Date(a.at), tz).slice(0, 2)),
    };
  };

  /** Transcribe and score new calls (only once the legal flag is on). */
  const runPipeline = async (s: S) => {
    let scored = 0;
    let notScored = 0;
    if (!s.coachingSettings.aiScoringVerified) return { scored, notScored };
    const since = now() - 21 * DAY;
    const done = new Set(s.callReviews.map((r) => r.activityId));
    for (const a of s.activities) {
      if (a.type !== "call" || done.has(a.id) || !a.userId || !(a.durationS && a.durationS > 0) || new Date(a.at).getTime() < since) continue;
      const meta = metaFor(s, a);
      if (!meta) continue;
      const lines = meta.durationS >= COACHING.minScoredSeconds ? await transcription.transcribe(meta) : [];
      const { result, model, costMinor } = await coach.score(meta, lines);
      const review: CallReview = {
        id: uid("cr"), activityId: a.id, userId: a.userId, leadId: a.leadId, companyName: meta.company, at: a.at, durationS: meta.durationS, disposition: a.disposition, localHour: meta.localHour,
        rubricVersion: CALL_RUBRIC.version, result, lines: lines.length ? lines : null,
        recording: { url: lines.length ? `atlas-recording://${a.id}` : null, expiresAt: iso(new Date(a.at).getTime() + s.coachingSettings.recordingDays * DAY) },
        model, costMinor, human: null, humanRequested: null, disputed: null, anonymized: false, createdAt: iso(),
      };
      s.callReviews.push(review);
      if (result.status === "scored") scored++;
      else notScored++;
      // A compliance fail flags the call and creates a task for the co-founder.
      if (result.status === "scored" && !result.compliancePass) {
        const failed = result.compliance.filter((c) => !c.pass).map((c) => CALL_RUBRIC.compliance.find((x) => x.key === c.key)?.label).join(", ");
        const cf = cofounder();
        ctx.addSystemTask(s, {
          spaceName: "Operations", listName: "Compliance", title: `Compliance check: ${meta.company} call on ${a.at.slice(0, 10)} (${failed})`, assigneeIds: cf ? [cf.id] : [],
          dueAt: shiftDateKey(localDateKey(now(), "UTC"), 2), linked: a.leadId ? { type: "lead", id: a.leadId } : null, tags: ["compliance", `review:${review.id}`], priority: "high",
          descriptionMd: `The AI review flagged: ${failed}. Listen to the call and agree the fix with ${nameOf(a.userId)?.split(" ")[0]}. [Open the review](/team/calls/${review.id})`,
        });
      }
    }
    return { scored, notScored };
  };

  /** Each week: 3 random scored calls for the co-founder to check (deterministic per week). */
  const runSampler = (s: S) => {
    const cf = cofounder();
    if (!cf || !s.coachingSettings.aiScoringVerified) return 0;
    const week = currentWeek(cf.timezone);
    const last = prevWeek(week);
    let sampled = 0;
    for (const w of [last, week]) {
      if (s.callReviews.some((r) => r.humanRequested?.week === w && r.humanRequested.reason === "sample")) continue;
      const pool = s.callReviews.filter((r) => r.result.status === "scored" && !r.human && r.userId !== cf.id && weekOf(r.at, tzOf(r.userId)) === w);
      if (pool.length < COACHING.humanChecksPerWeek) continue;
      const picks = [...pool].sort((a, b) => hash01(`${w}:${a.id}`) - hash01(`${w}:${b.id}`)).slice(0, COACHING.humanChecksPerWeek);
      for (const r of picks) r.humanRequested = { week: w, assigneeId: cf.id, reason: "sample" };
      notify({ userId: cf.id, type: "task", text: `Human check: ${picks.length} scored calls to listen to (${w})`, href: "/team" });
      sampled += picks.length;
    }
    return sampled;
  };

  const peopleOnCalls = () => users.filter((u) => u.active && (u.role === "bdr" || u.role === "closer" || u.id === "u-cofounder"));

  const agendaFor = (s: S, userId: string, week: string): OneOnOne => {
    const kpis = ctx.weekKpis(s, userId, week).map((k) => ({ label: k.label, value: k.value, status: k.status, unit: k.unit }));
    const reviews = s.callReviews.filter((r) => r.userId === userId && weekOf(r.at, tzOf(userId)) === week).map((r) => ({ id: r.id, result: r.result }));
    return { userId, week, points: weeklyAgenda({ kpis, reviews }), generatedAt: iso(), editedBy: null, editedAt: null };
  };

  /** Weekly summary job: last full week's 1:1 agendas, for everyone with calls. */
  const runAgendas = (s: S, week?: string) => {
    if (!s.coachingSettings.aiScoringVerified) return 0;
    let n = 0;
    for (const u of peopleOnCalls()) {
      const w = week ?? prevWeek(currentWeek(u.timezone));
      const existing = s.oneOnOnes.find((o) => o.userId === u.id && o.week === w);
      if (existing?.editedBy) continue;
      const fresh = agendaFor(s, u.id, w);
      if (existing) Object.assign(existing, fresh);
      else s.oneOnOnes.push(fresh);
      n++;
    }
    return n;
  };

  /** Retention: recordings after 90 days; transcripts and scores anonymised after 12 months. */
  const runRetention = (s: S) => {
    let expiredRecordings = 0;
    let anonymised = 0;
    for (const r of s.callReviews) {
      if (r.recording.url && new Date(r.recording.expiresAt).getTime() <= now()) {
        r.recording.url = null;
        expiredRecordings++;
      }
      if (!r.anonymized && now() - new Date(r.at).getTime() > s.coachingSettings.transcriptDays * DAY) {
        Object.assign(r, { userId: null, leadId: null, companyName: "—", lines: null, anonymized: true });
        for (const it of r.result.items) it.evidence = [];
        r.result.compliance.forEach((c) => (c.evidence = []));
        r.result.tags = {};
        r.result.keyMoments = [];
        anonymised++;
      }
    }
    return { expiredRecordings, anonymised };
  };

  const runAll = async (s: S) => {
    const p = await runPipeline(s);
    const sampled = runSampler(s);
    const agendas = s.oneOnOnes.length ? 0 : runAgendas(s);
    const ret = runRetention(s);
    return { ...p, sampled, agendas, ...ret };
  };

  // ---------------------------------------------------------------- stats

  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  const kpi = (rows: KpiRow[], key: string) => rows.find((k) => k.key === key);
  const statFrom = (row: KpiRow | undefined, label: string, fmt: (v: number | null) => string): StatCell => ({
    key: row?.key ?? label, label, value: fmt(row?.value ?? null), target: `target ${row?.target ?? "—"}`, status: row?.status === "on_track" ? "met" : row?.status ? "watch" : "neutral",
  });
  const avgQuality = (s: S, userId: string, week: string) => {
    const xs = s.callReviews.filter((r) => r.userId === userId && r.result.status === "scored" && weekOf(r.at, tzOf(userId)) === week).map((r) => r.result.total!).filter((x) => x !== null);
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };
  const queueDone = (s: S, userId: string, week: string) => {
    const days = s.dailyReports.filter((d) => d.userId === userId && isoWeekKey(d.date) === week && d.queueTotal > 0);
    return days.length ? days.reduce((n, d) => n + d.queueDone, 0) / days.reduce((n, d) => n + d.queueTotal, 0) : null;
  };
  const tasksOnTime = (s: S, userId: string, week: string) => {
    const doneThisWeek = s.tasks.filter((t) => t.assigneeIds.includes(userId) && t.status === "done" && t.dueAt && t.completedAt && isoWeekKey(t.completedAt.slice(0, 10)) === week);
    return doneThisWeek.length ? doneThisWeek.filter((t) => t.completedAt!.slice(0, 10) <= t.dueAt!).length / doneThisWeek.length : null;
  };

  const cardFor = (s: S, u: User, n: string, week: string, aiOn: boolean): PersonCard => {
    const rows = ctx.weekKpis(s, u.id, week);
    const focus = aiOn ? (s.oneOnOnes.filter((o) => o.userId === u.id).sort((a, b) => b.week.localeCompare(a.week))[0]?.points.find((p) => p.kind === "focus")?.text ?? null) : "AI scoring is off until the legal check is done.";
    if (u.role === "bdr" || u.role === "closer") {
      const q = aiOn ? avgQuality(s, u.id, week) ?? avgQuality(s, u.id, prevWeek(week)) : null;
      const checked = s.callReviews.filter((r) => r.userId === u.id && r.human).length;
      return {
        n, userId: u.id, name: u.name, role: `${ROLE_LABEL[u.role]} · ${u.timezone.split("/")[1]?.replace("_", " ") ?? u.timezone} hours`, focus, href: `/team/${u.id}`,
        stats: [
          statFrom(kpi(rows, "meetings_booked"), "BOOKED / WEEK", (v) => (v === null ? "—" : String(Math.round(v)))),
          statFrom(kpi(rows, "close_rate_held"), "CLOSE RATE", pct),
          aiOn ? { key: "quality", label: "CALL QUALITY", value: q === null ? "—" : String(q), target: checked ? `${checked} human-checked` : "not human-checked yet", status: "neutral" } : { key: "quality", label: "CALL QUALITY", value: "off", target: "legal check pending", status: "neutral" },
          statFrom(kpi(rows, "crm_same_day"), "CRM SAME DAY", pct),
        ],
      };
    }
    const held = s.meetings.filter((m) => m.ownerId === u.id && m.attended === true && weekOf(m.scheduledAt, u.timezone) === week).length;
    const qd = queueDone(s, u.id, week);
    const ot = tasksOnTime(s, u.id, week);
    return {
      n, userId: u.id, name: u.name, role: `${ROLE_LABEL[u.role]} · ${u.role === "admin" ? "sales + ops" : ""}`.replace(/ · $/, ""), focus, href: `/team/${u.id}`,
      stats: [
        { key: "meetings_run", label: "MEETINGS RUN", value: String(held), target: "this week", status: "neutral" },
        statFrom(kpi(rows, "close_rate_held"), "CLOSE RATE", pct),
        { key: "queue", label: "QUEUE DONE", value: pct(qd), target: u.dailyCapacity ? `of ${u.dailyCapacity} a day` : "no queue", status: qd === null ? "neutral" : qd >= 0.9 ? "met" : "watch" },
        { key: "on_time", label: "TASKS ON TIME", value: pct(ot), target: "target 90%+", status: ot === null ? "neutral" : ot >= 0.9 ? "met" : "watch" },
      ],
    };
  };

  /** The Codex agent's card from tasks tagged codex (GitHub stats arrive with the GitHub link). */
  const agentCard = (s: S, week: string): PersonCard => {
    const done = s.tasks.filter((t) => t.tags.includes("codex") && !t.parentId && t.status === "done" && t.completedAt && isoWeekKey(t.completedAt.slice(0, 10)) === week);
    const reopened = (id: string) => s.taskActivity.some((a) => a.taskId === id && /Review → (In progress|To do)/.test(a.text));
    const firstPass = done.length ? done.filter((t) => !reopened(t.id)).length / done.length : null;
    const reviews = s.tasks.filter((t) => done.some((d) => d.id === t.parentId) && /^Review/.test(t.title));
    const minutes = reviews.reduce((n, r) => n + s.timeEntries.filter((e) => e.taskId === r.id).reduce((m, e) => m + e.minutes, 0), 0);
    return {
      n: "", userId: null, name: "Codex agent", role: "Development · reviewed", href: null,
      focus: "Specs with a clear \"done when\" test pass review first time more often. Add edge cases to the task description.",
      stats: [
        { key: "prs", label: "PRS MERGED", value: String(done.length), target: "this week", status: "neutral" },
        { key: "first_pass", label: "FIRST-PASS OK", value: pct(firstPass), target: "accepted without changes", status: firstPass === null ? "neutral" : firstPass >= 0.7 ? "met" : "watch" },
        { key: "review_time", label: "REVIEW TIME", value: reviews.length ? `${(minutes / 60 / reviews.length).toFixed(1)} h` : "—", target: "per PR · budget 1.5 h", status: "neutral" },
        { key: "tests", label: "TESTS ADDED", value: "—", target: "needs the GitHub link", status: "neutral" },
      ],
    };
  };

  const canSeePerson = (viewerUser: User, userId: string) => viewerUser.role === "admin" || viewerUser.id === userId;

  // ---------------------------------------------------------------- API

  const api: TeamApi = {
    async teamOverview(weekArg) {
      const user = await viewer();
      if (user.role === "bdr" || user.role === "closer" || user.role === "implementer") return { redirectTo: user.id };
      const s = await load();
      const aiOn = s.coachingSettings.aiScoringVerified;
      const week = weekArg ?? currentWeek(user.timezone);
      audit(user.id, "team.view", "team", null, null, { week });
      const all = s.callReviews.filter((r) => r.result.status === "scored" && !r.anonymized);
      const base: Omit<TeamOverview, "cards" | "totals" | "humanChecks" | "rubricFlags"> = {
        week, weekLabel: weekLabel(week), aiOn, scoredCalls: aiOn ? all.length : 0,
        insights: aiOn
          ? insights({
              scored: all.map((r) => ({ meta: { activityId: r.activityId, userId: r.userId ?? "", repName: "", prospectName: "", company: "", disposition: r.disposition, durationS: r.durationS, at: r.at, localHour: r.localHour }, result: r.result })),
              attempts: s.activities.filter((a) => a.type === "call" && a.userId && now() - new Date(a.at).getTime() < 60 * DAY).map((a) => ({ connected: !/no answer|voicemail|gatekeeper/i.test(a.disposition ?? ""), localHour: metaFor(s, a)?.localHour ?? null })),
            })
          : null,
        guardrails: GUARDRAILS,
      };
      if (user.role === "viewer") {
        // Team totals only: no names, no AI notes.
        const rows = users.filter((u) => u.role === "bdr" || u.role === "closer").map((u) => ctx.weekKpis(s, u.id, week));
        const sum = (key: string) => rows.reduce((n, r) => n + (kpi(r, key)?.value ?? 0), 0);
        return {
          ...base, insights: null, cards: [], humanChecks: [], rubricFlags: [],
          totals: [
            { key: "booked", label: "MEETINGS BOOKED", value: String(Math.round(sum("meetings_booked"))), target: "team, this week", status: "neutral" },
            { key: "conversations", label: "CONVERSATIONS / DAY", value: sum("conversations_per_day").toFixed(1), target: "team", status: "neutral" },
            { key: "dials", label: "DIALS / DAY", value: sum("dials_per_day").toFixed(0), target: "team", status: "neutral" },
          ],
        };
      }
      // Fixed order by role (BDRs, closers, the co-founder), never by any score; the Codex agent last.
      const roleOrder = { bdr: 0, closer: 1, admin: 2, implementer: 3, viewer: 4 } as const;
      const people = users.filter((u) => u.active && (u.role === "bdr" || u.role === "closer" || u.id === "u-cofounder")).sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.name.localeCompare(b.name));
      const cards = people.map((u, i) => cardFor(s, u, String(i + 1).padStart(2, "0"), week, aiOn));
      const agent = agentCard(s, week);
      agent.n = String(cards.length + 1).padStart(2, "0");
      return {
        ...base,
        cards: [...cards, agent],
        totals: [],
        humanChecks: aiOn
          ? s.callReviews.filter((r) => r.humanRequested && !r.human && r.humanRequested.assigneeId === user.id).map((r) => ({ reviewId: r.id, companyName: r.companyName, repName: nameOf(r.userId) ?? "—", at: r.at, reason: r.humanRequested!.reason }))
          : [],
        rubricFlags: s.rubricFlags,
      };
    },

    async scorecard(userId, weeksN = 4) {
      const user = await viewer();
      if (!canSeePerson(user, userId)) throw new AccessError(403, "Scorecards are visible to the person and to admins only.");
      const person = users.find((u) => u.id === userId);
      if (!person) throw new AccessError(404);
      const s = await load();
      audit(user.id, "scorecard.view", "user", userId);
      const aiOn = s.coachingSettings.aiScoringVerified;
      const tz = person.timezone;
      const current = currentWeek(tz);
      const weeks = Array.from({ length: weeksN }, (_, i) => isoWeekKey(shiftDateKey(isoWeekRange(current).start, -7 * (weeksN - 1 - i))));
      const perWeek = weeks.map((w) => ctx.weekKpis(s, userId, w));
      const fmtRow = (row: KpiRow | undefined) => (!row || row.value === null ? null : row.unit === "pct" ? `${Math.round(row.value * 100)}%` : row.unit === "rate" ? row.value.toFixed(1) : String(Math.round(row.value)));
      const keys = person.role === "bdr" || person.role === "closer" ? ["conversations_per_day", "meetings_booked", "approved_per_booked", "show_rate", "close_rate_held", "crm_same_day", "followup_24h"] : ["meetings_booked", "show_rate", "close_rate_held", "crm_same_day", "followup_24h"];
      const kpis = [
        ...(person.dailyCapacity
          ? [{ label: `Queue done (of ${person.dailyCapacity})`, values: weeks.map((w) => (queueDone(s, userId, w) === null ? null : `${Math.round(queueDone(s, userId, w)! * 100)}%`)), target: "100%", status: (() => { const q = queueDone(s, userId, current); return q === null ? null : q >= 1 ? ("on_track" as const) : ("watch" as const); })() }]
          : []),
        ...keys.map((key) => {
          const rows = perWeek.map((r) => r.find((x) => x.key === key));
          const last = rows[rows.length - 1];
          return { label: last?.label ?? key, values: rows.map(fmtRow), target: last?.target ?? "—", status: last?.status === "on_track" ? ("on_track" as const) : last?.status ? ("watch" as const) : null };
        }),
      ];
      const weekReviews = s.callReviews.filter((r) => r.userId === userId && weekOf(r.at, tz) === current);
      const qualityWeek = weekReviews.some((r) => r.result.status === "scored") ? current : prevWeek(current);
      const qReviews = s.callReviews.filter((r) => r.userId === userId && weekOf(r.at, tz) === qualityWeek && r.result.status === "scored");
      const itemAvg = (key: string) => {
        const xs = qReviews.map((r) => r.result.items.find((i) => i.key === key)?.score).filter((x): x is number => typeof x === "number");
        return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
      };
      const quality = aiOn
        ? {
            scored: qReviews.length, humanChecked: qReviews.filter((r) => r.human).length,
            overall: qReviews.length ? Math.round(qReviews.reduce((n, r) => n + (r.result.total ?? 0), 0) / qReviews.length) : null,
            items: CALL_RUBRIC.items.map((i) => ({ key: i.key, label: i.label, value: itemAvg(i.key) })),
            compliancePassRate: qReviews.length ? qReviews.filter((r) => r.result.compliancePass).length / qReviews.length : null,
          }
        : null;
      // Earnings come only from the commission rows (fixed rules), never from AI scores.
      const month = localDateKey(now(), tz).slice(0, 7);
      const rows = s.commissions.filter((c) => c.userId === userId && c.period === month && c.status !== "void" && c.status !== "clawed_back");
      const byType = (t: Commission["type"]) => rows.filter((c) => c.type === t);
      const currency = rows[0]?.currency ?? "USD";
      const lines = [
        { label: "Base · per contract (outside Atlas)", amountMinor: null, currency },
        { label: `Approved meetings × $15 (${byType("meeting_bonus").length})`, amountMinor: byType("meeting_bonus").reduce((n, c) => n + c.amountMinor, 0), currency },
        { label: `Setup commission (${byType("setup_commission").length})`, amountMinor: byType("setup_commission").reduce((n, c) => n + c.amountMinor, 0), currency },
        { label: `Recurring commission (${byType("recurring_commission").length})`, amountMinor: byType("recurring_commission").reduce((n, c) => n + c.amountMinor, 0), currency },
      ];
      const start = s.activities.filter((a) => a.userId === userId && a.type === "call").map((a) => a.at).sort()[0];
      const days = start ? Math.max(1, Math.round((now() - new Date(start).getTime()) / DAY)) : null;
      return {
        userId, name: person.name, role: ROLE_LABEL[person.role],
        tenure: days ? `Day ${days} · since ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(start!))} on calls` : "No calls yet",
        weeks: weeks.map((w) => ({ key: w, label: `W${Number(w.slice(6))}` })), kpis, aiOn, quality,
        agenda: aiOn ? (s.oneOnOnes.filter((o) => o.userId === userId).sort((a, b) => b.week.localeCompare(a.week))[0] ?? null) : null,
        earnings: { month, lines, totalMinor: rows.reduce((n, c) => n + c.amountMinor, 0), currency },
        comments: s.scorecardComments.filter((c) => c.userId === userId).sort((a, b) => a.at.localeCompare(b.at)).map((c) => ({ ...c, authorName: nameOf(c.authorId) ?? "—" })),
        reviews: aiOn
          ? s.callReviews
              .filter((r) => r.userId === userId && !r.anonymized && (weekOf(r.at, tz) === current || weekOf(r.at, tz) === prevWeek(current)))
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((r) => ({ id: r.id, companyName: r.companyName, at: r.at, durationS: r.durationS, total: r.result.total, status: r.result.status, disputed: !!r.disputed && !r.disputed.resolvedAt, compliancePass: r.result.compliancePass }))
          : [],
        canEditAgenda: user.role === "admin",
      } satisfies Scorecard;
    },

    async getCallReview(id) {
      const user = await viewer();
      const s = await load();
      const r = s.callReviews.find((x) => x.id === id);
      if (!r || r.anonymized) throw new AccessError(404);
      if (!canSeePerson(user, r.userId ?? "")) throw new AccessError(403);
      if (!s.coachingSettings.aiScoringVerified) throw new Error("AI scoring is off until the legal check is done.");
      audit(user.id, "call_review.view", "call_review", id);
      return { review: r, repName: nameOf(r.userId) ?? "—", canHumanCheck: user.role === "admin" && user.id !== r.userId && r.result.status === "scored", canDispute: user.id === r.userId && r.result.status === "scored", aiOn: true };
    },

    async humanCheck(id, score) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      if (!(score >= 0 && score <= 100)) throw new Error("Score 0–100.");
      const s = await load();
      const r = s.callReviews.find((x) => x.id === id);
      if (!r || r.result.status !== "scored" || r.result.total === null) throw new AccessError(404);
      if (r.userId === user.id) throw new AccessError(403, "Someone else checks your own calls.");
      const g = humanGap(r.result.total, Math.round(score));
      r.human = { reviewerId: user.id, score: Math.round(score), at: iso(), gap: g.gap, flagged: g.flagged };
      if (r.disputed && !r.disputed.resolvedAt) r.disputed.resolvedAt = iso();
      if (g.flagged) {
        s.rubricFlags.push({ reviewId: r.id, gap: g.gap, at: iso() });
        // The prompt owner (Rinor) reviews the rubric and prompt.
        notify({ userId: "u-rinor", type: "task", text: `Rubric check: human ${Math.round(score)} vs AI ${r.result.total} on ${r.companyName} (gap ${g.gap})`, href: `/team/calls/${r.id}` });
      }
      audit(user.id, "call_review.human_check", "call_review", r.id, null, r.human);
      await save();
    },

    async disputeReview(id, note) {
      const user = await viewer();
      const s = await load();
      const r = s.callReviews.find((x) => x.id === id);
      if (!r) throw new AccessError(404);
      if (r.userId !== user.id) throw new AccessError(403, "Only the person on the call can dispute its score.");
      if (!note.trim()) throw new Error("Say what you think the score missed.");
      const cf = cofounder();
      r.disputed = { by: user.id, at: iso(), note: note.trim(), resolvedAt: null };
      r.human = null;
      if (cf) r.humanRequested = { week: weekOf(r.at, tzOf(r.userId)), assigneeId: cf.id, reason: "dispute" };
      s.scorecardComments.push({ id: uid("sc"), userId: user.id, authorId: user.id, body: note.trim(), reviewId: r.id, kind: "dispute", at: iso() });
      if (cf) notify({ userId: cf.id, type: "task", text: `${user.name.split(" ")[0]} disputes a call score: ${r.companyName}`, href: `/team/calls/${r.id}` });
      audit(user.id, "call_review.dispute", "call_review", r.id);
      await save();
    },

    async addScorecardComment(userId, body) {
      const user = await viewer();
      if (!canSeePerson(user, userId)) throw new AccessError(403);
      if (!body.trim()) throw new Error("Write a comment first.");
      const s = await load();
      s.scorecardComments.push({ id: uid("sc"), userId, authorId: user.id, body: body.trim(), reviewId: null, kind: "comment", at: iso() });
      if (user.id !== userId) notify({ userId, type: "mention", text: `${user.name.split(" ")[0]} commented on your scorecard`, href: `/team/${userId}` });
      await save();
    },

    async updateAgenda(userId, week, points) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403, "Admins edit the agenda before the 1:1.");
      const s = await load();
      let o = s.oneOnOnes.find((x) => x.userId === userId && x.week === week);
      if (!o) {
        o = agendaFor(s, userId, week);
        s.oneOnOnes.push(o);
      }
      Object.assign(o, { points, editedBy: user.id, editedAt: iso() });
      await save();
    },

    async prepareOneOnOnes(week) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      const s = await load();
      if (!s.coachingSettings.aiScoringVerified) throw new Error("AI scoring is off until the legal check is done.");
      const n = runAgendas(s, week);
      await save();
      return n;
    },

    async setAiScoring(verified) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      const s = await load();
      Object.assign(s.coachingSettings, { aiScoringVerified: verified, verifiedBy: verified ? user.id : null, verifiedAt: verified ? iso() : null });
      audit(user.id, verified ? "coaching.enable" : "coaching.disable", "settings", "coaching");
      if (verified) await runAll(s);
      await save();
    },

    async runCoachingJobs() {
      await viewer();
      const s = await load();
      const r = await runAll(s);
      if (r.scored || r.notScored || r.sampled || r.agendas || r.expiredRecordings || r.anonymised) await save();
      return r;
    },

    async coachingSettings() {
      await viewer();
      return (await load()).coachingSettings;
    },
  };

  /** Demo seed: a full week of 40 BDR conversations (last week) plus this week's so far, on the BDR's own leads. */
  const seedCalls = (s: S) => {
    if (s.activities.some((a) => a.id.startsWith("ac-coach-"))) return;
    const bdr = users.find((u) => u.id === "u-bdr");
    if (!bdr) return;
    const leads = s.leads.filter((l) => l.ownerId === bdr.id && l.listType === "trades").slice(0, 80);
    if (!leads.length) return;
    const week = currentWeek(bdr.timezone);
    const plan: { week: string; perDay: number; days: number }[] = [
      { week: prevWeek(week), perDay: 8, days: 5 },
      { week, perDay: 4, days: Math.min(5, Math.max(1, (new Date(now()).getUTCDay() + 6) % 7)) },
    ];
    const DISPOSITIONS = ["Meeting booked", "Not interested", "Call back", "Send info", "Not interested", "Call back", "Not interested", "Send info"];
    let i = 0;
    for (const p of plan) {
      for (let d = 0; d < p.days; d++) {
        for (let k = 0; k < p.perDay; k++, i++) {
          const lead = leads[i % leads.length];
          const company = s.companies.find((c) => c.id === lead.companyId);
          const tz = company?.timezone ?? "America/New_York";
          const date = shiftDateKey(isoWeekRange(p.week).start, d);
          const hour = 7 + Math.floor(hash01(`h${i}`) * 5);
          const at = zonedToUtc(date, `${String(hour).padStart(2, "0")}:${String(Math.floor(hash01(`m${i}`) * 50)).padStart(2, "0")}`, tz);
          if (at > now()) continue;
          // Last week: 5 bookings out of 40 (the mockup's "booked / week 5").
          const disp = p.week !== week && k === 0 ? "Meeting booked" : DISPOSITIONS[(i * 7 + d) % DISPOSITIONS.length] === "Meeting booked" ? "Call back" : DISPOSITIONS[(i * 7 + d) % DISPOSITIONS.length];
          const durationS = 70 + Math.floor(hash01(`d${i}`) * 230);
          s.activities.push({ id: `ac-coach-${i}`, leadId: lead.id, userId: bdr.id, type: "call", title: `Call · ${disp}`, detail: `${Math.floor(durationS / 60)} min ${durationS % 60} s`, disposition: disp, durationS, at: new Date(at).toISOString() });
        }
      }
    }
    // A few short calls that aren't scored (gatekeepers and quick hang-ups).
    for (let j = 0; j < 4; j++) {
      const lead = leads[(i + j) % leads.length];
      const at = zonedToUtc(shiftDateKey(isoWeekRange(prevWeek(week)).start, j), "10:15", s.companies.find((c) => c.id === lead.companyId)?.timezone ?? "America/New_York");
      s.activities.push({ id: `ac-coach-short-${j}`, leadId: lead.id, userId: bdr.id, type: "call", title: "Call · Gatekeeper", detail: "0 min 40 s", disposition: "Gatekeeper", durationS: 40, at: new Date(at).toISOString() });
    }
  };

  return { api, seedCalls, runAll };
};
