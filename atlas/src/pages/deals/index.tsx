import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Avatar, EmptyState, KpiCard, SkeletonRows, StageChip } from "@/components/ui/primitives";
import { DEAL_STAGE_HUE, hueVar } from "@/config/colors";
import { data, DEAL_STAGE_LABEL, type DealRow, type DealStage, type DiscountApproval } from "@/data";
import { useRun } from "@/components/ui/actions";
import { since } from "@/lib/format";
import { toEurMinor } from "@/services/money";
import { formatMoney } from "@/services/pricing";
import { dealsSummary, formatByCurrency, groupByStage, quoteProgress, type QuoteProgress } from "@/services/deals";
import { DataTable } from "@/components/DataTable";
import { useCustomColumns } from "@/components/CustomFields";
import { ViewBar } from "@/components/ViewBar";
import type { ViewState } from "@/data";
import { applyView, EMPTY_VIEW, type ViewField } from "@/services/views";
import DealBuilder, { NewDeal } from "./DealBuilder";

const STEPS: { key: Exclude<QuoteProgress, "none">; label: string }[] = [
  { key: "draft", label: "Drafted" },
  { key: "sent", label: "Sent" },
  { key: "opened", label: "Opened" },
  { key: "paid", label: "Deposit paid" },
];
const ORDER: QuoteProgress[] = ["none", "draft", "sent", "opened", "paid"];

/** Four bars: drafted → sent → opened → paid. */
const QuoteDots = ({ p }: { p: QuoteProgress }) => {
  const reached = ORDER.indexOf(p);
  const label = p === "none" ? "No quote yet" : STEPS.find((s) => s.key === p)!.label;
  return (
    <span className="flex items-center gap-2" title={`Quote: ${label}`}>
      <span className="flex items-center gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.key} className="h-1.5 w-4 rounded-full" style={{ background: i < reached ? (p === "paid" ? hueVar("mint") : hueVar("cyan")) : "var(--line-strong)" }} />
        ))}
      </span>
      <span className="truncate text-[12px] text-text-2">{label}</span>
    </span>
  );
};

/** What should happen next on this deal, in plain words. */
const nextStep = (r: DealRow, p: QuoteProgress, tz: string) => {
  if (r.deal.stage === "won") return { text: "Onboard the client", tone: "text-mint" };
  if (r.deal.stage === "lost") return { text: r.deal.lostReason ?? "Lost", tone: "text-text-3" };
  if (r.nextMeetingAt)
    return { text: `Meeting ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(r.nextMeetingAt))}`, tone: "text-blue" };
  return {
    none: { text: "Build the quote", tone: "text-amber" },
    draft: { text: "Send the quote", tone: "text-amber" },
    sent: { text: "Follow up: not opened yet", tone: "text-text-2" },
    opened: { text: "Ask for the deposit", tone: "text-cyan" },
    paid: { text: "Mark won", tone: "text-mint" },
  }[p];
};

const thisMonth = () => new Date().toISOString().slice(0, 7);

/** Founders: discounts above the cap wait here for the other founder. */
const DiscountApprovals = ({ rows, onChanged }: { rows: DealRow[]; onChanged: () => void }) => {
  const run = useRun();
  const [pending, setPending] = useState<DiscountApproval[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const load = useCallback(() => data.pendingDiscounts().then(setPending, () => setPending([])), []);
  useEffect(() => {
    load();
    data.listUsers().then((u) => setNames(Object.fromEntries(u.map((x) => [x.id, x.name]))), () => undefined);
  }, [load]);
  if (!pending.length) return null;
  const company = (dealId: string) => rows.find((r) => r.deal.id === dealId)?.company.name ?? "A deal";
  return (
    <section aria-label="Discounts waiting for approval" className="card flex flex-col gap-2 border-amber/40 p-4">
      <span className="text-[14px] font-semibold">
        {pending.length} discount{pending.length > 1 ? "s" : ""} waiting for your OK
      </span>
      {pending.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 text-[13px]">
          <Link to={`/deals/${a.dealId}`} className="min-w-0 flex-1 truncate hover:text-cyan">
            <span className="font-medium">{company(a.dealId)}</span>
            <span className="text-text-2">
              {" "}
              · {a.pct}% asked by {names[a.requestedBy] ?? "someone"}
              {a.note ? ` · "${a.note}"` : ""}
            </span>
          </Link>
          <button type="button" className="btn-primary h-8 text-[12px]" onClick={async () => (await run(() => data.decideDiscount(a.id, true), `${a.pct}% approved`)) && (load(), onChanged())}>
            Approve
          </button>
          <button type="button" className="btn-outline h-8 text-[12px]" onClick={async () => (await run(() => data.decideDiscount(a.id, false), "Discount rejected")) && (load(), onChanged())}>
            Reject
          </button>
        </div>
      ))}
    </section>
  );
};

