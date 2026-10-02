import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Drawer, Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, ICONS, SkeletonRows } from "@/components/ui/primitives";
import { data, type NotionRow, type TasksHome } from "@/data";
import { isTypingTarget } from "@/lib/hotkeys";
import { isoWeekKey } from "@/services/time";
import { mapNotionRow } from "@/services/tasks";
import BoardView from "./BoardView";
import ListView from "./ListView";
import { TasksContext, todayKey, ToolbarSlot, useTasks } from "./shared";
import TaskDetailView from "./TaskDetailView";
import TimelineView from "./TimelineView";
import WorkloadView from "./WorkloadView";
import PlannerView from "./PlannerView";
import { AutomationsView, GoalsView } from "./AutomationsView";

/** Tab look shared by the spaces row and the view row (compact, icon + label + count). */
const tabCls = (on: boolean) =>
  `flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors ${on ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:bg-surface-2/60 hover:text-text"}`;
const Count = ({ n, tone }: { n: number; tone?: string }) => (n ? <span className={`font-mono text-[11px] ${tone ?? "text-text-3"}`}>{n}</span> : null);

/** Routes that show one space or list (and so the lists row). */
const SCOPED = /^\/tasks(\/(board|timeline))?\/?$/;

/** "More" menu: Goals, Automations, Notion import. */
const MoreMenu = () => {
  const { home } = useTasks();
  const user = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const item = "flex h-9 items-center px-3 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text";
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" aria-label="More task pages" aria-haspopup="menu" aria-expanded={open} className={tabCls(open)} onClick={() => setOpen((o) => !o)}>
        <Icon d={ICONS.more} size={16} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-30 flex w-56 flex-col rounded-lg border border-line-strong bg-surface py-1 shadow-card" onClick={() => setOpen(false)}>
          <Link role="menuitem" to="/tasks/goals" className={item}>
            Goals
          </Link>
          <Link role="menuitem" to="/tasks/automations" className={item}>
            Automations and templates
          </Link>
          {user.role === "admin" ? (
            <Link role="menuitem" to="/tasks/import" className={item}>
              {home.notionImportedAt ? `Notion imported ${home.notionImportedAt.slice(0, 10)}` : "Import from Notion…"}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

/** Spaces as a tab row: My work, Inbox, then each space. Replaces the old spaces sidebar. */
const SpacesRow = ({ activeSpace }: { activeSpace: string | null }) => {
  const { home } = useTasks();
  const loc = useLocation();
  const view = ["/tasks/board", "/tasks/timeline"].find((v) => loc.pathname.startsWith(v)) ?? "/tasks";
  return (
    <nav aria-label="Spaces" className="flex min-w-0 items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">
        <NavLink to="/tasks/my-work" className={({ isActive }) => tabCls(isActive)}>
          <Icon d={ICONS.user} size={15} className="text-cyan" />
          My work
          <Count n={home.myWork} tone="text-cyan" />
        </NavLink>
        <NavLink to="/tasks/inbox" className={({ isActive }) => tabCls(isActive)}>
          <Icon d={ICONS.inbox} size={15} className={home.inboxUnread ? "text-coral" : "text-text-3"} />
          Inbox
          <Count n={home.inboxUnread} tone="text-coral" />
        </NavLink>
        <span className="mx-1.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        {home.spaces.map(({ space, open }) => (
          <Link key={space.id} to={`${view}?space=${space.id}`} aria-current={activeSpace === space.id ? "page" : undefined} className={tabCls(activeSpace === space.id)}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--${space.color})` }} aria-hidden="true" />
            {space.name}
            <Count n={open} />
          </Link>
        ))}
      </div>
      {home.timer ? (
        <Link to={`/tasks/${home.timer.taskId}`} className="flex h-8 max-w-[220px] shrink-0 items-center gap-2 rounded-md border border-cyan-line px-2.5 text-[12px] text-cyan" title={`Timer running · ${home.timer.title}`}>
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cyan" aria-hidden="true" />
          <span className="truncate">{home.timer.title}</span>
        </Link>
      ) : null}
      <MoreMenu />
    </nav>
  );
};

/** The active space's lists as small chips, with "All lists" and "+ List". Right-click (admin) renames or archives. */
const ListsRow = ({ spaceId, activeList }: { spaceId: string; activeList: string | null }) => {
  const { home, refresh } = useTasks();
  const user = useUser();
  const toast = useToast();
  const loc = useLocation();
  const view = ["/tasks/board", "/tasks/timeline"].find((v) => loc.pathname.startsWith(v)) ?? "/tasks";
  const entry = home.spaces.find((x) => x.space.id === spaceId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!entry) return null;
  const color = `var(--${entry.space.color})`;
  const chip = (on: boolean) => `flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] ${on ? "text-text" : "text-text-2 hover:bg-surface-2/60 hover:text-text"}`;
  const tint = (on: boolean) => (on ? { background: `color-mix(in srgb, ${color} 18%, transparent)` } : undefined);
  return (
    <nav aria-label={`Lists in ${entry.space.name}`} className="flex min-w-0 items-center gap-1 overflow-x-auto">
      <Link to={`${view}?space=${spaceId}`} className={chip(!activeList)} style={tint(!activeList)}>
        All lists
        <Count n={entry.open} />
      </Link>
      {entry.lists.map((l) => (
        <Link
          key={l.id}
          to={`${view}?list=${l.id}`}
          aria-current={activeList === l.id ? "page" : undefined}
          className={chip(activeList === l.id)}
          style={tint(activeList === l.id)}
          onContextMenu={async (e) => {
            if (user.role !== "admin") return;
            e.preventDefault();
            const next = window.prompt(`Rename "${l.name}" (or type ARCHIVE to archive it)`, l.name);
            if (!next) return;
            try {
              if (next === "ARCHIVE") await data.archiveList(l.id);
              else await data.renameList(l.id, next);
              refresh();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          {l.name}
          <Count n={l.open} />
        </Link>
      ))}
      {adding ? (
        <form
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            try {
              await data.createList(spaceId, name);
              setAdding(false);
              setName("");
              refresh();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          <input autoFocus aria-label="List name" className="input h-7 w-40 rounded-full px-3 text-[12px]" placeholder="List name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => !name && setAdding(false)} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} />
        </form>
      ) : (
        <button type="button" aria-label={`New list in ${entry.space.name}`} className={chip(false)} onClick={() => setAdding(true)}>
          <Icon d={ICONS.plus} size={13} /> List
        </button>
      )}
    </nav>
  );
};

/** View row: icon tabs on the left, the current view's filters (portal slot), New task on the right. */
const ViewRow = ({ onNew, slotRef }: { onNew: () => void; slotRef: (el: HTMLDivElement | null) => void }) => {
  const [params] = useSearchParams();
  const qs = params.toString() ? `?${params}` : "";
  const tab = (to: string, label: string, icon: string, end = false, keepQs = true) => (
    <NavLink to={`${to}${keepQs ? qs : ""}`} end={end} className={({ isActive }) => tabCls(isActive)}>
      <Icon d={icon} size={15} />
      {label}
    </NavLink>
  );
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <nav aria-label="Task views" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-inset p-0.5">
        {tab("/tasks", "List", ICONS.list, true)}
        {tab("/tasks/board", "Board", ICONS.board)}
        {tab("/tasks/timeline", "Timeline", ICONS.timeline)}
        {tab("/tasks/workload", "Workload", ICONS.workload, false, false)}
        {tab("/tasks/planner", "AI planner", ICONS.sparkle, false, false)}
      </nav>
      <div ref={slotRef} className="relative flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5" />
      <button type="button" className="btn-primary flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12px] normal-case tracking-normal" onClick={onNew} title="New task (T)">
        <Icon d={ICONS.plus} size={14} />
        New task
      </button>
    </div>
  );
};

const NewTaskModal = ({ open, onClose, defaultList }: { open: boolean; onClose: () => void; defaultList: string | null }) => {
  const { home, refresh, openTask } = useTasks();
  const toast = useToast();
  const lists = home.spaces.flatMap((x) => x.lists.map((l) => ({ id: l.id, label: `${x.space.name} / ${l.name}` })));
  const [title, setTitle] = useState("");
  const [listId, setListId] = useState(defaultList ?? lists[0]?.id ?? "");
  const [due, setDue] = useState("");
  useEffect(() => {
    if (open) {
      setTitle("");
      setDue("");
      setListId(defaultList ?? lists[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultList]);
  return (
    <Modal open={open} onClose={onClose} title="New task">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const t = await data.createTask({ listId, title, dueAt: due || null });
            refresh();
            onClose();
            openTask(t.id);
          } catch (err) {
            toast((err as Error).message, "error");
          }
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="field-label">Title</span>
          <input autoFocus required className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <label className="flex flex-col gap-2">
            <span className="field-label">List</span>
            <select className="input" value={listId} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">Due</span>
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
};

/** Inbox: mentions, assignments and comments on my tasks, newest first. */
const InboxView = () => {
  const { refresh, openTask } = useTasks();
  const [items, setItems] = useState<Awaited<ReturnType<typeof data.taskInbox>> | null>(null);
  const load = useCallback(() => data.taskInbox().then(setItems), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!items) return <SkeletonRows rows={6} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Inbox</h1>
        <button
          type="button"
          className="btn-ghost h-9 text-[11px]"
          onClick={async () => {
            await data.markInboxRead("all");
            load();
            refresh();
          }}
        >
          Mark all read
        </button>
      </div>
      {items.length ? (
        <div className="card flex flex-col">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3 text-left text-[13px] last:border-b-0 hover:bg-surface-2 ${i.readAt ? "text-text-2" : ""}`}
              onClick={async () => {
                await data.markInboxRead([i.id]);
                refresh();
                openTask(i.taskId);
                load();
              }}
            >
              <span className="flex items-center gap-3">
                {!i.readAt ? <span className="h-1.5 w-1.5 bg-cyan" aria-label="Unread" /> : <span className="w-1.5" />}
                <span className={`w-20 text-[10px] uppercase tracking-[0.2em] ${i.kind === "mention" ? "text-cyan" : i.kind === "assigned" ? "text-mint" : "text-text-3"}`}>{i.kind}</span>
                {i.text}
              </span>
              <span className="num font-mono text-[11px] text-text-3">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(i.at))}</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing in your inbox. Mentions, assignments and comments on your tasks land here." />
      )}
    </div>
  );
};

