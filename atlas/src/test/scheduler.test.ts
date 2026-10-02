import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { dayCap, schedule, topoOrder, weekCap, windowHours, type SchedPerson, type SchedTask } from "@/services/scheduler";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026 (W40)
const W = (n: number) => `2026-W${n}`;
const WEEKS = [W(40), W(41), W(42), W(43), W(44)];

const person = (over: Partial<SchedPerson> & { id: string }): SchedPerson => ({
  name: over.id, timezone: "Europe/Belgrade", windows: { sat: "09:00-15:00", sun: "09:00-15:00" }, split: { development: 1 }, skills: ["development"], focusFactor: 0.8, buffer: 0, timeOff: [], ...over,
});
const task = (over: Partial<SchedTask> & { id: string }): SchedTask => ({
  title: over.id, ownerId: "r", category: "Development", priority: "normal", startAt: null, dueAt: null, remainingHours: 2, agent: false, dependsOn: [], milestone: false, ...over,
});
const run = (people: SchedPerson[], tasks: SchedTask[], now = NOW) => schedule({ people, tasks, now, weeks: WEEKS, agentReviewHours: 1.5 });
const cell = (r: ReturnType<typeof run>, pid: string, week: string) => r.cells.find((c) => c.personId === pid && c.week === week)!;

describe("capacity", () => {
  it("window hours, planned share and time off", () => {
    expect(windowHours("09:00-15:00")).toBe(6);
    expect(windowHours("08:00-12:00, 13:00-17:30")).toBe(8.5);
    const cof = person({ id: "c", windows: { mon: "08:00-15:00", tue: "08:00-15:00", wed: "08:00-15:00", thu: "08:00-15:00", fri: "08:00-15:00" }, split: { sales: 0.63, operations: 0.23, development: 0.14 }, planned: ["operations", "development"] });
    expect(weekCap(cof, W(41))).toBe(13); // 35 h × 37% ops + dev (mockup "Ops + dev · 13 h")
    const r = person({ id: "r", timeOff: [{ from: "2026-10-10", to: "2026-10-10" }] });
    expect(weekCap(r, W(41))).toBe(6);
    expect(dayCap(r, "2026-10-11")).toBe(6);
  });

  it("windows are in each person's timezone: 'today' differs at the same instant", () => {
    // 02:00 UTC on Sat 3 Oct is still Friday evening in Caracas: the BDR's Friday window is in the past, so a task due Friday is late.
    const at = Date.UTC(2026, 9, 3, 2, 0);
    const bdr = person({ id: "b", timezone: "America/Caracas", windows: { fri: "08:00-16:00", mon: "08:00-16:00" } });
    const rin = person({ id: "r" });
    const res = run([bdr, rin], [task({ id: "fri", ownerId: "b", dueAt: "2026-10-02" }), task({ id: "sat", ownerId: "r", dueAt: "2026-10-03" })], at);
    expect(res.placements.fri.chunks[0].date).toBe("2026-10-02"); // still Friday locally: fits
    expect(res.placements.sat.chunks[0].date).toBe("2026-10-03");
    const later = run([bdr], [task({ id: "fri", ownerId: "b", dueAt: "2026-10-02" })], Date.UTC(2026, 9, 3, 12, 0));
    expect(later.placements.fri.chunks[0].date).toBe("2026-10-05");
    expect(later.conflicts).toContainEqual({ type: "late", taskId: "fri", due: "2026-10-02", finish: "2026-10-05" });
  });
});

