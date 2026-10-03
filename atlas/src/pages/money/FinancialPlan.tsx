import { useEffect, useMemo, useState } from "react";
import { usePageChrome } from "@/components/shell/PageChrome";
import { BarChart, Legend, LineChart } from "@/components/charts";
import { EmptyState, KpiCard, Pill, SkeletonRows, Toggle } from "@/components/ui/primitives";
import { CASH_RESERVE_EUR, GATES, MRR_TARGET } from "@/config/targets";
import { data, type CashSnapshot, type MrrPoint } from "@/data";
import { eurWhole } from "@/services/money";
import { BRAND_SCENARIOS, runScenario, SCENARIO_MONTHS, type Hire } from "@/services/scenarios";

type Scenario = "worst" | "realistic" | "best";
const SCENARIO_LABEL: Record<Scenario, string> = { worst: "Worst", realistic: "Realistic", best: "Best" };
const PACE = [0.5, 1, 1.5, 2] as const;
const kEur = (v: number) => (Math.abs(v) >= 1000 ? `${v < 0 ? "−" : ""}€${(Math.abs(v) / 1000).toFixed(Math.abs(v) % 1000 ? 1 : 0)}K` : eurWhole(v));
/** Scenario month index → "2026-10" (month 0 = Oct 2026). */
const monthKeyAt = (i: number) => new Date(Date.UTC(2026, 9 + i, 1)).toISOString().slice(0, 7);

/**
 * Money › Financial plan: the 12-month scenario model (spec/models, ported in services/scenarios.ts) with what-if
 * controls, actual MRR and cash on top, the €3,000 reserve and the stage gates. Admins only.
 */
