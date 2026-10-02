import { useCallback, useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import { useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, Icon, ICONS, SkeletonRows } from "@/components/ui/primitives";
import { hueTint, hueVar, TASK_STATUS_HUE } from "@/config/colors";
import { BOARD_STATUSES, PRIORITY_META, STATUS_META, WIP_PER_PERSON } from "@/config/tasks";
import { data, type TaskRow, type TaskStatus } from "@/data";
import { hours, positionBetween } from "@/services/tasks";
import { Flag, isOverdue, shortDue, StatusPill, taskEmoji, todayKey, useTasks } from "./shared";

const weekStart = () => {
  const d = new Date(`${todayKey()}T00:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
};

/** Board view (16_TASKS_BOARD.md): drag between columns changes status; within a column reorders. */
const BoardView = ({ listId, spaceId, title }: { listId?: string; spaceId?: string; title: string }) => {
  const { refresh, openTask } = useTasks();
  const toast = useToast();
  const [rows, setRows] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ status: TaskStatus; beforeId: string | null } | null>(null);
  const [showOlderDone, setShowOlderDone] = useState(false);
  const [adding, setAdding] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [addAtTop, setAddAtTop] = useState(true);
  const [menu, setMenu] = useState<TaskStatus | null>(null);
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set());
  const toggleFold = (s: TaskStatus) => setCollapsed((c) => (c.has(s) ? new Set([...c].filter((x) => x !== s)) : new Set([...c, s])));

  const load = useCallback(() => data.listTasks({ listId, spaceId }).then(setRows, (e: Error) => setError(e.message)), [listId, spaceId]);
  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!rows) return <SkeletonRows rows={6} />;

  const used = rows.some((r) => r.task.status === "blocked");
  const statuses: TaskStatus[] = used ? [...BOARD_STATUSES.slice(0, 3), "blocked", "done"] : BOARD_STATUSES;
  const ws = weekStart();
  const colRows = (s: TaskStatus) =>
    rows
      .filter((r) => r.task.status === s)
      .filter((r) => s !== "done" || showOlderDone || (r.task.completedAt ?? r.task.updatedAt).slice(0, 10) >= ws)
      .sort((a, b) => a.task.position - b.task.position);

  const move = async (id: string, status: TaskStatus, beforeId: string | null) => {
    const row = rows.find((r) => r.task.id === id)!;
    const target = colRows(status).filter((r) => r.task.id !== id);
    const idx = beforeId ? target.findIndex((r) => r.task.id === beforeId) : target.length;
    const position = positionBetween(target[idx - 1]?.task.position ?? null, target[idx]?.task.position ?? null);
    const prevStatus = row.task.status;
    setRows((rs) => rs && rs.map((r) => (r.task.id === id ? { ...r, task: { ...r.task, status, position } } : r)));
    try {
      await data.updateTask(id, { status, position });
    } catch (e) {
      const msg = (e as Error).message;
      if (/open subtask/.test(msg) && window.confirm(msg)) await data.updateTask(id, { status, position, completeSubtasks: true });
      else toast(msg, "error");
    }
    // Moving to Done asks for time if none was logged (optional).
    if (status === "done" && prevStatus !== "done" && row.spentMinutes === 0) {
      const h = window.prompt(`Log time for "${row.task.title}"? Hours (leave empty to skip)`, row.task.estimateMinutes ? String(row.task.estimateMinutes / 60) : "");
      if (h && Number(h) > 0) await data.addTimeEntry(id, { minutes: Math.round(Number(h) * 60), date: todayKey() });
    }
    load();
    refresh();
  };

  const onDrop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task") || drag;
    if (id) move(id, status, over?.status === status ? over.beforeId : null);
    setDrag(null);
    setOver(null);
  };

  const onCardKey = (e: KeyboardEvent, r: TaskRow) => {
    if (e.key === "Enter") return openTask(r.task.id);
    if (!e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const i = statuses.indexOf(r.task.status);
    const next = statuses[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) move(r.task.id, next, null).then(() => window.setTimeout(() => document.querySelector<HTMLElement>(`[data-card="${r.task.id}"]`)?.focus(), 50));
  };

  const addForm = (s: TaskStatus) => (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const target = listId ?? rows[0]?.task.listId;
        if (!newTitle.trim() || !target) return;
        await data.createTask({ listId: target, title: newTitle, status: s });
        setNewTitle("");
        load();
        refresh();
      }}
    >
      <input autoFocus aria-label={`New task in ${STATUS_META[s].label}`} className="input h-9 w-full rounded-lg" placeholder="Title, then Enter" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onBlur={() => !newTitle && setAdding(null)} onKeyDown={(e) => e.key === "Escape" && setAdding(null)} />
    </form>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h1 className="sr-only">{title}</h1>
      {/* The board fills the window; each column scrolls on its own (Notion-style board). */}
      <div className="flex h-[calc(100vh-258px)] min-h-[420px] min-w-0 gap-3 overflow-x-auto pb-1">
        {statuses.map((s) => {
          const list = colRows(s);
          const meta = STATUS_META[s];
          const people = new Set(list.flatMap((r) => r.task.assigneeIds)).size || 1;
          const wip = s === "in_progress" && list.length > WIP_PER_PERSON * people;
          const est = list.reduce((n, r) => n + (r.task.estimateMinutes ?? 0), 0);
          const hue = TASK_STATUS_HUE[s];
          const folded = collapsed.has(s);
          const label = s === "done" ? (showOlderDone ? "Done" : "Done · this week") : meta.label;
          if (folded)
            return (
              <button
                key={s}
                type="button"
                aria-label={`Expand ${meta.label}`}
                className="flex h-full w-11 shrink-0 flex-col items-center gap-3 rounded-xl py-3 text-[12px] font-medium"
                style={{ background: hueTint(hue, 9) }}
                onClick={() => toggleFold(s)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, s)}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: hueVar(hue) }} />
                <span className="font-mono text-[11px] text-text-3">{list.length}</span>
                <span className="text-text-2 [writing-mode:vertical-rl]">{meta.label}</span>
              </button>
            );
          return (
            <section
              key={s}
              aria-label={meta.label}
              className="flex h-full w-[272px] min-w-[240px] shrink-0 flex-col rounded-xl"
              style={{ background: hueTint(hue, 9), boxShadow: over?.status === s ? `inset 0 0 0 1.5px ${hueVar(hue)}` : undefined }}
              onDragOver={(e) => {
                e.preventDefault();
                if (over?.status !== s || over.beforeId !== null) if (!(e.target as HTMLElement).closest("[data-card]")) setOver({ status: s, beforeId: null });
              }}
              onDrop={(e) => onDrop(e, s)}
            >
              <div className="group/col relative flex shrink-0 items-center gap-2 px-2.5 pb-2 pt-2.5" title={wip ? `More than ${WIP_PER_PERSON} in progress per person` : undefined}>
                <StatusPill s={s} label={label} className={wip ? "ring-1 ring-amber" : ""} />
                <span className="font-mono text-[12px] text-text-3">{list.length}</span>
                {s !== "done" && est ? <span className="font-mono text-[11px] text-text-3">· {hours(est)}</span> : null}
                <span className="ml-auto flex items-center gap-0.5 text-text-3">
                  <button type="button" aria-label={`${meta.label} column options`} aria-haspopup="menu" aria-expanded={menu === s} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-surface-2/70 hover:text-text" onClick={() => setMenu(menu === s ? null : s)}>
                    <Icon d={ICONS.more} size={16} />
                  </button>
                  <button type="button" aria-label={`Add task to ${meta.label}`} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-surface-2/70 hover:text-text" onClick={() => (setAddAtTop(true), setAdding(s))}>
                    <Icon d={ICONS.plus} size={15} />
                  </button>
                </span>
                {menu === s ? (
                  <div role="menu" className="absolute right-2 top-10 z-20 flex w-48 flex-col rounded-lg border border-line-strong bg-surface py-1 text-[13px] shadow-card" onMouseLeave={() => setMenu(null)}>
                    <button type="button" role="menuitem" className="h-9 px-3 text-left text-text-2 hover:bg-surface-2 hover:text-text" onClick={() => (setMenu(null), toggleFold(s))}>
                      Collapse column
                    </button>
                    {s === "done" ? (
                      <button type="button" role="menuitem" className="h-9 px-3 text-left text-text-2 hover:bg-surface-2 hover:text-text" onClick={() => (setMenu(null), setShowOlderDone((x) => !x))}>
                        {showOlderDone ? "Only this week" : "Show older"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {adding === s && addAtTop ? addForm(s) : null}
                {list.map((r) => (
                  <div key={r.task.id} className="flex flex-col">
                    {over?.status === s && over.beforeId === r.task.id && drag !== r.task.id ? <div className="mb-1 h-0.5 rounded-full" style={{ background: hueVar(hue) }} /> : null}
                    <div
                      role="button"
                      tabIndex={0}
                      data-card={r.task.id}
                      draggable
                      aria-label={`${r.task.title}. ${meta.label}. Shift and arrow keys move it.`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/task", r.task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDrag(r.task.id);
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setOver(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const after = e.clientY > rect.top + rect.height / 2;
                        const i = list.indexOf(r);
                        setOver({ status: s, beforeId: after ? (list[i + 1]?.task.id ?? null) : r.task.id });
                      }}
                      onClick={() => openTask(r.task.id)}
                      onKeyDown={(e) => onCardKey(e, r)}
                      className={`flex shrink-0 cursor-pointer flex-col gap-2 rounded-lg bg-surface px-3 py-2.5 text-left shadow-card outline-none transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan ${drag === r.task.id ? "opacity-40" : ""}`}
                    >
                      <span className="flex items-start gap-2">
                        <span className="mt-px shrink-0 text-[15px] leading-5" aria-hidden="true">
                          {taskEmoji(r.task)}
                        </span>
                        <span className={`text-[14px] font-semibold leading-5 ${s === "done" ? "text-text-2" : ""}`}>{r.task.title}</span>
                      </span>
                      {r.task.dueAt || r.assignees.length || r.subtasks.total || r.task.priority === "urgent" || r.task.priority === "high" ? (
                        <span className="flex items-center gap-2.5 pl-[23px] text-[11px] text-text-3">
                          {r.task.priority === "urgent" || r.task.priority === "high" ? (
                            <span title={PRIORITY_META[r.task.priority].label}>
                              <Flag p={r.task.priority} />
                            </span>
                          ) : null}
                          {r.task.dueAt ? (
                            <span className="font-mono" style={{ color: isOverdue(r) ? hueVar("coral") : r.task.dueAt === todayKey() ? hueVar("orange") : undefined }}>
                              {shortDue(r.task.dueAt)}
                            </span>
                          ) : null}
                          {r.subtasks.total ? <span className="font-mono">☰ {r.subtasks.done}/{r.subtasks.total}</span> : null}
                          <span className="ml-auto flex -space-x-1.5">
                            {r.assignees.slice(0, 3).map((a) => (
                              <Avatar key={a.id} id={a.id} name={a.name} size={20} />
                            ))}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
                {over?.status === s && over.beforeId === null && drag ? <div className="h-0.5 rounded-full" style={{ background: hueVar(hue) }} /> : null}
                {adding === s && !addAtTop ? addForm(s) : null}
                <button
                  type="button"
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-left text-[13px] text-text-3 hover:bg-surface-2/70 hover:text-text"
                  onClick={() => {
                    setAddAtTop(false);
                    setAdding(s);
                  }}
                >
                  <Icon d={ICONS.plus} size={14} /> New task
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default BoardView;
