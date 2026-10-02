import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { usePageChrome } from "@/components/shell/PageChrome";
import { BrandChip, EmptyState, SkeletonRows, StageChip } from "@/components/ui/primitives";
import { data, DEAL_STAGE_LABEL, type DealRow } from "@/data";
import { since } from "@/lib/format";
import DealBuilder, { NewDeal } from "./DealBuilder";

const money = (minor: number, currency: "USD" | "EUR") => `${currency === "USD" ? "$" : "€"}${Math.round(minor / 100).toLocaleString("en-US")}`;

/** /deals: a simple table (09_DEAL_AND_QUOTE.md). */
const DealsList = () => {
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    data.listDeals().then(setRows).catch((e: Error) => setError(e.message));
  }, []);
  usePageChrome({ context: rows ? `${rows.length} deals` : "Deals" });
  if (error) return <EmptyState title={error} />;
  if (!rows) return <SkeletonRows rows={8} />;
  const cols = "grid-cols-[96px_minmax(0,1.6fr)_120px_minmax(0,1fr)_minmax(0,0.8fr)_60px]";
  return (
    <div className="flex flex-col gap-5">
      <h1 className="page-title m-0">Deals and quotes</h1>
      {rows.length ? (
        <section aria-label="Deals" className="card min-w-0 overflow-x-auto">
          <div className={`grid ${cols} min-w-[820px] gap-3 border-b border-line px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2`}>
            <span>Brand</span>
            <span>Company</span>
            <span>Stage</span>
            <span>Value</span>
            <span>Owner</span>
            <span>Updated</span>
          </div>
          {rows.map((r) => (
            <Link key={r.deal.id} to={`/deals/${r.deal.id}`} className={`grid ${cols} min-w-[820px] items-center gap-3 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0 hover:bg-surface-2`}>
              <span>
                <BrandChip brand={r.deal.brand} />
              </span>
              <span className="truncate text-[14px]">{r.company.name}</span>
              <span>
                <StageChip>{DEAL_STAGE_LABEL[r.deal.stage]}</StageChip>
              </span>
              <span className="num truncate text-text-2">
                {money(r.deal.setupMinor, r.deal.currency)} + {money(r.deal.monthlyMinor, r.deal.currency)}/mo{r.deal.pilot ? " · pilot" : ""}
              </span>
              <span className="truncate text-text-2">{r.ownerName ?? "—"}</span>
              <span className="num text-text-3">{since(r.deal.updatedAt)}</span>
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState title="No deals yet. They open when a meeting is booked, or from a lead's Create deal." />
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
