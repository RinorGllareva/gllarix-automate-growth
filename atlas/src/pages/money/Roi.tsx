import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Legend, LineChart } from "@/components/charts";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, Pill, SkeletonRows } from "@/components/ui/primitives";
import { USD_PER_EUR } from "@/config/targets";
import { data, type ClientsOverview, type DealRow, type Decision, type Expense, type WeeklyReport } from "@/data";
import { tableDate } from "@/lib/format";
import { eurWhole } from "@/services/money";
import { investmentOrder, PLAN_UNIT, roiCheck, SPEND_TYPES, SPLITS, unitEconomics, type GainKind, type SpendType } from "@/services/roi";
import { shiftDateKey } from "@/services/time";
import BuildVsBuy from "./BuildVsBuy";

const DAY = 86_400_000;
const inEur = (x: Pick<Expense, "amountMinor" | "currency">) => (x.currency === "USD" ? x.amountMinor / USD_PER_EUR : x.amountMinor) / 100;
const pct = (v: number) => `${Math.round(v * 100)}%`;

const Card = ({ title, help, children, action }: { title: string; help?: string; children: ReactNode; action?: ReactNode }) => (
  <section aria-label={title} className="card flex min-w-0 flex-col gap-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        {help ? <span className="text-[13px] text-text-3">{help}</span> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/** Quick-fill examples straight from spec/backbone/09. */
const EXAMPLES: { label: string; type: SpendType; monthly: number; once: number; kind: GainKind; per: number; stop: string }[] = [
  { label: "Dialer", type: "tool", monthly: Math.round(30 / USD_PER_EUR), once: 0, kind: "meetings", per: 1, stop: "Cancel if it adds less than 1 approved meeting a month for 2 months" },
  { label: "List builder", type: "hire", monthly: Math.round(175 / USD_PER_EUR), once: 0, kind: "meetings", per: 8, stop: "Stop if approved meetings don't rise by 4+ a month within 6 weeks" },
  { label: "Marketing test", type: "marketing", monthly: 0, once: 200, kind: "meetings", per: 2, stop: "Stop after 6 weeks if fewer than 2 qualified leads" },
];

/** Money › ROI and investment: unit economics, the investment order with live triggers, the ROI test and the spend log. Admins only. */
const Roi = () => {
  const toast = useToast();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [fin, setFin] = useState<{ expenses: Expense[]; cash: { balanceMinor: number; date: string }[] } | null>(null);
  const [overview, setOverview] = useState<ClientsOverview | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [spends, setSpends] = useState<Decision[]>([]);
  const [error, setError] = useState<string | null>(null);
  usePageChrome({ context: "Money · ROI and investment" });

  // ROI check inputs.
  const [type, setType] = useState<SpendType>("tool");
  const [monthly, setMonthly] = useState(26);
  const [once, setOnce] = useState(0);
  const [kind, setKind] = useState<GainKind>("meetings");
  const [per, setPer] = useState(1);
  const [closeRate, setCloseRate] = useState(PLAN_UNIT.closeRate * 100);
  const [contribution, setContribution] = useState(PLAN_UNIT.contributionEur);
  const [setup, setSetup] = useState(Math.round(PLAN_UNIT.setupEur * PLAN_UNIT.setupProfitShare));
  const [name, setName] = useState("Dialer");
  const [stop, setStop] = useState(EXAMPLES[0].stop);
  const [split, setSplit] = useState<{ key: keyof typeof SPLITS; amount: number }>({ key: "founder", amount: 1000 });

  const loadSpends = useCallback(() => data.listDecisions().then((d) => setSpends(d.filter((x) => x.source === "spend").reverse()), () => setSpends([])), []);
  useEffect(() => {
    Promise.all([data.report({ kind: "month", personId: "team" }), data.listFinanceData(), data.clientsOverview(), data.listDeals()])
      .then(([r, f, o, d]) => {
        setReport(r);
        setFin(f);
        setOverview(o);
        setDeals(d);
      })
      .catch((e: Error) => setError(e.message));
    loadSpends();
  }, [loadSpends]);

  const roi = useMemo(
    () => roiCheck({ type, monthlyCostEur: monthly, oneOffCostEur: once, gain: { kind, perMonth: per }, closeRate: closeRate / 100, contributionEur: contribution, setupEur: setup }),
    [type, monthly, once, kind, per, closeRate, contribution, setup],
  );

  if (error) return <EmptyState title={error} />;
  if (!report || !fin || !overview) return <SkeletonRows rows={8} />;

  // ---- live numbers
  const recurring = fin.expenses.filter((x) => x.recurring);
  const sumCat = (cats: Expense["category"][]) => recurring.filter((x) => cats.includes(x.category)).reduce((n, x) => n + inEur(x), 0);
  const mrrEur = overview.mrr ? (overview.mrr.USD ?? 0) / 100 / USD_PER_EUR + (overview.mrr.EUR ?? 0) / 100 : 0;
  const live = overview.cards.filter((c) => c.status === "live").length;
  const since = Date.now() - 30 * DAY;
  const won30 = deals.filter((d) => d.deal.stage === "won" && d.deal.wonAt && new Date(d.deal.wonAt).getTime() >= since).length;
  const ue = unitEconomics({ mrrEur, liveClients: live, usageCostEur: sumCat(["usage"]), salesCostEur: sumCat(["people", "tools", "data"]), fixedCostsEur: recurring.reduce((n, x) => n + inEur(x), 0), newClients30d: won30 });
  const latestCash = [...fin.cash].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const g = (k: "gate1" | "gate2" | "gate3") => {
    const x = report.gates.find((y) => y.key === k);
    return { met: !!x?.met, progress: x?.progress ?? 0 };
  };
  const steps = investmentOrder({ gate1: g("gate1"), gate2: g("gate2"), gate3: g("gate3"), cashEur: latestCash ? latestCash.balanceMinor / 100 : null, mrrEur });
  const nextStep = steps.find((s) => !s.open);

  const unitRows: { k: string; plan: string; actual: string; good: boolean | null; how: string }[] = [
    { k: "Contribution per client / month", plan: eurWhole(PLAN_UNIT.contributionEur), actual: ue.contribution === null ? "—" : eurWhole(ue.contribution), good: ue.contribution === null ? null : ue.contribution >= PLAN_UNIT.contributionEur * 0.8, how: `(MRR − usage cost) ÷ ${live} live clients` },
    { k: "Cost to win a client (CAC)", plan: eurWhole(PLAN_UNIT.cacEur), actual: ue.cac === null ? "—" : eurWhole(ue.cac), good: ue.cac === null ? null : ue.cac <= PLAN_UNIT.cacEur * 1.2, how: `Monthly people + tools + data ÷ ${won30} won in the last 30 days` },
    { k: "Lifetime value (LTV)", plan: eurWhole(PLAN_UNIT.ltvEur), actual: ue.ltv === null ? "—" : eurWhole(ue.ltv), good: ue.ltv === null ? null : ue.ltv >= PLAN_UNIT.ltvEur * 0.8, how: `Contribution ÷ ${pct(PLAN_UNIT.churn)} churn (planned until churn is measured)` },
    { k: "LTV ÷ CAC", plan: "≈ 30×", actual: ue.ltvCac === null ? "—" : `${Math.round(ue.ltvCac)}×`, good: ue.ltvCac === null ? null : ue.ltvCac >= 3, how: "Healthy above 3×" },
    { k: "Payback on CAC", plan: "< 1 month", actual: ue.paybackMonths === null ? "—" : `${ue.paybackMonths.toFixed(1)} months`, good: ue.paybackMonths === null ? null : ue.paybackMonths <= 3, how: "CAC ÷ monthly contribution" },
    { k: "Break-even", plan: `${PLAN_UNIT.breakEvenClients} clients`, actual: ue.breakEvenClients === null ? "—" : `${Math.ceil(ue.breakEvenClients)} clients`, good: ue.breakEvenClients === null ? null : live >= ue.breakEvenClients, how: `All monthly costs ÷ contribution · ${live} live now` },
  ];

  const verdict = roi.pass
    ? `Pays back in month ${roi.paybackMonth}, inside the ${SPEND_TYPES[type].windowMonths}-month window.`
    : roi.paybackMonth
      ? `Pays back in month ${roi.paybackMonth}: too slow for a ${SPEND_TYPES[type].windowMonths}-month window.`
      : "Doesn't pay back within 2 years.";
  const verdictLine = `${verdict} ROI ${pct(roi.roi)} over the window.`;
  const gainText =
    kind === "meetings" ? `+${per} approved meetings a month → ~${(per * closeRate / 100).toFixed(1)} new clients a month` : kind === "clients" ? `+${per} new clients a month` : `+€${per.toLocaleString("en-US")} gross profit a month`;
  const fillExample = (e: (typeof EXAMPLES)[number]) => {
    setType(e.type);
    setMonthly(e.monthly);
    setOnce(e.once);
    setKind(e.kind);
    setPer(e.per);
    setName(e.label);
    setStop(e.stop);
  };
  const num = (v: number, set: (n: number) => void, label: string, step = 1, suffix?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      <span className="flex items-center gap-2">
        <input type="number" min={0} step={step} className="input w-28" value={v} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} />
        {suffix ? <span className="text-[13px] text-text-3">{suffix}</span> : null}
      </span>
    </label>
  );
  const seg = (on: boolean) => `h-8 rounded-md px-3 text-[13px] ${on ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">ROI and investment</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">
          Is a spend worth it, should we build it or buy it, and what should we fund next? Plan figures are the assumptions in the financial plan; actuals come from Atlas. Not tax or investment advice.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card title="Unit economics" help="Plan (assumption) next to what Atlas measures today.">
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-[minmax(0,1.4fr)_90px_100px] gap-3 border-b border-line bg-surface-2/60 px-4 py-2 text-[12px] text-text-3">
              <span>Metric</span>
              <span className="text-right">Plan</span>
              <span className="text-right">Actual</span>
            </div>
            {unitRows.map((r) => (
              <div key={r.k} className="grid grid-cols-[minmax(0,1.4fr)_90px_100px] items-center gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span>{r.k}</span>
                  <span className="truncate text-[12px] text-text-3" title={r.how}>
                    {r.how}
                  </span>
                </span>
                <span className="num text-right text-text-2">{r.plan}</span>
                <span className="flex items-center justify-end gap-1.5">
                  {r.good === null ? null : <Icon d={r.good ? "M5 12l5 5L20 7" : "M12 8v5M12 16h.01"} size={14} className={r.good ? "text-mint" : "text-amber"} />}
                  <span className="num">{r.actual}</span>
                </span>
              </div>
            ))}
          </div>
          <span className="text-[12px] text-text-3">✓ on or better than plan · ! worth a look. Actuals need live clients, won deals and logged expenses to fill in.</span>
        </Card>

        <Card title="What to fund next" help="The investment order. Each step opens when its trigger is met.">
          {nextStep ? (
            <div className="rounded-lg bg-surface-2/60 px-4 py-3 text-[13px]">
              <span className="text-text-3">Next to unlock · </span>
              <span className="font-medium">{nextStep.title}</span>
              <span className="text-text-3"> · {pct(nextStep.progress)} of the way</span>
            </div>
          ) : null}
          <ol className="m-0 flex list-none flex-col p-0">
            {steps.map((s) => (
              <li key={s.order} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-3 border-b border-line-soft py-2.5 last:border-b-0">
                <span className="num pt-0.5 text-[12px] text-text-3">{s.order}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[13px] font-medium">{s.title}</span>
                  <span className="text-[12px] text-text-3">
                    {s.trigger} · {s.cost}
                  </span>
                  {!s.open ? (
                    <span className="h-1 w-full max-w-[220px] rounded-full bg-line">
                      <span className="block h-1 rounded-full bg-app" style={{ width: pct(s.progress) }} />
                    </span>
                  ) : null}
                  {s.note ? <span className="text-[12px] text-amber">{s.note}</span> : null}
                </span>
                {s.open ? (
                  <Pill hue="mint" dot>
                    Open
                  </Pill>
                ) : (
                  <Pill hue="text-3">Waiting</Pill>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card
        title="Should we spend on this?"
        help="ROI = (extra gross profit − cost) ÷ cost, over the payback window for this kind of spend."
        action={
          <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-text-3">
            Examples:
            {EXAMPLES.map((e) => (
              <button key={e.label} type="button" className="btn-outline h-7 px-2.5 text-[12px]" onClick={() => fillExample(e)}>
                {e.label}
              </button>
            ))}
          </span>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="field-label">Kind of spend</span>
              <div role="radiogroup" aria-label="Kind of spend" className="flex flex-wrap self-start rounded-lg bg-inset p-0.5">
                {(Object.keys(SPEND_TYPES) as SpendType[]).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={type === t} className={seg(type === t)} onClick={() => setType(t)}>
                    {SPEND_TYPES[t].label}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-text-3">
                {SPEND_TYPES[type].rule}. Example: {SPEND_TYPES[type].example}.
              </span>
            </div>
            <div className="flex flex-wrap gap-4">
              {num(monthly, setMonthly, "Cost per month", 5, "€")}
              {num(once, setOnce, "One-off cost", 50, "€")}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="field-label">What it should bring</span>
              <div role="radiogroup" aria-label="Expected gain" className="flex flex-wrap self-start rounded-lg bg-inset p-0.5">
                {(
                  [
                    ["meetings", "Approved meetings"],
                    ["clients", "New clients"],
                    ["profit", "Gross profit"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} className={seg(kind === k)} onClick={() => setKind(k)}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="flex items-center gap-2">
                <input type="number" min={0} step={kind === "profit" ? 50 : 0.5} aria-label="Gain per month" className="input w-28" value={per} onChange={(e) => setPer(Math.max(0, Number(e.target.value) || 0))} />
                <span className="text-[13px] text-text-3">{kind === "meetings" ? "extra approved meetings a month" : kind === "clients" ? "extra new clients a month" : "€ extra gross profit a month"}</span>
              </span>
            </div>
            {kind !== "profit" ? (
              <details className="text-[13px]">
                <summary className="cursor-pointer text-text-3 hover:text-text">Assumptions: close rate {closeRate}%, {eurWhole(contribution)}/month per client, {eurWhole(setup)} profit from each setup fee</summary>
                <div className="flex flex-wrap gap-4 pt-3">
                  {num(closeRate, setCloseRate, "Close rate", 1, "%")}
                  {num(contribution, setContribution, "Contribution per client", 10, "€/mo")}
                  {num(setup, setSetup, "Profit from each setup fee", 50, "€")}
                  <span className="basis-full text-[12px] text-text-3">
                    Setup profit is 60% of the {eurWhole(PLAN_UNIT.setupEur)} fee; 40% pays for delivery (setup-fee split).
                  </span>
                </div>
              </details>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <div className={`flex flex-col gap-1 rounded-lg px-4 py-3 ${roi.pass ? "bg-mint-tint" : "bg-amber-tint"}`}>
              <span className="flex items-center gap-2 text-[15px] font-semibold">
                <Icon d={roi.pass ? "M5 12l5 5L20 7" : "M12 8v5M12 16h.01"} size={16} className={roi.pass ? "text-mint" : "text-amber"} />
                {roi.pass ? "Worth it" : "Not yet worth it"}
              </span>
              <span className="text-[13px] text-text-2">{verdictLine}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-[13px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-text-3">Cost in window</span>
                <span className="num text-[18px] font-semibold">{eurWhole(roi.cost)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-text-3">Gain in window</span>
                <span className="num text-[18px] font-semibold">{eurWhole(roi.gain)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-text-3">ROI</span>
                <span className={`num text-[18px] font-semibold ${roi.roi >= 0 ? "text-mint" : "text-coral"}`}>{pct(roi.roi)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-text-3">Cumulative, month by month</span>
              <Legend items={[{ name: "Gain", color: "var(--chart-1)" }, { name: "Cost", color: "var(--chart-2)" }]} />
            </div>
            <LineChart
              ariaLabel="Cumulative cost and gain per month"
              height={180}
              labels={roi.months.map((m) => `Month ${m.month}`)}
              tickLabel={(l) => l.replace("Month ", "M")}
              series={[
                { name: "Gain", color: "var(--chart-1)", values: roi.months.map((m) => Math.round(m.gain)) },
                { name: "Cost", color: "var(--chart-2)", values: roi.months.map((m) => Math.round(m.cost)) },
              ]}
              format={(v) => (Math.abs(v) >= 1000 ? `€${(v / 1000).toFixed(v % 1000 ? 1 : 0)}K` : `€${v}`)}
            />
          </div>
        </div>

        <form
          className="flex flex-col gap-3 border-t border-line-soft pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await data.logSpendDecision({ title: name, monthlyCostEur: monthly, oneOffCostEur: once, expectedGain: gainText, stopRule: stop, reviewDate: shiftDateKey(new Date().toISOString().slice(0, 10), Math.round(SPEND_TYPES[type].windowMonths * 30)), verdict: verdictLine });
              toast("Logged as a proposed decision. The other founder is notified.", "good");
              loadSpends();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          <span className="text-[13px] font-medium">Log it in the decision log</span>
          <span className="text-[12px] text-text-3">Every spend over €100 a month gets a line: cost, expected gain, stop rule, review date. It stays proposed until both founders agree.</span>
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_auto]">
            <input className="input" aria-label="Spend name" placeholder="What are we buying?" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" aria-label="Stop rule" placeholder="Stop rule: when do we cancel?" value={stop} onChange={(e) => setStop(e.target.value)} />
            <button type="submit" className="btn-primary" disabled={!name.trim() || !stop.trim() || monthly + once <= 0}>
              Log spend
            </button>
          </div>
        </form>
      </Card>

      <BuildVsBuy expenses={fin.expenses} onLogged={loadSpends} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="Logged spends" help="Proposed and approved spends, with when to review them.">
          {spends.length ? (
            <div className="flex flex-col">
              {spends.map((d) => (
                <div key={d.id} className="flex flex-col gap-1 border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium">{d.title.replace(/^Spend: /, "")}</span>
                    <Pill hue={d.status.startsWith("approved") || d.status.startsWith("confirmed") ? "mint" : "amber"} dot className="capitalize">
                      {d.status}
                    </Pill>
                  </span>
                  <span className="text-[12px] text-text-2">{d.reason}</span>
                  <span className="text-[12px] text-text-3">
                    {d.expectedImpact} · review {tableDate(`${d.reviewDate}T12:00:00Z`)} · {d.owner}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[13px] text-text-3">Nothing logged yet. Run a check above and log it.</span>
          )}
        </Card>

        <Card title="Split money in" help="The agreed splits for founder money and for each setup fee.">
          <div className="flex flex-wrap items-end gap-3">
            <div role="radiogroup" aria-label="Which money" className="flex rounded-lg bg-inset p-0.5">
              {(Object.keys(SPLITS) as (keyof typeof SPLITS)[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={split.key === k} className={seg(split.key === k)} onClick={() => setSplit({ ...split, key: k })}>
                  {SPLITS[k].label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-text-2">
              €
              <input type="number" min={0} step={100} aria-label="Amount in EUR" className="input w-32" value={split.amount} onChange={(e) => setSplit({ ...split, amount: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
          </div>
          <div className="flex flex-col gap-2">
            {SPLITS[split.key].rows.map(([label, share]) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="flex justify-between text-[13px]">
                  <span>
                    {label} <span className="text-text-3">· {share}%</span>
                  </span>
                  <span className="num">{eurWhole((split.amount * share) / 100)}</span>
                </span>
                <span className="h-1.5 rounded-full bg-line">
                  <span className="block h-1.5 rounded-full bg-app" style={{ width: `${share}%` }} />
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Roi;
