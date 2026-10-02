import { AI_MONTHLY_CAP_MINOR, OWNER_KEYS, OWNER_LABEL, PLANNER_HORIZON_WEEKS, type AiJob, type OwnerKey } from "@/config/ai";
import { AGENT } from "@/config/capacity";
import { COUNTRY_RULES } from "@/config/countryRules";
import { BRANDS } from "@/config/priceBook";
import { USD_PER_EUR } from "@/config/targets";
import { createFakeAIProvider, type AIProvider } from "@/services/aiProvider";
import { goalProgress, instantiate, matching, type Automation, type AutomationEvent, type AutomationRun, type Goal, type GoalKpi, type TaskTemplate } from "@/services/automations";
import { PLAN_SCHEMA, rowsFromPlan, scheduleDraft, validatePlan, type DraftRow, type PlannerMode, type PlannerRequest, type PlannerSettings, type TeamEntry } from "@/services/planner";
import { fmtH, nextWeeks, schedule, type SchedPerson, type SchedTask } from "@/services/scheduler";
import { isOpen } from "@/services/tasks";
import { isoWeekKey, isoWeekRange, localDateKey, shiftDateKey } from "@/services/time";
import type { AutomationsApi, GoalView, PlanRecord, PlannerApi, PlanView } from "../plannerTypes";
import type { NewTask, Task, TaskList } from "../taskTypes";
import { AccessError, type Notification, type User } from "../types";
import type { SystemTaskInput } from "./demoTasks";

export interface PlannerStore {
  tasks: Task[];
  taskLists: TaskList[];
  plans: PlanRecord[];
  automations: Automation[];
  taskTemplates: TaskTemplate[];
  automationRuns: AutomationRun[];
  goals: Goal[];
  aiCapNotified: string | null;
  /** Tasks whose "due date passed" already fired (taskId → due date). */
  dueFired: Record<string, string>;
}

export const emptyPlannerState = () => ({
  plans: [] as PlanRecord[],
  automations: [] as Automation[],
  taskTemplates: [] as TaskTemplate[],
  automationRuns: [] as AutomationRun[],
  goals: [] as Goal[],
  aiCapNotified: null as string | null,
  dueFired: {} as Record<string, string>,
});

interface Ctx<S extends PlannerStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  schedPeople: (s: S) => SchedPerson[];
  schedTasks: (s: S) => SchedTask[];
  canSeeTask: (s: S, user: User, t: Task) => boolean;
  patchTask: (s: S, user: User, id: string, patch: Partial<Task>) => void;
  addAiTask: (s: S, user: User, input: NewTask & { tags?: string[]; planId: string }) => Task;
  addSystemTask: (s: S, input: SystemTaskInput) => Task;
  addDep: (s: S, taskId: string, dependsOnId: string) => void;
  systemPatch: (s: S, id: string, patch: Partial<Task>, text: string) => void;
  kpiValue: (s: S, kpi: GoalKpi) => number;
  /** Text for {{company}} in automation messages. */
  companyOfDeal: (s: S, dealId: string) => string;
  provider?: AIProvider;
}

const DAY = 86_400_000;
const USER_TO_KEY: Record<string, OwnerKey> = Object.fromEntries(Object.entries(OWNER_KEYS).map(([k, v]) => [v, k as OwnerKey]));

