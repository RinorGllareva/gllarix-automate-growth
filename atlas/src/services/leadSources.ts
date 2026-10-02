import { CONNECTORS, type ConnectorId, type SearchPlan } from "@/config/leadSources";
import type { ImportRow } from "./importPlan";
import { normalizeDomain, normalizePhone } from "./dedup";
import { hash01 } from "./usagePortal";

/** LeadSource (CRM_BUILD_PROMPT M8): each connector searches one official API, page by page, at a known cost. */
export interface SourceRecord {
  /** The provider's id (Places place_id, Companies House number, Zefix UID). */
  externalId: string;
  companyName: string;
  phone: string | null;
  website: string | null;
  contactName: string | null;
  contactTitle: string | null;
  city: string | null;
  region: string | null;
  country: string;
  industry: string;
  reviewsCount: number | null;
  rating: number | null;
  employeesEst: number | null;
  /** Places: up to 5 review texts the API returns with the place. */
  reviewSnippets?: string[];
  /** Registries: incorporation date (developers set up a new company per scheme). */
  incorporatedAt?: string | null;
}

/** Reviews that complain about unanswered calls (scoring rule reviews_missed_calls). */
export const MISSED_CALL_RE = /(no ?one|nobody) (answered|picks? up|called (me )?back)|went (straight )?to voicemail|never (answered|called back|returned my call)|couldn'?t (get through|reach)|don'?t answer (the|their) phone/i;

/**
 * Signals a source record carries before any website audit: missed-call complaints in Places reviews, and for developers
 * a company incorporated in the last 12 months (a new scheme company) as an active-project hint.
 */
export const recordSignals = (r: SourceRecord, now: number): { key: string; value: boolean; source: string }[] => {
  const out: { key: string; value: boolean; source: string }[] = [];
  if (r.reviewSnippets?.length) out.push({ key: "reviews_missed_calls", value: r.reviewSnippets.some((t) => MISSED_CALL_RE.test(t)), source: "places_reviews" });
  if (r.incorporatedAt !== undefined && r.incorporatedAt !== null) {
    const recent = now - new Date(r.incorporatedAt).getTime() < 365 * 86_400_000;
    out.push({ key: "project_launch_12m", value: recent, source: `registry: incorporated ${r.incorporatedAt.slice(0, 10)}` });
  }
  return out;
};

export interface SourcePage {
  records: SourceRecord[];
  nextCursor: string | null;
  costMinor: number;
  cached: boolean;
}

export interface LeadSource {
  id: Exclude<ConnectorId, "csv_template">;
  search(plan: SearchPlan, cursor: string | null): Promise<SourcePage>;
}

export class SourceError extends Error {
  constructor(
    public connector: ConnectorId,
    message: string,
  ) {
    super(message);
  }
}

export class CapReachedError extends Error {
  constructor(
    public connector: ConnectorId,
    public spentMinor: number,
    public capMinor: number,
  ) {
    super(`${CONNECTORS[connector].label}: monthly cap reached (${(spentMinor / 100).toFixed(2)} of ${(capMinor / 100).toFixed(2)} USD)`);
  }
}

export interface CacheEntry {
  key: string;
  page: Omit<SourcePage, "cached" | "costMinor">;
  fetchedAt: string;
}

export interface CostGuard {
  /** Spent this month (USD cents) and the cap; cap 0 means free / no cap. */
  spent(connector: ConnectorId): number;
  cap(connector: ConnectorId): number;
  record(connector: ConnectorId, costMinor: number, note: string): void;
}

export const cacheKey = (connector: ConnectorId, plan: SearchPlan, cursor: string | null) => `${connector}|${plan.query}|${plan.country}|${plan.region ?? ""}|${cursor ?? "0"}`;

/**
 * Cache + cost cap around a connector: a cached page (younger than the connector's cacheDays) costs nothing;
 * a paid request that would pass the monthly cap is refused before it is made.
 */
