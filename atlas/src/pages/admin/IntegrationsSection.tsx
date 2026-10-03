import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/overlay";
import { SkeletonRows } from "@/components/ui/primitives";
import { data, type EmailMessage, type InboxUsage, type SenderRun } from "@/data";
import { tableDate } from "@/lib/format";
import { localHHMM } from "@/services/time";
import LeadSourcesCard from "./LeadSourcesCard";

const STATUS_TONE: Record<EmailMessage["status"], string> = {
  queued: "text-cyan",
  sent: "text-mint",
  blocked: "text-coral",
  cancelled: "text-text-3",
};

/** Admin › Integrations (admin/09_INTEGRATIONS.md): M5 adds the email sender — inboxes, caps, outbox. */
const IntegrationsSection = () => {
  const toast = useToast();
  const [inboxes, setInboxes] = useState<InboxUsage[] | null>(null);
  const [outbox, setOutbox] = useState<EmailMessage[]>([]);
  const [run, setRun] = useState<SenderRun | null>(null);
  const [busy, setBusy] = useState(false);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const load = useCallback(() => {
    data.inboxes().then(setInboxes);
    data.outbox().then(setOutbox);
    data.lastSenderRun().then(setRun);
  }, []);
  useEffect(load, [load]);

  const runNow = async () => {
    setBusy(true);
    try {
      const r = await data.runSender();
      toast(`Sender ran · ${r.sent} sent · ${r.deferred.length} waiting · ${r.blocked.length} blocked · ${r.replies} replies`, "good");
      load();
    } finally {
      setBusy(false);
    }
  };

  const cols = "grid-cols-[90px_minmax(0,1.4fr)_minmax(0,1.6fr)_90px_minmax(0,1.6fr)_110px]";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title m-0">Integrations</h1>

      <section aria-label="Email sending" className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label-caps">Google Workspace · sending inboxes</span>
          <span className="flex items-center gap-3">
            <span className="chip border-amber text-amber">Fake mailbox · nothing is really sent</span>
            <button type="button" className="btn-outline h-9 text-[11px]" disabled={busy} onClick={runNow}>
              Run sender now
            </button>
          </span>
        </div>
        {inboxes ? (
          inboxes.map((i) => (
            <div key={i.id} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3 text-[13px]">
                <span>
                  {i.address} <span className="text-text-3">· {i.brand}</span>
                </span>
                <span className="num text-text-2">
                  {i.sentToday} / {i.capToday} today{i.capToday < i.dailyCap ? ` · warming up to ${i.dailyCap}` : ""}
                </span>
              </div>
              <div className="h-[3px] bg-line">
                <div className={`h-[3px] ${i.sentToday >= i.capToday ? "bg-amber" : "bg-cyan"}`} style={{ width: `${Math.min(100, (i.sentToday / i.capToday) * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <SkeletonRows rows={3} />
        )}
        <span className="text-[12px] text-text-3">
          {run ? `Last run ${localHHMM(new Date(run.at), tz)} · ${run.sent} sent · ${run.deferred.length} waiting · ${run.blocked.length} blocked · ${run.replies} replies · ${run.ms} ms. ` : ""}
          Runs every minute while Atlas is open; in production a scheduled server job sends through the Gmail API.
        </span>
        {run?.deferred.length ? (
          <span className="text-[12px] text-amber">
            Waiting: {[...new Set(run.deferred.map((d) => d.reason))].slice(0, 3).join(" · ")}
          </span>
        ) : null}
      </section>

      <section aria-label="Outbox" className="card min-w-0 overflow-x-auto">
        <div className={`grid ${cols} min-w-[900px] gap-3 border-b border-line px-4 py-3 text-[12px] font-medium text-text-3 bg-surface-2`}>
          <span>Status</span>
          <span>To</span>
          <span>Subject</span>
          <span>When</span>
          <span>Why / reply</span>
          <span />
        </div>
        {outbox.slice(0, 60).map((m) => (
          <div key={m.id} className={`grid ${cols} min-w-[900px] items-center gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0`}>
            <span className={`text-[12px] font-medium ${STATUS_TONE[m.status]}`}>{m.repliedAt ? "Replied" : m.unsubscribedAt ? "Unsubscribed" : m.status}</span>
            <Link to={`/leads/${m.leadId}`} className="truncate hover:text-cyan">
              {m.to ?? "—"}
            </Link>
            <span className="truncate text-text-2">{m.subject}</span>
            <span className="num text-[12px] text-text-3">{tableDate(m.sentAt ?? m.queuedAt)}</span>
            <span className="truncate text-[12px] text-text-2">{m.replySnippet ? `"${m.replySnippet}"` : (m.reason ?? "")}</span>
            <span>
              {m.status === "sent" && !m.repliedAt ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    await data.simulateReply(m.id, "Sounds interesting, can we talk Thursday?");
                    await data.runSender();
                    toast("Reply simulated · cadence stopped", "good");
                    load();
                  }}
                >
                  Simulate reply
                </button>
              ) : null}
            </span>
          </div>
        ))}
        {!outbox.length ? <p className="m-0 px-4 py-6 text-[13px] text-text-2">No emails yet. Cadence emails appear here as queues are built.</p> : null}
      </section>

      <LeadSourcesCard />

      <section aria-label="Other integrations" className="card flex flex-col gap-2 p-5 text-[13px] text-text-2">
        <span className="label-caps">Other integrations</span>
        <span>Twilio (calls), Stripe (deposits), the voice platform, transcription and the Anthropic API connect in their milestones. Secrets are stored server-side only.</span>
      </section>
    </div>
  );
};

export default IntegrationsSection;
