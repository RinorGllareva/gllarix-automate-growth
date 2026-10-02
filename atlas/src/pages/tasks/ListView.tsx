import { useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@/auth/AuthContext";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { COLLAPSED_BY_DEFAULT, PRIORITY_META, STATUS_META } from "@/config/tasks";
import { data, type GroupBy, type SavedView, type SortBy, type TaskFilters, type TaskPatch, type TaskPriority, type TaskRow, type TaskStatus, type ViewConfig } from "@/data";
import { isTypingTarget } from "@/lib/hotkeys";
import { EMPTY_FILTERS, filterTasks, groupTasks, hours, listSummary, myWorkGroups, nextStatus, sortTasks, type TaskGroup } from "@/services/tasks";
import { AiTag, Flag, isOverdue, shortDue, StatusPill, taskEmoji, todayKey, ToolbarSlot, useTasks } from "./shared";
import { Avatar, Icon, ICONS } from "@/components/ui/primitives";
import { CATEGORY_HUE, hueTint, hueVar, PRIORITY_HUE, type Hue } from "@/config/colors";

const COLS = "grid-cols-[38px_minmax(260px,1fr)_130px_140px_96px_110px_72px_130px]";
const GROUPS: [GroupBy, string][] = [["status", "Status"], ["owner", "Owner"], ["priority", "Priority"], ["category", "Category"], ["due_week", "Due week"], ["none", "None"]];
const SORTS: [SortBy, string][] = [["manual", "Manual"], ["due", "Due"], ["priority", "Priority"], ["created", "Created"]];
const plain = "border-0 bg-transparent p-0 text-[12px] focus:outline-none focus-visible:outline-1";

const activeFilterCount = (f: TaskFilters) =>
  f.owners.length + f.priorities.length + f.categories.length + f.tags.length + (f.dueFrom ? 1 : 0) + (f.dueTo ? 1 : 0) + (f.ai !== null ? 1 : 0) + (f.hasDeps !== null ? 1 : 0) + (f.q ? 1 : 0);

/** Group header for non-status groupings, tinted from the group's tone. */
const GroupTag = ({ tone, children }: { tone: string; children: ReactNode }) => {
  const hue = tone.replace("text-", "") as Hue;
  const muted = hue === ("text" as Hue) || hue === ("text-2" as Hue) || hue === "text-3";
  return <Tag hue={muted ? "text-3" : hue}>{children}</Tag>;
};

/** Rounded tag (Notion select property). */
const Tag = ({ hue, children }: { hue: Hue; children: ReactNode }) => (
  <span className="inline-flex h-[22px] max-w-full items-center gap-1 truncate whitespace-nowrap rounded-md px-2 text-[12px]" style={{ background: hueTint(hue, 18), color: hue === "text-3" ? "var(--text-2)" : hueVar(hue) }}>
    {children}
  </span>
);

/** One table row, Notion database style: icon + title, then property cells. Every cell edits in place. */
const Row = ({ row, selected, focused, onSelect, onPatch, onOpen }: { row: TaskRow; selected: boolean; focused: boolean; onSelect: () => void; onPatch: (p: TaskPatch) => void; onOpen: () => void }) => {
  const { home } = useTasks();
  const t = row.task;
  const closed = t.status === "done" || t.status === "cancelled";
  const cell = "flex h-full min-w-0 items-center border-l border-line-soft px-2.5";
  return (
    <div
      role="row"
      aria-selected={selected}
      data-focused={focused || undefined}
      className={`group grid ${COLS} min-w-[980px] items-stretch border-b border-line-soft text-[14px] ${focused || selected ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
      style={{ height: 38 }}
    >
      <span className="flex items-center justify-center">
        <input
          type="checkbox"
          aria-label={`Select ${t.title}`}
          checked={selected}
          onChange={onSelect}
          className={`h-3.5 w-3.5 accent-[var(--cyan)] ${selected ? "" : "opacity-0 focus:opacity-100 group-hover:opacity-100"}`}
        />
      </span>
      <span className="flex min-w-0 items-center gap-2 pr-2.5">
        <span className="shrink-0 text-[15px] leading-none" aria-hidden="true">
          {taskEmoji(t)}
        </span>
        <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-2 text-left">
          <span className={`truncate font-medium ${closed ? "text-text-3 line-through" : ""}`}>{t.title}</span>
          {row.subtasks.total ? <span className="num shrink-0 font-mono text-[11px] text-text-3">☰ {row.subtasks.done}/{row.subtasks.total}</span> : null}
          {t.createdByAi ? <AiTag /> : null}
          {row.waitingOnOpen ? <span className="shrink-0 text-[11px] text-amber" title="Waiting on unfinished tasks">waiting</span> : null}
        </button>
        <button type="button" onClick={onOpen} tabIndex={-1} className="ml-auto hidden h-6 shrink-0 items-center gap-1 rounded-md border border-line-strong bg-surface px-1.5 text-[11px] font-medium tracking-[0.06em] text-text-2 hover:text-text group-hover:flex">
          OPEN
        </button>
      </span>
      <label className={`relative ${cell}`}>
        <StatusPill s={t.status} className="h-[22px] text-[12px]" />
        <select aria-label="Status" className="absolute inset-0 cursor-pointer opacity-0" value={t.status} onChange={(e) => onPatch({ status: e.target.value as TaskStatus })}>
          {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </label>
      <label className={`relative gap-1.5 ${cell}`}>
        {row.assignees.length ? (
          <>
            <span className="flex shrink-0 -space-x-1.5">
              {row.assignees.slice(0, 3).map((a) => (
                <Avatar key={a.id} id={a.id} name={a.name} size={20} round />
              ))}
            </span>
            <span className="truncate text-[13px] text-text-2">{row.assignees.length === 1 ? row.assignees[0].name.split(" ")[0] : `${row.assignees[0].name.split(" ")[0]} +${row.assignees.length - 1}`}</span>
          </>
        ) : (
          <span className="text-[13px] text-text-3 opacity-0 group-hover:opacity-100">Empty</span>
        )}
        <select aria-label="Owner" className="absolute inset-0 cursor-pointer opacity-0" value={t.assigneeIds[0] ?? ""} onChange={(e) => onPatch({ assigneeIds: e.target.value ? [e.target.value, ...t.assigneeIds.filter((a) => a !== e.target.value).slice(1)] : [] })}>
          <option value="">—</option>
          {home.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name.split(" ")[0]}
              {t.assigneeIds.length > 1 && t.assigneeIds[0] === u.id ? ` +${t.assigneeIds.length - 1}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className={`relative text-[13px] ${cell}`} style={{ color: isOverdue(row) ? hueVar("coral") : t.dueAt === todayKey() ? hueVar("orange") : "var(--text-2)" }}>
        {t.dueAt ? <span>{shortDue(t.dueAt)}</span> : <span className="text-text-3 opacity-0 group-hover:opacity-100">Empty</span>}
        <input type="date" aria-label="Due date" value={t.dueAt ?? ""} onChange={(e) => onPatch({ dueAt: e.target.value || null })} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <label className={`relative ${cell}`}>
        <Tag hue={PRIORITY_HUE[t.priority]}>
          <Flag p={t.priority} size={11} />
          {PRIORITY_META[t.priority].label}
        </Tag>
        <select aria-label="Priority" className="absolute inset-0 cursor-pointer opacity-0" value={t.priority} onChange={(e) => onPatch({ priority: e.target.value as TaskPriority })}>
          {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
      </label>
      <span className={cell}>
        <input
          aria-label="Estimate in hours"
          className={`${plain} w-full text-[13px] text-text-2 placeholder:opacity-0 group-hover:placeholder:opacity-100`}
          key={t.estimateMinutes ?? "none"}
          defaultValue={t.estimateMinutes ? `${Math.round((t.estimateMinutes / 60) * 10) / 10}h` : ""}
          placeholder="Empty"
          inputMode="decimal"
          onBlur={(e) => {
            const v = e.target.value.trim().replace(/h$/i, "");
            const minutes = v === "" ? null : Math.round(Number(v) * 60);
            if (minutes === null || Number.isFinite(minutes)) if (minutes !== t.estimateMinutes) onPatch({ estimateMinutes: minutes });
          }}
        />
      </span>
      <label className={`relative ${cell}`}>
        {t.category ? <Tag hue={CATEGORY_HUE[t.category] ?? "text-3"}>{t.category}</Tag> : <span className="text-[13px] text-text-3 opacity-0 group-hover:opacity-100">Empty</span>}
        <select aria-label="Category" className="absolute inset-0 cursor-pointer opacity-0" value={t.category ?? ""} onChange={(e) => onPatch({ category: e.target.value || null })}>
          <option value="">—</option>
          {home.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

const InlineAdd = ({ onAdd }: { onAdd: (title: string) => Promise<void> }) => {
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="flex h-9 min-w-[980px] items-center gap-1.5 border-b border-line-soft pl-[38px] text-left text-[13px] text-text-3 hover:bg-surface-2/60 hover:text-text" onClick={() => setOpen(true)}>
        <Icon d={ICONS.plus} size={14} /> New task
      </button>
    );
  return (
    <form
      className="flex h-10 min-w-[980px] items-center gap-2 border-b border-line-soft pl-[38px] pr-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await onAdd(title);
        setTitle("");
      }}
    >
      <span aria-hidden="true">📄</span>
      <input autoFocus aria-label="New task title" className="h-8 flex-1 border-0 bg-transparent text-[14px] text-text placeholder:text-text-3 focus:outline-none" placeholder="Type a name, then Enter" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)} onBlur={() => !title && setOpen(false)} />
    </form>
  );
};

const FilterPanel = ({ f, setF, onClose }: { f: TaskFilters; setF: (f: TaskFilters) => void; onClose: () => void }) => {
  const { home } = useTasks();
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const chip = (on: boolean) => `h-7 border px-2 text-[11px] ${on ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-2 hover:text-text"}`;
  return (
    <div className="absolute right-0 top-10 z-30 flex w-[min(92vw,420px)] flex-col gap-4 rounded-lg border border-line-strong bg-surface p-4 text-[12px] shadow-card" role="dialog" aria-label="Filter tasks">
      <input className="input h-9" placeholder="Search titles, descriptions, tags" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      <div className="flex flex-col gap-2">
        <span className="label-caps">Owner</span>
        <div className="flex flex-wrap gap-1.5">
          {[...home.users.map((u) => ({ id: u.id, name: u.name.split(" ")[0] })), { id: "none", name: "Unassigned" }].map((u) => (
            <button key={u.id} type="button" className={chip(f.owners.includes(u.id))} onClick={() => setF({ ...f, owners: toggle(f.owners, u.id) })}>
              {u.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label-caps">Priority</span>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
            <button key={p} type="button" className={chip(f.priorities.includes(p))} onClick={() => setF({ ...f, priorities: toggle(f.priorities, p) })}>
              {PRIORITY_META[p].label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label-caps">Category</span>
        <div className="flex flex-wrap gap-1.5">
          {home.categories.map((c) => (
            <button key={c} type="button" className={chip(f.categories.includes(c))} onClick={() => setF({ ...f, categories: toggle(f.categories, c) })}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-caps">Due</span>
        <input type="date" aria-label="Due from" className="input h-8 w-36" value={f.dueFrom ?? ""} onChange={(e) => setF({ ...f, dueFrom: e.target.value || null })} />
        <span className="text-text-3">to</span>
        <input type="date" aria-label="Due to" className="input h-8 w-36" value={f.dueTo ?? ""} onChange={(e) => setF({ ...f, dueTo: e.target.value || null })} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(f.ai === true)} onClick={() => setF({ ...f, ai: f.ai === true ? null : true })}>
          Created by AI
        </button>
        <button type="button" className={chip(f.hasDeps === true)} onClick={() => setF({ ...f, hasDeps: f.hasDeps === true ? null : true })}>
          Has dependencies
        </button>
      </div>
      <div className="flex justify-between">
        <button type="button" className="btn-ghost h-8 text-[11px]" onClick={() => setF(EMPTY_FILTERS)}>
          Clear
        </button>
        <button type="button" className="btn-outline h-8 text-[11px]" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
};

/** List view (15_TASKS_LIST.md) for a list, a space, or My work. */
const ListView = ({ listId, spaceId, myWork, title }: { listId?: string; spaceId?: string; myWork?: boolean; title: string }) => {
  const { home, refresh, openTask } = useTasks();
  const slot = useContext(ToolbarSlot);
  const user = useUser();
  const toast = useToast();
  const [rows, setRows] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ViewConfig>({ groupBy: "status", sort: "manual", filters: EMPTY_FILTERS });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(COLLAPSED_BY_DEFAULT));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [showFilter, setShowFilter] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [naming, setNaming] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const viewKey = myWork ? null : (listId ?? null);

  const load = useCallback(() => {
    data.listTasks({ listId, spaceId, myWork }).then(setRows, (e: Error) => setError(e.message));
  }, [listId, spaceId, myWork]);
  useEffect(() => {
    setRows(null);
    setSelected(new Set());
    load();
  }, [load]);
  useEffect(() => {
    data.listSavedViews(viewKey).then(setViews);
  }, [viewKey]);

  const patch = async (id: string, p: TaskPatch) => {
    setRows((rs) => rs && rs.map((r) => (r.task.id === id ? { ...r, task: { ...r.task, ...p } } : r)));
    try {
      await data.updateTask(id, p);
    } catch (e) {
      const msg = (e as Error).message;
      if (/open subtask/.test(msg) && window.confirm(`${msg}`)) await data.updateTask(id, { ...p, completeSubtasks: true });
      else toast(msg, "error");
    }
    load();
    refresh();
  };

  const groups: TaskGroup[] = useMemo(() => {
    if (!rows) return [];
    const filtered = sortTasks(filterTasks(rows, config.filters), config.sort);
    return myWork ? myWorkGroups(filtered, todayKey()) : groupTasks(filtered, config.groupBy, home.users, todayKey());
  }, [rows, config, myWork, home.users]);
  const visibleRows = groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.rows));
  const summary = rows ? listSummary(rows) : null;

  const onKey = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    const row = visibleRows[focus];
    if (e.key === "j" || e.key === "ArrowDown") setFocus((f) => Math.min(visibleRows.length - 1, f + 1));
    else if (e.key === "k" || e.key === "ArrowUp") setFocus((f) => Math.max(0, f - 1));
    else if (e.key === "Enter" && row) openTask(row.task.id);
    else if (e.key === "x" && row) setSelected((s) => new Set(s.has(row.task.id) ? [...s].filter((x) => x !== row.task.id) : [...s, row.task.id]));
    else if (e.key === "s" && row) patch(row.task.id, { status: nextStatus(row.task.status) });
    else if (e.key === "a" && row) patch(row.task.id, { assigneeIds: row.task.assigneeIds.includes(user.id) ? row.task.assigneeIds : [user.id, ...row.task.assigneeIds] });
    else return;
    e.preventDefault();
  };

  const bulk = async (p: TaskPatch | { delete: true }) => {
    const n = await data.bulkUpdateTasks([...selected], p);
    toast(`${n} task${n === 1 ? "" : "s"} updated`, "good");
    setSelected(new Set());
    load();
    refresh();
  };

  const addIn = async (g: TaskGroup, titleText: string) => {
    const target = listId ?? rows?.[0]?.task.listId ?? home.spaces.flatMap((x) => x.lists)[0]?.id;
    if (!target) return;
    await data.createTask({ listId: target, title: titleText, status: g.status ?? "todo", assigneeIds: [user.id], dueAt: myWork && g.key === "today" ? todayKey() : undefined });
    load();
    refresh();
  };

  if (error) return <EmptyState title={error} />;
  const nFilters = activeFilterCount(config.filters);

  const toolbar = (
      <div className={`flex flex-wrap items-center justify-end gap-1.5 ${slot ? "contents" : "relative"}`}>
        {summary ? (
          <span className="mr-1.5 hidden text-[12px] text-text-3 2xl:inline">
            {summary.open} open · {summary.hours} h{summary.mostDueBy ? ` · most due before ${shortDue(summary.mostDueBy)}` : ""}
          </span>
        ) : null}
        {!myWork ? (
          <label className="flex h-8 items-center gap-1.5 rounded-md bg-inset px-2.5 text-[12px] text-text-2">
            Group:
            <select aria-label="Group by" className={`${plain} text-text`} value={config.groupBy} onChange={(e) => setConfig({ ...config, groupBy: e.target.value as GroupBy })}>
              {GROUPS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex h-8 items-center gap-1.5 rounded-md bg-inset px-2.5 text-[12px] text-text-2">
          Sort:
          <select aria-label="Sort by" className={`${plain} text-text`} value={config.sort} onChange={(e) => setConfig({ ...config, sort: e.target.value as SortBy })}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={`h-8 rounded-md px-2.5 text-[12px] ${nFilters ? "bg-cyan-tint text-cyan" : "bg-inset text-text-2 hover:text-text"}`} onClick={() => setShowFilter((x) => !x)} aria-expanded={showFilter}>
          Filter{nFilters ? ` · ${nFilters}` : ""}
        </button>
        <label className="flex h-8 items-center gap-1.5 rounded-md bg-inset px-2.5 text-[12px] text-text-2">
          View:
          <select
            aria-label="Saved views"
            className={`${plain} text-text`}
            value=""
            onChange={async (e) => {
              const v = e.target.value;
              if (v === "__save") setNaming("");
              else if (v.startsWith("del:")) {
                await data.deleteSavedView(v.slice(4));
                setViews(await data.listSavedViews(viewKey));
              } else {
                const view = views.find((x) => x.id === v);
                if (view) setConfig(view.config);
              }
            }}
          >
            <option value="">{views.length ? "saved…" : "default"}</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
            <option value="__save">Save current view…</option>
            {views.map((v) => (
              <option key={`d-${v.id}`} value={`del:${v.id}`}>
                Delete “{v.name}”
              </option>
            ))}
          </select>
        </label>
        {naming !== null ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await data.saveView({ listId: viewKey, name: naming, config });
                setViews(await data.listSavedViews(viewKey));
                setNaming(null);
                toast("View saved", "good");
              } catch (err) {
                toast((err as Error).message, "error");
              }
            }}
          >
            <input autoFocus className="input h-8 w-40" placeholder="View name" value={naming} onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setNaming(null)} />
          </form>
        ) : null}
        {showFilter ? <FilterPanel f={config.filters} setF={(f) => setConfig({ ...config, filters: f })} onClose={() => setShowFilter(false)} /> : null}
      </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4" onKeyDown={onKey} ref={ref}>
      <h1 className="sr-only">{title}</h1>
      {slot ? createPortal(toolbar, slot) : toolbar}

      {selected.size ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border border-cyan-line bg-surface px-3 py-2 text-[12px]" role="toolbar" aria-label="Bulk edit">
          <span className="text-cyan">{selected.size} selected</span>
          <select aria-label="Set status" className="input h-8 w-auto" value="" onChange={(e) => e.target.value && bulk({ status: e.target.value as TaskStatus })}>
            <option value="">Status…</option>
            {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <select aria-label="Set owner" className="input h-8 w-auto" value="" onChange={(e) => e.target.value && bulk({ assigneeIds: [e.target.value] })}>
            <option value="">Owner…</option>
            {home.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select aria-label="Set priority" className="input h-8 w-auto" value="" onChange={(e) => e.target.value && bulk({ priority: e.target.value as TaskPriority })}>
            <option value="">Priority…</option>
            {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
          <input type="date" aria-label="Set due date" className="input h-8 w-auto" onChange={(e) => e.target.value && bulk({ dueAt: e.target.value })} />
          <select aria-label="Move to list" className="input h-8 w-auto" value="" onChange={(e) => e.target.value && bulk({ listId: e.target.value })}>
            <option value="">Move to…</option>
            {home.spaces.flatMap((x) =>
              x.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {x.space.name} / {l.name}
                </option>
              )),
            )}
          </select>
          <button type="button" className="btn-ghost h-8 text-[11px] text-coral" onClick={() => window.confirm(`Move ${selected.size} tasks to the trash?`) && bulk({ delete: true })}>
            Delete
          </button>
          <button type="button" className="btn-ghost ml-auto h-8 text-[11px]" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      {!rows ? (
        <SkeletonRows rows={8} />
      ) : (
        <div className="min-w-0 overflow-x-auto" role="grid" aria-label={title} tabIndex={0}>
          <div className={`grid ${COLS} min-w-[980px] items-stretch border-b border-t border-line-soft text-[13px] text-text-3`} style={{ height: 34 }}>
            <span />
            <span className="flex items-center gap-1.5 pr-2.5">
              <span className="font-serif text-[13px]">Aa</span> Task
            </span>
            {(
              [
                [ICONS.status, "Status"],
                [ICONS.user, "Owner"],
                [ICONS.calendar, "Due"],
                [ICONS.flag, "Priority"],
                [ICONS.clock, "Est."],
                [ICONS.tag, "Category"],
              ] as const
            ).map(([icon, label]) => (
              <span key={label} className="flex items-center gap-1.5 border-l border-line-soft px-2.5">
                <Icon d={icon} size={14} />
                {label}
              </span>
            ))}
          </div>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            return (
              <section key={g.key} aria-label={g.label} className="flex flex-col">
                <button
                  type="button"
                  className="mt-5 flex h-9 min-w-[980px] items-center gap-2 px-1.5 text-[13px] first:mt-3"
                  onClick={() => setCollapsed((c) => new Set(c.has(g.key) ? [...c].filter((x) => x !== g.key) : [...c, g.key]))}
                  aria-expanded={!isCollapsed}
                >
                  <Icon d={ICONS.chevronRight} size={14} className={`text-text-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                  {g.status ? <StatusPill s={g.status} /> : <GroupTag tone={g.tone}>{g.label}</GroupTag>}
                  <span className="text-text-3">{g.rows.length}</span>
                  {g.rows.length ? <span className="ml-auto pr-2 text-[12px] text-text-3">{hours(g.rows.reduce((n, r) => n + (r.task.estimateMinutes ?? 0), 0))}</span> : null}
                </button>
                {!isCollapsed
                  ? g.rows.map((r) => (
                      <Row
                        key={r.task.id}
                        row={r}
                        focused={visibleRows[focus]?.task.id === r.task.id}
                        selected={selected.has(r.task.id)}
                        onSelect={() => setSelected((s) => new Set(s.has(r.task.id) ? [...s].filter((x) => x !== r.task.id) : [...s, r.task.id]))}
                        onPatch={(p) => patch(r.task.id, p)}
                        onOpen={() => openTask(r.task.id)}
                      />
                    ))
                  : null}
                {!isCollapsed && (!myWork || g.key === "today" || g.key === "none") && (config.groupBy === "status" || myWork) ? <InlineAdd onAdd={(t) => addIn(g, t)} /> : null}
              </section>
            );
          })}
          {!groups.some((g) => g.rows.length) ? <p className="m-0 px-3 py-6 text-[13px] text-text-2">{nFilters ? "No tasks match the filters." : "No tasks here yet. Add one with + Add task or T."}</p> : null}
        </div>
      )}
      <p className="m-0 text-[11px] text-text-3">Keys: J/K move · Enter open · X select · S status · A assign to me · T new task</p>
    </div>
  );
};

export default ListView;