export const createDemoPlanner = <S extends PlannerStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify } = ctx;
  const provider = ctx.provider ?? createFakeAIProvider();
  const iso = (t = now()) => new Date(t).toISOString();
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
  const admins = () => users.filter((u) => u.role === "admin" && u.active);

  // ---------------------------------------------------------------- cost cap

  const monthSpendEur = (s: S) => s.plans.filter((p) => p.createdAt.slice(0, 7) === iso().slice(0, 7)).reduce((n, p) => n + p.costMinor / USD_PER_EUR, 0);
  const checkCap = (s: S) => {
    if (monthSpendEur(s) < AI_MONTHLY_CAP_MINOR) return;
    const month = iso().slice(0, 7);
    if (s.aiCapNotified !== month) {
      s.aiCapNotified = month;
      for (const a of admins()) notify({ userId: a.id, type: "job_paused", text: `AI planner paused: the €${AI_MONTHLY_CAP_MINOR / 100} monthly cap is reached`, href: "/tasks/planner" });
    }
    throw new Error(`The monthly AI cap (€${AI_MONTHLY_CAP_MINOR / 100}) is reached. Plans start again next month, or an admin raises the cap.`);
  };

  // ---------------------------------------------------------------- request building

  const weeksAhead = () => nextWeeks(isoWeekRange(isoWeekKey(localDateKey(now(), "UTC"))).start, PLANNER_HORIZON_WEEKS);

  const buildRequest = (s: S, mode: PlannerMode, idea: string, settings: PlannerSettings, extra: Record<string, string> = {}): PlannerRequest => {
    const weeks = weeksAhead();
    const people = ctx.schedPeople(s);
    const res = schedule({ people, tasks: ctx.schedTasks(s), now: now(), weeks, agentReviewHours: AGENT.reviewHoursPerTask });
    const team: TeamEntry[] = [];
    for (const key of settings.people) {
      if (key === "codex") team.push({ key, name: OWNER_LABEL.codex, role: "agent", hoursPerWeek: null, freeByWeek: {}, split: {}, skills: AGENT.skills });
      else if (key === "freelancer") team.push({ key, name: OWNER_LABEL.freelancer, role: "external", hoursPerWeek: null, freeByWeek: {}, split: {}, skills: ["3d", "design"] });
      else {
        const p = people.find((x) => x.id === OWNER_KEYS[key]);
        if (!p) continue;
        team.push({
          key, name: p.name.split(" ")[0], role: users.find((u) => u.id === p.id)?.role ?? "", hoursPerWeek: res.cells.find((c) => c.personId === p.id)?.cap ?? null,
          freeByWeek: Object.fromEntries(res.cells.filter((c) => c.personId === p.id).map((c) => [c.week, c.free])), split: p.split, skills: p.skills,
        });
      }
    }
    const lastDay = shiftDateKey(isoWeekRange(weeks[weeks.length - 1]).start, 6);
    const existingWork = s.tasks
      .filter((t) => !t.deletedAt && !t.parentId && isOpen(t.status) && (!t.dueAt || t.dueAt <= lastDay))
      .slice(0, 80)
      .map((t) => {
        const pl = res.placements[t.id];
        return { id: t.id, title: t.title, owner: nameOf(t.assigneeIds[0] ?? null)?.split(" ")[0] ?? null, hours: Math.max(0, (t.estimateMinutes ?? 0) / 60), start: pl?.start ?? t.startAt, due: t.dueAt, status: t.status, priority: t.priority };
      });
    const context: Record<string, string> = { ...extra };
    if (settings.context.includes("price_book")) context.price_book = BRANDS.map((b) => `${b.name}: ${b.groups.map((g) => g.title).join(", ")}`).join(" | ");
    if (settings.context.includes("sales_plan")) context.sales_plan = "Gate 1: 3 paying clients, then promote the BDR to closer. BDR calls US trades on weekdays.";
    if (settings.context.includes("country_rules")) context.country_rules = Object.entries(COUNTRY_RULES).map(([c, r]) => `${c}: call ${r.call ? "yes" : "no"}, email ${String(r.email)}${r.verified ? "" : " (unverified)"}`).join("; ");
    if (settings.context.includes("calendar")) context.calendar = `Today ${localDateKey(now(), "UTC")}. Planning window ${weeks[0]}–${weeks[weeks.length - 1]}.`;
    return { mode, idea, settings, team, existingWork, context, schema: PLAN_SCHEMA };
  };

  /** Call the provider, validate, retry once with the errors. Every attempt is costed. */
  const callModel = async (job: AiJob, req: PlannerRequest, parentEstimate?: number) => {
    let cost = 0;
    let inTok = 0;
    let outTok = 0;
    let model = "";
    let errors: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const r = await provider.complete(job, req, attempt > 1 ? errors : undefined);
      cost += r.costMinor;
      inTok += r.inputTokens;
      outTok += r.outputTokens;
      model = r.model;
      const v = validatePlan(r.text, { ...req, parentEstimate });
      if (v.ok) return { plan: v.plan, cost, inTok, outTok, model, attempts: attempt, errors: [] as string[] };
      errors = v.errors;
    }
    return { plan: null, cost, inTok, outTok, model, attempts: 2, errors };
  };

  const defaultList = (s: S) => s.taskLists.find((l) => l.name === "Q4 launch" && !l.archivedAt)?.id ?? s.taskLists.find((l) => !l.archivedAt)?.id ?? null;

  const view = (s: S, p: PlanRecord): PlanView => {
    const weeks = weeksAhead();
    const sched = scheduleDraft({
      rows: p.rows, people: ctx.schedPeople(s), existing: ctx.schedTasks(s), now: now(), weeks, agentReviewHours: AGENT.reviewHoursPerTask,
      settings: { deadline: p.settings.deadline, buffer: p.settings.buffer }, risks: p.risks,
    });
    return { ...p, schedule: sched, listName: s.taskLists.find((l) => l.id === (p.settings.targetListId ?? defaultList(s)))?.name ?? null, createdByName: nameOf(p.createdBy) ?? "—" };
  };

  const requirePlanner = (user: User, settings?: PlannerSettings) => {
    if (user.role === "admin") return;
    const own = USER_TO_KEY[user.id];
    if (!own) throw new AccessError(403, "The planner is for founders and the sales team.");
    if (settings && settings.people.some((p) => p !== own)) throw new AccessError(403, "You can plan only for yourself.");
  };

  const record = (s: S, user: User, mode: PlannerMode, idea: string, settings: PlannerSettings, r: Awaited<ReturnType<typeof callModel>>, parentTaskId: string | null = null): PlanRecord => {
    const p: PlanRecord = {
      id: uid("pl"), mode, idea, settings, status: r.plan ? "draft" : "failed", rows: r.plan ? rowsFromPlan(r.plan) : [], outcome: r.plan?.outcome ?? "",
      risks: r.plan?.risks ?? [], openQuestions: r.plan?.open_questions ?? [], changes: r.plan?.changes ?? [], parentTaskId, model: r.model, costMinor: r.cost,
      inputTokens: r.inTok, outputTokens: r.outTok, attempts: r.attempts, errors: r.errors, createdBy: user.id, createdAt: iso(), acceptedBy: null, acceptedAt: null, createdTaskIds: [],
    };
    s.plans.unshift(p);
    audit(user.id, `planner.${mode}`, "plan", p.id, null, { status: p.status, costMinor: p.costMinor, attempts: p.attempts });
    return p;
  };

  const getOwn = (s: S, user: User, id: string) => {
    const p = s.plans.find((x) => x.id === id);
    if (!p) throw new AccessError(404);
    if (user.role !== "admin" && p.createdBy !== user.id) throw new AccessError(403);
    return p;
  };
  const editable = (p: PlanRecord) => {
    if (p.status !== "draft") throw new Error(`This plan is ${p.status}; start a new one to change it.`);
  };

  const ownerUser = (r: DraftRow) => (r.owner === "codex" ? OWNER_KEYS[r.reviewer ?? "rinor"] : r.owner === "freelancer" ? null : OWNER_KEYS[r.owner]);

  const planner: PlannerApi = {
    async createPlan(input) {
      const user = await viewer();
      const settings: PlannerSettings = { ...input.settings, people: input.settings.people.length ? input.settings.people : user.role === "admin" ? ["rinor", "cofounder", "codex", "freelancer"] : [USER_TO_KEY[user.id]] };
      requirePlanner(user, settings);
      if (!input.idea.trim()) throw new Error(settings.source === "notes" ? "Paste the notes first." : "Describe the idea first.");
      const s = await load();
      checkCap(s);
      const req = buildRequest(s, "plan", input.idea.trim(), settings);
      const r = await callModel("planner", req);
      const p = record(s, user, "plan", input.idea.trim(), settings, r);
      await save();
      if (!r.plan) throw new Error(`The planner's answer didn't pass validation twice: ${r.errors.slice(0, 3).join("; ")}`);
      return view(s, p);
    },

    async getPlan(id) {
      const user = await viewer();
      const s = await load();
      return view(s, getOwn(s, user, id));
    },

    async updatePlanRow(id, key, patch) {
      const user = await viewer();
      const s = await load();
      const p = getOwn(s, user, id);
      editable(p);
      if ("remove" in patch) {
        p.rows = p.rows.filter((r) => r.key !== key);
        for (const r of p.rows) r.dependsOn = r.dependsOn.filter((d) => d !== key);
      } else {
        const r = p.rows.find((x) => x.key === key);
        if (!r) throw new AccessError(404);
        if (patch.estimateHours !== undefined && (!(patch.estimateHours >= 0.5) || patch.estimateHours > 40)) throw new Error("Estimates are 0.5–40 hours; split anything bigger.");
        if (patch.title !== undefined && !patch.title.trim()) throw new Error("A task needs a title.");
        if (patch.owner && !p.settings.people.includes(patch.owner) && user.role !== "admin") throw new AccessError(403);
        Object.assign(r, patch, patch.owner === "codex" && !r.reviewer ? { reviewer: "rinor" } : {});
      }
      await save();
      return view(s, p);
    },

    async addPlanRow(id, row) {
      const user = await viewer();
      const s = await load();
      const p = getOwn(s, user, id);
      editable(p);
      if (!row.title.trim()) throw new Error("A task needs a title.");
      if (!(row.estimateHours >= 0.5) || row.estimateHours > 40) throw new Error("Estimates are 0.5–40 hours.");
      const key = String(Math.max(0, ...p.rows.map((r) => Number(r.key) || 0)) + 1);
      p.rows.push({
        key, title: row.title.trim(), description: "", acceptance: ["Done"], owner: row.owner, reviewer: row.owner === "codex" ? "rinor" : null, category: "Operations", priority: "normal",
        estimateHours: row.estimateHours, confidence: "medium", dependsOn: row.dependsOn ?? [], earliestStart: null, subtasks: [], reusesTaskId: null, milestone: null,
      });
      await save();
      return view(s, p);
    },

    async updatePlanSettings(id, settings) {
      const user = await viewer();
      const s = await load();
      const p = getOwn(s, user, id);
      editable(p);
      p.settings = { ...p.settings, ...settings };
      await save();
      return view(s, p);
    },

    async acceptPlan(id) {
      const user = await viewer();
      const s = await load();
      const p = getOwn(s, user, id);
      editable(p);
      const v = view(s, p);
      const listId = p.settings.targetListId ?? defaultList(s);
      if (!listId) throw new Error("Pick a list for the tasks.");
      const created: string[] = [];
      if (p.mode === "split") {
        const parent = s.tasks.find((t) => t.id === p.parentTaskId);
        if (!parent) throw new AccessError(404);
        for (const r of p.rows) {
          const t = ctx.addAiTask(s, user, { listId: parent.listId, parentId: parent.id, title: r.title, assigneeIds: parent.assigneeIds.slice(0, 1), estimateMinutes: Math.round(r.estimateHours * 60), planId: p.id, priority: parent.priority, category: parent.category });
          created.push(t.id);
        }
      } else {
        const idByKey = new Map<string, string>();
        for (const r of p.rows) {
          if (r.reusesTaskId) {
            idByKey.set(r.key, r.reusesTaskId);
            continue;
          }
          const sch = v.schedule.rows.find((x) => x.key === r.key);
          const owner = ownerUser(r);
          const description = [r.description, r.acceptance.length ? `\n## Acceptance criteria\n${r.acceptance.map((a) => `- [ ] ${a}`).join("\n")}` : "", p.settings.source === "notes" ? `\n_From notes (plan ${p.id})_` : ""].filter(Boolean).join("\n");
          const t = ctx.addAiTask(s, user, {
            listId, title: r.title, descriptionMd: description, assigneeIds: owner ? [owner] : [], estimateMinutes: Math.round(r.estimateHours * 60), category: r.category,
            priority: r.priority, startAt: sch?.start && sch.start !== sch.finish ? sch.start : null, dueAt: sch?.finish ?? null, planId: p.id,
            tags: r.owner === "codex" ? ["agent", "codex"] : r.owner === "freelancer" ? ["freelancer"] : [],
          });
          idByKey.set(r.key, t.id);
          created.push(t.id);
          for (const sub of r.subtasks) created.push(ctx.addAiTask(s, user, { listId, parentId: t.id, title: sub.title, assigneeIds: owner ? [owner] : [], estimateMinutes: Math.round(sub.estimateHours * 60), planId: p.id }).id);
          // Codex work always gets a review subtask for a founder.
          if (r.owner === "codex") created.push(ctx.addAiTask(s, user, { listId, parentId: t.id, title: `Review: ${r.title}`, assigneeIds: [OWNER_KEYS[r.reviewer ?? "rinor"]], estimateMinutes: Math.round(r.estimateHours * 60), planId: p.id, category: "Development" }).id);
        }
        for (const r of p.rows) {
          const id = idByKey.get(r.key);
          if (!id || r.reusesTaskId) continue;
          for (const d of r.dependsOn) ctx.addDep(s, id, idByKey.get(d) ?? d);
        }
      }
      Object.assign(p, { status: "accepted", acceptedBy: user.id, acceptedAt: iso(), createdTaskIds: created });
      audit(user.id, "planner.accept", "plan", p.id, null, { created: created.length, listId });
      await save();
      return { created: created.length, taskIds: created };
    },

    async rejectPlan(id) {
      const user = await viewer();
      const s = await load();
      const p = getOwn(s, user, id);
      if (p.status === "draft") p.status = "rejected";
      await save();
    },

    async planLog() {
      const user = await viewer();
      requirePlanner(user);
      const s = await load();
      const spend = monthSpendEur(s);
      return {
        plans: s.plans
          .filter((p) => user.role === "admin" || p.createdBy === user.id)
          .slice(0, 50)
          .map((p) => ({ id: p.id, mode: p.mode, idea: p.idea, status: p.status, model: p.model, costMinor: p.costMinor, createdAt: p.createdAt, createdTaskIds: p.createdTaskIds, createdByName: nameOf(p.createdBy) ?? "—", rows: p.rows.length })),
        monthSpendEurMinor: Math.round(spend * 100) / 100,
        capEurMinor: AI_MONTHLY_CAP_MINOR,
        blocked: spend >= AI_MONTHLY_CAP_MINOR,
      };
    },

    async splitTask(taskId) {
      const user = await viewer();
      requirePlanner(user);
      const s = await load();
      const t = s.tasks.find((x) => x.id === taskId && !x.deletedAt);
      if (!t) throw new AccessError(404);
      if (!ctx.canSeeTask(s, user, t)) throw new AccessError(403);
      if (t.parentId) throw new Error("Subtasks are one level deep; split the parent instead.");
      checkCap(s);
      const owner: OwnerKey = USER_TO_KEY[t.assigneeIds[0] ?? ""] ?? "rinor";
      const hours = Math.max(1, (t.estimateMinutes ?? 240) / 60);
      const settings: PlannerSettings = { deadline: t.dueAt, buffer: null, people: [owner], context: [], targetListId: t.listId };
      const req = buildRequest(s, "split", t.title, settings, { parent: JSON.stringify({ id: t.id, title: t.title, hours, owner, description: t.descriptionMd, category: t.category }) });
      const r = await callModel("planner_split", req, hours);
      const p = record(s, user, "split", t.title, settings, r, t.id);
      await save();
      if (!r.plan) throw new Error(`The split didn't pass validation: ${r.errors.slice(0, 2).join("; ")}`);
      return view(s, p);
    },

    async replan() {
      const user = await viewer();
      requirePlanner(user);
      const s = await load();
      checkCap(s);
      const weeks = weeksAhead();
      const res = schedule({ people: ctx.schedPeople(s), tasks: ctx.schedTasks(s), now: now(), weeks: weeks.slice(0, 5), agentReviewHours: AGENT.reviewHoursPerTask });
      const conflicts = res.conflicts
        .filter((c) => c.type === "late" || c.type === "over_capacity")
        .filter((c) => user.role === "admin" || ("personId" in c ? c.personId === user.id : s.tasks.find((t) => t.id === c.taskId)?.assigneeIds.includes(user.id)))
        .map((c) => {
          if (c.type !== "over_capacity") return c;
          const move = res.suggestions.find((x) => x.type === "move" && x.week === c.week && x.personId === c.personId)?.apply;
          const re = res.suggestions.find((x) => x.type === "reassign" && x.week === c.week && x.personId === c.personId)?.apply;
          return { ...c, suggestion: move?.kind === "shift" ? { taskId: move.taskId, days: move.days } : re?.kind === "reassign" ? { taskId: re.taskId, to: re.to } : undefined };
        });
      const settings: PlannerSettings = { deadline: null, buffer: null, people: user.role === "admin" ? ["rinor", "cofounder", "bdr"] : [USER_TO_KEY[user.id]], context: ["calendar"], targetListId: null };
      const req = buildRequest(s, "replan", "Re-plan: tasks are late or over capacity.", settings, { conflicts: JSON.stringify(conflicts) });
      const r = await callModel("planner", req);
      const p = record(s, user, "replan", req.idea, settings, r);
      p.changes = p.changes.map((c) => ({ ...c, title: s.tasks.find((t) => t.id === c.task_id)?.title }));
      await save();
      if (!r.plan) throw new Error(`The re-plan didn't pass validation: ${r.errors.slice(0, 2).join("; ")}`);
      return view(s, p);
    },

    async applyPlanChange(planId, index) {
      const user = await viewer();
      const s = await load();
      const p = getOwn(s, user, planId);
      const c = p.changes[index];
      if (!c) throw new AccessError(404);
      if (c.applied) return;
      const t = s.tasks.find((x) => x.id === c.task_id);
      if (!t) throw new AccessError(404);
      if (c.action === "move") {
        const days = Number(c.value);
        if (Number.isFinite(days)) ctx.patchTask(s, user, t.id, { dueAt: t.dueAt ? shiftDateKey(t.dueAt, days) : null, startAt: t.startAt ? shiftDateKey(t.startAt, days) : null });
        else if (c.value) ctx.patchTask(s, user, t.id, { dueAt: c.value });
      } else if (c.action === "move_deadline" && c.value) ctx.patchTask(s, user, t.id, { dueAt: c.value });
      else if (c.action === "reassign" && c.value) {
        const to = OWNER_KEYS[c.value as keyof typeof OWNER_KEYS] ?? c.value;
        ctx.patchTask(s, user, t.id, { assigneeIds: [to, ...t.assigneeIds.filter((a) => a !== to).slice(1)] });
      } else if (c.action === "re-estimate" && c.value) {
        const minutes = Math.round(Number(c.value) * 60);
        // Never shrink estimates.
        if (minutes > (t.estimateMinutes ?? 0)) ctx.patchTask(s, user, t.id, { estimateMinutes: minutes });
      } else if (c.action === "drop") {
        if (t.status === "done") throw new Error("Done work is never dropped.");
        ctx.patchTask(s, user, t.id, { status: "cancelled" });
      } else throw new Error("Split this task from its detail page (Split with AI).");
      c.applied = true;
      audit(user.id, "planner.apply_change", "task", t.id, null, c);
      await save();
    },

    async weeklyPicks() {
      const user = await viewer();
      requirePlanner(user);
      const s = await load();
      checkCap(s);
      const settings: PlannerSettings = { deadline: null, buffer: null, people: user.role === "admin" ? ["rinor", "cofounder", "bdr"] : [USER_TO_KEY[user.id]], context: ["calendar"], targetListId: null };
      const req = buildRequest(s, "weekly", "What should we do this week?", settings);
      // Only this week's open work belongs to people in the plan.
      const names = new Set(req.team.map((m) => m.name));
      req.existingWork = req.existingWork.filter((w) => w.owner && names.has(w.owner));
      const r = await callModel("planner", req);
      const p = record(s, user, "weekly", req.idea, settings, r);
      p.status = "accepted"; // a pick list: nothing to accept
      await save();
      if (!r.plan) throw new Error(`The weekly picks didn't pass validation: ${r.errors.slice(0, 2).join("; ")}`);
      return view(s, p);
    },

    async taskFit(taskId) {
      const user = await viewer();
      const s = await load();
      const t = s.tasks.find((x) => x.id === taskId && !x.deletedAt);
      if (!t) throw new AccessError(404);
      if (!ctx.canSeeTask(s, user, t)) throw new AccessError(403);
      const weeks = weeksAhead();
      const res = schedule({ people: ctx.schedPeople(s), tasks: ctx.schedTasks(s), now: now(), weeks, agentReviewHours: AGENT.reviewHoursPerTask });
      const pl = res.placements[t.id];
      const ownerId = t.assigneeIds[0] ?? null;
      const owner = nameOf(ownerId)?.split(" ")[0];
      if (!isOpen(t.status)) return { text: "Done. Nothing to schedule.", risks: [] };
      if (!owner || !pl) return { text: "Give the task an owner and an estimate to see how it fits.", risks: [] };
      const week = pl.chunks.length ? isoWeekKey([...pl.chunks].sort((a, b) => a.date.localeCompare(b.date))[0].date) : weeks[0];
      const cell = res.cells.find((c) => c.personId === ownerId && c.week === week);
      const fmt = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
      const agent = t.tags.includes("agent");
      const need = pl.needHours;
      const text = agent
        ? `Codex does the coding; ${owner} reviews (${fmtH(need)} h) ${pl.chunks[0] ? `on ${fmt(pl.chunks[0].date)}` : "when there's room"}.`
        : `${owner} has ${fmtH(cell?.free ?? 0)} h free in W${Number(week.slice(6))}; this task needs ${fmtH(need)} h more (with buffer). It's planned ${pl.start && pl.finish ? (pl.start === pl.finish ? `on ${fmt(pl.start)}` : `${fmt(pl.start)} – ${fmt(pl.finish)}`) : "when there's room"}.`;
      const risks: string[] = [];
      for (const c of res.conflicts) {
        if (c.type === "late" && c.taskId === t.id) risks.push(`Can't be done by ${fmt(c.due)}: the earliest finish is ${fmt(c.finish)}.`);
        if (c.type === "dependency" && c.taskId === t.id) risks.push(`Waits on "${s.tasks.find((x) => x.id === c.dependsOnId)?.title}", which finishes ${fmt(c.depFinish)}.`);
        if (c.type === "over_capacity" && c.personId === ownerId && pl.chunks.some((ch) => isoWeekKey(ch.date) === c.week)) risks.push(`${owner} is over capacity in W${Number(c.week.slice(6))} (${fmtH(c.used)} / ${fmtH(c.cap)} h).`);
      }
      return { text, risks };
    },
  };

  // ---------------------------------------------------------------- automations

  let depth = 0;
  /** Run matching automations for an event. Actions don't trigger further automations (no loops). */
  const fire = (s: S, e: AutomationEvent) => {
    if (depth > 0) return;
    depth++;
    try {
      for (const a of matching(s.automations, e)) {
        const results: string[] = [];
        let ok = true;
        try {
          for (const act of a.actions) results.push(runAction(s, a, act, e));
        } catch (err) {
          ok = false;
          results.push(`Failed: ${(err as Error).message}`);
        }
        a.runs++;
        a.lastRunAt = iso();
        s.automationRuns.unshift({ id: uid("ar"), automationId: a.id, at: iso(), event: e.type, subject: subjectOf(s, e), result: results.join(" · "), ok });
        s.automationRuns.splice(200);
      }
    } finally {
      depth--;
    }
  };

  const subjectOf = (s: S, e: AutomationEvent) => (e.type === "deal_won" ? `Deal · ${ctx.companyOfDeal(s, e.dealId)}` : `Task · ${s.tasks.find((t) => t.id === e.taskId)?.title ?? e.taskId}`);

  const resolveUser = (s: S, who: string, e: AutomationEvent): string[] => {
    const task = "taskId" in e ? s.tasks.find((t) => t.id === e.taskId) : undefined;
    if (who === "deal_owner") return e.type === "deal_won" && e.ownerId ? [e.ownerId] : [];
    if (who === "implementer") return users.filter((u) => u.role === "implementer" && u.active).slice(0, 1).map((u) => u.id);
    if (who === "admin" || who === "admins") return admins().map((u) => u.id);
    if (who === "trigger_assignees" || who === "assignee") return task?.assigneeIds ?? [];
    if (who === "trigger_creator") return task?.createdBy ? [task.createdBy] : [];
    return users.some((u) => u.id === who) ? [who] : [];
  };

  const runAction = (s: S, a: Automation, act: Automation["actions"][number], e: AutomationEvent): string => {
    const text = (tpl: string) => tpl.replace("{{task}}", "taskId" in e ? (s.tasks.find((t) => t.id === e.taskId)?.title ?? "") : "").replace("{{company}}", e.type === "deal_won" ? ctx.companyOfDeal(s, e.dealId) : "");
    if (act.type === "create_tasks_from_template") {
      const tpl = s.taskTemplates.find((x) => x.id === act.templateId);
      if (!tpl) throw new Error("Template not found");
      const at = localDateKey(now(), "UTC");
      const linked = e.type === "deal_won" ? (act.link === "client" && e.clientId ? { type: "client" as const, id: e.clientId } : act.link === "lead" ? { type: "lead" as const, id: e.leadId } : act.link === "none" ? null : { type: "deal" as const, id: e.dealId }) : null;
      const subject = e.type === "deal_won" ? ctx.companyOfDeal(s, e.dealId) : "";
      let prev: string | null = null;
      for (const it of instantiate(tpl, at)) {
        const who = it.role === "assignee" ? act.assignee : it.role;
        const t = ctx.addSystemTask(s, {
          spaceName: act.spaceName, listName: act.listName, title: subject ? `${it.title} · ${subject}` : it.title, assigneeIds: resolveUser(s, who, e).slice(0, 1), dueAt: it.dueAt,
          linked, tags: [`template:${tpl.id}`], priority: it.priority, estimateMinutes: it.estimateHours ? Math.round(it.estimateHours * 60) : null, category: it.category, checklist: it.checklist,
          descriptionMd: `From the "${tpl.name}" template (automation "${a.name}").`,
        });
        if (it.dependsOnPrevious && prev) ctx.addDep(s, t.id, prev);
        prev = t.id;
      }
      return `Created ${tpl.items.length} tasks from "${tpl.name}"`;
    }
    if (act.type === "notify") {
      const to = resolveUser(s, act.to, e);
      for (const u of to) notify({ userId: u, type: "task", text: text(act.text), href: "taskId" in e ? `/tasks/${e.taskId}` : e.type === "deal_won" ? `/deals/${e.dealId}` : "/tasks" });
      return `Notified ${to.map((u) => nameOf(u)?.split(" ")[0]).join(", ") || "nobody"}`;
    }
    if (!("taskId" in e)) return "Skipped (needs a task)";
    const task = s.tasks.find((t) => t.id === e.taskId);
    if (!task) return "Skipped (task gone)";
    if (act.type === "set_status") ctx.systemPatch(s, task.id, { status: act.status, completedAt: act.status === "done" ? iso() : null }, `Automation "${a.name}": status → ${act.status}`);
    else if (act.type === "set_priority") ctx.systemPatch(s, task.id, { priority: act.priority }, `Automation "${a.name}": priority → ${act.priority}`);
    else if (act.type === "add_tag" && !task.tags.includes(act.tag)) ctx.systemPatch(s, task.id, { tags: [...task.tags, act.tag] }, `Automation "${a.name}": tagged ${act.tag}`);
    return `Updated "${task.title}"`;
  };

  /** Daily: fire "due date passed" once per task and due date. */
  const tick = (s: S) => {
    const today = localDateKey(now(), "UTC");
    let changed = false;
    for (const t of s.tasks) {
      if (t.deletedAt || !t.dueAt || t.dueAt >= today || !isOpen(t.status) || s.dueFired[t.id] === t.dueAt) continue;
      s.dueFired[t.id] = t.dueAt;
      changed = true;
      fire(s, { type: "due_date_passed", taskId: t.id, listId: t.listId, priority: t.priority, category: t.category });
    }
    return changed;
  };

  const seedAutomations = (s: S) => {
    if (s.taskTemplates.length) return;
    const at = iso();
    const tplG: TaskTemplate = {
      id: "tpl-gllarix-onboarding", name: "Gllarix onboarding", description: "SOP 3: from deposit to go-live and the first check-in.", updatedAt: at,
      items: [
        { title: "Send the intake form", estimateHours: 0.5, dueOffsetDays: 1, category: "Delivery", priority: "high", role: "assignee" },
        { title: "Draft the agent from the website FAQ", estimateHours: 2, dueOffsetDays: 3, category: "Delivery", priority: "high", role: "assignee", dependsOnPrevious: true },
        { title: "Forward the business number and test routing", estimateHours: 1, dueOffsetDays: 5, category: "Delivery", priority: "high", role: "assignee", dependsOnPrevious: true },
        { title: "Run the automatic test calls", estimateHours: 1, dueOffsetDays: 6, category: "Delivery", priority: "high", role: "assignee", dependsOnPrevious: true, checklist: ["After-hours call answered", "Booking lands in the calendar", "Missed-call text sent"] },
        { title: "Go live and start billing", estimateHours: 0.5, dueOffsetDays: 7, category: "Delivery", priority: "high", role: "assignee", dependsOnPrevious: true },
        { title: "30-day check-in call", estimateHours: 0.5, dueOffsetDays: 37, category: "Sales", priority: "normal", role: "deal_owner" },
      ],
    };
    const tplA: TaskTemplate = {
      id: "tpl-arcadian-3d", name: "Arcadian 3D project", description: "From kickoff to launch of a 3D sales platform.", updatedAt: at,
      items: [
        { title: "Kickoff call and scope", estimateHours: 1, dueOffsetDays: 2, category: "Delivery", priority: "high", role: "deal_owner" },
        { title: "Collect plans, renders and the unit list", estimateHours: 1, dueOffsetDays: 5, category: "Delivery", priority: "high", role: "assignee", dependsOnPrevious: true },
        { title: "Model the building in 3D", estimateHours: 16, dueOffsetDays: 20, category: "Delivery", priority: "high", role: "assignee", dependsOnPrevious: true },
        { title: "Load unit data into the picker", estimateHours: 2, dueOffsetDays: 24, category: "Development", priority: "normal", role: "assignee", dependsOnPrevious: true },
        { title: "Client review round", estimateHours: 1, dueOffsetDays: 27, category: "Delivery", priority: "normal", role: "deal_owner", dependsOnPrevious: true },
        { title: "Launch and hand over", estimateHours: 1, dueOffsetDays: 30, category: "Delivery", priority: "high", role: "assignee", dependsOnPrevious: true },
      ],
    };
    s.taskTemplates.push(tplG, tplA);
    const auto = (id: string, name: string, trigger: Automation["trigger"], conditions: Automation["conditions"], actions: Automation["actions"]): Automation => ({ id, name, trigger, conditions, actions, active: true, createdBy: null, createdAt: at, runs: 0, lastRunAt: null });
    s.automations.push(
      auto("au-won-gllarix", "Deal won (Gllarix) → onboarding tasks", { type: "deal_won" }, [{ field: "brand", op: "eq", value: "gllarix" }], [
        { type: "create_tasks_from_template", templateId: tplG.id, spaceName: "Delivery", listName: "Onboarding", assignee: "implementer", link: "client" },
      ]),
      auto("au-won-arcadian", "Deal won (Arcadian) → 3D project tasks", { type: "deal_won" }, [{ field: "brand", op: "eq", value: "arcadian" }], [
        { type: "create_tasks_from_template", templateId: tplA.id, spaceName: "Delivery", listName: "3D projects", assignee: "implementer", link: "deal" },
      ]),
      auto("au-review", "Task moved to Review → tell its creator", { type: "task_status_changed" }, [{ field: "to", op: "eq", value: "review" }], [{ type: "notify", to: "trigger_creator", text: "Ready for review: {{task}}" }]),
      auto("au-overdue-urgent", "Urgent task overdue → alert admins", { type: "due_date_passed" }, [{ field: "priority", op: "eq", value: "urgent" }], [{ type: "notify", to: "admins", text: "Overdue and urgent: {{task}}" }]),
    );
    const g = (id: string, title: string, kpi: GoalKpi, target: number, dueAt: string, ownerId: string): Goal => ({ id, title, kpi, target, dueAt, ownerId, createdAt: "2026-09-28T00:00:00.000Z" });
    s.goals.push(
      g("goal-mrr", "€10k MRR by June 2027", "mrr_eur", 10000, "2027-06-30", "u-rinor"),
      g("goal-gate1", "Gate 1 · 3 paying clients", "paying_clients", 3, "2026-12-31", "u-cofounder"),
      g("goal-meetings", "20 approved meetings in October", "approved_meetings_month", 20, "2026-10-31", "u-bdr"),
    );
  };

  const requireAdmin = (u: User) => {
    if (u.role !== "admin") throw new AccessError(403, "Only admins change automations and templates.");
  };

  const automationsApi: AutomationsApi = {
    async listAutomations() {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const s = await load();
      return { automations: s.automations, templates: s.taskTemplates, runs: s.automationRuns.slice(0, 50) };
    },
    async saveAutomation(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      if (!input.name.trim()) throw new Error("Name the automation.");
      if (!input.actions.length) throw new Error("Add at least one action.");
      for (const act of input.actions) if (act.type === "create_tasks_from_template" && !s.taskTemplates.some((t) => t.id === act.templateId)) throw new Error("Pick a template.");
      let a = input.id ? s.automations.find((x) => x.id === input.id) : undefined;
      if (a) Object.assign(a, { name: input.name.trim(), trigger: input.trigger, conditions: input.conditions, actions: input.actions, active: input.active ?? a.active });
      else {
        a = { id: uid("au"), name: input.name.trim(), trigger: input.trigger, conditions: input.conditions, actions: input.actions, active: input.active ?? true, createdBy: user.id, createdAt: iso(), runs: 0, lastRunAt: null };
        s.automations.push(a);
      }
      audit(user.id, "automation.save", "automation", a.id, null, a);
      await save();
      return a;
    },
    async setAutomationActive(id, active) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const a = s.automations.find((x) => x.id === id);
      if (!a) throw new AccessError(404);
      a.active = active;
      await save();
    },
    async deleteAutomation(id) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      s.automations = s.automations.filter((a) => a.id !== id);
      await save();
    },
    async saveTaskTemplate(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      if (!input.name.trim() || !input.items.length) throw new Error("A template needs a name and at least one task.");
      if (input.items.some((i) => !i.title.trim() || i.dueOffsetDays < 0)) throw new Error("Each task needs a title and a due offset of 0 or more days.");
      let t = input.id ? s.taskTemplates.find((x) => x.id === input.id) : undefined;
      if (t) Object.assign(t, { name: input.name.trim(), description: input.description, items: input.items, updatedAt: iso() });
      else {
        t = { id: uid("tpl"), name: input.name.trim(), description: input.description, items: input.items, updatedAt: iso() };
        s.taskTemplates.push(t);
      }
      await save();
      return t;
    },
    async deleteTaskTemplate(id) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      if (s.automations.some((a) => a.actions.some((x) => x.type === "create_tasks_from_template" && x.templateId === id))) throw new Error("An automation uses this template. Change it first.");
      s.taskTemplates = s.taskTemplates.filter((t) => t.id !== id);
      await save();
    },
    async listGoals() {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const s = await load();
      const today = localDateKey(now(), "UTC");
      return s.goals.map((g): GoalView => {
        const pr = goalProgress(g, ctx.kpiValue(s, g.kpi), today);
        const linked = s.tasks.filter((t) => !t.deletedAt && t.goalId === g.id);
        return { goal: g, ...pr, ownerName: nameOf(g.ownerId), tasks: { open: linked.filter((t) => isOpen(t.status)).length, done: linked.filter((t) => t.status === "done").length } };
      });
    },
    async saveGoal(input) {
      const user = await viewer();
      requireAdmin(user);
      if (!input.title.trim() || !(input.target > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueAt)) throw new Error("A goal needs a title, a target above 0 and a due date.");
      const s = await load();
      let g = input.id ? s.goals.find((x) => x.id === input.id) : undefined;
      if (g) Object.assign(g, { title: input.title.trim(), kpi: input.kpi, target: input.target, dueAt: input.dueAt, ownerId: input.ownerId });
      else {
        g = { id: uid("goal"), title: input.title.trim(), kpi: input.kpi, target: input.target, dueAt: input.dueAt, ownerId: input.ownerId, createdAt: iso() };
        s.goals.push(g);
      }
      await save();
      return g;
    },
    async deleteGoal(id) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      s.goals = s.goals.filter((g) => g.id !== id);
      for (const t of s.tasks) if (t.goalId === id) t.goalId = null;
      await save();
    },
  };

  return { planner, automationsApi, fire, tick, seedAutomations, DAY };
};
