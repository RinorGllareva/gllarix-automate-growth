import { useEffect, useState } from "react";
import { Modal, useToast } from "@/components/ui/overlay";
import { data, type EmailTemplate } from "@/data";
import { queueUpdated } from "@/lib/events";

interface EmailComposeProps {
  open: boolean;
  leadId: string;
  listType: "trades" | "developers";
  companyName: string;
  onClose: () => void;
  onQueued?: () => void;
}

/** Pick a template, preview it for this lead, queue it. Compliance, send window and caps apply when the sender picks it up. */
const EmailCompose = ({ open, leadId, listType, companyName, onClose, onQueued }: EmailComposeProps) => {
  const toast = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [key, setKey] = useState("");
  const [preview, setPreview] = useState<{ subject: string; body: string; problems: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    data.listTemplates().then((all) => {
      const usable = all.filter((t) => t.channel === "email" && (t.list === listType || t.list === "any") && !t.key.startsWith("reminder") && t.key !== "booking_confirmation");
      setTemplates(usable);
      setKey((k) => k || usable[0]?.key || "");
    });
  }, [open, listType]);

  useEffect(() => {
    if (!open || !key) return;
    setPreview(null);
    data.previewTemplate(key, leadId).then(setPreview);
  }, [open, key, leadId]);

  const queue = async () => {
    setBusy(true);
    try {
      const m = await data.composeEmail(leadId, { templateKey: key });
      const run = await data.runSender();
      const deferred = run.deferred.find((d) => d.id === m.id);
      const blocked = run.blocked.find((d) => d.id === m.id);
      toast(blocked ? `Not sent: ${blocked.reason}` : deferred ? `Queued · waiting: ${deferred.reason}` : `Sent to ${m.to}`, blocked ? "error" : "good");
      queueUpdated();
      onQueued?.();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Email · ${companyName}`} width={640}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="field-label">Template</span>
          <select className="input" value={key} onChange={(e) => setKey(e.target.value)}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {preview ? (
          <div className="flex flex-col gap-2 border border-line bg-bg p-4">
            <span className="text-[14px]">{preview.subject}</span>
            <pre className="m-0 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-text-2">{preview.body}</pre>
          </div>
        ) : (
          <div className="skeleton h-40" />
        )}
        {preview?.problems.length ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12px] text-amber">
            {preview.problems.map((p) => (
              <li key={p}>Won't send yet: {p}</li>
            ))}
          </ul>
        ) : null}
        <span className="text-[12px] text-text-3">The opt-out list, country rules, the lead-local send window, the 3-day gap and inbox caps are checked before it goes.</span>
        <button type="button" className="btn-primary justify-between" disabled={busy || !key} onClick={queue}>
          <span>{busy ? "Queueing…" : "Queue email"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </Modal>
  );
};

export default EmailCompose;
