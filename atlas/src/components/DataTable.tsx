import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, ICONS } from "@/components/ui/primitives";

/**
 * The one table for lists of records (Leads, Deals, Tasks, Time). Columns are data: header, width, how to render a
 * cell, and optionally how to sort it. The table adds sorting, a column picker (remembered per table), groups that
 * fold, row selection, and rows you can open with a click or Enter.
 */
export interface Column<T> {
  key: string;
  header: string;
  icon?: string;
  /** CSS grid track, e.g. "minmax(160px,1.6fr)" or "120px". */
  width: string;
  render: (row: T, index: number) => ReactNode;
  /** Client-side sort value. With a controlled `sort`, any column with `sortable` gets a sort button instead. */
  sortValue?: (row: T) => string | number | null;
  sortable?: boolean;
  align?: "left" | "right";
  /** Shown in the column picker. The first column is never hideable. */
  hideable?: boolean;
  defaultHidden?: boolean;
  cellClassName?: string;
}

export interface TableGroup<T> {
  key: string;
  header: ReactNode;
  rows: T[];
  /** Rendered under the group's rows, e.g. an inline "New task". */
  after?: ReactNode;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

interface Props<T> {
  /** Used to remember hidden columns: "leads", "deals"… */
  id: string;
  label: string;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rows?: T[];
  groups?: TableGroup<T>[];
  collapsed?: Set<string>;
  onToggleGroup?: (key: string) => void;
  /** Controlled sort (server-side lists). Without it, columns with sortValue sort in the browser. */
  sort?: SortState;
  onSort?: (key: string) => void;
  defaultSort?: SortState;
  /** Opening a row: a route, or a handler. Clicks on links, buttons and fields inside the row don't open it. */
  rowHref?: (row: T) => string;
  onOpen?: (row: T) => void;
  selection?: {
    isSelected: (key: string) => boolean;
    toggle: (key: string, index: number, shift: boolean) => void;
    allSelected: boolean;
    toggleAll: () => void;
    /** "hover" shows row checkboxes on hover only (Notion style). */
    reveal?: "always" | "hover";
    /** Screen-reader label per row, e.g. "Select Acme Plumbing". */
    label?: (row: T) => string;
  };
  focusedKey?: string | null;
  variant?: "card" | "plain";
  minWidth?: number;
  rowHeight?: number;
  rowClassName?: (row: T, index: number) => string;
  rowStyle?: (row: T) => CSSProperties | undefined;
  empty?: ReactNode;
  footer?: ReactNode;
}

const STORE = (id: string) => `atlas-table-${id}`;
const readHidden = (id: string, cols: { key: string; defaultHidden?: boolean }[]) => {
  try {
    const raw = localStorage.getItem(STORE(id));
    if (raw) return new Set<string>(JSON.parse(raw) as string[]);
  } catch {
    // storage blocked: fall back to defaults
  }
  return new Set(cols.filter((c) => c.defaultHidden).map((c) => c.key));
};

const interactive = (el: EventTarget | null) => el instanceof Element && !!el.closest("a,button,input,select,textarea,label,[role=menu]");

export function DataTable<T>(p: Props<T>) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(p.id, p.columns));
  const [localSort, setLocalSort] = useState<SortState | null>(p.defaultSort ?? null);
  const [picker, setPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const plain = p.variant === "plain";
  // A different table id (e.g. Time grouped another way) has its own remembered columns.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setHidden(readHidden(p.id, p.columns)), [p.id]);

  useEffect(() => {
    if (!picker) return;
    const close = (e: globalThis.MouseEvent) => !pickerRef.current?.contains(e.target as Node) && setPicker(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [picker]);

  const cols = p.columns.filter((c, i) => i === 0 || !hidden.has(c.key));
  const canPick = p.columns.some((c, i) => i > 0 && c.hideable);
  const template = [p.selection ? "36px" : null, ...cols.map((c) => c.width), canPick ? "36px" : null].filter(Boolean).join(" ");
  const minWidth = p.minWidth ?? 720;
  const sort = p.sort ?? localSort;

  const sortRows = useMemo(() => {
    if (p.sort || !localSort) return (rows: T[]) => rows;
    const col = p.columns.find((c) => c.key === localSort.key);
    if (!col?.sortValue) return (rows: T[]) => rows;
    return (rows: T[]) =>
      [...rows].sort((a, b) => {
        const va = col.sortValue!(a);
        const vb = col.sortValue!(b);
        if (va === vb) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
        return localSort.dir === "asc" ? cmp : -cmp;
      });
  }, [p.sort, localSort, p.columns]);

  const clickSort = (c: Column<T>) => {
    if (p.onSort) return p.onSort(c.key);
    // Numbers start high-to-low (biggest deal first), text A to Z.
    const sample = p.rows?.[0] ?? p.groups?.find((g) => g.rows.length)?.rows[0];
    const numeric = sample !== undefined && typeof c.sortValue?.(sample) === "number";
    setLocalSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: numeric ? "desc" : "asc" }));
  };
  const toggleColumn = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
    try {
      localStorage.setItem(STORE(p.id), JSON.stringify([...next]));
    } catch {
      // a convenience only
    }
  };

  const open = (row: T) => (p.onOpen ? p.onOpen(row) : p.rowHref ? navigate(p.rowHref(row)) : undefined);
  const opens = !!(p.onOpen || p.rowHref);
  const border = "border-line-soft";

  let index = -1;
  const renderRow = (row: T) => {
    index += 1;
    const i = index;
    const key = p.rowKey(row);
    const selected = p.selection?.isSelected(key) ?? false;
    const focused = p.focusedKey === key;
    return (
      <div
        key={key}
        role="row"
        aria-selected={p.selection ? selected : undefined}
        tabIndex={opens ? 0 : undefined}
        data-focused={focused || undefined}
        onClick={opens ? (e: MouseEvent) => !interactive(e.target) && open(row) : undefined}
        onKeyDown={opens ? (e: KeyboardEvent) => e.key === "Enter" && e.target === e.currentTarget && open(row) : undefined}
        className={`group grid items-center border-b ${border} text-[13px] ${opens ? "cursor-pointer" : ""} ${selected || focused ? "bg-surface-2" : "hover:bg-surface-2/60"} focus-visible:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 ${plain ? "items-stretch" : "gap-3 px-4"} ${p.rowClassName?.(row, i) ?? ""}`}
        style={{ gridTemplateColumns: template, minWidth, minHeight: p.rowHeight ?? (plain ? 38 : 44), ...p.rowStyle?.(row) }}
      >
        {p.selection ? (
          <span role="cell" className="flex items-center justify-center">
            <input
              type="checkbox"
              aria-label={p.selection.label?.(row) ?? "Select row"}
              checked={selected}
              onChange={() => undefined}
              onClick={(e) => p.selection!.toggle(key, i, e.shiftKey)}
              className={`h-3.5 w-3.5 accent-[var(--cyan)] ${p.selection.reveal === "hover" && !selected ? "opacity-0 focus:opacity-100 group-hover:opacity-100" : ""}`}
            />
          </span>
        ) : null}
        {cols.map((c, ci) => (
          <span
            key={c.key}
            role="cell"
            className={`min-w-0 ${plain && ci > 0 ? "flex items-center border-l border-line-soft px-2.5" : plain ? "flex items-center pr-2.5" : ""} ${c.align === "right" ? "justify-self-end text-right" : ""} ${c.cellClassName ?? ""}`}
          >
            {c.render(row, i)}
          </span>
        ))}
        {canPick ? <span role="cell" /> : null}
      </div>
    );
  };

  const header = (
    <div role="row" className={`grid items-center border-b ${plain ? "border-t border-line-soft" : "border-line bg-surface-2/60 px-4"} text-[12px] text-text-3 ${plain ? "" : "gap-3"}`} style={{ gridTemplateColumns: template, minWidth, height: plain ? 34 : 38 }}>
      {p.selection ? (
        <span role="columnheader" className="flex items-center justify-center">
          <input type="checkbox" aria-label="Select all" checked={p.selection.allSelected} onChange={p.selection.toggleAll} className="h-3.5 w-3.5 accent-[var(--cyan)]" />
        </span>
      ) : null}
      {cols.map((c, ci) => {
        const sortable = !!(c.sortValue || (p.onSort && c.sortable));
        const active = sort?.key === c.key;
        const label = (
          <>
            {c.icon ? <Icon d={c.icon} size={14} /> : null}
            {c.header}
            {active ? <span aria-hidden="true">{sort!.dir === "desc" ? "↓" : "↑"}</span> : null}
          </>
        );
        return (
          <span
            key={c.key}
            role="columnheader"
            aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
            className={`flex min-w-0 items-center ${plain && ci > 0 ? "h-full border-l border-line-soft px-2.5" : ""} ${c.align === "right" ? "justify-end" : ""}`}
          >
            {sortable ? (
              <button type="button" onClick={() => clickSort(c)} className={`flex items-center gap-1.5 truncate hover:text-text ${active ? "text-text-2" : ""}`}>
                {label}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 truncate">{label}</span>
            )}
          </span>
        );
      })}
      {canPick ? (
        <span role="columnheader" className="relative flex items-center justify-center" ref={pickerRef}>
          <button type="button" aria-label="Choose columns" aria-expanded={picker} title="Columns" onClick={() => setPicker((x) => !x)} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-surface-2 hover:text-text">
            <Icon d="M4 6h16M4 12h16M4 18h16M9 4v16M15 4v16" size={14} />
          </button>
          {picker ? (
            <div role="menu" aria-label="Columns" className="absolute right-0 top-8 z-30 flex w-52 flex-col gap-0.5 rounded-lg border border-line-strong bg-surface p-1.5 text-[13px] text-text shadow-pop">
              {p.columns.slice(1).filter((c) => c.hideable).map((c) => (
                <label key={c.key} role="menuitemcheckbox" aria-checked={!hidden.has(c.key)} className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-surface-2">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--cyan)]" checked={!hidden.has(c.key)} onChange={() => toggleColumn(c.key)} />
                  {c.header}
                </label>
              ))}
            </div>
          ) : null}
        </span>
      ) : null}
    </div>
  );

  const hasRows = p.groups ? p.groups.some((g) => g.rows.length) : !!p.rows?.length;
  return (
    <div className={`min-w-0 overflow-x-auto ${plain ? "" : "card"}`} role="table" aria-label={p.label}>
      {header}
      {p.groups
        ? p.groups.map((g) => {
            const folded = p.collapsed?.has(g.key) ?? false;
            return (
              <div key={g.key} role="rowgroup" aria-label={typeof g.header === "string" ? g.header : undefined}>
                <button
                  type="button"
                  aria-expanded={!folded}
                  onClick={() => p.onToggleGroup?.(g.key)}
                  className={`flex w-full items-center gap-2 text-left text-[13px] ${plain ? "mt-5 h-9 px-1.5 first:mt-3" : `border-b ${border} bg-surface-2/40 px-4 py-2`}`}
                  style={{ minWidth }}
                >
                  <Icon d={ICONS.chevronRight} size={14} className={`text-text-3 transition-transform ${folded ? "" : "rotate-90"}`} />
                  {g.header}
                </button>
                {folded ? null : sortRows(g.rows).map(renderRow)}
                {folded ? null : g.after}
              </div>
            );
          })
        : sortRows(p.rows ?? []).map(renderRow)}
      {!hasRows && p.empty ? <div className="p-6">{p.empty}</div> : null}
      {p.footer ? (
        <div className="px-4 py-3 text-[12px] text-text-3" style={{ minWidth }}>
          {p.footer}
        </div>
      ) : null}
    </div>
  );
}
