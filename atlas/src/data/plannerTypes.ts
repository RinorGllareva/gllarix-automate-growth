import type { OwnerKey } from "@/config/ai";
import type { Action, Automation, AutomationRun, Condition, Goal, GoalKpi, TaskTemplate, TriggerType } from "@/services/automations";
import type { DraftRow, DraftSchedule, PlanChangeJson, PlannerMode, PlannerSettings } from "@/services/planner";

export type { Action, Automation, AutomationRun, Condition, DraftRow, Goal, GoalKpi, PlanChangeJson, PlannerMode, PlannerSettings, TaskTemplate, TriggerType };

/** A planner run (the `plans` log). Drafts are kept here; tasks are written only on Accept. */
export interface PlanRecord {
  id: string;
  mode: PlannerMode;
  idea: string;
  settings: PlannerSettings;
  status: "draft" | "accepted" | "rejected" | "failed";
  rows: DraftRow[];
  outcome: string;
  risks: string[];
  openQuestions: string[];
  changes: (PlanChangeJson & { applied?: boolean; title?: string })[];
  parentTaskId: string | null;
  model: string;
  /** USD cents (provider pricing). */
  costMinor: number;
  inputTokens: number;
  outputTokens: number;
  attempts: number;
  errors: string[];
  createdBy: string;
  createdAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  createdTaskIds: string[];
}

export interface PlanView extends PlanRecord {
  schedule: DraftSchedule;
  listName: string | null;
  createdByName: string;
}

export interface PlanLog {
  plans: (Pick<PlanRecord, "id" | "mode" | "idea" | "status" | "model" | "costMinor" | "createdAt" | "createdTaskIds"> & { createdByName: string; rows: number })[];
  /** This month's AI spend and the cap, EUR cents. */
  monthSpendEurMinor: number;
  capEurMinor: number;
  blocked: boolean;
}

export interface CreatePlanInput {
  idea: string;
  settings: PlannerSettings;
}

export interface PlannerApi {
  /** Calls the AI provider (validate, retry once), schedules the draft. Writes no tasks. */
  createPlan(input: CreatePlanInput): Promise<PlanView>;
  getPlan(id: string): Promise<PlanView>;
  /** Edits re-run the scheduler, not the AI. */
  updatePlanRow(id: string, key: string, patch: Partial<Pick<DraftRow, "title" | "owner" | "estimateHours" | "priority" | "category" | "reviewer">> | { remove: true }): Promise<PlanView>;
  addPlanRow(id: string, row: { title: string; owner: OwnerKey; estimateHours: number; dependsOn?: string[] }): Promise<PlanView>;
  updatePlanSettings(id: string, settings: Partial<PlannerSettings>): Promise<PlanView>;
  acceptPlan(id: string): Promise<{ created: number; taskIds: string[] }>;
  rejectPlan(id: string): Promise<void>;
  planLog(): Promise<PlanLog>;
  /** Split with AI (task detail): a draft of 2–8 subtasks; Accept adds them. */
  splitTask(taskId: string): Promise<PlanView>;
  /** Re-plan: proposes changes; each is applied with one click. */
  replan(): Promise<PlanView>;
  applyPlanChange(planId: string, index: number): Promise<void>;
  /** "What should we do this week?" A pick list that fits free hours. */
  weeklyPicks(): Promise<PlanView>;
  /** Task detail's AI planner card: capacity fit and risks from the scheduler. */
  taskFit(taskId: string): Promise<{ text: string; risks: string[] }>;
}

export interface GoalView {
  goal: Goal;
  current: number;
  pct: number;
  elapsed: number;
  status: "done" | "on_track" | "behind" | "overdue";
  ownerName: string | null;
  tasks: { open: number; done: number };
}

export interface AutomationsApi {
  listAutomations(): Promise<{ automations: Automation[]; templates: TaskTemplate[]; runs: AutomationRun[] }>;
  saveAutomation(a: Pick<Automation, "name" | "trigger" | "conditions" | "actions"> & { id?: string; active?: boolean }): Promise<Automation>;
  setAutomationActive(id: string, active: boolean): Promise<void>;
  deleteAutomation(id: string): Promise<void>;
  saveTaskTemplate(t: Pick<TaskTemplate, "name" | "description" | "items"> & { id?: string }): Promise<TaskTemplate>;
  deleteTaskTemplate(id: string): Promise<void>;
  listGoals(): Promise<GoalView[]>;
  saveGoal(g: Pick<Goal, "title" | "kpi" | "target" | "dueAt" | "ownerId"> & { id?: string }): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
}
