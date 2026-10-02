import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { createFakeAIProvider, type AIProvider } from "@/services/aiProvider";
import { nextOccurrence } from "@/services/automations";
import { PLAN_SCHEMA, renderPrompt, validatePlan, type PlannerRequest, type PlannerSettings } from "@/services/planner";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026
const PW = "pw";

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}
const switchTo = async (src: DataSource, email: string) => {
  await src.signOut();
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};
/** A provider wrapper that counts calls. */
const counting = (inner: AIProvider) => {
  const c = { calls: 0 };
  const p: AIProvider = { complete: (job, req, e) => ((c.calls += 1), inner.complete(job, req, e)) };
  return { p, c };
};
const source = async (email: string, opts: { provider?: AIProvider; now?: () => number } = {}) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now: opts.now ?? (() => NOW), storage: new MemoryStorage(), aiProvider: opts.provider });
  await switchTo(src, email);
  return src;
};

const IDEA = "Launch a 3D showcase for developer outreach: one demo building with a unit picker, a landing page, and outreach to 20 Dubai developers. Done by 31 Oct.";
const SETTINGS: PlannerSettings = { deadline: "2026-10-31", buffer: 0.3, people: ["rinor", "cofounder", "codex", "freelancer"], context: ["price_book", "sales_plan", "calendar"], targetListId: null };
const allTasks = async (src: DataSource) => (await src.listTasks({})).length + (await src.listTasks({ myWork: true })).length;

describe("planner validation (Appendix 5)", () => {
  const req = { mode: "plan" as const, settings: SETTINGS, existingWork: [{ id: "tk-1", title: "x", owner: null, hours: 1, start: null, due: null, status: "todo", priority: "normal" }] };
  const task = (over: Record<string, unknown> = {}) => ({ key: "1", title: "Do it", description: "d", acceptance: ["ok"], owner: "rinor", category: "Development", priority: "High", estimate_hours: 2, confidence: "medium", depends_on: [], ...over });
  const plan = (tasks: unknown[]) => JSON.stringify({ outcome: "o", tasks, risks: [], open_questions: [] });

  it("accepts a valid plan and existing-task dependencies", () => {
    expect(validatePlan(plan([task(), task({ key: "2", depends_on: ["1", "tk-1"] })]), req).ok).toBe(true);
  });

  it("rejects invalid JSON, unknown owners, estimates outside 0.5–40 h, unknown or cyclic dependencies", () => {
    expect(validatePlan("Sure! here it is", req)).toEqual({ ok: false, errors: ["The answer isn't valid JSON."] });
    const bad = validatePlan(plan([task({ owner: "ceo" }), task({ key: "2", estimate_hours: 41 }), task({ key: "3", estimate_hours: 0.25 }), task({ key: "4", depends_on: ["nope"] })]), req);
    expect(bad.ok).toBe(false);
    const errs = bad.ok ? [] : bad.errors.join("\n");
    expect(errs).toMatch(/unknown owner "ceo"/);
    expect(errs).toMatch(/tasks\[1\] \(2\)\.estimate_hours/);
    expect(errs).toMatch(/tasks\[2\] \(3\)\.estimate_hours/);
    expect(errs).toMatch(/unknown "nope"/);
    const cyc = validatePlan(plan([task({ depends_on: ["2"] }), task({ key: "2", depends_on: ["1"] })]), req);
    expect(cyc.ok ? "" : cyc.errors.join()).toMatch(/cycle/);
    expect(validatePlan(plan([task({ owner: "bdr" })]), { ...req, settings: { ...SETTINGS, people: ["rinor"] } }).ok).toBe(false);
  });

  it("split mode: 2–8 subtasks adding up to the parent ±20%", () => {
    const sub = (h: number, k: string) => task({ key: k, estimate_hours: h });
    expect(validatePlan(plan([sub(2, "1"), sub(2, "2")]), { ...req, mode: "split", parentEstimate: 4 }).ok).toBe(true);
    expect(validatePlan(plan([sub(2, "1"), sub(5, "2")]), { ...req, mode: "split", parentEstimate: 4 }).ok).toBe(false);
    expect(validatePlan(plan([sub(4, "1")]), { ...req, mode: "split", parentEstimate: 4 }).ok).toBe(false);
  });

  const promptPath = resolve(__dirname, "../../spec/prompts/TASK_PLANNER_SYSTEM_PROMPT.md");
  it("renders every block of the runtime prompt", () => {
    const template = existsSync(promptPath) ? readFileSync(promptPath, "utf8") : "<schema>{{JSON_SCHEMA}}</schema><settings>{{SETTINGS}}</settings><team>{{TEAM}}</team><existing_work>{{EXISTING_WORK}}</existing_work><context>{{CONTEXT}}</context><idea>{{IDEA}}</idea>";
    const r: PlannerRequest = { mode: "plan", idea: IDEA, settings: SETTINGS, team: [], existingWork: [], context: { calendar: "Today 2026-10-01" }, schema: PLAN_SCHEMA };
    const out = renderPrompt(template, r);
    expect(out).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(out).toContain(IDEA);
    expect(out).toContain('"estimate_hours"');
  });
});

