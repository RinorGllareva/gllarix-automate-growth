import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useRun } from "@/components/ui/actions";
import { EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { data, TRASH_DAYS, type TrashItem } from "@/data";
import { tableDate } from "@/lib/format";

/** Settings › Trash: everything deleted in the last 30 days. Restore puts it back exactly; Delete forever is final. */
const TrashSection = () => {
  const run = useRun();
  const [rows, setRows] = useState<TrashItem[] | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(() => data.listTrash().then(setRows, () => setRows([])), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return <SkeletonRows rows={5} />;
  const shown = rows.filter((r) => !q.trim() || r.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Trash</h1>
        <p className="m-0 text-[14px] text-text-2">Deleted records stay here for {TRASH_DAYS} days, then they're gone. Paid invoices, signed contracts and payouts are never deleted, only voided.</p>
      </div>
      <input type="search" className="input max-w-xs" placeholder="Find a deleted record" aria-label="Find a deleted record" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable<TrashItem>
        id="trash"
        label="Trash"
        rows={shown}
        rowKey={(r) => r.id}
        empty={<EmptyState title={rows.length ? "Nothing matches." : "The trash is empty."} />}
        columns={[
          { key: "label", header: "Record", width: "minmax(0,2fr)", sortValue: (r) => r.label, render: (r) => <span className="block truncate">{r.label}</span> },
          { key: "who", header: "Deleted by", width: "140px", sortValue: (r) => r.deletedByName ?? "", render: (r) => <span className="text-text-2">{r.deletedByName ?? "Atlas"}</span> },
          { key: "when", header: "When", width: "110px", sortValue: (r) => r.deletedAt, render: (r) => <span className="num text-[12px] text-text-2">{tableDate(r.deletedAt)}</span> },
          { key: "left", header: "Purged in", width: "90px", align: "right", sortValue: (r) => r.daysLeft ?? 0, render: (r) => <span className={`num text-[12px] ${(r.daysLeft ?? 0) < 5 ? "text-amber" : "text-text-3"}`}>{r.daysLeft} d</span> },
          {
            key: "actions",
            header: "",
            width: "190px",
            render: (r) => (
              <span className="flex justify-end gap-1.5">
                <button type="button" className="btn-outline h-8 text-[12px]" onClick={async () => (await run(() => data.restoreFromTrash(r.id), "Restored")) && load()}>
                  Restore
                </button>
                <button
                  type="button"
                  className="btn-ghost h-8 text-[12px] text-coral"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${r.label}" for good? This can't be undone.`)) return;
                    if (await run(() => data.purgeTrash(r.id), "Deleted for good")) load();
                  }}
                >
                  Delete forever
                </button>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
};

export default TrashSection;
