import {
  ANNUAL_PAID,
  BRANDS,
  BUNDLE,
  BY_ID,
  COMM_MIN,
  COMM_MONTHS,
  COMM_PCT,
  CROSS,
  DEFAULTS,
  DISCOUNT_HARD_MAX,
  MARKETS,
  PILOT_MONTHLY,
  PILOT_SETUP,
  QUOTE_VALID_DAYS,
  RUSH,
  type BookGroup,
  type BookItem,
  type BrandCode,
  type MarketId,
} from "@/config/priceBook";

/** A quote's choices: the calculator's state S. */
export interface QuoteSelection {
  market: MarketId;
  /** Chosen item per tier group: { rec: "rec_m", lp: "lp_2" }. */
  tiers: Record<string, string>;
  /** Quantity per add-on item. */
  qty: Record<string, number>;
  /** Custom software build days. */
  days: number;
  rate: number;
  pilot: boolean;
  rush: boolean;
  billing: "monthly" | "annual";
  /** Extra discount % (0–30). */
  disc: number;
  /** Show the BDR commission (the calculator's "bdr" toggle). */
  bdr: boolean;
  overRate: number;
  usagePct: number;
  costMin: number;
}

export const emptySelection = (market: MarketId): QuoteSelection => ({
  market,
  tiers: {},
  qty: {},
  days: 0,
  rate: DEFAULTS.rate,
  pilot: false,
  rush: false,
  billing: "monthly",
  disc: 0,
  bdr: true,
  overRate: DEFAULTS.overRate,
  usagePct: DEFAULTS.usagePct,
  costMin: DEFAULTS.costMin,
});

export interface QuoteLine {
  brand: BrandCode;
  group: string;
  id: string;
  name: string;
  q: number;
  setup: number;
  monthly: number;
}

export interface QuoteAdjustment {
  name: string;
  ds: number;
  dm: number;
}

export interface QuoteResult {
  lines: QuoteLine[];
  adj: QuoteAdjustment[];
  S0: number;
  M0: number;
  setup: number;
  monthly: number;
  firstYear: number;
  paidMonths: number;
  comm: number;
  hours: number;
  bundle: boolean;
  cross: boolean;
  dp: number;
  mins: number;
  used: number;
  over: number;
  overRev: number;
  useCost: number;
  margin: number;
}

const groupSelected = (s: QuoteSelection, gid: string) => Boolean(s.tiers[gid]);
const included = (s: QuoteSelection, it: BookItem) => Boolean(it.includedWith && it.includedWith.includes(s.tiers.rec));
const available = (s: QuoteSelection, g: BookGroup, it: BookItem) => {
  const req = it.requires || g.requires;
  return !req || groupSelected(s, req);
};

export const itemAvailable = (s: QuoteSelection, groupId: string, itemId: string) => {
  const g = BRANDS.flatMap((b) => b.groups).find((x) => x.id === groupId);
  const it = BY_ID[itemId];
  return Boolean(g && it && available(s, g, it));
};
export const itemIncluded = (s: QuoteSelection, itemId: string) => included(s, BY_ID[itemId]);

/**
 * Port of compute() from pricing/price-calculator.html, same order of operations:
 * list × qty → market multiplier → bundle / cross-sell → rush → pilot → extra discount → round setup to 10.
 * Amounts are major units (dollars / euros), as in the calculator.
 */
