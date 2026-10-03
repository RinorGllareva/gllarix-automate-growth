import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/overlay";
import { Icon, Pill } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { BUILT_IN_ATLAS, buildVsBuy, HOUR_VALUE_EUR, verdictFor, WEEKEND_HOURS, type Verdict } from "@/config/buildVsBuy";
import { USD_PER_EUR } from "@/config/targets";
import { data, type Expense } from "@/data";
import { eurWhole } from "@/services/money";
import { shiftDateKey } from "@/services/time";

const VERDICT: Record<Verdict, { label: string; hue: Hue }> = {
  keep: { label: "Keep", hue: "mint" },
  replace: { label: "Replace with Atlas", hue: "coral" },
  review: { label: "Review", hue: "amber" },
};
const RESULT = {
  build: { label: "Build it", hue: "mint" as Hue },
  buy: { label: "Buy it", hue: "cyan" as Hue },
  later: { label: "Build later", hue: "amber" as Hue },
};
const eurMonthly = (e: Expense) => (e.currency === "USD" ? e.amountMinor / USD_PER_EUR : e.amountMinor) / 100;

/** ROI › Build or buy: what Atlas already replaces, every subscription judged, and the build-vs-buy maths in Rinor's hours. */
const BuildVsBuy = ({ expenses, onLogged }: { expenses: Expense[]; onLogged: () => void }) => {
  const toast = useToast();
  const [name, setName] = useState("Call recorder");
  const [price, setPrice] = useState(13);
  const [seats, setSeats] = useState(1);
  const [hours, setHours] = useState(6);
  const [maint, setMaint] = useState(0.25);
  const [rate, setRate] = useState(HOUR_VALUE_EUR);
  const [core, setCore] = useState(false);
  const r = useMemo(() => buildVsBuy({ priceEur: price, seats, buildHours: hours, maintainHoursPerMonth: maint, hourValueEur: rate, core }), [price, seats, hours, maint, rate, core]);

  const subs = expenses
    .filter((e) => e.recurring)
    .map((e) => ({ e, eur: eurMonthly(e), ...verdictFor(e.vendor) }))
    .sort((a, b) => (a.verdict === b.verdict ? b.eur - a.eur : a.verdict === "replace" ? -1 : b.verdict === "replace" ? 1 : a.verdict === "review" ? -1 : 1));
  const replaceable = subs.filter((s) => s.verdict === "replace");
  const savingYear = replaceable.reduce((n, s) => n + s.eur * 12, 0);

  const num = (v: number, set: (n: number) => void, label: string, step = 1, suffix?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      <span className="flex items-center gap-2">
        <input type="number" min={0} step={step} className="input w-24" value={v} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} />
        {suffix ? <span className="text-[13px] text-text-3">{suffix}</span> : null}
      </span>
    </label>
  );

  return (
    <section aria-label="Build or buy" className="card flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">Build or buy</span>
        <span className="text-[13px] text-text-3">
          Don't pay for a subscription Atlas can do, and don't spend Rinor's weekends rebuilding commodity tools. The rule: build what makes us win, buy the plumbing.
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="flex items-baseline justify-between">
            <span className="text-[14px] font-medium">Your subscriptions</span>
            <span className="text-[12px] text-text-3">{replaceable.length ? `${eurWhole(savingYear)} a year can go` : "Nothing to cancel"}</span>
          </span>
          <div className="flex flex-col">
            {subs.map((s) => (
              <div key={s.e.id} className="grid grid-cols-[minmax(0,1fr)_80px_150px] items-start gap-3 border-b border-line-soft py-2 text-[13px] last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{s.e.vendor}</span>
                  <span className="text-[12px] text-text-3">
                    {s.reason}
                    {s.to ? (
                      <>
                        {" "}
                        <Link to={s.to} className="text-cyan hover:underline">
                          Open ↗
                        </Link>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="num text-right">{eurWhole(s.eur)}/mo</span>
                <span className="flex justify-end">
                  <Pill hue={VERDICT[s.verdict].hue} dot>
                    {VERDICT[s.verdict].label}
                  </Pill>
                </span>
              </div>
            ))}
            {!subs.length ? <span className="text-[13px] text-text-3">No monthly expenses logged. Add them in Money › Finance.</span> : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="flex items-baseline justify-between">
            <span className="text-[14px] font-medium">Already built into Atlas</span>
            <span className="text-[12px] text-text-3">{BUILT_IN_ATLAS.length} tools you don't need to buy</span>
          </span>
          <div className="flex max-h-[340px] flex-col overflow-y-auto">
            {BUILT_IN_ATLAS.map((b) => (
              <Link key={b.capability} to={b.to} className="flex flex-col border-b border-line-soft py-2 text-[13px] last:border-b-0 hover:bg-surface-2/40">
                <span className="flex items-center gap-2">
                  <span style={{ color: "var(--mint)" }}>
                    <Icon d="M5 12l5 5L20 7" size={14} />
                  </span>
                  <span className="font-medium">{b.capability}</span>
                </span>
                <span className="pl-[22px] text-[12px] text-text-3">Instead of {b.instead}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line-soft pt-4">
        <span className="text-[14px] font-medium">Should we build this ourselves?</span>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Tool or feature</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-4">
              {num(price, setPrice, "Price per seat", 1, "€/mo")}
              {num(seats, setSeats, "Seats")}
              {num(hours, setHours, "Hours to build", 1, "h")}
              {num(maint, setMaint, "Upkeep", 0.25, "h/mo")}
              {num(rate, setRate, "Value of an hour", 5, "€")}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="field-label">Is it how we win?</span>
              <div role="radiogroup" aria-label="Core or commodity" className="flex self-start rounded-lg bg-inset p-0.5">
                {(
                  [
                    [true, "Core: part of how we win"],
                    [false, "Commodity: everyone has it"],
                  ] as const
                ).map(([v, l]) => (
                  <button key={l} type="button" role="radio" aria-checked={core === v} onClick={() => setCore(v)} className={`h-8 rounded-md px-3 text-[13px] ${core === v ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-text-3">Hours include review time when Codex writes the code. An hour is worth €{HOUR_VALUE_EUR} (€700 a day).</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className={`flex flex-col gap-1 rounded-lg px-4 py-3 ${r.verdict === "build" ? "bg-mint-tint" : r.verdict === "later" ? "bg-amber-tint" : "bg-cyan-tint"}`}>
              <span className="flex items-center gap-2 text-[15px] font-semibold">
                <Pill hue={RESULT[r.verdict].hue}>{RESULT[r.verdict].label}</Pill>
                {name}
              </span>
              <span className="text-[13px] text-text-2">
                {r.breakEvenMonths === null
                  ? "Upkeep costs as much as the subscription: building never pays back."
                  : `Pays back in ${r.breakEvenMonths.toFixed(1)} months (${core ? "core: build if under 12" : "commodity: build only if under 6"}).`}
              </span>
            </div>
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="text-text-2">Subscription, 12 months</dt>
              <dd className="num m-0">{eurWhole(r.buy12)}</dd>
              <dt className="text-text-2">Build + upkeep, 12 months</dt>
              <dd className="num m-0">{eurWhole(r.build12)}</dd>
              <dt className="text-text-2">Rinor's delivery weekends it uses</dt>
              <dd className={`num m-0 ${r.weekends > 1 ? "text-amber" : ""}`}>{r.weekends.toFixed(1)} (at ~{WEEKEND_HOURS} h each)</dd>
            </dl>
            <span className="text-[12px] text-text-3">Weekends are the scarcest thing we have: a weekend on a build is a weekend without a client setup.</span>
            <button
              type="button"
              className="btn-outline self-start"
              onClick={async () => {
                try {
                  await data.logSpendDecision({
                    title: `${r.verdict === "build" ? "Build" : r.verdict === "later" ? "Build later" : "Buy"}: ${name}`,
                    monthlyCostEur: r.verdict === "buy" ? r.buyMonthly : r.maintainMonthly,
                    oneOffCostEur: r.verdict === "buy" ? 0 : r.buildOnce,
                    expectedGain: r.verdict === "buy" ? `Keeps ${r.weekends.toFixed(1)} weekends for client work` : `Saves ${eurWhole(Math.max(0, r.buy12 - r.build12))} in the first year`,
                    stopRule: r.verdict === "buy" ? "Review when the price rises or Atlas covers it" : `Stop if the build passes ${Math.ceil(hours * 1.5)} hours`,
                    reviewDate: shiftDateKey(new Date().toISOString().slice(0, 10), 90),
                    verdict: r.breakEvenMonths === null ? "Building never pays back." : `Pays back in ${r.breakEvenMonths.toFixed(1)} months.`,
                  });
                  toast("Logged as a proposed decision", "good");
                  onLogged();
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }}
            >
              Log the decision
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BuildVsBuy;
