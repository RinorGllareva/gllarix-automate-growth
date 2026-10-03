import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageChrome } from "@/components/shell/PageChrome";
import { BarChart } from "@/components/charts";
import { EmptyState, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { USD_PER_EUR } from "@/config/targets";
import { data, type ClientsOverview, type DealRow, type InvoiceRow, type Payment } from "@/data";
import { tableDate } from "@/lib/format";
import { collectedByMonth, dunningStep, eur, lastMonths, monthLabel, PAYMENT_TYPE_LABEL, toEurMinor } from "@/services/money";

const TYPE_HUE: Record<Payment["type"], Hue> = { setup_deposit: "cyan", setup_balance: "blue", monthly: "mint", overage: "amber", time: "lavender" };
const STATUS_HUE: Record<Payment["status"], Hue> = { paid: "mint", failed: "coral", refunded: "text-3" };
const money = (minor: number, c: "USD" | "EUR") => `${c === "USD" ? "$" : "€"}${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Money › Payments: cash collected, open and late invoices with the next step, and every payment. Admins only. */
const Payments = () => {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [overview, setOverview] = useState<ClientsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<Payment["type"] | "all">("all");
  usePageChrome({ context: "Money · payments" });

  useEffect(() => {
    Promise.all([data.listPayments(), data.listInvoices(), data.listDeals(), data.clientsOverview()])
      .then(([p, i, d, o]) => {
        setPayments(p);
        setInvoices(i);
        setDeals(d);
        setOverview(o);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const now = Date.now();
  const months = useMemo(() => lastMonths(new Date(), 6), []);
  const byMonth = useMemo(() => (payments ? collectedByMonth(payments, months) : []), [payments, months]);

  if (error) return <EmptyState title={error} />;
  if (!payments) return <SkeletonRows rows={8} />;

  const companyOf = (dealId: string) => deals.find((d) => d.deal.id === dealId)?.company.name ?? "—";
  const thisMonth = byMonth[byMonth.length - 1];
  const lastMonth = byMonth[byMonth.length - 2];
  const open = invoices.filter((i) => i.status === "open");
  const late = open.filter((i) => (dunningStep(i, now)?.days ?? -1) >= 0);
  const openEur = open.reduce((n, i) => n + toEurMinor(i.totalMinor, i.currency), 0);
  const mrrEur = overview?.mrr ? toEurMinor(overview.mrr.USD ?? 0, "USD") + (overview.mrr.EUR ?? 0) : 0;
  const shown = payments.filter((p) => type === "all" || p.type === type).sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Payments</h1>
        <p className="m-0 text-[14px] text-text-2">
          Money in from deposits, monthly fees, extra minutes and billable hours. USD is shown in EUR at the planning rate (€1 = ${USD_PER_EUR}).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Collected this month" value={eur(thisMonth?.totalEur ?? 0)} caption={`${thisMonth?.count ?? 0} payments so far${lastMonth ? ` · ${monthLabel(lastMonth.month)}: ${eur(lastMonth.totalEur)}` : ""}`} tone="mint" />
        <KpiCard title="Recurring (MRR)" value={eur(mrrEur)} caption={overview?.nextInvoiceAt ? `Next invoices ${tableDate(overview.nextInvoiceAt)}` : "No live subscriptions"} tone="cyan" />
        <KpiCard title="Open invoices" value={String(open.length)} caption={open.length ? `${eur(openEur)} not paid yet` : "Everything is paid"} />
        <KpiCard title="Late" value={String(late.length)} caption={late.length ? "Follow the steps below" : "No late payments"} tone={late.length ? "coral" : "text"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Collected per month" className="card flex flex-col gap-3 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold">Collected per month</span>
            <span className="text-[12px] text-text-3">Last 6 months · EUR</span>
          </div>
          <BarChart
            ariaLabel="Cash collected per month, last 6 months"
            data={byMonth.map((m) => ({ key: m.month, label: monthLabel(m.month), segments: [{ name: "Collected", value: Math.round(m.totalEur / 100), color: "var(--chart-1)" }] }))}
            format={(v) => (Math.abs(v) >= 1000 ? `€${(v / 1000).toFixed(v % 1000 ? 1 : 0)}K` : `€${v}`)}
            tooltip={(d) => {
              const m = byMonth.find((x) => x.month === d.key)!;
              return (
                <>
                  <div className="pb-1 font-medium text-text">{monthLabel(m.month)} · {eur(m.totalEur)}</div>
                  {(Object.keys(m.byType) as Payment["type"][]).map((t) => (
                    <div key={t} className="flex justify-between gap-4 text-text-2">
                      <span>{PAYMENT_TYPE_LABEL[t]}</span>
                      <span className="num text-text">{eur(m.byType[t] ?? 0)}</span>
                    </div>
                  ))}
                  {!m.count ? <div className="text-text-3">No payments</div> : null}
                </>
              );
            }}
          />
        </section>

        <section aria-label="Open and late invoices" className="card flex flex-col">
          <div className="flex flex-col gap-0.5 border-b border-line px-5 py-3.5">
            <span className="text-[15px] font-semibold">Open invoices</span>
            <span className="text-[12px] text-text-3">Late payments: Stripe retries, day 3 email, day 7 call, day 14 pause, day 30 cancel.</span>
          </div>
          <div className="flex max-h-[320px] flex-col overflow-y-auto">
            {open.length ? (
              open
                .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
                .map((i) => {
                  const st = dunningStep(i, now)!;
                  return (
                    <Link key={i.id} to={`/clients/${i.clientId}`} className="flex flex-col gap-1 border-b border-line-soft px-5 py-3 text-[13px] last:border-b-0 hover:bg-surface-2/50">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium">{i.companyName}</span>
                        <span className="num">{money(i.totalMinor, i.currency)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-3 text-[12px]">
                        <Pill hue={st.tone} dot>
                          {st.label}
                        </Pill>
                        <span className="truncate text-text-2">{st.action ?? `Due ${tableDate(i.dueAt)}`}</span>
                      </span>
                    </Link>
                  );
                })
            ) : (
              <p className="m-0 px-5 py-6 text-[13px] text-text-3">No open invoices. Month-end invoices appear here until Stripe confirms the payment.</p>
            )}
          </div>
        </section>
      </div>

      <section aria-label="All payments" className="card flex min-w-0 flex-col overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <span className="text-[15px] font-semibold">All payments · {shown.length}</span>
          <div className="flex flex-wrap gap-1">
            {(["all", ...(Object.keys(PAYMENT_TYPE_LABEL) as Payment["type"][])] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`h-7 rounded-md px-2.5 text-[12px] ${type === t ? "bg-surface-2 text-text shadow-card" : "text-text-3 hover:text-text"}`}>
                {t === "all" ? "All" : PAYMENT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid min-w-[760px] grid-cols-[100px_minmax(0,1.4fr)_150px_100px_110px_110px] gap-3 border-b border-line-soft px-5 py-2 text-[12px] text-text-3">
          <span>Date</span>
          <span>Client</span>
          <span>Type</span>
          <span>Status</span>
          <span className="text-right">Amount</span>
          <span className="text-right">In EUR</span>
        </div>
        {shown.map((p) => (
          <Link key={p.id} to={`/deals/${p.dealId}`} className="grid min-w-[760px] grid-cols-[100px_minmax(0,1.4fr)_150px_100px_110px_110px] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-[13px] last:border-b-0 hover:bg-surface-2/50">
            <span className="num text-text-2">{tableDate(p.paidAt)}</span>
            <span className="truncate">{companyOf(p.dealId)}</span>
            <span>
              <Pill hue={TYPE_HUE[p.type]}>{PAYMENT_TYPE_LABEL[p.type]}</Pill>
            </span>
            <span>
              <Pill hue={STATUS_HUE[p.status]} dot className="capitalize">
                {p.status}
              </Pill>
            </span>
            <span className="num text-right">{money(p.amountMinor, p.currency)}</span>
            <span className="num text-right text-text-2">{eur(toEurMinor(p.amountMinor, p.currency))}</span>
          </Link>
        ))}
        {!shown.length ? <p className="m-0 px-5 py-6 text-[13px] text-text-3">No payments yet. Deposits arrive when a client pays from the quote page.</p> : null}
      </section>
    </div>
  );
};

export default Payments;
