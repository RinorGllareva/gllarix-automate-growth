/**
 * Money › Payments and Money › Financial plan: currency conversion at the planning rate, cash collected per month,
 * and the failed-payment ladder from spec/backbone/09 (Stripe retries → day 3 email → day 7 call → day 14 pause →
 * day 30 cancel and chase).
 */
import { USD_PER_EUR } from "@/config/targets";
import type { Payment } from "@/data/quoteTypes";
import type { InvoiceRow } from "@/data/clientTypes";
import type { CashSnapshot, Expense } from "@/data/advisorTypes";
import type { Commission } from "@/data/salesTypes";

/** Minor units → EUR minor units at the planning rate (€1 = $1.15). */
export const toEurMinor = (minor: number, currency: "USD" | "EUR") => (currency === "USD" ? minor / USD_PER_EUR : minor);

export const PAYMENT_TYPE_LABEL: Record<Payment["type"], string> = {
  setup_deposit: "Setup deposit",
  setup_balance: "Setup balance",
  monthly: "Monthly fee",
  overage: "Extra minutes",
  time: "Billable hours",
};

/** "2026-10" for the n months up to and including the month of `now`, oldest first. */
export const lastMonths = (now: Date, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });

export const monthLabel = (key: string) => new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));

/** Paid cash per month in EUR (minor), split by payment type. Refunds and failures don't count. */
export const collectedByMonth = (payments: Payment[], months: string[]) =>
  months.map((month) => {
    const rows = payments.filter((p) => p.status === "paid" && p.paidAt.slice(0, 7) === month);
    const byType: Partial<Record<Payment["type"], number>> = {};
    for (const p of rows) byType[p.type] = (byType[p.type] ?? 0) + toEurMinor(p.amountMinor, p.currency);
    return { month, totalEur: Object.values(byType).reduce((n, x) => n + (x ?? 0), 0), byType, count: rows.length };
  });

export interface DunningStep {
  days: number;
  label: string;
  /** What to do now; null when nothing is needed yet. */
  action: string | null;
  tone: "text-3" | "amber" | "orange" | "coral";
}

