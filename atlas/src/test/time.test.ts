import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026 (W40)
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
const source = async (email = "rinor@atlas.test", now: () => number = () => NOW) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now, storage: new MemoryStorage() });
  await switchTo(src, email);
  return src;
};
const usClient = async (src: DataSource) => {
  for (const c of (await src.clientsOverview()).cards.filter((x) => x.status === "live")) {
    const d = await src.getClient(c.id);
    if (d.finance?.currency === "USD" && d.finance.subscription?.status === "active") return d;
  }
  throw new Error("no live US client in the seed");
};

describe("M13 time reports (seeded September)", () => {
  it("matches the mockup's KPI cards", async () => {
    const src = await source();
    const r = await src.timeReport({ month: "2026-09", group: "client" });
    expect(r.totalHours).toBe(345);
    expect(Object.fromEntries(r.byPerson.map((p) => [p.userId, p.hours]))).toEqual({ "u-rinor": 49, "u-cofounder": 128, "u-bdr": 168 });
    const k = Object.fromEntries(r.kpis.map((x) => [x.key, x]));
    expect(k.hours.value).toBe("345");
    expect(k.client.value).toBe("34.5 h");
    expect(k.client.note).toBe("10% of all hours");
    expect(k.billable.value).toBe("0 h");
    expect(k.estimates.value).toBe("1.2×");
  });

  it("client profitability: per-hour and status", async () => {
    const src = await source();
    const r = await src.timeReport({ month: "2026-09", group: "client" });
    const row = (label: string) => r.rows.find((x) => x.label === label)!;
    expect(row("Prishtina Tower Residences")).toMatchObject({ hours: 22, perHourMinor: 14_773, currency: "EUR", status: "HEALTHY", type: "Arcadian" });
    expect(row("Sunrise HVAC")).toMatchObject({ hours: 7.5, perHourMinor: 8_000, currency: "USD", status: "OK" });
    expect(row("Bluewater Plumbing")).toMatchObject({ hours: 5, perHourMinor: 12_000, status: "HEALTHY" });
    expect(row("Thameside Homes")).toMatchObject({ hours: 6, revenueMinor: null, status: "SALES" });
    expect(row("Atlas CRM")).toMatchObject({ hours: 31, status: "INTERNAL" });
    expect(row("Outreach and calls")).toMatchObject({ hours: 273.5, status: "INTERNAL" });
    // Totals add up exactly.
    expect(r.rows.reduce((n, x) => n + x.hours, 0)).toBe(r.totalHours);
    const byPerson = await src.timeReport({ month: "2026-09", group: "person" });
    expect(byPerson.rows.reduce((n, x) => n + x.hours, 0)).toBe(345);
    const byCat = await src.timeReport({ month: "2026-09", group: "category" });
    expect(byCat.rows.reduce((n, x) => n + x.hours, 0)).toBe(345);
  });

  it("weekend chart: only Saturday–Sunday entries in Rinor's timezone", async () => {
    const src = await source();
    const r = await src.timeReport({ month: "2026-09", group: "client" });
    expect(r.weekend.map((w) => [w.label, w.hours])).toEqual([["W36", 11], ["W37", 12], ["W38", 14], ["W39", 12]]);
    expect(r.weekendTarget).toBe(12);
    // A weekday entry doesn't count.
    await src.addManualEntry({ date: "2026-10-01", minutes: 120, link: null, category: "Operations", billable: false });
    const oct = await src.timeReport({ month: "2026-10", group: "client" });
    expect(oct.weekend.every((w) => w.hours === 0)).toBe(true);
  });

  it("estimate accuracy by category feeds the planner (Development 1.3×)", async () => {
    const src = await source();
    const r = await src.timeReport({ month: "2026-09", group: "client" });
    expect(r.accuracy.map((a) => [a.category, a.ratio])).toEqual([
      ["Development", 1.3],
      ["Client setup (delivery)", 1.1],
      ["Sales tasks", 1],
      ["Research", 1.4],
    ]);
  });

  it("the implementer sees hours only; a BDR gets 403", async () => {
    const lena = await source("lena@atlas.test");
    const r = await lena.timeReport({ month: "2026-09", group: "client" });
    expect(r.money).toBe(false);
    expect(r.rows.every((x) => x.revenueMinor === null && x.perHourMinor === null && x.marginMinor === null)).toBe(true);
    const csv = await lena.exportTimeCsv({ month: "2026-09", group: "client" });
    expect(csv.split("\n")[0]).toBe("name,detail,type,hours,status");
    const bdr = await source("diego@atlas.test");
    await expect(bdr.timeReport({ month: "2026-09", group: "client" })).rejects.toMatchObject({ status: 403 });
  });

  it("CSV export for admins has the money columns", async () => {
    const src = await source();
    const csv = await src.exportTimeCsv({ month: "2026-09", group: "client" });
    const [head, ...rows] = csv.split("\n");
    expect(head).toBe("name,detail,type,hours,revenue,per_hour,margin,currency,status");
    expect(rows.find((x) => x.startsWith("Prishtina"))).toContain("3250.00,147.73");
  });
});

