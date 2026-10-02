import { CHUNK_HOURS } from "@/config/capacity";
import { EXTERNAL_HOURS_PER_WEEKDAY, OWNER_KEYS, OWNER_LABEL, PLAN_CATEGORIES, type OwnerKey } from "@/config/ai";
import type { TaskPriority } from "@/data/taskTypes";
import { schedule, type SchedPerson, type SchedTask } from "./scheduler";
import { createsCycle } from "./tasks";
import { shiftDateKey } from "./time";

/**
 * AI planner (CRM_BUILD_PROMPT A16, screen 20). The model proposes tasks as JSON (Appendix 5); this module builds the
 * request, validates the answer, and schedules the draft with services/scheduler.ts. Dates come from the scheduler,
 * never from the model. Nothing here writes tasks: the data layer does that only on Accept.
 */

export type PlannerMode = "plan" | "split" | "replan" | "weekly";

export interface PlanTaskJson {
  key: string;
  milestone?: string;
  reuses_task_id?: string;
  title: string;
  description: string;
  acceptance: string[];
  owner: OwnerKey;
  reviewer?: "rinor" | "cofounder";
  category: (typeof PLAN_CATEGORIES)[number];
  priority: "Urgent" | "High" | "Normal" | "Low";
  estimate_hours: number;
  confidence: "low" | "medium" | "high";
  depends_on: string[];
  earliest_start?: string;
  subtasks?: { title: string; estimate_hours: number }[];
}

export interface PlanChangeJson {
  task_id: string;
  action: "move" | "reassign" | "re-estimate" | "split" | "drop" | "move_deadline";
  value?: string;
  reason: string;
}

export interface PlanJson {
  outcome: string;
  milestones?: { key: string; title: string; due?: string }[];
  tasks: PlanTaskJson[];
  risks: string[];
  open_questions: string[];
  changes?: PlanChangeJson[];
}

export interface TeamEntry {
  key: OwnerKey;
  name: string;
  role: string;
  hoursPerWeek: number | null;
  /** Free hours per week over the planning window (from the scheduler). */
  freeByWeek: Record<string, number>;
  split: Record<string, number>;
  skills: string[];
}

export interface PlannerSettings {
  deadline: string | null;
  /** 0.3 = +30%; null = each person's real ratio. */
  buffer: number | null;
  people: OwnerKey[];
  context: string[];
  targetListId: string | null;
  /** "notes": tasks from pasted meeting or call notes. */
  source?: "idea" | "notes";
}

export interface PlannerRequest {
  mode: PlannerMode;
  idea: string;
  settings: PlannerSettings;
  team: TeamEntry[];
  existingWork: { id: string; title: string; owner: string | null; hours: number; start: string | null; due: string | null; status: string; priority: string }[];
  context: Record<string, string>;
  schema: typeof PLAN_SCHEMA;
}

/** Appendix 5 (v1). */
export const PLAN_SCHEMA = {
  type: "object",
  required: ["outcome", "tasks", "risks", "open_questions"],
  properties: {
    outcome: { type: "string" },
    milestones: { type: "array", items: { type: "object", required: ["key", "title"], properties: { key: { type: "string" }, title: { type: "string" }, due: { type: "string", format: "date" } } } },
    tasks: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        required: ["key", "title", "description", "acceptance", "owner", "category", "priority", "estimate_hours", "confidence", "depends_on"],
        properties: {
          key: { type: "string" }, milestone: { type: "string" }, reuses_task_id: { type: "string" },
          title: { type: "string", maxLength: 90 }, description: { type: "string", maxLength: 450 },
          acceptance: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
          owner: { type: "string", enum: ["rinor", "cofounder", "bdr", "codex", "freelancer"] },
          reviewer: { type: "string", enum: ["rinor", "cofounder"] },
          category: { type: "string", enum: [...PLAN_CATEGORIES] },
          priority: { type: "string", enum: ["Urgent", "High", "Normal", "Low"] },
          estimate_hours: { type: "number", minimum: 0.5, maximum: 40 },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          depends_on: { type: "array", items: { type: "string" } },
          earliest_start: { type: "string", format: "date" },
          subtasks: { type: "array", items: { type: "object", required: ["title", "estimate_hours"], properties: { title: { type: "string" }, estimate_hours: { type: "number" } } } },
        },
      },
    },
    risks: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
    changes: {
      type: "array",
      items: { type: "object", required: ["task_id", "action", "reason"], properties: { task_id: { type: "string" }, action: { type: "string", enum: ["move", "reassign", "re-estimate", "split", "drop", "move_deadline"] }, value: { type: "string" }, reason: { type: "string" } } },
    },
  },
} as const;

