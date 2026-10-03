import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { EmptyState, SkeletonRows, StatusChip } from "@/components/ui/primitives";
import { USD_PER_EUR } from "@/config/targets";
import { data, type DailyBdrReport, type KpiRow, type User, type WeeklyReport } from "@/data";
import { downloadText } from "@/lib/format";
import { isoWeekKey, localDateKey, shiftWeek } from "@/services/time";

const FUNNEL_TONES = ["bg-line-button", "bg-cyan-line", "bg-text-3", "bg-cyan", "bg-mint", "bg-lavender"];
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const fmtKpi = (k: KpiRow) => (k.value === null ? "—" : k.unit === "pct" ? pct(k.value) : k.unit === "rate" ? k.value.toFixed(1) : String(Math.round(k.value * 10) / 10));
const MONTH_LABEL = (key: string) => new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));

const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

const MRR_CHIP = {
  ahead: { label: "Ahead", cls: "border-mint text-mint" },
  on_plan: { label: "On plan", cls: "border-cyan text-cyan" },
  behind: { label: "Behind", cls: "border-coral text-coral" },
} as const;

const MrrChart = ({ report }: { report: WeeklyReport }) => {
  const W = 520;
  const H = 180;
  const max = Math.max(12000, ...report.mrr.map((p) => Math.max(p.planEur, p.actualEur ?? 0)));
  const x = (i: number) => 36 + (i * (W - 56)) / (report.mrr.length - 1);
  const y = (v: number) => H - 28 - (v / max) * (H - 48);
  const plan = report.mrr.map((p, i) => `${x(i)},${y(p.planEur)}`).join(" ");
  const actual = report.mrr.filter((p) => p.actualEur !== null);
  const last = actual[actual.length - 1];
  const lastIdx = report.mrr.indexOf(last);
  const june = report.mrr[report.mrr.length - 1];
  return (
    <section aria-label="MRR against the €10k plan" className="card flex min-w-0 flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="label-caps">MRR · €10k plan</span>
        <span className={`chip ${MRR_CHIP[report.mrrStatus].cls}`}>{MRR_CHIP[report.mrrStatus].label}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Actual MRR €${last?.actualEur ?? 0} against plan`}>
        {[0, 5000, 10000].map((v) => (
          <g key={v}>
            <line x1={36} x2={W - 20} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={0} y={y(v) + 4} fontSize="10" fill="var(--text-3)" fontFamily="var(--mono)">
              {v ? `€${v / 1000}k` : "0"}
            </text>
          </g>
        ))}
        <polyline points={plan} fill="none" stroke="var(--lavender)" strokeWidth="1.5" strokeDasharray="5 4" />
        {actual.length > 1 ? <polyline points={actual.map((p, i) => `${x(i)},${y(p.actualEur!)}`).join(" ")} fill="none" stroke="var(--cyan)" strokeWidth="2" /> : null}
        {last ? <circle cx={x(lastIdx)} cy={y(last.actualEur!)} r="4" fill="var(--cyan)" /> : null}
        {report.mrr.map((p, i) => (
          <text key={p.month} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--text-3)">
            {MONTH_LABEL(p.month)}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap justify-between gap-2 text-[12px] text-text-2">
        <span>
          Actual <span className="num text-cyan">€{(last?.actualEur ?? 0).toLocaleString("en-US")}</span>
        </span>
        <span>
          Plan this month <span className="num text-lavender">€{(last?.planEur ?? 0).toLocaleString("en-US")}</span>
        </span>
        <span>
          Plan in June <span className="num">€{june.planEur.toLocaleString("en-US")}</span>
        </span>
      </div>
      <span className="text-[11px] text-text-3">
        MRR = monthly fees of won deals. USD converted at the planning rate {USD_PER_EUR} USD per EUR. Churned clients drop out from the day they churn.
      </span>
    </section>
  );
};

const DailyReportCard = ({ report }: { report: DailyBdrReport | null }) => (
  <section aria-label="Daily BDR report" className="card flex flex-col gap-3 p-5">
    <span className="label-caps">Daily BDR report{report ? ` · ${report.userName} · ${report.date}` : ""}</span>
    {report ? (
      <>
        <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <span>
            <span className="num text-[22px] font-light">{report.dials}</span>
            <span className="block text-[12px] font-medium text-label">Dials</span>
          </span>
          <span>
            <span className="num text-[22px] font-light">{report.conversations}</span>
            <span className="block text-[12px] font-medium text-label">Conversations</span>
          </span>
          <span>
            <span className="num text-[22px] font-light">{report.booked}</span>
            <span className="block text-[12px] font-medium text-label">Booked</span>
          </span>
          <span>
            <span className="num text-[22px] font-light">
              {report.queueDone}/{report.queueTotal}
            </span>
            <span className="block text-[12px] font-medium text-label">Queue</span>
          </span>
        </div>
        {report.outcomes.length ? (
          <span className="text-[12px] text-text-2">{report.outcomes.map((o) => `${o.label} ${o.count}`).join(" · ")}</span>
        ) : (
          <span className="text-[12px] text-text-2">No calls logged yet today.</span>
        )}
        {report.rejections.length ? (
          <div className="flex flex-col gap-1 border-t border-line-soft pt-2.5">
            <span className="text-[12px] font-medium text-coral">Meetings rejected today</span>
            {report.rejections.map((r) => (
              <span key={r.company} className="text-[13px]">
                {r.company} · <span className="text-text-2">{r.reason}</span>
              </span>
            ))}
          </div>
        ) : null}
        <span className="text-[11px] text-text-3">Built at the end of each shift; admins get a notification.</span>
      </>
    ) : (
      <span className="text-[13px] text-text-2">No BDR with a daily queue yet.</span>
    )}
  </section>
);

const Reports = () => {
  const user = useUser();
  const isAdmin = user.role === "admin";
  const [params, setParams] = useSearchParams();
  const kind = params.get("month") ? "month" : "week";
  const todayKey = localDateKey(Date.now(), user.timezone);
  const key = params.get(kind) ?? (kind === "week" ? isoWeekKey(todayKey) : todayKey.slice(0, 7));
  const person = isAdmin ? (params.get("person") ?? "team") : undefined;
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [daily, setDaily] = useState<DailyBdrReport | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([data.report({ kind, key, personId: person }), user.role === "viewer" ? Promise.resolve(null) : data.dailyReport(person && person !== "team" ? person : undefined)])
      .then(([r, d]) => {
        setReport(r);
        setDaily(d);
      })
      .catch((e: Error) => setError(e.message));
  }, [kind, key, person, user.role]);
  useEffect(load, [load]);
  useEffect(() => {
    data.listUsers().then(setUsers);
  }, []);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
    setParams(next);
  };

  usePageChrome({ context: report?.period.label ?? "Reports" });

  if (error) return <EmptyState title={error} action={<button className="btn-outline" type="button" onClick={load}>Retry</button>} />;
  if (!report) return <SkeletonRows rows={8} />;

  const top = report.funnel[0]?.count || 1;
  const exportCsv = () => {
    const rows = [
      ["section", "item", "value", "target_or_rate", "status"],
      ...report.funnel.map((f) => ["funnel", f.label, String(f.count), f.rate === null ? "" : pct(f.rate), ""]),
      ...report.kpis.map((k) => ["kpi", k.label, fmtKpi(k), k.target, k.status ?? ""]),
      ...report.mrr.map((m) => ["mrr_eur", m.month, m.actualEur === null ? "" : String(m.actualEur), String(m.planEur), ""]),
      ...report.gates.map((g) => ["gate", g.label, g.value, `${Math.round(g.progress * 100)}%`, g.met ? "met" : ""]),
    ];
    downloadText(`atlas-report-${report.period.key}.csv`, rows.map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n"));
  };
  const people = users.filter((u) => u.dailyCapacity && u.active);
  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(report.computedAt).getTime()) / 60_000));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="page-title m-0">Reports</h1>
          <span className="text-[12px] text-text-3">Updated {minutesAgo ? `${minutesAgo} min ago` : "just now"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Period" className="flex border border-line-strong">
            {(["week", "month"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => set({ week: null, month: k === "month" ? todayKey.slice(0, 7) : null })}
                className={`h-9 px-3.5 text-[11px] uppercase tracking-[0.2em] ${kind === k ? "bg-ice text-ice-ink" : "text-text-2 hover:text-text"}`}
              >
                {k}
              </button>
            ))}
          </div>
          <button type="button" className="btn-outline h-9 px-3" aria-label="Previous period" onClick={() => set({ [kind]: kind === "week" ? shiftWeek(key, -1) : shiftMonth(key, -1) })}>
            ←
          </button>
          <span className="min-w-40 text-center text-[13px] text-text-2">{report.period.label}</span>
          <button type="button" className="btn-outline h-9 px-3" aria-label="Next period" onClick={() => set({ [kind]: kind === "week" ? shiftWeek(key, 1) : shiftMonth(key, 1) })}>
            →
          </button>
          {isAdmin ? (
            <select aria-label="Person" className="input h-9 w-40" value={person} onChange={(e) => set({ person: e.target.value === "team" ? null : e.target.value })}>
              <option value="team">Whole team</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="btn-outline h-9 text-[11px]" onClick={exportCsv}>
            Export ↓
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="Funnel" className="card flex flex-col gap-3 p-5">
          <span className="label-caps">
            Funnel · {report.personId === "team" ? "team" : (users.find((u) => u.id === report.personId)?.name ?? "you")}
          </span>
          {report.funnel.map((f, i) => (
            <div key={f.key} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 text-[13px]">
              <span className="text-text-2">{f.label}</span>
              <div className="h-6 bg-line-soft">
                <div className={`h-6 ${FUNNEL_TONES[i]}`} style={{ width: `${Math.max(f.count ? 2 : 0, (f.count / top) * 100)}%` }} />
              </div>
              <span className="text-right">
                <span className="num">{f.count}</span>
                {f.rate !== null ? <span className="ml-1.5 font-mono text-[12px] font-medium text-text-3">{pct(f.rate)}</span> : null}
              </span>
            </div>
          ))}
          <span className="text-[12px] font-medium text-text-3">Connects = calls answered by a person. Rates are from the previous step.</span>
        </section>
        <MrrChart report={report} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="KPIs" className="card min-w-0">
          <div className="grid grid-cols-[minmax(0,1.6fr)_80px_minmax(0,1fr)_100px] gap-3 border-b border-line px-5 py-3 text-[12px] font-medium text-text-3 bg-surface-2">
            <span>KPI</span>
            <span>{kind === "week" ? "This week" : "This month"}</span>
            <span>Target</span>
            <span>Status</span>
          </div>
          {report.kpis.map((k) => (
            <div key={k.key} className="grid grid-cols-[minmax(0,1.6fr)_80px_minmax(0,1fr)_100px] items-center gap-3 border-b border-line-soft px-5 py-3 text-[13px] last:border-b-0">
              <span>{k.label}</span>
              <span className="num">{fmtKpi(k)}</span>
              <span className="text-text-2">{k.target}</span>
              <span>{k.status ? <StatusChip status={k.status} /> : <span className="text-text-3">—</span>}</span>
            </div>
          ))}
          <div className="px-5 py-3 text-[12px] font-medium text-text-3">Targets from the sales plan (context/03); "per day" uses business days so far in the period.</div>
        </section>

        <section aria-label="Stage gates" className="card flex flex-col gap-4 p-5">
          <span className="label-caps">Stage gates</span>
          {report.gates.map((g) => (
            <div key={g.key} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3 text-[13px]">
                <span>{g.label}</span>
                <span className={`num ${g.met ? "text-mint" : "text-text-2"}`}>{g.value}</span>
              </div>
              <div className="h-[3px] bg-line">
                <div className={`h-[3px] ${g.met ? "bg-mint" : "bg-cyan"}`} style={{ width: `${g.progress * 100}%` }} />
              </div>
              <span className="text-[12px] text-text-3">{g.note}</span>
            </div>
          ))}
          <span className="text-[11px] text-text-3">Paying client = won deal with a paid deposit. Gate 3's churn check needs Clients (M7).</span>
        </section>
      </div>

      {user.role !== "viewer" ? <DailyReportCard report={daily} /> : null}
    </div>
  );
};

export default Reports;
