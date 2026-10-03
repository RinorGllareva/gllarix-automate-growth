import { useCallback, useEffect, useState } from "react";
import { Modal, useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { data, type Suppression, type SuppressionReason, type User } from "@/data";
import { count, tableDate } from "@/lib/format";

const REASON_LABEL: Record<Exclude<SuppressionReason, "erasure">, string> = {
  opt_out: "Opt-out",
  do_not_call: "Do not call",
  complaint: "Complaint",
  legal: "Legal",
};

const SOURCE_LABEL: Record<Suppression["source"], string> = {
  call_outcome: "Call outcome",
  unsubscribe: "Unsubscribe link",
  manual: "Manual",
  import: "Import",
};

/** Admin › Opt-out list (admin/07_OPT_OUT_LIST.md). */
const OptOutSection = () => {
  const toast = useToast();
  const [entries, setEntries] = useState<Suppression[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState<SuppressionReason>("opt_out");
  const [removing, setRemoving] = useState<Suppression | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const load = useCallback(() => {
    data.listSuppression().then(setEntries);
  }, []);
  useEffect(() => {
    load();
    data.listUsers().then(setUsers);
  }, [load]);

  const add = async () => {
    try {
      const entry = await data.addSuppression(value, reason);
      toast(`Added ${entry.value} · matching leads leave every queue`, "good");
      setValue("");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await data.removeSuppression(removing.id, removeReason);
      toast(`Removed ${removing.value} · logged with your reason`, "good");
      setRemoving(null);
      setRemoveReason("");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const needle = search.trim().toLowerCase();
  const shown = (entries ?? []).filter((e) => !needle || e.value.includes(needle));
  const cols = "grid-cols-[1.6fr_80px_110px_130px_110px_100px_70px]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title m-0">Opt-out list</h1>
        <span className="text-[13px] text-text-2">
          <span className="num">{count(entries?.length ?? 0)}</span> entries · checked before every queue, call and send
        </span>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) add();
        }}
      >
        <label className="flex min-w-64 flex-1 flex-col gap-1.5">
          <span className="field-label">Email, phone or domain</span>
          <input className="input h-10" value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner@example.com · +1 813 555 0142 · example.com" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Reason</span>
          <select className="input h-10 w-40" value={reason} onChange={(e) => setReason(e.target.value as SuppressionReason)}>
            {(Object.keys(REASON_LABEL) as (keyof typeof REASON_LABEL)[]).map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-outline h-10" disabled={!value.trim()}>
          Add →
        </button>
        <label className="ml-auto flex flex-col gap-1.5">
          <span className="field-label">Search</span>
          <input type="search" className="input h-10 w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </form>

      {entries && !entries.length ? (
        <EmptyState title="Nobody has opted out yet. Do-not-contact outcomes, unsubscribes and manual entries land here." />
      ) : (
        <div className="card overflow-x-auto">
          <div className={`grid ${cols} min-w-[760px] gap-3 border-b border-line px-4 py-3 text-[12px] font-medium text-text-3 bg-surface-2`}>
            <span>Value</span>
            <span>Type</span>
            <span>Reason</span>
            <span>Source</span>
            <span>Added by</span>
            <span>Date</span>
            <span />
          </div>
          {entries ? (
            shown.map((e) => (
              <div key={e.id} className={`grid ${cols} min-w-[760px] items-center gap-3 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0`}>
                <span className="truncate font-mono text-[12px]">{e.value}</span>
                <span className="capitalize text-text-2">{e.type}</span>
                <span className={e.reason === "complaint" || e.reason === "legal" ? "text-coral" : "text-text-2"}>{e.reason === "erasure" ? "Erasure (GDPR)" : REASON_LABEL[e.reason]}</span>
                <span className="text-text-2">{SOURCE_LABEL[e.source]}</span>
                <span className="truncate text-text-2">{users.find((u) => u.id === e.addedBy)?.name ?? "System"}</span>
                <span className="num text-[12px] text-text-2">{tableDate(e.createdAt)}</span>
                <button type="button" className="btn-ghost text-coral" onClick={() => setRemoving(e)}>
                  Remove
                </button>
              </div>
            ))
          ) : (
            <SkeletonRows rows={3} />
          )}
        </div>
      )}

      <Modal open={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove from opt-out list">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            remove();
          }}
        >
          <p className="m-0 text-[14px] text-text-2">
            Removing <span className="font-mono text-text">{removing?.value}</span> lets Atlas contact it again. This is rare, and it's logged with your reason.
          </p>
          <label className="flex flex-col gap-2">
            <span className="field-label">Reason</span>
            <input className="input" value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} required />
          </label>
          <button type="submit" className="btn-danger" disabled={!removeReason.trim()}>
            Remove
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default OptOutSection;
