import type { ViewFilter, ViewState } from "@/data/foundationTypes";

/** One filterable column of a list: how to read it from a row, and how to filter it. */
export interface ViewField<T> {
  key: string;
  label: string;
  type: "select" | "date" | "number" | "text";
  /** Select: the choices (value + label). Missing = taken from the rows. */
  options?: { value: string; label: string }[];
  get: (row: T) => string | number | null | undefined | string[];
}

export const EMPTY_VIEW: ViewState = { q: "", filters: [], sort: null };

const matches = <T,>(row: T, f: ViewFilter, field: ViewField<T>) => {
  const v = field.get(row);
  switch (field.type) {
    case "select": {
      if (!f.values?.length) return true;
      const have = Array.isArray(v) ? v : v === null || v === undefined ? [] : [String(v)];
      return f.values.some((x) => have.includes(x));
    }
    case "date": {
      const d = v === null || v === undefined ? "" : String(v).slice(0, 10);
      if (!d) return !f.from && !f.to;
      return (!f.from || d >= f.from) && (!f.to || d <= f.to);
    }
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      if (v === null || v === undefined || Number.isNaN(n)) return f.min === undefined && f.max === undefined;
      return (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max);
    }
    default:
      return !f.text || String(v ?? "").toLowerCase().includes(f.text.toLowerCase());
  }
};

/** Search, filters and sort, the same way on every list. */
export const applyView = <T,>(rows: T[], state: ViewState, fields: ViewField<T>[], search: (row: T) => string): T[] => {
  const needle = state.q.trim().toLowerCase();
  let out = rows.filter((r) => (!needle || search(r).toLowerCase().includes(needle)) && state.filters.every((f) => {
    const field = fields.find((x) => x.key === f.key);
    return !field || matches(r, f, field);
  }));
  const sortField = state.sort ? fields.find((x) => x.key === state.sort!.key) : null;
  if (state.sort && sortField) {
    const dir = state.sort.dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const x = sortField.get(a);
      const y = sortField.get(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }
  return out;
};

/** "Status: Open, Waiting" — how a filter reads in its chip. */
export const filterLabel = <T,>(f: ViewFilter, field: ViewField<T> | undefined, optionLabel: (key: string, value: string) => string) => {
  if (!field) return f.key;
  switch (field.type) {
    case "select":
      return `${field.label}: ${(f.values ?? []).map((v) => optionLabel(field.key, v)).join(", ") || "any"}`;
    case "date":
      return `${field.label}: ${f.from ?? "…"} → ${f.to ?? "…"}`;
    case "number":
      return `${field.label}: ${f.min ?? "…"} – ${f.max ?? "…"}`;
    default:
      return `${field.label} contains "${f.text ?? ""}"`;
  }
};

export const isActive = (f: ViewFilter) => !!(f.values?.length || f.from || f.to || f.min !== undefined || f.max !== undefined || f.text);