/** Fill the runtime prompt's {{...}} blocks (prompts/TASK_PLANNER_SYSTEM_PROMPT.md). The prompt itself lives server-side. */
export const renderPrompt = (template: string, req: PlannerRequest) =>
  template
    .replace("{{JSON_SCHEMA}}", JSON.stringify(req.schema))
    .replace("{{SETTINGS}}", JSON.stringify({ mode: req.mode, ...req.settings }))
    .replace("{{TEAM}}", JSON.stringify(req.team))
    .replace("{{EXISTING_WORK}}", JSON.stringify(req.existingWork))
    .replace("{{CONTEXT}}", JSON.stringify(req.context))
    .replace("{{IDEA}}", req.idea);

// ---------------------------------------------------------------- validation

const OWNERS: OwnerKey[] = ["rinor", "cofounder", "bdr", "codex", "freelancer"];
const PRIORITIES = ["Urgent", "High", "Normal", "Low"] as const;
const CONF = ["low", "medium", "high"] as const;

export type ValidationResult = { ok: true; plan: PlanJson } | { ok: false; errors: string[] };

/** Validate the model's answer (pydantic in the original spec). Unknown owners and estimates outside 0.5–40 h are rejected. */
export const validatePlan = (raw: string, req: Pick<PlannerRequest, "mode" | "settings" | "existingWork"> & { parentEstimate?: number }): ValidationResult => {
  let data: unknown;
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    data = JSON.parse(trimmed);
  } catch {
    return { ok: false, errors: ["The answer isn't valid JSON."] };
  }
  const errors: string[] = [];
  const p = data as Partial<PlanJson>;
  if (!p || typeof p !== "object" || Array.isArray(p)) return { ok: false, errors: ["The answer must be one JSON object."] };
  if (typeof p.outcome !== "string") errors.push("outcome: required text");
  if (!Array.isArray(p.risks) || p.risks.some((r) => typeof r !== "string")) errors.push("risks: required list of text");
  if (!Array.isArray(p.open_questions) || p.open_questions.some((r) => typeof r !== "string")) errors.push("open_questions: required list of text");
  if (!Array.isArray(p.tasks)) errors.push("tasks: required list");
  const tasks = Array.isArray(p.tasks) ? p.tasks : [];
  if (tasks.length > 40) errors.push("tasks: at most 40");
  const keys = new Set<string>();
  const existing = new Set(req.existingWork.map((w) => w.id));
  const allowed = new Set(req.settings.people.length ? req.settings.people : OWNERS);
  tasks.forEach((t, i) => {
    const at = `tasks[${i}]${t && typeof t.key === "string" ? ` (${t.key})` : ""}`;
    if (!t || typeof t !== "object") return errors.push(`${at}: must be an object`);
    for (const f of ["key", "title", "description"] as const) if (typeof t[f] !== "string" || !t[f].trim()) errors.push(`${at}.${f}: required text`);
    if (typeof t.key === "string") {
      if (keys.has(t.key)) errors.push(`${at}.key: duplicate`);
      keys.add(t.key);
    }
    if (typeof t.title === "string" && t.title.length > 90) errors.push(`${at}.title: at most 90 characters`);
    if (typeof t.description === "string" && t.description.length > 450) errors.push(`${at}.description: at most 450 characters`);
    if (!Array.isArray(t.acceptance) || t.acceptance.length < 1 || t.acceptance.length > 4) errors.push(`${at}.acceptance: 1–4 checks`);
    if (!OWNERS.includes(t.owner)) errors.push(`${at}.owner: unknown owner "${String(t.owner)}"`);
    else if (!allowed.has(t.owner)) errors.push(`${at}.owner: ${t.owner} isn't allowed in this plan`);
    if (t.reviewer !== undefined && t.reviewer !== "rinor" && t.reviewer !== "cofounder") errors.push(`${at}.reviewer: rinor or cofounder`);
    if (!PLAN_CATEGORIES.includes(t.category)) errors.push(`${at}.category: one of ${PLAN_CATEGORIES.join(", ")}`);
    if (!PRIORITIES.includes(t.priority)) errors.push(`${at}.priority: Urgent, High, Normal or Low`);
    if (typeof t.estimate_hours !== "number" || t.estimate_hours < 0.5 || t.estimate_hours > 40) errors.push(`${at}.estimate_hours: between 0.5 and 40`);
    if (!CONF.includes(t.confidence)) errors.push(`${at}.confidence: low, medium or high`);
    if (!Array.isArray(t.depends_on)) errors.push(`${at}.depends_on: required list`);
    if (t.reuses_task_id !== undefined && !existing.has(t.reuses_task_id)) errors.push(`${at}.reuses_task_id: not an existing task`);
    if (t.subtasks !== undefined && (!Array.isArray(t.subtasks) || t.subtasks.some((s) => typeof s?.title !== "string" || typeof s?.estimate_hours !== "number"))) errors.push(`${at}.subtasks: title and estimate_hours each`);
  });
  // Dependencies point at keys in this plan or existing tasks, without cycles.
  const edges: { taskId: string; dependsOnId: string }[] = [];
  for (const t of tasks) {
    if (!Array.isArray(t?.depends_on)) continue;
    for (const d of t.depends_on) {
      if (!keys.has(d) && !existing.has(d)) errors.push(`tasks (${t.key}).depends_on: unknown "${d}"`);
      else if (keys.has(d)) {
        if (createsCycle(edges, t.key, d)) errors.push(`tasks (${t.key}).depends_on: "${d}" makes a cycle`);
        edges.push({ taskId: t.key, dependsOnId: d });
      }
    }
  }
  if (req.mode === "split") {
    if (tasks.length < 2 || tasks.length > 8) errors.push("split: 2–8 subtasks");
    const sum = tasks.reduce((n, t) => n + (typeof t?.estimate_hours === "number" ? t.estimate_hours : 0), 0);
    if (req.parentEstimate && (sum < req.parentEstimate * 0.8 || sum > req.parentEstimate * 1.2)) errors.push(`split: subtasks add up to ${sum} h; the parent is ${req.parentEstimate} h (±20%)`);
  }
  if (req.mode === "replan") {
    if (!Array.isArray(p.changes)) errors.push("changes: required in replan mode");
    else
      p.changes.forEach((c, i) => {
        if (!c || typeof c.task_id !== "string" || typeof c.reason !== "string") errors.push(`changes[${i}]: task_id and reason required`);
        else if (!["move", "reassign", "re-estimate", "split", "drop", "move_deadline"].includes(c.action)) errors.push(`changes[${i}].action: unknown "${String(c.action)}"`);
        else if (!existing.has(c.task_id)) errors.push(`changes[${i}].task_id: not an existing task`);
      });
  }
  if (req.mode === "weekly") tasks.forEach((t) => !t.reuses_task_id && errors.push(`weekly (${t.key}): pick existing tasks (reuses_task_id)`));
  return errors.length ? { ok: false, errors } : { ok: true, plan: p as PlanJson };
};