/** Where an unpaid invoice is on the failed-payment ladder. */
export const dunningStep = (inv: Pick<InvoiceRow, "status" | "dueAt">, now: number): DunningStep | null => {
  if (inv.status !== "open") return null;
  const days = Math.floor((now - new Date(inv.dueAt).getTime()) / 86_400_000);
  if (days < 0) return { days, label: `Due in ${-days} day${days === -1 ? "" : "s"}`, action: null, tone: "text-3" };
  if (days < 3) return { days, label: days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} late`, action: "Stripe is retrying the card", tone: "amber" };
  if (days < 7) return { days, label: `${days} days late`, action: "Send the payment reminder email", tone: "amber" };
  if (days < 14) return { days, label: `${days} days late`, action: "Call the client (BDR or co-founder)", tone: "orange" };
  if (days < 30) return { days, label: `${days} days late`, action: "Pause the service: the agent forwards calls to the client", tone: "coral" };
  return { days, label: `${days} days late`, action: "Cancel and chase the debt", tone: "coral" };
};

/** €12,400 (whole euros, from minor units). */
export const eur = (minor: number) => `€${Math.round(minor / 100).toLocaleString("en-US")}`;
/** €12,400 from whole euros (scenario numbers are whole euros). */
export const eurWhole = (major: number) => `${major < 0 ? "−" : ""}€${Math.abs(Math.round(major)).toLocaleString("en-US")}`;

/** "YYYY-MM" of the month before `now` (UTC): the month being closed. */
export const monthToClose = (now: number) => {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
};

export interface CloseItem {
  key: "bank" | "costs" | "invoices" | "payments" | "approvals" | "statements";
  label: string;
  /** null when this role can't see the data (shown as "founders check"). */
  done: boolean | null;
  detail: string;
  to: string;
  owner: "Founders" | "Accountant";
}

interface CloseInput {
  month: string;
  now: number;
  expenses: Pick<Expense, "date" | "amountMinor" | "currency">[];
  cash: Pick<CashSnapshot, "date">[];
  invoices: Pick<InvoiceRow, "period" | "status" | "dueAt" | "totalMinor" | "currency">[] | null;
  payments: Pick<Payment, "paidAt" | "status" | "amountMinor" | "currency">[] | null;
  closedMonths: string[] | null;
  commissions: Pick<Commission, "period" | "status" | "amountMinor" | "currency">[] | null;
}

/**
 * Month-end close (spec/backbone/09): the six things that must be true before the books for `month` are done and
 * everyone is paid by the 5th. Each line links to the page where it's fixed.
 */
export const monthClose = (i: CloseInput): CloseItem[] => {
  const end = Date.UTC(Number(i.month.slice(0, 4)), Number(i.month.slice(5, 7)), 1); // first instant of next month
  const inMonth = (iso: string) => iso.slice(0, 7) === i.month;
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${i.month}-01T00:00:00Z`));
  const sumEur = (xs: { amountMinor: number; currency: "USD" | "EUR" }[]) => eur(xs.reduce((n, x) => n + toEurMinor(x.amountMinor, x.currency), 0));

  const bank = i.cash.find((c) => {
    const t = new Date(`${c.date}T12:00:00Z`).getTime();
    return t >= end - 4 * 86_400_000 && t < end + 5 * 86_400_000;
  });
  const costs = i.expenses.filter((x) => inMonth(x.date));
  const inv = i.invoices?.filter((x) => x.period === i.month) ?? null;
  const late = inv?.filter((x) => x.status === "open" && new Date(x.dueAt).getTime() < i.now) ?? [];
  const pays = i.payments?.filter((p) => inMonth(p.paidAt)) ?? null;
  const failed = pays?.filter((p) => p.status === "failed") ?? [];
  const lines = i.commissions?.filter((c) => c.period === i.month && c.status !== "void" && c.status !== "clawed_back") ?? null;
  const toPay = lines?.filter((c) => c.status === "earned") ?? [];

  return [
    { key: "bank", label: `Bank balance at the end of ${label}`, owner: "Founders", to: "/finance", done: !!bank, detail: bank ? `Snapshot of ${bank.date}` : "Add a cash snapshot from the bank statement" },
    { key: "costs", label: `${label} costs logged`, owner: "Founders", to: "/finance", done: costs.length > 0, detail: costs.length ? `${costs.length} entr${costs.length === 1 ? "y" : "ies"} · ${sumEur(costs)}` : "No expense dated in the month yet" },
    {
      key: "invoices",
      label: "Client invoices issued and collected",
      owner: "Accountant",
      to: "/payments",
      done: inv === null ? null : late.length === 0,
      detail: inv === null ? "Founders check" : `${inv.length} issued · ${inv.filter((x) => x.status === "paid").length} paid${late.length ? ` · ${late.length} late` : ""}`,
    },
    {
      key: "payments",
      label: "Stripe payments match the invoices",
      owner: "Accountant",
      to: "/payments",
      done: pays === null ? null : failed.length === 0,
      detail: pays === null ? "Founders check" : `${pays.filter((p) => p.status === "paid").length} payments · ${sumEur(pays.filter((p) => p.status === "paid"))}${failed.length ? ` · ${failed.length} failed` : ""}`,
    },
    {
      key: "approvals",
      label: "Meeting approvals locked",
      owner: "Founders",
      to: "/meetings",
      done: i.closedMonths === null ? null : i.closedMonths.includes(i.month),
      detail: i.closedMonths === null ? "Founders lock it on Meetings" : i.closedMonths.includes(i.month) ? "Bonuses for the month are final" : "Lock it so the bonus statement can't change",
    },
    {
      key: "statements",
      label: "Bonus and commission statements paid",
      owner: "Accountant",
      to: "/commissions",
      done: lines === null ? null : toPay.length === 0,
      detail: lines === null ? "Founders check" : toPay.length ? `${sumEur(toPay)} to pay by the 5th` : lines.length ? "All paid" : "Nothing earned this month",
    },
  ];
};