/** One-time Notion "✅ Tasks" CSV import (Tasks, Status, Deadline, Priority, Person, Category, Notes). */
const NotionImport = () => {
  const { home, refresh } = useTasks();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<NotionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const onFile = (file: File) =>
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => setRows(r.data.map((x) => mapNotionRow(x, home.users)).filter((x) => x.title)),
    });
  const warnings = rows?.filter((r) => r.warnings.length) ?? [];
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Import from Notion</h1>
      <p className="m-0 text-[14px] text-text-2">
        Export the Notion "✅ Tasks" database as CSV and drop it here. Columns: Tasks, Status, Deadline, Priority, Person, Category, Notes. "Hight" becomes High. Each category lands in its space, in a list called "Imported from Notion". Run it once; after that Notion is read-only.
      </p>
      {home.notionImportedAt ? <p className="m-0 text-[13px] text-amber">Already imported on {home.notionImportedAt.slice(0, 10)}. Importing again creates duplicates.</p> : null}
      <label className="flex h-28 cursor-pointer items-center justify-center border border-dashed border-line-strong text-[13px] text-text-2 hover:text-text" onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]))}>
        Drop the CSV here or click to choose
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {rows ? (
        <>
          <span className="text-[13px] text-text-2">
            {rows.length} tasks · {warnings.length} with warnings
          </span>
          <div className="card max-h-[420px] overflow-auto">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1.6fr)_90px_90px_70px_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-line-soft px-4 py-2 text-[12px] last:border-b-0">
                <span className="truncate">{r.title}</span>
                <span className="text-text-2">{r.status}</span>
                <span className="font-mono text-text-2">{r.dueAt ?? "—"}</span>
                <span className="text-text-2">{r.priority}</span>
                <span className="truncate text-text-2">
                  {r.spaceName}
                  {r.category ? ` · ${r.category}` : ""}
                </span>
                <span className="truncate text-amber">{r.warnings.join("; ")}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary self-start"
            disabled={busy || !rows.length}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await data.importNotionTasks(rows, { again: !!home.notionImportedAt });
                toast(`${res.created} tasks imported into ${res.lists.length} lists`, "good");
                refresh();
                navigate("/tasks/my-work");
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Import {rows.length} tasks
          </button>
        </>
      ) : null}
    </div>
  );
};