// ---------------------------------------------------------------- draft rows and scheduling

export interface DraftRow {
  key: string;
  title: string;
  description: string;
  acceptance: string[];
  owner: OwnerKey;
  reviewer: "rinor" | "cofounder" | null;
  category: string;
  priority: TaskPriority;
  estimateHours: number;
  confidence: "low" | "medium" | "high";
  /** Keys in this plan, or existing task ids. */
  dependsOn: string[];
  earliestStart: string | null;
  subtasks: { title: string; estimateHours: number }[];
  reusesTaskId: string | null;
  milestone: string | null;
}

export const rowsFromPlan = (plan: PlanJson): DraftRow[] =>
  plan.tasks.map((t) => ({
    key: t.key, title: t.title.trim(), description: t.description.trim(), acceptance: t.acceptance, owner: t.owner,
    reviewer: t.owner === "codex" ? (t.reviewer ?? "rinor") : (t.reviewer ?? null), category: t.category, priority: t.priority.toLowerCase() as TaskPriority,
    estimateHours: t.estimate_hours, confidence: t.confidence, dependsOn: t.depends_on, earliestStart: t.earliest_start ?? null,
    subtasks: (t.subtasks ?? []).map((s) => ({ title: s.title, estimateHours: s.estimate_hours })), reusesTaskId: t.reuses_task_id ?? null, milestone: t.milestone ?? null,
  }));

