import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { CALL_RUBRIC } from "@/config/callRubric";
import { data, type AgendaPoint, type CallReviewView, type Scorecard, type TeamOverview } from "@/data";
import { timestamp } from "@/services/coach";
import { hash01 } from "@/services/usagePortal";

const TONE = { met: "var(--mint)", watch: "var(--amber)", neutral: "var(--text)" } as const;
const scoreColor = (v: number | null) => (v === null ? "var(--text-3)" : v >= 80 ? "var(--mint)" : v >= 70 ? "var(--cyan)" : "var(--amber)");
const money = (minor: number | null, c: "USD" | "EUR") => (minor === null ? "—" : `${c === "USD" ? "$" : "€"}${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`);

/** The legal go/no-go switch (A17): AI scoring stays off until counsel confirms the obligations. */
const LegalFlag = ({ aiOn, onChange }: { aiOn: boolean; onChange: () => void }) => {
  const user = useUser();
  const toast = useToast();
  if (aiOn && user.role !== "admin") return null;
  return (
    <section aria-label="AI scoring" className={`flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-[13px] ${aiOn ? "border-line" : "border-amber-line"}`}>
      <span className={aiOn ? "text-text-3" : "text-amber"}>
        {aiOn
          ? "AI call scoring is on (legal check recorded). Scores are advice; a founder checks a weekly sample."
          : "AI scoring is off until the legal check is done: AI used to evaluate workers is high-risk under the EU AI Act. Only results and discipline show."}
      </span>
      {user.role === "admin" ? (
        <button
          type="button"
          className="btn-outline h-8 text-[11px]"
          onClick={async () => {
            if (!aiOn && !window.confirm("Turn on AI call scoring? Only after counsel has confirmed the obligations (notice, logs, human oversight, accuracy checks). In demo mode this uses the fake coach.")) return;
            await data.setAiScoring(!aiOn);
            toast(aiOn ? "AI scoring off" : "AI scoring on · scoring this week's calls", "good");
            onChange();
          }}
        >
          {aiOn ? "Turn off" : "Legal check done · turn on"}
        </button>
      ) : null}
    </section>
  );
};

