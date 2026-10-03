/**
 * Money › ROI and investment (spec/backbone/09 and 03).
 * - The ROI test: ROI = (extra gross profit − cost) ÷ cost over the spend type's payback window.
 * - Unit economics: plan values from 03 (assumptions) next to actuals from Atlas.
 * - The investment order: what to fund next, each step unlocked by its trigger.
 * Pure functions; the page feeds them live data.
 */
import { CASH_RESERVE_EUR, USD_PER_EUR } from "@/config/targets";

export type SpendType = "tool" | "hire" | "marketing" | "build";

export const SPEND_TYPES: Record<SpendType, { label: string; windowMonths: number; rule: string; example: string }> = {
  tool: { label: "Sales tool or data", windowMonths: 3, rule: "Pays back within 3 months", example: "Dialer $30/month must add about 1 meeting a month" },
  hire: { label: "Hire (setter, list builder)", windowMonths: 6, rule: "Pays back within 6 months, and only after its gate", example: "List builder $175/month: +8 approved meetings a month" },
  marketing: { label: "Marketing experiment", windowMonths: 1.5, rule: "One 4–6 week test with a stop rule", example: "€200 test: at least 2 qualified leads, or stop" },
  build: { label: "Build in-house", windowMonths: 12, rule: "Cheaper than buying over 12 months (hours × €700/day)", example: "Build the queue (core) vs buy an email sender (commodity)" },
};

/** Planning assumptions from spec/backbone/03 (replace with actuals as they come in). */
export const PLAN_UNIT = {
  closeRate: 0.2,
  /** Gllarix contribution per client per month: $800 fee − ~$100 usage ≈ $700 ≈ €610. */
  contributionEur: 610,
  /** Realistic Gllarix setup fee ($1,800) in EUR. */
  setupEur: Math.round(1800 / USD_PER_EUR),
  /** Share of a setup fee that is profit: the setup-fee split puts 40% on founder delivery. */
  setupProfitShare: 0.6,
  cacEur: 500,
  churn: 0.04,
  ltvEur: 15_000,
  breakEvenClients: 2,
  fixedCostsEur: 700,
};

export type GainKind = "meetings" | "clients" | "profit";

export interface RoiInput {
  type: SpendType;
  monthlyCostEur: number;
  oneOffCostEur: number;
  gain: { kind: GainKind; perMonth: number };
  closeRate: number;
  contributionEur: number;
  setupEur: number;
}

export interface RoiResult {
  windowMonths: number;
  newClientsPerMonth: number;
  /** Month by month over the window (cumulative). */
  months: { month: number; cost: number; gain: number }[];
  cost: number;
  gain: number;
  roi: number;
  /** First month the cumulative gain covers the cumulative cost; null if not within 24 months. */
  paybackMonth: number | null;
  pass: boolean;
}

/**
 * Clients added in month m (1-based) pay their setup in month m and their monthly contribution from month m + 1.
 * Profit gains count from month 1. A window of 1.5 months is evaluated over 2 calendar months, pro-rated.
 */
export const roiCheck = (i: RoiInput): RoiResult => {
  const windowMonths = SPEND_TYPES[i.type].windowMonths;
  const newClients = i.gain.kind === "meetings" ? i.gain.perMonth * i.closeRate : i.gain.kind === "clients" ? i.gain.perMonth : 0;
  const months: RoiResult["months"] = [];
  let cost = i.oneOffCostEur;
  let gain = 0;
  let clients = 0;
  let paybackMonth: number | null = null;
  for (let m = 1; m <= 24; m++) {
    cost += i.monthlyCostEur;
    gain += i.gain.kind === "profit" ? i.gain.perMonth : clients * i.contributionEur + newClients * i.setupEur;
    clients += newClients;
    months.push({ month: m, cost, gain });
    if (paybackMonth === null && gain >= cost && cost > 0) paybackMonth = m;
  }
  const full = Math.floor(windowMonths);
  const frac = windowMonths - full;
  const at = (k: number) => months[Math.max(0, k - 1)];
  const lerp = (a: number, b: number) => a + (b - a) * frac;
  const wCost = frac ? lerp(at(full).cost, at(full + 1).cost) : at(full).cost;
  const wGain = frac ? lerp(at(full).gain, at(full + 1).gain) : at(full).gain;
  return {
    windowMonths,
    newClientsPerMonth: newClients,
    months: months.slice(0, Math.max(6, Math.ceil(windowMonths) + 1)),
    cost: wCost,
    gain: wGain,
    roi: wCost > 0 ? (wGain - wCost) / wCost : 0,
    paybackMonth,
    pass: paybackMonth !== null && paybackMonth <= Math.ceil(windowMonths),
  };
};

export interface UnitActuals {
  mrrEur: number;
  liveClients: number;
  usageCostEur: number;
  /** Monthly people + tools + data (sales cost). */
  salesCostEur: number;
  /** All recurring monthly costs. */
  fixedCostsEur: number;
  newClients30d: number;
}

