/**
 * Today, by role. The BDR sees what moves his day and his pay; the founders see one list of everything that is
 * waiting for a decision, gathered from every module, so nobody has to tour 25 pages to find it.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Icon } from "@/components/ui/primitives";
import { MEETING_BONUS_MINOR, CASH_RESERVE_EUR } from "@/config/targets";
import { COMPETITOR_CHECK_DAYS } from "@/config/marketing";
import { data, type Commission, type TodayStats } from "@/data";
import { dunningStep } from "@/services/money";
import { dealsToMove, type DealMove } from "@/services/deals";

const DAY = 86_400_000;
const usd = (minor: number) => `$${Math.round(minor / 100).toLocaleString("en-US")}`;
const waited = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};
/** BDR / closer: money earned this month, and what is still waiting to become money. */
export const MyMoney = ({ stats }: { stats: TodayStats }) => {
  const me = useUser();
  const [rows, setRows] = useState<Commission[] | null>(null);
  useEffect(() => {
    data.listCommissions().then(setRows, () => setRows([]));
  }, []);
  if (!rows) return null;
  const month = new Date().toISOString().slice(0, 7);
  const mine = rows.filter((r) => r.userId === me.id && r.period === month && r.status !== "void" && r.status !== "clawed_back");
  const total = mine.reduce((n, r) => n + r.amountMinor, 0);
  const bonusLines = mine.filter((r) => r.type === "meeting_bonus");
  const bonuses = bonusLines.length;
  const bonusMinor = bonusLines.reduce((n, r) => n + r.amountMinor, 0);
  // Setup, recurring and quarter commission: paid on cash collected, after the 30-day clawback window.
  const commission = total - bonusMinor;
  const waiting = stats.meetingsAwaitingApproval;
  return (
    <section aria-label="Your money this month" className="card flex flex-col gap-3 px-5 py-[18px]">
      <span className="flex items-center justify-between">
        <span className="label-caps">Your money this month</span>
        <Link to="/commissions" className="text-[12px] text-cyan hover:underline">
          Details
        </Link>
      </span>
      <div className="flex items-baseline gap-3">
        <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-mint">{usd(total)}</span>
        <span className="text-[12px] text-text-3">on top of your base</span>
      </div>
      <div className="flex flex-col gap-1 text-[13px]">
        <span className="flex justify-between gap-3">
          <span className="text-text-2">Meeting bonuses ({bonuses} × $15)</span>
          <span className="num">{usd(bonusMinor)}</span>
        </span>
        <span className="flex justify-between gap-3">
          <span className="text-text-2">Commission (paid on cash collected)</span>
          <span className="num">{usd(commission)}</span>
        </span>
        <span className="flex justify-between gap-3">
          <span className="text-text-2">{waiting} meeting{waiting === 1 ? "" : "s"} waiting for approval</span>
          <span className="num text-amber">+{usd(waiting * MEETING_BONUS_MINOR)}</span>
        </span>
      </div>
      <span className="text-[12px] text-text-3">Paid by the 5th from the Atlas statement. Bonuses never come from AI scores.</span>
    </section>
  );
};

/** BDR / closer: inbound requests waiting for a reply (speed-to-lead). */
export const InboundWaiting = () => {
  const [state, setState] = useState<{ open: number; oldest: string | null; target: number } | null>(null);
  useEffect(() => {
    data
      .inboundHome()
      .then((h) => {
        const open = h.requests.filter((r) => r.status === "new").sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
        setState({ open: open.length, oldest: open[0]?.receivedAt ?? null, target: h.targetMinutes });
      })
      .catch(() => setState(null));
  }, []);
  if (!state || !state.open) return null;
  const late = state.oldest && Date.now() - new Date(state.oldest).getTime() > state.target * 60_000;
  return (
    <Link to="/inbound" className={`card flex items-center gap-3 px-5 py-4 hover:border-line-strong ${late ? "border-coral/50" : ""}`}>
      <span className="text-[28px] font-semibold leading-none" style={{ color: late ? "var(--coral)" : "var(--amber)" }}>
        {state.open}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[14px] font-medium">Inbound waiting for a reply</span>
        <span className="text-[12px] text-text-3">Oldest {waited(state.oldest!)} ago · answer within {state.target} min</span>
      </span>
      <Icon d="M5 12h14M13 6l6 6-6 6" size={16} className="ml-auto text-text-3" />
    </Link>
  );
};