export const guarded = (source: LeadSource, opts: { cache: CacheEntry[]; guard: CostGuard; now: () => number }): LeadSource => ({
  id: source.id,
  async search(plan, cursor) {
    const cfg = CONNECTORS[source.id];
    const key = cacheKey(source.id, plan, cursor);
    const hit = opts.cache.find((c) => c.key === key);
    if (hit && opts.now() - new Date(hit.fetchedAt).getTime() < cfg.cacheDays * 86_400_000) return { ...hit.page, cached: true, costMinor: 0 };
    const cap = opts.guard.cap(source.id);
    const spent = opts.guard.spent(source.id);
    if (cfg.costPerRequestMinor > 0 && cap >= 0 && spent + cfg.costPerRequestMinor > cap) throw new CapReachedError(source.id, spent, cap);
    const page = await source.search(plan, cursor);
    if (page.costMinor > 0) opts.guard.record(source.id, page.costMinor, `${plan.label} · page ${cursor ?? "0"}`);
    const entry = { key, page: { records: page.records, nextCursor: page.nextCursor }, fetchedAt: new Date(opts.now()).toISOString() };
    const i = opts.cache.findIndex((c) => c.key === key);
    if (i >= 0) opts.cache[i] = entry;
    else opts.cache.push(entry);
    return { ...page, cached: false };
  },
});

/** A source record as an import row, so the list build reuses the import's normalisation and dedup (planImport). */
export const recordToRow = (r: SourceRecord, row: number): ImportRow => {
  const phone = normalizePhone(r.phone, r.country);
  const domain = normalizeDomain(r.website);
  const [firstName = "", ...rest] = (r.contactName ?? "").split(/\s+/).filter(Boolean);
  const errors: string[] = [];
  if (!r.companyName.trim()) errors.push("Missing company name");
  if (!phone && !domain) errors.push("No phone or website to reach them");
  return {
    row, raw: { externalId: r.externalId }, companyName: r.companyName.trim(), phone, domain, email: null, firstName, lastName: rest.join(" "),
    title: r.contactTitle, city: r.city, region: r.region, country: r.country, industry: r.industry, reviewsCount: r.reviewsCount, rating: r.rating, notes: null, errors,
  };
};

// ---------------------------------------------------------------- fake connectors (demo and tests)

const FIRST = ["Summit", "Blue Ridge", "Lone Star", "Gulf Coast", "Desert", "Peach State", "Coastal", "Precision", "Reliable", "Patriot", "Sunbelt", "Allied", "Premier", "Express", "Ace", "Liberty", "Canyon", "Magnolia", "Cypress", "Redwood"];
const SECOND = ["Valley", "Hill", "Point", "Ridge", "Creek", "Lakes", "Bay", "Oak", "Pine", "Harbor", "Mesa", "Grove", "Field", "Brook", "Stone", "Union"];
const TRADE_WORD: Record<string, string[]> = {
  hvac: ["Heating & Air", "Air Conditioning", "Comfort Systems", "HVAC Services"],
  plumbing: ["Plumbing", "Plumbing & Drain", "Rooter & Plumbing", "Plumbing Co."],
  roofing: ["Roofing", "Roofing & Exteriors", "Roof Systems", "Roofing Co."],
  electrical: ["Electric", "Electrical Services", "Electrical Contractors", "Power & Light"],
  property_developer: ["Developments", "Homes", "Properties", "Real Estate Development"],
};
const CITIES: Record<string, string[]> = {
  TX: ["Houston", "Austin", "Dallas", "San Antonio", "Fort Worth", "El Paso", "Plano", "Lubbock", "Waco", "Tyler"],
  FL: ["Tampa", "Orlando", "Jacksonville", "Miami", "Fort Myers", "Sarasota", "Naples", "Ocala", "Pensacola", "Lakeland"],
  GA: ["Atlanta", "Savannah", "Augusta", "Macon", "Athens", "Columbus", "Marietta", "Roswell", "Valdosta", "Albany"],
  AZ: ["Phoenix", "Tucson", "Mesa", "Scottsdale", "Chandler", "Gilbert", "Tempe", "Peoria", "Yuma", "Flagstaff"],
  GB: ["London", "Manchester", "Birmingham", "Leeds", "Bristol"],
  CH: ["Zürich", "Genève", "Basel", "Lausanne", "Bern"],
  AE: ["Dubai"],
};
const PEOPLE = ["Sarah Collins", "James Whitaker", "Priya Nair", "Lukas Meier", "Emma Rossi", "Omar Haddad", "Claire Dubois", "Tom Hughes"];
const AREA: Record<string, string> = { TX: "713", FL: "813", GA: "404", AZ: "602" };
const MISSED = ["Called twice, nobody answered and no call back.", "Went straight to voicemail on a Saturday.", "Great work once they came, but they never returned my call at first.", "Couldn't get through for two days."];
const GOOD = ["Fast, friendly and fair price.", "Fixed our AC the same day.", "Professional crew, would hire again.", "On time and cleaned up after."];

