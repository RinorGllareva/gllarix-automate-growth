import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/primitives";
import { EMAIL_SEND_WINDOW } from "@/config/emailTemplates";
import { QUEUE } from "@/config/queue";
import { MEETING_BONUS_MINOR, USD_PER_EUR } from "@/config/targets";
import { data, type Branding } from "@/data";

/** Admin › Settings (admin/02_SETTINGS.md). M5 makes Branding editable; the other groups are shown read-only from config. */
const SettingsSection = () => {
  const toast = useToast();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    data.getBranding().then(setBranding);
  }, []);
  if (!branding) return <EmptyState title="Loading settings…" />;

  const readOnly: [string, [string, string][]][] = [
    [
      "Queue",
      [
        ["Reserve for follow-ups", `${QUEUE.reserveFollowupsPct}%`],
        ["Minimum new A-tier", `${QUEUE.minNewATierPct}%`],
        ["Max call attempts per 10 business days", String(QUEUE.limits.maxCallAttemptsPer10BusinessDays)],
        ["Days between emails", String(QUEUE.limits.minDaysBetweenEmails)],
        ["Cold email send window (lead-local)", EMAIL_SEND_WINDOW],
      ],
    ],
    [
      "Commissions and pricing",
      [
        ["Meeting bonus", `$${MEETING_BONUS_MINOR / 100}`],
        ["Planning FX rate", `€1 = $${USD_PER_EUR}`],
      ],
    ],
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title m-0">Settings</h1>

      <form
        className="card flex flex-col gap-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await data.saveBranding(branding);
            toast("Branding saved · queued emails updated", "good");
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="label-caps">Branding · used in every email</span>
        <label className="flex flex-col gap-2">
          <span className="field-label">Footer postal address (required by CAN-SPAM; no email sends until it's set)</span>
          <textarea
            className="input h-auto min-h-20 py-2.5"
            value={branding.footerAddress}
            onChange={(e) => setBranding({ ...branding, footerAddress: e.target.value })}
            placeholder="Company name, street, city, postcode, country"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="field-label">Live demo line (trades intro email)</span>
          <input className="input" value={branding.demoNumber} onChange={(e) => setBranding({ ...branding, demoNumber: e.target.value })} placeholder="+1 …" />
        </label>
        <button type="submit" className="btn-primary self-start" disabled={busy}>
          Save branding
        </button>
      </form>

      {readOnly.map(([title, rows]) => (
        <section key={title} aria-label={title} className="card flex flex-col p-5">
          <span className="label-caps pb-3">{title}</span>
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
              <span className="text-text-2">{k}</span>
              <span className="num">{v}</span>
            </div>
          ))}
        </section>
      ))}
      <span className="text-[12px] text-text-3">Queue, KPI and commission settings become editable here later; today they live in src/config.</span>
    </div>
  );
};

export default SettingsSection;
