import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { CATEGORY_COLOR, CELL_STEP_HOURS, TIME_CATEGORIES } from "@/config/time";
import { data, type MyWeek, type ReportGroup, type TimeEntryView, type TimeLink, type TimeReport, type Timesheet } from "@/data";
import { clock, TIMER_EVENT, timerChanged } from "@/lib/timer";
import { shiftWeek } from "@/services/time";

const h1 = (h: number) => (h ? h.toFixed(1) : "—");
const catColor = (c: string) => `var(--${CATEGORY_COLOR[c] ?? "text-2"})`;
const STATUS_TONE: Record<Timesheet["status"], string> = { draft: "var(--text-3)", submitted: "var(--amber)", approved: "var(--mint)" };

type Targets = Awaited<ReturnType<typeof data.timeTargets>>;
const targetOptions = (t: Targets) => [
  ...t.projects.map((p) => ({ value: `project:${p.id}`, label: p.name, group: "Clients and projects" })),
  ...t.clients.map((c) => ({ value: `client:${c.id}`, label: c.name, group: "Clients" })),
  ...t.tasks.map((x) => ({ value: `task:${x.id}`, label: x.title, group: "My tasks", category: x.category })),
];
const parseTarget = (v: string): TimeLink | null => (v ? { type: v.split(":")[0] as TimeLink["type"], id: v.split(":").slice(1).join(":") } : null);

