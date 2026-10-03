import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource, WeeklyReport } from "@/data/types";
import { agentPlan, DEFAULT_AGENT } from "@/services/aiAgent";
import { performanceReview } from "@/services/performanceReview";

// 2026-10-02 18:00 UTC = 14:00 New York, 11:00 Los Angeles, 20:00 Zurich.
const NOW = Date.UTC(2026, 9, 2, 18);
const req = (over: Partial<Parameters<typeof agentPlan>[0][number]>) => ({ id: "r", name: "Tom Becker", company: "Becker HVAC", phone: "+1 555 0100", country: "US", receivedAt: new Date(NOW - 3 * 60_000).toISOString(), status: "new" as const, brand: "gllarix" as const, ...over });

describe("AI BDR agent: who it may call", () => {
  it("calls back consenting US requests inside the window in every US zone, and leaves the rest to a human", () => {
    const plan = agentPlan(
      [
        req({ id: "us" }),
        req({ id: "ch", country: "CH", name: "Anna Keller" }), // 20:00 in Zurich: outside 09–18
        req({ id: "de", country: "DE" }), // we don't call in Germany
        req({ id: "none", country: null }),
        req({ id: "nophone", phone: null }),
        req({ id: "done", status: "contacted" as never }),
      ],
      DEFAULT_AGENT,
      NOW,
    );
    expect(plan.map((p) => p.requestId)).toEqual(["us", "ch", "de", "none"]);
    const by = Object.fromEntries(plan.map((p) => [p.requestId, p]));
    expect(by.us).toMatchObject({ allowed: true, reason: "Asked 3 min ago: call now" });
    expect(by.us.opener).toMatch(/^Hi Tom, this is an AI assistant calling for Gllarix.*recorded/);
    expect(by.ch).toMatchObject({ allowed: false });
    expect(by.ch.reason).toMatch(/Outside 09:00–18:00/);
    expect(by.de.reason).toMatch(/don't call in DE/);
    expect(by.none.allowed).toBe(false);
  });

  it("waits when the west coast isn't up yet", () => {
    const early = Date.UTC(2026, 9, 2, 14); // 10:00 NY, 07:00 LA
    expect(agentPlan([req({})], DEFAULT_AGENT, early)[0].allowed).toBe(false);
  });
});

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
  if (!(await src.signInWithPassword(email, PW)).ok) throw new Error("sign-in failed");
};

describe("AI BDR agent settings", () => {
  it("refuses live calling without telephony and an opening line that hides the AI", async () => {
    const src = createDemoSource({ password: PW, persistLeads: false, now: () => NOW, storage: new MemoryStorage() });
    await as(src, "rinor@atlas.test");
    const home = await src.agentHome();
    expect(home).toMatchObject({ liveAvailable: false });
    expect(home.settings.mode).toBe("off");
    await expect(src.runAgentShadow()).rejects.toThrow(/shadow mode/);
    await expect(src.saveAgent({ mode: "live" })).rejects.toThrow(/Twilio/);
    await expect(src.saveAgent({ disclosure: "Hi, it's Anna from Gllarix!" })).rejects.toThrow(/AI/);
    await src.saveAgent({ mode: "shadow" });
    const run = await src.runAgentShadow();
    expect(run.considered).toBe(run.wouldCall + run.blocked);
    await as(src, "diego@atlas.test");
    await expect(src.agentHome()).rejects.toThrow();
  });
});

const report = (kpis: [string, number | null, "on_track" | "watch" | "off_track" | null, ("count" | "pct" | "rate")?][], funnel: Record<string, number | null> = {}): WeeklyReport =>
  ({
    kpis: kpis.map(([key, value, status, unit]) => ({ key, label: key, value, status, target: "t", unit: unit ?? "rate" })),
    funnel: Object.entries(funnel).map(([key, rate]) => ({ key, label: key, count: 0, rate })),
  }) as unknown as WeeklyReport;

describe("performance review", () => {
  it("picks the earliest leak in the funnel as next week's focus", () => {
    const lowActivity = performanceReview("Diego Marín", report([["dials_per_day", 30, "off_track"], ["conversations_per_day", 2, "off_track"], ["meetings_booked", 0, "off_track", "count"]]), null);
    expect(lowActivity.tone).toBe("act");
    expect(lowActivity.focus).toMatch(/^Activity/);
    const script = performanceReview("Diego Marín", report([["dials_per_day", 70, "on_track"], ["conversations_per_day", 8, "on_track"], ["meetings_booked", 1, "off_track", "count"]], { booked: 0.05 }), null);
    expect(script.focus).toMatch(/conversations into meetings/);
    expect(script.wins[0]).toMatch(/dials_per_day: 70\.0/);
  });

  it("reports the trend against last week", () => {
    const r = performanceReview("Diego", report([["dials_per_day", 70, "on_track"], ["meetings_booked", 5, "on_track", "count"]]), report([["dials_per_day", 50, "off_track"], ["meetings_booked", 5, "on_track", "count"]]));
    expect(r.tone).toBe("good");
    expect(r.trend.find((t) => t.key === "dials_per_day")).toMatchObject({ before: 50, now: 70, better: true });
    expect(r.trend.find((t) => t.key === "meetings_booked")?.better).toBeNull();
  });
});