const FinancialPlan = () => {
  const [mrrActual, setMrrActual] = useState<MrrPoint[] | null>(null);
  const [cash, setCash] = useState<CashSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>("realistic");
  const [useCash, setUseCash] = useState(true);
  const [churn, setChurn] = useState<number | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [pace, setPace] = useState<(typeof PACE)[number]>(1);
  const [setter, setSetter] = useState<{ on: boolean; from: number; usd: number }>({ on: false, from: 3, usd: 350 });
  usePageChrome({ context: "Money · financial plan" });

  useEffect(() => {
    Promise.all([data.report({ kind: "month", personId: "team" }), data.listFinanceData()])
      .then(([r, f]) => {
        setMrrActual(r.mrr);
        setCash([...f.cash].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const base = BRAND_SCENARIOS[scenario];
  const run = useMemo(() => {
    const hires: Hire[] = setter.on ? [{ label: "Setter #1", fromMonth: setter.from, monthlyUsd: setter.usd }] : [];
    return runScenario({
      scenario,
      overrides: {
        ...(churn !== null ? { churn: churn / 100 } : {}),
        ...(fee !== null ? { mrr: fee } : {}),
        ...(pace !== 1 ? { new: base.new.map((n) => Math.round(n * pace)) } : {}),
      },
      hires,
      openingCashEur: useCash && cash ? cash.balanceMinor / 100 : 0,
    });
  }, [scenario, churn, fee, pace, setter, useCash, cash, base]);

  if (error) return <EmptyState title={error} />;
  if (!mrrActual) return <SkeletonRows rows={8} />;

  const edited = churn !== null || fee !== null || pace !== 1 || setter.on;
  const reset = () => {
    setChurn(null);
    setFee(null);
    setPace(1);
    setSetter({ ...setter, on: false });
  };
  const targetMonth = run.months[MRR_TARGET.monthIndex];
  const actual = SCENARIO_MONTHS.map((_, i) => mrrActual.find((p) => p.month === monthKeyAt(i))?.actualEur ?? null);
  const lastActualI = actual.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1);
  const gap = lastActualI >= 0 ? actual[lastActualI]! - run.months[lastActualI].mrr : null;
  const gateMonths = run.months.map((m, i) => ({ m, i })).filter(({ m, i }) => i > 0 && m.stage !== run.months[i - 1].stage);
  const belowReserve = run.months.filter((m) => m.cash < CASH_RESERVE_EUR);
  const seg = (on: boolean) => `h-8 rounded-md px-3 text-[13px] ${on ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Financial plan</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">
          Twelve months from October 2026, from the scenario model, with actual MRR on top. Change the assumptions below to see what happens to revenue, cash and the hiring gates. Plan numbers are assumptions, not results. Founder pay, tax and VAT are not included.
        </p>
      </div>

      <section aria-label="Assumptions" className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] font-semibold">Assumptions</span>
          {edited ? (
            <button type="button" className="btn-ghost" onClick={reset}>
              Back to the {SCENARIO_LABEL[scenario].toLowerCase()} scenario
            </button>
          ) : null}
        </div>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <span className="field-label">Scenario</span>
            <div role="radiogroup" aria-label="Scenario" className="flex self-start rounded-lg bg-inset p-0.5">
              {(Object.keys(SCENARIO_LABEL) as Scenario[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={scenario === s} className={seg(scenario === s)} onClick={() => (setScenario(s), reset())}>
                  {SCENARIO_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="field-label">New Gllarix clients per month</span>
            <div role="radiogroup" aria-label="Sales pace" className="flex self-start rounded-lg bg-inset p-0.5">
              {PACE.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={pace === p} className={seg(pace === p)} onClick={() => setPace(p)}>
                  ×{p}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-text-3">{base.new.map((n) => Math.round(n * pace)).reduce((a, b) => a + b, 0)} new clients over the year</span>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Gllarix monthly fee (USD)</span>
            <input type="number" min={100} step={50} className="input w-36" value={fee ?? base.mrr} onChange={(e) => setFee(Math.max(0, Number(e.target.value) || 0))} />
            <span className="text-[12px] text-text-3">Average per client after the pilots</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Monthly churn (%)</span>
            <input type="number" min={0} max={30} step={0.5} className="input w-36" value={churn ?? base.churn * 100} onChange={(e) => setChurn(Math.min(30, Math.max(0, Number(e.target.value) || 0)))} />
            <span className="text-[12px] text-text-3">Share of Gllarix clients lost each month</span>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="field-label">Start from cash on hand</span>
            <Toggle ariaLabel="Start from cash on hand" checked={useCash && !!cash} onChange={setUseCash} label={cash ? `${eurWhole(cash.balanceMinor / 100)} on ${cash.date}` : "No cash snapshot yet (Money › Finance)"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="field-label">Hire setter #1</span>
            <div className="flex flex-wrap items-center gap-2">
              <Toggle ariaLabel="Hire setter #1" checked={setter.on} onChange={(on) => setSetter({ ...setter, on })} label={setter.on ? "From" : "Off"} />
              {setter.on ? (
                <>
                  <select aria-label="Setter starts in" className="input h-8 w-auto" value={setter.from} onChange={(e) => setSetter({ ...setter, from: Number(e.target.value) })}>
                    {SCENARIO_MONTHS.map((m, i) => (
                      <option key={m} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="text-[13px] text-text-2">at $</span>
                  <input aria-label="Setter cost per month (USD)" type="number" min={0} step={25} className="input h-8 w-24" value={setter.usd} onChange={(e) => setSetter({ ...setter, usd: Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="text-[13px] text-text-2">/mo</span>
                </>
              ) : null}
            </div>
            <span className="text-[12px] text-text-3">Gate 1 says: hire after 3 paying clients and 2 months' pay in reserve</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <KpiCard title="Revenue · 12 months" value={kEur(run.totals.revenue)} caption={`Costs ${kEur(run.totals.costs)} · net ${kEur(run.totals.net)}`} tone="cyan" />
        <KpiCard title="MRR in Jun 27" value={kEur(targetMonth.mrr)} caption={targetMonth.mrr >= MRR_TARGET.eur ? "Reaches the €10k target" : `${kEur(MRR_TARGET.eur - targetMonth.mrr)} short of €10k`} tone={targetMonth.mrr >= MRR_TARGET.eur ? "mint" : "amber"} />
        <KpiCard title="MRR in Sep 27" value={kEur(run.mrrEnd)} caption="End of the plan year" />
        <KpiCard title="Lowest cash" value={kEur(run.lowPoint.cash)} caption={`${run.lowPoint.month} · reserve ${kEur(CASH_RESERVE_EUR)}`} tone={run.lowPoint.cash < 0 ? "coral" : run.lowPoint.cash < CASH_RESERVE_EUR ? "amber" : "mint"} />
        <KpiCard title="Actual vs plan" value={gap === null ? "—" : `${gap >= 0 ? "+" : "−"}${kEur(Math.abs(gap))}`} caption={lastActualI >= 0 ? `MRR in ${SCENARIO_MONTHS[lastActualI]}` : "No months closed yet"} tone={gap === null ? "text" : gap >= 0 ? "mint" : "amber"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="MRR" className="card flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Monthly recurring revenue</span>
            <Legend items={[{ name: `${SCENARIO_LABEL[scenario]} plan`, color: "var(--chart-1)" }, { name: "Actual", color: "var(--chart-2)" }]} />
          </div>
          <LineChart
            ariaLabel="MRR per month: plan and actual"
            labels={SCENARIO_MONTHS}
            tickLabel={(l) => l.split(" ")[0]}
            series={[
              { name: `${SCENARIO_LABEL[scenario]} plan`, color: "var(--chart-1)", values: run.months.map((m) => m.mrr) },
              { name: "Actual", color: "var(--chart-2)", values: actual },
            ]}
            format={kEur}
            reference={{ value: MRR_TARGET.eur, label: "€10k goal" }}
          />
        </section>

        <section aria-label="Revenue by brand" className="card flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Revenue by brand</span>
            <Legend items={[{ name: "Gllarix", color: "var(--chart-1)" }, { name: "Arcadian", color: "var(--chart-2)" }]} />
          </div>
          <BarChart
            ariaLabel="Revenue per month by brand"
            data={run.months.map((m) => ({
              key: m.month,
              label: m.month.split(" ")[0],
              segments: [
                { name: "Gllarix", value: m.gllarixRevenue, color: "var(--chart-1)" },
                { name: "Arcadian", value: m.arcadianRevenue, color: "var(--chart-2)" },
              ],
            }))}
            format={kEur}
            tooltip={(d) => (
              <>
                <div className="pb-1 font-medium text-text">{d.key}</div>
                {d.segments.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-4 text-text-2">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                      {s.name}
                    </span>
                    <span className="num text-text">{eurWhole(s.value)}</span>
                  </div>
                ))}
              </>
            )}
          />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Cash" className="card flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold">Cash at the end of each month</span>
            <span className="text-[12px] text-text-3">{useCash && cash ? `Starts from ${eurWhole(cash.balanceMinor / 100)}` : "Starts from €0"}</span>
          </div>
          <BarChart
            ariaLabel="Cash at the end of each month, with the reserve line"
            data={run.months.map((m) => ({ key: m.month, label: m.month.split(" ")[0], segments: [{ name: "Cash", value: m.cash, color: "var(--chart-1)" }] }))}
            format={kEur}
            reference={{ value: CASH_RESERVE_EUR, label: "Reserve €3K" }}
            tooltip={(d) => {
              const m = run.months.find((x) => x.month === d.key)!;
              return (
                <>
                  <div className="pb-1 font-medium text-text">{m.month}</div>
                  <div className="flex justify-between gap-4 text-text-2">
                    <span>Cash</span>
                    <span className="num text-text">{eurWhole(m.cash)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-text-2">
                    <span>Net this month</span>
                    <span className="num text-text">{eurWhole(m.net)}</span>
                  </div>
                  {m.cash < CASH_RESERVE_EUR ? <div className="pt-1 text-amber">⚠ Below the reserve</div> : null}
                </>
              );
            }}
          />
          <span className="text-[12px] text-text-3">
            {belowReserve.length ? `⚠ Below the €3,000 reserve in ${belowReserve.length} month${belowReserve.length > 1 ? "s" : ""}: ${belowReserve.map((m) => m.month).join(", ")}.` : "Cash stays above the €3,000 reserve all year."}
          </span>
        </section>

        <section aria-label="Stage gates" className="card flex flex-col gap-3 p-5">
          <span className="text-[15px] font-semibold">When the gates open</span>
          <span className="text-[12px] text-text-3">Each gate unlocks the next spend on people. The model moves stage when the rule is met.</span>
          {GATES.map((g, gi) => {
            const hit = gateMonths.find(({ m }) => m.stage === gi + 2);
            return (
              <div key={g.key} className="flex flex-col gap-1 border-t border-line-soft pt-3 text-[13px]">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium">{g.label}</span>
                  {hit ? (
                    <Pill hue="mint" dot>
                      {run.months[hit.i - 1].month}
                    </Pill>
                  ) : (
                    <Pill hue="text-3">Not this year</Pill>
                  )}
                </span>
                <span className="text-[12px] text-text-3">{g.note}</span>
              </div>
            );
          })}
        </section>
      </div>

      <section aria-label="Month by month" className="card flex min-w-0 flex-col overflow-x-auto">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3.5">
          <span className="text-[15px] font-semibold">Month by month</span>
          <span className="text-[12px] text-text-3">EUR · {run.method}</span>
        </div>
        <div className="grid min-w-[900px] grid-cols-[80px_60px_repeat(7,minmax(0,1fr))] gap-3 border-b border-line-soft px-5 py-2 text-right text-[12px] text-text-3">
          <span className="text-left">Month</span>
          <span className="text-left">Stage</span>
          <span>Gllarix</span>
          <span>Arcadian</span>
          <span>Revenue</span>
          <span>MRR</span>
          <span>Actual MRR</span>
          <span>Costs</span>
          <span>Cash</span>
        </div>
        {run.months.map((m, i) => (
          <div key={m.month} className="grid min-w-[900px] grid-cols-[80px_60px_repeat(7,minmax(0,1fr))] items-center gap-3 border-b border-line-soft px-5 py-2 text-right text-[13px] last:border-b-0">
            <span className="text-left font-medium">{m.month}</span>
            <span className="text-left text-text-2">{m.stage}</span>
            <span className="num text-text-2">{eurWhole(m.gllarixRevenue)}</span>
            <span className="num text-text-2">{eurWhole(m.arcadianRevenue)}</span>
            <span className="num">{eurWhole(m.revenue)}</span>
            <span className="num">{eurWhole(m.mrr)}</span>
            <span className="num text-text-2">{actual[i] === null ? "—" : eurWhole(actual[i]!)}</span>
            <span className="num text-text-2">{eurWhole(m.costs)}</span>
            <span className={`num ${m.cash < 0 ? "text-coral" : m.cash < CASH_RESERVE_EUR ? "text-amber" : ""}`}>
              {m.cash < CASH_RESERVE_EUR ? "⚠ " : ""}
              {eurWhole(m.cash)}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
};

export default FinancialPlan;
