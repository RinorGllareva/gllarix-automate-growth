import type { Weekday } from "@/config/capacity";
import type { CellLoad, Conflict, Suggestion } from "@/services/scheduler";
import type { TaskStatus } from "./taskTypes";

export interface Availability {
  userId: string;
  timezone: string;
  windows: Partial<Record<Weekday, string>>;
  /** Category → share (sums to 1). */
  split: Record<string, number>;
  planned: string[];
  skills: string[];
  updatedAt: string;
  updatedBy: string | null;
}

export interface TimeOff {
  id: string;
  userId: string;
  from: string;
  to: string;
  reason: string;
}

export interface CapacitySettings {
  focusFactor: number;
  buffer: number;
}

export interface PlanPerson {
  id: string;
  name: string;
  kind: "person" | "agent";
  /** Token color for bars and the legend. */
  color: "lavender" | "cyan" | "amber" | "text-3" | "mint";
  /** "Weekends · 12 h", "Ops + dev · 13 h". */
  capLine: string;
  hoursPerWeek: number | null;
  windowsText: string;
  splitText: string;
  timezone: string | null;
  /** Actual ÷ estimate after 4+ weeks of time data (the scheduler then uses it instead of the default buffer). */
  accuracy: number | null;
  editable: boolean;
}

export interface TimelineBar {
  taskId: string;
  title: string;
  ownerId: string | null;
  color: PlanPerson["color"];
  start: string;
  end: string;
  milestone: boolean;
  agent: boolean;
  status: TaskStatus;
  waitingOn: string[];
  /** Scheduler's finish (may differ from the due date). */
  finish: string | null;
}

export interface CapacityPlan {
  today: string;
  weeks: { key: string; start: string; label: string }[];
  people: PlanPerson[];
  cells: CellLoad[];
  agent: { week: string; prs: number; reviewHours: number }[];
  bars: TimelineBar[];
  unscheduled: { taskId: string; title: string; ownerName: string | null; estimateHours: number | null }[];
  conflicts: Conflict[];
  suggestions: Suggestion[];
  availability: Availability[];
  timeOff: TimeOff[];
  settings: CapacitySettings;
}

export interface CapacityApi {
  capacityPlan(q?: { from?: string; weeks?: number; listId?: string; spaceId?: string }): Promise<CapacityPlan>;
  applySuggestion(id: string): Promise<void>;
  dismissSuggestion(id: string): Promise<void>;
  /** Category split must sum to 100%. People can edit only their own unless admin. */
  updateAvailability(userId: string, patch: { windows?: Availability["windows"]; split?: Record<string, number>; timezone?: string; planned?: string[] }): Promise<void>;
  addTimeOff(userId: string, entry: { from: string; to: string; reason: string }): Promise<void>;
  removeTimeOff(id: string): Promise<void>;
  /** Admin: focus factor and default buffer. */
  setCapacitySettings(s: Partial<CapacitySettings>): Promise<void>;
}
