import { CONNECTORS, LIST_BUILD, SEARCH_PLANS, type ConnectorId, type SearchPlan } from "@/config/leadSources";
import type { ListType } from "@/config/leads";
import { QUEUE } from "@/config/queue";
import { SCORING } from "@/config/scoring";
import { COUNTRY_RULES } from "@/config/countryRules";
import { normalizeDomain, normalizePhone, phoneType } from "@/services/dedup";
import { planImport } from "@/services/importPlan";
import { CapReachedError, createFakeSources, guarded, recordSignals, recordToRow, SourceError, type CacheEntry, type SourceRecord } from "@/services/leadSources";
import { scoreLead } from "@/services/scoring";
import { scoringReport } from "@/services/scoringReport";
import { inferTimezone } from "@/services/time";
import { auditSignals, auditSite, auditSummary, fakeSnapshot } from "@/services/websiteAudit";
import type { Activity, Company, Contact, Lead, Signal, Source, Suppression } from "../leadTypes";
import type { Meeting } from "../queueTypes";
import type { CostEntry, JobRun, JobType, LeadSourcesApi, ListBuildResult } from "../sourceTypes";
import { AccessError, type Notification, type User } from "../types";

const DAY = 86_400_000;

export interface SourcesStore {
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  signals: Signal[];
  sources: Source[];
  suppression: Suppression[];
  activities: Activity[];
  meetings: Meeting[];
  sourceCache: CacheEntry[];
  costLedger: CostEntry[];
  jobRuns: JobRun[];
  jobState: Record<JobType, { paused: boolean; reason: string | null }>;
  connectorState: Record<ConnectorId, { connected: boolean; capMinor: number; cacheHits: Record<string, number> }>;
  /** Next page per search plan; "done" when the plan has no more pages. */
  planCursors: Record<string, string | null>;
  /** Where each list type's plan rotation continues. */
  planIndex: Record<ListType, number>;
}

export const emptySourcesState = () => ({
  sourceCache: [] as CacheEntry[],
  costLedger: [] as CostEntry[],
  jobRuns: [] as JobRun[],
  jobState: { list_build: { paused: false, reason: null }, enrichment: { paused: false, reason: null } } as SourcesStore["jobState"],
  connectorState: Object.fromEntries(
    (Object.keys(CONNECTORS) as ConnectorId[]).map((id) => [id, { connected: id !== "zefix", capMinor: CONNECTORS[id].defaultCapMinor, cacheHits: {} }]),
  ) as SourcesStore["connectorState"],
  planCursors: {} as Record<string, string | null>,
  planIndex: { trades: 0, developers: 0 } as Record<ListType, number>,
});

interface Ctx<S extends SourcesStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  activity: (s: S, a: Omit<Activity, "id" | "at"> & { at?: string }) => void;
  rescoreLead: (s: S, lead: Lead) => void;
  /** The owner's queue shortfall for their next queue (from the queue summary). */
  shortfallFor: (s: S, owner: User) => number;
}

const SIGNAL_EXPIRY = new Map<string, number>();
for (const r of Object.values(SCORING.models).flat()) if ("signal" in r.when && r.expiresDays) SIGNAL_EXPIRY.set(r.when.signal, r.expiresDays);

