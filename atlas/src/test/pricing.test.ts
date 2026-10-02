import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { BRANDS, type MarketId } from "@/config/priceBook";
import { compute, emptySelection, quoteSummary, type QuoteSelection } from "@/services/pricing";

const sel = (market: MarketId, tiers: Record<string, string>, qty: Record<string, number> = {}, extra: Partial<QuoteSelection> = {}): QuoteSelection => ({
  ...emptySelection(market),
  tiers,
  qty,
  ...extra,
});

describe("pricing parity fixtures (09_DEAL_AND_QUOTE.md, CRM_BUILD_PROMPT A11)", () => {
  const nmj = (pilot: boolean) => sel("us", { rec: "rec_m", lp: "lp_2" }, { stl: 1, rev: 1 }, { pilot });

  it("US · Standard + speed-to-lead + reviews + conversion page · pilot → $1,780 + $786, first year $10,426", () => {
    const r = compute(nmj(true));
    expect(r).toMatchObject({ setup: 1780, monthly: 786, firstYear: 10426 });
    expect(r.adj.map((a) => a.name)).toEqual([
      "Never Miss a Job bundle: −10% Gllarix monthly",
      "Landing page with Gllarix: −20% page setup",
      "Pilot: setup at 40%, monthly −25% for 12 months",
    ]);
  });

  it("same without pilot → $4,440 + $1,048", () => {
    expect(compute(nmj(false))).toMatchObject({ setup: 4440, monthly: 1048 });
  });

  it("Kosovo · interactive 3D building → €3,250 + €125", () => {
    expect(compute(sel("xk", { d3: "d3_b" }))).toMatchObject({ setup: 3250, monthly: 125 });
  });

  it("Switzerland · 3D sales platform → €15,000 + €561", () => {
    expect(compute(sel("ch", { d3: "d3_p" }))).toMatchObject({ setup: 15000, monthly: 561 });
  });

  it("applies the rules in order: rush before pilot, extra discount last, capped at 30%", () => {
    const r = compute(sel("us", { rec: "rec_m" }, {}, { rush: true, pilot: true, disc: 50 }));
    expect(r.adj.map((a) => a.name)).toEqual(["Rush delivery: +25% setup", "Pilot: setup at 40%, monthly −25% for 12 months", "Extra discount: −30%"]);
    expect(r.setup).toBe(Math.round((1500 * 1.25 * 0.4 * 0.7) / 10) * 10);
  });

  it("included add-ons and unmet requirements add nothing; annual prepay pays 10 months", () => {
    const r = compute(sel("us", { rec: "rec_m" }, { mctb: 1, lp_page: 2 }, { billing: "annual" }));
    expect(r.lines.map((l) => l.id)).toEqual(["rec_m"]); // text-back included; extra page needs a landing page
    expect(r.paidMonths).toBe(10);
    expect(r.comm).toBe(Math.max(100, 1500 * 0.1) + 699 * 0.1 * 6);
  });

  it("writes the copyable quote text", () => {
    const text = quoteSummary(compute(nmj(true)), nmj(true), "Bluewater Plumbing");
    expect(text).toContain("Setup fee: $1,780 (50% at signing, 50% at launch)");
    expect(text).toContain("Includes 1,250 minutes of AI calls per month; extra minutes at $0.25 per minute");
    expect(text).toContain("Quote valid for 30 days.");
  });
});

/**
 * The real calculator: if pricing/price-calculator.html is available (it's git-ignored, local only),
 * run its own compute() and compare with the port on random quotes. Disagreement fails the test.
 */
const calcPath = resolve(__dirname, "../../spec/pricing/price-calculator.html");
describe.skipIf(!existsSync(calcPath))("parity with pricing/price-calculator.html", () => {
  const html = existsSync(calcPath) ? readFileSync(calcPath, "utf8") : "";
  const start = html.indexOf("var MARKETS=");
  const end = html.indexOf("/* ---------- ledger");
  const source = html.slice(start, end > 0 ? end : undefined);
  const run = (S: QuoteSelection) => {
    // The calculator loads its state with `var S = load()` from localStorage, so hand the quote in that way.
    const state = JSON.stringify({ ...S, client: "" });
    const ctx: Record<string, unknown> = { document: {}, localStorage: { getItem: () => state, setItem: () => undefined } };
    runInNewContext(`${source}\nresult = compute();`, ctx);
    return ctx.result as { setup: number; monthly: number; firstYear: number; comm: number };
  };

  it("the calculator's own constants are the ported ones", () => {
    const ctx: Record<string, unknown> = { S: emptySelection("us"), document: {}, localStorage: { getItem: () => null, setItem: () => undefined } };
    runInNewContext(`${source}\nexported = { BRANDS, BUNDLE, CROSS, PILOT_SETUP, PILOT_MONTHLY, RUSH, ANNUAL_PAID, COMM_PCT, COMM_MIN, COMM_MONTHS };`, ctx);
    const ex = ctx.exported as { BRANDS: typeof BRANDS; BUNDLE: unknown };
    const strip = (b: typeof BRANDS) => b.map((x) => x.groups.map((g) => (g.items ?? []).map((i) => [i.id, i.setup, i.monthly, i.mins ?? null, i.includedWith ?? null, i.requires ?? g.requires ?? null])));
    expect(strip(ex.BRANDS)).toEqual(strip(BRANDS));
    expect(ex.BUNDLE).toEqual({ need: ["stl", "rev"], pct: 10 });
  });

  it("matches compute() on 300 random quotes", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tierGroups = BRANDS.flatMap((b) => b.groups.filter((g) => g.type === "tier"));
    const addons = BRANDS.flatMap((b) => b.groups.filter((g) => g.type === "addon").flatMap((g) => g.items ?? []));
    const markets: MarketId[] = ["us", "we", "ch", "xk"];
    for (let i = 0; i < 300; i += 1) {
      const tiers: Record<string, string> = {};
      tierGroups.forEach((g) => {
        if (rand() < 0.5) tiers[g.id] = g.items![Math.floor(rand() * g.items!.length)].id;
      });
      const qty: Record<string, number> = {};
      addons.forEach((it) => {
        if (rand() < 0.3) qty[it.id] = 1 + Math.floor(rand() * (it.max ?? 1));
      });
      const S = sel(markets[i % 4], tiers, qty, {
        pilot: rand() < 0.3,
        rush: rand() < 0.2,
        billing: rand() < 0.2 ? "annual" : "monthly",
        disc: rand() < 0.3 ? Math.floor(rand() * 35) : 0,
        days: rand() < 0.1 ? Math.floor(rand() * 20) : 0,
      });
      const theirs = run(S);
      const ours = compute(S);
      expect({ setup: ours.setup, monthly: ours.monthly, firstYear: ours.firstYear, comm: ours.comm }).toEqual({
        setup: theirs.setup,
        monthly: theirs.monthly,
        firstYear: theirs.firstYear,
        comm: theirs.comm,
      });
    }
  });
});