const fakeRecord = (plan: SearchPlan, i: number): SourceRecord => {
  const h = (k: string) => hash01(`${plan.id}:${i}:${k}`);
  const pick = <T,>(arr: readonly T[], k: string) => arr[Math.floor(h(k) * arr.length)];
  // About 1 in 12 records repeats an earlier business under a slightly different name (same phone): an exact duplicate.
  const dupOf = i > 12 && h("dup") < 0.08 ? Math.floor(h("dupOf") * (i - 1)) : null;
  const base = dupOf === null ? i : dupOf;
  const hb = (k: string) => hash01(`${plan.id}:${base}:${k}`);
  const pickB = <T,>(arr: readonly T[], k: string) => arr[Math.floor(hb(k) * arr.length)];
  const name = `${pickB(FIRST, "first")} ${pickB(SECOND, "second")} ${pickB(TRADE_WORD[plan.industry] ?? TRADE_WORD.hvac, "word")}`;
  const slug = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  const region = plan.region ?? null;
  const city = pickB(CITIES[region ?? plan.country] ?? ["—"], "city");
  const tld = { US: "com", GB: "co.uk", CH: "ch", AE: "ae" }[plan.country] ?? "com";
  const suffix = Math.floor(hb("n") * 900 + 100);
  const phone =
    plan.connector !== "places_api"
      ? null
      : plan.country === "US"
        ? `+1${AREA[region ?? "TX"] ?? "713"}${String(2000000 + Math.floor(hb("ph") * 7_999_999)).padStart(7, "0")}`
        : `+9714${String(Math.floor(hb("ph") * 8_999_999) + 1_000_000)}`;
  const hasWebsite = plan.connector === "places_api" ? hb("web") > 0.12 : hb("web") > 0.3;
  return {
    externalId: `${plan.connector}:${plan.id}:${i}`,
    companyName: dupOf === null ? name : `${name}${h("suffix") > 0.5 ? " LLC" : " Inc."}`,
    phone,
    website: hasWebsite ? `${slug}${suffix}.${tld}` : null,
    contactName: plan.connector === "places_api" ? null : pick(PEOPLE, "person"),
    contactTitle: plan.connector === "places_api" ? null : h("title") > 0.5 ? "Director" : "Managing Director",
    city,
    region,
    country: plan.country,
    industry: plan.industry,
    reviewSnippets: plan.connector === "places_api" && plan.listType === "trades" ? [hb("missed") < 0.35 ? pickB(MISSED, "missedText") : pickB(GOOD, "goodText")] : undefined,
    incorporatedAt: plan.connector === "places_api" ? undefined : new Date(Date.UTC(2026, 9, 1) - Math.floor(hb("inc") * 900) * 86_400_000).toISOString(),
    reviewsCount: plan.connector === "places_api" ? Math.floor(hb("reviews") * 600) : null,
    rating: plan.connector === "places_api" ? Math.round((3.2 + hb("rating") * 1.8) * 10) / 10 : null,
    employeesEst: Math.floor(3 + hb("emp") * 45),
  };
};

/** Deterministic fake connectors: the same query and page always return the same records. Each query has 20 pages. */
export const createFakeSources = (opts: { connected: (id: ConnectorId) => boolean }): Record<LeadSource["id"], LeadSource> => {
  const make = (id: LeadSource["id"]): LeadSource => ({
    id,
    async search(plan, cursor) {
      if (!opts.connected(id)) throw new SourceError(id, `${CONNECTORS[id].label}: not connected (add the API credentials in Admin › Integrations)`);
      const pageNo = cursor ? Number(cursor) : 0;
      const size = CONNECTORS[id].pageSize;
      const records = Array.from({ length: size }, (_, k) => fakeRecord(plan, pageNo * size + k));
      return { records, nextCursor: pageNo < 19 ? String(pageNo + 1) : null, costMinor: CONNECTORS[id].costPerRequestMinor, cached: false };
    },
  });
  return { places_api: make("places_api"), companies_house: make("companies_house"), zefix: make("zefix") };
};
