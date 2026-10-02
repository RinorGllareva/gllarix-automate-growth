import { describe, expect, it } from "vitest";
import { SEARCH_PLANS } from "@/config/leadSources";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { CapReachedError, createFakeSources, guarded, recordSignals, type CacheEntry } from "@/services/leadSources";
import { scoringReport } from "@/services/scoringReport";
import { auditSignals, auditSite } from "@/services/websiteAudit";

const NOW = Date.UTC(2026, 9, 1, 12, 30);
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
const source = async (email: string) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => NOW, storage: new MemoryStorage() });
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
  return src;
};
const allCompanies = async (src: DataSource) => (await src.dedupContext()).companies;

describe("website audit (M8)", () => {
  const page = (html: string, https = true) => ({ url: "http://x.com", finalUrl: `${https ? "https" : "http"}://x.com/`, status: 200, html });

  it("finds forms, booking and chat widgets, HTTPS and the mobile viewport", () => {
    const f = auditSite(
      page('<meta name="viewport" content="width=device-width"><form><input type="email"></form><script src="https://embed.tawk.to/1"></script><a>Book online</a>'),
    );
    expect(f).toMatchObject({ https: true, mobileViewport: true, contactForm: true, chatWidget: "Tawk.to", bookingWidget: "Book online button" });
    const signals = Object.fromEntries(auditSignals(f, "trades").map((x) => [x.key, x.value]));
    expect(signals).toMatchObject({ no_online_booking: false, no_chat_widget: false, no_https: false, uses_ai_receptionist: false });
  });

  it("writes the scoring signals for trades and developers", () => {
    const bare = auditSite(page("<html><body>Call us</body></html>", false));
    expect(Object.fromEntries(auditSignals(bare, "trades").map((x) => [x.key, x.value]))).toMatchObject({ no_online_booking: true, no_chat_widget: true, no_https: true, not_mobile_friendly: true });
    const dev = auditSite(page('<img src="/render-1.jpg">'));
    expect(Object.fromEntries(auditSignals(dev, "developers").map((x) => [x.key, x.value]))).toMatchObject({ no_3d_unit_picker: true, static_renders_only: true, has_3d_vendor: false });
    const matterport = auditSite(page('<iframe src="https://my.matterport.com/show"></iframe>'));
    expect(Object.fromEntries(auditSignals(matterport, "developers").map((x) => [x.key, x.value]))).toMatchObject({ no_3d_unit_picker: false, has_3d_vendor: true });
    expect(auditSignals(auditSite({ url: "", finalUrl: "", status: 500, html: "" }), "trades")).toEqual([{ key: "website_unreachable", value: true }]);
  });
});

describe("source signals", () => {
  it("missed-call reviews and recently incorporated developers", () => {
    const base = { externalId: "x", companyName: "X", phone: null, website: null, contactName: null, contactTitle: null, city: null, region: null, country: "US", industry: "hvac", reviewsCount: 10, rating: 4, employeesEst: 5 };
    expect(recordSignals({ ...base, reviewSnippets: ["Went straight to voicemail twice."] }, NOW)).toEqual([{ key: "reviews_missed_calls", value: true, source: "places_reviews" }]);
    expect(recordSignals({ ...base, reviewSnippets: ["Great crew."] }, NOW)[0].value).toBe(false);
    expect(recordSignals({ ...base, incorporatedAt: "2026-03-01T00:00:00Z" }, NOW)[0]).toMatchObject({ key: "project_launch_12m", value: true });
    expect(recordSignals({ ...base, incorporatedAt: "2024-03-01T00:00:00Z" }, NOW)[0].value).toBe(false);
  });
});

describe("lead sources: cache and cost cap", () => {
  it("a cached page costs nothing; a request that would pass the cap is refused", async () => {
    const plan = SEARCH_PLANS.find((p) => p.connector === "places_api")!;
    const cache: CacheEntry[] = [];
    const spent: number[] = [];
    let t = NOW;
    const guard = { spent: () => spent.reduce((a, b) => a + b, 0), cap: () => 8, record: (_: unknown, c: number) => spent.push(c) };
    const src = guarded(createFakeSources({ connected: () => true }).places_api, { cache, guard, now: () => t });
    const a = await src.search(plan, null);
    const b = await src.search(plan, null);
    expect(a.cached).toBe(false);
    expect(b).toMatchObject({ cached: true, costMinor: 0 });
    expect(b.records).toEqual(a.records);
    await src.search(plan, "1");
    await expect(src.search(plan, "2")).rejects.toBeInstanceOf(CapReachedError);
    // After 30 days the cache is stale and the request is paid again (still capped here).
    t += 31 * 86_400_000;
    await expect(src.search(plan, null)).rejects.toBeInstanceOf(CapReachedError);
  });
});

