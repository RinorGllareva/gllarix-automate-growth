import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { USD_PER_EUR } from "@/config/targets";
import { data, type CashSnapshot, type Expense } from "@/data";
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
  const [exp, setExp] = useState({ date: new Date().toISOString().slice(0, 10), vendor: "", category: "tools" as Expense["category"], amount: "", currency: "EUR" as "EUR" | "USD", recurring: true });
  const [cash, setCash] = useState({ date: new Date().toISOString().slice(0, 10), amount: "" });
  const [cat, setCat] = useState<Expense["category"] | "all">("all");
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
  const rows = fin.expenses.filter((x) => cat === "all" || x.category === cat).sort((a, b) => b.date.localeCompare(a.date));
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
        <section aria-label="Expenses" className="card flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <span className="text-[14px] font-semibold">Expenses</span>
            <div className="flex flex-wrap gap-1">
              {(["all", ...CATEGORIES] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)} className={`h-7 rounded-md px-2.5 text-[12px] capitalize ${cat === c ? "bg-surface-2 text-text shadow-card" : "text-text-3 hover:text-text"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[96px_minmax(0,1fr)_110px_84px_100px] gap-3 border-b border-line-soft px-5 py-2 text-[12px] text-text-3">
            <span>Date</span>
            <span>Vendor</span>
            <span>Category</span>
            <span>Billing</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {rows.map((x) => (
              <div key={x.id} className="grid grid-cols-[96px_minmax(0,1fr)_110px_84px_100px] items-center gap-3 border-b border-line-soft px-5 py-2.5 text-[13px] last:border-b-0 hover:bg-surface-2/50">
                <span className="num text-text-2">{x.date}</span>
                <span className="truncate">{x.vendor}</span>
                <span>
                  <Pill hue={CATEGORY_HUE[x.category]} className="capitalize">
                    {x.category}
                  </Pill>
                </span>
                <span className="text-[12px] text-text-3">{x.recurring ? "Monthly" : "One-off"}</span>
                <span className="num text-right">{fmt(x.amountMinor, x.currency)}</span>
              </div>
            ))}
            {!rows.length ? <p className="m-0 px-5 py-6 text-[13px] text-text-3">No expenses in this category.</p> : null}
          </div>
          <form
            className={`${canEdit ? "flex" : "hidden"} flex-wrap items-end gap-2 border-t border-line px-5 py-4`}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await data.addExpense({ date: exp.date, vendor: exp.vendor, category: exp.category, amountMinor: Math.round(Number(exp.amount) * 100), currency: exp.currency, recurring: exp.recurring, note: null });
                setExp({ ...exp, vendor: "", amount: "" });
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
                <div key={c.id} className="flex justify-between border-b border-line-soft py-2 text-[13px] last:border-b-0">
                  <span className="num text-text-2">{c.date}</span>
                  <span className="text-text-3">{c.source === "manual" ? "Manual" : "Bank export"}</span>
                  <span className="num">{fmt(c.balanceMinor, "EUR")}</span>
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
    </div>
  );
};

export default Finance;
