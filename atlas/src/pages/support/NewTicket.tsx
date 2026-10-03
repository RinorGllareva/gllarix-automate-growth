import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, useToast } from "@/components/ui/overlay";
import { TICKET_CATEGORIES, TICKET_CHANNEL, TICKET_PRIORITY } from "@/config/support";
import { data, type TicketCategory, type TicketChannel, type TicketPriority } from "@/data";

/** Log a ticket: from a client's email or call, or something we found ourselves. */
const NewTicket = ({ open, clientId, onClose, onCreated }: { open: boolean; clientId?: string; onClose: () => void; onCreated?: () => void }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ clientId: clientId ?? "", subject: "", body: "", category: "wrong_answers" as TicketCategory, priority: "normal" as TicketPriority, channel: "email" as TicketChannel });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF((x) => ({ ...x, clientId: clientId ?? x.clientId }));
    if (!clientId)
      data.clientsOverview().then(
        (o) => setClients(o.cards.filter((c) => c.status !== "proposal").map((c) => ({ id: c.id, name: c.companyName }))),
        () => setClients([]),
      );
  }, [open, clientId]);

  return (
    <Modal open={open} onClose={onClose} title="New ticket" width={560}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const t = await data.createTicket(f);
            toast(`${t.number} logged`, "good");
            onClose();
            onCreated?.();
            navigate(`/support/${t.id}`);
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {!clientId ? (
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Client</span>
            <select className="input" required value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>
              <option value="">Pick a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className="field-label">What's wrong, in one line</span>
          <input className="input" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. Receptionist isn't picking up after 6 pm" />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 sm:col-span-3">
            <span className="field-label">Type</span>
            <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as TicketCategory })}>
              {Object.entries(TICKET_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label} · {v.level}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Priority</span>
            <select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as TicketPriority })}>
              {Object.entries(TICKET_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="field-label">Came in by</span>
            <select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as TicketChannel })}>
              {Object.entries(TICKET_CHANNEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{f.channel === "internal" ? "What we found" : "What the client said"}</span>
          <textarea className="input h-auto min-h-[96px] py-2.5" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        </label>
        <span className="text-[12px] text-text-3">Urgent tickets and "receptionist down" alert every founder and the implementer, and get half the usual time.</span>
        <button type="submit" className="btn-primary" disabled={busy || !f.clientId || !f.subject.trim()}>
          Log ticket
        </button>
      </form>
    </Modal>
  );
};

export default NewTicket;
