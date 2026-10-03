import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Drawer } from "@/components/ui/overlay";
import { TicketRecord } from "./TicketPage";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Avatar, EmptyState, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS } from "@/config/support";
import { useCustomColumns } from "@/components/CustomFields";
import { ViewBar } from "@/components/ViewBar";
import { data, type TicketRow, type ViewState } from "@/data";
import { applyView, EMPTY_VIEW, type ViewField } from "@/services/views";
import NewTicket from "./NewTicket";

type Filter = "open" | "mine" | "waiting" | "resolved" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Needs us" },
  { key: "mine", label: "Mine" },
  { key: "waiting", label: "Waiting on client" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

/** A list of tickets, most urgent first. Used on Support and on each client. */
export const TicketList = ({ rows, showClient = true, hrefOf = (t) => `/support/${t.id}` }: { rows: TicketRow[]; showClient?: boolean; hrefOf?: (t: TicketRow) => string }) => (
  <div className="card overflow-hidden">
    {rows.map((t) => (
      <Link key={t.id} to={hrefOf(t)} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft px-4 py-3 text-[13px] last:border-b-0 hover:bg-surface-2 sm:flex-nowrap">
        <span className="w-14 shrink-0 font-mono text-[12px] text-text-3">{t.number}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{t.subject}</span>
          <span className="truncate text-[12px] text-text-3">
            {showClient ? `${t.companyName} · ` : ""}
            {TICKET_CATEGORIES[t.category].label}
          </span>
        </span>
        {t.priority !== "normal" ? <Pill hue={TICKET_PRIORITY[t.priority].hue}>{TICKET_PRIORITY[t.priority].label}</Pill> : null}
        <Pill hue={TICKET_STATUS[t.status].hue} dot>
          {TICKET_STATUS[t.status].label}
        </Pill>
        <span className={`w-40 shrink-0 text-right text-[12px] ${t.sla.overdue ? "font-medium text-coral" : "text-text-2"}`}>{t.sla.label}</span>
        <Avatar id={t.assigneeId ?? t.id} name={t.assigneeName ?? "?"} size={22} />
      </Link>
    ))}
  </div>
);

const ticketId = (r: TicketRow) => r.id;

/** Work › Support: every client ticket, the ones past their service level first. */
const Support = () => {
  const user = useUser();
  const [rows, setRows] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  // ?open=:id shows the ticket in a side panel over the list (the same record component as the full page).
  const [params, setParams] = useSearchParams();
  const openId = params.get("open");
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const custom = useCustomColumns<TicketRow>("ticket", rows, ticketId);
  usePageChrome({ context: "Work · support" });
  const load = useCallback(
    () =>
      data.listTickets().then(
        (r) => {
          setRows(r.tickets);
          setPeople(r.people);
        },
        (e: Error) => setError(e.message),
      ),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!rows) return <SkeletonRows rows={6} />;
  const open = rows.filter((r) => r.status === "open");
  const overdue = rows.filter((r) => r.sla.overdue);
  const fields: ViewField<TicketRow>[] = [
    { key: "category", label: "Category", type: "select", options: Object.entries(TICKET_CATEGORIES).map(([k, v]) => ({ value: k, label: v.label })), get: (r) => r.category },
    { key: "priority", label: "Priority", type: "select", options: Object.entries(TICKET_PRIORITY).map(([k, v]) => ({ value: k, label: v.label })), get: (r) => r.priority },
    { key: "owner", label: "Owner", type: "select", options: [{ value: "none", label: "Nobody" }, ...people.map((p) => ({ value: p.id, label: p.name }))], get: (r) => r.assigneeId ?? "none" },
    { key: "client", label: "Client", type: "select", get: (r) => r.companyName },
    { key: "overdue", label: "Service level", type: "select", options: [{ value: "late", label: "Past the service level" }, { value: "ok", label: "On time" }], get: (r) => (r.sla.overdue ? "late" : "ok") },
    { key: "created", label: "Opened", type: "date", get: (r) => r.createdAt.slice(0, 10) },
    ...custom.viewFields,
  ];
  const filtered = applyView(rows, view, fields, (r) => `${r.number} ${r.subject} ${r.companyName}`);
  const narrowed = view.q.trim() !== "" || view.filters.length > 0;
  const shown = filtered.filter((r) => (filter === "all" ? true : filter === "mine" ? r.assigneeId === user.id && r.status !== "resolved" : filter === "open" ? r.status === "open" : r.status === filter));
  const resolved = rows.filter((r) => r.status === "resolved" && r.firstResponseAt);
  const onTime = resolved.length
    ? Math.round(
        (resolved.filter((r) => {
          const t = TICKET_CATEGORIES[r.category].firstHours * (r.priority === "urgent" ? 0.5 : 1) * 3_600_000;
          return new Date(r.firstResponseAt!).getTime() - new Date(r.createdAt).getTime() <= t;
        }).length /
          resolved.length) *
          100,
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title m-0">Support</h1>
          <p className="m-0 text-[14px] text-text-2">Client issues, most urgent first. Open tickets lower the client's health score.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          + New ticket
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Needs us" value={String(open.length)} caption="Open, waiting for our reply or fix" tone={open.length ? "amber" : "text"} />
        <KpiCard
          title="Past the service level"
          value={String(overdue.length)}
          caption="Reply or fix overdue"
          tone={overdue.length ? "coral" : "mint"}
          active={view.filters.some((f) => f.key === "overdue" && f.values?.includes("late"))}
          onClick={() => (setFilter("all"), setView({ ...view, filters: [...view.filters.filter((f) => f.key !== "overdue"), { key: "overdue", values: ["late"] }] }))}
        />
        <KpiCard title="Waiting on client" value={String(rows.filter((r) => r.status === "waiting").length)} caption="Doesn't count against the fix time" />
        <KpiCard title="First reply on time" value={onTime === null ? "—" : `${onTime}%`} caption="Of resolved tickets" tone={onTime !== null && onTime >= 90 ? "mint" : "text"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Filter tickets" className="mr-auto flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} className={`h-8 rounded-full border px-3.5 text-[12px] ${filter === f.key ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-2 hover:text-text"}`}>
            {f.label}
          </button>
        ))}
      </div>
      </div>
      <ViewBar page="support" fields={fields} rows={rows} value={view} onChange={setView} placeholder="Number, subject, client" />

      {shown.length ? <TicketList rows={shown} hrefOf={(t) => `?open=${t.id}`} /> : <EmptyState title={narrowed ? "No ticket matches these filters." : filter === "open" ? "Nothing needs us right now." : "No tickets here."} />}
      <NewTicket open={creating} onClose={() => setCreating(false)} onCreated={load} />
      <Drawer
        open={!!openId}
        onClose={() => {
          const next = new URLSearchParams(params);
          next.delete("open");
          setParams(next, { replace: true });
        }}
        title="Ticket"
        width={760}
      >
        {openId ? (
          <div className="p-5">
            <TicketRecord id={openId} panel onChanged={load} />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default Support;
