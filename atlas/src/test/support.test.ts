import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { slaState } from "@/services/support";

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
const as = async (src: DataSource, email: string) => {
  await src.signOut();
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};
const NOW = Date.UTC(2026, 9, 2, 14);
const H = 3_600_000;

describe("support service levels", () => {
  const base = { category: "wrong_answers" as const, priority: "normal" as const, status: "open" as const, createdAt: new Date(NOW - 10 * H).toISOString(), firstResponseAt: null, resolvedAt: null };
  it("counts the first reply, then the fix; urgent gets half the time", () => {
    expect(slaState(base, NOW)).toMatchObject({ stage: "first", overdue: true, label: "Reply overdue by 2 h" });
    expect(slaState({ ...base, createdAt: new Date(NOW - 2 * H).toISOString() }, NOW)).toMatchObject({ overdue: false, label: "Reply within 6 h" });
    expect(slaState({ ...base, priority: "urgent", createdAt: new Date(NOW - 5 * H).toISOString() }, NOW).overdue).toBe(true);
    expect(slaState({ ...base, firstResponseAt: new Date(NOW - 9 * H).toISOString() }, NOW)).toMatchObject({ stage: "fix", label: "Fix within 38 h" });
    expect(slaState({ ...base, status: "waiting", firstResponseAt: new Date(NOW - 9 * H).toISOString() }, NOW)).toMatchObject({ overdue: false, label: "Waiting on the client" });
  });
});

describe("support tickets", () => {
  it("logs, replies, resolves; open tickets lower client health; sellers and the accountant can't see them", async () => {
    const src = createDemoSource({ password: PW, persistLeads: false, now: () => NOW, storage: new MemoryStorage() });
    await as(src, "lena@atlas.test");
    const first = await src.listTickets();
    const client = (await src.clientsOverview()).cards.find((c) => c.status === "live")!;
    const before = (await src.getClient(client.id)).health!;

    const t = await src.createTicket({ clientId: client.id, subject: "Assistant hangs up after 30 seconds", body: "Two customers complained.", category: "down", priority: "urgent", channel: "phone" });
    expect(t.number).toMatch(/^T-10\d\d$/);
    let list = await src.listTickets(client.id);
    // Overdue tickets first, then the urgent new one ahead of everything on time.
    expect(list.tickets.find((x) => !x.sla.overdue)?.id).toBe(t.id);
    expect(list.tickets.length).toBeGreaterThan(first.tickets.filter((x) => x.clientId === client.id).length);
    const after = (await src.getClient(client.id)).health!;
    expect(after.parts.tickets).toBeLessThanOrEqual(before.parts.tickets);

    await src.replyTicket(t.id, { text: "Checking the call flow now.", internal: true });
    expect((await src.getTicket(t.id)).firstResponseAt).toBeNull(); // a note isn't a reply
    await src.replyTicket(t.id, { text: "Fixed: the timeout was set to 30 s. Back to normal.", internal: false });
    let full = await src.getTicket(t.id);
    expect(full).toMatchObject({ status: "waiting" });
    expect(full.firstResponseAt).not.toBeNull();
    await src.updateTicket(t.id, { status: "resolved" });
    full = await src.getTicket(t.id);
    expect(full.sla.stage).toBe("done");

    for (const email of ["diego@atlas.test", "books@atlas.test"]) {
      await as(src, email);
      await expect(src.listTickets()).rejects.toThrow();
    }
    await as(src, "rinor@atlas.test");
    list = await src.listTickets();
    expect(list.people.map((p) => p.name)).toContain("Lena Kraus");
  });
});
