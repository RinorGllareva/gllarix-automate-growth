import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, SkeletonRows, Toggle } from "@/components/ui/primitives";
import { ADVISOR_TOOLS, data, type AdvisorSettings, type CashSnapshot, type Expense, type ToolName, type User } from "@/data";

const CATEGORIES: Expense["category"][] = ["people", "tools", "data", "usage", "freelance", "marketing", "admin", "fees"];
const fmt = (minor: number, c: "USD" | "EUR") => `${c === "USD" ? "$" : "€"}${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Admin › AI co-founder (A19): who may use it, tools per person, the monthly cap, and the finance data it reads. */
const AdvisorSection = () => {
  const toast = useToast();
  const [settings, setSettings] = useState<AdvisorSettings | null>(null);
  const [fin, setFin] = useState<{ expenses: Expense[]; cash: CashSnapshot[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exp, setExp] = useState({ date: new Date().toISOString().slice(0, 10), vendor: "", category: "tools" as Expense["category"], amount: "", currency: "EUR" as "EUR" | "USD", recurring: true });
  const [cash, setCash] = useState({ date: new Date().toISOString().slice(0, 10), amount: "" });
  const [toolUser, setToolUser] = useState("u-bdr");
  const [users, setUsers] = useState<User[]>([]);

  const load = useCallback(async () => {
    try {
      setSettings(await data.advisorSettings());
      setFin(await data.listFinanceData());
      setUsers(await data.listUsers());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: Partial<AdvisorSettings>, msg = "Saved") => {
    try {
      await data.setAdvisorSettings(patch);
      toast(msg, "good");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (error) return <EmptyState title={error} />;
  if (!settings || !fin) return <SkeletonRows rows={6} />;
  const off = settings.disabledTools[toolUser] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-[34px] font-light tracking-[-0.02em]">AI co-founder</h1>

      <section aria-label="Access" className="card flex flex-col gap-3 p-5">
        <span className="label-caps">Who can ask · admins always</span>
        {(["bdr", "closer", "implementer", "viewer"] as const).map((r) => (
          <div key={r} className="flex items-center justify-between text-[13px]">
            <span>{{ bdr: "BDR", closer: "Closer", implementer: "Implementer", viewer: "Viewer (off by default)" }[r]}</span>
            <Toggle checked={settings.roles[r]} onChange={(v) => save({ roles: { ...settings.roles, [r]: v } })} label={settings.roles[r] ? "On" : "Off"} />
          </div>
        ))}
        <span className="text-[12px] text-text-3">Tools still follow each role's access: a BDR never gets finance or other people's data.</span>
      </section>

      <section aria-label="Tools per person" className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label-caps">Tools switched off for</span>
          <select className="input h-9 w-auto" value={toolUser} onChange={(e) => setToolUser(e.target.value)} aria-label="Person">
            {users.filter((u) => u.active).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {ADVISOR_TOOLS.map((t) => (
            <label key={t} className="flex items-center gap-2 font-mono text-[12px]">
              <input
                type="checkbox"
                checked={off.includes(t)}
                onChange={(e) => {
                  const next: ToolName[] = e.target.checked ? [...off, t] : off.filter((x) => x !== t);
                  save({ disabledTools: { ...settings.disabledTools, [toolUser]: next } }, e.target.checked ? `${t} off` : `${t} on`);
                }}
              />
              {t}
            </label>
          ))}
        </div>
      </section>

      <section aria-label="Monthly cap" className="card flex flex-wrap items-center justify-between gap-3 p-5 text-[13px]">
        <div className="flex flex-col gap-1">
          <span className="label-caps">Monthly AI cap · planner + advisor</span>
          <span className="text-text-3">New questions are blocked once the month's AI cost reaches the cap.</span>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(new FormData(e.currentTarget).get("cap"));
            save({ monthlyCapMinor: Math.round(v * 100) }, "Cap saved");
          }}
        >
          <span>€</span>
          <input name="cap" className="input h-9 w-24 font-mono" type="number" min={0} step={1} defaultValue={settings.monthlyCapMinor / 100} aria-label="Monthly cap in EUR" />
          <button type="submit" className="btn-outline h-9">
            Save
          </button>
        </form>
      </section>

      <section aria-label="Cash snapshots" className="card flex flex-col p-5">
        <span className="label-caps pb-3">Cash snapshots · compared with the reserve</span>
        {fin.cash.map((c) => (
          <div key={c.id} className="flex justify-between border-b border-line-soft py-2 text-[13px] last:border-b-0">
            <span className="font-mono text-text-2">{c.date}</span>
            <span className="text-text-3">{c.source === "manual" ? "Manual" : "Bank export"}</span>
            <span className="font-mono">{fmt(c.balanceMinor, "EUR")}</span>
          </div>
        ))}
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
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
          <input className="input h-9 w-auto" type="date" value={cash.date} onChange={(e) => setCash({ ...cash, date: e.target.value })} aria-label="Date" />
          <input className="input h-9 w-32 font-mono" type="number" step="0.01" placeholder="Balance €" value={cash.amount} onChange={(e) => setCash({ ...cash, amount: e.target.value })} aria-label="Balance in EUR" />
          <button type="submit" className="btn-outline h-9" disabled={!cash.amount}>
            Add snapshot
          </button>
        </form>
      </section>

      <section aria-label="Expenses" className="card flex flex-col p-5">
        <span className="label-caps pb-3">Expenses · {fin.expenses.length}</span>
        <div className="max-h-[320px] overflow-y-auto">
          {fin.expenses.map((x) => (
            <div key={x.id} className="grid grid-cols-[90px_1fr_90px_70px_100px] items-center gap-2 border-b border-line-soft py-2 text-[13px] last:border-b-0">
              <span className="font-mono text-text-2">{x.date}</span>
              <span className="truncate">{x.vendor}</span>
              <span className="capitalize text-text-3">{x.category}</span>
              <span className="text-[11px] text-text-3">{x.recurring ? "Monthly" : "One-off"}</span>
              <span className="text-right font-mono">{fmt(x.amountMinor, x.currency)}</span>
            </div>
          ))}
        </div>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
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
          <input className="input h-9 w-auto" type="date" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} aria-label="Date" />
          <input className="input h-9 w-44" placeholder="Vendor" value={exp.vendor} onChange={(e) => setExp({ ...exp, vendor: e.target.value })} aria-label="Vendor" />
          <select className="input h-9 w-auto" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value as Expense["category"] })} aria-label="Category">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input className="input h-9 w-24 font-mono" type="number" step="0.01" placeholder="Amount" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} aria-label="Amount" />
          <select className="input h-9 w-auto" value={exp.currency} onChange={(e) => setExp({ ...exp, currency: e.target.value as "EUR" | "USD" })} aria-label="Currency">
            <option>EUR</option>
            <option>USD</option>
          </select>
          <label className="flex h-9 items-center gap-2 text-[13px]">
            <input type="checkbox" checked={exp.recurring} onChange={(e) => setExp({ ...exp, recurring: e.target.checked })} /> Monthly
          </label>
          <button type="submit" className="btn-outline h-9" disabled={!exp.vendor || !exp.amount}>
            Add expense
          </button>
        </form>
      </section>
    </div>
  );
};

export default AdvisorSection;
