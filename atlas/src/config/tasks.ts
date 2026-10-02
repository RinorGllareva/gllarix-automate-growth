import type { Space, TaskPriority, TaskStatus } from "@/data/taskTypes";

/** Tasks configuration (CRM_BUILD_PROMPT A15). */

export const DEFAULT_STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done", "blocked", "cancelled"];

export const STATUS_META: Record<TaskStatus, { label: string; text: string; bg: string; border: string }> = {
  in_progress: { label: "In progress", text: "text-blue", bg: "bg-blue", border: "border-blue" },
  todo: { label: "To do", text: "text-text-2", bg: "bg-text-3", border: "border-text-3" },
  review: { label: "Review", text: "text-lavender", bg: "bg-lavender", border: "border-lavender" },
  blocked: { label: "Blocked", text: "text-coral", bg: "bg-coral", border: "border-coral" },
  done: { label: "Done", text: "text-mint", bg: "bg-mint", border: "border-mint" },
  cancelled: { label: "Cancelled", text: "text-text-3", bg: "bg-text-3", border: "border-text-3" },
};

/** Group order in the list view; Done and Cancelled start collapsed. */
export const STATUS_ORDER: TaskStatus[] = ["in_progress", "todo", "review", "blocked", "done", "cancelled"];
export const COLLAPSED_BY_DEFAULT: TaskStatus[] = ["done", "cancelled"];
/** Board columns (Blocked shows only when used). */
export const BOARD_STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];

export const PRIORITY_META: Record<TaskPriority, { label: string; text: string; rank: number }> = {
  urgent: { label: "Urgent", text: "text-coral", rank: 0 },
  high: { label: "High", text: "text-orange", rank: 1 },
  normal: { label: "Normal", text: "text-blue", rank: 2 },
  low: { label: "Low", text: "text-text-3", rank: 3 },
};

export const CATEGORIES = ["Development", "Sales", "Lead gen", "Management", "Finance", "Operations", "Research", "Delivery", "Marketing"];

/** Default spaces. Admins see every space; these roles also see every task in it (others only tasks assigned to them). */
export const DEFAULT_SPACES: Omit<Space, "id">[] = [
  { name: "Company", color: "ice", position: 0, roles: [] },
  { name: "Sales", color: "cyan", position: 1, roles: ["bdr", "closer"] },
  { name: "Lead gen", color: "mint", position: 2, roles: ["bdr", "closer"] },
  { name: "Delivery", color: "amber", position: 3, roles: ["implementer"] },
  { name: "Development", color: "lavender", position: 4, roles: [] },
  { name: "Finance", color: "amber", position: 5, roles: [] },
  { name: "Operations", color: "text-3", position: 6, roles: [] },
  { name: "Research", color: "cyan", position: 7, roles: [] },
];

/** Notion category → space for the one-time import. */
export const NOTION_CATEGORY_SPACE: Record<string, string> = {
  research: "Research",
  "lead gen": "Lead gen",
  management: "Company",
  development: "Development",
  finance: "Finance",
  operations: "Operations",
  sales: "Sales",
  delivery: "Delivery",
  marketing: "Sales",
};

/** In progress over this many tasks per person turns the board column header amber. */
export const WIP_PER_PERSON = 3;
export const TRASH_DAYS = 30;
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
