import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { DataTable } from "@/components/DataTable";
import { Field, RowMenu, useRun } from "@/components/ui/actions";
import { Modal } from "@/components/ui/overlay";
import { usePageChrome } from "@/components/shell/PageChrome";
import { canAccess } from "@/lib/nav";
import { BarChart } from "@/components/charts";
import { EmptyState, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { USD_PER_EUR } from "@/config/targets";
import { ViewBar } from "@/components/ViewBar";
import { data, type ClientsOverview, type DealRow, type InvoiceRow, type Payment, type ViewState } from "@/data";
import { applyView, EMPTY_VIEW, type ViewField } from "@/services/views";
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
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const me = useUser();
  const run = useRun();
  usePageChrome({ context: "Money · payments" });

  const load = useCallback(() => {
    Promise.all([data.listPayments(), data.listInvoices(), data.listDeals(), data.clientsOverview()])
      .then(([p, i, d, o]) => {
        setPayments(p);
        setInvoices(i);
        setDeals(d);
        setOverview(o);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

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
  const fields: ViewField<Payment>[] = [
    { key: "type", label: "Type", type: "select", options: (Object.keys(PAYMENT_TYPE_LABEL) as Payment["type"][]).map((t) => ({ value: t, label: PAYMENT_TYPE_LABEL[t] })), get: (p) => p.type },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "paid", label: "Paid" },
        { value: "failed", label: "Failed" },
        { value: "refunded", label: "Refunded" },
      ],
      get: (p) => p.status,
    },
    { key: "client", label: "Client", type: "select", get: (p) => companyOf(p.dealId) },
    { key: "date", label: "Date", type: "date", get: (p) => p.paidAt.slice(0, 10) },
    { key: "currency", label: "Currency", type: "select", get: (p) => p.currency },
    { key: "amount", label: "Amount in EUR", type: "number", get: (p) => toEurMinor(p.amountMinor, p.currency) / 100 },
  ];
  const shown = applyView(payments, view, fields, (p) => companyOf(p.dealId));
  // The accountant can't open Clients or Deals: their rows don't link anywhere they'd be refused.
  const clientLinks = canAccess(me.role, "clients");
  const dealLinks = canAccess(me.role, "deals");

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
                    <div key={i.id} className="flex flex-col gap-1 border-b border-line-soft px-5 py-3 text-[13px] last:border-b-0">
                      <span className="flex items-center justify-between gap-3">
                        {clientLinks ? (
                          <Link to={`/clients/${i.clientId}`} className="truncate font-medium hover:text-cyan">
                            {i.companyName}
                          </Link>
                        ) : (
                          <span className="truncate font-medium">{i.companyName}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <span className="num">{money(i.totalMinor, i.currency)}</span>
                          <RowMenu
                            label={`Actions for ${i.companyName}'s invoice`}
                            items={[
                              { label: "Send a reminder", hidden: me.role !== "admin", onSelect: async () => (await run(() => data.sendInvoiceReminder(i.id), `Reminder queued to ${i.companyName}`)) && load() },
                              { label: "Mark paid (bank transfer)", onSelect: () => setPaying(i) },
                            ]}
                          />
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-3 text-[12px]">
                        <Pill hue={st.tone} dot>
                          {st.label}
                        </Pill>
                        <span className="truncate text-text-2">{st.action ?? `Due ${tableDate(i.dueAt)}`}</span>
                      </span>
                    </div>
                  );
                })
            ) : (
              <p className="m-0 px-5 py-6 text-[13px] text-text-3">No open invoices. Month-end invoices appear here until Stripe confirms the payment.</p>
            )}
          </div>
        </section>
      </div>

      <section aria-label="All payments" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold">All payments · {shown.length}</span>
          <ViewBar page="payments" fields={fields} rows={payments} value={view} onChange={setView} placeholder="Client" />
        </div>
        <DataTable<Payment>
          id="payments"
          label="All payments"
          minWidth={760}
          rows={shown}
          rowKey={(p) => p.id}
          rowHref={dealLinks ? (p) => `/deals/${p.dealId}` : undefined}
          defaultSort={{ key: "date", dir: "desc" }}
          empty={<EmptyState title={payments.length ? "No payment matches these filters." : "No payments yet. Deposits arrive when a client pays from the quote page."} />}
          footer={shown.length ? <span>{eur(shown.filter((p) => p.status === "paid").reduce((n, p) => n + toEurMinor(p.amountMinor, p.currency), 0))} collected in this view</span> : null}
          columns={[
            { key: "date", header: "Date", width: "100px", sortValue: (p) => p.paidAt, render: (p) => <span className="num text-text-2">{tableDate(p.paidAt)}</span> },
            { key: "client", header: "Client", width: "minmax(0,1.4fr)", sortValue: (p) => companyOf(p.dealId), render: (p) => <span className="block truncate">{companyOf(p.dealId)}</span> },
            { key: "type", header: "Type", width: "150px", hideable: true, sortValue: (p) => p.type, render: (p) => <Pill hue={TYPE_HUE[p.type]}>{PAYMENT_TYPE_LABEL[p.type]}</Pill> },
            {
              key: "status",
              header: "Status",
              width: "100px",
              hideable: true,
              sortValue: (p) => p.status,
              render: (p) => (
                <Pill hue={STATUS_HUE[p.status]} dot className="capitalize">
                  {p.status}
                </Pill>
              ),
            },
            { key: "amount", header: "Amount", width: "110px", align: "right", sortValue: (p) => toEurMinor(p.amountMinor, p.currency), render: (p) => <span className="num">{money(p.amountMinor, p.currency)}</span> },
            { key: "eur", header: "In EUR", width: "110px", align: "right", hideable: true, render: (p) => <span className="num text-text-2">{eur(toEurMinor(p.amountMinor, p.currency))}</span> },
            {
              key: "ref",
              header: "Reference",
              width: "minmax(0,1fr)",
              hideable: true,
              defaultHidden: true,
              render: (p) => <span className="block truncate font-mono text-[11px] text-text-3">{p.stripeEventId.startsWith("manual:") ? p.stripeEventId.split(":")[1] : p.stripeEventId}</span>,
            },
          ]}
        />
      </section>
      {paying ? <MarkPaid invoice={paying} onClose={() => setPaying(null)} onDone={load} /> : null}
    </div>
  );
};

/** A bank transfer arrived: record it with the reference so the books match. */
const MarkPaid = ({ invoice, onClose, onDone }: { invoice: InvoiceRow; onClose: () => void; onDone: () => void }) => {
  const run = useRun();
  const [f, setF] = useState({ paidAt: new Date().toISOString().slice(0, 10), reference: "" });
  return (
    <Modal open onClose={onClose} title={`Mark paid · ${invoice.companyName}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => data.markInvoicePaid(invoice.id, f), `${invoice.companyName} marked paid`)) {
            onClose();
            onDone();
          }
        }}
      >
        <span className="text-[13px] text-text-2">
          {money(invoice.totalMinor, invoice.currency)} · {invoice.period === "go-live" ? "go-live" : invoice.period}. Commission on it starts its 30-day window from this date.
        </span>
        <Field label="Day the money arrived">
          <input className="input" type="date" required value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} />
        </Field>
        <Field label="Bank reference">
          <input className="input" required value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="e.g. Wise 81723 or the bank's transaction id" />
        </Field>
        <button type="submit" className="btn-primary" disabled={!f.reference.trim()}>
          Mark paid
        </button>
      </form>
    </Modal>
  );
};

export default Payments;
