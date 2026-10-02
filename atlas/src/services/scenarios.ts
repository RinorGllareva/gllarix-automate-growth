/**
 * 12-month scenarios (A19 `run_scenario`). A line-for-line port of `spec/models/scenarios_by_brand.py` (revenue by brand)
 * and `spec/models/scenarios_combined_v2.py` (team and tool costs, stage gates, cash), with parity tests against the
 * Python output (`src/test/scenarios.test.ts`). Month 0 = Oct 2026. Gllarix inputs are USD, Arcadian EUR; results in EUR.
 */

export const FX = 1.15;
export const SCENARIO_MONTHS = ["Oct 26", "Nov 26", "Dec 26", "Jan 27", "Feb 27", "Mar 27", "Apr 27", "May 27", "Jun 27", "Jul 27", "Aug 27", "Sep 27"];

/** (month_index, setup_eur, monthly_eur, name) */
export type Project = [number, number, number, string];

export interface BrandScenarioInput {
  new: number[];
  setup: number;
  mrr: number;
  lp: number;
  churn: number;
  over: number;
  att3d: number;
  ar: Project[];
  sw: Project[];
  lps: number[];
}

export interface CombinedScenarioInput {
  new: number[];
  setup: number;
  mrr: number;
  lp: number;
  churn: number;
  ar: Project[];
  lps: number[];
}

/** `plans/scenarios_12_months.md` inputs (scenarios_by_brand.py, current). */
export const BRAND_SCENARIOS: Record<"worst" | "realistic" | "best", BrandScenarioInput> = {
  worst: { new: [0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1], setup: 1400, mrr: 650, lp: 0.15, churn: 0.06, over: 0, att3d: 0.0, ar: [[8, 6500, 249, "3D building (UK/US)"]], sw: [], lps: [6, 10] },
  realistic: {
    new: [0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3], setup: 1800, mrr: 800, lp: 0.35, churn: 0.04, over: 20, att3d: 0.5,
    ar: [[3, 3250, 125, "3D building, Kosovo"], [5, 8300, 249, "3D building + interiors, UK"], [7, 14000, 449, "3D sales platform, Dubai"], [9, 15000, 561, "3D sales platform, Switzerland"]],
    sw: [[6, 3500, 99, "Custom software"]], lps: [1, 3, 5, 7, 9, 11],
  },
  best: {
    new: [0, 2, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7], setup: 2300, mrr: 1000, lp: 0.5, churn: 0.03, over: 40, att3d: 0.6,
    ar: [[2, 3250, 125, "Kosovo"], [3, 8300, 249, "UK"], [4, 14000, 449, "Dubai"], [6, 15000, 561, "Switzerland"], [7, 14000, 449, "US"], [8, 14000, 449, "Dubai"], [9, 17000, 561, "Switzerland"], [10, 14000, 449, "UK"], [11, 14000, 449, "US"]],
    sw: [[7, 14000, 210, "Custom software"]], lps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
};

/**
 * Python's round(): rounds the exact binary value, ties to even. `toFixed` also rounds the exact value but sends ties up,
 * so only exact ties (e.g. 2.5, 0.25 to one digit) need the even rule.
 */
export const pyRound = (x: number, digits = 0): number => {
  // toFixed(100) prints the exact decimal expansion of the double (it terminates well within 100 digits here).
  const exact = Math.abs(x).toFixed(100);
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + digits);
  let r: number;
  if (/^50*$/.test(tail)) {
    const kept = exact.slice(0, dot + 1 + digits).replace(/\.$/, "");
    const lastDigit = Number(kept[kept.length - 1]);
    const down = Number(kept);
    r = Math.sign(x) * (lastDigit % 2 === 0 ? down : Number((down + 10 ** -digits).toFixed(digits)));
  } else r = Number(x.toFixed(digits));
  return Object.is(r, -0) ? 0 : r;
};

const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);

export interface BrandScenarioResult {
  g_new: number; g_from3d: number; g_active: number; g_mrr: number; g_set: number; g_rec: number; g_rev: number;
  a_3d: number; a_sw: number; lp_att: number; lp_std: number; a_mrr: number; a_set: number; a_rec: number; a_rev: number; cogs: number;
  gq: number[]; aq: number[];
}