export const createDemoSources = <S extends SourcesStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify, activity } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();
  const month = () => iso().slice(0, 7);
  const admins = () => users.filter((u) => u.role === "admin" && u.active);
  const requireAdmin = (u: User) => {
    if (u.role !== "admin") throw new AccessError(403);
  };
  const owners = () => users.filter((u) => u.active && (u.dailyCapacity ?? 0) > 0);

  const listTypeOf = (s: S, owner: User): ListType => {
    const mine = s.leads.filter((l) => l.ownerId === owner.id);
    const dev = mine.filter((l) => l.listType === "developers").length;
    return dev > mine.length / 2 ? "developers" : "trades";
  };

  /** Scores C or better and has a channel the country rules allow (a phone where calls are allowed, or an email where email is). */
  const isQueueReady = (s: S, lead: Lead) => {
    // The queue calls tier A and B (tier C only gets nurture emails).
    if (lead.excluded || lead.suppressed || (lead.tier !== "A" && lead.tier !== "B")) return false;
    const company = s.companies.find((c) => c.id === lead.companyId)!;
    const rule = company.country ? COUNTRY_RULES[company.country] : undefined;
    if (!rule) return false;
    const email = s.contacts.some((c) => c.companyId === company.id && c.email);
    return (rule.call && !!company.phone) || (rule.email !== false && email);
  };

  const sourceFor = (s: S, plan: SearchPlan): Source => {
    const name = `${CONNECTORS[plan.connector].label.split(" (")[0]} · ${plan.label}`;
    let src = s.sources.find((x) => x.name === name);
    if (!src) {
      src = { id: uid("src"), name, kind: plan.connector, country: plan.country, createdAt: iso() };
      s.sources.push(src);
    }
    return src;
  };

  /** Website audit → signals (replacing earlier audit signals) → rescore. */
  const auditLead = (s: S, lead: Lead, userId: string | null) => {
    const company = s.companies.find((c) => c.id === lead.companyId);
    if (!company?.domain) return null;
    const findings = auditSite(fakeSnapshot(company.domain, lead.listType, company.country ?? "US"));
    const found = auditSignals(findings, lead.listType);
    // Contact details published on the site fill empty fields only (never overwrite).
    const sitePhone = findings.phones.map((p) => normalizePhone(p, company.country)).find(Boolean) ?? null;
    if (!company.phone && sitePhone) company.phone = sitePhone;
    const siteEmail = findings.emails.find((e) => normalizeDomain(e) === company.domain) ?? null;
    if (siteEmail && !s.contacts.some((c) => c.companyId === company.id && c.email)) {
      const contact = s.contacts.find((c) => c.id === lead.primaryContactId);
      if (contact) Object.assign(contact, { email: siteEmail, emailStatus: "unknown" });
      else {
        const generic: Contact = {
          id: uid("ct"), companyId: company.id, firstName: "", lastName: "", title: "Office (from website)", email: siteEmail, emailStatus: "unknown",
          phone: null, phoneType: "unknown", phoneVerified: false, phoneInvalid: false, linkedinUrl: null, isDecisionMaker: false,
        };
        s.contacts.push(generic);
        lead.primaryContactId = generic.id;
      }
    }
    const keys = new Set(found.map((f) => f.key));
    s.signals = s.signals.filter((g) => !(g.leadId === lead.id && (g.source === "website_audit" || keys.has(g.key))));
    const at = iso();
    for (const f of found) {
      const days = SIGNAL_EXPIRY.get(f.key);
      s.signals.push({ id: uid("sg"), leadId: lead.id, key: f.key, value: f.value, source: "website_audit", observedAt: at, expiresAt: days ? iso(now() + days * DAY) : null });
    }
    ctx.rescoreLead(s, lead);
    const summary = auditSummary(findings);
    activity(s, { leadId: lead.id, userId, type: "signal", title: "Website audited", detail: summary, disposition: null, durationS: null });
    return { summary, signals: found.length };
  };

  const startRun = (s: S, type: JobType, trigger: JobRun["trigger"], startedBy: string | null, params: JobRun["params"], retryOf: string | null = null): JobRun => {
    const run: JobRun = { id: uid("run"), type, status: "running", trigger, startedBy, ownerId: params.ownerId ?? null, startedAt: iso(), finishedAt: null, durationMs: 0, items: 0, costMinor: 0, log: [], error: null, params, retryOf };
    s.jobRuns.unshift(run);
    s.jobRuns.splice(200);
    return run;
  };

  const finishRun = (s: S, run: JobRun, status: JobRun["status"], started: number, error: string | null = null) => {
    Object.assign(run, { status, finishedAt: iso(), durationMs: Math.round(performance.now() - started), error });
    if (status === "failed") {
      const recent = s.jobRuns.filter((r) => r.type === run.type && r.status !== "running");
      let streak = 0;
      for (const r of recent) {
        if (r.status !== "failed") break;
        streak++;
      }
      if (streak >= LIST_BUILD.alertAfterFailures) {
        for (const a of admins()) notify({ userId: a.id, type: "job_paused", text: `${run.type === "list_build" ? "List build" : "Enrichment"} failed ${streak} times in a row: ${error}`, href: "/admin/jobs" });
      }
    }
  };

  const guardFor = (s: S) => ({
    spent: (c: ConnectorId) => s.costLedger.filter((e) => e.connector === c && e.at.startsWith(month())).reduce((n, e) => n + e.costMinor, 0),
    cap: (c: ConnectorId) => s.connectorState[c].capMinor,
    record: (c: ConnectorId, costMinor: number, note: string) => {
      s.costLedger.push({ id: uid("cost"), connector: c, at: iso(), costMinor, note });
    },
  });

  /** The list build for one owner: pages through the plans for their list type until the shortfall is filled. */
  const buildFor = async (s: S, owner: User, target: number, run: JobRun, budget: { requests: number }) => {
    const listType = listTypeOf(s, owner);
    const plans = SEARCH_PLANS.filter((p) => p.listType === listType);
    const fake = createFakeSources({ connected: (id) => s.connectorState[id].connected });
    const known = new Set(s.companies.flatMap((c) => Object.values(c.externalIds ?? {})));
    let added = 0;
    let ready = 0;
    let tried = 0;
    const stats = { duplicates: 0, possible: 0, noChannel: 0, suppressed: 0 };
    while (ready < target && tried < plans.length) {
      const plan = plans[s.planIndex[listType] % plans.length];
      const cursor = s.planCursors[plan.id];
      if (cursor === "done") {
        s.planIndex[listType]++;
        tried++;
        continue;
      }
      if (budget.requests >= LIST_BUILD.maxRequestsPerRun) {
        run.log.push(`Stopped at ${LIST_BUILD.maxRequestsPerRun} requests for this run.`);
        break;
      }
      const source = guarded(fake[plan.connector], { cache: s.sourceCache, guard: guardFor(s), now });
      budget.requests++;
      const page = await source.search(plan, cursor ?? null);
      if (page.cached) {
        const st = s.connectorState[plan.connector];
        st.cacheHits[month()] = (st.cacheHits[month()] ?? 0) + 1;
      }
      run.costMinor += page.costMinor;
      s.planCursors[plan.id] = page.nextCursor ?? "done";
      if (!page.nextCursor) {
        s.planIndex[listType]++;
        tried++;
      }
      const fresh: SourceRecord[] = page.records.filter((r) => {
        if (known.has(r.externalId)) {
          stats.duplicates++;
          return false;
        }
        return true;
      });
      const rows = fresh.map((r, i) => recordToRow(r, i + 1));
      const plan2 = planImport(rows, { companies: s.companies, suppression: s.suppression });
      stats.duplicates += plan2.exact.length;
      stats.noChannel += plan2.invalid.length + plan2.noChannelRows.length;
      stats.suppressed += plan2.suppressedRows.length;
      stats.possible += plan2.possible.length;
      const skip = new Set([...plan2.possible.map((p) => p.row.row), ...plan2.suppressedRows, ...plan2.noChannelRows]);
      const src = sourceFor(s, plan);
      const at = iso();
      for (const row of plan2.candidates) {
        if (ready >= target) break;
        if (skip.has(row.row)) continue;
        const rec = fresh[row.row - 1];
        const company: Company = {
          id: uid("co"), name: row.companyName, domain: row.domain, phone: row.phone, country: row.country, region: row.region, city: row.city,
          timezone: inferTimezone(row.country, row.region), industry: row.industry, listType, brandInterest: listType === "developers" ? ["arcadian"] : ["gllarix"],
          employeesEst: rec.employeesEst, reviewsCount: row.reviewsCount, rating: row.rating, sourceId: src.id, externalIds: { [plan.connector]: rec.externalId }, createdAt: at, updatedAt: at,
        };
        const contact: Contact | null = row.firstName
          ? {
              id: uid("ct"), companyId: company.id, firstName: row.firstName, lastName: row.lastName, title: row.title, email: null, emailStatus: "unknown",
              phone: null, phoneType: phoneType(row.phone), phoneVerified: false, phoneInvalid: false, linkedinUrl: null, isDecisionMaker: /director|owner|founder/i.test(row.title ?? ""),
            }
          : null;
        const lead: Lead = {
          id: uid("ld"), companyId: company.id, primaryContactId: contact?.id ?? null, ownerId: owner.id, listType, stage: "new", score: 0, tier: "D",
          scoreBreakdown: [], scoreModelVersion: "", scoredAt: at, excluded: false, suppressed: false, nextActionAt: null, nextActionType: null, attemptsCount: 0,
          lastTouchAt: null, lawfulBasis: LIST_BUILD.lawfulBasis, importJobId: null, cadenceId: QUEUE.cadenceFor[listType], cadenceStartedAt: null,
          cadenceStepsDone: [], statusReason: null, createdAt: at, updatedAt: at,
        };
        const r = scoreLead({ listType, company, contact, signals: [], suppressed: false, now: new Date(now()) });
        Object.assign(lead, { score: r.score, tier: r.tier, scoreBreakdown: r.breakdown, scoreModelVersion: r.modelVersion, excluded: r.excluded });
        s.companies.push(company);
        if (contact) s.contacts.push(contact);
        s.leads.push(lead);
        known.add(rec.externalId);
        for (const g of recordSignals(rec, now())) {
          const days = SIGNAL_EXPIRY.get(g.key);
          s.signals.push({ id: uid("sg"), leadId: lead.id, key: g.key, value: g.value, source: g.source, observedAt: at, expiresAt: days ? iso(now() + days * DAY) : null });
        }
        activity(s, { leadId: lead.id, userId: null, type: "created", title: `Created from ${src.name}`, detail: `List build for ${owner.name} · ${rec.externalId}`, disposition: null, durationS: null, at });
        auditLead(s, lead, null);
        added++;
        if (isQueueReady(s, lead)) ready++;
      }
    }
    run.log.push(
      `${owner.name} (${listType}): +${added} leads, ${ready} queue-ready of ${target} needed · ${stats.duplicates} duplicates, ${stats.possible} possible duplicates, ${stats.noChannel} without a usable channel, ${stats.suppressed} on the opt-out list skipped`,
    );
    run.items += added;
    return { added, ready };
  };

  const listBuild = async (s: S, opts: { ownerId?: string | null; target?: number; trigger: JobRun["trigger"]; userId: string | null; retryOf?: string | null }): Promise<ListBuildResult> => {
    if (s.jobState.list_build.paused) throw new Error(`List build is paused${s.jobState.list_build.reason ? `: ${s.jobState.list_build.reason}` : ""}. Resume it in Admin › Background jobs.`);
    const started = performance.now();
    const run = startRun(s, "list_build", opts.trigger, opts.userId, { ownerId: opts.ownerId ?? null, target: opts.target }, opts.retryOf ?? null);
    const result: ListBuildResult = { run, owners: [] };
    const budget = { requests: 0 };
    const targets = owners()
      .filter((o) => !opts.ownerId || o.id === opts.ownerId)
      .map((o) => ({ owner: o, shortfall: opts.target ?? ctx.shortfallFor(s, o) }))
      .filter((t) => t.shortfall > 0);
    if (!targets.length) run.log.push("No shortfall in any owner's queue. Nothing to do.");
    try {
      for (const t of targets) {
        const r = await buildFor(s, t.owner, t.shortfall, run, budget);
        result.owners.push({ ownerId: t.owner.id, name: t.owner.name, shortfall: t.shortfall, added: r.added, queueReady: r.ready });
      }
      finishRun(s, run, "succeeded", started);
    } catch (err) {
      if (err instanceof CapReachedError) {
        s.jobState.list_build = { paused: true, reason: err.message };
        run.log.push(err.message);
        finishRun(s, run, "capped", started, err.message);
        for (const a of admins()) notify({ userId: a.id, type: "job_paused", text: `List build paused · ${err.message}`, href: "/admin/jobs" });
      } else if (err instanceof SourceError) {
        run.log.push(err.message);
        finishRun(s, run, "failed", started, err.message);
      } else throw err;
    }
    audit(opts.userId, "job.list_build", "job", run.id, null, { status: run.status, items: run.items, costMinor: run.costMinor });
    return result;
  };

  const enrichment = (s: S, trigger: JobRun["trigger"], userId: string | null, retryOf: string | null = null) => {
    if (s.jobState.enrichment.paused) throw new Error("Enrichment is paused. Resume it in Admin › Background jobs.");
    const started = performance.now();
    const run = startRun(s, "enrichment", trigger, userId, {}, retryOf);
    const lastAudit = new Map<string, string>();
    for (const g of s.signals) if (g.source === "website_audit" && (lastAudit.get(g.leadId) ?? "") < g.observedAt) lastAudit.set(g.leadId, g.observedAt);
    const stale = iso(now() - LIST_BUILD.reauditDays * DAY);
    const due = s.leads
      .filter((l) => !l.suppressed && !["won", "lost"].includes(l.stage) && s.companies.find((c) => c.id === l.companyId)?.domain)
      .filter((l) => (lastAudit.get(l.id) ?? "") < stale)
      .sort((a, b) => (lastAudit.has(a.id) ? 1 : 0) - (lastAudit.has(b.id) ? 1 : 0) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, LIST_BUILD.auditsPerRun);
    for (const lead of due) auditLead(s, lead, null);
    run.items = due.length;
    run.log.push(`${due.length} website audits (never audited first, then older than ${LIST_BUILD.reauditDays} days). PageSpeed included.`);
    finishRun(s, run, "succeeded", started);
    return run;
  };

  const api: LeadSourcesApi = {
    async sourcesOverview() {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const guard = guardFor(s);
      const m = month();
      return {
        connectors: (Object.keys(CONNECTORS) as ConnectorId[]).map((id) => ({
          id, label: CONNECTORS[id].label, connected: s.connectorState[id].connected, needsKey: CONNECTORS[id].needsKey, countries: CONNECTORS[id].countries,
          capMinor: s.connectorState[id].capMinor, spentMinor: guard.spent(id), requests: s.costLedger.filter((e) => e.connector === id && e.at.startsWith(m)).length,
          cacheHits: s.connectorState[id].cacheHits[m] ?? 0, cachedPages: s.sourceCache.filter((c) => c.key.startsWith(`${id}|`)).length,
          costPerRequestMinor: CONNECTORS[id].costPerRequestMinor, terms: CONNECTORS[id].terms,
        })),
        jobs: (["list_build", "enrichment"] as JobType[]).map((type) => {
          const runs = s.jobRuns.filter((r) => r.type === type);
          let streak = 0;
          for (const r of runs) {
            if (r.status !== "failed") break;
            streak++;
          }
          return { type, label: type === "list_build" ? "List build (tops up queue shortfalls)" : "Enrichment and website audits", paused: s.jobState[type].paused, pausedReason: s.jobState[type].reason, lastRun: runs[0] ?? null, consecutiveFailures: streak };
        }),
        runs: s.jobRuns.slice(0, 30),
        shortfalls: owners().map((o) => ({ ownerId: o.id, name: o.name, listType: listTypeOf(s, o), shortfall: ctx.shortfallFor(s, o) })),
      };
    },

    async setConnector(id, patch) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const before = { ...s.connectorState[id] };
      if (patch.connected !== undefined) s.connectorState[id].connected = patch.connected;
      if (patch.capMinor !== undefined) {
        if (!Number.isFinite(patch.capMinor) || patch.capMinor < 0) throw new Error("The cap must be 0 or more.");
        s.connectorState[id].capMinor = Math.round(patch.capMinor);
      }
      audit(user.id, "connector.update", "connector", null, before, s.connectorState[id]);
      await save();
    },

    async runListBuild(opts = {}) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const result = await listBuild(s, { ownerId: opts.ownerId, target: opts.target, trigger: opts.trigger ?? "manual", userId: user.id });
      await save();
      return result;
    },

    async runEnrichment() {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const run = enrichment(s, "manual", user.id);
      await save();
      return run;
    },

    async enrichLead(leadId) {
      const user = await viewer();
      const s = await load();
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) throw new AccessError(404);
      if (user.role !== "admin" && lead.ownerId !== user.id) throw new AccessError(403);
      const r = auditLead(s, lead, user.id);
      if (!r) throw new Error("No website on file to audit.");
      await save();
      return r;
    },

    async setJobPaused(type, paused) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      s.jobState[type] = { paused, reason: paused ? `Paused by ${user.name}` : null };
      audit(user.id, paused ? "job.pause" : "job.resume", "job", type);
      await save();
    },

    async retryJobRun(runId) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const prev = s.jobRuns.find((r) => r.id === runId);
      if (!prev) throw new AccessError(404);
      const run =
        prev.type === "list_build"
          ? (await listBuild(s, { ownerId: prev.params.ownerId, target: prev.params.target, trigger: "retry", userId: user.id, retryOf: prev.id })).run
          : enrichment(s, "retry", user.id, prev.id);
      await save();
      return run;
    },

    async scoringReport(m) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      return scoringReport({ month: m, leads: s.leads, activities: s.activities, meetings: s.meetings });
    },
  };

  return { api };
};
