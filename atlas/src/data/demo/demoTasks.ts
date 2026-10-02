import { CATEGORIES, DEFAULT_SPACES, DEFAULT_STATUSES, MAX_ATTACHMENT_BYTES, PRIORITY_META, STATUS_META, TRASH_DAYS } from "@/config/tasks";
import { createsCycle, dateKey, isOpen, parseMentions } from "@/services/tasks";
import { nextOccurrence, recurrenceText, type AutomationEvent } from "@/services/automations";
import { shiftDateKey } from "@/services/time";
import type {
  ChecklistItem,
  InboxItem,
  LinkType,
  NewTask,
  RunningTimer,
  SavedView,
  Space,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskComment,
  TaskDependency,
  TaskDetail,
  TaskList,
  TaskPatch,
  TaskRow,
  TasksApi,
  TimeEntry,
} from "../taskTypes";
import { AccessError, type Notification, type User } from "../types";

const DAY = 86_400_000;

export interface TasksStore {
  spaces: Space[];
  taskLists: TaskList[];
  tasks: Task[];
  taskDeps: TaskDependency[];
  checklist: ChecklistItem[];
  taskComments: TaskComment[];
  taskAttachments: TaskAttachment[];
  timeEntries: TimeEntry[];
  timers: RunningTimer[];
  taskActivity: TaskActivity[];
  taskInbox: InboxItem[];
  savedViews: SavedView[];
  notionImportedAt: string | null;
}

export const emptyTasksState = (): TasksStore => ({
  spaces: [],
  taskLists: [],
  tasks: [],
  taskDeps: [],
  checklist: [],
  taskComments: [],
  taskAttachments: [],
  timeEntries: [],
  timers: [],
  taskActivity: [],
  taskInbox: [],
  savedViews: [],
  notionImportedAt: null,
});

interface Ctx<S extends TasksStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  /** CRM record label and link for a task's "Linked" field. */
  describeLink: (s: S, type: LinkType, id: string) => { label: string; href: string } | null;
  /** Records whose tasks also show on a lead (its deals, meetings and client). */
  relatedToLead: (s: S, leadId: string) => { type: LinkType; id: string }[];
  /** Automations (M11): task events, and a tick that fires "due date passed". */
  onEvent?: (s: S, e: AutomationEvent) => void;
  onTick?: (s: S) => boolean;
  /** Time tracking (M13): a submitted or approved week can't take new time. */
  isWeekLocked?: (s: S, userId: string, startedAt: string) => boolean;
}

export interface SystemTaskInput {
  spaceName: string;
  listName: string;
  title: string;
  assigneeIds: string[];
  dueAt: string | null;
  linked: Task["linked"];
  tags: string[];
  priority?: Task["priority"];
  descriptionMd?: string;
  estimateMinutes?: number | null;
  category?: string | null;
  checklist?: string[];
}

