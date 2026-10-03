import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "@/components/ui/actions";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, Pill } from "@/components/ui/primitives";
import { autoMapColumns, IMPORT_SCHEMAS, type ImportFieldDef } from "@/config/importSchemas";
import { data, IMPORT_ENTITIES, type EntityImportJob, type EntityImportResult, type ImportEntity } from "@/data";
import { tableDate } from "@/lib/format";
import { parseTable, type ParsedTable } from "@/services/fileParse";

type Step = "pick" | "map" | "preview" | "done";
const STATUS_TONE = { create: "mint", duplicate: "amber", error: "coral" } as const;
const STATUS_LABEL = { create: "New", duplicate: "Duplicate", error: "Can't import" } as const;

/**
 * Settings › Import (docs/pages/01-INTEGRATIONS-AND-PLUGINS.md "Import Center"): one wizard for every entity.
 * Upload (CSV, XLSX, JSON) → map columns (saved per source) → preview with duplicates → import → undo the batch.
 */
const ImportCenter = () => {
  const toast = useToast();
  const [entity, setEntity] = useState<ImportEntity | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [sourceName, setSourceName] = useState("");
  const [table, setTable] = useState<(ParsedTable & { fileName: string }) | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [target, setTarget] = useState("");
  const [targets, setTargets] = useState<{ value: string; label: string }[]>([]);
  const [customFields, setCustomFields] = useState<ImportFieldDef[]>([]);
  const [preview, setPreview] = useState<EntityImportResult | null>(null);
  const [result, setResult] = useState<EntityImportResult | null>(null);
  const [jobs, setJobs] = useState<EntityImportJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [mappingNote, setMappingNote] = useState<string | null>(null);

  const loadJobs = useCallback(() => data.listEntityImports().then(setJobs, () => setJobs([])), []);
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const schema = entity ? IMPORT_SCHEMAS[entity] : null;
  const fields = useMemo(() => [...(schema?.fields ?? []), ...customFields], [schema, customFields]);

  const start = async (e: ImportEntity) => {
    setEntity(e);
    setStep("map");
    setTable(null);
    setPreview(null);
    setResult(null);
    setSourceName("");
    if (e === "expense") {
      setTargets([
        { value: "EUR", label: "EUR when the file has no currency" },
        { value: "USD", label: "USD when the file has no currency" },
      ]);
      setTarget("EUR");
    } else if (e === "candidate") {
      const [board, defs] = await Promise.all([data.hiringBoard(), data.listFieldDefs("candidate")]);
      setTargets(board.openings.map((o) => ({ value: o.id, label: o.role })));
      setTarget(board.openings.find((o) => o.status === "open")?.id ?? board.openings[0]?.id ?? "");
      setCustomFields(defs.map((d) => ({ key: `custom:${d.key}`, label: `${d.label} (custom field)`, synonyms: [d.label.toLowerCase(), d.key.replace(/_/g, " ")] })));
      return;
    } else {
      const home = await data.tasksHome();
      const lists = home.spaces.flatMap((s) => s.lists.map((l) => ({ value: l.id, label: `${s.space.name} / ${l.name}` })));
      setTargets(lists);
      setTarget(lists[0]?.value ?? "");
    }
    setCustomFields([]);
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !entity) return;
    try {
      const t = await parseTable(file);
      if (!t.headers.length || !t.rows.length) return toast("That file has no rows to import. Check it has a header row.", "error");
      const src = sourceName.trim() || file.name.replace(/\.(csv|xlsx|json)$/i, "");
      setSourceName(src);
      setTable({ ...t, fileName: file.name });
      const saved = await data.getImportMapping(entity, src).catch(() => null);
      const auto = autoMapColumns(t.headers, fields);
      if (saved) {
        setMapping(Object.fromEntries(t.headers.map((h) => [h, h in saved ? saved[h] : auto[h]])));
        setMappingNote(`Using the mapping saved for "${src}".`);
      } else {
        setMapping(auto);
        setMappingNote("Columns matched by name. Check them before the preview.");
      }
      setPreview(null);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const mappedRows = () =>
    (table?.rows ?? []).map((r) => {
      const out: Record<string, string> = {};
      for (const [h, key] of Object.entries(mapping)) if (key) out[key] = r[h] ?? "";
      return out;
    });
  const missing = fields.filter((f) => f.required && !Object.values(mapping).includes(f.key));

  const runPreview = async () => {
    if (!entity || !table) return;
    setBusy(true);
    try {
      await data.saveImportMapping(entity, sourceName, mapping);
      setPreview(await data.runEntityImport({ entity, fileName: table.fileName, sourceName, rows: mappedRows(), target, dryRun: true }));
      setStep("preview");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const runImport = async () => {
    if (!entity || !table) return;
    setBusy(true);
    try {
      const r = await data.runEntityImport({ entity, fileName: table.fileName, sourceName, rows: mappedRows(), target });
      setResult(r);
      setStep("done");
      toast(`${r.job?.created ?? 0} ${schema!.label.toLowerCase()} imported`, "good");
      loadJobs();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const undo = async (job: EntityImportJob) => {
    if (!window.confirm(`Remove the ${job.created} ${IMPORT_SCHEMAS[job.entity].label.toLowerCase()} this import created?`)) return;
    try {
      const r = await data.undoEntityImport(job.id);
      toast(`Import undone · ${r.removed} removed`, "good");
      loadJobs();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const counts = preview ? { create: preview.rows.filter((r) => r.status === "create").length, duplicate: preview.rows.filter((r) => r.status === "duplicate").length, error: preview.rows.filter((r) => r.status === "error").length } : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Import Center</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">One wizard for every list: upload a CSV, Excel (.xlsx) or JSON file, match the columns, check the preview, import. Every import can be undone as a whole.</p>
      </div>

      {step === "pick" || !entity ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link to="/leads/import" className="card flex flex-col gap-2 p-4 hover:border-line-strong">
            <span className="text-[15px] font-semibold">Leads</span>
            <span className="text-[13px] text-text-2">Its own wizard: duplicate rules, country checks, scoring and ready-made mappings for HubSpot, Pipedrive, Apollo and Notion exports.</span>
            <span className="mt-auto text-[12px] text-cyan">Open the lead import →</span>
          </Link>
          {IMPORT_ENTITIES.map((e) => (
            <button key={e} type="button" className="card flex flex-col gap-2 p-4 text-left hover:border-line-strong" onClick={() => start(e)}>
              <span className="text-[15px] font-semibold">{IMPORT_SCHEMAS[e].label}</span>
              <span className="text-[13px] text-text-2">{IMPORT_SCHEMAS[e].help}</span>
              <span className="mt-auto text-[12px] text-cyan">Import {IMPORT_SCHEMAS[e].label.toLowerCase()} →</span>
            </button>
          ))}
        </div>
      ) : (
        <section aria-label={`Import ${schema!.label}`} className="card flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[16px] font-semibold">Import {schema!.label.toLowerCase()}</span>
            <ol className="m-0 flex list-none gap-3 p-0 text-[12px] text-text-3">
              {(["map", "preview", "done"] as const).map((s, i) => (
                <li key={s} className={step === s ? "font-medium text-text" : ""}>
                  {i + 1}. {s === "map" ? "File and columns" : s === "preview" ? "Preview" : "Done"}
                </li>
              ))}
            </ol>
            <button type="button" className="btn-ghost h-8 text-[12px]" onClick={() => (setStep("pick"), setEntity(null))}>
              Choose another list
            </button>
          </div>

          {step === "map" ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Where it comes from">
                  <input className="input" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g. Revolut export" />
                </Field>
                <Field label={entity === "expense" ? "Currency" : entity === "candidate" ? "Opening" : "Into list"}>
                  <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                    {targets.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="File (CSV, XLSX or JSON)">
                  <input className="input py-1.5" type="file" accept=".csv,.xlsx,.json,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
                </Field>
              </div>
              {table ? (
                <>
                  <span className="text-[12px] text-text-3">
                    {table.fileName}
                    {table.sheet ? ` · sheet "${table.sheet}"` : ""} · {table.rows.length} rows · {mappingNote}
                  </span>
                  <div className="overflow-x-auto rounded-lg border border-line">
                    <div className="grid min-w-[640px] grid-cols-[minmax(0,1fr)_220px_minmax(0,1.4fr)] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-[12px] text-text-3">
                      <span>Column in the file</span>
                      <span>Goes into</span>
                      <span>First values</span>
                    </div>
                    {table.headers.map((h) => (
                      <div key={h} className="grid min-w-[640px] grid-cols-[minmax(0,1fr)_220px_minmax(0,1.4fr)] items-center gap-3 border-b border-line-soft px-4 py-2 text-[13px] last:border-b-0">
                        <span className="truncate font-medium">{h}</span>
                        <select aria-label={`Map ${h}`} className="input h-8" value={mapping[h] ?? ""} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value || null })}>
                          <option value="">Don't import</option>
                          {fields.map((f) => (
                            <option key={f.key} value={f.key} disabled={Object.entries(mapping).some(([hh, k]) => k === f.key && hh !== h)}>
                              {f.label}
                              {f.required ? " *" : ""}
                            </option>
                          ))}
                        </select>
                        <span className="truncate text-[12px] text-text-3">
                          {table.rows
                            .slice(0, 3)
                            .map((r) => r[h])
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {fields.some((f) => f.hint) ? (
                    <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[12px] text-text-3">
                      {fields
                        .filter((f) => f.hint)
                        .map((f) => (
                          <li key={f.key}>
                            {f.label}: {f.hint}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                  {missing.length ? <span className="text-[12px] text-amber">Still needed: {missing.map((f) => f.label).join(", ")}</span> : null}
                  <button type="button" className="btn-primary self-start" disabled={busy || !!missing.length || !target} onClick={runPreview}>
                    {busy ? "Checking…" : "Preview"}
                  </button>
                </>
              ) : null}
            </>
          ) : null}

          {step === "preview" && preview && counts ? (
            <>
              <div className="flex flex-wrap gap-2 text-[13px]">
                <Pill hue="mint">{counts.create} new</Pill>
                <Pill hue="amber">{counts.duplicate} duplicates (skipped)</Pill>
                <Pill hue="coral">{counts.error} can't import</Pill>
              </div>
              <div className="max-h-96 overflow-y-auto rounded-lg border border-line">
                {preview.rows.map((r) => (
                  <div key={r.row} className="grid grid-cols-[48px_110px_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3 border-b border-line-soft px-4 py-2 text-[13px] last:border-b-0">
                    <span className="font-mono text-[12px] text-text-3">{r.row}</span>
                    <Pill hue={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
                    <span className="truncate">{r.label}</span>
                    <span className="truncate text-[12px] text-text-3">{r.reason ?? ""}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" disabled={busy || !counts.create} onClick={runImport}>
                  {busy ? "Importing…" : `Import ${counts.create}`}
                </button>
                <button type="button" className="btn-outline" onClick={() => setStep("map")}>
                  Back to the columns
                </button>
              </div>
            </>
          ) : null}

          {step === "done" && result?.job ? (
            <div className="flex flex-col gap-3 text-[13px]">
              <span>
                Imported {result.job.created} {schema!.label.toLowerCase()}. {result.job.duplicates} duplicates skipped, {result.job.failed} rows couldn't be imported.
              </span>
              <div className="flex gap-2">
                <Link to={entity === "expense" ? "/finance" : entity === "candidate" ? "/hiring" : `/tasks?list=${target}`} className="btn-primary">
                  Open {schema!.label.toLowerCase()}
                </Link>
                <button type="button" className="btn-outline" onClick={() => undo(result.job!).then(() => setStep("pick"))}>
                  Undo this import
                </button>
              </div>
            </div>
          ) : null}
        </section>
      )}

      <section aria-label="Past imports" className="flex flex-col gap-3">
        <span className="text-[15px] font-semibold">Past imports</span>
        {jobs.length ? (
          <div className="card">
            {jobs.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
                <span className="w-24 text-text-3">{tableDate(j.createdAt)}</span>
                <span className="w-28">{IMPORT_SCHEMAS[j.entity].label}</span>
                <span className="min-w-0 flex-1 truncate">
                  {j.sourceName} · {j.fileName}
                </span>
                <span className="text-text-2">
                  {j.created} new · {j.duplicates} dup · {j.failed} failed
                </span>
                {j.undoneAt ? (
                  <span className="text-[12px] text-text-3">Undone {tableDate(j.undoneAt)}</span>
                ) : (
                  <button type="button" className="btn-ghost h-8 text-[12px]" onClick={() => undo(j)}>
                    Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No imports yet. Pick a list above to start." />
        )}
        <span className="text-[12px] text-text-3">
          Lead imports are listed on{" "}
          <Link to="/leads/import" className="text-cyan hover:underline">
            the lead import page
          </Link>
          .
        </span>
      </section>
    </div>
  );
};

export default ImportCenter;
