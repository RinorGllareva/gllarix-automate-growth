import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { CALL_BLOCK_LABEL, COUNTRY_RULES } from "@/config/countryRules";
import { countryLabel } from "@/config/leads";
import { data, type ComplianceOverview } from "@/data";

const yes = (v: boolean | "conditional" | undefined) => (v === true ? "Yes" : v === "conditional" ? "Conditional" : "No");
const tone = (v: boolean | "conditional" | undefined) => (v === true ? "text-mint" : v === "conditional" ? "text-amber" : "text-coral");

/** Admin › Country rules (A10, Appendix 3): channel permissions per market, retention, and the nightly job. */
const CountryRulesSection = () => {
  const toast = useToast();
  const [o, setO] = useState<ComplianceOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => data.complianceOverview().then(setO, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!o) return <SkeletonRows rows={6} />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">Country rules</h1>
      {o.unverified.length ? (
        <p role="alert" className="m-0 border border-amber-line px-4 py-3 text-[13px] text-amber">
          {o.unverified.length} of {Object.keys(COUNTRY_RULES).length} markets aren't confirmed by counsel yet ({o.unverified.join(", ")}). These are planning notes, not legal advice: confirm them with a lawyer and mark them verified in config.
        </p>
      ) : null}

      <section aria-label="Rules per market" className="card overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-[150px_90px_110px_150px_minmax(0,1fr)_80px] gap-3 border-b border-line px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2">
          <span>Market</span>
          <span>Cold calls</span>
          <span>Cold email</span>
          <span>Call limits</span>
          <span>Notes</span>
          <span>Verified</span>
        </div>
        {Object.entries(COUNTRY_RULES).map(([code, r]) => (
          <div key={code} className="grid min-w-[760px] grid-cols-[150px_90px_110px_150px_minmax(0,1fr)_80px] items-start gap-3 border-b border-line-soft px-5 py-2.5 text-[13px] last:border-b-0">
            <span>
              {countryLabel(code)} {countryLabel(code) !== code ? <span className="font-mono text-[11px] text-text-3">{code}</span> : null}
            </span>
            <span className={tone(r.call)}>{yes(r.call)}</span>
            <span className={tone(r.email)}>{yes(r.email)}</span>
            <span className="text-[12px] text-text-2">
              {!r.call ? "—" : [
                `Hours ${(r.callHoursLocal ?? "07:00-21:00").replace("-", "–")}`,
                ...(r.callRequires ?? []).map((x) => (x === "tps_ctps_screen" ? "TPS/CTPS screen" : x)),
                ...(r.callBlock ?? []).map((x) => `Block: ${CALL_BLOCK_LABEL[x] ? "asterisk numbers" : x}`),
                r.autodialerToMobile === false ? "No autodialer to mobiles" : null,
                r.smsCold === false ? "No cold texts" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className="text-[12px] text-text-2">{r.notes}</span>
            <span className={r.verified ? "text-mint" : "text-amber"}>{r.verified ? "Yes" : "No"}</span>
          </div>
        ))}
        <p className="m-0 px-5 py-3 text-[12px] text-text-3">
          Every market not listed is blocked. Cold texts need consent everywhere. Atlas dials by hand; no automated LinkedIn actions and no Maps scraping.
        </p>
      </section>

      <section aria-label="Retention" className="card flex flex-wrap items-center justify-between gap-4 p-5 text-[13px]">
        <div className="flex flex-col gap-1">
          <span className="label-caps">Retention</span>
          <span className="text-text-2">
            Personal data of lost and never-worked leads is erased after {o.retentionMonths} months; stats stay. {o.dueForRetention ? `${o.dueForRetention} leads are due at the next nightly run.` : "None due now."}
          </span>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await data.setRetentionMonths(Number(new FormData(e.currentTarget).get("months")));
              toast("Retention saved", "good");
              load();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          <input name="months" className="input h-9 w-20 font-mono" type="number" min={1} max={120} defaultValue={o.retentionMonths} aria-label="Retention in months" />
          <span className="text-text-2">months</span>
          <button type="submit" className="btn-outline h-9">
            Save
          </button>
        </form>
      </section>

      <section aria-label="Nightly job" className="card flex flex-col p-5">
        <span className="label-caps pb-3">Nightly job · rescore active leads, then retention (02:00 UTC)</span>
        {o.runs.length ? (
          o.runs.slice(0, 10).map((r) => (
            <div key={r.date} className="grid grid-cols-[110px_1fr_1fr_1fr] gap-3 border-b border-line-soft py-2 text-[13px] last:border-b-0">
              <span className="font-mono text-text-2">{r.date}</span>
              <span>{r.rescored} rescored</span>
              <span className={r.changed ? "text-cyan" : "text-text-3"}>{r.changed} changed</span>
              <span className={r.erased ? "text-amber" : "text-text-3"}>{r.erased} erased</span>
            </div>
          ))
        ) : (
          <span className="text-[13px] text-text-3">No runs yet. It runs after 02:00 UTC while Atlas is open in demo mode (pg_cron in Supabase mode).</span>
        )}
      </section>
    </div>
  );
};

export default CountryRulesSection;