export interface BrandScenarioMonthly {
  /** EUR per month. */
  gRev: number[];
  aRev: number[];
  gMrr: number[];
  aMrr: number[];
  cogs: number[];
  /** New Gllarix clients per month (incl. expected receptionists sold with 3D deals). */
  newClients: number[];
  /** Gllarix setup fees in USD per month (for commission). */
  gSetupUsd: number[];
  /** Gllarix recurring USD per month by cohort age ≤ 6 (for the 10% recurring commission). */
  gRecurringEarlyUsd: number[];
}

/** scenarios_by_brand.py, one scenario. */
export const scenarioByBrand = (c: BrandScenarioInput): { result: BrandScenarioResult; monthly: BrandScenarioMonthly } => {
  let pilots = 2;
  const co: [number, number, boolean, number][] = [];
  const lpco: [number, number][] = [];
  let total = 0;
  const gRev = Array(12).fill(0), aRev = Array(12).fill(0), gMrrM = Array(12).fill(0), aMrrM = Array(12).fill(0), cogsM = Array(12).fill(0), newM = Array(12).fill(0), gSetM = Array(12).fill(0), gEarly = Array(12).fill(0);
  const tot = { gs: 0, gr: 0, as_: 0, ar: 0, cogs: 0 };
  let lpAtt = 0, gm = 0, am = 0;
  const extra = Array(12).fill(0);
  for (const [mi] of c.ar) extra[mi] += c.att3d;
  const isAr = (p: Project) => c.ar.some((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2] && q[3] === p[3]);
  for (let i = 0; i < 12; i++) {
    let gs = 0, asu = 0, cogs = 0;
    for (let n = 0; n < c.new[i]; n++) {
      let s: number, r: number, free: boolean;
      if (pilots > 0) {
        pilots -= 1; s = 600; r = 699 * 0.75; free = true;
      } else {
        s = c.setup; r = c.mrr; free = false;
      }
      gs += s; co.push([r, 0, free, 1.0]); total += 1; newM[i] += 1;
    }
    if (extra[i] > 0) {
      gs += 1500 * extra[i]; co.push([699 * extra[i], 0, false, extra[i]]); total += extra[i]; newM[i] += extra[i];
    }
    const att = c.new[i] * c.lp;
    lpAtt += att;
    asu += (att * 1440) / FX;
    lpco.push([(att * 79) / FX, 0]);
    const grec = sum(co.filter((x) => x[1] >= 1 && !(x[2] && x[1] === 1)).map((x) => x[0] + c.over * x[3]));
    gEarly[i] = sum(co.filter((x) => x[1] >= 1 && x[1] <= 6 && !(x[2] && x[1] === 1)).map((x) => x[0] + c.over * x[3]));
    let arec = sum(lpco.filter((x) => x[1] >= 1).map((x) => x[0]));
    for (const p of [...c.ar, ...c.sw]) {
      const [mi, st, mo] = p;
      if (mi === i) {
        asu += st;
        if (isAr(p)) cogs += 0.3 * st;
      }
      if (i > mi) arec += mo;
    }
    if (c.lps.includes(i)) asu += 1000;
    arec += 60 * c.lps.filter((x) => x < i).length;
    gRev[i] = (gs + grec) / FX;
    aRev[i] = asu + arec;
    gSetM[i] = gs;
    tot.gs += gs / FX; tot.gr += grec / FX; tot.as_ += asu; tot.ar += arec; tot.cogs += cogs;
    gm = grec / FX; am = arec;
    gMrrM[i] = gm; aMrrM[i] = am; cogsM[i] = cogs;
    for (const x of co) {
      if (x[1] >= 1) x[0] *= 1 - c.churn;
      x[1] += 1;
    }
    for (const x of lpco) x[1] += 1;
  }
  const active = sum(co.map((x) => x[3] * (1 - c.churn) ** Math.max(0, x[1] - 1)));
  const q = (arr: number[]) => [0, 3, 6, 9].map((j) => pyRound(sum(arr.slice(j, j + 3))));
  return {
    result: {
      g_new: pyRound(total, 1), g_from3d: pyRound(sum(extra), 1), g_active: pyRound(active, 1), g_mrr: pyRound(gm), g_set: pyRound(tot.gs), g_rec: pyRound(tot.gr), g_rev: pyRound(tot.gs + tot.gr),
      a_3d: c.ar.length, a_sw: c.sw.length, lp_att: pyRound(lpAtt, 1), lp_std: c.lps.length, a_mrr: pyRound(am), a_set: pyRound(tot.as_), a_rec: pyRound(tot.ar), a_rev: pyRound(tot.as_ + tot.ar), cogs: pyRound(tot.cogs),
      gq: q(gRev), aq: q(aRev),
    },
    monthly: { gRev, aRev, gMrr: gMrrM, aMrr: aMrrM, cogs: cogsM, newClients: newM, gSetupUsd: gSetM, gRecurringEarlyUsd: gEarly },
  };
};

