import Papa from "papaparse";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/primitives";
import { countryLabel, LAWFUL_BASES, type ListType } from "@/config/leads";
import { data, type ImportJob, type User } from "@/data";
import { CSV_TEMPLATES } from "@/config/leadSources";
import { QUEUE } from "@/config/queue";
import { count, downloadText, tableDate } from "@/lib/format";
import {
  autoMap,
  failedRowsCsv,
  IMPORT_FIELDS,
  mappingErrors,
  MAX_BYTES,
  MAX_ROWS,
  normalizeRow,
  planImport,
  type ColumnMapping,
  type DuplicateDecision,
  type ImportField,
  type ImportPlan,
} from "@/services/importPlan";
import { Forbidden } from "@/pages/StatusPages";

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ["Upload", "Map columns", "Review duplicates", "Assign and import"];

interface Parsed {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  seconds: number;
}

const Stepper = ({ step, marks }: { step: Step; marks: string[] }) => (
  <ol aria-label="Steps" className="m-0 grid list-none grid-cols-4 border border-line p-0">
    {STEP_LABELS.map((label, i) => {
      const n = (i + 1) as Step;
      const state = n < step ? "done" : n === step ? "current" : "todo";
      return (
        <li
          key={label}
          aria-current={state === "current" ? "step" : undefined}
          className={`flex h-[52px] items-center gap-3 px-[18px] text-[14px] ${
            state === "current" ? "bg-ice text-ice-ink" : state === "done" ? "text-text-3" : "text-text-2"
          }`}
        >
          <span className="font-mono text-[12px]">0{n}</span>
          <span className="truncate">{label}</span>
          <span className="ml-auto text-[12px]">{state === "done" ? "✓" : state === "current" ? marks[i] : ""}</span>
        </li>
      );
    })}
  </ol>
);

const Stat = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div className="card flex flex-col gap-2.5 p-4">
    <span className="text-[10px] uppercase tracking-[0.2em] text-label">{label}</span>
    <span className={`num text-[30px] font-light ${tone}`}>{count(value)}</span>
  </div>
);

