import { useState } from "react";
import {
  ANNUAL_PAID,
  BRANDS,
  BUNDLE,
  BY_ID,
  COMM_MIN,
  COMM_MONTHS,
  COMM_PCT,
  CROSS,
  DISCOUNT_SELF_MAX,
  MARKETS,
  PILOT_MONTHLY,
  PILOT_SETUP,
  PILOTS_PER_BRAND,
  PRICE_BOOK_VERSION,
  RUSH,
} from "@/config/priceBook";
import { data, type ParityResult } from "@/data";

/** Admin › Price book (admin/06_PRICE_BOOK.md): the active version, market levels, discount rules and the parity check. */
const PriceBookSection = () => {
  const [parity, setParity] = useState<ParityResult[] | null>(null);
  const rules: [string, string][] = [
    ["Never Miss a Job bundle", `−${BUNDLE.pct}% Gllarix monthly with a receptionist + ${BUNDLE.need.map((id) => BY_ID[id]?.name ?? id).join(" + ")}`],
    ["Landing page with Gllarix", `−${CROSS.pct}% page setup with any receptionist`],
    ["Rush", `+${RUSH * 100}% setup`],
    ["Pilot", `setup ×${PILOT_SETUP}, monthly ×${PILOT_MONTHLY} for 12 months, first month free · max ${PILOTS_PER_BRAND} per brand`],
    ["Extra discount", `BDR none · admin/closer up to ${DISCOUNT_SELF_MAX}% · more needs both founders`],
    ["Annual prepay", `12 months for the price of ${ANNUAL_PAID}`],
    ["Commission", `${COMM_PCT * 100}% of setup (min ${COMM_MIN}) + ${COMM_PCT * 100}% of monthly for ${COMM_MONTHS} months, on cash collected · 30-day clawback`],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title m-0">Price book {PRICE_BOOK_VERSION}</h1>
        <button type="button" className="btn-outline h-10 text-[11px]" onClick={() => data.parityCheck().then(setParity)}>
          Parity check
        </button>
      </div>

      {parity ? (
        <section aria-label="Parity check" className="card flex flex-col p-5">
          <span className="label-caps pb-3">Parity · {parity.every((p) => p.pass) ? "all pass" : "FAILING"}</span>
          {parity.map((p) => (
            <div key={p.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-line-soft py-2 text-[13px] last:border-b-0">
              <span>{p.name}</span>
              <span className="num text-text-2">
                {p.actual.setup.toLocaleString("en-US")} + {p.actual.monthly}/mo
              </span>
              <span className={p.pass ? "text-mint" : "text-coral"}>{p.pass ? "Pass" : `Expected ${p.expected.setup} + ${p.expected.monthly}`}</span>
            </div>
          ))}
          <span className="pt-3 text-[11px] text-text-3">The test suite also runs pricing/price-calculator.html's own compute() against 300 random quotes.</span>
        </section>
      ) : null}

      <section aria-label="Market levels" className="card flex flex-col p-5">
        <span className="label-caps pb-3">Market levels</span>
        {Object.values(MARKETS).map((m) => (
          <div key={m.id} className="flex justify-between gap-4 border-b border-line-soft py-2 text-[13px] last:border-b-0">
            <span>{m.label}</span>
            <span className="num text-text-2">
              {Math.round(m.mult * 100)}% · {m.currency}
            </span>
          </div>
        ))}
        <span className="pt-3 text-[11px] text-text-3">Gulf market: open (Dubai deals use Western Europe until it's set).</span>
      </section>

      <section aria-label="Discount rules" className="card flex flex-col p-5">
        <span className="label-caps pb-3">Rules, in this order</span>
        {rules.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[200px_1fr] gap-4 border-b border-line-soft py-2 text-[13px] last:border-b-0">
            <span>{k}</span>
            <span className="text-text-2">{v}</span>
          </div>
        ))}
      </section>

      {BRANDS.map((b) => (
        <section key={b.id} aria-label={b.name} className="card min-w-0 overflow-x-auto">
          <div className="border-b border-line px-5 py-3">
            <span className="label-caps">{b.name}</span>
          </div>
          <div className="grid min-w-[760px] grid-cols-[80px_minmax(0,1.4fr)_minmax(0,1fr)_80px_80px_80px_60px_minmax(0,1fr)] gap-3 border-b border-line px-5 py-2.5 text-[12px] font-medium text-text-3 bg-surface-2">
            <span>Code</span>
            <span>Name</span>
            <span>Group</span>
            <span>Setup</span>
            <span>Monthly</span>
            <span>Minutes</span>
            <span>Max</span>
            <span>Rules</span>
          </div>
          {b.groups.flatMap((g) =>
            (g.items ?? []).map((it) => (
              <div key={it.id} className="grid min-w-[760px] grid-cols-[80px_minmax(0,1.4fr)_minmax(0,1fr)_80px_80px_80px_60px_minmax(0,1fr)] gap-3 border-b border-line-soft px-5 py-2 text-[13px] last:border-b-0">
                <span className="font-mono text-[12px] text-text-3">{it.id}</span>
                <span className="truncate">{it.name}</span>
                <span className="truncate text-text-2">{g.title}</span>
                <span className="num">{it.setup.toLocaleString("en-US")}</span>
                <span className="num">{it.monthly}</span>
                <span className="num text-text-2">{it.mins?.toLocaleString("en-US") ?? "—"}</span>
                <span className="num text-text-2">{it.max ?? "—"}</span>
                <span className="truncate text-[12px] text-text-3">
                  {[it.requires || g.requires ? `needs ${it.requires || g.requires}` : null, it.includedWith ? `included with ${it.includedWith.join(", ")}` : null, it.warn ? "check before selling" : null].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
            )),
          )}
        </section>
      ))}
      <span className="text-[12px] text-text-3">New versions (copy, edit, activate with a second admin's OK) arrive when the price book moves to the database.</span>
    </div>
  );
};

export default PriceBookSection;