/** Actual unit economics; null where there isn't enough data yet. */
export const unitEconomics = (a: UnitActuals) => {
  const contribution = a.liveClients ? (a.mrrEur - a.usageCostEur) / a.liveClients : null;
  const cac = a.newClients30d ? a.salesCostEur / a.newClients30d : null;
  return {
    contribution,
    cac,
    ltv: contribution !== null ? contribution / PLAN_UNIT.churn : null,
    ltvCac: contribution !== null && cac ? contribution / PLAN_UNIT.churn / cac : null,
    paybackMonths: contribution && cac !== null ? cac / contribution : null,
    breakEvenClients: contribution && contribution > 0 ? a.fixedCostsEur / contribution : null,
  };
};

export interface InvestmentSignals {
  gate1: { met: boolean; progress: number };
  gate2: { met: boolean; progress: number };
  gate3: { met: boolean; progress: number };
  cashEur: number | null;
  mrrEur: number;
}

export interface InvestmentStep {
  order: number;
  title: string;
  trigger: string;
  cost: string;
  open: boolean;
  /** 0–1 towards the trigger. */
  progress: number;
  note?: string;
}

/** The investment order from spec/backbone/09, with each trigger checked against live numbers. */
export const investmentOrder = (s: InvestmentSignals): InvestmentStep[] => {
  const setterPayEur = (2 * 350) / USD_PER_EUR;
  const cashNeed = CASH_RESERVE_EUR + setterPayEur;
  const cashOk = s.cashEur !== null && s.cashEur >= cashNeed;
  const grow = Math.min(1, s.mrrEur / 10_000);
  const holding = (gate: { met: boolean; progress: number }, amount: string, months: string) =>
    !gate.met && gate.progress >= 1 ? `MRR is over ${amount} now; it has to stay there ${months} in a row.` : undefined;
  const steps: InvestmentStep[] = [
    { order: 1, title: "Demo line, Atlas M0–M3, lead data", trigger: "Now", cost: "Tools budget", open: true, progress: 1 },
    { order: 2, title: "Part-time list builder", trigger: "The queue is short of A/B leads", cost: "$150–200/month", open: true, progress: 1 },
    { order: 3, title: "3D showcase project (freelancer)", trigger: "Before developer outreach", cost: "Freelancer quote", open: true, progress: 1 },
    {
      order: 4,
      title: "Setter #1, BDR promoted to closer",
      trigger: `Gate 1: 3 paying clients + 2 months' pay (€${Math.round(setterPayEur)}) on top of the €${CASH_RESERVE_EUR.toLocaleString("en-US")} reserve`,
      cost: "~$350 + bonuses, ~+$100 closer uplift",
      open: s.gate1.met && cashOk,
      progress: Math.min(s.gate1.progress, s.cashEur === null ? 0 : Math.min(1, s.cashEur / cashNeed)),
      note: s.gate1.met && !cashOk ? `Gate 1 is met; cash needs to reach €${Math.round(cashNeed).toLocaleString("en-US")}.` : undefined,
    },
    { order: 5, title: "Part-time implementer", trigger: "Gate 2: €2,000 MRR for 2 months", cost: "To define", open: s.gate2.met, progress: s.gate2.progress },
    { order: 6, title: "Buy back Rinor's time", trigger: "€2,000 MRR for 2 months: 50% of profit", cost: "Per the profit split", open: s.gate2.met, progress: s.gate2.progress },
    { order: 7, title: "Second channel (Kosovo caller or setter #2)", trigger: "Gate 2", cost: "To define", open: s.gate2.met, progress: s.gate2.progress },
    { order: 8, title: "Pods and a team lead", trigger: "Gate 3: €5,000 MRR, churn under 5%", cost: "To define", open: s.gate3.met, progress: s.gate3.progress },
    { order: 9, title: "Grow more: new markets, Tier 3, 3D SaaS", trigger: "€10k MRR for 3 months + €10k reserve", cost: "Plan with the AI co-founder", open: false, progress: grow },
  ];
  for (const st of steps) {
    if (st.order >= 5 && st.order <= 7) st.note ??= holding(s.gate2, "€2,000", "2 month-ends");
    if (st.order === 8) st.note ??= holding(s.gate3, "€5,000", "3 months, with churn under 5%,");
  }
  return steps;
};

/** Splits from spec/backbone/09 (founder money) and 03 (setup fees). */
export const SPLITS = {
  founder: { label: "Founder money", rows: [["MVP and templates", 30], ["Sales tools and prospecting", 25], ["Demo assets", 15], ["Legal, accounting and setup", 10], ["Emergency reserve", 20]] as [string, number][] },
  setup: { label: "Setup fee received", rows: [["Founder delivery", 40], ["Reserve", 30], ["Sales and content", 20], ["Tax and contingency", 10]] as [string, number][] },
};
