import type { Recurrence } from "@/services/automations";
import type { Role } from "./types";

/** Tasks module (CRM_BUILD_PROMPT A15, screens 15–17). Dates without time are "YYYY-MM-DD". */

export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked" | "cancelled";
export type TaskPriority = "urgent" | "high" | "normal" | "low";
export type LinkType = "lead" | "deal" | "client" | "meeting";

export interface Space {
  id: string;
  name: string;
  /** Token color for the square: ice · cyan · mint · amber · lavender · text-3. */
  color: "ice" | "cyan" | "mint" | "amber" | "lavender" | "text-3";
  position: number;
  /** Roles besides admin that see every task in this space (others see only tasks assigned to them). */
  roles: Role[];
}

export interface TaskList {
  id: string;
  spaceId: string;
  name: string;
  statuses: TaskStatus[];
  defaultView: "list" | "board";
  position: number;
  archivedAt: string | null;
}

export interface Task {
  id: string;
  listId: string;
  /** Subtasks are one level deep. */
  parentId: string | null;
  title: string;
  descriptionMd: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  tags: string[];
  assigneeIds: string[];
  startAt: string | null;
  dueAt: string | null;
  estimateMinutes: number | null;
  position: number;
  linked: { type: LinkType; id: string } | null;
  createdBy: string | null;
  createdByAi: boolean;
  acceptedBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  /** Where it came from when imported ("notion"). */
  importedFrom: string | null;
  /** Completing a recurring task creates the next one. */
  recurrence?: Recurrence | null;
  /** The AI plan that created it. */
  planId?: string | null;
  goalId?: string | null;
}

/** taskId waits on dependsOnId (dependsOnId blocks taskId). */
export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnId: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  position: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  mentions: string[];
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  userId: string;
  fileName: string;
  contentType: string;
  size: number;
  /** Demo mode keeps small files inline; Supabase mode stores a Storage path. */
  url: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  /** The task, or null for time on a client, project, lead or deal (M13). */
  taskId: string | null;
  userId: string;
  startedAt: string;
  minutes: number;
  source: "timer" | "manual";
  note: string | null;
  endedAt?: string | null;
  category?: string | null;
  linked?: import("./timeTypes").TimeLink | null;
  billable?: boolean;
  rateMinor?: number | null;
  currency?: "USD" | "EUR" | null;
}

export interface RunningTimer {
  userId: string;
  /** null when the timer runs on a client, project, lead or deal. */
  taskId: string | null;
  startedAt: string;
  linked?: import("./timeTypes").TimeLink | null;
  category?: string | null;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string | null;
  at: string;
  text: string;
}

export interface InboxItem {
  id: string;
  userId: string;
  taskId: string;
  kind: "mention" | "assigned" | "comment";
  text: string;
  actorId: string | null;
  at: string;
  readAt: string | null;
}

export type GroupBy = "status" | "owner" | "priority" | "category" | "due_week" | "none";
export type SortBy = "manual" | "due" | "priority" | "created";

export interface TaskFilters {
  owners: string[];
  priorities: TaskPriority[];
  categories: string[];
  tags: string[];
  dueFrom: string | null;
  dueTo: string | null;
  ai: boolean | null;
  hasDeps: boolean | null;
  q: string;
}

export interface ViewConfig {
  groupBy: GroupBy;
  sort: SortBy;
  filters: TaskFilters;
}

export interface SavedView {
  id: string;
  userId: string;
  /** null = My work. */
  listId: string | null;
  name: string;
  config: ViewConfig;
  createdAt: string;
}

/** A task as the list and board show it. */
export interface TaskRow {
  task: Task;
  listName: string;
  spaceName: string;
  assignees: { id: string; name: string }[];
  subtasks: { done: number; total: number };
  spentMinutes: number;
  hasDeps: boolean;
  waitingOnOpen: number;
}

export interface SpaceTree {
  space: Space;
  lists: (TaskList & { open: number })[];
  open: number;
}

export interface TasksHome {
  spaces: SpaceTree[];
  myWork: number;
  inboxUnread: number;
  users: { id: string; name: string; role: Role }[];
  timer: (RunningTimer & { title: string }) | null;
  categories: string[];
  notionImportedAt: string | null;
}

