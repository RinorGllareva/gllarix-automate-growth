import { useEffect, useState } from "react";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import type { ListType } from "@/config/leads";
import { SCORING, type Condition } from "@/config/scoring";
import { data } from "@/data";
import type { ConversionRow, ScoringReport } from "@/services/scoringReport";

const condText = (c: Condition) => {
  if ("signal" in c) return "eq" in c ? `signal ${c.signal}` : "gte" in c ? `signal ${c.signal} ≥ ${c.gte}` : `signal ${c.signal} < ${c.lt}`;
  if ("in" in c) return `${c.field} in ${c.in.join(", ")}`;
  if ("between" in c) return `${c.field} ${c.between[0]}–${c.between[1]}`;
  if ("eq" in c) return `${c.field} = ${String(c.eq)}`;
  if ("lt" in c) return `${c.field} < ${c.lt}`;
  if ("gt" in c) return `${c.field} > ${c.gt}`;
  if ("exists" in c) return `${c.field} present`;
  return `${c.field} matches ${c.matches}`;
};
const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(1)}%`);
const lastMonths = (n: number) => {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
};

const Table = ({ rows, signal }: { rows: ConversionRow[]; signal?: boolean }) => (
  <div className="min-w-0 overflow-x-auto">
    <div className="grid min-w-[560px] grid-cols-[minmax(0,1.6fr)_90px_90px_80px_80px_80px] gap-3 border-b border-line px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2">
      <span>{signal ? "Rule" : "Tier"}</span>
      <span>Contacted</span>
      <span>Meetings</span>
      <span>Rate</span>
      <span>{signal ? "Without" : ""}</span>
      <span>{signal ? "Lift" : ""}</span>
    </div>
    {rows.map((r) => (
      <div key={r.key} className="grid min-w-[560px] grid-cols-[minmax(0,1.6fr)_90px_90px_80px_80px_80px] gap-3 border-b border-line-soft px-5 py-2 text-[13px] last:border-b-0">
        <span className="truncate">{r.label}</span>
        <span className="num">{r.contacted}</span>
        <span className="num">{r.meetings}</span>
        <span className="num">{pct(r.rate)}</span>
        <span className="num text-text-2">{signal ? pct(r.without?.rate ?? null) : ""}</span>
        <span className={`num ${r.lift === null ? "text-text-3" : r.lift >= 1.2 ? "text-mint" : r.lift < 0.8 ? "text-coral" : ""}`}>{signal ? (r.lift === null ? "—" : `${r.lift.toFixed(2)}×`) : ""}</span>
      </div>
    ))}
  </div>
);

/** Admin › Scoring models (admin/04_SCORING_MODELS.md): the rules in use and the monthly conversion report (M8). */
const ScoringSection = () => {
  const [tab, setTab] = useState<ListType>("trades");
  const months = lastMonths(6);
  const [month, setMonth] = useState(months[1]);
  const [report, setReport] = useState<ScoringReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setReport(null);
    data.scoringReport(month).then(setReport, (e: Error) => setError(e.message));
  }, [month]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Scoring models</h1>
        <span className="text-[12px] text-text-3">
          Model {SCORING.modelVersion} · tiers A {SCORING.tiers.A} · B {SCORING.tiers.B} · C {SCORING.tiers.C}
        </span>
      </div>

      <section aria-label="Monthly scoring report" className="card flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <span className="label-caps">Conversion by tier and signal · leads first contacted in</span>
          <select aria-label="Month" className="input h-9 w-40" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        {error ? (
          <EmptyState title={error} />
        ) : !report ? (
          <SkeletonRows rows={4} />
        ) : !report.contacted ? (
          <p className="m-0 px-5 py-6 text-[13px] text-text-2">Nobody was first contacted in {month}.</p>
        ) : (
          <>
            <p className="m-0 px-5 py-3 text-[13px] text-text-2">
              {report.contacted} leads first contacted · {report.meetings} booked a meeting ({pct(report.rate)}). Tier is the lead's current tier.
            </p>
            <Table rows={report.byTier.filter((t) => t.contacted)} />
            <span className="label-caps border-b border-t border-line px-5 py-3">By rule · with vs without</span>
            <Table rows={report.byRule.filter((r) => r.contacted)} signal />
            <p className="m-0 px-5 py-3 text-[12px] text-text-3">
              {report.enoughForWeights
                ? "Enough contacted leads to suggest new weights."
                : `"Suggest weights" unlocks at 500 contacted leads (now ${report.totalContacted}). Small groups swing a lot; read lifts over several months.`}
            </p>
          </>
        )}
      </section>

      <section aria-label="Rules" className="card flex flex-col">
        <div className="flex gap-1 border-b border-line px-3 pt-2">
          {(["trades", "developers"] as ListType[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-2 text-[12px] uppercase tracking-[0.2em] ${tab === t ? "border-b-2 border-ice text-text" : "text-text-3 hover:text-text"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="min-w-0 overflow-x-auto">
          {SCORING.models[tab].map((r) => (
            <div key={r.id} className="grid min-w-[620px] grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_70px_90px] gap-3 border-b border-line-soft px-5 py-2 text-[13px] last:border-b-0">
              <span className="truncate">{r.label}</span>
              <span className="truncate font-mono text-[12px] text-text-2">{condText(r.when)}</span>
              <span className={`num ${r.exclude || (r.points ?? 0) < 0 ? "text-coral" : ""}`}>{r.exclude ? "exclude" : `${(r.points ?? 0) > 0 ? "+" : ""}${r.points}`}</span>
              <span className="num text-text-3">{r.expiresDays ? `${r.expiresDays} days` : "—"}</span>
            </div>
          ))}
        </div>
        <p className="m-0 px-5 py-3 text-[12px] text-text-3">Editing weights with versioning and the impact preview is part of M2.</p>
      </section>
    </div>
  );
};

export default ScoringSection;