/** /team (screen 21): each person against their targets. No single score, no ranking. */
const TeamPage = () => {
  const user = useUser();
  const toast = useToast();
  const [o, setO] = useState<TeamOverview | { redirectTo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      await data.runCoachingJobs();
      setO(await data.teamOverview());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const view = o && "week" in o ? o : null;
  usePageChrome({ context: view ? `${view.weekLabel} · visible to each person` : "Team performance", action: user.role === "admin" ? { label: "Prepare 1:1s", to: "/team?prepare=1" } : undefined });
  useEffect(() => {
    if (!view || user.role !== "admin" || !new URLSearchParams(location.search).has("prepare")) return;
    data.prepareOneOnOnes().then((n) => toast(`${n} weekly 1:1 agendas drafted`, "good"), (e: Error) => toast(e.message, "error"));
    history.replaceState(null, "", "/team");
  }, [view, user.role, toast]);

  if (error) return <EmptyState title={error} />;
  if (!o) return <SkeletonRows rows={6} />;
  if ("redirectTo" in o) return <Navigate to={`/team/${o.redirectTo}`} replace />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="label-caps">Results, quality and reliability against your targets</span>
          <h1 className="page-title m-0">Team performance</h1>
        </div>
        <span className="text-[12px] text-text-3">No single "employee score" · AI suggests, people decide</span>
      </div>
      <LegalFlag aiOn={o.aiOn} onChange={load} />

      {o.totals.length ? (
        <section aria-label="Team totals" className="grid gap-3 sm:grid-cols-3">
          {o.totals.map((t) => (
            <div key={t.key} className="card flex flex-col gap-1.5 p-4">
              <span className="text-[10px] tracking-[0.2em] text-label">{t.label}</span>
              <span className="num text-[28px] font-light">{t.value}</span>
              <span className="text-[11px] text-text-3">{t.target}</span>
            </div>
          ))}
        </section>
      ) : null}

      {o.cards.length ? (
        <section aria-label="People" className="grid gap-3 lg:grid-cols-3">
          {o.cards.map((c) => {
            const body = (
              <>
                <span className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[12px] text-text-3">{c.n}</span>
                  <span className="text-[16px]">{c.name}</span>
                </span>
                <span className="text-[12px] text-text-3">{c.role}</span>
                <div className="grid grid-cols-2 gap-3">
                  {c.stats.map((s) => (
                    <div key={s.key} className="flex flex-col gap-1">
                      <span className="text-[10px] tracking-[0.2em] text-label">{s.label}</span>
                      <span className="num text-[24px] font-light" style={{ color: TONE[s.status] }}>
                        {s.value}
                      </span>
                      <span className="text-[11px] text-text-3">{s.target}</span>
                    </div>
                  ))}
                </div>
                {c.focus ? (
                  <div className="flex flex-col gap-1 border-t border-line pt-3">
                    <span className="text-[10px] tracking-[0.22em] text-cyan">AI COACHING FOCUS</span>
                    <span className="text-[13px] text-text-2">{c.focus}</span>
                  </div>
                ) : null}
              </>
            );
            return c.href ? (
              <Link key={c.name} to={c.href} className="card flex flex-col gap-3.5 p-5 hover:border-line-strong">
                {body}
              </Link>
            ) : (
              <div key={c.name} className="card flex flex-col gap-3.5 p-5">
                {body}
              </div>
            );
          })}
        </section>
      ) : null}

      {o.humanChecks.length ? (
        <section aria-label="Human checks" className="card flex flex-col">
          <span className="label-caps border-b border-line px-4 py-3">Your human checks this week · {o.humanChecks.length}</span>
          {o.humanChecks.map((h) => (
            <Link key={h.reviewId} to={`/team/calls/${h.reviewId}`} className="flex justify-between gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0 hover:bg-surface-2">
              <span>
                {h.repName.split(" ")[0]} · {h.companyName}
              </span>
              <span className={h.reason === "dispute" ? "text-amber" : "text-text-3"}>{h.reason === "dispute" ? "disputed" : new Date(h.at).toISOString().slice(0, 10)}</span>
            </Link>
          ))}
        </section>
      ) : null}

      {o.insights ? (
        <section aria-label="What's working" className="card flex flex-col">
          <span className="label-caps border-b border-line px-4 py-3">What's working · from {o.scoredCalls} scored calls</span>
          {o.insights.map((i) => (
            <div key={i.key} className="grid grid-cols-[minmax(0,1fr)_110px_minmax(0,0.8fr)] gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
              <span>{i.pattern}</span>
              <span className="num text-mint">{i.effect}</span>
              <span className="text-text-2">
                {i.metric} <span className="text-text-3">· {i.calls} calls</span>
              </span>
            </div>
          ))}
          {!o.insights.length ? <span className="px-4 py-3 text-[13px] text-text-3">Patterns show once at least 30 calls are behind them.</span> : null}
        </section>
      ) : null}

      {o.rubricFlags.length && user.role === "admin" ? (
        <section aria-label="Rubric review" className="flex flex-col gap-1.5 border border-amber-line px-4 py-3 text-[13px]">
          <span className="label-caps text-amber">Rubric review · human and AI disagree by more than 15 points</span>
          {o.rubricFlags.slice(-5).map((f) => (
            <Link key={f.reviewId} to={`/team/calls/${f.reviewId}`} className="text-text-2 hover:text-text">
              Gap {f.gap} points · {f.at.slice(0, 10)}
            </Link>
          ))}
        </section>
      ) : null}

      <section aria-label="How this is measured" className="flex flex-col gap-1.5 text-[13px] text-text-2">
        <span className="label-caps">How this is measured</span>
        {o.guardrails.map((g) => (
          <span key={g}>· {g}</span>
        ))}
      </section>
    </div>
  );
};

