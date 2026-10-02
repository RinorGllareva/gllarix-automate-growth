import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { createsCycle, groupTasks, listSummary, mapNotionRow, myWorkGroups, nextStatus, parseMentions, parseNotionDate, positionBetween } from "@/services/tasks";
import type { TaskRow } from "@/data/taskTypes";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026, week 40
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
const source = async (email: string, now: () => number = () => NOW) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now, storage: new MemoryStorage() });
  await switchTo(src, email);
  return src;
};
const q4 = async (src: DataSource) => (await src.tasksHome()).spaces.find((x) => x.space.name === "Company")!.lists.find((l) => l.name === "Q4 launch")!;
const USERS = [
  { id: "u-rinor", name: "Rinor" },
  { id: "u-cofounder", name: "Artin" },
  { id: "u-bdr", name: "Diego Marín" },
];

describe("task logic (pure)", () => {
  it("cycles status, orders positions and finds dependency loops", () => {
    expect([nextStatus("todo"), nextStatus("in_progress"), nextStatus("review"), nextStatus("done")]).toEqual(["in_progress", "review", "done", "todo"]);
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(null, 1000)).toBe(0);
    const deps = [
      { taskId: "b", dependsOnId: "a" },
      { taskId: "c", dependsOnId: "b" },
    ];
    expect(createsCycle(deps, "a", "c")).toBe(true); // a would wait on c, which waits (via b) on a
    expect(createsCycle(deps, "c", "a")).toBe(false);
    expect(createsCycle([], "a", "a")).toBe(true);
  });

  it("finds @mentions by first or full name", () => {
    expect(parseMentions("@rinor can you check? cc @Diego Marín", USERS).sort()).toEqual(["u-bdr", "u-rinor"]);
    expect(parseMentions("email rinor@atlas.test", USERS)).toEqual([]);
  });

  it("maps a Notion row, including the 'Hight' typo, dates, people and categories", () => {
    const r = mapNotionRow({ "Tasks": "Write the call script", Status: "In progress", Deadline: "October 2, 2026", Priority: "Hight", Person: "Artin, Rinor", Category: "Lead gen", Notes: "Draft first" }, USERS);
    expect(r).toMatchObject({ title: "Write the call script", status: "in_progress", dueAt: "2026-10-02", priority: "high", assigneeIds: ["u-cofounder", "u-rinor"], category: "Lead gen", spaceName: "Lead gen", notes: "Draft first", warnings: [] });
    const odd = mapNotionRow({ Tasks: "X", Status: "Not started", Deadline: "soon", Priority: "", Person: "Somebody", Category: "Management" }, USERS);
    expect(odd).toMatchObject({ status: "todo", dueAt: null, priority: "normal", spaceName: "Company" });
    expect(odd.warnings).toHaveLength(2);
    expect(parseNotionDate("September 28, 2026 → October 4, 2026")).toBe("2026-10-04");
    expect(parseNotionDate("30/09/2026")).toBe("2026-09-30");
  });

  it("groups by status with counts and computes the summary hours", () => {
    const row = (id: string, status: TaskRow["task"]["status"], est: number, due: string | null): TaskRow =>
      ({ task: { id, status, estimateMinutes: est, dueAt: due, parentId: null, assigneeIds: [], priority: "normal", position: 0 }, subtasks: { done: 0, total: 0 } }) as unknown as TaskRow;
    const rows = [row("a", "in_progress", 120, "2026-10-03"), row("b", "todo", 60, "2026-10-12"), row("c", "todo", 30, null), row("d", "done", 600, "2026-09-28")];
    const groups = groupTasks(rows, "status", USERS, "2026-10-01");
    expect(groups.map((g) => [g.key, g.rows.length])).toEqual([["in_progress", 1], ["todo", 2], ["done", 1]]);
    expect(listSummary(rows)).toEqual({ open: 3, hours: 3.5, mostDueBy: "2026-10-12" });
    const mine = myWorkGroups(rows, "2026-10-01");
    expect(mine.map((g) => g.rows.length)).toEqual([0, 0, 1, 1, 1]);
  });
});

