import { describe, expect, it } from "vitest";
import { checkClaims } from "@/config/marketing";
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

describe("claim check (spec/backbone/10: words we don't use, no claims without client data)", () => {
  it("flags banned phrases and unproven numbers, comparisons and guarantees", () => {
    const issues = checkClaims("Outperforms traditional teams: 30-40% conversion. 65% lower cost. Save 30+ hours weekly. 30+ hours saved. We guarantee it.");
    expect(issues.find((i) => i.severity === "banned")?.text).toBe("30+ hours saved");
    expect(issues.map((i) => i.text)).toEqual(expect.arrayContaining(["30-40%", "65%", "Save 30+ hours weekly", "guarantee"]));
    expect(issues.some((i) => /Outperforms traditional teams/.test(i.text))).toBe(true);
    // The banned phrase isn't flagged twice by the "hours saved" pattern.
    expect(issues.filter((i) => /30\+ hours saved/i.test(i.text))).toHaveLength(1);
    expect(checkClaims("Never miss a job: every call answered, every lead followed up.")).toEqual([]);
  });
});

describe("marketing and markets data", () => {
  it("seeds channels, the first test and the competitor map; founders edit, sales reads", async () => {
    const src = createDemoSource({ password: PW, persistLeads: false, now: () => Date.UTC(2026, 9, 2, 12), storage: new MemoryStorage() });
    await as(src, "rinor@atlas.test");
    const home = await src.marketingHome();
    expect(home.channels).toHaveLength(10);
    expect(home.experiments[0]).toMatchObject({ budgetEur: 200, goal: 2, status: "planned" });
    expect(home.kpis.approved30d).toBeGreaterThanOrEqual(0);
    await expect(src.saveExperiment({ name: "LinkedIn test", budgetEur: 100, stopRule: "" })).rejects.toThrow(/stop rule/);
    await expect(src.saveExperiment({ ...home.experiments[0], spentEur: 250 })).rejects.toThrow(/over the budget/);
    await src.updateChannel(home.channels[3].id, { status: "live" });
    expect((await src.marketingHome()).channels[3].status).toBe("live");

    const m = await src.marketsHome();
    expect(m.markets.find((x) => x.key === "us_trades")!.leads).toBeGreaterThan(0);
    expect(m.competitors.filter((c) => c.brand === "arcadian")).toHaveLength(3);

    await as(src, "diego@atlas.test");
    expect((await src.marketingHome()).canEdit).toBe(false);
    await expect(src.markCompetitorChecked(m.competitors[0].id)).rejects.toMatchObject({ status: 403 });
    await as(src, "lena@atlas.test");
    await expect(src.marketsHome()).rejects.toMatchObject({ status: 403 });
  });
});
