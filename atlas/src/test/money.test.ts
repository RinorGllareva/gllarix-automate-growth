import { describe, expect, it } from "vitest";
import { collectedByMonth, dunningStep, lastMonths, toEurMinor } from "@/services/money";
import { runScenario } from "@/services/scenarios";
import type { Payment } from "@/data";

const DAY = 86_400_000;
const pay = (over: Partial<Payment>): Payment => ({ id: Math.random().toString(36), dealId: "d", clientId: null, amountMinor: 115_00, currency: "USD", type: "monthly", status: "paid", stripeEventId: "e", stripeSessionId: null, paidAt: "2026-10-01T10:00:00Z", ...over });

describe("payments", () => {
  it("converts USD at the planning rate and sums paid cash per month by type", () => {
    expect(toEurMinor(115_00, "USD")).toBeCloseTo(100_00);
    const months = lastMonths(new Date("2026-10-02T00:00:00Z"), 3);
    expect(months).toEqual(["2026-08", "2026-09", "2026-10"]);
    const rows = collectedByMonth(
      [pay({}), pay({ type: "setup_deposit", currency: "EUR", amountMinor: 500_00 }), pay({ status: "refunded" }), pay({ paidAt: "2026-09-15T10:00:00Z" })],
      months,
    );
    expect(rows[2].totalEur).toBeCloseTo(600_00);
    expect(rows[2].byType).toEqual({ monthly: expect.closeTo(100_00), setup_deposit: 500_00 });
    expect(rows[2].count).toBe(2);
    expect(rows[1].count).toBe(1);
    expect(rows[0].totalEur).toBe(0);
  });

  it("follows the failed-payment ladder: retries, day 3 email, day 7 call, day 14 pause, day 30 cancel", () => {
    const due = Date.UTC(2026, 9, 1);
    const at = (days: number) => dunningStep({ status: "open", dueAt: new Date(due).toISOString() }, due + days * DAY + 1000);
    expect(at(-2)?.action).toBeNull();
    expect(at(1)?.action).toMatch(/retrying/);
    expect(at(3)?.action).toMatch(/email/);
    expect(at(8)?.action).toMatch(/Call/);
    expect(at(15)?.action).toMatch(/Pause/);
    expect(at(31)?.action).toMatch(/Cancel/);
    expect(dunningStep({ status: "paid", dueAt: new Date(due).toISOString() }, due)).toBeNull();
  });
});

describe("financial plan what-ifs", () => {
  it("matches the spec's realistic low point from €0 and moves with the levers", () => {
    const base = runScenario({ scenario: "realistic" });
    expect(base.lowPoint).toEqual({ month: "Oct 26", cash: expect.any(Number) });
    expect(Math.round(base.lowPoint.cash / 10) * 10).toBe(-740); // spec/backbone/03: about −€740 (Oct 2026)
    const withCash = runScenario({ scenario: "realistic", openingCashEur: 3420 });
    expect(withCash.lowPoint.cash - base.lowPoint.cash).toBe(3420);
    const setter = runScenario({ scenario: "realistic", hires: [{ label: "Setter #1", fromMonth: 3, monthlyUsd: 350 }] });
    expect(setter.totals.costs - base.totals.costs).toBeGreaterThan(2700);
    expect(setter.totals.costs - base.totals.costs).toBeLessThan(2780);
    const churny = runScenario({ scenario: "realistic", overrides: { churn: 0.1 } });
    expect(churny.mrrEnd).toBeLessThan(base.mrrEnd);
  });
});

describe("month-end close", () => {
  it("checks the six lines for last month and hides what the role can't see", async () => {
    const { monthClose, monthToClose } = await import("@/services/money");
    const now = Date.parse("2026-10-02T10:00:00Z");
    expect(monthToClose(now)).toBe("2026-09");
    const items = monthClose({
      month: "2026-09",
      now,
      expenses: [{ date: "2026-09-12", amountMinor: 11500, currency: "USD" }],
      cash: [{ date: "2026-09-30" }],
      invoices: [
        { period: "2026-09", status: "paid", dueAt: "2026-09-20T00:00:00Z", totalMinor: 69900, currency: "USD" },
        { period: "2026-09", status: "open", dueAt: "2026-09-25T00:00:00Z", totalMinor: 69900, currency: "USD" },
      ],
      payments: [{ paidAt: "2026-09-20T00:00:00Z", status: "paid", amountMinor: 69900, currency: "USD" }],
      closedMonths: null,
      commissions: [{ period: "2026-09", status: "earned", amountMinor: 1500, currency: "USD" }],
    });
    const by = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(by.bank.done).toBe(true);
    expect(by.costs.detail).toBe("1 entry · €100");
    expect(by.invoices).toMatchObject({ done: false, detail: "2 issued · 1 paid · 1 late" });
    expect(by.payments.done).toBe(true);
    expect(by.approvals.done).toBeNull();
    expect(by.statements).toMatchObject({ done: false, detail: "€13 to pay by the 5th" });
  });
});
