import { HEALTH_WEIGHTS, INVOICE_DUE_DAYS } from "@/config/clients";
import { ANNUAL_PAID } from "@/config/priceBook";
import type { ClientHealth, ClientKpis, Invoice, InvoiceLine, Subscription, UsageDay } from "@/data/clientTypes";

/**
 * Billing maths (CRM_BUILD_PROMPT M7, 10_CLIENTS_AND_USAGE.md). Pure functions; periods are calendar months in UTC.
 * Invoices go out on the 1st: the month's overage in arrears plus the next month's fee in advance.
 */

const DAY = 86_400_000;

export const dayKey = (t: number | string | Date) => new Date(t).toISOString().slice(0, 10);
export const monthKey = (t: number | string | Date) => new Date(t).toISOString().slice(0, 7);

export const monthStart = (period: string) => Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1);
export const nextMonth = (period: string) => monthKey(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1));
export const addMonths = (t: number | string, n: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
};

/** Months from `from` through `to`, inclusive ("YYYY-MM"). */
export const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let p = from; p <= to; p = nextMonth(p)) out.push(p);
  return out;
};

export const monthLabel = (period: string, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat("en-GB", { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" }).format(monthStart(period));

/** Overage = max(0, used − included) × rate. */
export const overage = (minutesUsed: number, includedMinutes: number, rateMinor: number) => {
  const overMinutes = Math.max(0, minutesUsed - includedMinutes);
  return { overMinutes, amountMinor: Math.round(overMinutes * rateMinor) };
};

/** The day cumulative use passes the included minutes (the chart turns amber from there), or null. */
export const overLimitFrom = (days: Pick<UsageDay, "date" | "minutes">[], includedMinutes: number) => {
  let run = 0;
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    run += d.minutes;
    if (run > includedMinutes) return d.date;
  }
  return null;
};

/**
 * Monthly fee for one period, prorated by day: nothing before go-live or during the pilot's free month,
 * pilot rate until pilotUntil, then the list fee. Annual subscriptions pay through annualCharge instead.
 */
export const feeForPeriod = (sub: Subscription, period: string) => {
  if (sub.billing === "annual") return 0;
  const start = monthStart(period);
  const end = monthStart(nextMonth(period));
  const from = Math.max(start, new Date(sub.startedAt).getTime(), sub.freeUntil ? new Date(sub.freeUntil).getTime() : 0);
  const stop = sub.canceledAt ? Math.min(end, new Date(sub.canceledAt).getTime()) : end;
  if (stop <= from) return 0;
  const rate = sub.pilot && sub.pilotUntil && start < new Date(sub.pilotUntil).getTime() ? sub.monthlyMinor : sub.listMonthlyMinor;
  const days = Math.round((end - start) / DAY);
  const billed = Math.round((Math.ceil((stop - from) / DAY) * rate) / days);
  return Math.min(rate, billed);
};

/** Annual prepay: 12 months for the price of 10 (ANNUAL_PAID), charged when the year starts. */
export const annualCharge = (sub: Subscription) => sub.monthlyMinor * ANNUAL_PAID;

const sym = (currency: "USD" | "EUR") => (currency === "USD" ? "$" : "€");
export const money = (minor: number, currency: "USD" | "EUR", decimals = true) =>
  `${sym(currency)}${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 })}`;

/** Month-end invoice: the closed month's overage plus the next month's fee (when the subscription is active). */
export const monthEndLines = (sub: Subscription, period: string, minutesUsed: number): InvoiceLine[] => {
  const lines: InvoiceLine[] = [];
  const over = overage(minutesUsed, sub.includedMinutes, sub.overageRateMinor);
  if (over.amountMinor > 0) {
    lines.push({ type: "overage", description: `Overage · ${over.overMinutes.toLocaleString("en-US")} min × ${money(sub.overageRateMinor, sub.currency)} (${monthLabel(period, "short")})`, amountMinor: over.amountMinor });
  }
  if (sub.status === "active") {
    const next = nextMonth(period);
    const nextStart = monthStart(next);
    if (sub.billing === "annual") {
      if (sub.prepaidUntil && new Date(sub.prepaidUntil).getTime() <= nextStart) {
        lines.push({ type: "annual", description: `Annual prepay · 12 months for ${ANNUAL_PAID}`, amountMinor: annualCharge(sub) });
      }
    } else {
      const fee = feeForPeriod(sub, next);
      const pilot = sub.pilot && sub.pilotUntil && nextStart < new Date(sub.pilotUntil).getTime();
      if (fee > 0) lines.push({ type: "monthly", description: `Monthly${pilot ? " (pilot)" : ""} · ${monthLabel(next)}`, amountMinor: fee });
    }
  }
  return lines;
};

export const total = (lines: InvoiceLine[]) => lines.reduce((s, l) => s + l.amountMinor, 0);

export const kpisFor = (days: UsageDay[]): ClientKpis => ({
  callsAnswered: days.reduce((s, d) => s + d.calls, 0),
  afterHours: days.reduce((s, d) => s + d.afterHours, 0),
  jobsBooked: days.reduce((s, d) => s + d.booked, 0),
  missed: days.reduce((s, d) => s + d.missed, 0),
  minutes: days.reduce((s, d) => s + d.minutes, 0),
});

/** Margin after usage: (revenue − our usage cost) / revenue. */
export const marginPct = (revenueMinor: number, usageCostMinor: number) => (revenueMinor > 0 ? Math.round(((revenueMinor - usageCostMinor) / revenueMinor) * 100) : null);

/** 1 at or above `full` × normal, falling to 0 at `zero` × normal. */
const ratioScore = (ratio: number, full = 0.8, zero = 0.3) => Math.max(0, Math.min(1, (ratio - zero) / (full - zero)));

/**
 * Health (10_CLIENTS_AND_USAGE.md): usage vs normal 40% · bookings trend 30% · on-time payment 20% · tickets 10%.
 * Usage: last 7 days against the 28 days before. Bookings: last 14 days against the 14 before.
 */
export const healthScore = (input: { days: UsageDay[]; now: number; invoices: Pick<Invoice, "status" | "dueAt">[]; openTickets: number; metered: boolean }): ClientHealth => {
  const { now } = input;
  const sum = (from: number, to: number, f: (d: UsageDay) => number) =>
    input.days.filter((d) => {
      const t = Date.parse(`${d.date}T00:00:00Z`);
      return t >= now - from * DAY && t < now - to * DAY;
    }).reduce((s, d) => s + f(d), 0);

  let usage = 1;
  let bookings = 1;
  if (input.metered && input.days.length >= 14) {
    const recent = sum(7, 0, (d) => d.minutes) / 7;
    const normal = sum(35, 7, (d) => d.minutes) / 28;
    usage = normal > 0 ? ratioScore(recent / normal) : 1;
    const b1 = sum(14, 0, (d) => d.booked);
    const b0 = sum(28, 14, (d) => d.booked);
    bookings = b0 > 0 ? ratioScore(b1 / b0) : 1;
  }
  const late = input.invoices.some((i) => i.status === "open" && new Date(i.dueAt).getTime() < now);
  const payment = late ? 0 : 1;
  const tickets = input.openTickets === 0 ? 1 : input.openTickets === 1 ? 0.5 : 0;

  const parts = {
    usage: Math.round(usage * HEALTH_WEIGHTS.usage),
    bookings: Math.round(bookings * HEALTH_WEIGHTS.bookings),
    payment: Math.round(payment * HEALTH_WEIGHTS.payment),
    tickets: Math.round(tickets * HEALTH_WEIGHTS.tickets),
  };
  const score = parts.usage + parts.bookings + parts.payment + parts.tickets;
  const problems = [
    usage < 0.75 ? "usage down" : null,
    bookings < 0.75 ? "fewer bookings" : null,
    late ? "invoice overdue" : null,
    tickets < 1 ? "open tickets" : null,
  ].filter(Boolean) as string[];
  const reason = problems.length ? problems.join(", ") : `${input.metered ? "usage steady" : "no issues"}, paid on time`;
  return { score, risk: score >= 75 ? "low" : score >= 60 ? "medium" : "high", reason, parts };
};

export const dueDate = (issuedAt: number) => new Date(issuedAt + INVOICE_DUE_DAYS * DAY).toISOString();