describe("placement", () => {
  it("applies the buffer, fills back from the deadline at focus × window, in 30-minute chunks", () => {
    const r = person({ id: "r", buffer: 0.3 });
    const res = run([r], [task({ id: "a", remainingHours: 8, dueAt: "2026-10-11" })]);
    const p = res.placements.a;
    expect(p.needHours).toBe(10.5); // 8 × 1.3 = 10.4 → 10.5
    // 6 h windows × 0.8 focus = 4.8 → 4.5 h a day, latest days first.
    expect(p.chunks.map((c) => [c.date, c.hours])).toEqual([
      ["2026-10-11", 4.5],
      ["2026-10-10", 4.5],
      ["2026-10-04", 1.5],
    ]);
    expect(p.chunks.every((c) => c.hours >= 0.5 && (c.hours * 2) % 1 === 0)).toBe(true);
  });

  it("a start date spreads the work from start to due", () => {
    const res = run([person({ id: "r" })], [task({ id: "a", remainingHours: 4, startAt: "2026-10-03", dueAt: "2026-10-11" })]);
    expect(res.placements.a.chunks.map((c) => [c.date, c.hours])).toEqual([
      ["2026-10-03", 1],
      ["2026-10-04", 1],
      ["2026-10-10", 1],
      ["2026-10-11", 1],
    ]);
  });

  it("tasks without a deadline go forward into free hours (window × focus − scheduled)", () => {
    const res = run([person({ id: "r" })], [task({ id: "dated", remainingHours: 4, dueAt: "2026-10-03" }), task({ id: "free", remainingHours: 6 })]);
    // Sat 3 Oct has 6 × 0.8 = 4.8 → 4.5 free in chunks; 4 are taken, so 0.5 left; Sun 4 Oct takes 4.5; the rest Sat 10 Oct.
    expect(res.placements.free.chunks.map((c) => [c.date, c.hours])).toEqual([
      ["2026-10-03", 0.5],
      ["2026-10-04", 4.5],
      ["2026-10-10", 1],
    ]);
    expect(res.suggestions.find((s) => s.type === "schedule")).toMatchObject({ apply: { kind: "dates", taskId: "free", startAt: "2026-10-03", dueAt: "2026-10-10" } });
  });

  it("orders by dependencies, then priority and deadline; nothing starts before its dependencies finish", () => {
    const tasks = [task({ id: "b", dependsOn: ["a"], priority: "urgent" }), task({ id: "a", priority: "low", remainingHours: 9 }), task({ id: "c", priority: "high" })];
    expect(topoOrder(tasks).map((t) => t.id)).toEqual(["c", "a", "b"]);
    const res = run([person({ id: "r" })], tasks);
    expect(res.placements.b.start! >= res.placements.a.finish!).toBe(true);
  });

  it("flags a dependency finishing after the deadline", () => {
    const res = run([person({ id: "r" })], [task({ id: "a", dueAt: "2026-10-11" }), task({ id: "b", dueAt: "2026-10-04", dependsOn: ["a"] })]);
    expect(res.conflicts.find((c) => c.type === "dependency")).toMatchObject({ taskId: "b", dependsOnId: "a", depFinish: "2026-10-11", due: "2026-10-04" });
  });

  it("agent tasks book review hours on the reviewer, not task hours; the agent counts PRs", () => {
    const res = run([person({ id: "r" })], [task({ id: "pr", agent: true, remainingHours: 20, dueAt: "2026-10-11" })]);
    expect(res.placements.pr.chunks).toEqual([{ date: "2026-10-11", hours: 1.5, personId: "r", kind: "review" }]);
    expect(cell(res, "r", W(41))).toMatchObject({ used: 1.5 });
    expect(res.agent.find((a) => a.week === W(41))).toEqual({ week: W(41), prs: 1, reviewHours: 1.5 });
  });

  it("is deterministic", () => {
    const people = [person({ id: "r" }), person({ id: "c", skills: ["development"] })];
    const tasks = Array.from({ length: 12 }, (_, i) => task({ id: `t${i}`, remainingHours: (i % 4) + 1, dueAt: i % 3 ? `2026-10-${String(10 + (i % 3)).padStart(2, "0")}` : null, ownerId: i % 2 ? "r" : "c" }));
    expect(JSON.stringify(run(people, tasks))).toBe(JSON.stringify(run([...people].reverse(), [...tasks].reverse())));
  });
});

describe("conflicts and suggestions", () => {
  const twoPeople = () => [person({ id: "r", name: "Rinor" }), person({ id: "c", name: "Artin", windows: { mon: "08:00-15:00", tue: "08:00-15:00" }, skills: ["development"] })];

  it("over capacity → MOVE to the next week with room (never past a dependent's deadline)", () => {
    const tasks = [
      task({ id: "big", priority: "high", remainingHours: 9, dueAt: "2026-10-11" }),
      task({ id: "small", priority: "low", remainingHours: 3.5, dueAt: "2026-10-11" }),
    ];
    const res = run([person({ id: "r", name: "Rinor" })], tasks);
    expect(res.conflicts).toContainEqual({ type: "over_capacity", personId: "r", week: W(41), used: 12.5, cap: 12 });
    const move = res.suggestions.find((s) => s.type === "move")!;
    expect(move).toMatchObject({ week: W(41), apply: { kind: "shift", taskId: "small", days: 7 } });
    expect(move.text).toBe('Rinor is 0.5 h over in W41. Move "small" to W42, where Rinor has 12 h free.');
    // A dependent due in W42 blocks the one-week move.
    const blocked = run([person({ id: "r", name: "Rinor" })], [...tasks, task({ id: "dep", dependsOn: ["small"], dueAt: "2026-10-12", ownerId: null, remainingHours: 0 })]);
    expect(blocked.suggestions.find((s) => s.type === "move")?.apply).not.toMatchObject({ taskId: "small" });
  });

  it("REASSIGN to someone with the skill and free hours that week", () => {
    const res = run(twoPeople(), [task({ id: "a", remainingHours: 10, dueAt: "2026-10-11" }), task({ id: "b", remainingHours: 4, dueAt: "2026-10-11", priority: "low" })]);
    expect(res.suggestions.find((s) => s.type === "reassign")).toMatchObject({ apply: { kind: "reassign", from: "r", to: "c" } });
    const noSkill = run([person({ id: "r", name: "Rinor" }), person({ id: "s", name: "Sam", windows: { mon: "08:00-16:00" }, skills: ["sales"] })], [task({ id: "a", remainingHours: 14, dueAt: "2026-10-11" })]);
    expect(noSkill.suggestions.find((s) => s.type === "reassign")).toBeUndefined();
  });

  it("never shrinks estimates; with nothing movable it flags the week", () => {
    const res = run([person({ id: "r", name: "Rinor" })], [task({ id: "u", priority: "urgent", remainingHours: 20, dueAt: "2026-10-04" })]);
    expect(res.placements.u.needHours).toBe(20);
    expect(res.suggestions.find((s) => s.type === "flag" && s.week === W(40))?.text).toMatch(/nothing can move/);
  });

  it("reports the reviewer being full", () => {
    const res = run([person({ id: "r" })], [task({ id: "w", remainingHours: 12, startAt: "2026-10-10", dueAt: "2026-10-11" }), task({ id: "pr", agent: true, dueAt: "2026-10-11" })]);
    expect(res.conflicts).toContainEqual({ type: "reviewer_full", personId: "r", week: W(41), reviewHours: 1.5 });
  });
});

