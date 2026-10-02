import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import type { Subscription, UsageDay } from "@/data/clientTypes";
import { feeForPeriod, healthScore, monthEndLines, overage, overLimitFrom } from "@/services/billing";
import { createFakeUsagePortal } from "@/services/usagePortal";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026
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

const switchTo = async (src: DataSource, email: string) => {
  await src.signOut();
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};
const source = async (email: string, now: () => number = () => NOW) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now, storage: new MemoryStorage() });
  await switchTo(src, email);
  return src;
};

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: "sub", clientId: "c", stripeCustomerId: "cus", stripeSubscriptionId: "sub_t", currency: "USD", market: "us",
  monthlyMinor: 52_400, listMonthlyMinor: 69_900, includedMinutes: 1250, overageRateMinor: 25, billing: "monthly", pilot: true,
  freeUntil: "2026-12-03T10:00:00.000Z", pilotUntil: "2027-11-03T10:00:00.000Z", prepaidUntil: null, voiceAccountId: "va",
  status: "active", startedAt: "2026-11-03T10:00:00.000Z", pausedAt: null, canceledAt: null, ...over,
});

describe("billing maths (10_CLIENTS_AND_USAGE.md)", () => {
  it("overage = max(0, used − included) × rate: the mockup month bills $42.50", () => {
    expect(overage(1420, 1250, 25)).toEqual({ overMinutes: 170, amountMinor: 4250 });
    expect(overage(900, 1250, 25)).toEqual({ overMinutes: 0, amountMinor: 0 });
  });

  it("the invoice for November: 170 min overage + December at the pilot rate = $566.50", () => {
    // Pilot live 3 Nov, first month free until 3 Dec, so December is billed from the 3rd (29 of 31 days).
    const lines = monthEndLines(sub(), "2026-11", 1420);
    expect(lines[0]).toMatchObject({ type: "overage", amountMinor: 4250 });
    expect(lines[1]).toMatchObject({ type: "monthly", amountMinor: Math.round((29 * 52_400) / 31) });
    // From January the full pilot fee: $524 + $42.50 = $566.50.
    expect(monthEndLines(sub(), "2026-12", 1420).reduce((n, l) => n + l.amountMinor, 0)).toBe(56_650);
  });

  it("pilot rate for 12 months, then list; nothing while paused or after cancel", () => {
    expect(feeForPeriod(sub(), "2027-06")).toBe(52_400);
    expect(feeForPeriod(sub(), "2027-12")).toBe(69_900);
    expect(monthEndLines(sub({ status: "paused" }), "2027-01", 100)).toEqual([]);
    expect(feeForPeriod(sub({ pilot: false, freeUntil: null, pilotUntil: null }), "2026-11")).toBe(Math.round((28 * 69_900) / 30));
  });

  it("the chart turns amber from the day cumulative use passes the included minutes", () => {
    const mins = [38, 41, 52, 47, 55, 30, 22, 44, 49, 51, 58, 46, 33, 25, 47, 52, 56, 60, 49, 31, 27, 50, 54, 60, 68, 70, 47, 34, 64, 60];
    const days = mins.map((m, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, minutes: m }));
    expect(overLimitFrom(days, 1250)).toBe("2026-11-27"); // mockup: "Over the limit (from 27 Nov)"
    expect(overLimitFrom(days, 5000)).toBeNull();
  });

  it("health: steady usage and paid on time is low risk; a usage drop and a late invoice go under 60", () => {
    const now = Date.UTC(2026, 10, 30);
    const day = (i: number, minutes: number, booked: number): UsageDay => ({ clientId: "c", date: new Date(now - i * 86_400_000).toISOString().slice(0, 10), minutes, calls: minutes / 2, afterHours: 1, booked, missed: 0, costMinor: 0 });
    const steady = Array.from({ length: 35 }, (_, i) => day(i + 1, 40, 5));
    expect(healthScore({ days: steady, now, invoices: [], openTickets: 0, metered: true })).toMatchObject({ score: 100, risk: "low" });
    const drop = Array.from({ length: 35 }, (_, i) => day(i + 1, i < 7 ? 8 : 40, i < 14 ? 1 : 5));
    const h = healthScore({ days: drop, now, invoices: [{ status: "open", dueAt: new Date(now - 86_400_000).toISOString() }], openTickets: 0, metered: true });
    expect(h.score).toBeLessThan(60);
    expect(h.risk).toBe("high");
    expect(h.reason).toMatch(/usage down.*invoice overdue/);
  });

  it("the fake usage portal is deterministic per account and day", () => {
    const portal = createFakeUsagePortal(() => ({ va: { minutesPerDay: 40, level: 1, declineFrom: null, declineTo: 1 } }));
    expect(portal.dailyUsage("va", "2026-11-04")).toEqual(portal.dailyUsage("va", "2026-11-04"));
    expect(portal.dailyUsage("nope", "2026-11-04").minutes).toBe(0);
  });
});