export interface ScheduledRow {
  key: string;
  start: string | null;
  finish: string | null;
}

export interface DraftSchedule {
  rows: ScheduledRow[];
  summary: { tasks: number; teamHours: number; externalHours: number; finish: string | null; beforeDeadline: boolean | null };
  /** What the planner changed or flagged (scheduler first, then the model's risks). */
  flags: string[];
}

const EXTERNAL_ID = "external";
const fmtDay = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
export const fmtRange = (a: string | null, b: string | null) => {
  if (!a || !b) return "—";
  if (a === b) return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${a}T00:00:00Z`));
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return sameMonth ? `${Number(a.slice(8))}–${fmtDay(b)}` : `${fmtDay(a)} – ${fmtDay(b)}`;
};

export interface ScheduleDraftInput {
  rows: DraftRow[];
  people: SchedPerson[];
  existing: SchedTask[];
  now: number;
  weeks: string[];
  agentReviewHours: number;
  settings: Pick<PlannerSettings, "deadline" | "buffer">;
  risks: string[];
}

/** Run the scheduler on the draft after existing work. Editing a row re-runs this, not the AI. */
export const scheduleDraft = (input: ScheduleDraftInput): DraftSchedule => {
  const rows = input.rows;
  const people = input.people.map((p) => (input.settings.buffer === null ? p : { ...p, buffer: input.settings.buffer }));
  // Freelancers: external hours at a steady pace on weekdays, outside the team's capacity.
  const h = EXTERNAL_HOURS_PER_WEEKDAY;
  const window = `09:00-${String(9 + Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
  const external: SchedPerson = {
    id: EXTERNAL_ID, name: "Freelancer", timezone: "UTC", windows: { mon: window, tue: window, wed: window, thu: window, fri: window }, split: {}, skills: [], focusFactor: 1,
    buffer: input.settings.buffer ?? 0.3, timeOff: [],
  };
  const idOf = (key: string) => `draft:${key}`;
  const draftTasks: SchedTask[] = rows.map((r) => ({
    id: idOf(r.key), title: r.title,
    ownerId: r.owner === "codex" ? OWNER_KEYS[r.reviewer ?? "rinor"] : r.owner === "freelancer" ? EXTERNAL_ID : OWNER_KEYS[r.owner],
    category: r.category, priority: r.priority, startAt: r.earliestStart, dueAt: null, remainingHours: r.estimateHours,
    agent: r.owner === "codex", reviewHours: r.owner === "codex" ? r.estimateHours : undefined, milestone: false,
    dependsOn: r.dependsOn.map((d) => (rows.some((x) => x.key === d) ? idOf(d) : d)),
  }));
  const res = schedule({ people: [...people, external], tasks: [...input.existing, ...draftTasks], now: input.now, weeks: input.weeks, agentReviewHours: input.agentReviewHours });

  const out: ScheduledRow[] = rows.map((r) => {
    const p = res.placements[idOf(r.key)];
    return { key: r.key, start: p?.start ?? null, finish: p?.finish ?? null };
  });
  const finish = out.map((r) => r.finish).filter(Boolean).sort().pop() ?? null;
  const flags: string[] = [];
  const nameOf = (id: string | null) => input.people.find((p) => p.id === id)?.name.split(" ")[0] ?? "Someone";

  // A draft task that couldn't start when it could have: say who was full and what it moved to.
  for (const r of rows) {
    if (r.owner === "freelancer") continue;
    const t = draftTasks.find((x) => x.id === idOf(r.key))!;
    const p = res.placements[t.id];
    const owner = people.find((x) => x.id === t.ownerId);
    if (!p?.chunks.length || !owner) continue;
    const first = [...p.chunks].sort((a, b) => a.date.localeCompare(b.date))[0].date;
    const deps = t.dependsOn.map((d) => res.placements[d]?.finish).filter(Boolean) as string[];
    const today = new Date(input.now).toISOString().slice(0, 10);
    const earliest = [today, t.startAt, ...deps].filter(Boolean).sort().pop()!;
    const fullDays: string[] = [];
    for (let d = earliest; d < first; d = shiftDateKey(d, 1)) {
      const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
      const key = (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[weekday];
      // A working day counts as "full" only when existing work (not this plan's own tasks) takes it.
      const existingThatDay = Object.values(res.placements).some((pl) => !pl.taskId.startsWith("draft:") && pl.chunks.some((c) => c.personId === owner.id && c.date === d));
      if (owner.windows[key] && existingThatDay) fullDays.push(d);
    }
    if (!fullDays.length) continue;
    // Name the existing task that filled those days the most.
    const busy = new Map<string, number>();
    for (const pl of Object.values(res.placements)) {
      if (pl.taskId.startsWith("draft:")) continue;
      for (const c of pl.chunks) if (c.personId === owner.id && fullDays.includes(c.date)) busy.set(pl.taskId, (busy.get(pl.taskId) ?? 0) + c.hours);
    }
    const top = [...busy.entries()].sort((a, b) => b[1] - a[1])[0];
    const topTitle = top ? input.existing.find((x) => x.id === top[0])?.title : null;
    const short = topTitle ? ` (${topTitle.length > 42 ? `${topTitle.slice(0, 40)}…` : topTitle})` : "";
    flags.push(`${nameOf(owner.id)} is full on ${fmtRange(fullDays[0], fullDays[fullDays.length - 1])}${short}. "${r.title}" moved to ${fmtRange(first, p.finish)}.`);
  }
  for (const c of res.conflicts) {
    if (c.type === "dependency" && c.taskId.startsWith("draft:")) {
      const r = rows.find((x) => idOf(x.key) === c.taskId);
      const dep = input.existing.find((x) => x.id === c.dependsOnId)?.title ?? rows.find((x) => idOf(x.key) === c.dependsOnId)?.title;
      if (r && dep) flags.push(`"${r.title}" waits on "${dep}", which finishes ${fmtDay(c.depFinish)}.`);
    }
    if (c.type === "unschedulable" && c.taskId.startsWith("draft:")) flags.push(`"${rows.find((x) => idOf(x.key) === c.taskId)?.title}" doesn't fit in the next 12 weeks.`);
  }
  const deadline = input.settings.deadline;
  if (deadline && finish && finish > deadline) flags.push(`The plan finishes ${fmtDay(finish)}, after the ${fmtDay(deadline)} deadline. Options: fewer tasks, more people, or a later deadline.`);
  for (const r of input.risks) if (!flags.includes(r)) flags.push(r);

  const teamHours = rows.filter((r) => r.owner !== "freelancer").reduce((n, r) => n + r.estimateHours, 0);
  const externalHours = rows.filter((r) => r.owner === "freelancer").reduce((n, r) => n + r.estimateHours, 0);
  return {
    rows: out,
    summary: { tasks: rows.length, teamHours: Math.round(teamHours * 2) / 2, externalHours: Math.round(externalHours * 2) / 2, finish, beforeDeadline: deadline && finish ? finish <= deadline : null },
    flags,
  };
};

export const ownerLabel = (o: OwnerKey) => OWNER_LABEL[o];
export const MIN_CHUNK = CHUNK_HOURS;