// ---------------------------------------------------------------- the seeded plan (M10 done-when)

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
const source = async (email: string) => {
  const src: DataSource = createDemoSource({ password: "pw", persistLeads: false, now: () => NOW, storage: new MemoryStorage() });
  await src.signInWithPassword(email, "pw");
  return src;
};

describe("seeded Q4 launch plan (M10 done-when)", () => {
  it("shows Rinor at 14 / 12 h in W41 with a correct MOVE suggestion, and applying it updates both weeks", async () => {
    const src = await source("rinor@atlas.test");
    const plan = await src.capacityPlan();
    const w41 = plan.cells.find((c) => c.personId === "u-rinor" && c.week === W(41))!;
    expect([w41.used, w41.cap]).toEqual([14, 12]);
    expect(plan.people.find((p) => p.id === "u-rinor")?.capLine).toBe("Weekends · 12 h");
    expect(plan.people.find((p) => p.id === "u-cofounder")?.capLine).toBe("Ops + dev · 13 h");
    const move = plan.suggestions.find((s) => s.type === "move" && s.personId === "u-rinor" && s.week === W(41))!;
    expect(move.text).toMatch(/^Rinor is 2 h over in W41\. Move ".+" to W42, where Rinor has [\d.]+ h free\.$/);
    const moving = w41.tasks.find((t) => move.apply && "taskId" in move.apply && t.taskId === move.apply.taskId)!;
    const w42Before = plan.cells.find((c) => c.personId === "u-rinor" && c.week === W(42))!.used;
    await src.applySuggestion(move.id);
    const after = await src.capacityPlan();
    expect(after.cells.find((c) => c.personId === "u-rinor" && c.week === W(41))!.used).toBe(14 - moving.hours);
    expect(after.cells.find((c) => c.personId === "u-rinor" && c.week === W(42))!.used).toBe(w42Before + moving.hours);
  });

  it("the timeline has bars matching dates, dependency links and the BDR milestone", async () => {
    const src = await source("rinor@atlas.test");
    const plan = await src.capacityPlan();
    const tasks = await src.listTasks({});
    for (const b of plan.bars.filter((x) => !x.milestone)) {
      const t = tasks.find((r) => r.task.id === b.taskId)?.task;
      if (t?.dueAt) expect(b.end).toBe(t.dueAt);
      if (t?.startAt) expect(b.start).toBe(t.startAt);
    }
    expect(plan.bars.find((b) => b.milestone)).toMatchObject({ title: "BDR starts calling", end: "2026-10-26" });
    expect(plan.bars.some((b) => b.waitingOn.length)).toBe(true);
    expect(plan.agent.some((a) => a.prs > 0)).toBe(true);
  });

  it("availability: split must sum to 100%, people edit only their own, time off lowers capacity", async () => {
    const src = await source("diego@atlas.test");
    await expect(src.updateAvailability("u-bdr", { split: { sales: 0.9 } })).rejects.toThrow(/100%/);
    await expect(src.updateAvailability("u-rinor", { windows: { sat: "09:00-12:00" } })).rejects.toMatchObject({ status: 403 });
    await src.addTimeOff("u-bdr", { from: "2026-10-12", to: "2026-10-16", reason: "Holiday" });
    const plan = await src.capacityPlan();
    expect(plan.people.map((p) => p.id)).toEqual(["u-bdr"]); // others see only themselves
    expect(plan.cells.find((c) => c.week === W(42))!.cap).toBe(0);
    await src.updateAvailability("u-bdr", { windows: { mon: "08:00-12:00", tue: "08:00-12:00", wed: "08:00-12:00", thu: "08:00-12:00", fri: "08:00-12:00" } });
    expect((await src.capacityPlan()).cells.find((c) => c.week === W(41))!.cap).toBe(20);
  });
});
