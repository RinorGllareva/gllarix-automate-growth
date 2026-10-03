import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Avatar, EmptyState, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { data, type Commission, type User } from "@/data";

const TYPE_LABEL: Record<Commission["type"], string> = {
  meeting_bonus: "Meeting bonus",
  setup_commission: "Setup commission",
  recurring_commission: "Recurring commission",
  quarter_bonus: "Quarter bonus",
};
const STATUS: Record<Commission["status"], { label: string; hue: Hue; help: string }> = {
  pending: { label: "Pending", hue: "amber", help: "Waiting on approval or on the client's payment" },
  earned: { label: "Earned", hue: "cyan", help: "Approved; paid after the 30-day clawback window" },
  paid: { label: "Paid", hue: "mint", help: "Paid out" },
  clawed_back: { label: "Clawed back", hue: "coral", help: "The client cancelled or didn't pay" },
  void: { label: "Void", hue: "text-3", help: "Cancelled" },
};
const money = (minor: number, c: "USD" | "EUR") => `${c === "USD" ? "$" : "€"}${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** People › Bonuses and commissions: what each person has earned, what is pending and what was paid. Admins see everyone. */
const Commissions = () => {
  const me = useUser();
  const [rows, setRows] = useState<Commission[] | null>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Commission["status"] | "all">("all");
  usePageChrome({ context: me.role === "admin" || me.role === "viewer" ? "People · everyone's bonuses" : "People · your bonuses" });

  useEffect(() => {
    data.listCommissions().then(setRows, (e: Error) => setError(e.message));
    if (me.role === "admin" || me.role === "viewer") data.listUsers().then(setPeople, () => setPeople([]));
  }, [me.role]);

  const nameOf = useMemo(() => (id: string) => people.find((p) => p.id === id)?.name ?? (id === me.id ? me.name : "Former teammate"), [people, me]);
  if (error) return <EmptyState title={error} />;
  if (!rows) return <SkeletonRows rows={6} />;

  // Totals are in the payout currency (USD in the seed); every line still shows its own currency.
  const currency = rows[0]?.currency ?? "USD";
  const sum = (s: Commission["status"][]) => rows.filter((r) => s.includes(r.status) && r.currency === currency).reduce((n, r) => n + r.amountMinor, 0);
  const shown = rows.filter((r) => status === "all" || r.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Bonuses and commissions</h1>
        <p className="m-0 text-[14px] text-text-2">$15 per approved meeting, plus setup and recurring commission on won deals. Commission is paid on cash collected, after a 30-day clawback window.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Pending" value={money(sum(["pending"]), currency)} caption={STATUS.pending.help} tone="amber" />
        <KpiCard title="Earned" value={money(sum(["earned"]), currency)} caption={STATUS.earned.help} tone="cyan" />
        <KpiCard title="Paid" value={money(sum(["paid"]), currency)} caption="All time" tone="mint" />
        <KpiCard title="Clawed back" value={money(sum(["clawed_back"]), currency)} caption={STATUS.clawed_back.help} tone="coral" />
      </div>

      <section aria-label="Commission lines" className="card flex min-w-0 flex-col overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <span className="text-[14px] font-semibold">{shown.length} lines</span>
          <div className="flex flex-wrap gap-1">
            {(["all", "pending", "earned", "paid", "clawed_back", "void"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`h-7 rounded-md px-2.5 text-[12px] ${status === s ? "bg-surface-2 text-text shadow-card" : "text-text-3 hover:text-text"}`}>
                {s === "all" ? "All" : STATUS[s].label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid min-w-[760px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_90px_110px_100px] gap-3 border-b border-line-soft px-5 py-2 text-[12px] text-text-3">
          <span>Person</span>
          <span>What</span>
          <span>Period</span>
          <span>Status</span>
          <span className="text-right">Amount</span>
        </div>
        {shown.map((r) => (
          <div key={r.id} className="grid min-w-[760px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_90px_110px_100px] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-[13px] last:border-b-0 hover:bg-surface-2/50">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar id={r.userId} name={nameOf(r.userId)} size={22} />
              <span className="truncate">{nameOf(r.userId)}</span>
            </span>
            <span className="truncate text-text-2" title={r.note ?? undefined}>
              {TYPE_LABEL[r.type]}
            </span>
            <span className="num text-text-2">{r.period}</span>
            <span title={STATUS[r.status].help}>
              <Pill hue={STATUS[r.status].hue} dot>
                {STATUS[r.status].label}
              </Pill>
            </span>
            <span className="num text-right">{money(r.amountMinor, r.currency)}</span>
          </div>
        ))}
        {!shown.length ? <p className="m-0 px-5 py-6 text-[13px] text-text-3">Nothing here yet. Approved meetings and won deals add lines automatically.</p> : null}
      </section>
    </div>
  );
};

export default Commissions;