export const compute = (S: QuoteSelection): QuoteResult => {
  const m = MARKETS[S.market] ?? MARKETS.us;
  const lines: QuoteLine[] = [];
  let hours = 0;
  const add = (it: BookItem & { brand: BrandCode; group: string }, q: number, labelExtra = "") => {
    lines.push({ brand: it.brand, group: it.group, id: it.id, name: it.name + labelExtra, q, setup: it.setup * q, monthly: it.monthly * q });
    hours += it.hours * q;
  };
  for (const b of BRANDS) {
    for (const g of b.groups) {
      if (g.type === "tier" && S.tiers[g.id]) {
        const it = BY_ID[S.tiers[g.id]];
        if (it) add(it, 1, ` (${g.title})`);
      }
      if (g.type === "addon") {
        for (const it of g.items ?? []) {
          const q = S.qty[it.id] || 0;
          if (q > 0 && available(S, g, it) && !included(S, it)) add({ ...it, brand: b.id, group: g.id }, q);
        }
      }
      if (g.type === "days" && S.days > 0) {
        const build = S.days * S.rate;
        const maint = Math.max(g.maintMin!, (build * g.maintPct!) / 100);
        lines.push({ brand: "ar", group: "sw", id: "sw", name: `Custom software (${S.days} days)`, q: 1, setup: build, monthly: maint });
        hours += S.days * 8;
      }
    }
  }
  let S0 = 0;
  let M0 = 0;
  lines.forEach((l) => {
    S0 += l.setup;
    M0 += l.monthly;
  });
  const adj: QuoteAdjustment[] = [];
  let s = S0 * m.mult;
  let mo = M0 * m.mult;
  if (m.mult !== 1) adj.push({ name: `Market: ${m.label} (${Math.round(m.mult * 100)}% of list)`, ds: s - S0, dm: mo - M0 });
  // bundle
  const bundle = Boolean(S.tiers.rec) && BUNDLE.need.every((id) => (S.qty[id] || 0) > 0);
  if (bundle) {
    let glm = 0;
    lines.forEach((l) => {
      if (l.brand === "gl") glm += l.monthly * m.mult;
    });
    const d = (-glm * BUNDLE.pct) / 100;
    mo += d;
    adj.push({ name: `Never Miss a Job bundle: −${BUNDLE.pct}% Gllarix monthly`, ds: 0, dm: d });
  }
  const cross = Boolean(S.tiers.rec) && Boolean(S.tiers.lp);
  if (cross) {
    let lpl = 0;
    lines.forEach((l) => {
      if (l.group === "lp") lpl += l.setup * m.mult;
    });
    const d2 = (-lpl * CROSS.pct) / 100;
    s += d2;
    adj.push({ name: `Landing page with Gllarix: −${CROSS.pct}% page setup`, ds: d2, dm: 0 });
  }
  if (S.rush && s > 0) {
    const d3 = s * RUSH;
    s += d3;
    adj.push({ name: "Rush delivery: +25% setup", ds: d3, dm: 0 });
  }
  if (S.pilot && (s > 0 || mo > 0)) {
    const d4 = -s * (1 - PILOT_SETUP);
    const d5 = -mo * (1 - PILOT_MONTHLY);
    s += d4;
    mo += d5;
    adj.push({ name: "Pilot: setup at 40%, monthly −25% for 12 months", ds: d4, dm: d5 });
  }
  const dp = Math.min(DISCOUNT_HARD_MAX, Math.max(0, S.disc || 0));
  if (dp > 0) {
    const ds = (-s * dp) / 100;
    const dm = (-mo * dp) / 100;
    s += ds;
    mo += dm;
    adj.push({ name: `Extra discount: −${dp}%`, ds, dm });
  }
  const setup = Math.round(s / 10) * 10;
  const monthly = Math.round(mo);
  const paidMonths = (S.billing === "annual" ? ANNUAL_PAID : 12) - (S.pilot && monthly > 0 ? 1 : 0);
  const firstYear = setup + monthly * paidMonths;
  let comm = 0;
  if (S.bdr && (setup > 0 || monthly > 0)) comm = (setup > 0 ? Math.max(COMM_MIN, setup * COMM_PCT) : 0) + monthly * COMM_PCT * COMM_MONTHS;
  const mins = S.tiers.rec ? (BY_ID[S.tiers.rec].mins ?? 0) : 0;
  const used = (mins * S.usagePct) / 100;
  const over = Math.max(0, used - mins);
  const overRev = over * S.overRate;
  const useCost = used * S.costMin;
  const margin = monthly + overRev > 0 ? (monthly + overRev - useCost) / (monthly + overRev) : 0;
  return { lines, adj, S0, M0, setup, monthly, firstYear, paidMonths, comm, hours, bundle, cross, dp, mins, used, over, overRev, useCost, margin };
};

const money = (n: number, market: MarketId) => {
  const sym = MARKETS[market].symbol;
  return `${n < 0 ? "−" : ""}${sym}${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
};

/** Port of buildSummary(): the copyable quote text. */
export const quoteSummary = (r: QuoteResult, S: QuoteSelection, client: string) => {
  const m = MARKETS[S.market];
  const t: string[] = [];
  t.push(`Quote for ${client || "[client name]"}`);
  t.push(`Market: ${m.label}, prices in ${m.currency}, excluding VAT`);
  t.push("");
  const glL = r.lines.filter((l) => l.brand === "gl");
  const arL = r.lines.filter((l) => l.brand === "ar");
  if (glL.length) {
    t.push("Gllarix");
    glL.forEach((l) => t.push(`- ${l.name}${l.q > 1 ? ` × ${l.q}` : ""}`));
    if (S.tiers.rec) t.push(`  Includes: ${BY_ID[S.tiers.rec].note}`);
  }
  if (arL.length) {
    if (glL.length) t.push("");
    t.push("Arcadian");
    arL.forEach((l) => t.push(`- ${l.name}${l.q > 1 ? ` × ${l.q}` : ""}`));
  }
  t.push("");
  t.push(`Setup fee: ${money(r.setup, S.market)} (50% at signing, 50% at launch)`);
  if (S.billing === "annual") t.push(`Monthly fee: ${money(r.monthly, S.market)}, prepaid as ${money(r.monthly * ANNUAL_PAID, S.market)} for 12 months`);
  else t.push(`Monthly fee: ${money(r.monthly, S.market)} from launch${S.pilot && r.monthly > 0 ? " (first month free; founding rate locked for 12 months)" : ""}`);
  if (r.mins) t.push(`Includes ${r.mins.toLocaleString("en-US")} minutes of AI calls per month; extra minutes at ${m.symbol}${S.overRate.toFixed(2)} per minute`);
  t.push(`First-year total: ${money(r.firstYear, S.market)}${r.mins ? " (before any extra minutes)" : ""}`);
  t.push("");
  t.push(
    `Not included: ${glL.length ? (arL.length ? "SMS registration fees, hosting, domains, 3D asset licences and travel" : "SMS registration fees, hosting and domains") : "hosting, domains, 3D asset licences and travel"}, billed to you directly by the providers.`,
  );
  t.push(`Quote valid for ${QUOTE_VALID_DAYS} days.`);
  return t.join("\n");
};

export const formatMoney = money;

/** Selection for a deal's existing item codes (M4 deals carry ["rec_m"] etc.). */
export const selectionFromItems = (items: string[], market: MarketId, pilot: boolean): QuoteSelection => {
  const s = emptySelection(market);
  s.pilot = pilot;
  for (const code of items) {
    const it = BY_ID[code];
    if (!it) continue;
    const group = BRANDS.flatMap((b) => b.groups).find((g) => g.id === it.group)!;
    if (group.type === "tier") s.tiers[group.id] = code;
    else s.qty[code] = (s.qty[code] ?? 0) + 1;
  }
  return s;
};

/** Item codes of a selection (for the deal's items list). */
export const selectionItems = (s: QuoteSelection) => [...Object.values(s.tiers), ...Object.entries(s.qty).filter(([, q]) => q > 0).map(([k]) => k)];
