import { describe, expect, it } from "vitest";
import { depositToLive, diagnose, firstMonthChurn, roleKpis } from "@/services/roleKpis";
import type { Client, Payment, User, WeeklyReport } from "@/data";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 2, 12);
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const client = (id: string, liveDaysAgo: number | null, churnDaysAgo: number | null = null) =>
  ({ id, dealId: `d-${id}`, liveAt: liveDaysAgo === null ? null : iso(liveDaysAgo), churnedAt: churnDaysAgo === null ? null : iso(churnDaysAgo) }) as unknown as Client;
const deposit = (dealId: string, daysAgo: number) => ({ id: dealId, dealId, type: "setup_deposit", status: "paid", paidAt: iso(daysAgo) }) as unknown as Payment;
const report = (status: Record<string, "on_track" | "watch" | "off_track" | null>): WeeklyReport =>
  ({ period: { label: "Week 40" }, kpis: Object.entries(status).map(([key, s]) => ({ key, label: key, value: 1, target: "t", unit: "count", status: s })) }) as unknown as WeeklyReport;

describe("KPIs per role (spec/backbone/05)", () => {
  it("measures deposit to go-live (falling back to the won date) and first-month churn", () => {
    const clients = [client("a", 10), client("b", 20), client("c", 200), client("d", null), client("e", 40, 25)];
    expect(depositToLive([deposit("d-a", 15)], clients, NOW, { "d-b": iso(30), "d-e": iso(45) })).toEqual([5, 10, 5]);
    expect(firstMonthChurn(clients, NOW)).toBe(1);
  });

  it("applies the diagnostic rule: script/list when activity is on but meetings aren't, the rep when activity is off", () => {
    expect(diagnose(report({ dials_per_day: "on_track", conversations_per_day: "watch", meetings_booked: "on_track" }))?.tone).toBe("good");
    expect(diagnose(report({ dials_per_day: "on_track", conversations_per_day: "on_track", meetings_booked: "off_track" }))?.tone).toBe("script");
    expect(diagnose(report({ dials_per_day: "off_track", conversations_per_day: "on_track", meetings_booked: "on_track" }))?.tone).toBe("rep");
    expect(diagnose(report({ dials_per_day: null, conversations_per_day: null }))).toBeUndefined();
  });

  it("lists every role from the plan, empty roles with when to hire, and never invents unmeasured values", () => {
    const users = [
      { id: "u-rinor", name: "Rinor", role: "admin", active: true },
      { id: "u-cofounder", name: "Artin", role: "admin", active: true },
      { id: "u-bdr", name: "Diego", role: "bdr", active: true, dailyCapacity: 150 },
      { id: "u-implementer", name: "Lena", role: "implementer", active: true },
    ] as unknown as User[];
    const blocks = roleKpis({ users, reports: {}, today: [], payments: [], clients: [], now: NOW });
    expect(blocks.map((b) => b.role)).toEqual(["BDR", "Setter", "Closer", "Implementer", "Co-founder", "Rinor"]);
    expect(blocks.find((b) => b.role === "Setter")).toMatchObject({ people: [], hireWhen: expect.stringMatching(/Gate 1/) });
    const pr = blocks.find((b) => b.role === "Rinor")!.lines.find((l) => /PRs/.test(l.label))!;
    expect(pr).toMatchObject({ value: null, status: null, how: expect.stringMatching(/GitHub/) });
  });
});