const TargetSelect = ({ targets, value, onChange, allowNone }: { targets: Targets; value: string; onChange: (v: string) => void; allowNone?: boolean }) => {
  const opts = targetOptions(targets);
  const groups = [...new Set(opts.map((o) => o.group))];
  return (
    <select className="input h-10" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Task, client or project">
      {allowNone ? <option value="">Not linked</option> : <option value="">Choose…</option>}
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {opts.filter((o) => o.group === g).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

/** Start (or switch) the timer on a task, client or project. */
const StartTimerModal = ({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: () => void }) => {
  const toast = useToast();
  const [targets, setTargets] = useState<Targets | null>(null);
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState<string>("Sales");
  useEffect(() => {
    if (open) data.timeTargets().then(setTargets);
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Start a timer">
      {targets ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const link = parseTarget(target);
            if (!link) return;
            try {
              const task = link.type === "task" ? targets.tasks.find((t) => t.id === link.id) : null;
              await data.startTimerOn(link, task?.category ?? category);
              timerChanged();
              onStarted();
              onClose();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="field-label">On</span>
            <TargetSelect targets={targets} value={target} onChange={setTarget} />
          </label>
          {parseTarget(target)?.type !== "task" ? (
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Category</span>
              <select className="input h-10" value={category} onChange={(e) => setCategory(e.target.value)}>
                {TIME_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          ) : null}
          <span className="text-[12px] text-text-3">One timer at a time: starting this stops and logs any running timer.</span>
          <button type="submit" className="btn-primary h-11 justify-between" disabled={!target}>
            <span>Start</span>
            <span aria-hidden>→</span>
          </button>
        </form>
      ) : (
        <SkeletonRows rows={2} />
      )}
    </Modal>
  );
};

/** Manual entry: a new row in the grid, or extra time on a day. */
const ManualEntryModal = ({ open, onClose, week, userId, onSaved }: { open: boolean; onClose: () => void; week: MyWeek; userId: string; onSaved: () => void }) => {
  const toast = useToast();
  const [targets, setTargets] = useState<Targets | null>(null);
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState<string>("Sales");
  const [date, setDate] = useState(week.days[0].date);
  const [hours, setHours] = useState("1");
  const [billable, setBillable] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) data.timeTargets().then(setTargets);
  }, [open]);
  const link = parseTarget(target);
  const canBill = link?.type === "client" || link?.type === "project";
  return (
    <Modal open={open} onClose={onClose} title="Add a row or manual entry">
      {targets ? (
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const task = link?.type === "task" ? targets.tasks.find((t) => t.id === link.id) : null;
              await data.addManualEntry({ date, minutes: Math.round(Number(hours) * 60), link, category: task?.category ?? category, billable: canBill && billable, note, userId });
              onSaved();
              onClose();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="field-label">Task, client or project</span>
            <TargetSelect targets={targets} value={target} onChange={setTarget} allowNone />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Day</span>
            <select className="input h-10" value={date} onChange={(e) => setDate(e.target.value)}>
              {week.days.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Hours</span>
            <input className="input h-10 font-mono" type="number" min={CELL_STEP_HOURS} max={24} step={CELL_STEP_HOURS} value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          {link?.type !== "task" ? (
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Category</span>
              <select className="input h-10" value={category} onChange={(e) => setCategory(e.target.value)}>
                {TIME_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={`flex items-center gap-2 self-end pb-2.5 text-[13px] ${canBill ? "" : "text-text-3"}`}>
            <input type="checkbox" checked={canBill && billable} disabled={!canBill} onChange={(e) => setBillable(e.target.checked)} />
            Billable by the hour (custom software)
          </label>
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="field-label">Note</span>
            <input className="input h-10" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </label>
          <button type="submit" className="btn-primary col-span-2 h-11 justify-between">
            <span>Add entry</span>
            <span aria-hidden>→</span>
          </button>
        </form>
      ) : (
        <SkeletonRows rows={3} />
      )}
    </Modal>
  );
};

/** One grid cell: type hours, saved on blur or Enter (rounded to a quarter hour). */
const Cell = ({ value, disabled, onSave, label }: { value: number; disabled: boolean; onSave: (h: number) => Promise<void>; label: string }) => {
  const [v, setV] = useState(value ? String(value) : "");
  useEffect(() => setV(value ? String(value) : ""), [value]);
  const commit = () => {
    const n = v.trim() === "" ? 0 : Number(v);
    if (Number.isNaN(n) || n === value) return setV(value ? String(value) : "");
    onSave(n).catch(() => setV(value ? String(value) : ""));
  };
  return (
    <input
      aria-label={label}
      className="h-8 w-full border border-line bg-transparent text-center font-mono text-[12px] text-text placeholder:text-text-3 focus:border-line-strong focus:outline-none disabled:text-text-2"
      inputMode="decimal"
      placeholder="—"
      disabled={disabled}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(value ? String(value) : "");
      }}
    />
  );
};

const TimerCard = ({ timer, onChange }: { timer: NonNullable<MyWeek["timer"]>; onChange: () => void }) => {
  const toast = useToast();
  const [tick, setTick] = useState(Date.now());
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <section aria-label="Running timer" className="flex flex-wrap items-center gap-4 border bg-surface px-[18px] py-3.5" style={{ borderColor: "var(--cyan-line)" }}>
      <span className="h-2.5 w-2.5" style={{ background: "var(--mint)" }} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[14px]">{timer.label}</span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-text-3">{timer.sub}</span>
      </div>
      <span className="num ml-auto font-mono text-[26px]">{clock(tick - new Date(timer.startedAt).getTime())}</span>
      <button
        type="button"
        className="btn h-10 px-4 text-[11px] tracking-[0.22em]"
        style={{ background: "var(--coral)", borderColor: "var(--coral)", color: "var(--bg-deep)" }}
        onClick={async () => {
          try {
            await data.stopRunningTimer();
            timerChanged();
            toast("Time logged", "good");
            onChange();
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }}
      >
        STOP
      </button>
      <button type="button" className="btn-outline h-10 px-4 text-[11px] tracking-[0.22em]" onClick={() => setSwitching(true)}>
        SWITCH TASK
      </button>
      <StartTimerModal open={switching} onClose={() => setSwitching(false)} onStarted={onChange} />
    </section>
  );
};

/** /time (screen 24): my week. A global timer plus a weekly grid; submit the week for approval. */
const MyWeekPage = () => {
  const user = useUser();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [w, setW] = useState<MyWeek | null>(null);
  const [entries, setEntries] = useState<TimeEntryView[]>([]);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof data.pendingTimesheets>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  const week = params.get("week") ?? undefined;
  const userId = params.get("user") ?? undefined;

  const load = useCallback(async () => {
    try {
      const v = await data.myWeek({ week, userId });
      setW(v);
      setEntries(await data.listWeekEntries({ week: v.week, userId }));
      if (user.role === "admin") setPending(await data.pendingTimesheets());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [week, userId, user.role]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    window.addEventListener(TIMER_EVENT, load);
    return () => window.removeEventListener(TIMER_EVENT, load);
  }, [load]);

  const mine = !w || w.userId === user.id;
  usePageChrome({
    context: w ? `${mine ? "MY TIME" : `TIME · ${w.name.toUpperCase()}`} · ${user.role === "admin" ? "" : `${user.role.toUpperCase()} · `}WEEK ${Number(w.week.slice(6))}`.replace("·  ·", "·") : "Time tracking",
    action: user.role === "admin" || user.role === "implementer" ? { label: "Team reports", to: "/time/reports" } : undefined,
  });

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (error) return <EmptyState title={error} />;
  if (!w) return <SkeletonRows rows={8} />;
  const ts = w.timesheet;
  const capacity = w.capacityHours;
  const est = w.estimates;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="label-caps">{w.weekLabel}</span>
          <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">{mine ? "My time" : `${w.name}'s time`}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {w.people ? (
            <select className="input h-[34px] w-auto" aria-label="Person" value={w.userId} onChange={(e) => go({ user: e.target.value === user.id ? null : e.target.value })}>
              {w.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="btn-outline h-[34px] px-3" onClick={() => go({ week: shiftWeek(w.week, -1) })} aria-label="Previous week">
            ←
          </button>
          <button type="button" className="btn-outline h-[34px] px-3" onClick={() => go({ week: null })}>
            This week
          </button>
          <button type="button" className="btn-outline h-[34px] px-3" onClick={() => go({ week: shiftWeek(w.week, 1) })} aria-label="Next week">
            →
          </button>
        </div>
      </div>

      {mine ? (
        w.timer ? (
          <TimerCard timer={w.timer} onChange={load} />
        ) : (
          <section aria-label="Timer" className="flex items-center gap-4 border border-line bg-surface px-[18px] py-3.5">
            <span className="h-2.5 w-2.5 bg-line-strong" />
            <span className="text-[14px] text-text-2">No timer running.</span>
            <button type="button" className="btn-outline ml-auto h-10 px-4 text-[11px] tracking-[0.22em]" onClick={() => setStarting(true)}>
              START TIMER
            </button>
          </section>
        )
      ) : null}
      <StartTimerModal open={starting} onClose={() => setStarting(false)} onStarted={load} />

      {user.role === "admin" && pending.length ? (
        <section aria-label="Waiting for approval" className="flex flex-col border border-line">
          <div className="border-b border-line px-4 py-2.5">
            <span className="label-caps">Waiting for approval · {pending.length}</span>
          </div>
          {pending.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
              <span>{p.name}</span>
              <span className="font-mono text-text-2">{p.week}</span>
              <span className="font-mono">{p.hours.toFixed(1)} h</span>
              <button type="button" className="btn-ghost ml-auto h-8 text-[12px]" onClick={() => go({ user: p.userId === user.id ? null : p.userId, week: p.week })}>
                Open
              </button>
              {p.userId !== user.id ? (
                <button
                  type="button"
                  className="btn-outline h-8 text-[12px]"
                  onClick={() => act(async () => {
                    const r = await data.approveWeek(p.userId, p.week);
                    if (r.invoiceItems) toast(`${r.invoiceItems} Stripe invoice item${r.invoiceItems > 1 ? "s" : ""} added for billable time`, "good");
                  }, "Week approved")}
                >
                  Approve
                </button>
              ) : (
                <span className="text-[12px] text-text-3">Another admin approves</span>
              )}
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <section aria-label="Timesheet" className="overflow-x-auto border border-line bg-surface">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.7fr_repeat(7,50px)_60px] gap-1.5 border-b border-line px-3.5 py-3 text-[10px] tracking-[0.2em] text-label bg-surface-2">
              <span>TASK OR CLIENT</span>
              {w.days.map((d) => (
                <span key={d.date} className="text-center" title={d.date}>
                  {d.label.split(" ")[0]}
                  <span className="block text-text-3">{d.label.split(" ")[1]}</span>
                </span>
              ))}
              <span className="text-right">TOTAL</span>
            </div>
            {w.rows.length ? (
              w.rows.map((r) => (
                <div key={r.key} className="grid min-h-12 grid-cols-[1.7fr_repeat(7,50px)_60px] items-center gap-1.5 border-b border-line-soft px-3.5 py-1.5 text-[13px]">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate" title={r.sub}>
                      {r.link?.type === "task" ? <Link to={`/tasks/${r.link.id}`} className="text-text hover:text-cyan">{r.label}</Link> : r.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: catColor(r.category) }}>
                      {r.category}
                      {r.link && r.link.type !== "task" ? (r.billable ? " · BILLABLE" : " · NON-BILLABLE") : ""}
                    </span>
                  </div>
                  {r.cells.map((c, i) => (
                    <Cell
                      key={i}
                      label={`${r.label} · ${w.days[i].label}`}
                      value={c}
                      disabled={!w.canEdit}
                      onSave={(hours) =>
                        data.setTimeCell({ week: w.week, rowKey: r.key, day: i, hours, userId: mine ? undefined : w.userId }).then(load, (e: Error) => {
                          toast(e.message, "error");
                          throw e;
                        })
                      }
                    />
                  ))}
                  <span className="text-right font-mono">{h1(r.total)}</span>
                </div>
              ))
            ) : (
              <p className="m-0 px-3.5 py-6 text-[13px] text-text-3">No time this week yet. Start a timer or add a manual entry.</p>
            )}
            <div className="grid h-11 grid-cols-[1.7fr_repeat(7,50px)_60px] items-center gap-1.5 px-3.5 text-[13px]">
              <span className="text-[11px] tracking-[0.2em] text-label">DAY TOTAL</span>
              {w.dayTotals.map((d, i) => (
                <span key={i} className="text-center font-mono text-[12px] text-text-2">
                  {h1(d)}
                </span>
              ))}
              <span className="text-right font-mono" style={{ color: "var(--mint)" }}>
                {w.total.toFixed(1)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-3.5 py-2.5">
              <button type="button" disabled={!w.canEdit} className="h-8 border border-dashed border-line-strong px-3 text-[12px] text-text-2 hover:text-text disabled:opacity-50" onClick={() => setAdding(true)}>
                + Add row or manual entry
              </button>
              <button type="button" className="btn-ghost h-8 text-[12px]" onClick={() => setShowEntries((x) => !x)}>
                {showEntries ? "Hide entries" : `Entries · ${entries.length}`}
              </button>
            </div>
            {showEntries ? (
              <div className="border-t border-line">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 border-b border-line-soft px-3.5 py-2 text-[12px] last:border-b-0">
                    <span className="w-24 font-mono text-text-2">{e.date}</span>
                    <span className="min-w-0 flex-1 truncate">{e.label}</span>
                    <span className="text-text-3">{e.source === "timer" ? "Timer" : "Manual"}</span>
                    <span className="w-16 text-right font-mono">{(e.minutes / 60).toFixed(2)} h</span>
                    <button type="button" disabled={e.locked} className="btn-ghost h-7 text-[12px] disabled:opacity-40" onClick={() => act(() => data.deleteManualEntry(e.id), "Entry removed")}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="flex flex-col gap-3.5">
          <section aria-label="Week against capacity" className="flex flex-col gap-3 border border-line bg-surface px-[18px] py-4">
            <div className="flex items-baseline justify-between">
              <span className="label-caps">This week</span>
              <span className="num font-mono text-[24px]">
                {w.total.toFixed(1)} {capacity !== null ? <span className="text-[14px] text-text-3">/ {capacity} h</span> : null}
              </span>
            </div>
            {w.split.map((s) => (
              <div key={s.key} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-text-2">
                    {s.label} · target {s.target} h
                  </span>
                  <span className="font-mono">{s.hours.toFixed(1)}</span>
                </div>
                <div className="h-[3px] bg-line">
                  <div className="h-[3px]" style={{ width: `${s.target ? Math.min(100, Math.round((s.hours / s.target) * 100)) : 0}%`, background: catColor(s.label.split(" ")[0]) }} />
                </div>
              </div>
            ))}
            {!w.split.length ? <span className="text-[12px] text-text-3">No availability set yet (Tasks › Workload).</span> : null}
          </section>

          <section aria-label="Estimates" className="flex flex-col gap-2 border border-line px-[18px] py-4 text-[13px]">
            <span className="label-caps">Estimates vs actual</span>
            <div className="flex justify-between">
              <span className="text-text-2">Tasks finished</span>
              <span className="font-mono">{est.tasks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-2">Estimated</span>
              <span className="font-mono">{est.estimatedHours.toFixed(1)} h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-2">Actual</span>
              <span className="font-mono" style={{ color: est.ratio !== null && est.ratio > 1.1 ? "var(--amber)" : "var(--mint)" }}>
                {est.actualHours.toFixed(1)} h{est.ratio !== null ? ` · ${est.ratio}×` : ""}
              </span>
            </div>
            <span className="text-[12px] text-text-3">The AI planner uses this ratio for your future estimates.</span>
          </section>

          <div className="flex items-center justify-between text-[12px]">
            <span className="label-caps">Timesheet</span>
            <span className="uppercase tracking-[0.18em]" style={{ color: STATUS_TONE[ts.status] }}>
              {ts.status}
            </span>
          </div>
          {ts.comment && ts.status === "draft" ? <p className="m-0 border border-amber-line px-3 py-2 text-[12px] text-amber">Reopened: {ts.comment}</p> : null}
          {ts.status === "draft" && mine ? (
            <button type="button" className="btn-primary h-[46px] justify-between px-4 text-[11px] tracking-[0.22em]" onClick={() => act(() => data.submitWeek(w.week), "Week submitted for approval")}>
              <span>SUBMIT WEEK</span>
              <span aria-hidden>→</span>
            </button>
          ) : null}
          {ts.status !== "draft" ? (
            <span className="text-[12px] text-text-3">
              {ts.status === "submitted" ? "Submitted: the week is locked until an admin approves or reopens it." : "Approved and locked. Billable hours went to the client's next invoice."}
            </span>
          ) : null}
          {user.role === "admin" && ts.status === "submitted" && w.userId !== user.id ? (
            <button
              type="button"
              className="btn-outline h-10"
              onClick={() => act(async () => {
                const r = await data.approveWeek(w.userId, w.week);
                if (r.invoiceItems) toast(`${r.invoiceItems} Stripe invoice item${r.invoiceItems > 1 ? "s" : ""} added`, "good");
              }, "Week approved")}
            >
              Approve week
            </button>
          ) : null}
          {user.role === "admin" && ts.status !== "draft" ? (
            <button
              type="button"
              className="btn-ghost h-9 text-[12px]"
              onClick={() => {
                const comment = window.prompt("Why reopen this week? The person sees your comment.");
                if (comment?.trim()) act(() => data.reopenWeek(w.userId, w.week, comment), "Week reopened");
              }}
            >
              Reopen week
            </button>
          ) : null}
          <span className="text-[12px] text-text-3">You enter your own time. No activity, screen or idle tracking.</span>
        </aside>
      </div>
      <ManualEntryModal open={adding} onClose={() => setAdding(false)} week={w} userId={w.userId} onSaved={load} />
    </div>
  );
};

const STATUS_COLOR: Record<string, string> = { HEALTHY: "var(--mint)", OK: "var(--cyan)", SALES: "var(--text-3)", INTERNAL: "var(--text-3)" };
const money = (minor: number | null, c: "USD" | "EUR" | null) => (minor === null || !c ? "—" : `${minor < 0 ? "−" : ""}${c === "USD" ? "$" : "€"}${Math.round(Math.abs(minor) / 100).toLocaleString("en-US")}`);
const monthLabel = (m: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
const lastMonths = (n: number) => {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
};

/** /time/reports (screen 25): hours by client, person and category; profitability; weekend hours; estimate accuracy. */
const ReportsPage = () => {
  const toast = useToast();
  const months = useMemo(() => lastMonths(6), []);
  const [month, setMonth] = useState(months[1]);
  const [group, setGroup] = useState<ReportGroup>("client");
  const [r, setR] = useState<TimeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    data.timeReport({ month, group }).then(setR, (e: Error) => setError(e.message));
  }, [month, group]);
  usePageChrome({ context: `TIME REPORTS · ${monthLabel(month).toUpperCase()} · ${r?.money ? "ADMINS" : "HOURS ONLY"}` });

  const exportCsv = async () => {
    try {
      const csv = await data.exportTimeCsv({ month, group });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `atlas-time-${month}-${group}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (error) return <EmptyState title={error} />;
  if (!r) return <SkeletonRows rows={8} />;
  const KPI_TONE: Record<string, string> = { hours: "var(--text)", client: "var(--cyan)", billable: "var(--text-3)", estimates: "var(--amber)" };
  const maxWeek = Math.max(r.weekendTarget * 1.25, ...r.weekend.map((x) => x.hours));
  const cols = r.money && group === "client" ? "grid-cols-[1.6fr_100px_70px_110px_100px_90px]" : group === "person" && r.money ? "grid-cols-[1.6fr_100px_70px_110px]" : "grid-cols-[1.6fr_100px_70px_90px]";

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Link to="/time" className="label-caps hover:text-text">
            ← My time
          </Link>
          <h1 className="m-0 text-[36px] font-light tracking-[-0.02em]">Time reports</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-[13px]">
          {(
            [
              ["client", "By client and project"],
              ["person", "By person"],
              ["category", "By category"],
            ] as const
          ).map(([g, label]) => (
            <button key={g} type="button" className={`${group === g ? "btn-primary" : "btn-outline"} h-[34px] px-3`} aria-pressed={group === g} onClick={() => setGroup(g)}>
              {label}
            </button>
          ))}
          <select className="input h-[34px] w-auto" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button type="button" className="btn-outline h-[34px] px-3" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {r.kpis.map((k) => (
          <div key={k.key} className="flex flex-col gap-1.5 border border-line bg-surface p-4">
            <span className="text-[10px] tracking-[0.2em] text-label">{k.label}</span>
            <span className="num text-[28px] font-light" style={{ color: KPI_TONE[k.key] }}>
              {k.value}
            </span>
            <span className="text-[11px] text-text-3">{k.note}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-[18px] xl:grid-cols-[1fr_340px]">
        <section aria-label={group === "client" ? "Clients and projects" : group === "person" ? "People" : "Categories"} className="overflow-x-auto border border-line bg-surface">
          <div className={`grid ${cols} min-w-[600px] gap-2.5 border-b border-line px-4 py-3 text-[10px] tracking-[0.2em] text-label`}>
            <span>{group === "client" ? "CLIENT OR PROJECT" : group === "person" ? "PERSON" : "CATEGORY"}</span>
            <span>TYPE</span>
            <span>HOURS</span>
            {r.money && group === "client" ? (
              <>
                <span>REVENUE</span>
                <span>PER HOUR</span>
              </>
            ) : null}
            {r.money && group === "person" ? <span>COST</span> : group === "person" ? <span /> : null}
            {group === "client" ? <span>STATUS</span> : group === "category" ? <span>SHARE</span> : null}
          </div>
          {r.rows.map((x) => {
            const c = x.status ? STATUS_COLOR[x.status] : "var(--text-2)";
            return (
              <div key={x.key} className={`grid ${cols} min-h-[50px] min-w-[600px] items-center gap-2.5 border-b border-line-soft px-4 py-1.5 text-[13px] last:border-b-0`}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate" style={group === "category" ? { color: catColor(x.label) } : undefined}>
                    {x.label}
                  </span>
                  {x.sub ? <span className="truncate text-[11px] text-text-3">{x.sub}</span> : null}
                </div>
                <span className="text-[11px] capitalize text-text-2">{x.type}</span>
                <span className="font-mono">{x.hours.toFixed(1)}</span>
                {r.money && group === "client" ? (
                  <>
                    <span className="font-mono text-text-2">{money(x.revenueMinor, x.currency)}</span>
                    <span className="font-mono" style={{ color: c }}>
                      {money(x.perHourMinor, x.currency)}
                    </span>
                  </>
                ) : null}
                {group === "person" ? <span className="font-mono text-text-2">{r.money ? money(x.marginMinor === null ? null : -x.marginMinor, x.currency) : ""}</span> : null}
                {group === "client" ? (
                  <span className="text-[10px] tracking-[0.16em]" style={{ color: c }}>
                    {x.status}
                  </span>
                ) : group === "category" ? (
                  <span className="font-mono text-text-2">{r.totalHours ? Math.round((x.hours / r.totalHours) * 100) : 0}%</span>
                ) : null}
              </div>
            );
          })}
          {!r.rows.length ? <p className="m-0 px-4 py-6 text-[13px] text-text-3">No time logged in {monthLabel(month)}.</p> : null}
        </section>

        <div className="flex flex-col gap-3.5">
          <section aria-label="Hours by week" className="flex flex-col gap-3 border border-line bg-surface px-[18px] py-4">
            <span className="label-caps">Rinor · weekend hours vs {r.weekendTarget} h</span>
            <div className="relative flex h-[120px] items-end gap-3.5 border-b border-line">
              <div className="absolute left-0 right-0 border-t border-dashed" style={{ bottom: `${(r.weekendTarget / maxWeek) * 100}%`, borderColor: "var(--lavender)" }} />
              {r.weekend.map((x) => (
                <div key={x.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="font-mono text-[11px] text-text-2">{x.hours} h</span>
                  <div className="w-full" style={{ height: `${(x.hours / maxWeek) * 100}%`, background: x.hours > r.weekendTarget ? "var(--coral)" : "var(--lavender)" }} />
                </div>
              ))}
            </div>
            <div className="flex justify-around text-[11px] text-text-3">
              {r.weekend.map((x) => (
                <span key={x.week}>{x.label}</span>
              ))}
            </div>
            <span className="text-[12px] text-text-2">Feeds the profit-split rule for buying back Rinor's time.</span>
          </section>

          <section aria-label="Estimate accuracy" className="flex flex-col gap-2 border border-line px-[18px] py-4 text-[13px]">
            <span className="label-caps">Estimate accuracy · actual ÷ estimate</span>
            {r.accuracy.map((a) => (
              <div key={a.category} className="flex justify-between">
                <span className="text-text-2">{a.category}</span>
                <span className="font-mono" style={{ color: a.ratio !== null && a.ratio > 1.2 ? "var(--amber)" : "var(--mint)" }}>
                  {a.ratio !== null ? `${a.ratio.toFixed(1)}×` : "—"}
                </span>
              </div>
            ))}
            {!r.accuracy.length ? <span className="text-text-3">No finished, estimated tasks with time yet.</span> : null}
            <span className="text-[12px] text-text-3">The AI planner and the scheduler use each person's ratio as their buffer.</span>
          </section>
        </div>
      </div>
    </div>
  );
};

const RequireReports = () => {
  const user = useUser();
  if (user.role !== "admin" && user.role !== "implementer") return <EmptyState title="Time reports are for admins (and hours only for the implementer)." action={<Link to="/time" className="btn-outline h-9">My time</Link>} />;
  return <ReportsPage />;
};

const TimeModule = () => (
  <Routes>
    <Route index element={<MyWeekPage />} />
    <Route path="reports" element={<RequireReports />} />
  </Routes>
);

export default TimeModule;