describe("tasks module (M9)", () => {
  it("seeds the Q4 launch list from the mockup with groups, counts and hours", async () => {
    const src = await source("rinor@atlas.test");
    const list = await q4(src);
    // The mockup's rows (M10 adds the timeline rows from position 20000 on).
    const rows = (await src.listTasks({ listId: list.id })).filter((r) => r.task.position < 20_000);
    const summary = listSummary(rows);
    expect(summary.open).toBe(11);
    expect(summary.hours).toBe(29.5);
    const demo = rows.find((r) => r.task.title === "Build the live Gllarix demo line")!;
    expect(demo.subtasks).toEqual({ done: 2, total: 6 });
    expect(demo.spentMinutes).toBe(120);
  });

  it("inline edits persist and write the activity log; Done is blocked by open subtasks", async () => {
    const src = await source("rinor@atlas.test");
    const rows = await src.listTasks({ listId: (await q4(src)).id });
    const demo = rows.find((r) => r.task.title.startsWith("Build the live"))!.task;
    await src.updateTask(demo.id, { priority: "urgent", dueAt: "2026-10-05", estimateMinutes: 600 });
    await expect(src.updateTask(demo.id, { status: "done" })).rejects.toThrow(/4 open subtasks/);
    await src.updateTask(demo.id, { status: "done", completeSubtasks: true });
    const d = await src.getTask(demo.id);
    expect(d.task).toMatchObject({ priority: "urgent", dueAt: "2026-10-05", estimateMinutes: 600, status: "done" });
    expect(d.task.completedAt).toBeTruthy();
    expect(d.subtasks.every((x) => x.task.status === "done")).toBe(true);
    const log = d.activity.map((a) => a.text);
    expect(log).toEqual(expect.arrayContaining(["Priority High → Urgent", "Due 3 Oct → 5 Oct", "Estimate 8h → 10h", "Status In progress → Done"]));
  });

  it("drag-and-drop status and position changes persist", async () => {
    const src = await source("rinor@atlas.test");
    const rows = await src.listTasks({ listId: (await q4(src)).id });
    const t = rows.find((r) => r.task.status === "todo")!.task;
    await src.updateTask(t.id, { status: "review", position: positionBetween(null, 500) });
    const again = (await src.listTasks({ listId: t.listId })).find((r) => r.task.id === t.id)!;
    expect(again.task).toMatchObject({ status: "review", position: -500 });
  });

  it("@mention notifies and lands in the Inbox; comments notify assignees", async () => {
    const src = await source("artin@atlas.test");
    const t = (await src.listTasks({ listId: (await q4(src)).id })).find((r) => r.task.assigneeIds.includes("u-rinor") && r.task.assigneeIds.length === 1)!.task;
    await src.addComment(t.id, "@Rinor can we move this up? @Diego for info");
    await switchTo(src, "rinor@atlas.test");
    const inbox = await src.taskInbox();
    expect(inbox.find((i) => i.taskId === t.id)).toMatchObject({ kind: "mention", actorName: "Artin" });
    expect((await src.listNotifications("u-rinor")).some((n) => n.type === "mention" && n.href === `/tasks/${t.id}`)).toBe(true);
    await src.markInboxRead("all");
    expect((await src.tasksHome()).inboxUnread).toBe(0);
  });

  it("rejects dependency cycles", async () => {
    const src = await source("rinor@atlas.test");
    const list = await q4(src);
    const a = await src.createTask({ listId: list.id, title: "A" });
    const b = await src.createTask({ listId: list.id, title: "B" });
    const c = await src.createTask({ listId: list.id, title: "C" });
    await src.addDependency(b.id, a.id);
    await src.addDependency(c.id, b.id);
    await expect(src.addDependency(a.id, c.id)).rejects.toThrow(/loop/);
    const d = await src.getTask(b.id);
    expect(d.waitingOn.map((r) => r.task.id)).toEqual([a.id]);
    expect(d.blocks.map((r) => r.task.id)).toEqual([c.id]);
  });

  it("one running timer per user; it survives page changes and logs time when stopped", async () => {
    let now = NOW;
    const src = await source("rinor@atlas.test", () => now);
    const rows = await src.listTasks({ listId: (await q4(src)).id });
    const [a, b] = rows.filter((r) => r.task.assigneeIds.includes("u-rinor")).map((r) => r.task);
    await src.startTimer(a.id);
    now += 25 * 60_000;
    expect((await src.tasksHome()).timer).toMatchObject({ taskId: a.id });
    await src.startTimer(b.id); // switching stops the first and logs it
    now += 10 * 60_000;
    const e = await src.stopTimer();
    expect(e).toMatchObject({ taskId: b.id, minutes: 10, source: "timer" });
    expect((await src.getTask(a.id)).time[0]).toMatchObject({ minutes: 25, source: "timer" });
    expect((await src.tasksHome()).timer).toBeNull();
    await src.addTimeEntry(a.id, { minutes: 90, date: "2026-09-30", note: "Calls" });
    expect((await src.getTask(a.id)).spentMinutes).toBe(25 + 90 + (a.title.startsWith("Build the live") ? 120 : 0));
  });

  it("the BDR sees only Sales and Lead gen plus tasks assigned to him; My work covers every space", async () => {
    const src = await source("diego@atlas.test");
    const home = await src.tasksHome();
    // Sales and Lead gen in full; Company only through tasks assigned to him (BDR training).
    expect(home.spaces.map((x) => x.space.name)).toEqual(["Company", "Sales", "Lead gen"]);
    const company = await src.listTasks({ spaceId: "sp-company" });
    expect(company.length).toBeGreaterThan(0);
    expect(company.every((r) => r.task.assigneeIds.includes("u-bdr"))).toBe(true);
    const mine = await src.listTasks({ myWork: true });
    expect(mine.length).toBe(home.myWork + mine.filter((r) => r.task.status === "done" || r.task.status === "cancelled").length);
    expect(mine.every((r) => r.task.assigneeIds.includes("u-bdr"))).toBe(true);
    await switchTo(src, "rinor@atlas.test");
    const someId = (await src.listTasks({ spaceId: "sp-company" })).find((r) => !r.task.assigneeIds.includes("u-bdr"))!.task.id;
    await switchTo(src, "diego@atlas.test");
    await expect(src.getTask(someId)).rejects.toMatchObject({ status: 403 });
  });

  it("tasks link to CRM records and show there; ⌘K finds them", async () => {
    const src = await source("rinor@atlas.test");
    const deal = (await src.listDeals())[0];
    const list = await q4(src);
    const t = await src.createTask({ listId: list.id, title: "Send the revised quote", linked: { type: "deal", id: deal.deal.id } });
    expect((await src.tasksFor("deal", deal.deal.id)).map((r) => r.task.id)).toContain(t.id);
    expect((await src.tasksFor("lead", deal.lead.id)).map((r) => r.task.id)).toContain(t.id); // a lead shows its deal's tasks
    expect((await src.getTask(t.id)).linked).toMatchObject({ type: "deal", href: `/deals/${deal.deal.id}` });
    expect((await src.searchTasks("revised quote")).map((r) => r.task.id)).toEqual([t.id]);
  });

  it("delete moves to the trash; admins restore", async () => {
    const src = await source("rinor@atlas.test");
    const t = await src.createTask({ listId: (await q4(src)).id, title: "Temp" });
    await src.deleteTask(t.id);
    await expect(src.getTask(t.id)).rejects.toMatchObject({ status: 404 });
    await src.restoreTask(t.id);
    expect((await src.getTask(t.id)).task.title).toBe("Temp");
  });

  it("imports the Notion CSV once into the right spaces with owners, dates, priorities and categories", async () => {
    const src = await source("rinor@atlas.test");
    const users = (await src.tasksHome()).users;
    const rows = [
      { Tasks: "Write the call script", Status: "In progress", Deadline: "October 2, 2026", Priority: "Hight", Person: "Artin", Category: "Lead gen", Notes: "" },
      { Tasks: "Pay the Twilio invoice", Status: "Done", Deadline: "2026-09-28", Priority: "Low", Person: "Rinor", Category: "Finance", Notes: "Paid by card" },
    ].map((r) => mapNotionRow(r, users));
    const res = await src.importNotionTasks(rows);
    expect(res.created).toBe(2);
    expect(res.lists.sort()).toEqual(["Finance / Imported from Notion", "Lead gen / Imported from Notion"]);
    const home = await src.tasksHome();
    const leadGen = home.spaces.find((x) => x.space.name === "Lead gen")!.lists.find((l) => l.name === "Imported from Notion")!;
    const [task] = await src.listTasks({ listId: leadGen.id });
    expect(task.task).toMatchObject({ title: "Write the call script", status: "in_progress", priority: "high", dueAt: "2026-10-02", assigneeIds: ["u-cofounder"], category: "Lead gen", importedFrom: "Notion" });
    await expect(src.importNotionTasks(rows)).rejects.toThrow(/already imported/);
  });

  it("saved views are per user", async () => {
    const src = await source("rinor@atlas.test");
    const list = await q4(src);
    await src.saveView({ listId: list.id, name: "Mine by due", config: { groupBy: "due_week", sort: "due", filters: { owners: ["u-rinor"], priorities: [], categories: [], tags: [], dueFrom: null, dueTo: null, ai: null, hasDeps: null, q: "" } } });
    expect((await src.listSavedViews(list.id)).map((v) => v.name)).toEqual(["Mine by due"]);
    await switchTo(src, "artin@atlas.test");
    expect(await src.listSavedViews(list.id)).toEqual([]);
  });
});
