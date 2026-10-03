import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import type { Column } from "@/components/DataTable";
import { useToast } from "@/components/ui/overlay";
import { data, type CustomValues, type FieldDef, type FieldEntity, type FieldValue, type User } from "@/data";
import type { ViewField } from "@/services/views";

const money = (minor: number, currency?: "USD" | "EUR") => `${currency === "USD" ? "$" : "€"}${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** How a value reads in a table cell or a property. */
export const formatValue = (f: FieldDef, v: FieldValue | undefined, users: User[] = []) => {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return "—";
  if (f.type === "money" && typeof v === "number") return money(v, f.currency);
  if (f.type === "checkbox") return v ? "Yes" : "No";
  if (f.type === "person") return users.find((u) => u.id === v)?.name ?? String(v);
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
};

/** One field, edited in place. Saves on change (select, date, checkbox) or on leaving the box (text, number). */
const FieldInput = ({ f, value, users, disabled, onSave }: { f: FieldDef; value: FieldValue | undefined; users: User[]; disabled: boolean; onSave: (v: FieldValue) => void }) => {
  const cls = "input h-8 w-full min-w-0 text-[13px]";
  const v = value ?? null;
  switch (f.type) {
    case "select":
      return (
        <select aria-label={f.label} className={cls} disabled={disabled} value={(v as string) ?? ""} onChange={(e) => onSave(e.target.value || null)}>
          <option value="">—</option>
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "multi_select": {
      const have = Array.isArray(v) ? v : [];
      return (
        <span className="flex flex-wrap gap-1">
          {f.options.map((o) => {
            const on = have.includes(o);
            return (
              <button key={o} type="button" disabled={disabled} aria-pressed={on} onClick={() => onSave(on ? have.filter((x) => x !== o) : [...have, o])} className={`h-6 rounded-full border px-2 text-[11px] ${on ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-3 hover:text-text"}`}>
                {o}
              </button>
            );
          })}
        </span>
      );
    }
    case "checkbox":
      return <input type="checkbox" aria-label={f.label} disabled={disabled} checked={v === true} onChange={(e) => onSave(e.target.checked)} />;
    case "date":
      return <input type="date" aria-label={f.label} className={cls} disabled={disabled} value={(v as string) ?? ""} onChange={(e) => onSave(e.target.value || null)} />;
    case "person":
      return (
        <select aria-label={f.label} className={cls} disabled={disabled} value={(v as string) ?? ""} onChange={(e) => onSave(e.target.value || null)}>
          <option value="">—</option>
          {users
            .filter((u) => u.active)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      );
    case "money":
      return (
        <input
          type="number"
          step="0.01"
          aria-label={`${f.label} (${f.currency ?? "EUR"})`}
          className={cls}
          disabled={disabled}
          defaultValue={typeof v === "number" ? v / 100 : ""}
          key={String(v)}
          onBlur={(e) => {
            const next = e.target.value === "" ? null : Math.round(Number(e.target.value) * 100);
            if (next !== v) onSave(next);
          }}
        />
      );
    case "number":
      return (
        <input
          type="number"
          aria-label={f.label}
          className={cls}
          disabled={disabled}
          defaultValue={typeof v === "number" ? v : ""}
          key={String(v)}
          onBlur={(e) => {
            const next = e.target.value === "" ? null : Number(e.target.value);
            if (next !== v) onSave(next);
          }}
        />
      );
    default:
      return (
        <input
          type={f.type === "link" ? "url" : "text"}
          aria-label={f.label}
          className={cls}
          disabled={disabled}
          defaultValue={(v as string) ?? ""}
          key={String(v)}
          placeholder={f.type === "link" ? "https://…" : ""}
          onBlur={(e) => {
            const next = e.target.value.trim() || null;
            if (next !== (v ?? null)) onSave(next);
          }}
        />
      );
  }
};

