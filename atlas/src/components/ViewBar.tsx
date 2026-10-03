import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUser } from "@/auth/AuthContext";
import { useToast } from "@/components/ui/overlay";
import { Icon, ICONS } from "@/components/ui/primitives";
import { data, type PageView, type ViewFilter, type ViewState } from "@/data";
import { EMPTY_VIEW, filterLabel, isActive, type ViewField } from "@/services/views";

/** Closes a popover on an outside click or Escape. */
const usePopover = () => {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return { open, setOpen, ref };
};

const panel = "absolute left-0 top-10 z-40 flex min-w-64 flex-col gap-2 rounded-lg border border-line-strong bg-surface p-3 text-[13px] shadow-pop";

/** The editor for one filter, by field type. Changes apply as you type. */
const FilterEditor = <T,>({ field, filter, onChange, choices }: { field: ViewField<T>; filter: ViewFilter; onChange: (f: ViewFilter) => void; choices: { value: string; label: string }[] }) => {
  if (field.type === "select")
    return (
      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {choices.map((o) => {
          const on = filter.values?.includes(o.value) ?? false;
          return (
            <label key={o.value} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-surface-2">
              <input type="checkbox" checked={on} onChange={() => onChange({ ...filter, values: on ? (filter.values ?? []).filter((v) => v !== o.value) : [...(filter.values ?? []), o.value] })} />
              <span className="truncate">{o.label}</span>
            </label>
          );
        })}
        {!choices.length ? <span className="text-text-3">Nothing to pick from yet.</span> : null}
      </div>
    );
  if (field.type === "date")
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-text-3">From</span>
          <input type="date" className="input h-8" value={filter.from ?? ""} onChange={(e) => onChange({ ...filter, from: e.target.value || undefined })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-text-3">To</span>
          <input type="date" className="input h-8" value={filter.to ?? ""} onChange={(e) => onChange({ ...filter, to: e.target.value || undefined })} />
        </label>
      </div>
    );
  if (field.type === "number")
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-text-3">At least</span>
          <input type="number" className="input h-8" value={filter.min ?? ""} onChange={(e) => onChange({ ...filter, min: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-text-3">At most</span>
          <input type="number" className="input h-8" value={filter.max ?? ""} onChange={(e) => onChange({ ...filter, max: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </label>
      </div>
    );
  return <input autoFocus className="input h-8" placeholder="Contains…" value={filter.text ?? ""} onChange={(e) => onChange({ ...filter, text: e.target.value })} />;
};

interface Props<T> {
  /** Saved views are kept per page: "support", "payments"… */
  page: string;
  fields: ViewField<T>[];
  /** All rows, to offer the values that exist in select filters. */
  rows: T[];
  value: ViewState;
  onChange: (v: ViewState) => void;
  placeholder?: string;
  /** Extra controls on the right (export, a toggle…). */
  children?: ReactNode;
}

/**
 * One view bar for every list (docs/pages/00-PAGE-STANDARD.md): search, filter chips, sort from the table header,
 * and saved views per person, which founders can share with the team.
 */
export const ViewBar = <T,>({ page, fields, rows, value, onChange, placeholder = "Search", children }: Props<T>) => {
  const user = useUser();
  const toast = useToast();
  const { open, setOpen, ref } = usePopover();
  const [views, setViews] = useState<PageView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState({ name: "", shared: false });
  const loadViews = useCallback(() => data.listPageViews(page).then(setViews, () => setViews([])), [page]);
  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const choicesFor = useMemo(() => {
    const out: Record<string, { value: string; label: string }[]> = {};
    for (const f of fields) {
      if (f.type !== "select") continue;
      if (f.options) out[f.key] = f.options;
      else {
        const seen = new Set<string>();
        for (const r of rows) {
          const v = f.get(r);
          for (const x of Array.isArray(v) ? v : v === null || v === undefined || v === "" ? [] : [String(v)]) seen.add(x);
        }
        out[f.key] = [...seen].sort().map((x) => ({ value: x, label: x }));
      }
    }
    return out;
  }, [fields, rows]);
  const optionLabel = (key: string, v: string) => choicesFor[key]?.find((o) => o.value === v)?.label ?? v;

  const active = views.find((v) => v.id === activeId) ?? null;
  const dirty = active ? JSON.stringify(active.state) !== JSON.stringify(value) : JSON.stringify(EMPTY_VIEW) !== JSON.stringify(value);
  const setFilter = (f: ViewFilter) => onChange({ ...value, filters: value.filters.some((x) => x.key === f.key) ? value.filters.map((x) => (x.key === f.key ? f : x)) : [...value.filters, f] });
  const removeFilter = (key: string) => onChange({ ...value, filters: value.filters.filter((x) => x.key !== key) });
  const chips = value.filters.filter((f) => isActive(f) || open === `filter:${f.key}`);

  const save = async (name: string, shared: boolean) => {
    try {
      const v = await data.savePageView({ page, name, state: value, shared });
      await loadViews();
      setActiveId(v.id);
      setOpen(null);
      toast(`View "${v.name}" saved`, "good");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div ref={ref} className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="relative">
        <button type="button" className="btn-outline h-9 gap-1.5 text-[13px]" aria-haspopup="menu" aria-expanded={open === "views"} onClick={() => setOpen(open === "views" ? null : "views")}>
          <Icon d={ICONS.list} size={14} />
          <span className="max-w-40 truncate">{active ? active.name : "All"}</span>
          {dirty && active ? <span className="text-amber" title="Changed since saved">•</span> : null}
        </button>
        {open === "views" ? (
          <div role="menu" className={panel}>
            <button type="button" role="menuitem" className={`rounded px-2 py-1.5 text-left hover:bg-surface-2 ${!active ? "text-text" : "text-text-2"}`} onClick={() => (setActiveId(null), onChange(EMPTY_VIEW), setOpen(null))}>
              All (no filters)
            </button>
            {views.map((v) => (
              <div key={v.id} className="group flex items-center gap-1">
                <button type="button" role="menuitem" className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left hover:bg-surface-2 ${v.id === activeId ? "text-text" : "text-text-2"}`} onClick={() => (setActiveId(v.id), onChange(v.state), setOpen(null))}>
                  {v.name}
                  {v.shared ? <span className="ml-1.5 text-[11px] text-text-3">{v.ownerId === user.id ? "· shared" : `· ${v.ownerName?.split(" ")[0] ?? "team"}`}</span> : null}
                </button>
                {v.ownerId === user.id || user.role === "admin" ? (
                  <button
                    type="button"
                    aria-label={`Delete view ${v.name}`}
                    className="px-1 text-text-3 opacity-0 hover:text-coral group-hover:opacity-100 focus:opacity-100"
                    onClick={async () => {
                      if (!window.confirm(`Delete the view "${v.name}"?`)) return;
                      await data.deletePageView(v.id).catch((e: Error) => toast(e.message, "error"));
                      if (v.id === activeId) setActiveId(null);
                      loadViews();
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            <div className="mt-1 flex flex-col gap-2 border-t border-line-soft pt-2">
              {active && active.ownerId === user.id && dirty ? (
                <button type="button" className="btn-outline h-8 text-[12px]" onClick={() => save(active.name, active.shared)}>
                  Update "{active.name}"
                </button>
              ) : null}
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (saving.name.trim()) save(saving.name, saving.shared).then(() => setSaving({ name: "", shared: false }));
                }}
              >
                <input className="input h-8 text-[12px]" aria-label="New view name" placeholder="Save this view as…" value={saving.name} onChange={(e) => setSaving({ ...saving, name: e.target.value })} />
                {user.role === "admin" ? (
                  <label className="flex items-center gap-2 text-[12px] text-text-2">
                    <input type="checkbox" checked={saving.shared} onChange={(e) => setSaving({ ...saving, shared: e.target.checked })} />
                    Share with the team
                  </label>
                ) : null}
                <button type="submit" className="btn-primary h-8 text-[12px]" disabled={!saving.name.trim()}>
                  Save view
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      <input type="search" className="input h-9 w-48" placeholder={placeholder} aria-label={placeholder} value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} />

      {chips.map((f) => {
        const field = fields.find((x) => x.key === f.key);
        if (!field) return null;
        return (
          <div key={f.key} className="relative">
            <span className="flex h-8 items-center gap-1 rounded-full border border-ice/40 bg-ice/10 pl-3 pr-1 text-[12px]">
              <button type="button" className="max-w-56 truncate" onClick={() => setOpen(open === `filter:${f.key}` ? null : `filter:${f.key}`)}>
                {filterLabel(f, field, optionLabel)}
              </button>
              <button type="button" aria-label={`Remove filter ${field.label}`} className="flex h-6 w-6 items-center justify-center rounded-full text-text-3 hover:text-text" onClick={() => removeFilter(f.key)}>
                ×
              </button>
            </span>
            {open === `filter:${f.key}` ? (
              <div className={panel}>
                <span className="text-[12px] font-medium text-text-2">{field.label}</span>
                <FilterEditor field={field} filter={f} onChange={setFilter} choices={choicesFor[f.key] ?? []} />
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="relative">
        <button type="button" className="btn-ghost h-9 gap-1 text-[13px]" aria-haspopup="menu" aria-expanded={open === "add"} onClick={() => setOpen(open === "add" ? null : "add")}>
          <Icon d={ICONS.plus} size={14} /> Filter
        </button>
        {open === "add" ? (
          <div role="menu" className={panel}>
            {fields.map((f) => (
              <button
                key={f.key}
                type="button"
                role="menuitem"
                className="rounded px-2 py-1.5 text-left text-text-2 hover:bg-surface-2 hover:text-text"
                onClick={() => {
                  if (!value.filters.some((x) => x.key === f.key)) onChange({ ...value, filters: [...value.filters, { key: f.key }] });
                  setOpen(`filter:${f.key}`);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {value.q || value.filters.some(isActive) ? (
        <button type="button" className="btn-ghost h-9 text-[12px]" onClick={() => onChange({ ...value, q: "", filters: [] })}>
          Clear
        </button>
      ) : null}
      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </div>
  );
};
