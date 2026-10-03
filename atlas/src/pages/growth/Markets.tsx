import { useCallback, useEffect, useState } from "react";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, ICONS, Pill, SkeletonRows } from "@/components/ui/primitives";
import { COUNTRY_RULES } from "@/config/countryRules";
import { COMPETITOR_CHECK_DAYS, OUR_PRICE } from "@/config/marketing";
import { data, type Competitor, type MarketRow } from "@/data";
import { tableDate } from "@/lib/format";

const DAY = 86_400_000;
const PRIORITY_HUE = { 1: "mint", 2: "cyan", 3: "blue", 4: "lavender", 5: "text-3" } as const;

/** Cold call / cold email per market, from the country rules Atlas enforces. */
const channelRule = (countries: string[]) => {
  const rules = countries.map((c) => COUNTRY_RULES[c]).filter(Boolean);
  if (!rules.length) return { call: "Check", email: "Check", notes: "No rule configured yet" };
  const call = rules.every((r) => r.call) ? "Yes" : rules.some((r) => r.call) ? "Some" : "No";
  const email = rules.every((r) => r.email === true) ? "Yes" : rules.every((r) => r.email === false) ? "No" : "Limited";
  return { call, email, notes: [...new Set(rules.map((r) => r.notes))].join(" · ") };
};
const ruleHue = (v: string) => (v === "Yes" ? "mint" : v === "No" ? "coral" : "amber");