// ---------------------------------------------------------------- costs, stages and cash (scenarios_combined_v2.py)

/** Team pay per stage (USD/month), approved-meeting count per stage (× $15) and tool costs (EUR/month). */
export const STAGE_PAY_USD: Record<number, number> = { 1: 500, 2: 950, 3: 2050, 4: 4500 };
export const STAGE_MEETINGS: Record<number, number> = { 1: 11, 2: 26, 3: 48, 4: 80 };
export const STAGE_OPS_EUR: Record<number, number> = { 1: 250, 2: 350, 3: 500, 4: 700 };

export interface CombinedRow {
  m: string; stage: number; clients: number; rev: number; mrr: number; cost: number; net: number; cum: number;
}

/** scenarios_combined_v2.py, one scenario (previous model: kept for parity and for its cost logic). */
export const scenarioCombinedV2 = (c: CombinedScenarioInput): CombinedRow[] => {
  let stage = 1, stageAge = 0, pilots = 2, total = 0, cum = 0;
  const cohorts: [number, number, boolean][] = [];
  const mh: number[] = [];
  const rows: CombinedRow[] = [];
  SCENARIO_MONTHS.forEach((m, i) => {
    let setupUsd = 0, comm = 0;
    for (let n = 0; n < c.new[i]; n++) {
      let s: number, r: number, free: boolean;
      if (pilots > 0) {
        pilots -= 1; s = 600; r = 699 * 0.75; free = true;
      } else {
        s = c.setup; r = c.mrr; free = false;
      }
      s += c.lp * 1440; r += c.lp * 79;
      setupUsd += s; comm += Math.max(100, 0.1 * s);
      cohorts.push([r, 0, free]); total += 1;
    }
    let gMrr = 0;
    for (const co of cohorts) {
      if (co[1] >= 1 && !(co[2] && co[1] === 1)) {
        gMrr += co[0];
        if (co[1] <= 6) comm += 0.1 * co[0];
      }
    }
    let arSetup = 0, cogs = 0;
    for (const [mi, st, , name] of c.ar) {
      if (mi === i) {
        arSetup += st;
        cogs += name.includes("3D") ? 0.3 * st : 0;
      }
    }
    const arMrr = sum(c.ar.filter(([mi]) => i > mi).map(([, , mo]) => mo));
    const lpSetup = c.lps.includes(i) ? 1000 : 0;
    const lpMrr = 60 * c.lps.filter((x) => x < i).length;
    const revEur = (setupUsd + gMrr) / FX + arSetup + arMrr + lpSetup + lpMrr;
    const mrrEur = gMrr / FX + arMrr + lpMrr;
    const teamUsd = STAGE_PAY_USD[stage] + (i === 0 ? 4 : STAGE_MEETINGS[stage]) * 15 + comm;
    const cost = teamUsd / FX + STAGE_OPS_EUR[stage] + cogs;
    const net = revEur - cost;
    cum += net;
    rows.push({ m, stage, clients: total, rev: pyRound(revEur), mrr: pyRound(mrrEur), cost: pyRound(cost), net: pyRound(net), cum: pyRound(cum) });
    mh.push(mrrEur);
    for (const co of cohorts) {
      if (co[1] >= 1) co[0] *= 1 - c.churn;
      co[1] += 1;
    }
    stageAge += 1;
    if (stage === 1 && total >= 3) {
      stage = 2; stageAge = 0;
    } else if (stage === 2 && stageAge >= 2 && mh.length >= 2 && mh[mh.length - 1] >= 2000 && mh[mh.length - 2] >= 2000) {
      stage = 3; stageAge = 0;
    } else if (stage === 3 && stageAge >= 3 && mh[mh.length - 1] >= 5000) {
      stage = 4; stageAge = 0;
    }
  });
  return rows;
};

// ---------------------------------------------------------------- run_scenario: one model for revenue, cost and cash by brand