const AgendaEditor = ({ points, onSave, onCancel }: { points: AgendaPoint[]; onSave: (p: AgendaPoint[]) => void; onCancel: () => void }) => {
  const [p, setP] = useState(points);
  return (
    <div className="flex flex-col gap-2">
      {p.map((x, i) => (
        <textarea key={x.kind} className="input min-h-[56px] text-[13px]" value={x.text} onChange={(e) => setP(p.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))} aria-label={x.kind} />
      ))}
      <div className="flex gap-2">
        <button type="button" className="btn-outline h-8 text-[11px]" onClick={() => onSave(p)}>
          Save agenda
        </button>
        <button type="button" className="btn-ghost h-8 text-[11px]" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

/** /team/:userId (screen 22): the person sees exactly this page too. */
const ScorecardPage = () => {
  const { userId = "" } = useParams();
  const user = useUser();
  const toast = useToast();
  const [sc, setSc] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [editAgenda, setEditAgenda] = useState(false);
  const load = useCallback(() => data.scorecard(userId).then(setSc, (e: Error) => setError(e.message)), [userId]);
  useEffect(() => {
    load();
  }, [load]);
  usePageChrome({ context: sc ? `The ${sc.role.toLowerCase()} sees this page too` : "Scorecard", action: user.role === "admin" ? { label: "Back to team", to: "/team" } : undefined });
  if (error) return <EmptyState title={error} />;
  if (!sc) return <SkeletonRows rows={8} />;
  const cur = sc.weeks.length - 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[30px] font-light tracking-[-0.02em] sm:text-[34px]">{sc.name} · scorecard</h1>
        <span className="text-[13px] text-text-3">{sc.tenure}</span>
      </div>
      <LegalFlag aiOn={sc.aiOn} onChange={load} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Weekly KPIs" className="card min-w-0 overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-[minmax(0,1.6fr)_repeat(4,56px)_70px_86px] gap-2 border-b border-line px-4 py-2.5 text-[10px] tracking-[0.2em] text-text-3 bg-surface-2">
              <span>KPI</span>
              {sc.weeks.map((w) => (
                <span key={w.key}>{w.label}</span>
              ))}
              <span>TARGET</span>
              <span>STATUS</span>
            </div>
            {sc.kpis.map((k) => (
              <div key={k.label} className="grid min-w-[560px] grid-cols-[minmax(0,1.6fr)_repeat(4,56px)_70px_86px] items-center gap-2 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
                <span className="truncate">{k.label}</span>
                {k.values.map((v, i) => (
                  <span key={i} className={`num font-mono text-[12px] ${i === cur ? "text-text" : "text-text-3"}`}>
                    {v ?? "—"}
                  </span>
                ))}
                <span className="font-mono text-[12px] text-text-2">{k.target}</span>
                <span className="text-[10px] tracking-[0.18em]" style={{ color: k.status === "on_track" ? "var(--mint)" : k.status ? "var(--amber)" : "var(--text-3)" }}>
                  {k.status === "on_track" ? "ON TRACK" : k.status ? "WATCH" : "—"}
                </span>
              </div>
            ))}
          </section>

          {sc.quality ? (
            <section aria-label="Call quality" className="card flex flex-col gap-3 p-5">
              <span className="label-caps">
                Call quality · {sc.quality.scored} calls scored · {sc.quality.humanChecked} human-checked
              </span>
              <span className="num text-[30px] font-light" style={{ color: scoreColor(sc.quality.overall) }}>
                {sc.quality.overall ?? "—"} <span className="text-[14px] text-text-3">/ 100 · discovery counts double</span>
              </span>
              {sc.quality.items.map((i) => (
                <div key={i.key} className="flex flex-col gap-1">
                  <span className="flex justify-between text-[12px] text-text-2">
                    <span>{i.label}</span>
                    <span className="font-mono">{i.value ?? "—"}</span>
                  </span>
                  <span className="h-[3px] bg-line">
                    <span className="block h-[3px]" style={{ width: `${i.value ?? 0}%`, background: scoreColor(i.value) }} />
                  </span>
                </div>
              ))}
              <span className="flex justify-between text-[12px] text-text-2">
                <span>Compliance: AI and recording notice, honest claims</span>
                <span className="font-mono" style={{ color: sc.quality.compliancePassRate === 1 ? "var(--mint)" : "var(--amber)" }}>
                  {sc.quality.compliancePassRate === null ? "—" : `${Math.round(sc.quality.compliancePassRate * 100)}% pass`}
                </span>
              </span>
            </section>
          ) : null}

          {sc.reviews.length ? (
            <section aria-label="Scored calls" className="card flex flex-col">
              <span className="label-caps border-b border-line px-4 py-3">Calls · this week and last</span>
              {sc.reviews.slice(0, 30).map((r) => (
                <Link key={r.id} to={`/team/calls/${r.id}`} className={`flex justify-between gap-3 border-b border-line-soft px-4 py-2 text-[13px] last:border-b-0 ${r.status === "scored" ? "hover:bg-surface-2" : "pointer-events-none text-text-3"}`}>
                  <span className="truncate">
                    {r.companyName} <span className="text-text-3">· {r.at.slice(5, 10)} · {timestamp(r.durationS)}</span>
                  </span>
                  <span className="flex shrink-0 gap-3">
                    {r.disputed ? <span className="text-amber">disputed</span> : null}
                    {!r.compliancePass ? <span className="text-coral">compliance</span> : null}
                    <span className="font-mono" style={{ color: scoreColor(r.total) }}>
                      {r.status === "scored" ? r.total : "not scored"}
                    </span>
                  </span>
                </Link>
              ))}
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          {sc.aiOn ? (
            <section aria-label="1:1 agenda" className="flex flex-col gap-2.5 border border-cyan-line px-[18px] py-4 text-[13px]">
              <span className="flex items-center justify-between">
                <span className="label-caps text-cyan">1:1 agenda · {sc.agenda?.editedBy ? "edited" : "AI draft"}</span>
                {sc.canEditAgenda && sc.agenda && !editAgenda ? (
                  <button type="button" className="text-[11px] text-cyan" onClick={() => setEditAgenda(true)}>
                    Edit
                  </button>
                ) : null}
              </span>
              {!sc.agenda ? (
                <span className="text-text-3">No agenda yet. Admins prepare 1:1s from Team performance.</span>
              ) : editAgenda ? (
                <AgendaEditor
                  points={sc.agenda.points}
                  onCancel={() => setEditAgenda(false)}
                  onSave={async (p) => {
                    await data.updateAgenda(sc.userId, sc.agenda!.week, p);
                    setEditAgenda(false);
                    load();
                  }}
                />
              ) : (
                <>
                  {sc.agenda.points.map((p, i) => (
                    <span key={p.kind} className="flex gap-2.5">
                      <span className="font-mono text-text-3">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-text-2">{p.text}</span>
                    </span>
                  ))}
                  {sc.agenda.points.find((p) => p.kind === "focus")?.reviewIds.length ? (
                    <span className="flex flex-wrap gap-3 text-[11px] tracking-[0.18em]">
                      {sc.agenda.points
                        .find((p) => p.kind === "focus")!
                        .reviewIds.map((id, i) => (
                          <Link key={id} to={`/team/calls/${id}`} className="text-cyan">
                            Listen to example call {i + 1} ↗
                          </Link>
                        ))}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-text-3">Week {Number(sc.agenda.week.slice(6))} · AI suggests, people decide.</span>
                </>
              )}
            </section>
          ) : null}

          <section aria-label="Earnings" className="card flex flex-col gap-2 px-[18px] py-4 text-[13px]">
            <span className="label-caps">Earnings · {sc.earnings.month} · fixed rules</span>
            {sc.earnings.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-3">
                <span className="text-text-2">{l.label}</span>
                <span className="num font-mono">{money(l.amountMinor, l.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-2">
              <span>Total from commissions</span>
              <span className="num font-mono text-mint">{money(sc.earnings.totalMinor, sc.earnings.currency)}</span>
            </div>
            <span className="text-[11px] text-text-3">Read from the commission rows only. AI scores never affect pay.</span>
          </section>

          <section aria-label="Comments" className="flex flex-col gap-2.5 text-[13px]">
            <span className="label-caps">Comments</span>
            {sc.comments.map((c) => (
              <div key={c.id} className="flex flex-col gap-0.5">
                <span className="text-[11px] text-text-3">
                  {c.authorName} · {c.at.slice(0, 16).replace("T", " ")}
                  {c.kind === "dispute" ? <span className="text-amber"> · disputes a call score</span> : null}
                </span>
                <span>{c.body}</span>
              </div>
            ))}
            <form
              className="flex flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await data.addScorecardComment(sc.userId, comment);
                  setComment("");
                  load();
                } catch (err) {
                  toast((err as Error).message, "error");
                }
              }}
            >
              <textarea className="input h-14 resize-none" placeholder="Comment on this scorecard" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button type="submit" className="btn-outline h-8 self-start text-[11px]" disabled={!comment.trim()}>
                Comment
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
};

/** /team/calls/:id (screen 23). The player is simulated in demo mode (no audio); recordings are signed, expiring URLs. */
const CallReviewPage = () => {
  const { id = "" } = useParams();
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [v, setV] = useState<CallReviewView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [human, setHuman] = useState("");
  const [dispute, setDispute] = useState("");
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const load = useCallback(() => data.getCallReview(id).then(setV, (e: Error) => setError(e.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);
  const duration = v?.review.durationS ?? 0;
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setPos((p) => (p + 1 >= duration ? (setPlaying(false), duration) : p + 1)), 1000);
    return () => window.clearInterval(t);
  }, [playing, duration]);
  const bars = useMemo(() => Array.from({ length: 60 }, (_, i) => 4 + Math.round(hash01(`${id}:${i}`) * 24)), [id]);
  usePageChrome({ context: v ? `Team / ${v.repName} / call review` : "Call review", action: v?.review.userId ? { label: "Back to scorecard", to: `/team/${v.review.userId}` } : undefined });

  if (error) return <EmptyState title={error} />;
  if (!v) return <SkeletonRows rows={8} />;
  const r = v.review;
  const lines = r.lines ?? [];
  const seek = (t: number) => {
    setPos(Math.max(0, Math.min(duration, t)));
    const i = lines.findIndex((l, k) => l.t <= t && (lines[k + 1]?.t ?? Infinity) > t);
    lineRefs.current[i]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    if (e.key === " ") {
      e.preventDefault();
      setPlaying((p) => !p);
    } else if (e.key === "ArrowLeft") seek(pos - 5);
    else if (e.key === "ArrowRight") seek(pos + 5);
  };
  const outcome = (r.disposition ?? "").toUpperCase();
  const tz = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(r.at));
  const items = r.result.items;

  return (
    <div className="flex flex-col gap-5" tabIndex={0} onKeyDown={onKey} aria-label="Call review. Space plays or pauses; arrows move 5 seconds.">
      <div className="flex flex-col gap-2.5">
        <span className="flex flex-wrap gap-2">
          <span className={`border px-2 py-[3px] text-[10px] tracking-[0.2em] ${/booked/i.test(outcome) ? "border-mint text-mint" : "border-line-strong text-text-2"}`}>{outcome || "CALL"}</span>
          <span className="border border-line-strong px-2 py-[3px] text-[10px] tracking-[0.2em] text-text-2">COLD CALL · {timestamp(duration)}</span>
          {!r.result.compliancePass ? <span className="border border-coral px-2 py-[3px] text-[10px] tracking-[0.2em] text-coral">COMPLIANCE CHECK</span> : null}
          {r.disputed && !r.disputed.resolvedAt ? <span className="border border-amber px-2 py-[3px] text-[10px] tracking-[0.2em] text-amber">DISPUTED</span> : null}
        </span>
        <h1 className="m-0 text-[28px] font-light tracking-[-0.02em] sm:text-[32px]">
          {r.companyName} · {tz}
        </h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Player" className="card flex items-center gap-4 p-4">
            <button type="button" aria-label={playing ? "Pause" : "Play"} className="flex h-10 w-10 shrink-0 items-center justify-center bg-ice text-ice-ink" onClick={() => setPlaying((p) => !p)} disabled={!r.recording.url}>
              {playing ? "❚❚" : "▶"}
            </button>
            <div
              className="flex h-10 flex-1 cursor-pointer items-center gap-[2px]"
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={pos}
              tabIndex={-1}
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                seek(Math.round(((e.clientX - rect.left) / rect.width) * duration));
              }}
            >
              {bars.map((h, i) => (
                <span key={i} className="min-w-0 flex-1" style={{ height: h, background: i / bars.length <= pos / Math.max(1, duration) ? "var(--cyan-line)" : "var(--line-strong)" }} />
              ))}
            </div>
            <span className="shrink-0 font-mono text-[12px] text-text-2">
              {timestamp(pos)} / {timestamp(duration)}
            </span>
          </section>
          {!r.recording.url ? <span className="text-[12px] text-text-3">Recording deleted (kept {90} days). The transcript stays for 12 months.</span> : <span className="text-[11px] text-text-3">Demo: no audio. In Supabase mode recordings stream from a signed URL that expires.</span>}

          <section aria-label="Transcript" className="card flex flex-col">
            {lines.map((l, i) => {
              const active = pos >= l.t && pos < (lines[i + 1]?.t ?? Infinity);
              const flagged = r.result.flaggedLine === i;
              return (
                <div key={i} ref={(el) => (lineRefs.current[i] = el)} className={`grid grid-cols-[52px_82px_minmax(0,1fr)] gap-3 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0 ${flagged ? "bg-surface-2" : ""} ${active ? "outline outline-1 outline-cyan-line" : ""}`}>
                  <button type="button" className="text-left font-mono text-[12px] text-text-3 hover:text-cyan" onClick={() => seek(l.t)}>
                    {timestamp(l.t)}
                  </button>
                  <span className="text-[10px] tracking-[0.2em]" style={{ color: l.speaker === "rep" ? "var(--cyan)" : "var(--lavender)" }}>
                    {l.speaker === "rep" ? "BDR" : "PROSPECT"}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span>{l.text}</span>
                    {(r.result.tags[i] ?? []).map((t) => (
                      <span key={t.text} className="text-[10px] tracking-[0.18em]" style={{ color: t.tone === "good" ? "var(--mint)" : "var(--amber)" }}>
                        {t.text}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section aria-label="AI score" className="card flex flex-col gap-2.5 px-[18px] py-4 text-[13px]">
            <span className="label-caps">AI score · discovery counts double</span>
            <span className="num text-[30px] font-light" style={{ color: scoreColor(r.result.total) }}>
              {r.result.total ?? "—"}
            </span>
            {items.map((it) => {
              const label = CALL_RUBRIC.items.find((x) => x.key === it.key)?.short ?? it.key;
              return (
                <button key={it.key} type="button" className="flex justify-between gap-3 text-left hover:text-cyan disabled:hover:text-text" disabled={!it.evidence.length} onClick={() => it.evidence[0] && seek(it.evidence[0].t)} title={it.evidence.map((e) => `${timestamp(e.t)} “${e.text}”`).join("\n")}>
                  <span className="text-text-2">{label}</span>
                  <span className="font-mono" style={{ color: scoreColor(it.score) }}>
                    {it.score ?? "n/a"}
                  </span>
                </button>
              );
            })}
            <div className="flex justify-between gap-3 border-t border-line pt-2">
              <span className="text-text-2">Compliance</span>
              <span style={{ color: r.result.compliancePass ? "var(--mint)" : "var(--coral)" }}>{r.result.compliancePass ? "Pass" : "Fail"}</span>
            </div>
            {r.result.compliance
              .filter((c) => !c.pass)
              .map((c) => (
                <span key={c.key} className="text-[12px] text-coral">
                  {CALL_RUBRIC.compliance.find((x) => x.key === c.key)?.label}: {c.evidence[0] ? `“${c.evidence[0].text}”` : "missing"}
                </span>
              ))}
            <span className="text-[11px] text-text-3">Click an item to jump to its evidence. {r.model} · rubric {r.rubricVersion}</span>
          </section>

          {r.result.tryNext.length || r.result.keepDoing.length ? (
            <section aria-label="Try next time" className="flex flex-col gap-2.5 border border-cyan-line px-[18px] py-4 text-[13px]">
              <span className="label-caps text-cyan">Try next time</span>
              {r.result.tryNext.map((t) => (
                <span key={t.text} className="flex flex-col gap-1">
                  <span className="text-text-2">{t.text}</span>
                  <button type="button" className="text-left text-[12px] text-text-3 hover:text-cyan" onClick={() => seek(t.t)}>
                    {timestamp(t.t)} · “{t.example}”
                  </button>
                </span>
              ))}
              {r.result.keepDoing.length ? <span className="text-[12px] text-mint">Keep doing: {r.result.keepDoing.join(" ")}</span> : null}
            </section>
          ) : null}

          {v.canHumanCheck ? (
            <section aria-label="Human check" className="card flex flex-col gap-2.5 px-[18px] py-4 text-[13px]">
              <span className="label-caps">Human check · {user.name.split(" ")[0]}</span>
              {r.human ? (
                <span className={r.human.flagged ? "text-amber" : "text-mint"}>
                  Your score {r.human.score} vs AI {r.result.total}: {r.human.flagged ? `gap ${r.human.gap}, flagged for the rubric review` : "accepted"}.
                </span>
              ) : null}
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await data.humanCheck(r.id, Number(human));
                    toast("Review confirmed", "good");
                    setHuman("");
                    load();
                  } catch (err) {
                    toast((err as Error).message, "error");
                  }
                }}
              >
                <input className="input h-9 w-24 font-mono" inputMode="numeric" placeholder="0–100" value={human} onChange={(e) => setHuman(e.target.value)} aria-label="Your score" />
                <button type="submit" className="btn-outline h-9 flex-1 text-[11px]" disabled={!human}>
                  Confirm review
                </button>
              </form>
              <span className="text-[11px] text-text-3">Within 15 points of the AI: accepted. Bigger gaps flag the rubric for review.</span>
            </section>
          ) : null}

          {v.canDispute ? (
            <section aria-label="Dispute" className="flex flex-col gap-2 text-[13px]">
              <span className="label-caps">Disagree with this score?</span>
              <textarea className="input h-14 resize-none" placeholder="What did the score miss?" value={dispute} onChange={(e) => setDispute(e.target.value)} />
              <button
                type="button"
                className="btn-outline h-8 self-start text-[11px]"
                disabled={!dispute.trim()}
                onClick={async () => {
                  try {
                    await data.disputeReview(r.id, dispute);
                    toast("Dispute sent · a founder re-checks this call", "good");
                    setDispute("");
                    load();
                  } catch (e) {
                    toast((e as Error).message, "error");
                  }
                }}
              >
                Dispute score
              </button>
            </section>
          ) : null}
          <button type="button" className="btn-ghost self-start text-[11px]" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </aside>
      </div>
    </div>
  );
};

const TeamModule = () => (
  <Routes>
    <Route index element={<TeamPage />} />
    <Route path="calls/:id" element={<CallReviewPage />} />
    <Route path=":userId" element={<ScorecardPage />} />
  </Routes>
);

export default TeamModule;
