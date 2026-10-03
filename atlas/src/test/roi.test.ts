import { describe, expect, it } from "vitest";
import { investmentOrder, roiCheck, unitEconomics } from "@/services/roi";

const base = { closeRate: 0.2, contributionEur: 610, setupEur: 939 };

describe("ROI test (spec/backbone/09)", () => {
  it("passes a tool that pays back inside 3 months and fails one that doesn't", () => {
    const dialer = roiCheck({ ...base, type: "tool", monthlyCostEur: 26, oneOffCostEur: 0, gain: { kind: "meetings", perMonth: 1 } });
    expect(dialer.newClientsPerMonth).toBeCloseTo(0.2);
    expect(dialer.paybackMonth).toBe(1);
    expect(dialer.pass).toBe(true);
    const pricey = roiCheck({ ...base, type: "tool", monthlyCostEur: 2000, oneOffCostEur: 0, gain: { kind: "profit", perMonth: 500 } });
    expect(pricey.paybackMonth).toBeNull();
    expect(pricey.pass).toBe(false);
    expect(pricey.roi).toBeCloseTo((1500 - 6000) / 6000);
  });

  it("uses the spend type's window, pro-rated for the 6-week marketing test", () => {
    const r = roiCheck({ ...base, type: "marketing", monthlyCostEur: 0, oneOffCostEur: 200, gain: { kind: "profit", perMonth: 100 } });
    expect(r.windowMonths).toBe(1.5);
    expect(r.cost).toBe(200);
    expect(r.gain).toBeCloseTo(150);
    expect(r.paybackMonth).toBe(2);
    expect(r.pass).toBe(true);
    const hire = roiCheck({ ...base, type: "hire", monthlyCostEur: 300, oneOffCostEur: 0, gain: { kind: "clients", perMonth: 0.1 } });
    // Month m: setup profit on 0.1 new client + contribution on clients added before.
    expect(hire.months[0].gain).toBeCloseTo(93.9);
    expect(hire.months[1].gain).toBeCloseTo(93.9 * 2 + 61);
    expect(hire.windowMonths).toBe(6);
  });
});

describe("unit economics and the investment order", () => {
  it("computes contribution, CAC, LTV and break-even, and leaves gaps empty", () => {
    const u = unitEconomics({ mrrEur: 2000, liveClients: 3, usageCostEur: 200, salesCostEur: 600, fixedCostsEur: 900, newClients30d: 2 });
    expect(u.contribution).toBe(600);
    expect(u.cac).toBe(300);
    expect(u.ltv).toBe(15_000);
    expect(u.paybackMonths).toBe(0.5);
    expect(u.breakEvenClients).toBe(1.5);
    expect(unitEconomics({ mrrEur: 0, liveClients: 0, usageCostEur: 0, salesCostEur: 600, fixedCostsEur: 900, newClients30d: 0 })).toMatchObject({ contribution: null, cac: null, ltv: null, breakEvenClients: null });
  });

  it("opens the setter only at Gate 1 with two months' pay on top of the reserve, and explains a gate that must hold", () => {
    const gate = (met: boolean, progress: number) => ({ met, progress });
    const steps = investmentOrder({ gate1: gate(true, 1), gate2: gate(false, 1), gate3: gate(false, 0.5), cashEur: 3420, mrrEur: 2800 });
    const setter = steps.find((s) => s.order === 4)!;
    expect(setter.open).toBe(false);
    expect(setter.note).toMatch(/3,609/);
    expect(investmentOrder({ gate1: gate(true, 1), gate2: gate(false, 1), gate3: gate(false, 0.5), cashEur: 3700, mrrEur: 2800 }).find((s) => s.order === 4)!.open).toBe(true);
    expect(steps.find((s) => s.order === 5)!.note).toMatch(/2 month-ends in a row/);
    expect(steps.filter((s) => s.open).map((s) => s.order)).toEqual([1, 2, 3]);
  });
});