interface Item {
  n: number | string;
  text: string;
  to: string;
  tone: "coral" | "amber" | "cyan" | "lavender";
}

/** Founders: one list of decisions waiting, from every module. Each line links to where it's decided. */
export const FounderDecisions = ({ stats }: { stats: TodayStats }) => {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const t = Date.now();
      const out: Item[] = [];
      if (stats.meetingsAwaitingApproval) out.push({ n: stats.meetingsAwaitingApproval, text: `meeting${stats.meetingsAwaitingApproval > 1 ? "s" : ""} to approve ($15 bonus each)`, to: "/meetings", tone: "lavender" });
      const [inbound, invoices, decisions, ops, hiring, markets, fin, training, support] = await Promise.allSettled([
        data.inboundHome(),
        data.listInvoices(),
        data.listDecisions(),
        data.opsHome(),
        data.hiringBoard(),
        data.marketsHome(),
        data.listFinanceData(),
        data.trainingView(),
        data.listTickets(),
      ]);
      if (inbound.status === "fulfilled") {
        const open = inbound.value.requests.filter((r) => r.status === "new");
        const unassigned = open.filter((r) => !r.assignedTo).length;
        if (open.length) out.push({ n: open.length, text: `inbound request${open.length > 1 ? "s" : ""} waiting${unassigned ? ` (${unassigned} not assigned)` : ""}`, to: "/inbound", tone: "amber" });
      }
      if (invoices.status === "fulfilled") {
        const late = invoices.value.filter((i) => (dunningStep(i, t)?.days ?? -1) >= 3);
        if (late.length) out.push({ n: late.length, text: `late invoice${late.length > 1 ? "s" : ""} need a reminder or a call`, to: "/payments", tone: "coral" });
      }
      if (decisions.status === "fulfilled") {
        const spends = decisions.value.filter((d) => d.source === "spend" && d.status.startsWith("proposed"));
        if (spends.length) out.push({ n: spends.length, text: `proposed spend${spends.length > 1 ? "s" : ""} to agree on`, to: "/roi", tone: "cyan" });
        const review = decisions.value.filter((d) => d.reviewDate && d.reviewDate <= new Date(t).toISOString().slice(0, 10) && !/^(done|closed|rejected)/i.test(d.status));
        if (review.length) out.push({ n: review.length, text: `decision${review.length > 1 ? "s are" : " is"} due for review`, to: "/advisor", tone: "cyan" });
      }
      if (ops.status === "fulfilled") {
        const today = new Date(t).toISOString().slice(0, 10);
        const lateSops = ops.value.sops.filter((s) => s.status !== "done" && s.due < today);
        if (lateSops.length) out.push({ n: lateSops.length, text: `SOP${lateSops.length > 1 ? "s" : ""} past due`, to: "/ops", tone: "amber" });
        if (ops.value.capacity.hireImplementer) out.push({ n: "!", text: `Setups are piling up: ${ops.value.capacity.reasons.join("; ")}`, to: "/ops", tone: "coral" });
      }
      if (hiring.status === "fulfilled") {
        const decide = hiring.value.candidates.filter((c) => c.status === "trial" || c.status === "offer");
        if (decide.length) out.push({ n: decide.length, text: `candidate${decide.length > 1 ? "s" : ""} at trial week or offer`, to: "/hiring", tone: "lavender" });
      }
      if (markets.status === "fulfilled") {
        const stale = markets.value.competitors.filter((c) => t - new Date(c.lastCheckedAt).getTime() > COMPETITOR_CHECK_DAYS * DAY);
        if (stale.length) out.push({ n: stale.length, text: "competitor prices older than a quarter", to: "/markets", tone: "cyan" });
      }
      if (support.status === "fulfilled") {
        const late = support.value.tickets.filter((t) => t.sla.overdue);
        if (late.length) out.push({ n: late.length, text: `support ticket${late.length > 1 ? "s" : ""} past the promised reply or fix time`, to: "/support", tone: "coral" });
      }
      if (training.status === "fulfilled") {
        const open = training.value.objections.filter((o) => !o.answered);
        const heard = open.reduce((n, o) => n + o.count, 0);
        if (heard >= 3) out.push({ n: open.length, text: `objection${open.length > 1 ? "s" : ""} BDRs hear without an approved answer (${heard}× in 30 days, top: ${open[0].label})`, to: "/training", tone: "amber" });
      }
      if (fin.status === "fulfilled") {
        const cash = [...fin.value.cash].sort((a, b) => b.date.localeCompare(a.date))[0];
        if (cash && cash.balanceMinor / 100 < CASH_RESERVE_EUR) out.push({ n: "€", text: `Cash is below the €${CASH_RESERVE_EUR.toLocaleString("en-US")} reserve`, to: "/finance", tone: "coral" });
        if (!cash || t - new Date(`${cash.date}T12:00:00Z`).getTime() > 35 * DAY) out.push({ n: "€", text: "No cash snapshot this month: add one for the runway", to: "/finance", tone: "amber" });
      }
      if (alive) setItems(out);
    })();
    return () => {
      alive = false;
    };
  }, [stats.meetingsAwaitingApproval]);

  return (
    <section aria-label="Needs a founder" className="card flex flex-col gap-2.5 px-5 py-[18px]">
      <span className="label-caps">Needs a founder</span>
      {!items ? (
        <span className="text-[13px] text-text-3">Checking every module…</span>
      ) : items.length ? (
        items.map((i) => (
          <Link key={i.text} to={i.to} className="group flex items-start gap-2.5 text-[13px] hover:text-text">
            <span className="num w-6 shrink-0 text-right font-semibold" style={{ color: `var(--${i.tone})` }}>
              {i.n}
            </span>
            <span className="min-w-0 flex-1 text-text-2 group-hover:text-text">{i.text}</span>
            <Icon d="M5 12h14M13 6l6 6-6 6" size={14} className="mt-0.5 shrink-0 text-text-3 opacity-0 group-hover:opacity-100" />
          </Link>
        ))
      ) : (
        <span className="text-[13px] text-text-2">Nothing is waiting for a decision.</span>
      )}
    </section>
  );
};

/** BDR / closer: your open deals that need you today, in the order to do them (services/deals.dealsToMove). */
export const DealsToMove = () => {
  const me = useUser();
  const [moves, setMoves] = useState<DealMove[] | null>(null);
  useEffect(() => {
    data.listDeals().then(
      (rows) => setMoves(dealsToMove(rows, me.id, Date.now())),
      () => setMoves([]),
    );
  }, [me.id]);
  if (!moves || !moves.length) return null;
  return (
    <section aria-label="Deals to move" className="card flex flex-col gap-2.5 px-5 py-[18px]">
      <span className="flex items-center justify-between">
        <span className="label-caps">Deals to move</span>
        <Link to="/deals" className="text-[12px] text-cyan hover:underline">
          All deals
        </Link>
      </span>
      {moves.map((m) => (
        <Link key={m.dealId} to={`/deals/${m.dealId}`} className="group flex items-start gap-2.5 text-[13px]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${m.tone})` }} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium group-hover:text-cyan">{m.company}</span>
            <span className="text-[12px] text-text-2">{m.text}</span>
          </span>
        </Link>
      ))}
    </section>
  );
};