/** Growth › Market and competitors: target markets with live numbers and channel rules, and the competitor price map. */
const Markets = () => {
  const toast = useToast();
  const [home, setHome] = useState<{ markets: MarketRow[]; competitors: Competitor[]; canEdit: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<Competitor["brand"]>("gllarix");
  const [edit, setEdit] = useState<Partial<Competitor> | null>(null);
  usePageChrome({ context: "Growth · market and competitors" });

  const load = useCallback(() => data.marketsHome().then(setHome, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!home) return <SkeletonRows rows={8} />;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const stale = (c: Competitor) => Date.now() - new Date(c.lastCheckedAt).getTime() > COMPETITOR_CHECK_DAYS * DAY;
  const comps = home.competitors.filter((c) => c.brand === brand);
  const due = home.competitors.filter(stale).length;
  const markets = [...home.markets].sort((a, b) => a.priority - b.priority);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Market and competitors</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">
          Where we sell, who sells there and which channels are allowed, with what Atlas sees in each market. Competitor prices are checked by hand every quarter until the price monitor exists.
        </p>
      </div>

      <section aria-label="Markets" className="card flex min-w-0 flex-col overflow-x-auto">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3.5">
          <span className="text-[15px] font-semibold">Markets</span>
          <span className="text-[12px] text-text-3">One national price in the US: states are for targeting, not pricing.</span>
        </div>
        <div className="grid min-w-[1020px] grid-cols-[40px_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_64px_minmax(0,0.9fr)_84px_112px_repeat(4,50px)] gap-3 border-b border-line-soft px-5 py-2 text-[12px] text-text-3">
          <span>Prio</span>
          <span>Market</span>
          <span>Brand</span>
          <span>Language</span>
          <span>vs CET</span>
          <span>Who sells</span>
          <span>Price level</span>
          <span>Cold call · email</span>
          <span className="text-right">Leads</span>
          <span className="text-right">Mtgs 30d</span>
          <span className="text-right">Open</span>
          <span className="text-right">Won</span>
        </div>
        {markets.map((m) => {
          const r = channelRule(m.countries);
          return (
            <div key={m.key} className="grid min-w-[1020px] grid-cols-[40px_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_64px_minmax(0,0.9fr)_84px_112px_repeat(4,50px)] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-[13px] last:border-b-0">
              <span>
                <Pill hue={PRIORITY_HUE[m.priority as keyof typeof PRIORITY_HUE] ?? "text-3"}>{m.priority}</Pill>
              </span>
              <span className="font-medium">{m.name}</span>
              <span className="text-text-2">{m.brand}</span>
              <span className="text-text-2">{m.language}</span>
              <span className="num text-text-2">{m.tz}</span>
              <span className="text-text-2">{m.whoSells}</span>
              <span className="text-text-2">{m.priceLevel}</span>
              <span className="flex flex-wrap gap-1" title={r.notes}>
                <Pill hue={ruleHue(r.call)}>{r.call}</Pill>
                <Pill hue={ruleHue(r.email)}>{r.email}</Pill>
              </span>
              <span className="num text-right">{m.leads}</span>
              <span className="num text-right">{m.meetings30d}</span>
              <span className="num text-right">{m.openDeals}</span>
              <span className={`num text-right ${m.won ? "text-mint" : ""}`}>{m.won}</span>
            </div>
          );
        })}
      </section>

      <section aria-label="Competitors" className="card flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Competitor map</span>
            <span className="text-[12px] text-text-3">{due ? `${due} price${due > 1 ? "s are" : " is"} older than a quarter: check ${due > 1 ? "them" : "it"}.` : "All prices checked this quarter."}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Brand" className="flex rounded-lg bg-inset p-0.5">
              {(["gllarix", "arcadian"] as const).map((b) => (
                <button key={b} type="button" role="radio" aria-checked={brand === b} onClick={() => setBrand(b)} className={`h-8 rounded-md px-3 text-[13px] ${brand === b ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`}>
                  {b === "gllarix" ? "Gllarix (AI receptionist)" : "Arcadian (3D property)"}
                </button>
              ))}
            </div>
            {home.canEdit ? (
              <button type="button" className="btn-primary" onClick={() => setEdit({ brand, name: "", type: "", priceSeen: "", howWeWin: "" })}>
                <Icon d={ICONS.plus} size={15} /> Competitor
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 border-b border-line-soft bg-surface-2/40 px-5 py-2.5 text-[13px]">
          <Pill hue={brand === "gllarix" ? "cyan" : "amber"}>Our price</Pill>
          <span className="num">{OUR_PRICE[brand]}</span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_150px] gap-3 border-b border-line-soft px-5 py-2 text-[12px] text-text-3">
            <span>Competitor</span>
            <span>Type</span>
            <span>Price seen</span>
            <span>How we win</span>
            <span>Last checked</span>
          </div>
          {comps.map((c) => (
            <div key={c.id} className="grid min-w-[980px] grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_150px] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-[13px] last:border-b-0">
              <span className="flex flex-col">
                <span className="font-medium">{c.name}</span>
                {c.source ? (
                  <a href={c.source} target="_blank" rel="noopener noreferrer" className="truncate text-[12px] text-cyan hover:underline">
                    Pricing page ↗
                  </a>
                ) : null}
              </span>
              <span className="text-text-2">{c.type}</span>
              <span className="num">{c.priceSeen}</span>
              <span className="text-text-2">{c.howWeWin}</span>
              <span className="flex flex-col items-start gap-1">
                <span className={`num text-[12px] ${stale(c) ? "text-amber" : "text-text-2"}`}>
                  {stale(c) ? "⚠ " : ""}
                  {tableDate(c.lastCheckedAt)}
                </span>
                {home.canEdit ? (
                  <span className="flex gap-2 text-[12px]">
                    <button type="button" className="text-cyan hover:underline" onClick={() => run(() => data.markCompetitorChecked(c.id), `${c.name} checked`)}>
                      Checked today
                    </button>
                    <button type="button" className="text-text-3 hover:text-text" onClick={() => setEdit(c)}>
                      Edit
                    </button>
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Account rules" className="card flex flex-wrap gap-x-8 gap-y-2 p-5 text-[13px]">
        <span className="w-full text-[15px] font-semibold">Account rules</span>
        <span className="text-text-2">No client above 25% of MRR.</span>
        <span className="text-text-2">At most 2 pilots per brand.</span>
        <span className="text-text-2">Every pilot gives a case study.</span>
        <span className="text-text-2">Health under 60 → a call within 48 h (Clients).</span>
      </section>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : "New competitor"} width={620}>
        {edit ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(() => data.saveCompetitor({ ...edit, name: edit.name ?? "", brand: edit.brand ?? brand }), "Competitor saved");
              setEdit(null);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="field-label">Name</span>
                <input className="input" required value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Type</span>
                <input className="input" value={edit.type ?? ""} onChange={(e) => setEdit({ ...edit, type: e.target.value })} />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="field-label">Price seen</span>
              <input className="input" value={edit.priceSeen ?? ""} onChange={(e) => setEdit({ ...edit, priceSeen: e.target.value })} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="field-label">How we win</span>
              <input className="input" value={edit.howWeWin ?? ""} onChange={(e) => setEdit({ ...edit, howWeWin: e.target.value })} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="field-label">Pricing page (link)</span>
              <input className="input" type="url" value={edit.source ?? ""} onChange={(e) => setEdit({ ...edit, source: e.target.value || null })} />
            </label>
            <span className="text-[12px] text-text-3">Saving counts as a price check today.</span>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default Markets;
