import type { TaskPriority, TaskStatus } from "@/data/taskTypes";
import { shiftDateKey } from "./time";

/** Automations ("when X then Y", A15), task templates, recurring tasks and goals. Pure matching and planning only. */

export type TriggerType = "deal_won" | "task_status_changed" | "task_created" | "due_date_passed";

export type AutomationEvent =
  | { type: "deal_won"; dealId: string; leadId: string; brand: "gllarix" | "arcadian"; ownerId: string | null; clientId: string | null; pilot: boolean }
  | { type: "task_status_changed"; taskId: string; listId: string; from: TaskStatus; to: TaskStatus; priority: TaskPriority; category: string | null }
  | { type: "task_created"; taskId: string; listId: string; priority: TaskPriority; category: string | null }
  | { type: "due_date_passed"; taskId: string; listId: string; priority: TaskPriority; category: string | null };

export interface Condition {
  field: string;
  op: "eq" | "neq" | "in";
  value: string | boolean | string[];
}

export type Action =
  | { type: "create_tasks_from_template"; templateId: string; spaceName: string; listName: string; assignee: "deal_owner" | "implementer" | "trigger_assignees" | string; link: "client" | "deal" | "lead" | "none" }
  | { type: "notify"; to: "trigger_assignees" | "trigger_creator" | "admins" | string; text: string }
  | { type: "set_status"; status: TaskStatus }
  | { type: "set_priority"; priority: TaskPriority }
  | { type: "add_tag"; tag: string };

export interface Automation {
  id: string;
  name: string;
  trigger: { type: TriggerType };
  conditions: Condition[];
  actions: Action[];
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  runs: number;
  lastRunAt: string | null;
}

export interface TemplateItem {
  title: string;
  estimateHours: number | null;
  /** Due this many days after the trigger. */
  dueOffsetDays: number;
  category: string | null;
  priority: TaskPriority;
  /** Who it goes to; "assignee" means the action's assignee. */
  role: "assignee" | "deal_owner" | "implementer" | "admin";
  checklist?: string[];
  dependsOnPrevious?: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  items: TemplateItem[];
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  at: string;
  event: AutomationEvent["type"];
  subject: string;
  result: string;
  ok: boolean;
}

const fieldOf = (e: AutomationEvent, field: string): unknown => (e as unknown as Record<string, unknown>)[field];

export const conditionsMatch = (conds: Condition[], e: AutomationEvent) =>
  conds.every((c) => {
    const v = fieldOf(e, c.field);
    if (c.op === "eq") return v === c.value;
    if (c.op === "neq") return v !== c.value;
    return Array.isArray(c.value) && c.value.includes(String(v));
  });

/** Active automations whose trigger and conditions match the event. */
export const matching = (autos: Automation[], e: AutomationEvent) => autos.filter((a) => a.active && a.trigger.type === e.type && conditionsMatch(a.conditions, e));

/** Tasks a template creates, with due dates from the trigger date. */
export const instantiate = (tpl: TaskTemplate, at: string) =>
  tpl.items.map((it, i) => ({ ...it, index: i, dueAt: shiftDateKey(at, it.dueOffsetDays) }));

// ---------------------------------------------------------------- recurring tasks

export interface Recurrence {
  freq: "daily" | "weekdays" | "weekly" | "monthly";
  interval: number;
}

export const RECURRENCE_LABEL: Record<Recurrence["freq"], string> = { daily: "Every day", weekdays: "Every weekday", weekly: "Every week", monthly: "Every month" };

/** The next due date after `from` (completing one creates the next). */
export const nextOccurrence = (r: Recurrence, from: string) => {
  const n = Math.max(1, r.interval);
  if (r.freq === "daily") return shiftDateKey(from, n);
  if (r.freq === "weekly") return shiftDateKey(from, 7 * n);
  if (r.freq === "weekdays") {
    let d = shiftDateKey(from, 1);
    while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = shiftDateKey(d, 1);
    return d;
  }
  const [y, m, day] = from.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
};

export const recurrenceText = (r: Recurrence | null | undefined) => (!r ? "Doesn't repeat" : r.interval > 1 ? `Every ${r.interval} ${r.freq === "daily" ? "days" : r.freq === "weekly" ? "weeks" : r.freq === "monthly" ? "months" : "weekdays"}` : RECURRENCE_LABEL[r.freq]);

// ---------------------------------------------------------------- goals

export type GoalKpi = "mrr_eur" | "paying_clients" | "approved_meetings_month" | "meetings_booked_month" | "won_deals";

export const KPI_LABEL: Record<GoalKpi, { label: string; unit: string }> = {
  mrr_eur: { label: "MRR (EUR)", unit: "€" },
  paying_clients: { label: "Paying clients", unit: "" },
  approved_meetings_month: { label: "Approved meetings this month", unit: "" },
  meetings_booked_month: { label: "Meetings booked this month", unit: "" },
  won_deals: { label: "Won deals", unit: "" },
};

export interface Goal {
  id: string;
  title: string;
  kpi: GoalKpi;
  target: number;
  dueAt: string;
  ownerId: string | null;
  createdAt: string;
}

/** Progress and whether the goal is on pace (straight line from creation to the due date). */
export const goalProgress = (g: Goal, current: number, today: string) => {
  const pct = g.target > 0 ? Math.min(1, current / g.target) : 0;
  const start = g.createdAt.slice(0, 10);
  const span = Math.max(1, (Date.parse(g.dueAt) - Date.parse(start)) / 86_400_000);
  const elapsed = Math.min(1, Math.max(0, (Date.parse(today) - Date.parse(start)) / 86_400_000 / span));
  const status: "done" | "on_track" | "behind" | "overdue" = current >= g.target ? "done" : today > g.dueAt ? "overdue" : pct + 0.1 >= elapsed ? "on_track" : "behind";
  return { current, pct, elapsed, status };
};
