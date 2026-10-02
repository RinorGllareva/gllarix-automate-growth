/**
 * Price book v2, ported 1:1 from pricing/price-calculator.html (MARKETS, BRANDS, BUNDLE, CROSS, PILOT_*, RUSH,
 * ANNUAL_PAID, COMM_*, DEF). services/pricing.ts ports compute(); the parity tests fail if the two drift apart.
 */
export const PRICE_BOOK_VERSION = "v2";

export type MarketId = "us" | "we" | "ch" | "xk";

export interface Market {
  id: MarketId;
  label: string;
  currency: "USD" | "EUR";
  symbol: "$" | "€";
  mult: number;
  hint: string;
}

export const MARKETS: Record<MarketId, Market> = {
  us: { id: "us", label: "US & Canada", currency: "USD", symbol: "$", mult: 1, hint: "Prices in USD at list." },
  we: { id: "we", label: "Western Europe", currency: "EUR", symbol: "€", mult: 1, hint: "DE/AT, UK, Nordics, Benelux. Same numbers as the US list, in EUR." },
  ch: { id: "ch", label: "Switzerland", currency: "EUR", symbol: "€", mult: 1.25, hint: "125% of list: Swiss rates run ~30% above Germany." },
  xk: { id: "xk", label: "Kosovo & Albania", currency: "EUR", symbol: "€", mult: 0.5, hint: "Local market: 50% of list, in EUR." },
};

export type BrandCode = "gl" | "ar";

export interface BookItem {
  id: string;
  name: string;
  setup: number;
  monthly: number;
  hours: number;
  mins?: number;
  max?: number;
  unit?: string;
  badge?: string;
  note?: string;
  warn?: boolean;
  requires?: string;
  includedWith?: string[];
}

export interface BookGroup {
  id: string;
  title: string;
  sub: string;
  type: "tier" | "addon" | "days";
  requires?: string;
  items?: BookItem[];
  rate?: number;
  maintPct?: number;
  maintMin?: number;
  note?: string;
}

export interface BookBrand {
  id: BrandCode;
  name: string;
  line: string;
  third: string;
  groups: BookGroup[];
}

export const BRANDS: BookBrand[] = [
  {
    id: "gl",
    name: "Gllarix",
    line: "AI that answers calls, books clients and follows up.",
    third: "Gllarix: AI and phone minutes are included up to the tier limit; extra minutes are billed at the overage rate. SMS registration fees stay client-paid.",
    groups: [
      {
        id: "rec",
        title: "AI Receptionist",
        sub: "choose one",
        type: "tier",
        items: [
          { id: "rec_s", name: "Starter", setup: 1000, monthly: 399, hours: 4, mins: 500, note: "500 minutes included (~200 calls), 1 number, English. Takes messages and sends a booking link." },
          { id: "rec_m", name: "Standard", setup: 1500, monthly: 699, hours: 6, mins: 1250, badge: "Lead offer", note: "1,250 minutes included (~500 calls). Books into the calendar, missed-call text-back, CRM sync, 2 languages." },
          { id: "rec_p", name: "Pro", setup: 2500, monthly: 1199, hours: 9, mins: 3000, note: "3,000 minutes included (~1,200 calls), up to 3 numbers, custom call flows, 3 languages, priority support." },
        ],
      },
      {
        id: "gadd",
        title: "Gllarix add-ons",
        sub: "any combination",
        type: "addon",
        items: [
          { id: "mctb", name: "Missed-call text-back", setup: 300, monthly: 79, hours: 1, includedWith: ["rec_m", "rec_p"], note: "Included in Standard and Pro." },
          { id: "stl", name: "Speed-to-lead responder", setup: 1000, monthly: 249, hours: 3, note: "Texts or calls every web-form or ads lead within about 60 seconds and books them." },
          { id: "rev", name: "Review automation", setup: 500, monthly: 129, hours: 2, note: "Asks every customer for a Google review after each job and drafts replies. Never filters who gets asked." },
          { id: "chat", name: "AI website chat assistant", setup: 1000, monthly: 199, hours: 3, note: "Answers questions and captures leads on the client's website." },
          { id: "loc", name: "Extra location or number", setup: 500, monthly: 199, hours: 1.5, max: 10, unit: "each" },
          { id: "lang", name: "Extra language", setup: 400, monthly: 99, hours: 1, max: 5, unit: "each" },
          { id: "alb", name: "Albanian language (beta)", setup: 600, monthly: 149, hours: 3, warn: true, note: "Sell only after the Albanian speech-recognition test passes." },
          { id: "crm", name: "Custom CRM integration", setup: 750, monthly: 0, hours: 3, note: "For CRMs outside the standard connectors." },
          { id: "react", name: "Old-lead reactivation campaign", setup: 1500, monthly: 0, hours: 3, max: 4, unit: "campaign", warn: true, note: "One-off, up to 1,000 contacts. The client must prove consent for texts." },
        ],
      },
    ],
  },
  {
    id: "ar",
    name: "Arcadian",
    line: "Landing pages, 3D property visualization and software we build.",
    third: "Arcadian: hosting, domains, 3D asset licences and travel for on-site 360° capture are billed to the client directly.",
    groups: [
      {
        id: "lp",
        title: "Landing page",
        sub: "choose one",
        type: "tier",
        items: [
          { id: "lp_1", name: "Single page", setup: 900, monthly: 49, hours: 6, note: "Template-based page with quote form and analytics. Client provides copy and photos." },
          { id: "lp_2", name: "Conversion page", setup: 1800, monthly: 79, hours: 12, note: "Custom design, booking, CRM connection, speed-optimized." },
          { id: "lp_3", name: "Lead site, up to 5 pages", setup: 3200, monthly: 129, hours: 20, note: "Service pages, project gallery and quote flow." },
        ],
      },
      {
        id: "lpadd",
        title: "Landing page add-ons",
        sub: "needs a landing page",
        type: "addon",
        requires: "lp",
        items: [
          { id: "lp_page", name: "Extra page", setup: 300, monthly: 0, hours: 3, max: 10, unit: "each" },
          { id: "lp_lang", name: "Extra language version", setup: 450, monthly: 15, hours: 3, max: 4, unit: "each" },
          { id: "lp_ab", name: "A/B test variant", setup: 400, monthly: 0, hours: 3, max: 3, unit: "each" },
        ],
      },
      {
        id: "d3",
        title: "3D property visualization",
        sub: "choose one",
        type: "tier",
        items: [
          { id: "d3_b", name: "Interactive 3D building", setup: 6500, monthly: 249, hours: 30, note: "Explore the building and its floors in the browser. Needs usable 3D files or the modelling add-on." },
          { id: "d3_p", name: "3D sales platform", setup: 12000, monthly: 449, hours: 60, badge: "Proposed SaaS", note: "3D building, unit picker with live availability, lead page and admin panel." },
        ],
      },
      {
        id: "d3add",
        title: "3D add-ons",
        sub: "tours work alone; the rest need a 3D product",
        type: "addon",
        items: [
          { id: "tour", name: "Virtual 360° tour", setup: 500, monthly: 79, hours: 4, max: 20, unit: "location", note: "Needs on-site 360° capture; travel billed separately." },
          { id: "d3_ph", name: "Extra building or phase", setup: 3500, monthly: 99, hours: 15, max: 10, unit: "each", requires: "d3" },
          { id: "d3_int", name: "Interior 3D per apartment type", setup: 900, monthly: 0, hours: 5, max: 20, unit: "type", requires: "d3" },
          { id: "d3_mod", name: "3D modelling from 2D plans", setup: 2500, monthly: 0, hours: 12, max: 10, unit: "building", requires: "d3", note: "Only when the developer has no usable 3D files." },
        ],
      },
      {
        id: "sw",
        title: "Custom software",
        sub: "scope still open",
        type: "days",
        rate: 700,
        maintPct: 1.5,
        maintMin: 99,
        note: "Setup = build days × day rate. Monthly maintenance = 1.5% of the build per month, minimum 99.",
      },
    ],
  },
];

