import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { DataTable } from "@/components/DataTable";
import { Field, RowMenu, useDeleteWithUndo, useRun } from "@/components/ui/actions";
import { EmptyState, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { USD_PER_EUR } from "@/config/targets";
import { ViewBar } from "@/components/ViewBar";
import { data, type CashSnapshot, type Expense, type ViewState } from "@/data";
import { applyView, EMPTY_VIEW, type ViewField } from "@/services/views";
import MonthClose from "./MonthClose";

const CATEGORIES: Expense["category"][] = ["people", "tools", "data", "usage", "freelance", "marketing", "admin", "fees"];
const CATEGORY_HUE: Record<Expense["category"], Hue> = { people: "amber", tools: "blue", data: "teal", usage: "cyan", freelance: "lavender", marketing: "pink", admin: "text-3", fees: "orange" };
const fmt = (minor: number, c: "USD" | "EUR") => `${c === "USD" ? "$" : "€"}${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/** Money › Finance: cash on hand, monthly costs and runway, plus the expense and cash logs (the AI co-founder reads these). */
const Finance = () => {
  const toast = useToast();
  // Founders log costs and cash; the accountant reads.
  const canEdit = useUser().role === "admin";
  const [fin, setFin] = useState<{ expenses: Expense[]; cash: CashSnapshot[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exp, setExp] = useState({ date: new Date().toISOString().slice(0, 10), vendor: "", category: "tools" as Expense["category"], amount: "", currency: "EUR" as "EUR" | "USD", recurring: true, note: "" });
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editingCash, setEditingCash] = useState<CashSnapshot | null>(null);
  const remove = useDeleteWithUndo();
  const [cash, setCash] = useState({ date: new Date().toISOString().slice(0, 10), amount: "" });
  usePageChrome({ context: "Money · finance" });

  const load = useCallback(() => data.listFinanceData().then(setFin, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const sums = useMemo(() => {
    if (!fin) return null;
    const latest = [...fin.cash].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    // Everything in EUR at the planning rate (Admin › Settings), the same rate the AI co-founder uses.
    const inEur = (x: Expense) => (x.currency === "USD" ? x.amountMinor / USD_PER_EUR : x.amountMinor);
    const recurring = fin.expenses.filter((x) => x.recurring);
    const eur = Math.round(recurring.reduce((n, x) => n + inEur(x), 0));
    const usdPart = recurring.filter((x) => x.currency === "USD").reduce((n, x) => n + x.amountMinor, 0);
    const byCat = CATEGORIES.map((c) => ({ c, n: Math.round(recurring.filter((x) => x.category === c).reduce((s, x) => s + inEur(x), 0)) })).filter((x) => x.n > 0);
    return { latest, eur, usd: usdPart, runway: latest && eur ? latest.balanceMinor / eur : null, byCat };
  }, [fin]);

  if (error) return <EmptyState title={error} />;
  if (!fin || !sums) return <SkeletonRows rows={6} />;
  const fields: ViewField<Expense>[] = [
    { key: "category", label: "Category", type: "select", options: CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })), get: (x) => x.category },
    {
      key: "billing",
      label: "Billing",
      type: "select",
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "oneoff", label: "One-off" },
      ],
      get: (x) => (x.recurring ? "monthly" : "oneoff"),
    },
    { key: "date", label: "Date", type: "date", get: (x) => x.date },
    { key: "vendor", label: "Vendor", type: "select", get: (x) => x.vendor },
    { key: "currency", label: "Currency", type: "select", get: (x) => x.currency },
    { key: "amount", label: "Amount", type: "number", get: (x) => x.amountMinor / 100 },
    {
      key: "source",
      label: "Source",
      type: "select",
      options: [
        { value: "manual", label: "Added by hand" },
        { value: "bank_export", label: "Imported" },
        { value: "stripe", label: "Stripe" },
      ],
      get: (x) => x.source,
    },
  ];
  const rows = applyView(fin.expenses, view, fields, (x) => `${x.vendor} ${x.note ?? ""}`);
  const maxCat = Math.max(1, ...sums.byCat.map((x) => x.n));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Finance</h1>
        <p className="m-0 text-[14px] text-text-2">Cash, monthly costs and runway. The AI co-founder uses these numbers when it answers money questions.</p>
      </div>

      <MonthClose fin={fin} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Cash on hand" value={sums.latest ? fmt(sums.latest.balanceMinor, "EUR") : "—"} caption={sums.latest ? `Snapshot of ${sums.latest.date}` : "Add a snapshot below"} tone="mint" />
        <KpiCard title="Monthly costs" value={fmt(sums.eur, "EUR")} caption={sums.usd ? `Incl. ${fmt(sums.usd, "USD")} billed in USD at €1 = $${USD_PER_EUR}` : "Recurring expenses"} />
        <KpiCard title="Runway" value={sums.runway === null ? "—" : `${sums.runway.toFixed(1)} mo`} caption="Cash ÷ monthly costs" tone={sums.runway !== null && sums.runway < 6 ? "amber" : "cyan"} />
        <KpiCard title="Expenses logged" value={String(fin.expenses.length)} caption={`${fin.expenses.filter((x) => x.recurring).length} monthly · ${fin.expenses.filter((x) => !x.recurring).length} one-off`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Expenses" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">Expenses</span>
            <ViewBar page="expenses" fields={fields} rows={fin.expenses} value={view} onChange={setView} placeholder="Vendor or note" />
          </div>
          <DataTable<Expense>
            id="expenses"
            label="Expenses"
            minWidth={640}
            rows={rows}
            rowKey={(x) => x.id}
            defaultSort={{ key: "date", dir: "desc" }}
            empty={<EmptyState title={fin.expenses.length ? "No expense matches these filters." : "No expenses yet. Add the first one below."} />}
            footer={rows.length ? <span>{rows.length} expenses · {fmt(Math.round(rows.reduce((n, x) => n + (x.currency === "USD" ? x.amountMinor / USD_PER_EUR : x.amountMinor), 0)), "EUR")} in EUR at the planning rate</span> : null}
            columns={[
              { key: "date", header: "Date", width: "96px", sortValue: (x) => x.date, render: (x) => <span className="num text-text-2">{x.date}</span> },
              {
                key: "vendor",
                header: "Vendor",
                width: "minmax(0,1.4fr)",
                sortValue: (x) => x.vendor.toLowerCase(),
                render: (x) => (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{x.vendor}</span>
                    {x.note ? <span className="truncate text-[12px] text-text-3">{x.note}</span> : null}
                  </span>
                ),
              },
              {
                key: "category",
                header: "Category",
                width: "110px",
                hideable: true,
                sortValue: (x) => x.category,
                render: (x) => (
                  <Pill hue={CATEGORY_HUE[x.category]} className="capitalize">
                    {x.category}
                  </Pill>
                ),
              },
              { key: "billing", header: "Billing", width: "84px", hideable: true, sortValue: (x) => (x.recurring ? 0 : 1), render: (x) => <span className="text-[12px] text-text-3">{x.recurring ? "Monthly" : "One-off"}</span> },
              { key: "amount", header: "Amount", width: "100px", align: "right", sortValue: (x) => (x.currency === "USD" ? x.amountMinor / USD_PER_EUR : x.amountMinor), render: (x) => <span className="num">{fmt(x.amountMinor, x.currency)}</span> },
              ...(canEdit
                ? [
                    {
                      key: "actions",
                      header: "",
                      width: "40px",
                      render: (x: Expense) => (
                        <RowMenu
                          label={`Actions for ${x.vendor}`}
                          items={[
                            { label: "Edit", onSelect: () => setEditing(x) },
                            { label: "Delete", danger: true, onSelect: () => remove(`${x.vendor} expense`, () => data.deleteExpense(x.id), load) },
                          ]}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <form
            className={`${canEdit ? "flex" : "hidden"} card flex-wrap items-end gap-2 px-4 py-3`}
            aria-label="Add an expense"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await data.addExpense({ date: exp.date, vendor: exp.vendor, category: exp.category, amountMinor: Math.round(Number(exp.amount) * 100), currency: exp.currency, recurring: exp.recurring, note: exp.note.trim() || null });
                setExp({ ...exp, vendor: "", amount: "", note: "" });
                toast("Expense added", "good");
                load();
              } catch (err) {
                toast((err as Error).message, "error");
              }
            }}
          >
            <input className="input w-auto" type="date" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} aria-label="Date" />
            <input className="input w-44" placeholder="Vendor" value={exp.vendor} onChange={(e) => setExp({ ...exp, vendor: e.target.value })} aria-label="Vendor" />
            <select className="input w-auto capitalize" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value as Expense["category"] })} aria-label="Category">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input className="input w-28 font-mono" type="number" step="0.01" placeholder="Amount" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} aria-label="Amount" />
            <select className="input w-auto" value={exp.currency} onChange={(e) => setExp({ ...exp, currency: e.target.value as "EUR" | "USD" })} aria-label="Currency">
              <option>EUR</option>
              <option>USD</option>
            </select>
            <input className="input w-44" placeholder="Note (optional)" value={exp.note} onChange={(e) => setExp({ ...exp, note: e.target.value })} aria-label="Note" />
            <label className="flex h-9 items-center gap-2 text-[13px] text-text-2">
              <input type="checkbox" checked={exp.recurring} onChange={(e) => setExp({ ...exp, recurring: e.target.checked })} /> Monthly
            </label>
            <button type="submit" className="btn-primary" disabled={!exp.vendor || !exp.amount}>
              Add expense
            </button>
          </form>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-label="Monthly costs by category" className="card flex flex-col gap-3 p-5">
            <span className="text-[14px] font-semibold">Where the money goes</span>
            {sums.byCat.map(({ c, n }) => (
              <div key={c} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="capitalize">{c}</span>
                  <span className="num text-text-2">{fmt(n, "EUR")}</span>
                </div>
                <div className="h-1.5 rounded-full bg-line">
                  <div className="h-1.5 rounded-full" style={{ width: `${(n / maxCat) * 100}%`, background: `var(--${CATEGORY_HUE[c]})` }} />
                </div>
              </div>
            ))}
            {!sums.byCat.length ? <span className="text-[13px] text-text-3">No monthly costs yet.</span> : null}
            <span className="text-[12px] text-text-3">Monthly expenses in EUR (USD at the planning rate).</span>
          </section>

          <section aria-label="Cash snapshots" className="card flex flex-col p-5">
            <span className="pb-3 text-[14px] font-semibold">Cash snapshots</span>
            {[...fin.cash]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 border-b border-line-soft py-2 text-[13px] last:border-b-0">
                  <span className="num text-text-2">{c.date}</span>
                  <span className="text-text-3">{c.source === "manual" ? "Manual" : "Bank export"}</span>
                  <span className="num ml-auto">{fmt(c.balanceMinor, "EUR")}</span>
                  {canEdit ? (
                    <RowMenu
                      label={`Actions for the ${c.date} snapshot`}
                      items={[
                        { label: "Edit", onSelect: () => setEditingCash(c) },
                        { label: "Delete", danger: true, onSelect: () => remove(`${c.date} cash snapshot`, () => data.deleteCashSnapshot(c.id), load) },
                      ]}
                    />
                  ) : null}
                </div>
              ))}
            <form
              className={`mt-3 ${canEdit ? "flex" : "hidden"} flex-wrap items-end gap-2`}
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await data.addCashSnapshot({ date: cash.date, balanceMinor: Math.round(Number(cash.amount) * 100) });
                  setCash({ ...cash, amount: "" });
                  toast("Cash snapshot added", "good");
                  load();
                } catch (err) {
                  toast((err as Error).message, "error");
                }
              }}
            >
              <input className="input w-auto" type="date" value={cash.date} onChange={(e) => setCash({ ...cash, date: e.target.value })} aria-label="Date" />
              <input className="input w-32 font-mono" type="number" step="0.01" placeholder="Balance €" value={cash.amount} onChange={(e) => setCash({ ...cash, amount: e.target.value })} aria-label="Balance in EUR" />
              <button type="submit" className="btn-outline" disabled={!cash.amount}>
                Add snapshot
              </button>
            </form>
          </section>
        </div>
      </div>
      {editing ? <ExpenseEdit expense={editing} onClose={() => setEditing(null)} onSaved={load} /> : null}
      {editingCash ? <CashEdit snapshot={editingCash} onClose={() => setEditingCash(null)} onSaved={load} /> : null}
    </div>
  );
};

const ExpenseEdit = ({ expense, onClose, onSaved }: { expense: Expense; onClose: () => void; onSaved: () => void }) => {
  const run = useRun();
  const [f, setF] = useState({ date: expense.date, vendor: expense.vendor, category: expense.category, amount: String(expense.amountMinor / 100), currency: expense.currency, recurring: expense.recurring, note: expense.note ?? "" });
  return (
    <Modal open onClose={onClose} title={`Edit · ${expense.vendor}`}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(
            () => data.updateExpense(expense.id, { date: f.date, vendor: f.vendor, category: f.category, amountMinor: Math.round(Number(f.amount) * 100), currency: f.currency, recurring: f.recurring, note: f.note.trim() || null }),
            "Expense saved",
          );
          if (ok) {
            onSaved();
            onClose();
          }
        }}
      >
        <Field label="Vendor" wide>
          <input className="input" required value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Category">
          <select className="input capitalize" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Expense["category"] })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input className="input font-mono" type="number" step="0.01" min="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Currency">
          <select className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as "EUR" | "USD" })}>
            <option>EUR</option>
            <option>USD</option>
          </select>
        </Field>
        <Field label="Note" wide>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Annual plan, renews in March" />
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-text-2 sm:col-span-2">
          <input type="checkbox" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} /> Charged every month
        </label>
        <button type="submit" className="btn-primary sm:col-span-2">
          Save
        </button>
      </form>
    </Modal>
  );
};

const CashEdit = ({ snapshot, onClose, onSaved }: { snapshot: CashSnapshot; onClose: () => void; onSaved: () => void }) => {
  const run = useRun();
  const [f, setF] = useState({ date: snapshot.date, amount: String(snapshot.balanceMinor / 100) });
  return (
    <Modal open onClose={onClose} title="Edit cash snapshot">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => data.updateCashSnapshot(snapshot.id, { date: f.date, balanceMinor: Math.round(Number(f.amount) * 100) }), "Snapshot saved")) {
            onSaved();
            onClose();
          }
        }}
      >
        <Field label="Date">
          <input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Balance (EUR)">
          <input className="input font-mono" type="number" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <button type="submit" className="btn-primary sm:col-span-2">
          Save
        </button>
      </form>
    </Modal>
  );
};

export default Finance;
