import { CATEGORIES, NOTION_CATEGORY_SPACE, PRIORITY_META, STATUS_META, STATUS_ORDER } from "@/config/tasks";
import type { GroupBy, NotionRow, SortBy, TaskDependency, TaskFilters, TaskPriority, TaskRow, TaskStatus } from "@/data/taskTypes";

/** Pure task logic: grouping, sorting, filters, My work buckets, dependencies, mentions, positions, Notion mapping. */

export const EMPTY_FILTERS: TaskFilters = { owners: [], priorities: [], categories: [], tags: [], dueFrom: null, dueTo: null, ai: null, hasDeps: null, q: "" };

export const isOpen = (s: TaskStatus) => s !== "done" && s !== "cancelled";

/** Clicking the status box cycles To do → In progress → Review → Done → To do. */
export const nextStatus = (s: TaskStatus): TaskStatus => ({ todo: "in_progress", in_progress: "review", review: "done", done: "todo", blocked: "in_progress", cancelled: "todo" })[s] as TaskStatus;

const DAY = 86_400_000;
export const dateKey = (t: number | Date) => new Date(t).toISOString().slice(0, 10);
const mondayOf = (key: string) => {
  const d = new Date(`${key}T00:00:00Z`);
  return dateKey(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
};

export const filterTasks = (rows: TaskRow[], f: TaskFilters) => {
  const q = f.q.trim().toLowerCase();
  return rows.filter(({ task: t, hasDeps }) => {
    if (f.owners.length && !f.owners.some((o) => (o === "none" ? !t.assigneeIds.length : t.assigneeIds.includes(o)))) return false;
    if (f.priorities.length && !f.priorities.includes(t.priority)) return false;
    if (f.categories.length && !f.categories.includes(t.category ?? "")) return false;
    if (f.tags.length && !f.tags.some((x) => t.tags.includes(x))) return false;
    if (f.dueFrom && (!t.dueAt || t.dueAt < f.dueFrom)) return false;
    if (f.dueTo && (!t.dueAt || t.dueAt > f.dueTo)) return false;
    if (f.ai !== null && t.createdByAi !== f.ai) return false;
    if (f.hasDeps !== null && hasDeps !== f.hasDeps) return false;
    if (q && !`${t.title} ${t.descriptionMd} ${t.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    return true;
  });
};

export const sortTasks = (rows: TaskRow[], by: SortBy) => {
  const cmp: Record<SortBy, (a: TaskRow, b: TaskRow) => number> = {
    manual: (a, b) => a.task.position - b.task.position,
    due: (a, b) => (a.task.dueAt ?? "9999").localeCompare(b.task.dueAt ?? "9999") || PRIORITY_META[a.task.priority].rank - PRIORITY_META[b.task.priority].rank,
    priority: (a, b) => PRIORITY_META[a.task.priority].rank - PRIORITY_META[b.task.priority].rank || (a.task.dueAt ?? "9999").localeCompare(b.task.dueAt ?? "9999"),
    created: (a, b) => b.task.createdAt.localeCompare(a.task.createdAt),
  };
  return [...rows].sort(cmp[by]);
};

export interface TaskGroup {
  key: string;
  label: string;
  /** Tailwind text color class for the header and square. */
  tone: string;
  rows: TaskRow[];
  /** For inline add: the status (status grouping) the new task gets. */
  status?: TaskStatus;
}

export const groupTasks = (rows: TaskRow[], by: GroupBy, users: { id: string; name: string }[], today: string): TaskGroup[] => {
  if (by === "none") return [{ key: "all", label: "ALL TASKS", tone: "text-text", rows }];
  if (by === "status") {
    return STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label.toUpperCase(), tone: STATUS_META[s].text, rows: rows.filter((r) => r.task.status === s), status: s })).filter(
      (g) => g.rows.length || g.key === "todo" || g.key === "in_progress",
    );
  }
  if (by === "priority") {
    return (Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => ({ key: p, label: PRIORITY_META[p].label.toUpperCase(), tone: PRIORITY_META[p].text, rows: rows.filter((r) => r.task.priority === p) })).filter((g) => g.rows.length);
  }
  if (by === "owner") {
    const groups: TaskGroup[] = users.map((u) => ({ key: u.id, label: u.name.toUpperCase(), tone: "text-text", rows: rows.filter((r) => r.task.assigneeIds.includes(u.id)) }));
    groups.push({ key: "none", label: "UNASSIGNED", tone: "text-text-3", rows: rows.filter((r) => !r.task.assigneeIds.length) });
    return groups.filter((g) => g.rows.length);
  }
  if (by === "category") {
    const cats = [...new Set([...CATEGORIES, ...rows.map((r) => r.task.category ?? "")])];
    return cats.map((c) => ({ key: c || "none", label: (c || "No category").toUpperCase(), tone: "text-text", rows: rows.filter((r) => (r.task.category ?? "") === c) })).filter((g) => g.rows.length);
  }
  // Due week: overdue, this week, next weeks by Monday, no date.
  const thisWeek = mondayOf(today);
  const buckets = new Map<string, TaskRow[]>();
  for (const r of rows) {
    const k = !r.task.dueAt ? "none" : r.task.dueAt < today && isOpen(r.task.status) ? "overdue" : mondayOf(r.task.dueAt) < thisWeek ? "earlier" : mondayOf(r.task.dueAt);
    buckets.set(k, [...(buckets.get(k) ?? []), r]);
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    const rank = (k: string) => (k === "overdue" ? "0" : k === "earlier" ? "1" : k === "none" ? "z" : `2${k}`);
    return rank(a).localeCompare(rank(b));
  });
  return keys.map((k) => ({
    key: k,
    label: k === "overdue" ? "OVERDUE" : k === "earlier" ? "EARLIER" : k === "none" ? "NO DATE" : k === thisWeek ? "THIS WEEK" : `WEEK OF ${k.slice(8)}/${k.slice(5, 7)}`,
    tone: k === "overdue" ? "text-coral" : "text-text",
    rows: buckets.get(k)!,
  }));
};

/** My work: Overdue · Today · This week · Later · No date (open tasks). */
export const myWorkGroups = (rows: TaskRow[], today: string): TaskGroup[] => {
  const weekEnd = dateKey(new Date(`${mondayOf(today)}T00:00:00Z`).getTime() + 6 * DAY);
  const open = rows.filter((r) => isOpen(r.task.status));
  const pick = (f: (d: string | null) => boolean) => sortTasks(open.filter((r) => f(r.task.dueAt)), "due");
  return [
    { key: "overdue", label: "OVERDUE", tone: "text-coral", rows: pick((d) => !!d && d < today) },
    { key: "today", label: "TODAY", tone: "text-cyan", rows: pick((d) => d === today) },
    { key: "week", label: "THIS WEEK", tone: "text-text", rows: pick((d) => !!d && d > today && d <= weekEnd) },
    { key: "later", label: "LATER", tone: "text-text-2", rows: pick((d) => !!d && d > weekEnd) },
    { key: "none", label: "NO DATE", tone: "text-text-3", rows: pick((d) => !d) },
  ];
};

/** "11 open · 29.5 h estimated · most due before 12 Oct" (80% of open dated tasks are due by that date). */
export const listSummary = (rows: TaskRow[]) => {
  const open = rows.filter((r) => isOpen(r.task.status) && !r.task.parentId);
  const minutes = open.reduce((n, r) => n + (r.task.estimateMinutes ?? 0), 0);
  const dues = open.map((r) => r.task.dueAt).filter(Boolean).sort() as string[];
  const p80 = dues.length ? dues[Math.min(dues.length - 1, Math.ceil(dues.length * 0.8) - 1)] : null;
  return { open: open.length, hours: Math.round((minutes / 60) * 10) / 10, mostDueBy: p80 };
};

export const hours = (minutes: number | null | undefined) => (minutes ? `${Math.round((minutes / 60) * 10) / 10}h` : "—");

/** Would "taskId waits on dependsOnId" close a loop? (Also rejects a task waiting on itself.) */
export const createsCycle = (deps: Pick<TaskDependency, "taskId" | "dependsOnId">[], taskId: string, dependsOnId: string) => {
  if (taskId === dependsOnId) return true;
  // A cycle exists if taskId is reachable from dependsOnId by following "waits on" edges.
  const next = new Map<string, string[]>();
  for (const d of deps) next.set(d.taskId, [...(next.get(d.taskId) ?? []), d.dependsOnId]);
  const seen = new Set<string>();
  const stack = [dependsOnId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(next.get(cur) ?? []));
  }
  return false;
};

/** @mentions by first name or full name ("@Rinor", "@Diego Marín"), case-insensitive. */
export const parseMentions = (body: string, users: { id: string; name: string }[]) => {
  const out = new Set<string>();
  const text = body.toLowerCase();
  for (const u of users) {
    const full = u.name.toLowerCase();
    const first = full.split(" ")[0];
    const re = (s: string) => new RegExp(`(^|\\s)@${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");
    if (re(full).test(text) || re(first).test(text)) out.add(u.id);
  }
  return [...out];
};

/** A position between two neighbours (fractional ordering; no renumbering needed). */
export const positionBetween = (before: number | null, after: number | null) =>
  before === null && after === null ? 1000 : before === null ? after! - 1000 : after === null ? before + 1000 : (before + after) / 2;

// ---------------------------------------------------------------- Notion import

const NOTION_STATUS: [RegExp, TaskStatus][] = [
  [/^(done|complete|completed|finished)$/i, "done"],
  [/^(in progress|doing|started|in review|review)$/i, "in_progress"],
  [/^(blocked|waiting)$/i, "blocked"],
  [/^(cancel+ed|archived|won'?t do)$/i, "cancelled"],
];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Notion exports dates as "September 30, 2026", ISO or day/month/year; date ranges keep the end date. */
export const parseNotionDate = (raw: string): string | null => {
  const v = raw.trim().split(/\s+→\s+/).pop()!.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (m) {
    const mi = MONTHS.findIndex((x) => x.startsWith(m![1].toLowerCase().slice(0, 3)));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};

export const parseNotionPriority = (raw: string): TaskPriority => {
  const v = raw.trim().toLowerCase();
  if (v === "hight" || v === "high") return "high"; // Notion had the typo "Hight"
  if (v === "urgent" || v === "critical") return "urgent";
  if (v === "low") return "low";
  return "normal";
};

/** Map a Notion "✅ Tasks" CSV row (Tasks, Status, Deadline, Priority, Person, Category, Notes). */
export const mapNotionRow = (raw: Record<string, string>, users: { id: string; name: string }[]): NotionRow => {
  const get = (...keys: string[]) => {
    const k = Object.keys(raw).find((h) => keys.some((x) => h.trim().toLowerCase().replace(/^\W+/, "") === x));
    return k ? (raw[k] ?? "").trim() : "";
  };
  const warnings: string[] = [];
  const title = get("tasks", "task", "name", "title");
  if (!title) warnings.push("No task title");
  const statusRaw = get("status");
  const status = NOTION_STATUS.find(([re]) => re.test(statusRaw))?.[1] ?? "todo";
  const deadline = get("deadline", "due", "due date");
  const dueAt = deadline ? parseNotionDate(deadline) : null;
  if (deadline && !dueAt) warnings.push(`Couldn't read the deadline "${deadline}"`);
  const people = get("person", "assignee", "owner")
    .split(/,|&|\band\b/)
    .map((p) => p.trim())
    .filter(Boolean);
  const assigneeIds: string[] = [];
  for (const p of people) {
    const lower = p.toLowerCase();
    const u = users.find((x) => x.name.toLowerCase() === lower || x.name.toLowerCase().split(" ")[0] === lower.split(" ")[0]);
    if (u) assigneeIds.push(u.id);
    else warnings.push(`No Atlas user called "${p}"`);
  }
  const catRaw = get("category");
  const cat = CATEGORIES.find((c) => c.toLowerCase() === catRaw.toLowerCase()) ?? (catRaw || null);
  return {
    title,
    status,
    dueAt,
    priority: parseNotionPriority(get("priority")),
    assigneeIds: [...new Set(assigneeIds)],
    category: cat,
    spaceName: NOTION_CATEGORY_SPACE[catRaw.toLowerCase()] ?? "Company",
    notes: get("notes", "description"),
    warnings,
  };
};
