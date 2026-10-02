import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/overlay";
import { data, type ConnectorStatus } from "@/data";

const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

/** Admin › Integrations › Places API and registries, with monthly caps (admin/09_INTEGRATIONS.md). */
const LeadSourcesCard = () => {
  const [rows, setRows] = useState<ConnectorStatus[] | null>(null);
  const [caps, setCaps] = useState<Record<string, string>>({});
  const toast = useToast();
  const load = useCallback(
    () =>
      data.sourcesOverview().then((o) => {
        setRows(o.connectors);
        setCaps(Object.fromEntries(o.connectors.map((c) => [c.id, (c.capMinor / 100).toFixed(2)])));
      }),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return null;

  const saveCap = async (c: ConnectorStatus) => {
    try {
      await data.setConnector(c.id, { capMinor: Math.round(Number(caps[c.id]) * 100) });
      toast(`Cap saved · ${c.label}`, "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <section aria-label="Lead sources" className="card flex flex-col">
      <span className="label-caps border-b border-line px-5 py-3">Places API and registries · monthly caps</span>
      {rows.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 border-b border-line-soft px-5 py-4 text-[13px] last:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <span>{c.label}</span>
              <span className={`chip ${c.id === "csv_template" ? "text-text-3" : c.connected ? "border-mint text-mint" : "border-amber text-amber"}`}>
                {c.id === "csv_template" ? "Manual" : c.connected ? "Connected (demo)" : "Not connected"}
              </span>
            </span>
            {c.needsKey ? (
              <button
                type="button"
                className="btn-ghost h-8 text-[11px]"
                onClick={async () => {
                  await data.setConnector(c.id, { connected: !c.connected });
                  load();
                }}
              >
                {c.connected ? "Disconnect" : "Connect"}
              </button>
            ) : null}
          </div>
          {c.costPerRequestMinor > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-4 text-text-2">
                <span className="num">
                  {usd(c.spentMinor)} of {usd(c.capMinor)} this month · {c.requests} paid requests · {c.cacheHits} cache hits · ~{usd(c.costPerRequestMinor)} per request
                </span>
                <label className="flex items-center gap-2">
                  <span className="text-[12px] text-text-3">Cap $</span>
                  <input className="input h-8 w-24" inputMode="decimal" value={caps[c.id] ?? ""} onChange={(e) => setCaps({ ...caps, [c.id]: e.target.value })} />
                </label>
                <button type="button" className="btn-ghost h-8 text-[11px]" onClick={() => saveCap(c)}>
                  Save cap
                </button>
              </div>
              <div className="h-[3px] bg-line">
                <div className={`h-[3px] ${c.capMinor && c.spentMinor / c.capMinor > 0.9 ? "bg-amber" : "bg-cyan"}`} style={{ width: `${c.capMinor ? Math.min(100, (c.spentMinor / c.capMinor) * 100) : 0}%` }} />
              </div>
            </>
          ) : (
            <span className="text-text-2">{c.id === "csv_template" ? "Templates in Leads › Import." : `Free API · ${c.cachedPages} pages cached`}</span>
          )}
          <span className="text-[12px] text-text-3">{c.terms}</span>
        </div>
      ))}
    </section>
  );
};

export default LeadSourcesCard;
