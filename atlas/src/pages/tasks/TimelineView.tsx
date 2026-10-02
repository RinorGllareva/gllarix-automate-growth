import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { data, type CapacityPlan, type TimelineBar } from "@/data";
import { fmtH } from "@/services/scheduler";
import { shiftDateKey } from "@/services/time";
import { useTasks } from "./shared";

const ZOOM = { day: { weeks: 2, px: 52 }, week: { weeks: 5, px: 20 }, month: { weeks: 12, px: 9 } } as const;
type Zoom = keyof typeof ZOOM;
const ROW = 36;
const LABEL = 220;
const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const tokenVar = (c: string) => `var(--${c})`;

export const capTone = (used: number, cap: number) => (cap <= 0 ? (used > 0 ? "over" : "none") : used > cap + 0.05 ? "over" : used >= cap * 0.9 ? "full" : "ok");

/** Timeline (18_TIMELINE.md): bars from start to due, dependency lines, milestones and capacity per person per week. */
const TimelineView = ({ listId, spaceId, title }: { listId?: string; spaceId?: string; title: string }) => {
  const { refresh, openTask } = useTasks();
  const toast = useToast();
  const navigate = useNavigate();
  const [zoom, setZoom] = useState<Zoom>("week");
  const [plan, setPlan] = useState<CapacityPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoDeps, setAutoDeps] = useState(false);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "start" | "end"; x0: number; delta: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => data.capacityPlan({ listId, spaceId, weeks: ZOOM[zoom].weeks }).then(setPlan, (e: Error) => setError(e.message)), [listId, spaceId, zoom]);
  useEffect(() => {
    load();
  }, [load]);

  const px = ZOOM[zoom].px;
  const from = plan?.weeks[0]?.start ?? "";
  const days = (plan?.weeks.length ?? 0) * 7;
  const width = days * px;
  const bars = plan?.bars ?? [];
  const index = useMemo(() => new Map(bars.map((b, i) => [b.taskId, i])), [bars]);

  if (error) return <EmptyState title={error} />;
  if (!plan) return <SkeletonRows rows={8} />;

  const geometry = (b: TimelineBar) => {
    const d = drag?.id === b.taskId ? Math.round(drag.delta / px) : 0;
    const s = shiftDateKey(b.start, drag?.id === b.taskId && drag.mode !== "end" ? d : 0);
    const e = shiftDateKey(b.end, drag?.id === b.taskId && drag.mode !== "start" ? d : 0);
    const left = Math.max(0, daysBetween(from, s)) * px;
    const right = Math.min(days, daysBetween(from, e) + 1) * px;
    return { left, width: Math.max(px - 2, right - left - 2), s, e };
  };

  /** Save new dates; warn when it breaks a dependency, and shift dependents if asked. */
  const commit = async (b: TimelineBar, startAt: string | null, dueAt: string) => {
    const waits = b.waitingOn.map((id) => bars.find((x) => x.taskId === id)).filter(Boolean) as TimelineBar[];
    const late = waits.find((w) => (startAt ?? dueAt) < w.end);
    if (late && !window.confirm(`"${b.title}" would start before "${late.title}" finishes (${late.end}). Keep the new dates?`)) return;
    try {
      await data.updateTask(b.taskId, { startAt, dueAt });
      const delta = daysBetween(b.end, dueAt);
      const dependents = bars.filter((x) => x.waitingOn.includes(b.taskId) && x.start <= dueAt);
      if (dependents.length && delta > 0) {
        if (autoDeps && window.confirm(`Shift ${dependents.length} dependent task${dependents.length > 1 ? "s" : ""} by ${delta} day${delta > 1 ? "s" : ""}?`)) {
          for (const x of dependents) await data.updateTask(x.taskId, { startAt: x.start !== x.end ? shiftDateKey(x.start, delta) : null, dueAt: shiftDateKey(x.end, delta) });
        } else toast(`${dependents.length} dependent task${dependents.length > 1 ? "s" : ""} now start before this finishes.`, "error");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    }
    load();
    refresh();
  };

  const onPointerDown = (e: PointerEvent, b: TimelineBar) => {
    if (b.milestone) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mode = e.clientX - rect.left < 6 ? "start" : rect.right - e.clientX < 6 ? "end" : "move";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: b.taskId, mode, x0: e.clientX, delta: 0 });
  };
  const onPointerMove = (e: PointerEvent) => drag && setDrag({ ...drag, delta: e.clientX - drag.x0 });
  const onPointerUp = (b: TimelineBar) => {
    if (!drag) return;
    const d = Math.round(drag.delta / px);
    const mode = drag.mode;
    setDrag(null);
    if (!d) return openTask(b.taskId);
    const s = mode === "end" ? b.start : shiftDateKey(b.start, d);
    const en = mode === "start" ? b.end : shiftDateKey(b.end, d);
    if (s > en) return toast("The start can't be after the due date.", "error");
    commit(b, s === en && mode === "move" && b.start === b.end ? null : s, en);
  };
  const onBarKey = (e: KeyboardEvent, b: TimelineBar) => {
    if (e.key === "Enter") return openTask(b.taskId);
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const d = e.key === "ArrowRight" ? 1 : -1;
    // Arrows move the bar; Shift + arrows change only the due date.
    if (e.shiftKey) commit(b, b.start !== b.end ? b.start : null, shiftDateKey(b.end, d));
    else commit(b, b.start !== b.end ? shiftDateKey(b.start, d) : null, shiftDateKey(b.end, d));
  };
  const onDropTray = (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task");
    if (!id || !gridRef.current) return;
    const x = e.clientX - gridRef.current.getBoundingClientRect().left + gridRef.current.scrollLeft - LABEL;
    const date = shiftDateKey(from, Math.max(0, Math.min(days - 1, Math.floor(x / px))));
    data.updateTask(id, { dueAt: date }).then(() => (load(), refresh()));
  };

  const weekLabelEvery = zoom === "month" ? 2 : 1;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <label className="flex items-center gap-2 text-text-2">
            <input type="checkbox" checked={autoDeps} onChange={(e) => setAutoDeps(e.target.checked)} className="accent-[var(--cyan)]" />
            Auto-schedule dependents
          </label>
          {(Object.keys(ZOOM) as Zoom[]).map((z) => (
            <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)} className={`h-8 border px-3 capitalize ${zoom === z ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-2"}`}>
              {z}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div ref={gridRef} className="min-w-0 overflow-x-auto" onDragOver={(e) => e.preventDefault()} onDrop={onDropTray}>
          <div style={{ width: LABEL + width }}>
            <div className="flex border-b border-line pb-2 text-[10px] tracking-[0.2em] text-text-3" style={{ paddingLeft: LABEL }}>
              {zoom === "day"
                ? Array.from({ length: days }, (_, i) => (
                    <span key={i} style={{ width: px }} className={`shrink-0 ${new Date(`${shiftDateKey(from, i)}T00:00:00Z`).getUTCDay() % 6 === 0 ? "text-text-2" : ""}`}>
                      {new Intl.DateTimeFormat("en-GB", { weekday: "narrow", day: "numeric", timeZone: "UTC" }).format(new Date(`${shiftDateKey(from, i)}T00:00:00Z`))}
                    </span>
                  ))
                : plan.weeks.map((w, i) => (
                    <span key={w.key} style={{ width: 7 * px }} className="shrink-0 truncate">
                      {i % weekLabelEvery === 0 ? w.label : ""}
                    </span>
                  ))}
            </div>

            <div className="relative" style={{ height: bars.length * ROW }}>
              {/* Week grid and today line. */}
              {plan.weeks.map((w, i) => (
                <span key={w.key} className="absolute bottom-0 top-0 border-l border-line-soft" style={{ left: LABEL + i * 7 * px }} />
              ))}
              {plan.today >= from ? <span className="absolute bottom-0 top-0 w-px bg-cyan opacity-60" style={{ left: LABEL + daysBetween(from, plan.today) * px + px / 2 }} title="Today" /> : null}
              {/* Dependency lines: from the end of what it waits on to its start. */}
              <svg className="pointer-events-none absolute left-0 top-0" width={LABEL + width} height={bars.length * ROW} aria-hidden="true">
                {bars.flatMap((b, i) =>
                  b.waitingOn
                    .filter((id) => index.has(id))
                    .map((id) => {
                      const j = index.get(id)!;
                      const from_ = geometry(bars[j]);
                      const to = geometry(b);
                      const x1 = LABEL + from_.left + from_.width;
                      const y1 = j * ROW + ROW / 2;
                      const x2 = LABEL + to.left;
                      const y2 = i * ROW + ROW / 2;
                      const broken = b.start < bars[j].end;
                      const mid = Math.max(x1 + 6, Math.min(x2 - 6, (x1 + x2) / 2));
                      return <path key={`${id}-${b.taskId}`} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" stroke={broken ? "var(--coral)" : "var(--text-3)"} strokeWidth={1} strokeDasharray={broken ? "3 2" : undefined} />;
                    }),
                )}
              </svg>
              {bars.map((b, i) => {
                const g = geometry(b);
                return (
                  <div key={b.taskId} className="absolute left-0 flex items-center border-b border-line-soft" style={{ top: i * ROW, height: ROW, width: LABEL + width }}>
                    <button type="button" onClick={() => openTask(b.taskId)} className={`truncate pr-3 text-left text-[12px] ${b.milestone ? "text-text" : "text-text-2 hover:text-text"}`} style={{ width: LABEL }} title={b.title}>
                      {b.milestone ? `Milestone · ${b.title}` : b.title}
                    </button>
                    {b.milestone ? (
                      <span className="absolute flex items-center gap-2.5" style={{ left: LABEL + g.left + g.width - 7, top: 11 }}>
                        <span className="block h-3.5 w-3.5 rotate-45 bg-ice" />
                        <span className="font-mono text-[11px] text-ice">{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${b.end}T00:00:00Z`)).toUpperCase()}</span>
                      </span>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`${b.title}: ${b.start} to ${b.end}. Arrows move it, Shift + arrows change the due date.`}
                        title={`${b.title} · ${b.start} → ${b.end}${b.finish && b.finish > b.end ? ` · scheduler finish ${b.finish}` : ""}`}
                        onPointerDown={(e) => onPointerDown(e, b)}
                        onPointerMove={onPointerMove}
                        onPointerUp={() => onPointerUp(b)}
                        onKeyDown={(e) => onBarKey(e, b)}
                        className={`absolute h-4 cursor-grab touch-none border focus-visible:outline-1 ${b.status === "done" ? "opacity-50" : ""}`}
                        style={{ left: LABEL + g.left, width: g.width, top: 10, borderColor: tokenVar(b.color), background: `color-mix(in srgb, ${tokenVar(b.color)} 20%, transparent)` }}
                      >
                        <span className="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize" />
                        <span className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize" />
                        {b.finish && b.finish > b.end ? <span className="absolute -right-2 -top-1 text-[10px] text-coral" aria-label="Late">!</span> : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!bars.length ? <p className="m-0 py-6 text-[13px] text-text-2">No dated tasks in these weeks. Give tasks a due date, or drag one in from the tray.</p> : null}

            <span className="mt-4 block text-[10px] tracking-[0.22em] text-label">CAPACITY USED · HOURS PER WEEK</span>
            {plan.people
              .filter((p) => p.kind === "person")
              .map((p) => (
                <div key={p.id} className="flex items-center" style={{ height: 34 }}>
                  <span className="flex items-center gap-2 truncate text-[12px]" style={{ width: LABEL }}>
                    <span className="h-2 w-2 shrink-0" style={{ background: tokenVar(p.color) }} />
                    {p.name.split(" ")[0]} · {p.capLine.split(" · ").pop()}
                  </span>
                  {plan.weeks.map((w) => {
                    const c = plan.cells.find((x) => x.personId === p.id && x.week === w.key);
                    const tone = c ? capTone(c.used, c.cap) : "none";
                    return (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() => navigate(`/tasks/workload?week=${w.key}`)}
                        title={tone === "over" ? "Over capacity: open suggestions" : "Open the workload"}
                        className={`mr-1 flex h-[26px] shrink-0 items-center justify-center font-mono text-[11px] ${tone === "over" ? "text-coral" : tone === "full" ? "text-amber" : "bg-surface-2 text-text-2"}`}
                        style={{ width: 7 * px - 4, ...(tone === "over" || tone === "full" ? { background: `color-mix(in srgb, var(--${tone === "over" ? "coral" : "amber"}) 15%, transparent)` } : {}) }}
                      >
                        {c ? `${fmtH(c.used)} / ${fmtH(c.cap)}` : "—"}
                      </button>
                    );
                  })}
                </div>
              ))}
            <div className="flex flex-wrap gap-[18px] pt-2 text-[11px] text-text-2">
              {plan.people.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border" style={{ borderColor: tokenVar(p.color) }} />
                  {p.name.split(" ")[0]}
                  {p.kind === "agent" ? " agent" : ""}
                </span>
              ))}
            </div>
          </div>
        </div>

        <aside aria-label="Unscheduled tasks" className="flex flex-col gap-2 border border-line p-3">
          <span className="label-caps">Unscheduled · {plan.unscheduled.length}</span>
          <span className="text-[11px] text-text-3">Drag onto the timeline to set the due date.</span>
          {plan.unscheduled.map((u) => (
            <div key={u.taskId} draggable onDragStart={(e) => e.dataTransfer.setData("text/task", u.taskId)} className="flex cursor-grab flex-col gap-0.5 border border-line bg-bg-deep px-2.5 py-2 text-[12px]">
              <button type="button" className="truncate text-left hover:text-cyan" onClick={() => openTask(u.taskId)}>
                {u.title}
              </button>
              <span className="text-[11px] text-text-3">
                {u.ownerName?.split(" ")[0] ?? "No owner"}
                {u.estimateHours ? ` · ${fmtH(u.estimateHours)} h` : ""}
              </span>
            </div>
          ))}
          {!plan.unscheduled.length ? <span className="text-[12px] text-text-3">Everything has dates.</span> : null}
        </aside>
      </div>
      <p className="m-0 text-[11px] text-text-3">Drag a bar to move it or its edges to change start or due; focus a bar and use the arrows (Shift for the due date only).</p>
    </div>
  );
};

export default TimelineView;
