import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { data, type JobRun, type SourcesOverview } from "@/data";

const STATUS_CLS: Record<JobRun["status"], string> = { running: "text-cyan", succeeded: "text-mint", failed: "text-coral", capped: "text-amber" };
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

/** Admin › Background jobs (admin/08_BACKGROUND_JOBS.md): list build and enrichment, with runs, logs, retry and pause. */
const JobsSection = () => {
  const [o, setO] = useState<SourcesOverview | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const load = useCallback(() => data.sourcesOverview().then(setO, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done, "good");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
      load();
    }
  };

  if (error) return <EmptyState title={error} />;
  if (!o) return <SkeletonRows rows={6} />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Background jobs</h1>

      <section aria-label="Queue shortfalls" className="card flex flex-col p-5">
        <span className="label-caps pb-3">Queue shortfalls · what the list build tops up</span>
        {o.shortfalls.map((s) => (
          <div key={s.ownerId} className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft py-2 text-[13px] last:border-b-0">
            <span>
              {s.name} <span className="text-text-3">· {s.listType}</span>
            </span>
            <span className="flex items-center gap-4">
              <span className={`num font-mono ${s.shortfall ? "text-amber" : "text-mint"}`}>{s.shortfall ? `${s.shortfall} short` : "full"}</span>
              {s.shortfall ? (
                <button
                  type="button"
                  className="btn-ghost h-8 text-[11px]"
                  disabled={!!busy}
                  onClick={() =>
                    act(`lb-${s.ownerId}`, () => data.runListBuild({ ownerId: s.ownerId }), `List build ran for ${s.name}`)
                  }
                >
                  {busy === `lb-${s.ownerId}` ? "Running…" : "Top up"}
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </section>

      <section aria-label="Job types" className="card flex flex-col">
        {o.jobs.map((j) => (
          <div key={j.type} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line-soft px-5 py-4 text-[13px] last:border-b-0">
            <span className="flex min-w-[220px] flex-1 flex-col gap-0.5">
              <span>{j.label}</span>
              {j.paused ? <span className="text-[12px] text-amber">Paused · {j.pausedReason}</span> : <span className="text-[12px] text-text-3">{j.type === "list_build" ? "Runs after the 05:00 queue build" : "Runs nightly"}</span>}
            </span>
            <span className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-text-2">
              <span>
                Last run <span className="num text-text">{j.lastRun ? when(j.lastRun.startedAt) : "never"}</span>
              </span>
              {j.lastRun ? (
                <>
                  <span className={STATUS_CLS[j.lastRun.status]}>
                    {j.lastRun.status}
                    {j.consecutiveFailures >= 2 ? ` · ${j.consecutiveFailures} in a row` : ""}
                  </span>
                  <span className="num">{j.lastRun.durationMs} ms</span>
                  <span className="num">{j.lastRun.items} items</span>
                  <span className="num">{usd(j.lastRun.costMinor)}</span>
                </>
              ) : null}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="btn-outline h-9 text-[11px]"
                disabled={!!busy || j.paused}
                onClick={() =>
                  act(j.type, () => (j.type === "list_build" ? data.runListBuild() : data.runEnrichment()), j.type === "list_build" ? "List build finished" : "Enrichment finished")
                }
              >
                {busy === j.type ? "Running…" : "Run now"}
              </button>
              <button type="button" className="btn-ghost h-9 text-[11px]" disabled={!!busy} onClick={() => act(`p-${j.type}`, () => data.setJobPaused(j.type, !j.paused), j.paused ? "Resumed" : "Paused")}>
                {j.paused ? "Resume" : "Pause"}
              </button>
            </span>
          </div>
        ))}
      </section>

      <section aria-label="Runs" className="card flex flex-col">
        <span className="label-caps border-b border-line px-5 py-3">Runs</span>
        {o.runs.length ? (
          o.runs.map((r) => (
            <div key={r.id} className="border-b border-line-soft last:border-b-0">
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-left text-[13px] hover:bg-surface-2">
                <span>
                  {r.type === "list_build" ? "List build" : "Enrichment"} <span className="text-text-3">· {r.trigger}{r.retryOf ? " of a failed run" : ""}</span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="num text-text-2">{when(r.startedAt)}</span>
                  <span className="num">{r.items} items</span>
                  <span className="num">{usd(r.costMinor)}</span>
                  <span className={STATUS_CLS[r.status]}>{r.status}</span>
                </span>
              </button>
              {open === r.id ? (
                <div className="flex flex-col gap-1.5 bg-bg-deep px-5 py-3 font-mono text-[12px] text-text-2">
                  {r.log.map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                  {r.error ? <span className="text-coral">Error: {r.error}</span> : null}
                  {r.status === "failed" || r.status === "capped" ? (
                    <button type="button" className="btn-outline mt-2 h-9 self-start text-[11px]" disabled={!!busy} onClick={() => act(`r-${r.id}`, () => data.retryJobRun(r.id), "Retried")}>
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="m-0 px-5 py-6 text-[13px] text-text-2">No runs yet. Run the list build to top up queue shortfalls.</p>
        )}
      </section>
      <p className="m-0 text-[12px] text-text-3">
        Other jobs (queue build, email sender, billing and usage import) run from their own screens in demo mode; in Supabase mode they're pg_cron Edge Functions and report here too.
      </p>
    </div>
  );
};

export default JobsSection;
