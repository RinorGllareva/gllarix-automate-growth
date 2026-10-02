/** Regression tests for bugs found in the full QA pass (2026-10-01). */
import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { suggestedOffer } from "@/services/offers";

const NOW = Date.UTC(2026, 9, 1, 14, 0);
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
const source = async (email = "rinor@atlas.test") => {
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => NOW, storage: new MemoryStorage() });
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
  return src;
};
const leads = async (src: DataSource) => (await src.listLeads({ tiers: [], lists: [], countries: [], stages: ["new"], owners: [], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 })).rows;

describe("QA fixes", () => {
  it("a meeting booked in the call workspace sends the confirmation and reminders, like the booking page", async () => {
    const src = await source();
    const lead = (await leads(src)).find((r) => r.contact?.email)!;
    await src.logOutcome({ leadId: lead.lead.id, disposition: "meeting_booked", notes: "", durationS: 0, recordingUrl: null, meeting: { at: new Date(NOW + 3 * 86_400_000).toISOString(), withWhom: "Owner", type: "video" } });
    const kinds = (await src.outbox({ leadId: lead.lead.id })).map((m) => m.kind);
    expect(kinds).toEqual(expect.arrayContaining(["booking_confirmation", "reminder_24h", "reminder_1h"]));
    expect((await src.listDeals()).some((d) => d.lead.id === lead.lead.id)).toBe(true);
  });

  it("Add to cadence: sets or clears the cadence; owners only for their own leads; closed leads are skipped", async () => {
    const admin = await source();
    const [a, b] = await leads(admin);
    expect(await admin.setCadence([a.lead.id, b.lead.id], "developers_v1")).toBe(2);
    expect((await admin.getLead(a.lead.id)).lead.cadenceId).toBe("developers_v1");
    expect(await admin.setCadence([a.lead.id], null)).toBe(1);
    expect((await admin.getLead(a.lead.id)).lead.cadenceId).toBeNull();
    await expect(admin.setCadence([a.lead.id], "nope")).rejects.toThrow(/Unknown cadence/);
    await admin.updateLead(b.lead.id, { stage: "lost" });
    expect(await admin.setCadence([b.lead.id], "trades_v1")).toBe(0);
    const bdr = await source("diego@atlas.test");
    const others = (await leads(admin)).filter((r) => r.lead.ownerId !== "u-bdr").map((r) => r.lead.id);
    expect(await bdr.setCadence(others.slice(0, 5), "trades_v1")).toBe(0);
  });

  it("a lead taken off its cadence gets no cadence calls or emails in the queue", async () => {
    const { buildQueue } = await import("@/services/queue");
    const { generateLeadSeed } = await import("@/data/demo/leadSeed");
    const seed = generateLeadSeed(new Date(NOW));
    const owner = { id: "u-bdr", name: "Diego", email: "", role: "bdr" as const, timezone: "America/Caracas", dailyCapacity: 150, active: true };
    const fresh = seed.leads.filter((l) => l.ownerId === "u-bdr" && l.stage === "new" && (l.tier === "A" || l.tier === "B")).slice(0, 10);
    const args = (ls: typeof fresh) => ({
      owner, now: NOW, leads: ls, companies: new Map(seed.companies.map((c) => [c.id, c])),
      contactsByCompany: new Map(seed.companies.map((c) => [c.id, seed.contacts.filter((x) => x.companyId === c.id)])), activitiesByLead: new Map(), suppression: [],
    });
    expect(buildQueue(args(fresh)).items.length).toBeGreaterThan(0);
    // Only actions someone scheduled (a due callback or follow-up) stay; no cadence steps or first calls.
    const off = buildQueue(args(fresh.map((l) => ({ ...l, cadenceId: null })))).items;
    expect(off.filter((i) => i.kind === "cadence")).toEqual([]);
    for (const i of off) {
      const lead = fresh.find((l) => l.id === i.leadId)!;
      expect(lead.nextActionAt, i.kind).not.toBeNull(); // e.g. a first call already scheduled for today
      expect(new Date(lead.nextActionAt!).getTime()).toBeLessThan(NOW + 86_400_000);
    }
    expect(off.length).toBeLessThan(buildQueue(args(fresh)).items.length);
  });

  it("the suggested offer uses the price book for the lead's market (list and pilot)", () => {
    expect(suggestedOffer("trades", "US")).toMatchObject({ list: { setup: "$1,500", monthly: "$699" }, pilot: { setup: "$600", monthly: "$524" } });
    expect(suggestedOffer("developers", "CH").market).toBe("ch");
  });
});
