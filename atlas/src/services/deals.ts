import { DEAL_STAGES, type DealRow, type DealStage } from "@/data/salesTypes";

/** Where a deal's quote is: the four dots on the deals list. */
export type QuoteProgress = "none" | "draft" | "sent" | "opened" | "paid";

export const quoteProgress = (row: DealRow): QuoteProgress => {
  const q = row.latestQuote;
  if (!q) return "none";
  if (q.paidAt || q.status === "paid" || row.deal.depositPaid) return "paid";
  if (q.openedAt || q.status === "accepted") return "opened";
  if (q.sentAt || q.status === "sent") return "sent";
  return "draft";
};

const OPEN: DealStage[] = DEAL_STAGES.filter((s) => s !== "won" && s !== "lost");

/** Money per currency, so USD and EUR are never added together. */
export type ByCurrency = Partial<Record<"USD" | "EUR", number>>;
const add = (acc: ByCurrency, c: "USD" | "EUR", minor: number) => ({ ...acc, [c]: (acc[c] ?? 0) + minor });

export interface DealsSummary {
  openCount: number;
  openSetup: ByCurrency;
  openMonthly: ByCurrency;
  wonThisMonth: number;
  wonMonthly: ByCurrency;
  /** Quotes sent and not yet paid: the client has the ball. */
  waitingOnClient: number;
  /** Average setup of open deals, per currency. */
  avgSetup: ByCurrency;
}

export const dealsSummary = (rows: DealRow[], monthKey: string): DealsSummary => {
  const open = rows.filter((r) => OPEN.includes(r.deal.stage));
  const won = rows.filter((r) => r.deal.stage === "won" && (r.deal.wonAt ?? "").slice(0, 7) === monthKey);
  const openSetup = open.reduce<ByCurrency>((a, r) => add(a, r.deal.currency, r.deal.setupMinor), {});
  const counts = open.reduce<ByCurrency>((a, r) => add(a, r.deal.currency, 1), {});
  const avgSetup: ByCurrency = {};
  for (const c of ["USD", "EUR"] as const) if (counts[c]) avgSetup[c] = Math.round((openSetup[c] ?? 0) / counts[c]!);
  return {
    openCount: open.length,
    openSetup,
    openMonthly: open.reduce<ByCurrency>((a, r) => add(a, r.deal.currency, r.deal.monthlyMinor), {}),
    wonThisMonth: won.length,
    wonMonthly: won.reduce<ByCurrency>((a, r) => add(a, r.deal.currency, r.deal.monthlyMinor), {}),
    waitingOnClient: open.filter((r) => ["sent", "opened"].includes(quoteProgress(r))).length,
    avgSetup,
  };
};

/** Rows grouped by stage, in pipeline order, empty stages left out. */
export const groupByStage = (rows: DealRow[]) =>
  DEAL_STAGES.map((stage) => ({ stage, rows: rows.filter((r) => r.deal.stage === stage) })).filter((g) => g.rows.length);

const compactNum = (major: number) =>
  major >= 1_000_000 ? `${(major / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : major >= 10_000 ? `${Math.round(major / 1000)}K` : major >= 1000 ? `${(major / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(Math.round(major));

/** "$12,400 + €3,000" (or "—"); compact: "$12.4K + €3K" for KPI tiles. */
export const formatByCurrency = (m: ByCurrency, compact = false) => {
  const parts = (["USD", "EUR"] as const)
    .filter((c) => m[c])
    .map((c) => `${c === "USD" ? "$" : "€"}${compact ? compactNum(m[c]! / 100) : Math.round(m[c]! / 100).toLocaleString("en-US")}`);
  return parts.length ? parts.join(" + ") : "—";
};

export interface DealMove {
  dealId: string;
  company: string;
  text: string;
  /** 1 = do it first. */
  priority: 1 | 2 | 3 | 4;
  tone: "amber" | "cyan" | "mint" | "blue";
}

const DAY_MS = 86_400_000;
const daysAgo = (iso: string | null, now: number) => (iso ? Math.floor((now - new Date(iso).getTime()) / DAY_MS) : 0);

/**
 * Today, for a BDR or closer: the open deals that need them now, in the order to do them. Meetings in the next
 * 24 hours first (prep), then money waiting (paid → mark won, opened → ask for the deposit), then quotes to chase or
 * send. Deals where the next step is the client's and still fresh are left out.
 */
export const dealsToMove = (rows: DealRow[], userId: string, now: number, limit = 5): DealMove[] => {
  const out: (DealMove & { age: number })[] = [];
  for (const r of rows) {
    if (r.deal.ownerId !== userId || r.deal.stage === "won" || r.deal.stage === "lost") continue;
    const p = quoteProgress(r);
    const q = r.latestQuote;
    const base = { dealId: r.deal.id, company: r.company.name };
    const meetingIn = r.nextMeetingAt ? new Date(r.nextMeetingAt).getTime() - now : null;
    if (meetingIn !== null && meetingIn >= 0 && meetingIn < DAY_MS) {
      out.push({ ...base, text: `Prep: meeting in ${meetingIn < 3_600_000 ? `${Math.max(1, Math.round(meetingIn / 60_000))} min` : `${Math.round(meetingIn / 3_600_000)} h`}`, priority: 1, tone: "blue", age: 0 });
    } else if (p === "paid") {
      out.push({ ...base, text: "Deposit paid: mark it won", priority: 1, tone: "mint", age: 0 });
    } else if (p === "opened" && daysAgo(q?.openedAt ?? null, now) >= 1) {
      const d = daysAgo(q?.openedAt ?? null, now);
      out.push({ ...base, text: `Opened the quote ${d} d ago: call and ask for the deposit`, priority: 2, tone: "cyan", age: d });
    } else if (p === "sent" && daysAgo(q?.sentAt ?? null, now) >= 2) {
      const d = daysAgo(q?.sentAt ?? null, now);
      out.push({ ...base, text: `Quote not opened in ${d} d: call to walk them through it`, priority: 3, tone: "amber", age: d });
    } else if (p === "draft") {
      out.push({ ...base, text: "Quote drafted but not sent", priority: 4, tone: "amber", age: daysAgo(r.deal.stageChangedAt, now) });
    } else if (p === "none" && !r.nextMeetingAt) {
      out.push({ ...base, text: "No quote, no next meeting booked", priority: 4, tone: "amber", age: daysAgo(r.deal.stageChangedAt, now) });
    }
  }
  return out
    .sort((a, b) => a.priority - b.priority || b.age - a.age)
    .slice(0, limit)
    .map(({ age: _age, ...m }) => m);
};