describe("clients, usage and billing (M7)", () => {
  it("a simulated month bills the correct overage and sends the report", async () => {
    let now = NOW;
    const src = await source("rinor@atlas.test", () => now);
    await src.runBillingJobs();
    const live = (await src.clientsOverview()).cards.find((c) => c.status === "live" && /min/.test(c.line))!;
    expect(live).toBeTruthy();
    // Move a month on: September closes and is invoiced on 1 Oct; October closes on 1 Nov.
    now = Date.UTC(2026, 10, 1, 9);
    await switchTo(src, "rinor@atlas.test"); // the demo session expired over the month
    await src.runBillingJobs();
    const detail = await src.getClient(live.id, "2026-10");
    const sub = detail.finance!.subscription!;
    const oct = detail.finance!.invoices.find((i) => i.period === "2026-10")!;
    const used = detail.days.reduce((n, d) => n + d.minutes, 0);
    const over = Math.max(0, used - sub.includedMinutes);
    const overLine = oct.lines.find((l) => l.type === "overage");
    expect(overLine?.amountMinor ?? 0).toBe(Math.round(over * sub.overageRateMinor));
    expect(oct.status).toBe("paid");
    expect(oct.totalMinor).toBe(oct.lines.reduce((n, l) => n + l.amountMinor, 0));
    const report = detail.reports.find((r) => r.period === "2026-10")!;
    expect(report.kpis.minutes).toBe(used);
    expect(report.emailId).toBeTruthy();
    expect(await src.publicClientReport(report.token)).toMatchObject({ companyName: detail.companyName, kpis: report.kpis });
    // Idempotent: running the jobs again adds nothing.
    expect(await src.runBillingJobs()).toEqual({ usageDays: 0, invoices: 0, reports: 0, tasks: 0, autoSteps: 0 });
  });

  it("onboarding: go-live needs the earlier steps, then starts the subscription (pilot: first month free)", async () => {
    const src = await source("lena@atlas.test");
    const onboarding = (await src.clientsOverview()).cards.find((c) => c.status === "onboarding")!;
    await expect(src.setOnboardingStep(onboarding.id, "go_live", true)).rejects.toThrow(/Finish these first/);
    for (const key of ["intake", "agent_drafted", "number_forwarded", "test_calls"] as const) await src.setOnboardingStep(onboarding.id, key, true);
    await src.setOnboardingStep(onboarding.id, "go_live", true);
    const d = await src.getClient(onboarding.id);
    expect(d.client.status).toBe("live");
    // The implementer sees usage but no finance totals or costs.
    expect(d.finance).toBeNull();
    expect(d.costs).toBeNull();
    expect((await src.clientsOverview()).mrr).toBeNull();
    await switchTo(src, "rinor@atlas.test");
    const admin = await src.getClient(onboarding.id);
    const goLive = admin.finance!.invoices.find((i) => i.period === "go-live")!;
    expect(goLive.status).toBe("paid");
    if (admin.finance!.subscription!.pilot) expect(goLive.lines.some((l) => l.type === "monthly")).toBe(false);
    expect(admin.costs).not.toBeNull();
  });

  it("health under 60 creates one call task within 48 hours", async () => {
    const src = await source("rinor@atlas.test");
    await src.runBillingJobs();
    const cards = (await src.clientsOverview()).cards.filter((c) => c.status === "live");
    const details = await Promise.all(cards.map((c) => src.getClient(c.id)));
    const risky = details.find((d) => d.health && d.health.score < 60);
    expect(risky).toBeTruthy();
    const tasks = risky!.tasks.filter((t) => t.type === "health_call" && !t.doneAt);
    expect(tasks).toHaveLength(1);
    expect(new Date(tasks[0].dueAt).getTime() - NOW).toBeLessThanOrEqual(48 * 3_600_000);
    expect((await src.runBillingJobs()).tasks).toBe(0);
  });

  it("cancel: final invoice, number release + export tasks, unearned commissions clawed back", async () => {
    const src = await source("rinor@atlas.test");
    await src.runBillingJobs();
    const live = (await src.clientsOverview()).cards.find((c) => c.status === "live")!;
    await expect(src.setClientStatus(live.id, "churned", " ")).rejects.toThrow(/reason/);
    await src.setClientStatus(live.id, "paused", "Seasonal slowdown");
    expect((await src.getClient(live.id)).client.status).toBe("paused");
    await src.setClientStatus(live.id, "live", "Back in season");
    await src.setClientStatus(live.id, "churned", "Price");
    const d = await src.getClient(live.id);
    expect(d.client).toMatchObject({ status: "churned", churnReason: "Price" });
    expect(d.finance!.subscription!.status).toBe("canceled");
    expect(d.tasks.filter((t) => t.type !== "health_call").map((t) => t.type).sort()).toEqual(["export_data", "number_release"]);
    const pendingLeft = (await src.listCommissions()).filter((c) => c.dealId === d.deal.id && c.status === "pending" && c.earnableAt && new Date(c.earnableAt).getTime() > NOW);
    expect(pendingLeft).toEqual([]);
    expect((await src.exportClientUsage(live.id)).split("\n")[0]).toBe("date,minutes,calls_answered,after_hours,jobs_booked,missed");
  });

  it("BDRs see only their own clients, read-only", async () => {
    const src = await source("diego@atlas.test");
    const cards = (await src.clientsOverview()).cards.filter((c) => c.status !== "proposal");
    for (const c of cards) {
      const d = await src.getClient(c.id);
      expect(d.deal.ownerId).toBe("u-bdr");
      expect(d.can).toEqual({ onboard: false, status: false, report: false });
      expect(d.costs).toBeNull();
    }
    if (cards[0]) await expect(src.setClientStatus(cards[0].id, "paused", "x")).rejects.toMatchObject({ status: 403 });
  });
});
