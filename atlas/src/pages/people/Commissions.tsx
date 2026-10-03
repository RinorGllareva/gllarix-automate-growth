import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { DataTable } from "@/components/DataTable";
import { Field, RowMenu, useRun } from "@/components/ui/actions";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal } from "@/components/ui/overlay";
import { Avatar, EmptyState, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { ViewBar } from "@/components/ViewBar";
import { data, type Commission, type User, type ViewState } from "@/data";
import { applyView, EMPTY_VIEW, type ViewField } from "@/services/views";

const TYPE_LABEL: Record<Commission["type"], string> = {
  meeting_bonus: "Meeting bonus",
  setup_commission: "Setup commission",
  recurring_commission: "Recurring commission",
  quarter_bonus: "Quarter bonus",
};
const STATUS: Record<Commission["status"], { label: string; hue: Hue; help: string }> = {
  pending: { label: "Pending", hue: "amber", help: "Waiting on approval or on the client's payment" },
  earned: { label: "Earned", hue: "cyan", help: "Approved: to pay by the 5th" },
  paid: { label: "Paid", hue: "mint", help: "Paid out" },
  clawed_back: { label: "Clawed back", hue: "coral", help: "The client cancelled or didn't pay inside the window" },
  void: { label: "Void", hue: "text-3", help: "Cancelled" },
};
type Target = "earned" | "paid" | "void" | "clawed_back";
const ACTION: Record<Target, { label: string; from: Commission["status"][]; needsReason: boolean; who: "admin" | "payer" }> = {
  earned: { label: "Approve (earned)", from: ["pending"], needsReason: false, who: "admin" },
  paid: { label: "Mark paid", from: ["earned"], needsReason: true, who: "payer" },
  void: { label: "Void", from: ["pending", "earned"], needsReason: true, who: "admin" },
  clawed_back: { label: "Claw back", from: ["earned", "paid"], needsReason: true, who: "admin" },
};
const money = (minor: number, c: "USD" | "EUR") => `${c === "USD" ? "$" : "€"}${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** Totals per currency, never added across currencies: "$450 + €120". */
const byCurrency = (rows: Commission[]) => {
  const t = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.currency]: (m[r.currency] ?? 0) + r.amountMinor }), {});
  const parts = (Object.entries(t) as ["USD" | "EUR", number][]).map(([c, n]) => money(n, c));
  return parts.length ? parts.join(" + ") : money(0, "USD");
};

/**
 * People › Bonuses and commissions. Sellers see their own money; founders approve, void and claw back; the accountant
 * (and founders) mark lines paid with the transfer reference. Every change needs a reason and is audited.
 */
const Commissions = () => {
  const me = useUser();
  const run = useRun();
  const [rows, setRows] = useState<Commission[] | null>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<{ target: Target; ids: string[] } | null>(null);
  const [reason, setReason] = useState("");
  const everyone = me.role === "admin" || me.role === "viewer";
  usePageChrome({ context: everyone ? "People · everyone's bonuses" : "People · your bonuses" });

  const load = useCallback(() => data.listCommissions().then(setRows, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
    if (everyone) data.listUsers().then(setPeople, () => setPeople([]));
  }, [load, everyone]);

  const nameOf = useMemo(() => (id: string) => people.find((p) => p.id === id)?.name ?? (id === me.id ? me.name : "Former teammate"), [people, me]);
  if (error) return <EmptyState title={error} />;
  if (!rows) return <SkeletonRows rows={6} />;

  const can = (t: Target) => (ACTION[t].who === "admin" ? me.role === "admin" : me.role === "admin" || me.role === "viewer");
  const fields: ViewField<Commission>[] = [
    { key: "status", label: "Status", type: "select", options: (Object.keys(STATUS) as Commission["status"][]).map((s) => ({ value: s, label: STATUS[s].label })), get: (r) => r.status },
    ...(everyone ? [{ key: "person", label: "Person", type: "select" as const, options: [...new Set(rows.map((r) => r.userId))].map((id) => ({ value: id, label: nameOf(id) })), get: (r: Commission) => r.userId }] : []),
    { key: "period", label: "Month", type: "select", options: [...new Set(rows.map((r) => r.period))].sort().reverse().map((p) => ({ value: p, label: p })), get: (r) => r.period },
    { key: "type", label: "Type", type: "select", options: (Object.keys(TYPE_LABEL) as Commission["type"][]).map((t) => ({ value: t, label: TYPE_LABEL[t] })), get: (r) => r.type },
    { key: "currency", label: "Currency", type: "select", get: (r) => r.currency },
    { key: "amount", label: "Amount", type: "number", get: (r) => r.amountMinor / 100 },
  ];
  const statusFilter = view.filters.find((f) => f.key === "status")?.values ?? [];
  const personFilter = view.filters.find((f) => f.key === "person")?.values ?? [];
  const toggleStatus = (s: Commission["status"]) =>
    setView({ ...view, filters: [...view.filters.filter((f) => f.key !== "status"), ...(statusFilter.length === 1 && statusFilter[0] === s ? [] : [{ key: "status", values: [s] }])] });
  const shown = applyView(rows, view, fields, (r) => `${nameOf(r.userId)} ${TYPE_LABEL[r.type]} ${r.note ?? ""}`).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pick = rows.filter((r) => selected.has(r.id));
  const open = (target: Target, ids: string[]) => {
    setReason("");
    setActing({ target, ids });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Bonuses and commissions</h1>
        <p className="m-0 text-[14px] text-text-2">$15 per approved meeting, plus setup and recurring commission on won deals. Commission is paid on cash collected, after a 30-day clawback window. Paid by the 5th.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(["pending", "earned", "paid", "clawed_back"] as const).map((s) => (
          <KpiCard
            key={s}
            title={s === "earned" ? "To pay" : STATUS[s].label}
            value={byCurrency(rows.filter((r) => r.status === s && (!personFilter.length || personFilter.includes(r.userId))))}
            caption={STATUS[s].help}
            tone={s === "pending" ? "amber" : s === "earned" ? "cyan" : s === "paid" ? "mint" : "coral"}
            active={statusFilter.length === 1 && statusFilter[0] === s}
            onClick={() => toggleStatus(s)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ViewBar page="commissions" fields={fields} rows={rows} value={view} onChange={setView} placeholder="Person, type or note" />
        <span className="ml-auto text-[13px] text-text-2">
          {shown.length} lines · {byCurrency(shown)}
        </span>
      </div>

      {pick.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-line bg-surface px-3 py-2 text-[13px]" role="toolbar" aria-label="Selected lines">
          <span className="text-cyan">
            {pick.length} selected · {byCurrency(pick)}
          </span>
          {(Object.keys(ACTION) as Target[])
            .filter((t) => can(t) && pick.some((r) => ACTION[t].from.includes(r.status)))
            .map((t) => (
              <button key={t} type="button" className={t === "void" || t === "clawed_back" ? "btn-ghost h-8 text-[12px] text-coral" : "btn-outline h-8 text-[12px]"} onClick={() => open(t, pick.filter((r) => ACTION[t].from.includes(r.status)).map((r) => r.id))}>
                {ACTION[t].label}
              </button>
            ))}
          <button type="button" className="btn-ghost ml-auto h-8 text-[12px]" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      <DataTable<Commission>
        id="commissions"
        label="Commission lines"
        minWidth={820}
        rows={shown}
        rowKey={(r) => r.id}
        defaultSort={{ key: "period", dir: "desc" }}
        selection={
          me.role === "admin" || me.role === "viewer"
            ? {
                isSelected: (id) => selected.has(id),
                toggle: (id) => setSelected((x) => new Set(x.has(id) ? [...x].filter((y) => y !== id) : [...x, id])),
                allSelected: shown.length > 0 && shown.every((r) => selected.has(r.id)),
                toggleAll: () => setSelected((x) => (shown.every((r) => x.has(r.id)) ? new Set() : new Set(shown.map((r) => r.id)))),
                label: (r) => `Select ${TYPE_LABEL[r.type]} for ${nameOf(r.userId)}, ${r.period}`,
              }
            : undefined
        }
        empty={<EmptyState title={rows.length ? "No lines match these filters." : "Nothing here yet. Approved meetings and won deals add lines automatically."} />}
        columns={[
          {
            key: "person",
            header: "Person",
            width: "minmax(0,1.2fr)",
            sortValue: (r) => nameOf(r.userId),
            render: (r) => (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar id={r.userId} name={nameOf(r.userId)} size={22} />
                <span className="truncate">{nameOf(r.userId)}</span>
              </span>
            ),
          },
          {
            key: "what",
            header: "What",
            width: "minmax(0,1.3fr)",
            sortValue: (r) => r.type,
            render: (r) => (
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{TYPE_LABEL[r.type]}</span>
                {r.note ? <span className="truncate text-[12px] text-text-3">{r.note}</span> : null}
              </span>
            ),
          },
          { key: "period", header: "Month", width: "90px", sortValue: (r) => r.period, render: (r) => <span className="num text-text-2">{r.period}</span> },
          {
            key: "status",
            header: "Status",
            width: "120px",
            sortValue: (r) => r.status,
            render: (r) => (
              <span title={STATUS[r.status].help}>
                <Pill hue={STATUS[r.status].hue} dot>
                  {STATUS[r.status].label}
                </Pill>
              </span>
            ),
          },
          { key: "amount", header: "Amount", width: "100px", align: "right", sortValue: (r) => r.amountMinor, render: (r) => <span className="num">{money(r.amountMinor, r.currency)}</span> },
          {
            key: "actions",
            header: "",
            width: "40px",
            render: (r) => (
              <RowMenu
                label={`Actions for this line`}
                items={(Object.keys(ACTION) as Target[]).map((t) => ({ label: ACTION[t].label, danger: t === "void" || t === "clawed_back", hidden: !can(t) || !ACTION[t].from.includes(r.status), onSelect: () => open(t, [r.id]) }))}
              />
            ),
          },
        ]}
      />

      <Modal open={!!acting} onClose={() => setActing(null)} title={acting ? `${ACTION[acting.target].label} · ${acting.ids.length} line${acting.ids.length > 1 ? "s" : ""}` : ""}>
        {acting ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const n = acting.ids.length;
              if (await run(() => data.setCommissionStatus(acting.ids, acting.target, reason), `${n} line${n > 1 ? "s" : ""} ${STATUS[acting.target].label.toLowerCase()}`)) {
                setActing(null);
                setSelected(new Set());
                load();
              }
            }}
          >
            <span className="text-[13px] text-text-2">{byCurrency(rows.filter((r) => acting.ids.includes(r.id)))} · the people paid get a notification.</span>
            <Field label={acting.target === "paid" ? "Transfer reference (date, method)" : ACTION[acting.target].needsReason ? "Reason (the person sees it)" : "Note (optional)"}>
              <input className="input" required={ACTION[acting.target].needsReason} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={acting.target === "paid" ? "Wise · 4 Oct · ref 81723" : ""} />
            </Field>
            <button type="submit" className={acting.target === "void" || acting.target === "clawed_back" ? "btn-danger" : "btn-primary"} disabled={ACTION[acting.target].needsReason && !reason.trim()}>
              {ACTION[acting.target].label}
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default Commissions;