/** Settings › Fields for this record type, edited in place on the record. Renders nothing when there are none. */
export const CustomFieldsPanel = ({ entity, id, canEdit = true, title = "More fields" }: { entity: FieldEntity; id: string; canEdit?: boolean; title?: string }) => {
  const me = useUser();
  const toast = useToast();
  const [defs, setDefs] = useState<FieldDef[] | null>(null);
  const [values, setValues] = useState<CustomValues>({});
  const [users, setUsers] = useState<User[]>([]);
  const load = useCallback(async () => {
    const [d, v] = await Promise.all([data.listFieldDefs(entity), data.customValues(entity, [id])]);
    setDefs(d);
    setValues(v[id] ?? {});
  }, [entity, id]);
  useEffect(() => {
    load().catch(() => setDefs([]));
    data.listUsers().then(setUsers, () => setUsers([]));
  }, [load]);
  if (!defs?.length) return null;
  const editable = canEdit && me.role !== "viewer";
  return (
    <section aria-label={title} className="card flex flex-col gap-3 p-4">
      <span className="flex items-center justify-between text-[12px] font-medium text-text-3">
        {title}
        {me.role === "admin" ? (
          <Link to="/admin/fields" className="text-cyan hover:underline">
            Manage fields
          </Link>
        ) : null}
      </span>
      {defs.map((f) => (
        <label key={f.id} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-[13px]">
          <span className="truncate text-text-2" title={f.label}>
            {f.label}
          </span>
          {editable ? (
            <FieldInput
              f={f}
              value={values[f.key]}
              users={users}
              disabled={false}
              onSave={async (v) => {
                try {
                  await data.setCustomValue(entity, id, f.key, v);
                  await load();
                } catch (e) {
                  toast((e as Error).message, "error");
                  await load();
                }
              }}
            />
          ) : (
            <span>{formatValue(f, values[f.key], users)}</span>
          )}
        </label>
      ))}
    </section>
  );
};

/**
 * Custom fields as table columns and view filters for a list. Values load for the rows shown; columns marked
 * "Show in table" are visible by default, the rest are in the column picker.
 */
export const useCustomColumns = <T,>(entity: FieldEntity, rows: T[] | null, idOf: (row: T) => string) => {
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, CustomValues>>({});
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    data.listFieldDefs(entity).then(setDefs, () => setDefs([]));
    data.listUsers().then(setUsers, () => setUsers([]));
  }, [entity]);
  const ids = useMemo(() => (rows ?? []).map(idOf).join("|"), [rows, idOf]);
  useEffect(() => {
    if (!defs.length || !ids) return setValues({});
    data.customValues(entity, ids.split("|")).then(setValues, () => setValues({}));
  }, [entity, ids, defs.length]);
  const columns: Column<T>[] = defs.map((f) => ({
    key: `custom:${f.key}`,
    header: f.label,
    width: f.type === "multi_select" || f.type === "text" ? "minmax(0,1fr)" : "120px",
    hideable: true,
    defaultHidden: !f.inTable,
    align: f.type === "number" || f.type === "money" ? ("right" as const) : undefined,
    sortValue: (r: T) => {
      const v = values[idOf(r)]?.[f.key];
      return v === null || v === undefined ? null : typeof v === "number" ? v : Array.isArray(v) ? v.join(",") : String(v);
    },
    render: (r: T) => <span className="block truncate text-text-2">{formatValue(f, values[idOf(r)]?.[f.key], users)}</span>,
  }));
  const viewFields: ViewField<T>[] = defs.map((f) => ({
    key: `custom:${f.key}`,
    label: f.label,
    type: f.type === "number" || f.type === "money" ? "number" : f.type === "date" ? "date" : f.type === "select" || f.type === "multi_select" || f.type === "checkbox" || f.type === "person" ? "select" : "text",
    options:
      f.type === "select" || f.type === "multi_select"
        ? f.options.map((o) => ({ value: o, label: o }))
        : f.type === "checkbox"
          ? [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]
          : f.type === "person"
            ? users.map((u) => ({ value: u.id, label: u.name }))
            : undefined,
    get: (r: T) => {
      const v = values[idOf(r)]?.[f.key];
      if (v === null || v === undefined) return null;
      if (f.type === "money" && typeof v === "number") return v / 100;
      if (typeof v === "boolean") return String(v);
      return v;
    },
  }));
  return { defs, values, columns, viewFields };
};
