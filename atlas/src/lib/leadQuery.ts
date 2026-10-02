import { OPEN_STAGES, STAGES, type ListType, type Stage } from "@/config/leads";
import type { Brand, LeadQuery, SortKey, Tier } from "@/data/leadTypes";

/**
 * Leads list filters live in the URL so views survive a reload and can be shared.
 * Absent param = the default (tier A+B, open stages); "all" = no filter.
 */
export const DEFAULT_TIERS: Tier[] = ["A", "B"];
const TIERS: Tier[] = ["A", "B", "C", "D"];
const LISTS: ListType[] = ["trades", "developers"];
const BRANDS: Brand[] = ["gllarix", "arcadian"];
const SORTS: SortKey[] = ["score", "company", "stage", "owner", "last", "next"];

const list = <T extends string>(params: URLSearchParams, key: string, allowed: readonly T[] | null, fallback: T[]): T[] => {
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (raw === "all" || raw === "") return [];
  const values = raw.split(",").filter(Boolean) as T[];
  return allowed ? values.filter((v) => allowed.includes(v)) : values;
};

export const parseLeadQuery = (params: URLSearchParams): LeadQuery => {
  const sort = params.get("sort") as SortKey | null;
  return {
    tiers: list(params, "tier", TIERS, DEFAULT_TIERS),
    lists: list(params, "list", LISTS, []),
    countries: list(params, "country", null, []),
    stages: list<Stage>(params, "stage", STAGES, OPEN_STAGES),
    owners: list(params, "owner", null, []),
    sources: list(params, "source", null, []),
    brands: list(params, "brand", BRANDS, []),
    q: params.get("q") ?? "",
    sort: sort && SORTS.includes(sort) ? sort : "score",
    dir: params.get("dir") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export const serializeLeadQuery = (q: LeadQuery): URLSearchParams => {
  const p = new URLSearchParams();
  const put = (key: string, values: string[], fallback: string[]) => {
    if (sameSet(values, fallback)) return;
    p.set(key, values.length ? values.join(",") : "all");
  };
  put("tier", q.tiers, DEFAULT_TIERS);
  put("list", q.lists, []);
  put("country", q.countries, []);
  put("stage", q.stages, OPEN_STAGES);
  put("owner", q.owners, []);
  put("source", q.sources, []);
  put("brand", q.brands, []);
  if (q.q) p.set("q", q.q);
  if (q.sort !== "score") p.set("sort", q.sort);
  if (q.dir !== "desc") p.set("dir", q.dir);
  if (q.page > 1) p.set("page", String(q.page));
  return p;
};

export const CLEARED_QUERY: Pick<LeadQuery, "tiers" | "lists" | "countries" | "stages" | "owners" | "sources" | "brands" | "q"> = {
  tiers: [],
  lists: [],
  countries: [],
  stages: [],
  owners: [],
  sources: [],
  brands: [],
  q: "",
};