const dealId = (r: DealRow) => r.deal.id;

/** /deals: every deal grouped by stage, with what the client pays, where the quote is and the next step. */
const DealsList = () => {
  const user = useUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  const [showClosed, setShowClosed] = useState(false);
  const custom = useCustomColumns<DealRow>("deal", rows, dealId);
  const [folded, setFolded] = useState<Set<DealStage>>(new Set());
  useEffect(() => {
    data.listDeals().then(setRows).catch((e: Error) => setError(e.message));
  }, []);
  usePageChrome({ context: rows ? `${rows.length} deals` : "Deals" });

  const summary = useMemo(() => (rows ? dealsSummary(rows, thisMonth()) : null), [rows]);

  if (error) return <EmptyState title={error} />;
  if (!rows || !summary) return <SkeletonRows rows={8} />;

  const fields: ViewField<DealRow>[] = [
    {
      key: "brand",
      label: "Brand",
      type: "select",
      options: [
        { value: "gllarix", label: "Gllarix" },
        { value: "arcadian", label: "Arcadian" },
      ],
      get: (r) => r.deal.brand,
    },
    { key: "stage", label: "Stage", type: "select", options: Object.entries(DEAL_STAGE_LABEL).map(([value, label]) => ({ value, label })), get: (r) => r.deal.stage },
    ...(user.role === "admin" || user.role === "viewer" ? [{ key: "owner", label: "Owner", type: "select" as const, get: (r: DealRow) => r.ownerName ?? "—" }] : []),
    { key: "market", label: "Market", type: "select", get: (r) => r.deal.market.toUpperCase() },
    { key: "pilot", label: "Pilot", type: "select", options: [{ value: "yes", label: "Pilot" }, { value: "no", label: "Not a pilot" }], get: (r) => (r.deal.pilot ? "yes" : "no") },
    { key: "setup", label: "Setup (EUR)", type: "number", get: (r) => toEurMinor(r.deal.setupMinor, r.deal.currency) / 100 },
    { key: "updated", label: "Updated", type: "date", get: (r) => r.deal.updatedAt.slice(0, 10) },
    ...custom.viewFields,
  ];
  // A stage filter shows those stages whatever their age; otherwise lost and older won deals hide unless asked for.
  const stageFiltered = view.filters.some((f) => f.key === "stage" && f.values?.length);
  const shown = applyView(rows, view, fields, (r) => `${r.company.name} ${r.contactName ?? ""}`).filter(
    (r) => stageFiltered || ((showClosed || r.deal.stage !== "lost") && (showClosed || r.deal.stage !== "won" || (r.deal.wonAt ?? "").slice(0, 7) === thisMonth())),
  );
  const groups = groupByStage(shown);
  const clear = () => {
    setView(EMPTY_VIEW);
    setShowClosed(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title m-0">Deals and quotes</h1>
          <p className="m-0 text-[14px] text-text-2">Every deal, what the client pays, where its quote is and what to do next. Open a deal to build or send its quote.</p>
        </div>
        {user.role !== "viewer" ? (
          <Link to="/deals/new" className="btn-primary">
            + New deal
          </Link>
        ) : null}
      </div>

      {user.role === "admin" ? <DiscountApprovals rows={rows} onChanged={() => data.listDeals().then(setRows)} /> : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Open pipeline · setup" value={formatByCurrency(summary.openSetup, true)} caption={`${summary.openCount} open deals · ${formatByCurrency(summary.openMonthly, true)}/mo recurring`} tone="cyan" />
        <KpiCard title="Won this month" value={String(summary.wonThisMonth)} caption={summary.wonThisMonth ? `${formatByCurrency(summary.wonMonthly, true)}/mo added` : "Nothing yet"} tone="mint" />
        <KpiCard title="Waiting on the client" value={String(summary.waitingOnClient)} caption="Quote sent, deposit not paid" tone="amber" />
        <KpiCard title="Average setup" value={formatByCurrency(summary.avgSetup, true)} caption="Across open deals" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ViewBar page="deals" fields={fields} rows={rows} value={view} onChange={setView} placeholder="Search company or contact" />
        <label className="ml-auto flex items-center gap-2 text-[13px] text-text-2">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Show lost and older won deals
        </label>
      </div>

      {groups.length ? (
        <DataTable<DealRow>
          id="deals"
          label="Deals"
          minWidth={1060}
          rowKey={(r) => r.deal.id}
          rowHref={(r) => `/deals/${r.deal.id}`}
          groups={groups.map((g) => ({
            key: g.stage,
            header: (
              <>
                <StageChip hue={DEAL_STAGE_HUE[g.stage]}>{DEAL_STAGE_LABEL[g.stage]}</StageChip>
                <span className="text-text-3">{g.rows.length}</span>
              </>
            ),
            rows: g.rows,
          }))}
          collapsed={folded as Set<string>}
          onToggleGroup={(k) => setFolded((f) => (f.has(k as DealStage) ? new Set([...f].filter((x) => x !== k)) : new Set([...f, k as DealStage])))}
          columns={[
            {
              key: "company",
              header: "Company",
              width: "minmax(0,1.6fr)",
              sortValue: (r) => r.company.name.toLowerCase(),
              render: (r) => (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Link to={`/deals/${r.deal.id}`} className="truncate font-medium hover:text-cyan">
                    {r.company.name}
                  </Link>
                  <span className="flex min-w-0 items-center gap-2 text-[12px] text-text-3">
                    <span className={r.deal.brand === "gllarix" ? "text-cyan" : "text-amber"}>{r.deal.brand === "gllarix" ? "Gllarix" : "Arcadian"}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{r.contactName ?? "No contact yet"}</span>
                  </span>
                </span>
              ),
            },
            {
              key: "pays",
              header: "Client pays",
              width: "minmax(0,1fr)",
              hideable: true,
              // Dollars and euros compared at the planning rate.
              sortValue: (r) => toEurMinor(r.deal.setupMinor, r.deal.currency),
              render: (r) => (
                <span className="flex min-w-0 flex-col">
                  <span className="num truncate">
                    {formatMoney(r.deal.setupMinor / 100, r.deal.market)} <span className="font-sans text-[12px] text-text-3">setup</span>
                  </span>
                  <span className="num truncate text-[12px] text-text-2">
                    {formatMoney(r.deal.monthlyMinor / 100, r.deal.market)}/mo{r.deal.pilot ? " · pilot" : ""}
                  </span>
                </span>
              ),
            },
            { key: "quote", header: "Quote", width: "170px", hideable: true, render: (r) => <QuoteDots p={quoteProgress(r)} /> },
            {
              key: "next",
              header: "Next step",
              width: "minmax(0,1.1fr)",
              hideable: true,
              render: (r) => {
                const ns = nextStep(r, quoteProgress(r), user.timezone);
                return <span className={`block truncate ${ns.tone}`}>{ns.text}</span>;
              },
            },
            {
              key: "owner",
              header: "Owner",
              width: "120px",
              hideable: true,
              sortValue: (r) => r.ownerName ?? "~",
              render: (r) => (
                <span className="flex min-w-0 items-center gap-2 text-text-2">
                  {r.ownerName ? <Avatar id={r.deal.ownerId} name={r.ownerName} size={22} /> : null}
                  <span className="truncate">{r.ownerName?.split(" ")[0] ?? "—"}</span>
                </span>
              ),
            },
            {
              key: "updated",
              header: "Updated",
              width: "72px",
              align: "right",
              hideable: true,
              sortValue: (r) => r.deal.updatedAt,
              render: (r) => <span className="num text-[12px] text-text-3">{since(r.deal.updatedAt)}</span>,
            },
            ...custom.columns,
          ]}
        />
      ) : (
        <EmptyState
          title={rows.length ? "No deals match these filters." : "No deals yet. They open when a meeting is booked, or from a lead's Create deal."}
          action={
            rows.length ? (
              <button type="button" className="btn-outline" onClick={clear}>
                Clear filters
              </button>
            ) : (
              <button type="button" className="btn-outline" onClick={() => navigate("/leads")}>
                Go to leads
              </button>
            )
          }
        />
      )}
    </div>
  );
};

/** /deals, /deals/new?lead=…, /deals/:id */
const DealsModule = () => (
  <Routes>
    <Route index element={<DealsList />} />
    <Route path="new" element={<NewDeal />} />
    <Route path=":id" element={<DealBuilder />} />
  </Routes>
);

export default DealsModule;
