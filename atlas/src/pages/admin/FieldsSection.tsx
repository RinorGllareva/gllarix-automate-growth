import { useCallback, useEffect, useState } from "react";
import { Field, RowMenu } from "@/components/ui/actions";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, Pill, SkeletonRows } from "@/components/ui/primitives";
import { data, FIELD_ENTITIES, FIELD_ENTITY_LABEL, FIELD_TYPE_LABEL, FIELD_TYPES, type FieldDef, type FieldEntity, type FieldType } from "@/data";

type Draft = { id?: string; entity: FieldEntity; label: string; type: FieldType; options: string; currency: "USD" | "EUR"; inTable: boolean };

const WHERE: Record<FieldEntity, string> = {
  lead: "the lead page and the Leads table",
  deal: "the deal page and the Deals table",
  client: "the client page",
  ticket: "the ticket page and the Support table",
  candidate: "the candidate panel in Hiring and the Import Center",
};

/** Settings › Fields: custom fields per record type. They appear on the record, in tables, filters, imports and exports. */
const FieldsSection = () => {
  const toast = useToast();
  const [entity, setEntity] = useState<FieldEntity>("lead");
  const [defs, setDefs] = useState<FieldDef[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const load = useCallback(() => data.listFieldDefs().then(setDefs, (e: Error) => toast(e.message, "error")), [toast]);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    }
  };
  const list = (defs ?? []).filter((f) => f.entity === entity);
  const choice = draft && (draft.type === "select" || draft.type === "multi_select");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title m-0">Fields</h1>
          <p className="m-0 max-w-3xl text-[14px] text-text-2">Add the facts your team tracks that Atlas doesn't have yet (contract end date, tier, referral partner…). A field shows on the record, as a table column, as a filter and in imports.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setDraft({ entity, label: "", type: "text", options: "", currency: "EUR", inTable: false })}>
          + Field
        </button>
      </div>

      <div role="tablist" aria-label="Record type" className="flex flex-wrap gap-1.5">
        {FIELD_ENTITIES.map((e) => (
          <button key={e} type="button" role="tab" aria-selected={entity === e} onClick={() => setEntity(e)} className={`h-8 rounded-full border px-3.5 text-[12px] ${entity === e ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-2 hover:text-text"}`}>
            {FIELD_ENTITY_LABEL[e]}
            <span className="ml-1.5 font-mono text-[11px] opacity-70">{(defs ?? []).filter((f) => f.entity === e).length || ""}</span>
          </button>
        ))}
      </div>

      {!defs ? (
        <SkeletonRows rows={3} />
      ) : list.length ? (
        <div className="card">
          {list.map((f, i) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{f.label}</span>
                <span className="font-mono text-[11px] text-text-3">{f.key}</span>
              </span>
              <Pill hue="cyan">{FIELD_TYPE_LABEL[f.type]}</Pill>
              {f.options.length ? <span className="max-w-64 truncate text-[12px] text-text-3">{f.options.join(", ")}</span> : null}
              {f.inTable ? <span className="text-[12px] text-text-2">Table column</span> : null}
              <RowMenu
                label={`Actions for ${f.label}`}
                items={[
                  { label: "Edit", onSelect: () => setDraft({ id: f.id, entity: f.entity, label: f.label, type: f.type, options: f.options.join("\n"), currency: f.currency ?? "EUR", inTable: f.inTable }) },
                  { label: "Move up", hidden: i === 0, onSelect: () => run(() => data.moveFieldDef(f.id, "up")) },
                  { label: "Move down", hidden: i === list.length - 1, onSelect: () => run(() => data.moveFieldDef(f.id, "down")) },
                  { label: "Delete with its values", danger: true, onSelect: () => window.confirm(`Delete "${f.label}" and every value in it? This can't be undone.`) && run(() => data.deleteFieldDef(f.id), `${f.label} deleted`) },
                ]}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={`No custom fields on ${FIELD_ENTITY_LABEL[entity].toLowerCase()} yet.`}
          action={
            <button type="button" className="btn-outline" onClick={() => setDraft({ entity, label: "", type: "text", options: "", currency: "EUR", inTable: false })}>
              + Add the first field
            </button>
          }
        />
      )}
      <span className="text-[12px] text-text-3">Fields on {FIELD_ENTITY_LABEL[entity].toLowerCase()} show on {WHERE[entity]}.</span>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? `Edit · ${draft.label}` : `New field on ${draft ? FIELD_ENTITY_LABEL[draft.entity].toLowerCase() : ""}`}>
        {draft ? (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const options = draft.options.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
              const ok = await run(() => data.saveFieldDef({ id: draft.id, entity: draft.entity, label: draft.label, type: draft.type, options, currency: draft.type === "money" ? draft.currency : undefined, inTable: draft.inTable }), `${draft.label} saved`);
              if (ok) setDraft(null);
            }}
          >
            <Field label="Name">
              <input autoFocus className="input" required value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Contract end" />
            </Field>
            <Field label="Type">
              <select className="input" value={draft.type} disabled={!!draft.id} title={draft.id ? "A field's type can't change once it exists" : undefined} onChange={(e) => setDraft({ ...draft, type: e.target.value as FieldType })}>
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            {choice ? (
              <Field label="Options (one per line)" wide>
                <textarea className="input h-auto min-h-24 py-2" value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} placeholder={"Gold\nSilver\nBronze"} />
              </Field>
            ) : null}
            {draft.type === "money" ? (
              <Field label="Currency">
                <select className="input" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as "USD" | "EUR" })}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
            ) : null}
            <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
              <input type="checkbox" checked={draft.inTable} onChange={(e) => setDraft({ ...draft, inTable: e.target.checked })} />
              Show as a column in the table (it's in the column picker either way)
            </label>
            <button type="submit" className="btn-primary sm:col-span-2" disabled={!draft.label.trim()}>
              {draft.id ? "Save" : "Add field"}
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default FieldsSection;
