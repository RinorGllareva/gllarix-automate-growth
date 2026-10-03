import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import LeadPicker from "@/components/LeadPicker";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { Toggle } from "@/components/ui/primitives";
import { MARKETS, type MarketId } from "@/config/priceBook";
import PriceBookSection from "@/pages/admin/PriceBookSection";
import { PackageEditor } from "@/pages/deals/DealBuilder";
import { compute, emptySelection, formatMoney, quoteSummary, type QuoteSelection } from "@/services/pricing";

const MARKET_ORDER: MarketId[] = ["us", "we", "ch", "xk"];

/**
 * "How much would it cost?" in ten seconds, with the same pricing code as every quote, so the number said on a call
 * is the number on the quote. Sellers see what the client pays; founders also see the margin.
 */
const Calculator = () => {
  const me = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [sel, setSel] = useState<QuoteSelection>(() => ({ ...emptySelection("us"), tiers: { rec: "rec_m" } }));
  const [picking, setPicking] = useState(false);
  const r = compute(sel);
  const fmt = (n: number) => formatMoney(n, sel.market);
  const seg = (on: boolean) => `h-8 flex-1 rounded-md px-3 text-[13px] ${on ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`;
  return (
    <section aria-label="Price calculator" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="card flex min-w-0 flex-col gap-4 p-5">
        <span className="text-[15px] font-semibold">Calculator</span>
        <div role="radiogroup" aria-label="Market" className="flex flex-wrap rounded-lg bg-inset p-0.5">
          {MARKET_ORDER.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={sel.market === m} onClick={() => setSel({ ...sel, market: m })} className={seg(sel.market === m)}>
              {MARKETS[m].label}
            </button>
          ))}
        </div>
        <PackageEditor sel={sel} onChange={setSel} />
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-[13px]">
          <Toggle ariaLabel="Pilot" checked={sel.pilot} onChange={(v) => setSel({ ...sel, pilot: v })} label="Pilot (setup 40%, monthly −25%, first month free)" />
          <Toggle ariaLabel="Rush delivery" checked={sel.rush} onChange={(v) => setSel({ ...sel, rush: v })} label="Rush (+25% setup)" />
          <Toggle ariaLabel="Annual prepay" checked={sel.billing === "annual"} onChange={(v) => setSel({ ...sel, billing: v ? "annual" : "monthly" })} label="Annual prepay (2 months free)" />
        </div>
      </div>
      <aside className="card flex flex-col gap-4 self-start p-5 xl:sticky xl:top-6" aria-label="What the client pays">
        <span className="text-[15px] font-semibold">What the client pays</span>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-text-3">Setup, once</span>
            <span className="num text-[26px] font-semibold leading-none">{fmt(r.setup)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-text-3">Every month</span>
            <span className="num text-[26px] font-semibold leading-none text-cyan">{fmt(r.monthly)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3 text-[13px]">
          <span className="flex justify-between">
            <span className="text-text-2">First-year value</span>
            <span className="num">{fmt(r.firstYear)}</span>
          </span>
          <span className="flex justify-between">
            <span className="text-text-2">Deposit to start (50% of setup)</span>
            <span className="num">{fmt(r.setup / 2)}</span>
          </span>
          {r.mins ? (
            <span className="flex justify-between">
              <span className="text-text-2">Minutes included</span>
              <span className="num">{r.mins.toLocaleString("en-US")}/mo</span>
            </span>
          ) : null}
          {me.role === "admin" ? (
            <span className="flex justify-between">
              <span className="text-text-2">Gross margin on the monthly</span>
              <span className={`num ${r.margin >= 0.6 ? "text-mint" : r.margin >= 0.3 ? "text-amber" : "text-coral"}`}>{Math.round(r.margin * 100)}%</span>
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-outline"
            disabled={!r.lines.length}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(quoteSummary(r, sel, "the client"));
                toast("Copied: paste it into an email or a chat", "good");
              } catch {
                toast("Couldn't copy here: select the numbers instead.", "error");
              }
            }}
          >
            Copy as text
          </button>
          {me.role !== "viewer" ? (
            <button type="button" className="btn-primary" disabled={!r.lines.length} onClick={() => setPicking(true)}>
              Turn into a quote for a lead…
            </button>
          ) : null}
        </div>
        <span className="text-[12px] text-text-3">Same prices and rules as every quote. Discounts are set on the deal (over your cap they need the other founder).</span>
      </aside>
      <LeadPicker open={picking} title="Quote for which lead?" onClose={() => setPicking(false)} onPick={(id) => navigate(`/deals/new?lead=${id}`)} />
    </section>
  );
};

/** Money › Prices and calculator: the calculator first, then the price book every quote is built from. */
const Prices = () => {
  const me = useUser();
  usePageChrome({ context: "Money · prices", action: { label: "Open deals", to: "/deals" } });
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Prices and calculator</h1>
        <p className="m-0 text-[14px] text-text-2">Answer "how much?" on a call, then turn it into a quote in one click.</p>
      </div>
      <Calculator />
      {me.role === "admin" ? <PriceBookSection /> : null}
    </div>
  );
};

export default Prices;