export interface Hire {
  label: string;
  /** Month index the cost starts (0 = Oct 2026). */
  fromMonth: number;
  monthlyUsd: number;
}

export interface ScenarioInputs {
  scenario: "worst" | "realistic" | "best";
  /** Overrides on the scenario's inputs (e.g. new clients per month, churn). */
  overrides?: Partial<BrandScenarioInput>;
  /** Extra people or tools on top of the stage costs (e.g. setter #1 from month 3, a $150 list builder). */
  hires?: Hire[];
  /** Opening cash in EUR (from the latest cash snapshot). */
  openingCashEur?: number;
}

export interface ScenarioMonth {
  month: string;
  stage: number;
  gllarixRevenue: number;
  arcadianRevenue: number;
  revenue: number;
  mrr: number;
  costs: number;
  net: number;
  cash: number;
}

export interface ScenarioRun {
  inputs: ScenarioInputs;
  summary: BrandScenarioResult;
  months: ScenarioMonth[];
  totals: { revenue: number; costs: number; net: number };
  lowPoint: { month: string; cash: number };
  mrrEnd: number;
  /** How costs are built (the merge the models README asks for): labelled so answers can cite it. */
  method: string;
}

/**
 * Revenue and MRR by brand from scenarios_by_brand.py; costs from scenarios_combined_v2.py's stage model
 * (team pay + meeting bonuses + commission, tools per stage, 30% freelance on 3D), driven by the by-brand client stream;
 * plus any extra hires. Cash = opening cash + cumulative net.
 */
export const runScenario = (inputs: ScenarioInputs): ScenarioRun => {
  const c: BrandScenarioInput = { ...BRAND_SCENARIOS[inputs.scenario], ...(inputs.overrides ?? {}) };
  const { result, monthly } = scenarioByBrand(c);
  let stage = 1, stageAge = 0, clients = 0;
  let cash = inputs.openingCashEur ?? 0;
  const mh: number[] = [];
  const months: ScenarioMonth[] = [];
  for (let i = 0; i < 12; i++) {
    clients += monthly.newClients[i];
    const comm = Math.max(0, monthly.newClients[i] > 0 ? Math.max(100 * monthly.newClients[i], 0.1 * monthly.gSetupUsd[i]) : 0) + 0.1 * monthly.gRecurringEarlyUsd[i];
    const teamUsd = STAGE_PAY_USD[stage] + (i === 0 ? 4 : STAGE_MEETINGS[stage]) * 15 + comm;
    const hiresUsd = sum((inputs.hires ?? []).filter((h) => i >= h.fromMonth).map((h) => h.monthlyUsd));
    const costs = (teamUsd + hiresUsd) / FX + STAGE_OPS_EUR[stage] + monthly.cogs[i];
    const revenue = monthly.gRev[i] + monthly.aRev[i];
    const mrr = monthly.gMrr[i] + monthly.aMrr[i];
    const net = revenue - costs;
    cash += net;
    months.push({ month: SCENARIO_MONTHS[i], stage, gllarixRevenue: Math.round(monthly.gRev[i]), arcadianRevenue: Math.round(monthly.aRev[i]), revenue: Math.round(revenue), mrr: Math.round(mrr), costs: Math.round(costs), net: Math.round(net), cash: Math.round(cash) });
    mh.push(mrr);
    stageAge += 1;
    if (stage === 1 && clients >= 3) {
      stage = 2; stageAge = 0;
    } else if (stage === 2 && stageAge >= 2 && mh.length >= 2 && mh[mh.length - 1] >= 2000 && mh[mh.length - 2] >= 2000) {
      stage = 3; stageAge = 0;
    } else if (stage === 3 && stageAge >= 3 && mh[mh.length - 1] >= 5000) {
      stage = 4; stageAge = 0;
    }
  }
  const low = months.reduce((a, b) => (b.cash < a.cash ? b : a), months[0]);
  return {
    inputs, summary: result, months,
    totals: { revenue: sum(months.map((m) => m.revenue)), costs: sum(months.map((m) => m.costs)), net: sum(months.map((m) => m.net)) },
    lowPoint: { month: low.month, cash: low.cash }, mrrEnd: months[11].mrr,
    method: "Revenue: models/scenarios_by_brand.py · costs: models/scenarios_combined_v2.py stage model",
  };
};
