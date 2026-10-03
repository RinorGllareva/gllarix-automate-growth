import { useEffect, useState } from "react";
import { NewLeadModal } from "@/components/LeadForms";
import { Modal } from "@/components/ui/overlay";
import { TierBadge } from "@/components/ui/primitives";
import { countryLabel } from "@/config/leads";
import { data, type LeadRow } from "@/data";
import { CLEARED_QUERY } from "@/lib/leadQuery";

/**
 * Pick a lead to start something from (a deal, a meeting): search by company, contact, phone or domain, or create
 * the lead right here. Used by "+ New deal" on Deals and Pipeline.
 */
const LeadPicker = ({ open, title, onClose, onPick }: { open: boolean; title: string; onClose: () => void; onPick: (leadId: string) => void }) => {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      data.listLeads({ ...CLEARED_QUERY, q, sort: "score", dir: "desc", page: 1 }).then(
        (p) => setRows(p.rows.slice(0, 8)),
        () => setRows([]),
      );
    }, 150);
    return () => window.clearTimeout(t);
  }, [q, open]);
  return (
    <>
      <Modal open={open && !creating} onClose={onClose} title={title}>
        <div className="flex flex-col gap-3">
          <input type="search" autoFocus className="input" placeholder="Company, contact, phone or website" aria-label="Find a lead" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-col" role="listbox" aria-label="Leads">
            {rows.map((r) => (
              <button key={r.lead.id} type="button" role="option" aria-selected={false} onClick={() => onPick(r.lead.id)} className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-surface-2">
                <TierBadge tier={r.lead.tier} score={r.lead.score} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{r.company.name}</span>
                  <span className="truncate text-[12px] text-text-3">
                    {[r.company.city, countryLabel(r.company.country)].filter(Boolean).join(", ")} · {r.ownerName ?? "Unassigned"}
                  </span>
                </span>
              </button>
            ))}
            {!rows.length ? <span className="px-2.5 py-3 text-[13px] text-text-3">{q.trim() ? "No lead matches." : "Start typing to find a lead."}</span> : null}
          </div>
          <button type="button" className="btn-outline self-start" onClick={() => setCreating(true)}>
            + Not in Atlas yet: add the lead
          </button>
        </div>
      </Modal>
      <NewLeadModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(leadId) => {
          setCreating(false);
          onPick(leadId);
        }}
      />
    </>
  );
};

export default LeadPicker;
