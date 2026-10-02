import { hasNoAllowedChannel } from "@/config/countryRules";
import type { Company, Suppression } from "@/data/leadTypes";
import {
  FUZZY_THRESHOLD,
  mightMatch,
  similarityUpperBound,
  normalizeCity,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  preparedSimilarity,
  prepareName,
  type PreparedName,
} from "./dedup";

export const IMPORT_FIELDS = [
  { key: "companyName", label: "Company name" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website / domain" },
  { key: "email", label: "Email" },
  { key: "contactName", label: "Contact name" },
  { key: "contactTitle", label: "Role" },
  { key: "city", label: "City" },
  { key: "region", label: "State / region" },
  { key: "country", label: "Country" },
  { key: "industry", label: "Industry" },
  { key: "reviewsCount", label: "Reviews count" },
  { key: "rating", label: "Rating" },
  { key: "notes", label: "Notes" },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
/** CSV header → Atlas field, or null to ignore the column. */
export type ColumnMapping = Record<string, ImportField | null>;

export const MAX_ROWS = 50_000;
export const MAX_BYTES = 20 * 1024 * 1024;

const SYNONYMS: Record<ImportField, string[]> = {
  companyName: ["company", "company name", "business", "business name", "name", "account", "organisation", "organization", "title"],
  phone: ["phone", "phone number", "telephone", "tel", "main phone", "business phone", "international phone number", "formatted phone number"],
  website: ["website", "domain", "url", "web", "site", "homepage"],
  email: ["email", "e-mail", "email address", "contact email"],
  contactName: ["contact", "contact name", "owner", "owner name", "full name", "person"],
  contactTitle: ["role", "title", "job title", "position", "contact title"],
  city: ["city", "town", "locality"],
  region: ["state", "region", "province", "county", "canton", "emirate"],
  country: ["country", "country code"],
  industry: ["industry", "category", "type", "trade", "vertical"],
  reviewsCount: ["reviews", "review count", "reviews count", "user ratings total", "number of reviews"],
  rating: ["rating", "stars", "average rating"],
  notes: ["notes", "note", "comments", "description"],
};

const clean = (h: string) => h.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

/** Auto-map CSV headers by name; each Atlas field is used at most once. */
export const autoMap = (headers: string[]): ColumnMapping => {
  const used = new Set<ImportField>();
  const mapping: ColumnMapping = {};
  // Exact synonym matches first, so "name" doesn't steal "company name".
  for (const pass of ["exact", "contains"] as const) {
    for (const header of headers) {
      if (mapping[header]) continue;
      const h = clean(header);
      const hit = (Object.keys(SYNONYMS) as ImportField[]).find(
        (field) =>
          !used.has(field) &&
          SYNONYMS[field].some((s) => (pass === "exact" ? h === s : h.includes(s) && s.length > 3)),
      );
      mapping[header] = hit ?? null;
      if (hit) used.add(hit);
    }
  }
  return mapping;
};

export const mappingErrors = (mapping: ColumnMapping): string[] => {
  const fields = new Set(Object.values(mapping));
  const errors: string[] = [];
  if (!fields.has("companyName")) errors.push("Map a column to Company name.");
  if (!fields.has("phone") && !fields.has("website")) errors.push("Map a column to Phone or Website / domain.");
  return errors;
};

const COUNTRY_NAMES: Record<string, string> = {
  "united states": "US", usa: "US", us: "US", america: "US", "united kingdom": "GB", uk: "GB", "great britain": "GB",
  england: "GB", scotland: "GB", wales: "GB", switzerland: "CH", schweiz: "CH", suisse: "CH", "united arab emirates": "AE",
  uae: "AE", canada: "CA", germany: "DE", deutschland: "DE", austria: "AT", kosovo: "XK", albania: "AL", ireland: "IE",
  australia: "AU", norway: "NO", sweden: "SE", denmark: "DK",
};

export const normalizeCountry = (raw: string | null | undefined, fallback: string | null): string | null => {
  const v = raw?.trim();
  if (!v) return fallback;
  if (/^[a-z]{2}$/i.test(v)) return v.toUpperCase() === "UK" ? "GB" : v.toUpperCase();
  return COUNTRY_NAMES[v.toLowerCase()] ?? fallback;
};

const INDUSTRY_WORDS: [RegExp, string][] = [
  [/hvac|heating|air ?cond|cooling|\ba\/?c\b|furnace/i, "hvac"],
  [/plumb/i, "plumbing"],
  [/roof/i, "roofing"],
  [/electric/i, "electrical"],
  [/develop|real estate|property|construction|homes|residen/i, "property_developer"],
];

export const normalizeIndustry = (raw: string | null | undefined): string | null => {
  const v = raw?.trim();
  if (!v) return null;
  return INDUSTRY_WORDS.find(([re]) => re.test(v))?.[1] ?? v.toLowerCase().replace(/\s+/g, "_");
};

const num = (raw: string | undefined) => {
  if (!raw?.trim()) return null;
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export interface ImportRow {
  /** 1-based row number in the file (header excluded). */
  row: number;
  raw: Record<string, string>;
  companyName: string;
  phone: string | null;
  domain: string | null;
  email: string | null;
  firstName: string;
  lastName: string;
  title: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  industry: string | null;
  reviewsCount: number | null;
  rating: number | null;
  notes: string | null;
  errors: string[];
}

export const normalizeRow = (
  raw: Record<string, string>,
  row: number,
  mapping: ColumnMapping,
  defaultCountry: string,
): ImportRow => {
  const get = (field: ImportField) => {
    const header = Object.keys(mapping).find((h) => mapping[h] === field);
    return header ? (raw[header] ?? "").trim() : "";
  };
  const country = normalizeCountry(get("country"), defaultCountry);
  const rawPhone = get("phone");
  const phone = normalizePhone(rawPhone, country);
  const email = normalizeEmail(get("email"));
  const domain = normalizeDomain(get("website")) ?? normalizeDomain(email);
  const [firstName = "", ...rest] = get("contactName").split(/\s+/).filter(Boolean);
  const errors: string[] = [];
  const companyName = get("companyName").replace(/\s+/g, " ");
  if (!companyName) errors.push("Missing company name");
  if (!phone && !domain) errors.push(rawPhone ? "Phone isn't a valid number and there's no website" : "Needs a phone or a website");
  return {
    row,
    raw,
    companyName,
    phone,
    domain,
    email,
    firstName,
    lastName: rest.join(" "),
    title: get("contactTitle") || null,
    city: get("city") || null,
    region: get("region") || null,
    country,
    industry: normalizeIndustry(get("industry")),
    reviewsCount: num(get("reviewsCount")),
    rating: num(get("rating")),
    notes: get("notes") || null,
    errors,
  };
};

export interface ExactDuplicate {
  row: ImportRow;
  /** The Atlas company it matches, or the earlier row in this file. */
  match: { kind: "atlas"; company: Company } | { kind: "file"; row: ImportRow };
  on: "phone" | "domain";
}

export interface PossibleDuplicate {
  row: ImportRow;
  match: { kind: "atlas"; company: Company } | { kind: "file"; row: ImportRow };
  score: number;
}

export interface ImportPlan {
  rows: ImportRow[];
  invalid: ImportRow[];
  exact: ExactDuplicate[];
  possible: PossibleDuplicate[];
  /** Rows that are neither invalid nor exact duplicates (includes possible duplicates). */
  candidates: ImportRow[];
  suppressedRows: number[];
  noChannelRows: number[];
}

export interface PlanContext {
  companies: Company[];
  suppression: Suppression[];
}

/**
 * Exact duplicates (same phone or domain, in Atlas or earlier in the file) are skipped.
 * Possible duplicates (fuzzy name ≥ 90 in the same city) need a decision: merge or keep both.
 */
export const planImport = (rows: ImportRow[], ctx: PlanContext): ImportPlan => {
  const byPhone = new Map<string, { kind: "atlas"; company: Company } | { kind: "file"; row: ImportRow }>();
  const byDomain = new Map<string, { kind: "atlas"; company: Company } | { kind: "file"; row: ImportRow }>();
  const byCity = new Map<string, ({ kind: "atlas"; company: Company; name: PreparedName } | { kind: "file"; row: ImportRow; name: PreparedName })[]>();

  for (const company of ctx.companies) {
    const ref = { kind: "atlas" as const, company };
    if (company.phone) byPhone.set(company.phone, ref);
    if (company.domain) byDomain.set(company.domain, ref);
    const city = normalizeCity(company.city);
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push({ ...ref, name: prepareName(company.name) });
  }

  const suppressed = {
    phone: new Set(ctx.suppression.filter((s) => s.type === "phone").map((s) => s.value)),
    email: new Set(ctx.suppression.filter((s) => s.type === "email").map((s) => s.value)),
    domain: new Set(ctx.suppression.filter((s) => s.type === "domain").map((s) => s.value)),
  };

  const plan: ImportPlan = { rows, invalid: [], exact: [], possible: [], candidates: [], suppressedRows: [], noChannelRows: [] };

  for (const row of rows) {
    if (row.errors.length) {
      plan.invalid.push(row);
      continue;
    }
    const phoneHit = row.phone ? byPhone.get(row.phone) : undefined;
    const domainHit = row.domain ? byDomain.get(row.domain) : undefined;
    if (phoneHit || domainHit) {
      plan.exact.push({ row, match: (phoneHit ?? domainHit)!, on: phoneHit ? "phone" : "domain" });
      continue;
    }

    const city = normalizeCity(row.city);
    const name = prepareName(row.companyName);
    let best: PossibleDuplicate | null = null;
    if (city) {
      for (const other of byCity.get(city) ?? []) {
        // Cheap filters before the O(n·m) comparison.
        if (Math.abs(other.name.compact.length - name.compact.length) > Math.max(name.compact.length, other.name.compact.length) * 0.35) continue;
        if (!mightMatch(name, other.name)) continue;
        if (similarityUpperBound(name, other.name) < FUZZY_THRESHOLD) continue; // can't reach the threshold
        const score = preparedSimilarity(name, other.name);
        if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
          best = { row, match: other.kind === "atlas" ? { kind: "atlas", company: other.company } : { kind: "file", row: other.row }, score };
        }
      }
    }
    if (best) plan.possible.push(best);
    plan.candidates.push(row);

    if (
      (row.phone && suppressed.phone.has(row.phone)) ||
      (row.email && suppressed.email.has(row.email)) ||
      (row.domain && suppressed.domain.has(row.domain))
    ) {
      plan.suppressedRows.push(row.row);
    }
    if (hasNoAllowedChannel(row.country)) plan.noChannelRows.push(row.row);

    const ref = { kind: "file" as const, row };
    if (row.phone) byPhone.set(row.phone, ref);
    if (row.domain) byDomain.set(row.domain, ref);
    if (city) {
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city)!.push({ ...ref, name });
    }
  }
  return plan;
};

export type DuplicateDecision = "merge" | "keep";

/** Fill only empty fields of `target` from `source`: merge never overwrites (06_IMPORT.md). */
export const fillEmpty = <T extends object>(target: T, source: Partial<T>): T => {
  const out = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const current = out[key];
    const incoming = source[key];
    const empty = current === null || current === undefined || current === "";
    if (empty && incoming !== null && incoming !== undefined && incoming !== "") out[key] = incoming as T[keyof T];
  }
  return out;
};

/** CSV of failed rows with an error column, for the import report download. */
export const failedRowsCsv = (rows: ImportRow[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0].raw);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [
    [...headers, "error"].map(esc).join(","),
    ...rows.map((r) => [...headers.map((h) => r.raw[h] ?? ""), r.errors.join("; ")].map(esc).join(",")),
  ].join("\n");
};
