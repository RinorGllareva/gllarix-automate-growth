import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pill } from "@/components/ui/primitives";
import { automationValue, type SystemAutomationKey } from "@/config/systemAutomations";
import { data } from "@/data";

const eur = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;
const hrs = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString());
const SAVES_HUE = { BDR: "cyan", Founders: "lavender", Implementer: "amber" } as const;

/**
 * Growth › Automations, founders' view: what Atlas did by itself in the last 30 days and the hours that gave back.
 * The answer to "why build it ourselves" in hours, next to the Build or buy maths on the ROI page.
 */
const RunsByItself = () => {
  const [runs, setRuns] = useState<Partial<Record<SystemAutomationKey, number>> | null>(null);
  useEffect(() => {
    data.automationLedger(30).then(setRuns, () => setRuns(null));
  }, []);
  if (!runs) return null;
  const v = automationValue(runs);
  return (
    <section aria-label="Runs by itself" className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold">Runs by itself · last 30 days</span>
          <span className="text-[13px] text-text-2">Work Atlas did that someone would otherwise do by hand, or pay a tool for.</span>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="flex flex-col">
            <span className="text-[12px] text-text-3">Founder hours back</span>
            <span className="num text-[22px] font-semibold leading-tight">
              {hrs(v.founderHours)} h <span className="text-[13px] font-normal text-text-2">≈ {eur(v.founderEur)}</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] text-text-3">BDR hours back</span>
            <span className="num text-[22px] font-semibold leading-tight">
              {hrs(v.bdrHours)} h <span className="text-[13px] font-normal text-text-2">≈ {v.extraDials.toLocaleString("en-US")} more dials</span>
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-text-3">
              <th className="py-1.5 font-medium">Automation</th>
              <th className="py-1.5 font-medium">Saves</th>
              <th className="py-1.5 font-medium">Instead of</th>
              <th className="py-1.5 text-right font-medium">Runs</th>
              <th className="py-1.5 text-right font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {v.rows.map((r) => (
              <tr key={r.key} className="border-t border-line-soft align-top">
                <td className="py-2 pr-3">
                  <span className="block">{r.name}</span>
                  <span className="block text-[12px] text-text-3">
                    {r.what} · {r.minutesPerRun} min each by hand
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <Pill hue={SAVES_HUE[r.saves]}>{r.saves}</Pill>
                </td>
                <td className="py-2 pr-3 text-text-2">{r.instead ?? "Manual work"}</td>
                <td className="num py-2 text-right">{r.runs.toLocaleString("en-US")}</td>
                <td className="num py-2 text-right">{hrs(r.hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="text-[12px] text-text-3">
        Founder hours priced at €87.50 (the delivery rate); BDR hours as dials at 60 a shift. Minutes per run are estimates in config/systemAutomations.ts. Compare with the
        subscriptions on{" "}
        <Link to="/roi" className="text-cyan hover:underline">
          ROI › Build or buy
        </Link>
        .
      </span>
    </section>
  );
};

export default RunsByItself;
