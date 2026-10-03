import { describe, expect, it } from "vitest";
import { APPS, appEntriesFor, appForPath, appsForRole, canAccess } from "@/lib/nav";
import { dealsSummary, formatByCurrency, groupByStage, quoteProgress } from "@/services/deals";
import type { DealRow } from "@/data";

describe("apps", () => {
  it("maps each route to its app; the longest entry wins", () => {
    expect(appForPath("/leads/ld-1")?.id).toBe("sell");
    expect(appForPath("/tasks")?.id).toBe("work");
    expect(appForPath("/tasks/planner/p-1")?.id).toBe("work");
    // Growth's pages stand on their own; the Settings copy of cadences keeps the app you were in.
    expect(appForPath("/automations")?.id).toBe("growth");
    expect(appForPath("/cadences")?.id).toBe("growth");
    expect(appForPath("/admin/cadences")).toBeNull();
    expect(appForPath("/finance")?.id).toBe("money");
    expect(appForPath("/commissions")?.id).toBe("people");
    expect(appForPath("/advisor")?.id).toBe("ai");
    expect(appForPath("/admin/users")).toBeNull();
  });

  it("shows each role only apps and pages it can open, plus the planned ones", () => {
    expect(appsForRole("admin").map((a) => a.id)).toEqual(APPS.map((a) => a.id));
    expect(appsForRole("implementer").map((a) => a.id)).toEqual(["sell", "work"]);
    expect(appsForRole("viewer").map((a) => a.id)).toEqual(["sell", "work", "money", "people"]);
    const bdrMoney = APPS.find((a) => a.id === "money")!;
    expect(appsForRole("bdr").some((a) => a.id === "money")).toBe(false);
    // Visible entries are openable or explicitly "soon".
    for (const role of ["admin", "bdr", "viewer", "implementer"] as const)
      for (const app of appsForRole(role)) for (const e of appEntriesFor(app, role)) expect(e.soon || (e.page && canAccess(role, e.page))).toBeTruthy();
    expect(appEntriesFor(bdrMoney, "bdr").every((e) => e.soon)).toBe(true);
    expect(canAccess("bdr", "commissions")).toBe(true);
    expect(canAccess("bdr", "finance")).toBe(false);
  });
});

const row = (over: Partial<DealRow["deal"]>, quote: DealRow["latestQuote"] = null): DealRow =>
  ({
    deal: { id: Math.random().toString(36), stage: "qualified", currency: "USD", setupMinor: 150_000, monthlyMinor: 69_900, depositPaid: false, wonAt: null, ...over },
    latestQuote: quote,
  }) as unknown as DealRow;

describe("deals list", () => {
  it("knows where each quote is", () => {
    expect(quoteProgress(row({}))).toBe("none");
    expect(quoteProgress(row({}, { version: 1, status: "draft", sentAt: null, openedAt: null, paidAt: null }))).toBe("draft");
    expect(quoteProgress(row({}, { version: 1, status: "sent", sentAt: "x", openedAt: null, paidAt: null }))).toBe("sent");
    expect(quoteProgress(row({}, { version: 2, status: "sent", sentAt: "x", openedAt: "y", paidAt: null }))).toBe("opened");
    expect(quoteProgress(row({ depositPaid: true }, { version: 2, status: "accepted", sentAt: "x", openedAt: "y", paidAt: null }))).toBe("paid");
  });

  it("sums per currency, counts this month's wins and quotes waiting on the client", () => {
    const rows = [
      row({ stage: "qualified" }),
      row({ stage: "proposal_sent", currency: "EUR", setupMinor: 1_200_000, monthlyMinor: 44_900 }, { version: 1, status: "sent", sentAt: "x", openedAt: null, paidAt: null }),
      row({ stage: "won", wonAt: "2026-10-02T10:00:00Z" }),
      row({ stage: "won", wonAt: "2026-09-02T10:00:00Z" }),
      row({ stage: "lost" }),
    ];
    const s = dealsSummary(rows, "2026-10");
    expect(s.openCount).toBe(2);
    expect(s.openSetup).toEqual({ USD: 150_000, EUR: 1_200_000 });
    expect(s.wonThisMonth).toBe(1);
    expect(s.waitingOnClient).toBe(1);
    expect(formatByCurrency(s.openSetup)).toBe("$1,500 + €12,000");
    expect(formatByCurrency(s.openSetup, true)).toBe("$1.5K + €12K");
    expect(formatByCurrency({})).toBe("—");
    expect(groupByStage(rows).map((g) => g.stage)).toEqual(["qualified", "proposal_sent", "won", "lost"]);
  });
});