const FullPageTask = () => {
  const { id = "" } = useParams();
  return <TaskDetailView id={id} />;
};

/** /tasks, /tasks/board, /tasks/my-work, /tasks/inbox, /tasks/import, /tasks/:id (screens 15–17). */
const TasksModule = () => {
  const [home, setHome] = useState<TasksHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const loc = useLocation();
  const [newOpen, setNewOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(0);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const refresh = useCallback(() => data.tasksHome().then(setHome, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const allLists = home?.spaces.flatMap((x) => x.lists.map((l) => ({ ...l, spaceName: x.space.name }))) ?? [];
  const spaceParam = params.get("space");
  const listParam = params.get("list") ?? (spaceParam ? null : (allLists[0]?.id ?? null));
  const list = allLists.find((l) => l.id === listParam) ?? null;
  const space = home?.spaces.find((x) => x.space.id === (spaceParam ?? list?.spaceId))?.space ?? null;
  const panelTask = params.get("task");

  const openTask = useCallback(
    (id: string) => {
      if (window.innerWidth >= 1280 && !/^\/tasks\/(?!board|my-work|inbox|import|timeline|workload|planner|automations|goals)[^/]+$/.test(loc.pathname)) {
        const next = new URLSearchParams(params);
        next.set("task", id);
        setParams(next);
        setPanelKey((k) => k + 1);
      } else navigate(`/tasks/${id}`);
    },
    [loc.pathname, navigate, params, setParams],
  );
  const ctx = useMemo(() => (home ? { home, refresh, openTask } : null), [home, refresh, openTask]);

  const onTaskPage = /^\/tasks\/(?!board$|my-work$|inbox$|import$|timeline$|workload$|planner$|automations$|goals$)[^/]+$/.test(loc.pathname) && !loc.pathname.startsWith("/tasks/planner/");
  const context = onTaskPage
    ? "TASK"
    : loc.pathname.startsWith("/tasks/planner")
      ? "AI PLANNER · DRAFT, NOTHING SAVED YET"
      : loc.pathname.startsWith("/tasks/goals")
        ? "GOALS"
        : loc.pathname.startsWith("/tasks/automations")
          ? "AUTOMATIONS AND TEMPLATES"
      : loc.pathname.startsWith("/tasks/workload")
      ? "TEAM WORKLOAD · NEXT 5 WEEKS"
      : loc.pathname.startsWith("/tasks/my-work")
    ? "MY WORK"
    : loc.pathname.startsWith("/tasks/inbox")
      ? "INBOX"
      : `${(space?.name ?? "Tasks").toUpperCase()}${list ? ` / ${list.name.toUpperCase()}` : ""}`;
  usePageChrome({
    context: loc.pathname.startsWith("/tasks/planner") ? context : `${context} · WEEK ${isoWeekKey(todayKey()).slice(6)}`,
    action: loc.pathname.startsWith("/tasks/planner") ? { label: "Back to tasks", to: "/tasks" } : { label: "Plan with AI", to: "/tasks/planner" },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) return <EmptyState title={error} />;
  if (!home || !ctx) return <SkeletonRows rows={8} />;
  const title = list?.name ?? space?.name ?? "Tasks";
  const scope = { listId: list?.id, spaceId: !list ? (space?.id ?? undefined) : undefined, title };
  const scoped = SCOPED.test(loc.pathname);

  return (
    <TasksContext.Provider value={ctx}>
      <div className="-mx-5 -my-6 flex min-h-[calc(100vh-72px)] min-w-0 flex-col lg:-mx-10 lg:-my-8">
        <header className="flex min-w-0 flex-col gap-2 border-b border-line bg-chrome px-6 pb-3 pt-2.5 lg:px-8">
          <SpacesRow activeSpace={scoped ? (space?.id ?? null) : null} />
          {scoped && space ? <ListsRow spaceId={space.id} activeList={list?.id ?? null} /> : null}
          <ViewRow onNew={() => setNewOpen(true)} slotRef={setSlot} />
        </header>
        <ToolbarSlot.Provider value={slot}>
          <div className="min-w-0 px-6 py-5 lg:px-8">
            <Routes>
              <Route index element={home.spaces.length ? <ListView key={`l-${scope.listId}-${scope.spaceId}`} {...scope} /> : <EmptyState title="No task spaces for your role yet." />} />
              <Route path="board" element={<BoardView key={`b-${scope.listId}-${scope.spaceId}`} {...scope} />} />
              <Route path="timeline" element={<TimelineView key={`t-${scope.listId}-${scope.spaceId}`} {...scope} />} />
              <Route path="workload" element={<WorkloadView />} />
              <Route path="planner" element={<PlannerView />} />
              <Route path="planner/:id" element={<PlannerView />} />
              <Route path="automations" element={<AutomationsView />} />
              <Route path="goals" element={<GoalsView />} />
              <Route path="my-work" element={<ListView myWork title="My work" />} />
              <Route path="inbox" element={<InboxView />} />
              <Route path="import" element={<NotionImport />} />
              <Route path=":id" element={<FullPageTask />} />
            </Routes>
          </div>
        </ToolbarSlot.Provider>
      </div>
      <NewTaskModal open={newOpen} onClose={() => setNewOpen(false)} defaultList={list?.id ?? null} />
      <Drawer
        open={!!panelTask}
        onClose={() => {
          const next = new URLSearchParams(params);
          next.delete("task");
          setParams(next);
        }}
        title="Task"
        width={880}
      >
        {panelTask ? (
          <div className="px-10 py-8">
            <TaskDetailView key={`${panelTask}-${panelKey}`} id={panelTask} panel />
          </div>
        ) : null}
      </Drawer>
    </TasksContext.Provider>
  );
};

export default TasksModule;