describe("AI planner (M11 done-when)", () => {
  it("the 3D showcase idea gives 9 tasks, 20 team hours, a finish before 31 Oct and the 3 flags; nothing is saved before Accept", async () => {
    const { p, c } = counting(createFakeAIProvider());
    const src = await source("rinor@atlas.test", { provider: p });
    const before = await allTasks(src);
    const plan = await src.createPlan({ idea: IDEA, settings: SETTINGS });
    expect(await allTasks(src)).toBe(before);
    expect(plan.rows).toHaveLength(9);
    expect(plan.schedule.summary).toMatchObject({ tasks: 9, teamHours: 20, externalHours: 16, beforeDeadline: true });
    expect(plan.schedule.summary.finish! <= "2026-10-31").toBe(true);
    const flags = plan.schedule.flags.join("\n");
    // The mockup's world has Rinor full on 3–4 Oct; in the seeded Q4 plan his next weekend (10–11 Oct, 14 / 12 h) is full.
    expect(flags).toMatch(/^Rinor is full on \d+–\d+ Oct \(.+\)\. "Build the showcase landing page" moved to \d+–\d+ Oct\.$/m);
    expect(flags).toMatch(/UAE outreach rules aren't verified yet\. Task 8 waits on "Confirm country rules/);
    expect(flags).toMatch(/Freelancer cost isn't in the budget yet: add a quote, \[€ amount\]\./);
    expect(c.calls).toBe(1);

    // Editing an estimate re-runs the scheduler, not the AI.
    const finish = plan.schedule.rows.find((r) => r.key === "9")!.finish;
    const edited = await src.updatePlanRow(plan.id, "9", { estimateHours: 12 });
    expect(edited.schedule.rows.find((r) => r.key === "9")!.finish! > finish!).toBe(true);
    expect(c.calls).toBe(1);
    expect(await allTasks(src)).toBe(before);

    // Accept: tasks, dependencies, a review subtask for Codex; labelled AI, accepted by Rinor.
    const res = await src.acceptPlan(plan.id);
    const tasks = await src.listTasks({});
    const made = tasks.filter((t) => t.task.planId === plan.id);
    expect(made).toHaveLength(9);
    expect(made.every((t) => t.task.createdByAi && t.task.acceptedBy === "u-rinor")).toBe(true);
    const picker = made.find((t) => /unit picker/.test(t.task.title))!;
    expect(picker.task.tags).toContain("codex");
    const detail = await src.getTask(picker.task.id);
    expect(detail.subtasks.map((x) => x.task.title)).toContain("Review: Build the unit picker with live availability");
    expect(detail.subtasks.find((x) => x.task.title.startsWith("Review"))!.task.assigneeIds).toEqual(["u-rinor"]);
    expect(detail.waitingOn.map((w) => w.task.title)).toEqual(["Model the building in 3D"]);
    const outreach = made.find((t) => /outreach sequence/.test(t.task.title))!;
    expect((await src.getTask(outreach.task.id)).waitingOn.map((w) => w.task.title)).toEqual(expect.arrayContaining(["Confirm country rules with a lawyer"]));
    expect(res.created).toBe(10); // 9 tasks + the review subtask
    await expect(src.updatePlanRow(plan.id, "1", { estimateHours: 3 })).rejects.toThrow(/accepted/);
  });

  it("retries once on invalid JSON and costs both attempts", async () => {
    const src = await source("rinor@atlas.test", { provider: createFakeAIProvider({ failFirst: true }) });
    const plan = await src.createPlan({ idea: IDEA, settings: SETTINGS });
    expect(plan.attempts).toBe(2);
    expect(plan.costMinor).toBeGreaterThan(0);
    const log = await src.planLog();
    expect(log.plans[0]).toMatchObject({ id: plan.id, status: "draft" });
    expect(log.monthSpendEurMinor).toBeGreaterThan(0);
  });

  it("the monthly AI cap blocks new plans and notifies admins", async () => {
    const pricey: AIProvider = { complete: async (job, req) => ({ ...(await createFakeAIProvider().complete(job, req)), costMinor: 3600 }) };
    const src = await source("rinor@atlas.test", { provider: pricey });
    await src.createPlan({ idea: IDEA, settings: SETTINGS });
    await expect(src.createPlan({ idea: IDEA, settings: SETTINGS })).rejects.toThrow(/monthly AI cap/);
    expect((await src.planLog()).blocked).toBe(true);
    expect((await src.listNotifications("u-rinor")).some((n) => /AI planner paused/.test(n.text))).toBe(true);
  });

  it("people other than admins plan only for themselves", async () => {
    const src = await source("diego@atlas.test");
    await expect(src.createPlan({ idea: "Call back the September leads", settings: SETTINGS })).rejects.toMatchObject({ status: 403 });
    const own = await src.createPlan({ idea: "Call back the September leads, then send the recap", settings: { ...SETTINGS, people: ["bdr"] } });
    expect(own.rows.every((r) => r.owner === "bdr")).toBe(true);
  });

  it("tasks from notes: action lines become tasks, the source is linked", async () => {
    const src = await source("rinor@atlas.test");
    const plan = await src.createPlan({ idea: "Call with Artin\n- Send the Stripe checklist @rinor\nTODO: Book the lawyer\nrandom chatter", settings: { ...SETTINGS, source: "notes" } });
    expect(plan.rows.map((r) => r.title)).toEqual(["Send the Stripe checklist", "Book the lawyer"]);
    expect(plan.rows[0].owner).toBe("rinor");
    await src.acceptPlan(plan.id);
    const t = (await src.searchTasks("Stripe checklist"))[0];
    expect((await src.getTask(t.task.id)).task.descriptionMd).toMatch(/From notes/);
  });

  it("split with AI creates nothing until Accept", async () => {
    const src = await source("rinor@atlas.test");
    const t = (await src.searchTasks("demo-line walkthrough"))[0].task;
    const draft = await src.splitTask(t.id);
    const sum = draft.rows.reduce((n, r) => n + r.estimateHours, 0);
    expect(draft.rows.length).toBeGreaterThanOrEqual(2);
    expect(sum).toBeGreaterThanOrEqual((t.estimateMinutes! / 60) * 0.8);
    expect((await src.getTask(t.id)).subtasks).toHaveLength(0);
    await src.acceptPlan(draft.id);
    expect((await src.getTask(t.id)).subtasks.map((x) => x.task.title)).toEqual(draft.rows.map((r) => r.title));
  });

  it("re-plan proposes changes from conflicts; each applies with one click", async () => {
    const src = await source("rinor@atlas.test");
    const plan = await src.replan();
    expect(plan.changes.length).toBeGreaterThan(0);
    const i = plan.changes.findIndex((c) => c.action === "move");
    const before = (await src.getTask(plan.changes[i].task_id)).task.dueAt!;
    await src.applyPlanChange(plan.id, i);
    expect((await src.getTask(plan.changes[i].task_id)).task.dueAt! > before).toBe(true);
  });

  it("weekly picks fit free hours and write nothing", async () => {
    const src = await source("rinor@atlas.test");
    const before = await allTasks(src);
    const w = await src.weeklyPicks();
    expect(w.rows.length).toBeGreaterThan(0);
    expect(w.rows.every((r) => r.reusesTaskId)).toBe(true);
    expect(await allTasks(src)).toBe(before);
  });

  it("task detail's planner card explains the capacity fit", async () => {
    const src = await source("rinor@atlas.test");
    const t = (await src.searchTasks("demo-line walkthrough"))[0].task;
    const fit = await src.taskFit(t.id);
    expect(fit.text).toMatch(/^Rinor has [\d.]+ h free in W4\d; this task needs [\d.]+ h more/);
    expect(fit.risks.join()).toMatch(/over capacity in W41/);
  });
});

describe("automations, templates, recurring tasks, goals", () => {
  it("deal Won (Gllarix) creates the onboarding tasks from the template, linked to the deal and chained", async () => {
    const src = await source("rinor@atlas.test");
    const deal = (await src.listDeals()).find((d) => d.deal.brand === "gllarix" && d.deal.stage !== "won" && d.deal.stage !== "lost")!;
    await src.moveDeal(deal.deal.id, { stage: "won", overrideReason: "Paid by bank transfer" });
    const onboarding = (await src.tasksHome()).spaces.find((x) => x.space.name === "Delivery")!.lists.find((l) => l.name === "Onboarding")!;
    const tasks = (await src.listTasks({ listId: onboarding.id })).filter((t) => t.task.title.includes(deal.company.name));
    expect(tasks.map((t) => t.task.title.split(" · ")[0])).toEqual(["Send the intake form", "Draft the agent from the website FAQ", "Forward the business number and test routing", "Run the automatic test calls", "Go live and start billing", "30-day check-in call"]);
    expect(tasks[0].task.assigneeIds).toEqual(["u-implementer"]);
    expect(tasks[0].task.linked).toMatchObject({ type: "deal", id: deal.deal.id });
    expect((await src.getTask(tasks[1].task.id)).waitingOn.map((w) => w.task.id)).toEqual([tasks[0].task.id]);
    const { automations, runs } = await src.listAutomations();
    expect(automations.find((a) => a.id === "au-won-gllarix")?.runs).toBe(1);
    expect(runs[0]).toMatchObject({ automationId: "au-won-gllarix", ok: true });
    // A paused automation doesn't run.
    await src.setAutomationActive("au-won-gllarix", false);
    const other = (await src.listDeals()).find((d) => d.deal.brand === "gllarix" && d.deal.stage !== "won" && d.deal.stage !== "lost" && d.deal.id !== deal.deal.id)!;
    await src.moveDeal(other.deal.id, { stage: "won", overrideReason: "x" });
    expect((await src.listTasks({ listId: onboarding.id })).some((t) => t.task.title.includes(other.company.name))).toBe(false);
  });

  it("task moved to Review notifies its creator; an overdue urgent task alerts admins once", async () => {
    let now = NOW;
    const src = await source("artin@atlas.test", { now: () => now });
    const list = (await src.tasksHome()).spaces.find((x) => x.space.name === "Company")!.lists[0];
    const t = await src.createTask({ listId: list.id, title: "Check the automation", priority: "urgent", dueAt: "2026-10-02", assigneeIds: ["u-cofounder"] });
    await switchTo(src, "rinor@atlas.test");
    await src.updateTask(t.id, { status: "review" });
    expect((await src.listNotifications("u-cofounder")).some((n) => n.text === "Ready for review: Check the automation")).toBe(true);
    now = Date.UTC(2026, 9, 5, 9);
    await switchTo(src, "rinor@atlas.test");
    await src.tasksHome();
    await src.tasksHome();
    expect((await src.listNotifications("u-rinor")).filter((n) => n.text === "Overdue and urgent: Check the automation")).toHaveLength(1);
  });

  it("recurring: completing one creates the next", async () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1 }, "2026-10-02")).toBe("2026-10-09");
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence({ freq: "weekdays", interval: 1 }, "2026-10-02")).toBe("2026-10-05");
    const src = await source("rinor@atlas.test");
    const list = (await src.tasksHome()).spaces[0].lists[0];
    const t = await src.createTask({ listId: list.id, title: "Weekly pipeline review", dueAt: "2026-10-02" });
    await src.updateTask(t.id, { recurrence: { freq: "weekly", interval: 1 } });
    await src.updateTask(t.id, { status: "done" });
    const next = (await src.searchTasks("Weekly pipeline review")).find((r) => r.task.id !== t.id)!;
    expect(next.task).toMatchObject({ dueAt: "2026-10-09", status: "todo", recurrence: { freq: "weekly", interval: 1 } });
  });

  it("goals read their KPI and count linked tasks", async () => {
    const src = await source("rinor@atlas.test");
    const goals = await src.listGoals();
    const mrr = goals.find((g) => g.goal.id === "goal-mrr")!;
    expect(mrr.current).toBeGreaterThan(0);
    expect(mrr.pct).toBeLessThan(1);
    const t = (await src.searchTasks("demo-line walkthrough"))[0].task;
    await src.updateTask(t.id, { goalId: "goal-mrr" });
    expect((await src.listGoals()).find((g) => g.goal.id === "goal-mrr")!.tasks.open).toBe(1);
    await expect(src.saveGoal({ title: "", kpi: "mrr_eur", target: 0, dueAt: "x", ownerId: null })).rejects.toThrow();
  });
});