const Import = () => {
  const user = useUser();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [defaultCountry, setDefaultCountry] = useState("US");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [decisions, setDecisions] = useState<Record<number, DuplicateDecision>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [listType, setListType] = useState<ListType>("trades");
  const [lawfulBasis, setLawfulBasis] = useState<string>(LAWFUL_BASES[0]);
  const [suppressedMode, setSuppressedMode] = useState<"suppress" | "skip">("suppress");
  const [cadence, setCadence] = useState<string>("default");
  const [report, setReport] = useState<ImportJob | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [dragging, setDragging] = useState(false);

  const refreshHistory = () => data.listImports().then(setHistory).catch(() => undefined);
  useEffect(() => {
    data.listUsers().then(setUsers);
    refreshHistory();
  }, []);

  usePageChrome({
    context: parsed ? `Leads / import · ${parsed.fileName} · ${count(parsed.rows.length)} rows` : "Leads / import",
    action: { label: "Back to leads", to: "/leads" },
  });

  const normalized = useMemo(
    () => (parsed ? parsed.rows.map((r, i) => normalizeRow(r, i + 1, mapping, defaultCountry)) : []),
    [parsed, mapping, defaultCountry],
  );

  if (user.role !== "admin") return <Forbidden />;

  const onFile = (file: File | undefined) => {
    setParseError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setParseError("That file is over 20 MB. Split it and import the parts.");
    const started = performance.now();
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = (res.meta.fields ?? []).filter(Boolean);
        if (!headers.length || !res.data.length) return setParseError("That file has no rows we can read. Check it's a CSV with a header row.");
        if (res.data.length > MAX_ROWS) return setParseError(`That file has ${count(res.data.length)} rows; the limit is ${count(MAX_ROWS)}.`);
        setParsed({ fileName: file.name, headers, rows: res.data, seconds: (performance.now() - started) / 1000 });
        setMapping(autoMap(headers));
        if (!sourceName) setSourceName(file.name.replace(/\.csv$/i, ""));
        setPlan(null);
        setReport(null);
        setStep(2);
      },
      error: (err) => setParseError(`Couldn't read the file: ${err.message}`),
    });
  };

  const buildPlan = async () => {
    const ctx = await data.dedupContext();
    const next = planImport(normalized, ctx);
    setPlan(next);
    // Suggest merging near-certain matches; everything else defaults to "keep both".
    setDecisions(Object.fromEntries(next.possible.filter((p) => p.score >= 95).map((p) => [p.row.row, "merge" as const])));
    const developers = next.candidates.filter((r) => r.industry === "property_developer").length;
    setListType(developers > next.candidates.length / 2 ? "developers" : "trades");
    setStep(3);
  };

  const run = async () => {
    if (!plan || !parsed) return;
    setRunning(true);
    try {
      const job = await data.commitImport({
        fileName: parsed.fileName,
        sourceName,
        plan,
        decisions,
        ownerId: ownerId || null,
        listType,
        lawfulBasis,
        suppressedMode,
        cadenceId: cadence === "default" ? undefined : cadence === "none" ? null : cadence,
      });
      setReport(job);
      refreshHistory();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setRunning(false);
    }
  };

  const undo = async (job: ImportJob) => {
    try {
      const r = await data.undoImport(job.id);
      toast(`Undone · removed ${r.removed} leads${r.kept ? `, kept ${r.kept} that were already worked on` : ""}`, "good");
      refreshHistory();
      if (report?.id === job.id) setReport({ ...job, undoneAt: new Date().toISOString() });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const errors = mappingErrors(mapping);
  const merges = plan ? plan.possible.filter((p) => decisions[p.row.row] === "merge").length : 0;
  const suppressedCount = plan?.suppressedRows.length ?? 0;
  const toCreate = plan ? plan.candidates.length - merges - (suppressedMode === "skip" ? suppressedCount : 0) : 0;
  const owners = users.filter((u) => ["admin", "bdr", "closer"].includes(u.role) && u.active);
  const usedFields = new Set(Object.values(mapping).filter(Boolean));

  const marks = [
    parsed ? `${count(parsed.rows.length)} rows` : "",
    errors.length ? "Needs mapping" : "Ready",
    plan ? `${plan.possible.length} to check` : "",
    plan ? `${count(toCreate)} new` : "",
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3.5 text-[11px] uppercase tracking-label text-label">
          <span className="h-px w-10 bg-cyan-line" />
          <span>
            {parsed
              ? `${sourceName || parsed.fileName} · ${count(parsed.rows.length)} rows · parsed in ${parsed.seconds < 1 ? "under 1" : parsed.seconds.toFixed(1)} s`
              : "CSV import · up to 50,000 rows · 20 MB"}
          </span>
        </div>
        <h1 className="page-title m-0">Import leads</h1>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-3">
          CSV templates for licensed or manual lists:
          {Object.values(CSV_TEMPLATES).map((t) => (
            <button
              key={t.fileName}
              type="button"
              className="text-cyan hover:underline"
              onClick={() => downloadText(t.fileName, [t.headers, t.example].map((r) => r.map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n"))}
            >
              {t.label}
            </button>
          ))}
        </span>
      </div>

      <Stepper step={report ? 4 : step} marks={marks} />

      {report ? (
        <section aria-label="Import report" className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Imported" value={report.created} tone="text-mint" />
            <Stat label="Merged" value={report.merged} tone="text-cyan" />
            <Stat label="Skipped" value={report.skipped} tone="text-text-3" />
            <Stat label="On opt-out list" value={report.suppressed} tone="text-coral" />
            <Stat label="Failed" value={report.failed} tone={report.failed ? "text-amber" : "text-text-3"} />
          </div>
          <p className="m-0 text-[14px] text-text-2">
            Skipped rows were exact duplicates (same phone or domain){suppressedMode === "skip" ? " or on the opt-out list" : ""}. Opt-out rows were imported as suppressed and will never be queued.
            {report.undoneAt ? " This import was undone." : " You can undo this import for 24 hours; leads someone has already worked on are kept."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to={`/leads?source=${report.sourceId}&tier=all&stage=all`} className="btn-primary">
              See imported leads →
            </Link>
            {plan?.invalid.length ? (
              <button type="button" className="btn-outline" onClick={() => downloadText(`failed-rows-${parsed?.fileName ?? "import"}.csv`, failedRowsCsv(plan.invalid))}>
                Download failed rows
              </button>
            ) : null}
            {!report.undoneAt ? (
              <button type="button" className="btn-outline" onClick={() => undo(report)}>
                Undo import
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost ml-2"
              onClick={() => {
                setParsed(null);
                setPlan(null);
                setReport(null);
                setSourceName("");
                setStep(1);
              }}
            >
              Import another file
            </button>
          </div>
        </section>
      ) : step === 1 ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Upload" className="flex flex-col gap-4">
            <label
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                setDragging(false);
                onFile(e.dataTransfer.files[0]);
              }}
              className={`flex cursor-pointer flex-col items-start gap-3 border border-dashed px-8 py-12 ${dragging ? "border-cyan bg-surface" : "border-line-button"}`}
            >
              <span className="text-[24px] font-light">Drop a CSV here, or choose a file</span>
              <span className="text-[13px] text-text-2">One company per row, with a header row. Needs a company name and a phone or website.</span>
              <input type="file" accept=".csv,text/csv" className="text-[13px] text-text-2 file:mr-4 file:h-10 file:border file:border-line-button file:bg-transparent file:px-4 file:text-[11px] file:uppercase file:tracking-label file:text-text" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {parseError ? (
              <p role="alert" className="m-0 text-[13px] text-coral">
                {parseError}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="field-label">Source name</span>
                <input className="input" placeholder="Places API · Florida HVAC" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="field-label">Country for numbers without one</span>
                <select className="input" value={defaultCountry} onChange={(e) => setDefaultCountry(e.target.value)}>
                  {["US", "CA", "GB", "CH", "AE", "XK", "AL", "DE", "AT"].map((c) => (
                    <option key={c} value={c}>
                      {countryLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section aria-label="Recent imports" className="card flex flex-col gap-3 self-start p-5">
            <span className="label-caps">Recent imports</span>
            {history.length ? (
              history.slice(0, 6).map((j) => {
                const undoable = !j.undoneAt && Date.now() - new Date(j.createdAt).getTime() < 24 * 3_600_000;
                return (
                  <div key={j.id} className="flex items-start justify-between gap-3 border-b border-line-soft pb-3 text-[13px] last:border-b-0">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate">{j.sourceName}</span>
                      <span className="text-[11px] text-text-3">
                        {tableDate(j.createdAt)} · {count(j.created)} new · {count(j.merged)} merged{j.undoneAt ? " · undone" : ""}
                      </span>
                    </div>
                    {undoable ? (
                      <button type="button" className="btn-ghost shrink-0" onClick={() => undo(j)}>
                        Undo
                      </button>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <span className="text-[13px] text-text-2">No imports yet.</span>
            )}
          </section>
        </div>
      ) : step === 2 && parsed ? (
        <div className="flex flex-col gap-5">
          <section aria-label="Column mapping" className="card">
            <div className="grid grid-cols-[1fr_1.4fr_220px] gap-3 border-b border-line px-[18px] py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2">
              <span>CSV column</span>
              <span>First value</span>
              <span>Atlas field</span>
            </div>
            {parsed.headers.map((h) => (
              <div key={h} className="grid grid-cols-[1fr_1.4fr_220px] items-center gap-3 border-b border-line-soft px-[18px] py-2 text-[13px] last:border-b-0">
                <span className="truncate">{h}</span>
                <span className="truncate text-text-2">{parsed.rows.find((r) => r[h])?.[h] ?? "—"}</span>
                <select
                  aria-label={`Atlas field for ${h}`}
                  className="input h-9"
                  value={mapping[h] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [h]: (e.target.value || null) as ImportField | null })}
                >
                  <option value="">Ignore</option>
                  {IMPORT_FIELDS.map((f) => (
                    <option key={f.key} value={f.key} disabled={usedFields.has(f.key) && mapping[h] !== f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </section>

          <section aria-label="Preview" className="flex flex-col gap-3">
            <span className="label-caps">Preview · first 10 rows after cleaning</span>
            <div className="card overflow-x-auto">
              <div className="grid min-w-[900px] grid-cols-[40px_1.6fr_150px_1.2fr_1fr_60px_1.4fr] gap-3 border-b border-line px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2">
                <span>Row</span>
                <span>Company</span>
                <span>Phone</span>
                <span>Domain</span>
                <span>City</span>
                <span>Ctry</span>
                <span>Problems</span>
              </div>
              {normalized.slice(0, 10).map((r) => (
                <div key={r.row} className="grid min-w-[900px] grid-cols-[40px_1.6fr_150px_1.2fr_1fr_60px_1.4fr] items-center gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
                  <span className="num text-text-3">{r.row}</span>
                  <span className="truncate">{r.companyName || "—"}</span>
                  <span className="truncate font-mono text-[12px]">{r.phone ?? "—"}</span>
                  <span className="truncate text-text-2">{r.domain ?? "—"}</span>
                  <span className="truncate text-text-2">{r.city ?? "—"}</span>
                  <span>{countryLabel(r.country)}</span>
                  <span className="truncate text-[12px] text-amber">{r.errors.join("; ")}</span>
                </div>
              ))}
            </div>
          </section>

          {errors.length ? (
            <p role="alert" className="m-0 text-[13px] text-coral">
              {errors.join(" ")}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button type="button" className="btn-primary" disabled={errors.length > 0} onClick={buildPlan}>
              Check for duplicates →
            </button>
          </div>
        </div>
      ) : step === 3 && plan ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Rows" value={plan.rows.length} tone="text-text" />
            <Stat label="New" value={plan.candidates.length - plan.possible.length} tone="text-mint" />
            <Stat label="Exact duplicates" value={plan.exact.length} tone="text-text-3" />
            <Stat label="Possible duplicates" value={plan.possible.length} tone="text-amber" />
          </div>
          {plan.invalid.length ? (
            <p className="m-0 text-[13px] text-amber">
              {count(plan.invalid.length)} rows can't be imported (no company name, or no phone and no website). They're listed in the report.
            </p>
          ) : null}

          {plan.possible.length ? (
            <section aria-label="Possible duplicates" className="card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[18px] py-3">
                <span className="text-[10px] uppercase tracking-[0.2em] text-text-3">Possible duplicates · fuzzy name + city ≥ 90</span>
                <span className="flex gap-4">
                  <button type="button" className="btn-ghost" onClick={() => setDecisions(Object.fromEntries(plan.possible.filter((p) => p.score >= 95).map((p) => [p.row.row, "merge" as const])))}>
                    Merge all ≥ 95
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setDecisions({})}>
                    Keep all
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-[1.4fr_1.4fr_70px_170px] gap-3 border-b border-line px-[18px] py-3 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2">
                <span>In this file</span>
                <span>Already in Atlas</span>
                <span>Match</span>
                <span>Action</span>
              </div>
              {plan.possible.map((p) => {
                const decision = decisions[p.row.row] ?? "keep";
                const other = p.match.kind === "atlas" ? p.match.company : null;
                const otherRow = p.match.kind === "file" ? p.match.row : null;
                return (
                  <div key={p.row.row} className="grid min-h-14 grid-cols-[1.4fr_1.4fr_70px_170px] items-center gap-3 border-b border-line-soft px-[18px] py-2 text-[13px] last:border-b-0">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate">{p.row.companyName}</span>
                      <span className="truncate text-[11px] text-text-3">{[p.row.city, p.row.phone ?? p.row.domain].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-text-2">{other?.name ?? otherRow?.companyName}</span>
                      <span className="truncate text-[11px] text-text-3">
                        {other ? [other.city, other.phone ?? other.domain].filter(Boolean).join(" · ") : `Row ${otherRow?.row} of this file`}
                      </span>
                    </div>
                    <span className="font-mono text-amber">{p.score}</span>
                    <div className="flex gap-1.5" role="radiogroup" aria-label={`Decision for ${p.row.companyName}`}>
                      {(["merge", "keep"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={decision === d}
                          onClick={() => setDecisions({ ...decisions, [p.row.row]: d })}
                          className={`h-[30px] border px-2.5 text-[11px] ${decision === d ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-2 hover:text-text"}`}
                        >
                          {d === "merge" ? "Merge" : "Keep both"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="px-[18px] py-3 text-[12px] text-text-3">Merge fills empty fields on the existing company only. It never overwrites.</div>
            </section>
          ) : (
            <EmptyState title="No possible duplicates to review. Exact duplicates are skipped automatically." />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button type="button" className="btn-primary" onClick={() => setStep(4)}>
              Continue →
            </button>
          </div>
        </div>
      ) : step === 4 && plan ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Summary" className="flex flex-col gap-3 text-[14px] text-text-2">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="New leads" value={toCreate} tone="text-mint" />
              <Stat label="Merges" value={merges} tone="text-cyan" />
              <Stat label="Skipped" value={plan.exact.length + (suppressedMode === "skip" ? suppressedCount : 0)} tone="text-text-3" />
              <Stat label="On opt-out list" value={suppressedCount} tone="text-coral" />
            </div>
            {plan.noChannelRows.length ? (
              <p className="m-0 text-amber">
                {count(plan.noChannelRows.length)} rows are in markets with no allowed cold channel (Germany, Austria). They'll import but can't be called or emailed.
              </p>
            ) : null}
          </section>
          <section aria-label="Assign" className="card flex flex-col gap-4 p-5">
            <span className="label-caps">Assign the {count(toCreate)} new leads</span>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-text-2">Owner</span>
              <select className="input h-10" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Unassigned</option>
                {owners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-text-2">List</span>
              <select className="input h-10" value={listType} onChange={(e) => setListType(e.target.value as ListType)}>
                <option value="trades">Trades</option>
                <option value="developers">Developers</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-text-2">Cadence</span>
              <select className="input h-10" value={cadence} onChange={(e) => setCadence(e.target.value)}>
                <option value="default">Default for the list ({QUEUE.cadenceFor[listType]})</option>
                {Object.keys(QUEUE.cadences).filter((c) => c !== QUEUE.cadenceFor[listType]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="none">No cadence</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-text-2">Source</span>
              <input className="input h-10" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-text-2">Reason on record</span>
              <select className="input h-10" value={lawfulBasis} onChange={(e) => setLawfulBasis(e.target.value)}>
                {LAWFUL_BASES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            {suppressedCount ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-text-2">Rows on the opt-out list</span>
                <select className="input h-10" value={suppressedMode} onChange={(e) => setSuppressedMode(e.target.value as "suppress" | "skip")}>
                  <option value="suppress">Import as suppressed (never queued)</option>
                  <option value="skip">Skip them</option>
                </select>
              </label>
            ) : null}
            <label className="flex items-center gap-2.5 text-[13px] text-text-2">
              <input type="checkbox" checked disabled className="h-4 w-4 accent-[var(--cyan)]" />
              <span>Scored on import · A/B leads join their owner's next daily queue</span>
            </label>
            <button type="button" className="btn-primary h-[46px] justify-between" disabled={running || (!toCreate && !merges)} onClick={run}>
              <span>{running ? "Importing…" : `Import ${count(toCreate)} leads`}</span>
              <span aria-hidden="true">→</span>
            </button>
            <span className="text-[12px] text-text-3">Opt-out list and country rules are checked before anything is queued.</span>
            <button type="button" className="btn-ghost self-start" onClick={() => setStep(3)}>
              ← Back to duplicates
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default Import;