export const BUNDLE = { need: ["stl", "rev"], pct: 10 }; // with any receptionist tier: 10% off Gllarix monthly
export const CROSS = { pct: 20 }; // any receptionist + landing page: 20% off landing page setup
export const PILOT_SETUP = 0.4;
export const PILOT_MONTHLY = 0.75;
export const RUSH = 0.25;
export const ANNUAL_PAID = 10;
export const COMM_PCT = 0.1;
export const COMM_MIN = 100;
export const COMM_MONTHS = 6;
export const DEFAULTS = { overRate: 0.25, usagePct: 60, costMin: 0.1, rate: 700, wkh: 12 };
/** Max pilots per brand (context/02). */
export const PILOTS_PER_BRAND = 2;
/** Extra discount: the BDR none; up to 10% one founder (admin/closer); more needs both founders. Hard cap 30 (calculator). */
export const DISCOUNT_SELF_MAX = 10;
export const DISCOUNT_HARD_MAX = 30;
export const QUOTE_VALID_DAYS = 30;
export const DEPOSIT_SHARE = 0.5;

export interface ItemRef extends BookItem {
  brand: BrandCode;
  group: string;
}

/** Every item with its brand and group (the calculator's byId). */
export const BY_ID: Record<string, ItemRef> = Object.fromEntries(
  BRANDS.flatMap((b) => b.groups.flatMap((g) => (g.items ?? []).map((it) => [it.id, { ...it, brand: b.id, group: g.id }]))),
);

// ---- M4 compatibility: flat items and list prices for simple deals.

export interface PriceItem {
  code: string;
  brand: "gllarix" | "arcadian";
  name: string;
  setup: number;
  monthly: number;
}

export const PRICE_ITEMS: PriceItem[] = Object.values(BY_ID).map((it) => ({
  code: it.id,
  brand: it.brand === "gl" ? "gllarix" : "arcadian",
  name: `${BRANDS.find((b) => b.id === it.brand)!.groups.find((g) => g.id === it.group)!.title} · ${it.name}`.replace("Gllarix add-ons · ", "").replace("3D property visualization · ", ""),
  setup: it.setup,
  monthly: it.monthly,
}));

/** The lead offer per list (context/03): Gllarix Standard for trades, the 3D sales platform for developers. */
export const LEAD_OFFER: Record<"trades" | "developers", string> = { trades: "rec_m", developers: "d3_p" };

export const marketForCountry = (country: string | null): MarketId => {
  if (country === "US" || country === "CA") return "us";
  if (country === "CH") return "ch";
  if (country === "XK" || country === "AL") return "xk";
  return "we";
};

/** List price of items in a market, in minor units; pilot applies setup ×0.4 and monthly ×0.75; setup rounds to 10. */
export const listPriceMinor = (codes: string[], market: MarketId, pilot = false) => {
  const m = MARKETS[market];
  let setup = 0;
  let monthly = 0;
  for (const code of codes) {
    const item = BY_ID[code];
    if (!item) throw new Error(`Unknown price item: ${code}`);
    setup += item.setup * m.mult;
    monthly += item.monthly * m.mult;
  }
  if (pilot) {
    setup *= PILOT_SETUP;
    monthly *= PILOT_MONTHLY;
  }
  return { setupMinor: Math.round(setup / 10) * 10 * 100, monthlyMinor: Math.round(monthly) * 100, currency: m.currency };
};
