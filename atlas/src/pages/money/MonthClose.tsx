import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Icon } from "@/components/ui/primitives";
import { data, type CashSnapshot, type Expense } from "@/data";
import { navForRole } from "@/lib/nav";
import { monthClose, monthToClose, type CloseItem } from "@/services/money";

/**
 * Money › Finance: the month-end close as a checklist, for the accountant and the founders. Six lines, each linking
 * to where it's fixed; done when all six are green and everyone is paid by the 5th.
 */
const MonthClose = ({ fin }: { fin: { expenses: Expense[]; cash: CashSnapshot[] } }) => {
  const role = useUser().role;
  const [items, setItems] = useState<CloseItem[] | null>(null);
  const month = monthToClose(Date.now());
  useEffect(() => {
    let alive = true;
    (async () => {
      const [invoices, payments, meetings, commissions] = await Promise.allSettled([data.listInvoices(), data.listPayments(), data.listMeetings(), data.listCommissions()]);
      const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);
      const out = monthClose({
        month,
        now: Date.now(),
        expenses: fin.expenses,
        cash: fin.cash,
        invoices: ok(invoices),
        payments: ok(payments),
        closedMonths: ok(meetings)?.closedMonths ?? null,
        commissions: ok(commissions),
      });
      if (alive) setItems(out);
    })();
    return () => {
      alive = false;
    };
  }, [fin, month]);

  if (!items) return null;
  const paths = navForRole(role).map((n) => n.path);
  const done = items.filter((i) => i.done).length;
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const due = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 5)));
  const row = "group flex items-start gap-2.5 rounded-lg px-2 py-2";

  return (
    <section aria-label="Month-end close" className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold">Close {label}</span>
        <span className="text-[13px] text-text-2">
          <span className={`num font-semibold ${done === items.length ? "text-mint" : "text-text"}`}>
            {done} of {items.length}
          </span>{" "}
          done · statements paid by {due}
        </span>
      </div>
      <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
        {items.map((i) => {
          const body: ReactNode = (
            <>
              <span
                className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                  i.done ? "border-mint bg-mint/15 text-mint" : i.done === null ? "border-line-strong text-text-3" : "border-amber/60 text-amber"
                }`}
                aria-label={i.done ? "Done" : i.done === null ? "Not visible to you" : "To do"}
              >
                {i.done ? <Icon d="M5 12l5 5L20 7" size={11} /> : i.done === null ? null : <span className="h-1.5 w-1.5 rounded-full bg-amber" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] group-hover:text-text">{i.label}</span>
                <span className="text-[12px] text-text-3">
                  {i.detail} · {i.owner}
                </span>
              </span>
            </>
          );
          // Founder lines can point to pages the accountant can't open: show them, don't link them.
          return paths.includes(i.to) ? (
            <Link key={i.key} to={i.to} className={`${row} hover:bg-surface-2`}>
              {body}
            </Link>
          ) : (
            <div key={i.key} className={row}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default MonthClose;
