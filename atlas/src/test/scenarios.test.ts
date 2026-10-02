import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_SCENARIOS, pyRound, runScenario, scenarioByBrand, scenarioCombinedV2, type BrandScenarioInput, type CombinedScenarioInput } from "@/services/scenarios";
import fixture from "./fixtures/scenario_parity.json";

const root = resolve(__dirname, "../..");
const sha = (p: string) => createHash("sha256").update(readFileSync(resolve(root, "spec/models", p), "utf8")).digest("hex");

describe("scenario service parity with spec/models (M14)", () => {
  it("the fixture was generated from the current model files", () => {
    for (const [file, hash] of Object.entries(fixture.source)) {
      if (!existsSync(resolve(root, "spec/models", file))) continue; // spec pack not on this machine
      expect(sha(file), `${file} changed: run python scripts/scenario_parity.py`).toBe(hash);
    }
  });

  it("matches scenarios_by_brand.py on its scenarios and 30 random variants", () => {
    for (const row of fixture.by_brand) {
      expect(scenarioByBrand(row.input as unknown as BrandScenarioInput).result, row.name).toEqual(row.output);
    }
  });

  it("matches scenarios_combined_v2.py month by month", () => {
    for (const row of fixture.combined) {
      expect(scenarioCombinedV2(row.input as unknown as CombinedScenarioInput), row.name).toEqual(row.output);
    }
  });

  it("the built-in scenarios are the model's (plans/scenarios_12_months.md)", () => {
    const own = Object.fromEntries(fixture.by_brand.filter((r) => !r.name.startsWith("v")).map((r) => [r.name, r.input]));
    expect(JSON.parse(JSON.stringify(BRAND_SCENARIOS))).toEqual(own);
    expect(scenarioByBrand(BRAND_SCENARIOS.realistic).result).toMatchObject({ g_rev: 85397, a_rev: 68860, g_mrr: 12016 });
  });

  it("rounds like Python", () => {
    expect([pyRound(2.5), pyRound(3.5), pyRound(-0.5), pyRound(0.25, 1), pyRound(7.35, 1), pyRound(1.15, 1)]).toEqual([2, 4, 0, 0.2, 7.3, 1.1]);
  });

  it("run_scenario: costs, cash and hires", () => {
    const base = runScenario({ scenario: "worst", openingCashEur: 0 });
    const hire = runScenario({ scenario: "worst", openingCashEur: 0, hires: [{ label: "Setter #1", fromMonth: 1, monthlyUsd: 350 }] });
    expect(base.months).toHaveLength(12);
    expect(base.totals.revenue).toBeCloseTo(18368 + 11210, -2);
    expect(hire.lowPoint.cash).toBeLessThan(base.lowPoint.cash);
    // Cash = opening + cumulative net (per-month rounding can differ by a few euros).
    const opened = runScenario({ scenario: "worst", openingCashEur: 3000 });
    expect(Math.abs(opened.months[11].cash - (3000 + opened.months.reduce((n, m) => n + m.net, 0)))).toBeLessThanOrEqual(12);
    expect(opened.lowPoint.cash - base.lowPoint.cash).toBe(3000);
    // The setter costs $350 a month from November: 11 months ≈ €3,348 lower cash at the end.
    expect(base.months[11].cash - hire.months[11].cash).toBeCloseTo((11 * 350) / 1.15, -1);
  });
});
