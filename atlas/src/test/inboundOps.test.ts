import { describe, expect, it } from "vitest";
import { periodKey } from "@/config/operations";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";

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
const setup = async () => {
  const clock = { t: Date.UTC(2026, 9, 2, 14) };
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => clock.t, storage: new MemoryStorage() });
  await as(src, "rinor@atlas.test");
  return { src, clock };
};

describe("Sell › Inbound", () => {
  it("receives, times the first reply, converts to a lead (matching existing ones) and dismisses spam", async () => {
    const { src, clock } = await setup();
    const home = await src.inboundHome();
    expect(home.requests.length).toBe(5);
    expect(home.kpis.open).toBe(2);
    expect(home.kpis.medianResponseMin).toBeCloseTo(27.5); // replies after 40 and 15 minutes

    const r = await src.receiveInbound({ channel: "website_form", brand: "gllarix", name: "Dana Fox", company: "Fox Electric", email: "dana@foxelectric.example", phone: null, country: "US", message: "Need after-hours answering." });
    expect((await src.listNotifications("u-bdr")).some((n) => /New inbound/.test(n.text))).toBe(true);
    clock.t += 9 * 60_000;
    await as(src, "diego@atlas.test");
    await src.claimInbound(r.id);
    await src.respondInbound(r.id);
    const leadId = await src.convertInbound(r.id);
    const lead = await src.getLead(leadId);
    expect(lead.lead.ownerId).toBe("u-bdr");
    expect(lead.source?.kind).toBe("inbound");
    expect(lead.activities.some((a) => /Inbound message/.test(a.title))).toBe(true);
    const after = (await src.inboundHome()).requests.find((x) => x.id === r.id)!;
    expect(after).toMatchObject({ status: "converted", leadId, assignedTo: "u-bdr" });
    expect(new Date(after.firstResponseAt!).getTime() - new Date(after.receivedAt).getTime()).toBe(9 * 60_000);

    // The same person writing again matches the existing lead instead of creating a duplicate.
    await as(src, "rinor@atlas.test");
    const again = await src.receiveInbound({ channel: "chat", brand: "gllarix", name: "Dana Fox", company: "Fox Electric", email: "dana@foxelectric.example", phone: null, country: "US", message: "Following up." });
    expect(await src.convertInbound(again.id)).toBe(leadId);

    const spam = (await src.inboundHome()).requests.find((x) => x.status === "new")!;
    await src.dismissInbound(spam.id, "spam");
    await expect(src.convertInbound(spam.id)).rejects.toThrow(/dismissed/);
    await as(src, "lena@atlas.test");
    await expect(src.inboundHome()).rejects.toMatchObject({ status: 403 });
  });
});

describe("Work › Operations plan", () => {
  it("tracks SOPs (done needs a link), ticks the rhythm per period, and flags the implementer trigger", async () => {
    const { src } = await setup();
    const home = await src.opsHome();
    expect(home.sops).toHaveLength(10);
    const sop1 = home.sops.find((s) => s.num === 1)!;
    await expect(src.updateSop(sop1.id, { status: "done" })).rejects.toThrow(/link/);
    await src.updateSop(sop1.id, { link: "https://docs.example/sop-1", status: "done" });
    expect((await src.opsHome()).sops.find((s) => s.num === 1)!.status).toBe("done");

    const key = `weekly_review:${periodKey("weekly", "2026-10-02")}`;
    expect(key).toBe("weekly_review:2026-W40");
    await src.setOpsCheck(key, true);
    expect((await src.opsHome()).checks[key]?.by).toBe("u-rinor");
    await expect(src.setOpsCheck("daily_report:2026-10-02", true)).rejects.toMatchObject({ status: 404 }); // automatic items can't be ticked
    expect(periodKey("quarterly", "2026-11-15")).toBe("2026-Q4");

    expect(typeof home.capacity.hireImplementer).toBe("boolean");
    await as(src, "lena@atlas.test");
    expect((await src.opsHome()).canEdit).toBe(false);
    await expect(src.updateSop(sop1.id, { status: "draft" })).rejects.toMatchObject({ status: 403 });
    await as(src, "books@atlas.test");
    await expect(src.opsHome()).rejects.toMatchObject({ status: 403 });
  });
});

describe("automations ledger", () => {
  it("prices founder hours, turns BDR hours into dials", async () => {
    const { automationValue } = await import("@/config/systemAutomations");
    // rescore: 2 × 45 min = 1.5 h founders · queue: 4 × 30 min = 2 h BDR · cadence: 20 × 3 = 1 h BDR
    const v = automationValue({ rescore: 2, queue: 4, cadence: 20 });
    expect(v.founderHours).toBeCloseTo(1.5);
    expect(v.founderEur).toBeCloseTo(131.25);
    expect(v.bdrHours).toBeCloseTo(3);
    expect(v.extraDials).toBe(23);
    expect(v.rows[0].key).toBe("queue");
  });
});