describe("list build (M8 done-when)", () => {
  it("fills a shortfall of 100 leads from a fake source without duplicates and within the cost cap", async () => {
    const src = await source("rinor@atlas.test");
    const before = new Set((await allCompanies(src)).map((c) => c.id));
    const r = await src.runListBuild({ ownerId: "u-bdr", target: 100 });
    expect(r.run.status).toBe("succeeded");
    expect(r.owners[0]).toMatchObject({ ownerId: "u-bdr", queueReady: 100 });
    const after = await allCompanies(src);
    const added = after.filter((c) => !before.has(c.id));
    expect(added).toHaveLength(r.owners[0].added);
    // No new company shares a phone or website with any other company (the seed has its own planted duplicates for the import demo).
    for (const key of ["phone", "domain"] as const) {
      for (const c of added) if (c[key]) expect(after.filter((o) => o[key] === c[key])).toHaveLength(1);
    }
    const ids = added.map((c) => Object.values(c.externalIds ?? {})[0]);
    expect(new Set(ids).size).toBe(ids.length);
    const overview = await src.sourcesOverview();
    const places = overview.connectors.find((c) => c.id === "places_api")!;
    expect(places.spentMinor).toBe(r.run.costMinor);
    expect(places.spentMinor).toBeLessThanOrEqual(places.capMinor);
    // Running again doesn't add anything already in Atlas.
    const again = await src.runListBuild({ ownerId: "u-bdr", target: 20 });
    const final = await allCompanies(src);
    for (const c of final.filter((x) => !before.has(x.id))) if (c.phone) expect(final.filter((o) => o.phone === c.phone)).toHaveLength(1);
    expect(again.owners[0].queueReady).toBe(20);
  });

  it("a run without options tops up each owner's queue shortfall", async () => {
    const src = await source("rinor@atlas.test");
    const before = (await src.sourcesOverview()).shortfalls.filter((x) => x.shortfall > 0);
    expect(before.length).toBeGreaterThan(0);
    const r = await src.runListBuild();
    expect(r.owners.map((o) => o.ownerId).sort()).toEqual(before.map((b) => b.ownerId).sort());
    const after = (await src.sourcesOverview()).shortfalls;
    for (const b of before) expect(after.find((a) => a.ownerId === b.ownerId)!.shortfall).toBeLessThan(b.shortfall);
  });

  it("hitting the cap pauses the job and notifies admins; a paused job doesn't run", async () => {
    const src = await source("rinor@atlas.test");
    await src.setConnector("places_api", { capMinor: 8 });
    const r = await src.runListBuild({ ownerId: "u-bdr", target: 100 });
    expect(r.run.status).toBe("capped");
    expect(r.run.costMinor).toBeLessThanOrEqual(8);
    const jobs = (await src.sourcesOverview()).jobs;
    expect(jobs.find((j) => j.type === "list_build")).toMatchObject({ paused: true });
    expect((await src.listNotifications("u-rinor")).some((n) => n.type === "job_paused")).toBe(true);
    await expect(src.runListBuild({ ownerId: "u-bdr", target: 5 })).rejects.toThrow(/paused/);
    await src.setJobPaused("list_build", false);
    await src.setConnector("places_api", { capMinor: 5000 });
    expect((await src.runListBuild({ ownerId: "u-bdr", target: 5 })).run.status).toBe("succeeded");
  });

  it("a failed run shows its error and can be retried", async () => {
    const src = await source("rinor@atlas.test");
    // Point the developers rotation at Zefix, which isn't connected in the demo.
    const devOwner = (await src.sourcesOverview()).shortfalls.find((x) => x.listType === "developers")!;
    let failed = null;
    for (let i = 0; i < 4 && !failed; i++) {
      const r = await src.runListBuild({ ownerId: devOwner.ownerId, target: 400 });
      if (r.run.status === "failed") failed = r.run;
    }
    expect(failed?.error).toMatch(/Zefix.*not connected/);
    await src.setConnector("zefix", { connected: true });
    const retry = await src.retryJobRun(failed!.id);
    expect(retry).toMatchObject({ retryOf: failed!.id, trigger: "retry" });
    expect(retry.error ?? "").not.toMatch(/Zefix/);
  });

  it("non-admins can't run list builds; owners can re-enrich their own lead", async () => {
    const bdr = await source("diego@atlas.test");
    await expect(bdr.runListBuild()).rejects.toMatchObject({ status: 403 });
    const lead = (await bdr.listLeads({ tiers: [], lists: [], countries: [], stages: [], owners: [], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 })).rows.find((r) => r.company.domain)!;
    const res = await bdr.enrichLead(lead.lead.id);
    expect(res.signals).toBeGreaterThan(0);
    const d = await bdr.getLead(lead.lead.id);
    expect(d.signals.some((s) => s.source === "website_audit")).toBe(true);
  });
});

describe("monthly scoring report", () => {
  it("conversion by tier and by rule for leads first contacted in the month", () => {
    const lead = (id: string, tier: "A" | "B", rules: string[]) => ({ id, tier, listType: "trades", scoreBreakdown: rules.map((ruleId) => ({ ruleId, label: ruleId, points: 1 })) }) as never;
    const touch = (leadId: string, at: string) => ({ id: `a-${leadId}`, leadId, userId: "u", type: "call", at }) as never;
    const r = scoringReport({
      month: "2026-09",
      leads: [lead("1", "A", ["runs_ads"]), lead("2", "A", ["runs_ads"]), lead("3", "B", []), lead("4", "B", [])],
      activities: [touch("1", "2026-09-02T10:00:00Z"), touch("2", "2026-09-03T10:00:00Z"), touch("3", "2026-09-04T10:00:00Z"), touch("4", "2026-08-30T10:00:00Z")],
      meetings: [{ leadId: "1", createdAt: "2026-09-05T10:00:00Z" } as never, { leadId: "3", createdAt: "2026-09-20T10:00:00Z" } as never],
    });
    expect(r).toMatchObject({ contacted: 3, meetings: 2 });
    expect(r.byTier.find((t) => t.key === "A")).toMatchObject({ contacted: 2, meetings: 1, rate: 0.5 });
    expect(r.byRule.find((x) => x.key === "runs_ads")).toMatchObject({ contacted: 2, meetings: 1, rate: 0.5, lift: 0.5 });
  });
});
