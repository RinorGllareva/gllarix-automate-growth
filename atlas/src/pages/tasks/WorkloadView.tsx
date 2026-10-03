import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { WEEKDAYS, type Weekday } from "@/config/capacity";
import { data, type Availability, type CapacityPlan, type PlanView } from "@/data";
import { fmtH } from "@/services/scheduler";
import { capTone } from "./TimelineView";
import { useTasks } from "./shared";

const DAY_NAME: Record<Weekday, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const ACTION: Record<string, string> = { move: "Move", reassign: "Reassign", schedule: "Schedule", split: "Split", flag: "Set due date" };

/** Availability editor: windows per weekday (own timezone), split (sums to 100%), planned categories, time off; focus factor for admins. */
const AvailabilityEditor = ({ plan, userId, onClose, onSaved }: { plan: CapacityPlan; userId: string; onClose: () => void; onSaved: () => void }) => {
  const me = useUser();
  const toast = useToast();
  const a = plan.availability.find((x) => x.userId === userId)!;
  const [windows, setWindows] = useState<Record<Weekday, string>>(() => Object.fromEntries(WEEKDAYS.map((d) => [d, a.windows[d] ?? ""])) as Record<Weekday, string>);
  const [tz, setTz] = useState(a.timezone);
  const [split, setSplit] = useState<[string, string][]>(() => Object.entries(a.split).map(([k, v]) => [k, String(Math.round(v * 100))]));
  const [planned, setPlanned] = useState<string[]>(a.planned);
  const [off, setOff] = useState({ from: "", to: "", reason: "" });
  const [focus, setFocus] = useState(String(plan.settings.focusFactor));
  const [buffer, setBuffer] = useState(String(Math.round(plan.settings.buffer * 100)));
  const sum = split.reduce((n, [, v]) => n + (Number(v) || 0), 0);

  const save = async () => {
    try {
      await data.updateAvailability(userId, {
        windows: Object.fromEntries(Object.entries(windows).map(([d, w]) => [d, w.trim() || undefined])) as Availability["windows"],
        timezone: tz.trim(),
        split: Object.fromEntries(split.filter(([k]) => k.trim()).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, "_"), (Number(v) || 0) / 100])),
        planned,
      });
      if (me.role === "admin") await data.setCapacitySettings({ focusFactor: Number(focus), buffer: Number(buffer) / 100 });
      toast("Hours saved · plan recalculated", "good");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal open onClose={onClose} title={`Hours and time off · ${plan.people.find((p) => p.id === userId)?.name ?? ""}`} width={640}>
      <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
        <section className="flex flex-col gap-2">
          <span className="label-caps">Working windows · local time</span>
          <label className="flex items-center gap-3 text-[13px]">
            <span className="w-24 text-text-3">Timezone</span>
            <input className="input h-8 flex-1" value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Europe/Belgrade" />
          </label>
          {WEEKDAYS.map((d) => (
            <label key={d} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 text-text-3">{DAY_NAME[d]}</span>
              <input className="input h-8 flex-1 font-mono" placeholder="Off · or 09:00-15:00" value={windows[d]} onChange={(e) => setWindows({ ...windows, [d]: e.target.value })} />
            </label>
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <span className="label-caps">
            Category split · <span className={Math.abs(sum - 100) < 0.5 ? "text-mint" : "text-coral"}>{sum}%</span>
          </span>
          {split.map(([k, v], i) => (
            <div key={i} className="flex items-center gap-3 text-[13px]">
              <input className="input h-8 flex-1" value={k} onChange={(e) => setSplit(split.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} aria-label="Category" />
              <input className="input h-8 w-20 text-right font-mono" inputMode="numeric" value={v} onChange={(e) => setSplit(split.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} aria-label={`${k} percent`} />
              <span className="text-text-3">%</span>
              <label className="flex items-center gap-1.5 text-[12px] text-text-2" title="Counts as task time">
                <input type="checkbox" checked={!planned.length || planned.includes(k)} onChange={(e) => setPlanned(e.target.checked ? [...new Set([...(planned.length ? planned : split.map((x) => x[0])), k])] : (planned.length ? planned : split.map((x) => x[0])).filter((x) => x !== k))} className="accent-[var(--cyan)]" />
                task time
              </label>
              <button type="button" aria-label={`Remove ${k}`} className="text-text-3 hover:text-coral" onClick={() => setSplit(split.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="self-start text-[12px] text-cyan" onClick={() => setSplit([...split, ["", "0"]])}>
            + Category
          </button>
        </section>
        <section className="flex flex-col gap-2">
          <span className="label-caps">Time off</span>
          {plan.timeOff
            .filter((o) => o.userId === userId)
            .map((o) => (
              <div key={o.id} className="flex items-center justify-between text-[13px]">
                <span>
                  <span className="font-mono">{o.from}</span> → <span className="font-mono">{o.to}</span> · {o.reason}
                </span>
                <button type="button" className="text-[12px] text-coral" onClick={async () => (await data.removeTimeOff(o.id), onSaved())}>
                  Remove
                </button>
              </div>
            ))}
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" aria-label="From" className="input h-8 w-36" value={off.from} onChange={(e) => setOff({ ...off, from: e.target.value })} />
            <input type="date" aria-label="To" className="input h-8 w-36" value={off.to} onChange={(e) => setOff({ ...off, to: e.target.value })} />
            <input aria-label="Reason" className="input h-8 min-w-0 flex-1" placeholder="Reason" value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value })} />
            <button
              type="button"
              className="btn-outline h-8 text-[11px]"
              onClick={async () => {
                try {
                  await data.addTimeOff(userId, off);
                  setOff({ from: "", to: "", reason: "" });
                  onSaved();
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }}
            >
              Add
            </button>
          </div>
        </section>
        {me.role === "admin" ? (
          <section className="flex flex-wrap items-center gap-4 text-[13px]">
            <span className="label-caps">Team settings</span>
            <label className="flex items-center gap-2">
              Focus factor
              <input className="input h-8 w-16 font-mono" value={focus} onChange={(e) => setFocus(e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              Default buffer
              <input className="input h-8 w-16 font-mono" value={buffer} onChange={(e) => setBuffer(e.target.value)} />%
            </label>
          </section>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" onClick={save}>
            Save hours
          </button>
        </div>
      </div>
    </Modal>
  );
};

/** Workload (19_WORKLOAD.md): people × 5 weeks, suggestions with one-click fixes, availability. */
const WorkloadView = () => {
  const { refresh, openTask } = useTasks();
  const me = useUser();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [plan, setPlan] = useState<CapacityPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cell, setCell] = useState<{ personId: string; week: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [replan, setReplan] = useState<PlanView | null>(null);
  const load = useCallback(() => data.capacityPlan({ weeks: 5 }).then(setPlan, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!plan) return <SkeletonRows rows={6} />;
  const weekParam = params.get("week");
  // Open on the first week with my own suggestions, else the first with any.
  const weekWithSuggestions =
    plan.weeks.find((w) => plan.suggestions.some((s) => s.week === w.key && s.personId === me.id && s.type !== "flag"))?.key ??
    plan.weeks.find((w) => plan.suggestions.some((s) => s.week === w.key))?.key;
  const week = weekParam && plan.weeks.some((w) => w.key === weekParam) ? weekParam : (weekWithSuggestions ?? plan.weeks[0].key);
  const suggestions = plan.suggestions.filter((s) => s.week === week);
  const selected = cell ? plan.cells.find((c) => c.personId === cell.personId && c.week === cell.week) : null;

  const apply = async (id: string) => {
    try {
      await data.applySuggestion(id);
      toast("Applied · plan recalculated", "good");
    } catch (e) {
      toast((e as Error).message, "error");
    }
    load();
    refresh();
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="page-title m-0">Workload</h1>
        <section aria-label="Workload grid" className="min-w-0 overflow-x-auto border border-line rounded-lg bg-surface">
          <div className="grid min-w-[640px] grid-cols-[150px_repeat(5,minmax(0,1fr))] gap-1.5 border-b border-line px-3.5 py-3 text-[10px] tracking-[0.2em] text-text-3 bg-surface-2">
            <span>PERSON</span>
            {plan.weeks.map((w) => (
              <button key={w.key} type="button" className={`text-left ${w.key === week ? "text-cyan" : "hover:text-text"}`} onClick={() => setParams({ week: w.key })}>
                {w.label.split(" · ")[0]}
              </button>
            ))}
          </div>
          {plan.people.map((p) => (
            <div key={p.id} className="grid min-w-[640px] grid-cols-[150px_repeat(5,minmax(0,1fr))] items-center gap-1.5 border-b border-line-soft px-3.5 py-2.5 last:border-b-0">
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px]">{p.name.split(" ")[0]}</span>
                <span className="text-[11px] text-text-3">{p.capLine}</span>
              </span>
              {plan.weeks.map((w) => {
                if (p.kind === "agent") {
                  const a = plan.agent.find((x) => x.week === w.key);
                  return (
                    <div key={w.key} className="flex h-14 flex-col justify-between border border-line bg-bg-deep p-2">
                      <span className="font-mono text-[12px] text-mint">
                        {a?.prs ?? 0} PR · {fmtH(a?.reviewHours ?? 0)} h rev
                      </span>
                      <span className="h-[3px] bg-mint" />
                    </div>
                  );
                }
                const c = plan.cells.find((x) => x.personId === p.id && x.week === w.key);
                if (!c) return <span key={w.key} />;
                const tone = capTone(c.used, c.cap);
                const color = tone === "over" ? "var(--coral)" : tone === "full" ? "var(--amber)" : "var(--mint)";
                const isSel = cell?.personId === p.id && cell.week === w.key;
                return (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => setCell(isSel ? null : { personId: p.id, week: w.key })}
                    aria-pressed={isSel}
                    aria-label={`${p.name} ${w.label}: ${fmtH(c.used)} of ${fmtH(c.cap)} hours`}
                    className={`flex h-14 flex-col justify-between border bg-bg-deep p-2 text-left ${isSel ? "border-ice" : tone === "over" ? "border-coral" : "border-line"}`}
                  >
                    <span className="font-mono text-[13px]" style={{ color }}>
                      {fmtH(c.used)} / {fmtH(c.cap)} h
                    </span>
                    <span className="h-[3px] bg-line">
                      <span className="block h-[3px]" style={{ width: `${c.cap ? Math.min(100, (c.used / c.cap) * 100) : c.used ? 100 : 0}%`, background: color }} />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </section>

        {selected ? (
          <section aria-label="Tasks in this cell" className="card flex flex-col">
            <span className="label-caps border-b border-line px-4 py-3">
              {plan.people.find((p) => p.id === selected.personId)?.name} · {plan.weeks.find((w) => w.key === selected.week)?.label} · {fmtH(selected.used)} / {fmtH(selected.cap)} h
            </span>
            {selected.tasks.map((t) => (
              <button key={t.taskId} type="button" onClick={() => openTask(t.taskId)} className="flex justify-between gap-3 border-b border-line-soft px-4 py-2 text-left text-[13px] last:border-b-0 hover:bg-surface-2">
                <span className="truncate">
                  {t.title}
                  {t.kind === "review" ? <span className="text-text-3"> · review</span> : null}
                </span>
                <span className="font-mono text-text-2">{fmtH(t.hours)} h</span>
              </button>
            ))}
            {!selected.tasks.length ? <span className="px-4 py-3 text-[13px] text-text-3">Nothing scheduled.</span> : null}
          </section>
        ) : null}

        <section aria-label="Suggestions" className="flex flex-col gap-3 border border-cyan-line px-[18px] py-4">
          <span className="label-caps text-cyan">Suggestions · week {Number(week.slice(6))}</span>
          {suggestions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3.5 text-[13px]">
              <span className="min-w-0 flex-1 text-text-2">{s.text}</span>
              {s.apply ? (
                <button type="button" className="btn-outline h-8 text-[11px]" onClick={() => apply(s.id)}>
                  {ACTION[s.type]}
                </button>
              ) : null}
              <button type="button" aria-label="Dismiss" title="Dismiss for this week" className="text-text-3 hover:text-text" onClick={async () => (await data.dismissSuggestion(s.id), load())}>
                ×
              </button>
            </div>
          ))}
          {!suggestions.length ? <span className="text-[13px] text-text-3">Nothing to fix this week. The scheduler checks capacity, deadlines and dependencies after every change.</span> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <span className="text-[11px] text-text-3">From the scheduler. The AI re-plan proposes the smallest set of changes; nothing changes until you click.</span>
            <button
              type="button"
              className="btn-outline h-8 text-[11px]"
              onClick={async () => {
                try {
                  setReplan(await data.replan());
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }}
            >
              RE-PLAN WITH AI
            </button>
          </div>
          {replan?.changes.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3.5 text-[13px]">
              <span className="min-w-0 flex-1 text-text-2">
                <span className="text-cyan">{c.action.replace("_", " ")}</span> "{c.title ?? c.task_id}"{c.value ? ` → ${c.value}${c.action === "move" ? " days" : ""}` : ""}: {c.reason}
              </span>
              <button
                type="button"
                className="btn-outline h-8 text-[11px]"
                disabled={c.applied}
                onClick={async () => {
                  try {
                    await data.applyPlanChange(replan.id, i);
                    setReplan(await data.getPlan(replan.id));
                    load();
                    refresh();
                  } catch (e) {
                    toast((e as Error).message, "error");
                  }
                }}
              >
                {c.applied ? "APPLIED" : "APPLY"}
              </button>
            </div>
          ))}
        </section>
      </div>

      <aside aria-label="Availability" className="flex flex-col gap-3.5 self-start border border-line px-[18px] py-4">
        <span className="label-caps">Availability</span>
        {plan.people.map((p) => (
          <div key={p.id} className="flex flex-col gap-1.5 border-b border-line-soft pb-3">
            <div className="flex justify-between text-[13px]">
              <span>{p.name.split(" ")[0]}</span>
              <span className="font-mono" style={{ color: `var(--${p.color})` }}>
                {p.hoursPerWeek === null ? "no limit" : `${fmtH(p.hoursPerWeek)} h / wk`}
              </span>
            </div>
            <span className="text-[12px] text-text-2">{p.windowsText}</span>
            <span className="text-[11px] text-text-3">{p.splitText}</span>
            {p.accuracy !== null ? <span className="text-[11px] text-text-3">Estimate accuracy {p.accuracy}× (used instead of the default buffer)</span> : null}
            {p.editable ? (
              <button type="button" className="self-start text-[11px] text-cyan" onClick={() => setEditing(p.id)}>
                Edit hours and time off
              </button>
            ) : null}
          </div>
        ))}
        {plan.people.some((p) => p.id === me.id) ? (
          <button type="button" className="btn-outline h-10 text-[11px]" onClick={() => setEditing(me.id)}>
            Edit hours and time off
          </button>
        ) : null}
      </aside>

      {editing ? (
        <AvailabilityEditor
          plan={plan}
          userId={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load();
            refresh();
          }}
        />
      ) : null}
    </div>
  );
};

export default WorkloadView;