export const createDemoTasks = <S extends TasksStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();
  let seeding = false;
  const nameOf = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? null) : null);
  const first = (id: string | null) => nameOf(id)?.split(" ")[0] ?? "—";

  // ---------------------------------------------------------------- access

  const spaceOfList = (s: S, listId: string) => s.spaces.find((x) => x.id === s.taskLists.find((l) => l.id === listId)?.spaceId);
  const seesSpace = (user: User, space: Space | undefined) => !!space && (user.role === "admin" || space.roles.includes(user.role));
  const canSee = (s: S, user: User, t: Task): boolean => {
    if (user.role === "viewer") return false;
    if (user.role === "admin" || t.assigneeIds.includes(user.id)) return true;
    if (seesSpace(user, spaceOfList(s, t.listId))) return true;
    // A subtask is visible with its parent.
    const parent = t.parentId ? s.tasks.find((x) => x.id === t.parentId) : null;
    return !!parent && canSee(s, user, parent);
  };
  const requireTasks = (user: User) => {
    if (user.role === "viewer") throw new AccessError(403);
  };
  const getVisible = (s: S, user: User, id: string) => {
    const t = s.tasks.find((x) => x.id === id && !x.deletedAt);
    if (!t) throw new AccessError(404);
    if (!canSee(s, user, t)) throw new AccessError(403);
    return t;
  };

  // ---------------------------------------------------------------- helpers

  const log = (s: S, taskId: string, userId: string | null, text: string) => s.taskActivity.push({ id: uid("ta"), taskId, userId, at: iso(), text });
  const inbox = (s: S, userId: string, taskId: string, kind: InboxItem["kind"], text: string, actorId: string | null) => {
    if (userId === actorId || seeding) return;
    s.taskInbox.push({ id: uid("ib"), userId, taskId, kind, text, actorId, at: iso(), readAt: null });
    notify({ userId, type: kind === "mention" ? "mention" : "task", text, href: `/tasks/${taskId}` });
  };

  const rowFor = (s: S, t: Task): TaskRow => {
    const list = s.taskLists.find((l) => l.id === t.listId);
    const subs = s.tasks.filter((x) => x.parentId === t.id && !x.deletedAt);
    const waiting = s.taskDeps.filter((d) => d.taskId === t.id);
    return {
      task: t,
      listName: list?.name ?? "—",
      spaceName: s.spaces.find((x) => x.id === list?.spaceId)?.name ?? "—",
      assignees: t.assigneeIds.map((id) => ({ id, name: nameOf(id) ?? "—" })),
      subtasks: { done: subs.filter((x) => x.status === "done").length, total: subs.length },
      spentMinutes: s.timeEntries.filter((e) => e.taskId === t.id).reduce((n, e) => n + e.minutes, 0),
      hasDeps: waiting.length > 0 || s.taskDeps.some((d) => d.dependsOnId === t.id),
      waitingOnOpen: waiting.filter((d) => {
        const o = s.tasks.find((x) => x.id === d.dependsOnId);
        return o && !o.deletedAt && isOpen(o.status);
      }).length,
    };
  };

  const lastPosition = (s: S, listId: string, parentId: string | null) => Math.max(0, ...s.tasks.filter((t) => t.listId === listId && t.parentId === parentId).map((t) => t.position));

  const makeTask = (s: S, input: NewTask & { tags?: string[]; createdBy: string | null; createdByAi?: boolean; acceptedBy?: string | null; planId?: string | null; importedFrom?: string | null; createdAt?: string }): Task => {
    const list = s.taskLists.find((l) => l.id === input.listId);
    if (!list) throw new AccessError(404, "That list doesn't exist.");
    const title = input.title.trim();
    if (!title) throw new Error("Give the task a title.");
    if (input.parentId) {
      const parent = s.tasks.find((t) => t.id === input.parentId);
      if (!parent) throw new AccessError(404);
      if (parent.parentId) throw new Error("Subtasks are one level deep.");
    }
    const at = input.createdAt ?? iso();
    const t: Task = {
      id: uid("tk"), listId: input.listId, parentId: input.parentId ?? null, title, descriptionMd: input.descriptionMd ?? "", status: input.status ?? "todo",
      priority: input.priority ?? "normal", category: input.category ?? null, tags: input.tags ?? [], assigneeIds: input.assigneeIds ?? [], startAt: input.startAt ?? null, dueAt: input.dueAt ?? null,
      estimateMinutes: input.estimateMinutes ?? null, position: input.position ?? lastPosition(s, input.listId, input.parentId ?? null) + 1000, linked: input.linked ?? null,
      createdBy: input.createdBy, createdByAi: input.createdByAi ?? false, acceptedBy: input.acceptedBy ?? null, createdAt: at, updatedAt: at,
      completedAt: input.status === "done" ? at : null, deletedAt: null, importedFrom: input.importedFrom ?? null,
      recurrence: input.recurrence ?? null, planId: input.planId ?? null, goalId: input.goalId ?? null,
    };
    s.tasks.push(t);
    s.taskActivity.push({ id: uid("ta"), taskId: t.id, userId: input.createdBy, at, text: input.importedFrom ? `Imported from ${input.importedFrom}` : "Created the task" });
    for (const a of t.assigneeIds) inbox(s, a, t.id, "assigned", `${first(input.createdBy)} assigned you · ${t.title}`, input.createdBy);
    if (!seeding && !t.parentId) ctx.onEvent?.(s, { type: "task_created", taskId: t.id, listId: t.listId, priority: t.priority, category: t.category });
    return t;
  };

  const listByName = (s: S, spaceName: string, listName: string) => {
    const space = s.spaces.find((x) => x.name === spaceName) ?? s.spaces[0];
    let list = s.taskLists.find((l) => l.spaceId === space.id && l.name === listName && !l.archivedAt);
    if (!list) {
      list = { id: uid("tl"), spaceId: space.id, name: listName, statuses: [...DEFAULT_STATUSES], defaultView: "list", position: s.taskLists.filter((l) => l.spaceId === space.id).length, archivedAt: null };
      s.taskLists.push(list);
    }
    return list;
  };

  /** Tasks the system creates (client health calls, cancel follow-ups, …). */
  const addSystemTask = (s: S, input: SystemTaskInput) => {
    const list = listByName(s, input.spaceName, input.listName);
    const t = makeTask(s, {
      listId: list.id, title: input.title, assigneeIds: input.assigneeIds, dueAt: input.dueAt, linked: input.linked, tags: input.tags,
      priority: input.priority ?? "high", category: input.category ?? (input.spaceName === "Delivery" ? "Delivery" : null), descriptionMd: input.descriptionMd, createdBy: null,
      estimateMinutes: input.estimateMinutes ?? null,
    });
    (input.checklist ?? []).forEach((text, i) => s.checklist.push({ id: uid("ck"), taskId: t.id, text, done: false, position: (i + 1) * 1000 }));
    return t;
  };

  const fmtDate = (d: string | null) => (d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "none");
  const describeChange = (key: keyof TaskPatch, from: unknown, to: unknown, s: S): string | null => {
    switch (key) {
      case "status":
        return `Status ${STATUS_META[from as Task["status"]].label} → ${STATUS_META[to as Task["status"]].label}`;
      case "priority":
        return `Priority ${PRIORITY_META[from as Task["priority"]].label} → ${PRIORITY_META[to as Task["priority"]].label}`;
      case "dueAt":
        return `Due ${fmtDate(from as string | null)} → ${fmtDate(to as string | null)}`;
      case "startAt":
        return `Start ${fmtDate(from as string | null)} → ${fmtDate(to as string | null)}`;
      case "estimateMinutes":
        return `Estimate ${from ? `${Number(from) / 60}h` : "none"} → ${to ? `${Number(to) / 60}h` : "none"}`;
      case "assigneeIds":
        return `Owners ${(from as string[]).map(first).join(", ") || "none"} → ${(to as string[]).map(first).join(", ") || "none"}`;
      case "title":
        return `Renamed "${from}" → "${to}"`;
      case "descriptionMd":
        return "Edited the description";
      case "category":
        return `Category ${from ?? "none"} → ${to ?? "none"}`;
      case "tags":
        return `Tags ${(to as string[]).join(", ") || "none"}`;
      case "listId":
        return `Moved to ${s.taskLists.find((l) => l.id === to)?.name ?? "another list"}`;
      case "linked":
        return to ? `Linked to a ${(to as { type: string }).type}` : "Removed the link";
      case "position":
        return null;
      case "recurrence":
        return `Repeats: ${recurrenceText(to as Task["recurrence"])}`;
      case "goalId":
        return to ? "Linked to a goal" : "Removed the goal";
      default:
        return null;
    }
  };

  const applyPatch = (s: S, user: User, t: Task, patch: TaskPatch) => {
    const changes: string[] = [];
    if (patch.status === "done" && t.status !== "done") {
      const open = s.tasks.filter((x) => x.parentId === t.id && !x.deletedAt && isOpen(x.status));
      if (open.length && !patch.completeSubtasks) throw new Error(`${open.length} open subtask${open.length > 1 ? "s" : ""}. Complete them too?`);
      for (const x of open) {
        Object.assign(x, { status: "done", completedAt: iso(), updatedAt: iso() });
        log(s, x.id, user.id, "Status → Done (with its parent)");
      }
    }
    if (patch.listId && patch.listId !== t.listId && !s.taskLists.some((l) => l.id === patch.listId)) throw new AccessError(404);
    if (patch.title !== undefined && !patch.title.trim()) throw new Error("A task needs a title.");
    if (patch.estimateMinutes !== undefined && patch.estimateMinutes !== null && (patch.estimateMinutes < 0 || !Number.isFinite(patch.estimateMinutes))) throw new Error("The estimate must be 0 or more.");
    const before = { ...t };
    for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
      if (key === "completeSubtasks") continue;
      const to = patch[key];
      const from = t[key as keyof Task];
      if (JSON.stringify(from) === JSON.stringify(to)) continue;
      (t as unknown as Record<string, unknown>)[key] = key === "title" ? String(to).trim() : to;
      const text = describeChange(key, from, to, s);
      if (text) changes.push(text);
    }
    if (patch.status && patch.status !== before.status) t.completedAt = patch.status === "done" ? iso() : null;
    if (patch.listId && patch.listId !== before.listId) for (const x of s.tasks.filter((x) => x.parentId === t.id)) x.listId = patch.listId;
    if (patch.assigneeIds) for (const a of patch.assigneeIds.filter((a) => !before.assigneeIds.includes(a))) inbox(s, a, t.id, "assigned", `${first(user.id)} assigned you · ${t.title}`, user.id);
    if (changes.length || patch.position !== undefined) t.updatedAt = iso();
    for (const c of changes) log(s, t.id, user.id, c);
    if (patch.status && patch.status !== before.status) {
      // Recurring: completing one creates the next occurrence.
      if (patch.status === "done" && t.recurrence && !t.parentId) {
        const base = t.dueAt ?? dateKey(now());
        const next = nextOccurrence(t.recurrence, base);
        const gap = t.startAt && t.dueAt ? Math.round((Date.parse(t.dueAt) - Date.parse(t.startAt)) / DAY) : null;
        const n = makeTask(s, {
          listId: t.listId, title: t.title, descriptionMd: t.descriptionMd, priority: t.priority, category: t.category, tags: t.tags, assigneeIds: t.assigneeIds,
          estimateMinutes: t.estimateMinutes, linked: t.linked, dueAt: next, startAt: gap !== null ? shiftDateKey(next, -gap) : null, recurrence: t.recurrence, goalId: t.goalId ?? null, createdBy: user.id,
        });
        s.checklist.filter((c) => c.taskId === t.id).forEach((c) => s.checklist.push({ id: uid("ck"), taskId: n.id, text: c.text, done: false, position: c.position }));
        log(s, t.id, user.id, `Repeats: next one due ${fmtDate(next)}`);
      }
      ctx.onEvent?.(s, { type: "task_status_changed", taskId: t.id, listId: t.listId, from: before.status, to: patch.status, priority: t.priority, category: t.category });
    }
    return changes;
  };

  // ---------------------------------------------------------------- seed

  const seedTasks = (s: S) => {
    if (s.spaces.length) return;
    seeding = true;
    for (const sp of DEFAULT_SPACES) s.spaces.push({ ...sp, id: `sp-${sp.name.toLowerCase().replace(/\W+/g, "-")}` });
    const d = (offset: number) => dateKey(now() + offset * DAY);
    const R = "u-rinor";
    const A = "u-cofounder";
    const B = "u-bdr";
    const L = "u-implementer";
    const mk = (spaceName: string, listName: string, rows: [string, string[], number | null, Task["priority"], number, string, Task["status"], { ai?: boolean; tags?: string[]; desc?: string }?][]) => {
      const list = listByName(s, spaceName, listName);
      return rows.map(([title, assigneeIds, due, priority, est, category, status, extra], i) =>
        makeTask(s, {
          listId: list.id, title, assigneeIds, dueAt: due === null ? null : d(due), priority, estimateMinutes: est ? Math.round(est * 60) : null, category, status,
          createdBy: R, createdByAi: extra?.ai, tags: extra?.tags, descriptionMd: extra?.desc, position: (i + 1) * 1000, createdAt: iso(now() - (10 - i) * DAY),
        }),
      );
    };
    // Company › Q4 launch (mockup Tasks.dc.html; today is Thu 1 Oct, week 40).
    const q4 = mk("Company", "Q4 launch", [
      ["Build the live Gllarix demo line", [R], 2, "high", 8, "Development", "in_progress", {
        desc: "A US phone number prospects can call during a sales meeting. It answers as a sample HVAC business, books into a test calendar and sends a missed-call text. The BDR uses it from day 1 of training, so it must be live before 12 Oct.",
      }],
      ["Post the BDR job and screen applicants", [A], 1, "high", 3, "Management", "in_progress"],
      ["Atlas M0 foundation (agent)", [R], 3, "high", 2, "Development", "in_progress", { tags: ["agent", "codex"] }],
      ["Approve price book v2 and pilot rule", [A, R], -1, "high", 1, "Finance", "todo"],
      ["Write the offer sheet and call script", [A], 1, "high", 3, "Sales", "todo"],
      ["Pull the first 500 US trades leads", [A], 3, "high", 4, "Lead gen", "todo"],
      ["Register US SMS for the demo number", [R], 2, "normal", 1, "Operations", "todo"],
      ["Measure real cost per minute (25 test calls)", [R], 10, "normal", 2, "Research", "todo", { ai: true }],
      ["Confirm country rules with a lawyer", [A], 17, "normal", 3, "Operations", "todo", { ai: true }],
      ["Research Dubai 3D pricing", [A], 15, "low", 2, "Research", "todo", { ai: true }],
      ["Update the context pack after this week", [R], 3, "low", 0.5, "Management", "review"],
      ["Sales team plan PDF", [R], -4, "high", 0, "Management", "done"],
      ["Price calculator v2 with minutes", [R], -3, "high", 0, "Finance", "done"],
      ["Atlas design mockups", [R], -3, "normal", 0, "Development", "done"],
    ]);
    mk("Company", "Q4 launch", [
      ["Atlas M1 data and import (agent)", [R], 10, "high", 2, "Development", "todo", { tags: ["agent", "codex"] }],
      ["Atlas M2 scoring and compliance (agent)", [R], 17, "high", 2, "Development", "todo", { tags: ["agent", "codex"] }],
      ["Atlas M3 queue and call workspace (agent)", [A], 24, "high", 2, "Development", "todo", { tags: ["agent", "codex"] }],
      ["Write the demo-line walkthrough for sales calls", [R], 9, "normal", 3.5, "Development", "todo"],
      ["BDR training (10 days)", [B], 22, "high", 55, "Sales", "todo"],
      ["BDR starts calling", [B], 25, "high", 0, "Sales", "todo", { tags: ["milestone"] }],
    ]).forEach((t, i) => {
      t.startAt = [d(4), d(11), d(18), null, d(11), null][i];
      t.position = 20_000 + i * 1000;
    });
    q4[2].acceptedBy = R;
    for (const t of q4.filter((x) => x.createdByAi)) t.acceptedBy = R;
    const demo = q4[0];
    demo.startAt = d(-5);
    const subRows: [string, number, boolean][] = [
      ["Choose the voice platform (Retell or Vapi)", 1, true],
      ["Buy a US number and connect it", 0.5, true],
      ["Write the receptionist prompt for a sample HVAC business", 1.5, false],
      ["Connect calendar booking", 1.5, false],
      ["Add missed-call text-back", 1, false],
      ["Run 10 test calls and fix issues", 2.5, false],
    ];
    subRows.forEach(([title, est, done], i) =>
      makeTask(s, { listId: demo.listId, parentId: demo.id, title, assigneeIds: [R], estimateMinutes: est * 60, status: done ? "done" : "todo", createdBy: R, position: (i + 1) * 1000, createdAt: iso(now() - 6 * DAY) }),
    );
    const bdrJob = q4[1];
    ["Write the job post", "Post on Upwork and LinkedIn", "Screen the first 20 applicants", "Book 5 interviews"].forEach((title, i) =>
      makeTask(s, { listId: bdrJob.listId, parentId: bdrJob.id, title, assigneeIds: [A], status: i === 0 ? "done" : "todo", createdBy: A, position: (i + 1) * 1000 }),
    );
    // BDR training waits on the demo line; the demo line waits on SMS registration.
    const training = mk("Sales", "BDR onboarding", [
      ["BDR training · day 1 (12 Oct)", [B, A], 11, "high", 4, "Sales", "todo"],
      ["Send demo line in outreach emails", [B], 12, "normal", 1, "Sales", "todo"],
      ["Role-play the call script with the co-founder", [B, A], 13, "normal", 2, "Sales", "todo"],
    ]);
    s.taskDeps.push({ id: uid("dp"), taskId: training[0].id, dependsOnId: demo.id }, { id: uid("dp"), taskId: training[1].id, dependsOnId: demo.id }, { id: uid("dp"), taskId: demo.id, dependsOnId: q4[6].id });
    mk("Sales", "Pipeline follow-ups", [
      ["Send the September proposals' follow-ups", [B], 0, "high", 1, "Sales", "todo"],
      ["Ask won clients for a referral", [B], 6, "normal", 1, "Sales", "todo"],
    ]);
    mk("Lead gen", "List building", [
      ["Check the Places API caps for October", [R], 2, "normal", 0.5, "Lead gen", "todo"],
      ["Get the DLD project list for Dubai developers", [A], 9, "normal", 2, "Lead gen", "todo"],
      ["Clean last week's wrong-number leads", [B], 1, "low", 1, "Lead gen", "in_progress"],
    ]);
    mk("Delivery", "Onboarding", [
      ["Write the onboarding intake form", [L], 4, "high", 2, "Delivery", "in_progress"],
      ["Prepare the agent prompt template from website FAQs", [L], 8, "normal", 3, "Delivery", "todo"],
    ]);
    mk("Company", "Atlas CRM build", [
      ["Review M7 billing (clients and usage)", [A], 5, "high", 2, "Development", "todo", { tags: ["review"] }],
      ["Apply the Supabase migrations m0–m9", [R], 10, "high", 1, "Development", "todo"],
    ]);
    mk("Company", "3D showcase", [["Pick the showcase project for Arcadian", [A], 20, "normal", 2, "Research", "todo"]]);
    mk("Finance", "Billing and admin", [["Open the Stripe account (test → live checklist)", [R], 10, "normal", 1, "Finance", "todo"]]);
    mk("Operations", "Compliance", [["TPS/CTPS screening provider for UK calls", [A], 14, "normal", 1, "Operations", "todo"]]);
    mk("Research", "Market research", [["Compare Retell and Vapi minute costs", [R], 9, "low", 2, "Research", "todo"]]);
    // Checklist, comments and time on the demo line (mockup TaskDetail.dc.html).
    ["Test number reachable from EU and US", "Booking lands in the test calendar", "Text-back arrives within 60 s"].forEach((text, i) => s.checklist.push({ id: uid("ck"), taskId: demo.id, text, done: i === 0, position: (i + 1) * 1000 }));
    s.taskComments.push(
      { id: uid("cm"), taskId: demo.id, userId: A, body: "Can it greet with the prospect's business name? That would be the strongest demo.", mentions: [], createdAt: iso(now() - 2 * DAY + 3600_000), editedAt: null, deletedAt: null },
      { id: uid("cm"), taskId: demo.id, userId: R, body: "Yes, as a follow-up task after the base line works. Added to the backlog.", mentions: [], createdAt: iso(now() - 2 * DAY + 12 * 3600_000), editedAt: null, deletedAt: null },
    );
    s.timeEntries.push(
      { id: uid("te"), taskId: demo.id, userId: R, startedAt: iso(now() - 3 * 3600_000), minutes: 75, source: "timer", note: null, category: "Development" },
      { id: uid("te"), taskId: demo.id, userId: R, startedAt: iso(now() - 1 * 3600_000), minutes: 45, source: "manual", note: "Number setup", category: "Development" },
    );
    seeding = false;
    // One unread mention so the Inbox shows how it works.
    s.taskComments.push({ id: uid("cm"), taskId: training[0].id, userId: A, body: "@Rinor can the demo line be ready for this? Diego starts on the 12th.", mentions: [R], createdAt: iso(now() - 3 * 3600_000), editedAt: null, deletedAt: null });
    s.taskInbox.push({ id: uid("ib"), userId: R, taskId: training[0].id, kind: "mention", text: `${first(A)} mentioned you · ${training[0].title}`, actorId: A, at: iso(now() - 3 * 3600_000), readAt: null });
  };

  // ---------------------------------------------------------------- API

  const api: TasksApi = {
    async tasksHome() {
      const user = await viewer();
      requireTasks(user);
      const s = await load();
      if (ctx.onTick?.(s)) await save();
      const visible = s.tasks.filter((t) => !t.deletedAt && !t.parentId && canSee(s, user, t));
      const spaces = s.spaces
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((space) => {
          const lists = s.taskLists
            .filter((l) => l.spaceId === space.id && !l.archivedAt)
            .sort((a, b) => a.position - b.position)
            .map((l) => ({ ...l, open: visible.filter((t) => t.listId === l.id && isOpen(t.status)).length }));
          return { space, lists, open: lists.reduce((n, l) => n + l.open, 0) };
        })
        .filter((x) => seesSpace(user, x.space) || x.open > 0)
        .map((x) => (seesSpace(user, x.space) ? x : { ...x, lists: x.lists.filter((l) => l.open > 0) }));
      const timer = s.timers.find((x) => x.userId === user.id) ?? null;
      return {
        spaces,
        myWork: s.tasks.filter((t) => !t.deletedAt && t.assigneeIds.includes(user.id) && isOpen(t.status)).length,
        inboxUnread: s.taskInbox.filter((i) => i.userId === user.id && !i.readAt).length,
        users: users.filter((u) => u.active && u.role !== "viewer").map((u) => ({ id: u.id, name: u.name, role: u.role })),
        timer: timer ? { ...timer, title: s.tasks.find((t) => t.id === timer.taskId)?.title ?? "" } : null,
        categories: [...new Set([...CATEGORIES, ...s.tasks.map((t) => t.category).filter(Boolean)])] as string[],
        notionImportedAt: s.notionImportedAt,
      };
    },

    async listTasks(q) {
      const user = await viewer();
      requireTasks(user);
      const s = await load();
      const lists = q.spaceId ? new Set(s.taskLists.filter((l) => l.spaceId === q.spaceId).map((l) => l.id)) : null;
      return s.tasks
        .filter((t) => !t.deletedAt && canSee(s, user, t))
        .filter((t) => (q.myWork ? t.assigneeIds.includes(user.id) : !t.parentId))
        .filter((t) => !q.listId || t.listId === q.listId)
        .filter((t) => !lists || lists.has(t.listId))
        .filter((t) => q.includeClosed !== false || isOpen(t.status))
        .map((t) => rowFor(s, t));
    },

    async getTask(id) {
      const user = await viewer();
      requireTasks(user);
      const s = await load();
      const t = getVisible(s, user, id);
      const list = s.taskLists.find((l) => l.id === t.listId)!;
      const parent = t.parentId ? s.tasks.find((x) => x.id === t.parentId) : null;
      const rowsOf = (ids: string[]) => ids.map((x) => s.tasks.find((y) => y.id === x && !y.deletedAt)).filter(Boolean).map((x) => rowFor(s, x!));
      const detail: TaskDetail = {
        task: t,
        list,
        space: s.spaces.find((x) => x.id === list.spaceId)!,
        parent: parent ? { id: parent.id, title: parent.title } : null,
        subtasks: s.tasks.filter((x) => x.parentId === t.id && !x.deletedAt).sort((a, b) => a.position - b.position).map((x) => rowFor(s, x)),
        checklist: s.checklist.filter((c) => c.taskId === t.id).sort((a, b) => a.position - b.position),
        comments: s.taskComments.filter((c) => c.taskId === t.id && !c.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((c) => ({ ...c, userName: nameOf(c.userId) ?? "—" })),
        attachments: s.taskAttachments.filter((a) => a.taskId === t.id),
        waitingOn: rowsOf(s.taskDeps.filter((d) => d.taskId === t.id).map((d) => d.dependsOnId)),
        blocks: rowsOf(s.taskDeps.filter((d) => d.dependsOnId === t.id).map((d) => d.taskId)),
        time: s.timeEntries.filter((e) => e.taskId === t.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map((e) => ({ ...e, userName: nameOf(e.userId) ?? "—" })),
        spentMinutes: s.timeEntries.filter((e) => e.taskId === t.id).reduce((n, e) => n + e.minutes, 0),
        timer: s.timers.find((x) => x.userId === user.id) ?? null,
        activity: s.taskActivity.filter((a) => a.taskId === t.id).sort((a, b) => b.at.localeCompare(a.at)).map((a) => ({ ...a, userName: nameOf(a.userId) })),
        linked: t.linked ? (() => {
          const l = ctx.describeLink(s, t.linked!.type, t.linked!.id);
          return l ? { ...t.linked!, ...l } : null;
        })() : null,
        createdByName: t.createdByAi ? "AI planner" : nameOf(t.createdBy),
        acceptedByName: nameOf(t.acceptedBy),
        assignees: t.assigneeIds.map((a) => ({ id: a, name: nameOf(a) ?? "—" })),
      };
      return detail;
    },

    async createTask(input) {
      const user = await viewer();
      requireTasks(user);
      const s = await load();
      const space = spaceOfList(s, input.listId);
      if (input.parentId) getVisible(s, user, input.parentId);
      else if (!seesSpace(user, space)) {
        // Outside their spaces people can still add tasks for themselves.
        if (!(input.assigneeIds ?? []).includes(user.id)) throw new AccessError(403, "You can only add tasks to your spaces, or assign them to yourself.");
      }
      const t = makeTask(s, { ...input, assigneeIds: input.assigneeIds ?? [user.id], createdBy: user.id });
      audit(user.id, "task.create", "task", t.id, null, { title: t.title, listId: t.listId });
      await save();
      return t;
    },

    async updateTask(id, patch) {
      const user = await viewer();
      requireTasks(user);
      const s = await load();
      const t = getVisible(s, user, id);
      const changes = applyPatch(s, user, t, patch);
      if (changes.length) audit(user.id, "task.update", "task", t.id, null, { changes });
      await save();
      return t;
    },

    async bulkUpdateTasks(ids, patch) {
      const user = await viewer();
      requireTasks(user);
      const s = await load();
      let n = 0;
      for (const id of ids) {
        const t = getVisible(s, user, id);
        if ("delete" in patch) {
          t.deletedAt = iso();
          log(s, t.id, user.id, "Moved to trash");
        } else applyPatch(s, user, t, { ...patch, completeSubtasks: true });
        n++;
      }
      audit(user.id, "task.bulk", "task", null, null, { ids, patch });
      await save();
      return n;
    },

    async deleteTask(id) {
      const user = await viewer();
      const s = await load();
      const t = getVisible(s, user, id);
      t.deletedAt = iso();
      for (const x of s.tasks.filter((x) => x.parentId === t.id)) x.deletedAt = t.deletedAt;
      log(s, t.id, user.id, `Moved to trash (kept ${TRASH_DAYS} days)`);
      audit(user.id, "task.delete", "task", t.id);
      await save();
    },

    async restoreTask(id) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403, "Only admins restore from the trash.");
      const s = await load();
      const t = s.tasks.find((x) => x.id === id);
      if (!t?.deletedAt) throw new AccessError(404);
      if (now() - new Date(t.deletedAt).getTime() > TRASH_DAYS * DAY) throw new Error("Deleted more than 30 days ago.");
      t.deletedAt = null;
      for (const x of s.tasks.filter((x) => x.parentId === t.id)) x.deletedAt = null;
      log(s, t.id, user.id, "Restored from trash");
      await save();
    },

    async addChecklistItem(taskId, text) {
      const user = await viewer();
      const s = await load();
      getVisible(s, user, taskId);
      if (!text.trim()) throw new Error("Write the item first.");
      s.checklist.push({ id: uid("ck"), taskId, text: text.trim(), done: false, position: Math.max(0, ...s.checklist.filter((c) => c.taskId === taskId).map((c) => c.position)) + 1000 });
      log(s, taskId, user.id, `Checklist: added "${text.trim()}"`);
      await save();
    },

    async updateChecklistItem(id, patch) {
      const user = await viewer();
      const s = await load();
      const item = s.checklist.find((c) => c.id === id);
      if (!item) throw new AccessError(404);
      getVisible(s, user, item.taskId);
      if (patch.done !== undefined && patch.done !== item.done) log(s, item.taskId, user.id, `Checklist: ${patch.done ? "ticked" : "unticked"} "${item.text}"`);
      Object.assign(item, patch.text !== undefined ? { text: patch.text.trim() || item.text } : {}, patch.done !== undefined ? { done: patch.done } : {});
      await save();
    },

    async deleteChecklistItem(id) {
      const user = await viewer();
      const s = await load();
      const item = s.checklist.find((c) => c.id === id);
      if (!item) return;
      getVisible(s, user, item.taskId);
      s.checklist = s.checklist.filter((c) => c.id !== id);
      log(s, item.taskId, user.id, `Checklist: removed "${item.text}"`);
      await save();
    },

    async addComment(taskId, body) {
      const user = await viewer();
      const s = await load();
      const t = getVisible(s, user, taskId);
      if (!body.trim()) throw new Error("Write a comment first.");
      const mentions = parseMentions(body, users.filter((u) => u.active));
      s.taskComments.push({ id: uid("cm"), taskId, userId: user.id, body: body.trim(), mentions, createdAt: iso(), editedAt: null, deletedAt: null });
      for (const m of mentions) inbox(s, m, taskId, "mention", `${first(user.id)} mentioned you · ${t.title}`, user.id);
      for (const a of new Set([...t.assigneeIds, ...(t.createdBy ? [t.createdBy] : [])])) {
        if (!mentions.includes(a)) inbox(s, a, taskId, "comment", `${first(user.id)} commented · ${t.title}`, user.id);
      }
      log(s, taskId, user.id, "Commented");
      await save();
    },

    async editComment(id, body) {
      const user = await viewer();
      const s = await load();
      const c = s.taskComments.find((x) => x.id === id && !x.deletedAt);
      if (!c) throw new AccessError(404);
      if (c.userId !== user.id) throw new AccessError(403, "You can edit only your own comments.");
      if (!body.trim()) throw new Error("A comment can't be empty.");
      Object.assign(c, { body: body.trim(), editedAt: iso(), mentions: parseMentions(body, users) });
      await save();
    },

    async deleteComment(id) {
      const user = await viewer();
      const s = await load();
      const c = s.taskComments.find((x) => x.id === id && !x.deletedAt);
      if (!c) return;
      if (c.userId !== user.id && user.role !== "admin") throw new AccessError(403);
      c.deletedAt = iso();
      log(s, c.taskId, user.id, "Deleted a comment");
      await save();
    },

    async addAttachment(taskId, file) {
      const user = await viewer();
      const s = await load();
      getVisible(s, user, taskId);
      if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Files up to 2 MB in demo mode (Supabase Storage takes larger ones).");
      s.taskAttachments.push({ id: uid("at"), taskId, userId: user.id, fileName: file.fileName, contentType: file.contentType, size: file.size, url: file.url, createdAt: iso() });
      log(s, taskId, user.id, `Attached ${file.fileName}`);
      await save();
    },

    async removeAttachment(id) {
      const user = await viewer();
      const s = await load();
      const a = s.taskAttachments.find((x) => x.id === id);
      if (!a) return;
      getVisible(s, user, a.taskId);
      if (a.userId !== user.id && user.role !== "admin") throw new AccessError(403);
      s.taskAttachments = s.taskAttachments.filter((x) => x.id !== id);
      log(s, a.taskId, user.id, `Removed ${a.fileName}`);
      await save();
    },

    async addDependency(taskId, dependsOnId) {
      const user = await viewer();
      const s = await load();
      const t = getVisible(s, user, taskId);
      const other = getVisible(s, user, dependsOnId);
      if (s.taskDeps.some((d) => d.taskId === taskId && d.dependsOnId === dependsOnId)) return;
      if (createsCycle(s.taskDeps, taskId, dependsOnId)) throw new Error(`That would make a loop: "${other.title}" already waits on "${t.title}".`);
      s.taskDeps.push({ id: uid("dp"), taskId, dependsOnId });
      log(s, taskId, user.id, `Waiting on "${other.title}"`);
      log(s, dependsOnId, user.id, `Blocks "${t.title}"`);
      await save();
    },

    async removeDependency(id) {
      const user = await viewer();
      const s = await load();
      const d = s.taskDeps.find((x) => x.id === id);
      if (!d) return;
      getVisible(s, user, d.taskId);
      s.taskDeps = s.taskDeps.filter((x) => x.id !== id);
      log(s, d.taskId, user.id, "Removed a dependency");
      await save();
    },

    async startTimer(taskId) {
      const user = await viewer();
      const s = await load();
      getVisible(s, user, taskId);
      const running = s.timers.find((x) => x.userId === user.id);
      if (running?.taskId === taskId) return running;
      if (running) stop(s, user);
      const timer = { userId: user.id, taskId, startedAt: iso() };
      s.timers.push(timer);
      await save();
      return timer;
    },

    async stopTimer() {
      const user = await viewer();
      const s = await load();
      const e = stop(s, user);
      await save();
      return e;
    },

    async addTimeEntry(taskId, entry) {
      const user = await viewer();
      const s = await load();
      getVisible(s, user, taskId);
      if (!(entry.minutes > 0) || entry.minutes > 24 * 60) throw new Error("Enter between 1 minute and 24 hours.");
      const startedAt = new Date(`${entry.date}T09:00:00Z`).toISOString();
      if (ctx.isWeekLocked?.(s, user.id, startedAt)) throw new Error("That week is submitted. Ask an admin to reopen it before logging more time.");
      s.timeEntries.push({ id: uid("te"), taskId, userId: user.id, startedAt, minutes: Math.round(entry.minutes), source: "manual", note: entry.note?.trim() || null, category: s.tasks.find((t) => t.id === taskId)?.category ?? null, billable: false });
      log(s, taskId, user.id, `Logged ${Math.round((entry.minutes / 60) * 10) / 10}h`);
      await save();
    },

    async deleteTimeEntry(id) {
      const user = await viewer();
      const s = await load();
      const e = s.timeEntries.find((x) => x.id === id);
      if (!e) return;
      if (e.userId !== user.id && user.role !== "admin") throw new AccessError(403);
      if (ctx.isWeekLocked?.(s, e.userId, e.startedAt)) throw new Error("That week is submitted. Ask an admin to reopen it first.");
      s.timeEntries = s.timeEntries.filter((x) => x.id !== id);
      if (e.taskId) log(s, e.taskId, user.id, `Removed ${e.minutes} min of time`);
      await save();
    },

    async taskInbox() {
      const user = await viewer();
      requireTasks(user);
      const s = await load();
      return s.taskInbox
        .filter((i) => i.userId === user.id)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 200)
        .map((i) => ({ ...i, taskTitle: s.tasks.find((t) => t.id === i.taskId)?.title ?? "(deleted)", actorName: nameOf(i.actorId) }));
    },

    async markInboxRead(ids) {
      const user = await viewer();
      const s = await load();
      for (const i of s.taskInbox) if (i.userId === user.id && !i.readAt && (ids === "all" || ids.includes(i.id))) i.readAt = iso();
      await save();
    },

    async listSavedViews(listId) {
      const user = await viewer();
      const s = await load();
      return s.savedViews.filter((v) => v.userId === user.id && v.listId === listId);
    },

    async saveView(input) {
      const user = await viewer();
      const s = await load();
      if (!input.name.trim()) throw new Error("Name the view.");
      const view: SavedView = { id: uid("sv"), userId: user.id, listId: input.listId, name: input.name.trim(), config: input.config, createdAt: iso() };
      s.savedViews = [...s.savedViews.filter((v) => !(v.userId === user.id && v.listId === input.listId && v.name === view.name)), view];
      await save();
      return view;
    },

    async deleteSavedView(id) {
      const user = await viewer();
      const s = await load();
      s.savedViews = s.savedViews.filter((v) => !(v.id === id && v.userId === user.id));
      await save();
    },

    async createList(spaceId, name) {
      const user = await viewer();
      const s = await load();
      const space = s.spaces.find((x) => x.id === spaceId);
      if (!seesSpace(user, space)) throw new AccessError(403);
      if (!name.trim()) throw new Error("Name the list.");
      const list: TaskList = { id: uid("tl"), spaceId, name: name.trim(), statuses: [...DEFAULT_STATUSES], defaultView: "list", position: s.taskLists.filter((l) => l.spaceId === spaceId).length, archivedAt: null };
      s.taskLists.push(list);
      audit(user.id, "list.create", "list", list.id, null, { name: list.name });
      await save();
      return list;
    },

    async renameList(id, name) {
      const user = await viewer();
      const s = await load();
      const list = s.taskLists.find((l) => l.id === id);
      if (!list) throw new AccessError(404);
      if (!seesSpace(user, s.spaces.find((x) => x.id === list.spaceId))) throw new AccessError(403);
      if (!name.trim()) throw new Error("Name the list.");
      list.name = name.trim();
      await save();
    },

    async archiveList(id) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      const s = await load();
      const list = s.taskLists.find((l) => l.id === id);
      if (!list) throw new AccessError(404);
      list.archivedAt = iso();
      await save();
    },

    async searchTasks(q) {
      const user = await viewer();
      if (user.role === "viewer") return [];
      const s = await load();
      const needle = q.trim().toLowerCase();
      if (needle.length < 2) return [];
      return s.tasks
        .filter((t) => !t.deletedAt && canSee(s, user, t) && t.title.toLowerCase().includes(needle))
        .sort((a, b) => Number(isOpen(b.status)) - Number(isOpen(a.status)) || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6)
        .map((t) => rowFor(s, t));
    },

    async tasksFor(type, id) {
      const user = await viewer();
      if (user.role === "viewer") return [];
      const s = await load();
      const targets = [{ type, id }, ...(type === "lead" ? ctx.relatedToLead(s, id) : [])];
      return s.tasks
        .filter((t) => !t.deletedAt && t.linked && targets.some((x) => x.type === t.linked!.type && x.id === t.linked!.id) && canSee(s, user, t))
        .sort((a, b) => Number(isOpen(b.status)) - Number(isOpen(a.status)) || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"))
        .map((t) => rowFor(s, t));
    },

    async importNotionTasks(rows, opts = {}) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      const s = await load();
      if (s.notionImportedAt && !opts.again) throw new Error(`The Notion tasks were already imported on ${s.notionImportedAt.slice(0, 10)}. Import again only if you mean to.`);
      const lists = new Set<string>();
      let created = 0;
      for (const r of rows) {
        if (!r.title.trim()) continue;
        const list = listByName(s, r.spaceName, "Imported from Notion");
        lists.add(`${r.spaceName} / ${list.name}`);
        makeTask(s, {
          listId: list.id, title: r.title, status: r.status, priority: r.priority, dueAt: r.dueAt, assigneeIds: r.assigneeIds, category: r.category,
          descriptionMd: r.notes, createdBy: user.id, importedFrom: "Notion",
        });
        created++;
      }
      s.notionImportedAt = iso();
      audit(user.id, "tasks.import_notion", "task", null, null, { created });
      await save();
      return { created, lists: [...lists] };
    },
  };

  const stop = (s: S, user: User) => {
    const running = s.timers.find((x) => x.userId === user.id);
    if (!running) return null;
    s.timers = s.timers.filter((x) => x.userId !== user.id);
    const minutes = Math.max(1, Math.round((now() - new Date(running.startedAt).getTime()) / 60_000));
    if (ctx.isWeekLocked?.(s, user.id, running.startedAt)) throw new Error("That week is submitted. Ask an admin to reopen it before logging more time.");
    const task = running.taskId ? s.tasks.find((t) => t.id === running.taskId) : undefined;
    const entry: TimeEntry = {
      id: uid("te"), taskId: running.taskId, userId: user.id, startedAt: running.startedAt, minutes, source: "timer", note: null, endedAt: iso(),
      category: running.category ?? task?.category ?? null, linked: running.linked ?? null, billable: false,
    };
    s.timeEntries.push(entry);
    if (running.taskId) log(s, running.taskId, user.id, `Timer: ${minutes} min`);
    return entry;
  };

  /** Mark a task done from another module (e.g. the client panel's Done button). */
  const completeTask = (s: S, id: string, userId: string) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t || t.status === "done") return;
    log(s, t.id, userId, `Status ${STATUS_META[t.status].label} → Done`);
    Object.assign(t, { status: "done", completedAt: iso(), updatedAt: iso() });
  };

  /** For the capacity module: apply a change as a person (activity log included) and add a task. */
  const patchTask = (s: S, user: User, id: string, patch: TaskPatch) => {
    const t = getVisible(s, user, id);
    applyPatch(s, user, t, patch);
  };
  const addTaskAs = (s: S, user: User, input: NewTask) => makeTask(s, { ...input, createdBy: user.id });

  /** Internal dependency (plans, templates): no permission check, cycles still refused. */
  const addDep = (s: S, taskId: string, dependsOnId: string) => {
    if (s.taskDeps.some((d) => d.taskId === taskId && d.dependsOnId === dependsOnId) || createsCycle(s.taskDeps, taskId, dependsOnId)) return;
    s.taskDeps.push({ id: uid("dp"), taskId, dependsOnId });
  };
  const addAiTask = (s: S, user: User, input: NewTask & { tags?: string[]; planId: string }) => makeTask(s, { ...input, createdBy: user.id, createdByAi: true, acceptedBy: user.id });
  const systemPatch = (s: S, id: string, patch: Partial<Task>, text: string) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch, { updatedAt: iso() });
    log(s, id, null, text);
  };

  /** Seed helper (M13): a finished task, silently (no events or inbox items). */
  const seedDoneTask = (s: S, input: { spaceName: string; listName: string; title: string; assigneeIds: string[]; category: string; estimateMinutes: number; doneAt: string }) => {
    seeding = true;
    try {
      const list = listByName(s, input.spaceName, input.listName);
      const t = makeTask(s, { listId: list.id, title: input.title, assigneeIds: input.assigneeIds, category: input.category, estimateMinutes: input.estimateMinutes, status: "done", createdBy: input.assigneeIds[0] ?? null, createdAt: input.doneAt });
      t.completedAt = input.doneAt;
      return t;
    } finally {
      seeding = false;
    }
  };

  /** AI co-founder (M14): a proposed task a person accepted, in Company › AI co-founder. */
  const addAdvisorTask = (s: S, user: User, input: { title: string; ownerId: string | null; hours: number; due: string }) => {
    const list = listByName(s, "Company", "AI co-founder");
    return makeTask(s, {
      listId: list.id, title: input.title, assigneeIds: input.ownerId ? [input.ownerId] : [], estimateMinutes: Math.round(input.hours * 60), dueAt: `${input.due}T17:00:00.000Z`,
      createdBy: user.id, createdByAi: true, acceptedBy: user.id, tags: ["ai-cofounder"],
    });
  };

  return { api, seedTasks, seedDoneTask, addAdvisorTask, addSystemTask, completeTask, canSee, patchTask, addTaskAs, addDep, addAiTask, systemPatch, inbox };
};