describe("M13 my week, locks and approvals", () => {
  it("grid cells round to quarter hours and totals add up", async () => {
    const src = await source();
    const t = await src.timeTargets();
    await src.addManualEntry({ date: "2026-09-28", minutes: 60, link: { type: "project", id: t.projects[0].id }, category: "Delivery", billable: false });
    let w = await src.myWeek({ week: "2026-W40" });
    const row = w.rows.find((r) => r.label === t.projects[0].name)!;
    await src.setTimeCell({ week: "2026-W40", rowKey: row.key, day: 1, hours: 1.6 });
    w = await src.myWeek({ week: "2026-W40" });
    const r2 = w.rows.find((r) => r.key === row.key)!;
    expect(r2.cells.slice(0, 2)).toEqual([1, 1.5]);
    expect(r2.total).toBe(2.5);
    expect(w.total).toBe(w.rows.reduce((n, r) => n + r.total, 0));
    expect(w.dayTotals.reduce((a, b) => a + b, 0)).toBe(w.total);
  });

  it("submitted and approved weeks are locked until an admin reopens them", async () => {
    const src = await source("diego@atlas.test");
    // The seeded September weeks are approved.
    await expect(src.addManualEntry({ date: "2026-09-15", minutes: 30, link: null, category: "Sales", billable: false })).rejects.toThrow(/approved/);
    await src.addManualEntry({ date: "2026-09-29", minutes: 30, link: null, category: "Sales", billable: false });
    await src.submitWeek("2026-W40");
    await expect(src.addManualEntry({ date: "2026-09-30", minutes: 30, link: null, category: "Sales", billable: false })).rejects.toThrow(/submitted/);
    const entries = await src.listWeekEntries({ week: "2026-W40" });
    await expect(src.deleteManualEntry(entries[0].id)).rejects.toThrow(/submitted/);
    // Timers can't log into a locked week either.
    await src.startTimerOn({ type: "project", id: (await src.timeTargets()).projects[0].id });
    await expect(src.stopRunningTimer()).rejects.toThrow(/submitted/);
    await expect(src.reopenWeek("u-bdr", "2026-W40", "fix")).rejects.toMatchObject({ status: 403 });
    await switchTo(src, "rinor@atlas.test");
    await src.reopenWeek("u-bdr", "2026-W40", "Missing Wednesday");
    await switchTo(src, "diego@atlas.test");
    expect((await src.myWeek({ week: "2026-W40" })).timesheet).toMatchObject({ status: "draft", comment: "Missing Wednesday" });
    await src.addManualEntry({ date: "2026-09-30", minutes: 30, link: null, category: "Sales", billable: false });
  });

  it("an approved billable week creates the right Stripe invoice items, billed at month end", async () => {
    let t = NOW;
    const src = await source("rinor@atlas.test", () => t);
    const client = await usClient(src);
    await src.addManualEntry({ date: "2026-10-01", minutes: 360, link: { type: "client", id: client.client.id }, category: "Development", billable: true });
    await src.addManualEntry({ date: "2026-10-02", minutes: 90, link: { type: "client", id: client.client.id }, category: "Development", billable: false });
    await src.submitWeek("2026-W40");
    await expect(src.approveWeek("u-rinor", "2026-W40")).rejects.toMatchObject({ status: 403 });
    await switchTo(src, "artin@atlas.test");
    await expect(src.approveWeek("u-rinor", "2026-W40")).resolves.toEqual({ invoiceItems: 1 });
    const items = await src.listInvoiceItems(client.client.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ minutes: 360, rateMinor: 8_750, amountMinor: 52_500, currency: "USD", status: "pending" });
    expect(items[0].description).toContain("6 h × $87.50");
    // The next-invoice preview shows the item.
    const preview = (await src.getClient(client.client.id, "2026-10")).finance!.next!;
    expect(preview.lines.find((l) => l.type === "time")?.amountMinor).toBe(52_500);
    // Month end: the October invoice carries it, and it's marked invoiced.
    t = Date.UTC(2026, 10, 1, 6);
    await switchTo(src, "rinor@atlas.test");
    await src.runBillingJobs();
    const inv = (await src.getClient(client.client.id, "2026-10")).finance!.invoices.find((i) => i.period === "2026-10")!;
    expect(inv.lines.find((l) => l.type === "time")).toMatchObject({ amountMinor: 52_500 });
    expect((await src.listInvoiceItems(client.client.id))[0]).toMatchObject({ status: "invoiced", invoiceId: inv.id });
  });

  it("reopening an approved week withdraws its pending invoice items", async () => {
    const src = await source();
    const client = await usClient(src);
    await src.addManualEntry({ date: "2026-10-01", minutes: 120, link: { type: "client", id: client.client.id }, category: "Development", billable: true });
    await src.submitWeek("2026-W40");
    await switchTo(src, "artin@atlas.test");
    expect(await src.pendingTimesheets()).toEqual([expect.objectContaining({ userId: "u-rinor", week: "2026-W40" })]);
    await src.approveWeek("u-rinor", "2026-W40");
    expect(await src.listInvoiceItems(client.client.id)).toHaveLength(1);
    await src.reopenWeek("u-rinor", "2026-W40", "Wrong client");
    expect(await src.listInvoiceItems(client.client.id)).toHaveLength(0);
  });

  it("people enter their own time; admins can switch person", async () => {
    const bdr = await source("diego@atlas.test");
    await expect(bdr.myWeek({ userId: "u-rinor" })).rejects.toMatchObject({ status: 403 });
    expect((await bdr.myWeek()).people).toBeNull();
    const admin = await source();
    const w = await admin.myWeek({ userId: "u-bdr", week: "2026-W38" });
    expect(w.total).toBe(40);
    expect(w.timesheet.status).toBe("approved");
  });

  it("timer on a client: one running timer, stop logs an entry with an end time", async () => {
    let t = NOW;
    const src = await source("rinor@atlas.test", () => t);
    const client = await usClient(src);
    await src.startTimerOn({ type: "client", id: client.client.id }, "Delivery");
    t += 45 * 60_000;
    expect((await src.runningTimer())?.label).toBe(client.companyName);
    await src.stopRunningTimer();
    expect(await src.runningTimer()).toBeNull();
    const e = (await src.listWeekEntries({ week: "2026-W40" })).find((x) => x.label === client.companyName)!;
    expect(e).toMatchObject({ minutes: 45, source: "timer", category: "Delivery" });
  });
});

describe("M13 guardrails", () => {
  it("has no idle or activity-tracking code", () => {
    const root = resolve(__dirname, "..");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (f !== "test") walk(p);
        } else if (/\.(ts|tsx)$/.test(f)) files.push(p);
      }
    };
    walk(root);
    const bad = /requestIdleCallback|visibilitychange|\bidle(Time|Detect|Timeout)|mousemove|screenshot|getDisplayMedia|activity ?track/i;
    const hits = files.filter((f) => /time|Timer/i.test(f)).filter((f) => bad.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
    expect(hits).toEqual([]);
  });
});
