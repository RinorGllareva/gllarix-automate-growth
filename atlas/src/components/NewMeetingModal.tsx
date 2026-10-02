import { useEffect, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { Modal, useToast } from "@/components/ui/overlay";
import { Pill, TierBadge } from "@/components/ui/primitives";
import { LEAD_STAGE_HUE } from "@/config/colors";
import { STAGE_CHIP } from "@/config/leads";
import { data, type LeadRow } from "@/data";
import { localHHMM, zonedToUtc } from "@/services/time";

/** Book a meeting from the Meetings page or an empty calendar slot: pick a lead, a time, who and how. */
const NewMeetingModal = ({ open, onClose, onBooked, initial }: { open: boolean; onClose: () => void; onBooked: () => void; initial?: { date: string; time: string } | null }) => {
  const user = useUser();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LeadRow[]>([]);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [withWhom, setWithWhom] = useState("");
  const [type, setType] = useState<"video" | "phone" | "in_person">("video");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    setDate(initial?.date ?? tomorrow);
    setTime(initial?.time ?? "10:00");
    setLead(null);
    setQ("");
    setNotes("");
    setType("video");
  }, [open, initial]);

  // Search open leads as you type.
  useEffect(() => {
    if (!open || lead) return;
    const t = window.setTimeout(() => {
      data
        .listLeads({ tiers: [], lists: [], countries: [], stages: ["new", "researched", "contacted", "replied", "qualified", "meeting_booked", "meeting_completed", "opportunity", "proposal_sent", "negotiation", "nurture"], owners: [], sources: [], brands: [], q, sort: "score", dir: "desc", page: 1 })
        .then((p) => setResults(p.rows.slice(0, 8)))
        .catch(() => setResults([]));
    }, 150);
    return () => window.clearTimeout(t);
  }, [q, open, lead]);

  const pick = (r: LeadRow) => {
    setLead(r);
    setWithWhom(r.contact ? `${r.contact.firstName} ${r.contact.lastName}`.trim() : "");
  };

  const startIso = date && time ? new Date(zonedToUtc(date, time, user.timezone)).toISOString() : null;
  const leadTz = lead?.company.timezone ?? null;

  return (
    <Modal open={open} onClose={onClose} title="New meeting" width={560}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!lead || !startIso) return;
          setBusy(true);
          try {
            await data.createMeeting({ leadId: lead.lead.id, at: startIso, withWhom, type, notes });
            toast(`Meeting booked · ${lead.company.name} · confirmation email queued`, "good");
            onBooked();
            onClose();
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="field-label">Lead</span>
          {lead ? (
            <div className="flex items-center gap-3 border border-line-strong bg-inset px-3 py-2">
              <TierBadge tier={lead.lead.tier} score={lead.lead.score} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-medium">{lead.company.name}</span>
                <span className="text-[12px] text-text-3">
                  {[lead.company.city, lead.company.country].filter(Boolean).join(", ")} · {lead.ownerName ?? "Unassigned"}
                </span>
              </div>
              <button type="button" className="btn-ghost text-[11px]" onClick={() => setLead(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <input autoFocus className="input" placeholder="Search a company, phone or domain" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" />
              <div className="flex max-h-56 flex-col overflow-y-auto border border-line">
                {results.map((r) => (
                  <button key={r.lead.id} type="button" onClick={() => pick(r)} className="flex items-center gap-3 border-b border-line-soft px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-surface-2">
                    <TierBadge tier={r.lead.tier} score={r.lead.score} />
                    <span className="min-w-0 flex-1 truncate">{r.company.name}</span>
                    <Pill hue={LEAD_STAGE_HUE[r.lead.stage]}>{STAGE_CHIP[r.lead.stage]}</Pill>
                  </button>
                ))}
                {!results.length ? <span className="px-3 py-2.5 text-[12px] text-text-3">{q ? "No open leads match." : "Type to search your leads."}</span> : null}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Date</span>
            <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Time · your time</span>
            <input type="time" className="input" required step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        {lead && startIso && leadTz && leadTz !== user.timezone ? (
          <span className="-mt-2 text-[12px] text-text-3">
            That's {localHHMM(new Date(startIso), leadTz)} for {lead.company.name} ({leadTz}).
          </span>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">With whom</span>
            <input className="input" required value={withWhom} onChange={(e) => setWithWhom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Type</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="video">Video call</option>
              <option value="phone">Phone</option>
              <option value="in_person">In person</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Notes (optional)</span>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda, address for in-person, …" />
        </label>
        <span className="text-[12px] text-text-3">The contact gets a confirmation email with the invite and reminders; it goes on the owner's calendar (and their Google Calendar if connected).</span>
        <button type="submit" className="btn-primary justify-between" disabled={busy || !lead}>
          <span>Book meeting</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </Modal>
  );
};

export default NewMeetingModal;