export interface TaskDetail {
  task: Task;
  list: TaskList;
  space: Space;
  parent: { id: string; title: string } | null;
  subtasks: TaskRow[];
  checklist: ChecklistItem[];
  comments: (TaskComment & { userName: string })[];
  attachments: TaskAttachment[];
  waitingOn: TaskRow[];
  blocks: TaskRow[];
  time: (TimeEntry & { userName: string })[];
  spentMinutes: number;
  timer: RunningTimer | null;
  activity: (TaskActivity & { userName: string | null })[];
  linked: { type: LinkType; id: string; label: string; href: string } | null;
  createdByName: string | null;
  acceptedByName: string | null;
  assignees: { id: string; name: string }[];
}

export interface TaskQuery {
  listId?: string;
  spaceId?: string;
  myWork?: boolean;
  /** Include done and cancelled (lists show them collapsed). */
  includeClosed?: boolean;
}

export interface NewTask {
  listId: string;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  parentId?: string | null;
  assigneeIds?: string[];
  dueAt?: string | null;
  estimateMinutes?: number | null;
  category?: string | null;
  linked?: Task["linked"];
  descriptionMd?: string;
  position?: number;
  startAt?: string | null;
  recurrence?: Recurrence | null;
  goalId?: string | null;
}

export type TaskPatch = Partial<
  Pick<Task, "title" | "descriptionMd" | "status" | "priority" | "category" | "tags" | "assigneeIds" | "startAt" | "dueAt" | "estimateMinutes" | "position" | "listId" | "linked" | "recurrence" | "goalId">
> & { completeSubtasks?: boolean };

export interface NotionRow {
  title: string;
  status: TaskStatus;
  dueAt: string | null;
  priority: TaskPriority;
  assigneeIds: string[];
  category: string | null;
  spaceName: string;
  notes: string;
  warnings: string[];
}

export interface TasksApi {
  tasksHome(): Promise<TasksHome>;
  listTasks(q: TaskQuery): Promise<TaskRow[]>;
  getTask(id: string): Promise<TaskDetail>;
  createTask(input: NewTask): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  bulkUpdateTasks(ids: string[], patch: TaskPatch | { delete: true }): Promise<number>;
  deleteTask(id: string): Promise<void>;
  restoreTask(id: string): Promise<void>;
  addChecklistItem(taskId: string, text: string): Promise<void>;
  updateChecklistItem(id: string, patch: { text?: string; done?: boolean }): Promise<void>;
  deleteChecklistItem(id: string): Promise<void>;
  addComment(taskId: string, body: string): Promise<void>;
  editComment(id: string, body: string): Promise<void>;
  deleteComment(id: string): Promise<void>;
  addAttachment(taskId: string, file: { fileName: string; contentType: string; size: number; url: string }): Promise<void>;
  removeAttachment(id: string): Promise<void>;
  /** Rejects a dependency that would create a cycle. */
  addDependency(taskId: string, dependsOnId: string): Promise<void>;
  removeDependency(id: string): Promise<void>;
  startTimer(taskId: string): Promise<RunningTimer>;
  stopTimer(): Promise<TimeEntry | null>;
  addTimeEntry(taskId: string, entry: { minutes: number; date: string; note?: string }): Promise<void>;
  deleteTimeEntry(id: string): Promise<void>;
  taskInbox(): Promise<(InboxItem & { taskTitle: string; actorName: string | null })[]>;
  markInboxRead(ids: string[] | "all"): Promise<void>;
  listSavedViews(listId: string | null): Promise<SavedView[]>;
  saveView(input: { listId: string | null; name: string; config: ViewConfig }): Promise<SavedView>;
  deleteSavedView(id: string): Promise<void>;
  createList(spaceId: string, name: string): Promise<TaskList>;
  renameList(id: string, name: string): Promise<void>;
  archiveList(id: string): Promise<void>;
  searchTasks(q: string): Promise<TaskRow[]>;
  /** Tasks linked to a CRM record (a lead also shows its deals', meetings' and client's tasks). */
  tasksFor(type: LinkType, id: string): Promise<TaskRow[]>;
  /** One-time Notion import; refuses a second run unless `again` is set. */
  importNotionTasks(rows: NotionRow[], opts?: { again?: boolean }): Promise<{ created: number; lists: string[] }>;
}
