import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AtlasMark } from "@/components/ui/primitives";
import { data, type PublicClientReport } from "@/data";
import { monthLabel } from "@/services/billing";

/** Public monthly results report (/r/:token): the 4 KPIs and minutes per day. ?print=1 opens the print dialog (save as PDF). */
const ClientReportPage = () => {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const [r, setR] = useState<PublicClientReport | null | undefined>(undefined);
  useEffect(() => {
    data.publicClientReport(token).then(setR);
  }, [token]);
  useEffect(() => {
    if (r && params.get("print") === "1") window.setTimeout(() => window.print(), 300);
  }, [r, params]);

  if (r === undefined) return <div className="min-h-screen bg-bg-deep" />;
  if (r === null)
    return (
      <div className="min-h-screen bg-bg-deep px-6 py-10 text-text">
        <p className="mx-auto max-w-2xl text-[16px] text-text-2">This report isn't available.</p>
      </div>
    );

  const max = Math.max(10, ...r.days.map((d) => d.minutes));
  let run = 0;
  const bars = r.days.map((d) => {
    run += d.minutes;
    return { ...d, over: r.includedMinutes > 0 && run > r.includedMinutes };
  });
  const kpis = [
    { label: "Calls answered", v: r.kpis.callsAnswered, cls: "text-text" },
    { label: "After-hours calls captured", v: r.kpis.afterHours, cls: "text-cyan" },
    { label: "Jobs booked", v: r.kpis.jobsBooked, cls: "text-mint" },
    { label: "Missed", v: r.kpis.missed, cls: "text-lavender" },
  ];

  return (
    <div className="min-h-screen bg-bg-deep px-6 py-10 text-text print:bg-white print:text-black sm:px-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <AtlasMark size={28} />
            <span className="text-[15px] font-medium tracking-[0.28em]">{r.brandName.toUpperCase()}</span>
          </span>
          <button type="button" className="btn-outline h-10 text-[11px] print:hidden" onClick={() => window.print()}>
            Save as PDF
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label-caps">Monthly results · {monthLabel(r.period)}</span>
          <h1 className="page-title m-0 leading-tight">{r.companyName}</h1>
          <span className="text-[14px] text-text-2">What your AI receptionist handled this month.</span>
        </div>
        <section aria-label="Results" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="flex flex-col gap-2 border border-line p-4">
              <span className="text-[12px] font-medium text-label">{k.label}</span>
              <span className={`num text-[30px] font-light ${k.cls}`}>{k.v.toLocaleString("en-US")}</span>
            </div>
          ))}
        </section>
        <section aria-label="Minutes per day" className="flex flex-col gap-3 border border-line p-5">
          <div className="flex flex-wrap justify-between gap-2 text-[11px] tracking-[0.22em] text-label">
            <span>Minutes per day</span>
            <span className="num">
              {r.kpis.minutes.toLocaleString("en-US")} USED · {r.includedMinutes.toLocaleString("en-US")} INCLUDED
            </span>
          </div>
          <div className="flex h-[150px] items-end gap-[3px] border-b border-line">
            {bars.map((b) => (
              <div key={b.date} title={`${b.date} · ${b.minutes} min`} className={`min-w-0 flex-1 ${b.over ? "bg-amber" : "bg-cyan"}`} style={{ height: `${Math.max(2, Math.round((b.minutes / max) * 140))}px` }} />
            ))}
          </div>
        </section>
        <p className="m-0 text-[13px] text-text-3">Questions about this report? Reply to the email it came with.</p>
      </div>
    </div>
  );
};

export default ClientReportPage;
