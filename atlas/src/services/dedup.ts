import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

/** Normalise any phone format to E.164, using the row's country (or a default) for national numbers. */
export const normalizePhone = (raw: string | null | undefined, defaultCountry: string | null = "US"): string | null => {
  const value = raw?.trim();
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value, (defaultCountry ?? "US") as CountryCode);
  if (!parsed || !parsed.isPossible()) return null;
  return parsed.number;
};

/** "mobile" / "landline" / "unknown" for an E.164 number. */
export const phoneType = (e164: string | null): "mobile" | "landline" | "unknown" => {
  if (!e164) return "unknown";
  const t = parsePhoneNumberFromString(e164)?.getType();
  if (t === "MOBILE") return "mobile";
  if (t === "FIXED_LINE") return "landline";
  return "unknown";
};

/** Digits only, for phone search with any formatting. */
export const phoneDigits = (raw: string) => raw.replace(/\D/g, "");

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com",
  "aol.com", "msn.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "web.de", "yandex.com", "mail.com",
]);

/**
 * Domain from a website or an email: lower case, no scheme, "www.", port, path or trailing dot.
 * Free-mail domains return null, because two companies sharing gmail.com are not duplicates.
 */
export const normalizeDomain = (raw: string | null | undefined): string | null => {
  let value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("@")) value = value.split("@").pop() ?? "";
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\d?\./, "");
  value = value.split(/[/?#]/)[0].split(":")[0].replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) return null;
  return FREE_MAIL.has(value) ? null : value;
};

export const normalizeEmail = (raw: string | null | undefined): string | null => {
  const value = raw?.trim().toLowerCase();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
};

const LEGAL_SUFFIXES = new Set([
  "llc", "inc", "incorporated", "ltd", "limited", "co", "company", "corp", "corporation", "plc", "llp", "lp",
  "gmbh", "ag", "sa", "sarl", "srl", "bv", "nv", "fze", "fzco", "fzllc", "pty", "the", "and",
]);

/** Company-name tokens in original order, without legal suffixes or punctuation. */
const nameTokens = (raw: string | null | undefined): string[] =>
  (raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b([a-z])\/([a-z])\b/g, "$1$2") // A/C → ac
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !LEGAL_SUFFIXES.has(t));

/** Company name for comparison: "Ridgeway Heating & Air, LLC" → "air heating ridgeway" (sorted tokens). */
export const normalizeName = (raw: string | null | undefined): string => [...nameTokens(raw)].sort().join(" ");

export interface PreparedName {
  sorted: string;
  /** Tokens in original order without spaces: "Sun Coast" and "Suncoast" both become "suncoast…". */
  compact: string;
  tokens: Set<string>;
  /** Character counts of `compact` (a–z, 0–9), for a cheap upper bound before the full comparison. */
  counts: Uint8Array;
}

const charIndex = (c: number) => (c >= 97 && c <= 122 ? c - 97 : c >= 48 && c <= 57 ? c - 22 : -1);

export const prepareName = (raw: string | null | undefined): PreparedName => {
  const tokens = nameTokens(raw);
  const compact = tokens.join("");
  const counts = new Uint8Array(36);
  for (let i = 0; i < compact.length; i += 1) {
    const k = charIndex(compact.charCodeAt(i));
    if (k >= 0 && counts[k] < 255) counts[k] += 1;
  }
  return { sorted: [...tokens].sort().join(" "), compact, tokens: new Set(tokens), counts };
};

/**
 * Upper bound of preparedSimilarity: a common subsequence can't use more of a character than both names contain.
 * Exact (never below the real score), so pairs under the threshold can be skipped without changing any result.
 */
export const similarityUpperBound = (a: PreparedName, b: PreparedName) => {
  let overlap = 0;
  for (let k = 0; k < 36; k += 1) overlap += Math.min(a.counts[k], b.counts[k]);
  const spacesA = a.sorted.length - a.compact.length;
  const spacesB = b.sorted.length - b.compact.length;
  const compactBound = a.compact.length + b.compact.length ? Math.round((200 * overlap) / (a.compact.length + b.compact.length)) : 100;
  const sortedBound = a.sorted.length + b.sorted.length ? Math.round((200 * (overlap + Math.min(spacesA, spacesB))) / (a.sorted.length + b.sorted.length)) : 100;
  return Math.max(compactBound, sortedBound);
};

export const normalizeCity = (raw: string | null | undefined) =>
  (raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Longest common subsequence length (two-row DP). */
const lcs = (a: string, b: string) => {
  if (!a.length || !b.length) return 0;
  let prev = new Uint16Array(b.length + 1);
  let cur = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = ca === b.charCodeAt(j - 1) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
};

const ratio = (s: string, t: string) => (s.length + t.length ? Math.round((200 * lcs(s, t)) / (s.length + t.length)) : 100);

/** Cheap blocking: only names sharing a word, or starting alike, are compared in full. */
export const mightMatch = (a: PreparedName, b: PreparedName) => {
  if (a.compact.slice(0, 4) === b.compact.slice(0, 4)) return true;
  for (const t of a.tokens) if (t.length > 2 && b.tokens.has(t)) return true;
  return false;
};

/**
 * 0–100 similarity of two company names, like rapidfuzz's token_sort_ratio
 * (normalised Indel similarity on sorted tokens), also comparing without spaces ("Gulf Breeze" vs "Gulfbreeze").
 */
export const preparedSimilarity = (a: PreparedName, b: PreparedName) => {
  if (!a.sorted && !b.sorted) return 100;
  if (!a.sorted || !b.sorted) return 0;
  return Math.max(ratio(a.sorted, b.sorted), ratio(a.compact, b.compact));
};

export const nameSimilarity = (a: string, b: string) => preparedSimilarity(prepareName(a), prepareName(b));

export const FUZZY_THRESHOLD = 90;
