import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, Icon, Pill, SkeletonRows } from "@/components/ui/primitives";
import type { Hue } from "@/config/colors";
import { COMPLIANCE_OPS, DELIVERY_CAPACITY, PEOPLE_STAGE1, periodKey, RHYTHM, RISKS, SERVICE_LEVELS, SOP_FORMAT, VENDORS, type Cadence } from "@/config/operations";
import { data, type OpsHome, type SopStatus } from "@/data";

const SOP_STATUS: Record<SopStatus, { label: string; hue: Hue }> = {
  not_started: { label: "Not started", hue: "text-3" },
  draft: { label: "Draft", hue: "amber" },
  in_review: { label: "In review", hue: "cyan" },
  done: { label: "Written", hue: "mint" },
};
const LEVEL_HUE: Record<string, Hue> = { High: "coral", Medium: "amber", Low: "mint" };
const GROUPS: { cadence: Cadence; label: string }[] = [
  { cadence: "daily", label: "Today" },
  { cadence: "weekly", label: "This week" },
  { cadence: "monthly", label: "This month" },
  { cadence: "quarterly", label: "This quarter" },
];
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SOPS_DEADLINE = "2026-10-26";

const Card = ({ title, help, children, action }: { title: string; help?: string; children: ReactNode; action?: ReactNode }) => (
  <section aria-label={title} className="card flex min-w-0 flex-col gap-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        {help ? <span className="text-[13px] text-text-3">{help}</span> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Table = ({ cols, head, rows, minW = "min-w-[760px]" }: { cols: string; head: string[]; rows: ReactNode[][]; minW?: string }) => (
  <div className="overflow-x-auto">
    <div className={`grid ${minW} ${cols} gap-3 border-b border-line pb-2 text-[12px] text-text-3`}>
      {head.map((h) => (
        <span key={h}>{h}</span>
      ))}
    </div>
    {rows.map((r, i) => (
      <div key={i} className={`grid ${minW} ${cols} items-center gap-3 border-b border-line-soft py-2.5 text-[13px] last:border-b-0`}>
        {r.map((c, k) => (
          <span key={k} className={k === 0 ? "font-medium" : "text-text-2"}>
            {c}
          </span>
        ))}
      </div>
    ))}
  </div>
);

/** Work › Operations plan: the operating rhythm as a live checklist, the SOPs to write, delivery capacity and the implementer trigger, service levels, compliance, vendors and risks. */
const OperationsPlan = () => {
  const toast = useToast();
  const [home, setHome] = useState<OpsHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  usePageChrome({ context: "Work · operations plan" });

  const load = useCallback(() => data.opsHome().then(setHome, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState title={error} />;
  if (!home) return <SkeletonRows rows={8} />;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const written = home.sops.filter((s) => s.status === "done").length;
  const firstFour = home.sops.filter((s) => s.num <= 4);
  const cap = home.capacity;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Operations plan</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">How the company runs at Stage 1: who does what, the weekly rhythm, the SOPs to write, delivery capacity and the rules we work by.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="Operating rhythm" help="Tick each item when it's done for this period. Weekly items turn amber once their day has passed.">
          <div className="flex flex-col gap-4">
            {GROUPS.map((g) => {
              const items = RHYTHM.filter((r) => r.cadence === g.cadence);
              const period = periodKey(g.cadence, today);
              const done = items.filter((r) => r.auto || home.checks[`${r.key}:${period}`]).length;
              return (
                <div key={g.cadence} className="flex flex-col gap-1">
                  <span className="flex items-center justify-between text-[12px] font-medium text-text-3">
                    <span>{g.label}</span>
                    <span>
                      {done} of {items.length}
                    </span>
                  </span>
                  {items.map((r) => {
                    const key = `${r.key}:${period}`;
                    const check = home.checks[key];
                    // Weekly items: Monday-first week, Sunday last.
                    const dayIdx = (d: number) => (d + 6) % 7;
                    const overdue = !check && !r.auto && r.cadence === "weekly" && r.weekday !== undefined && dayIdx(weekday) > dayIdx(r.weekday);
                    return (
                      <label key={r.key} className={`flex items-start gap-3 rounded-lg px-2 py-2 text-[13px] ${overdue ? "bg-amber-tint" : "hover:bg-surface-2/50"}`}>
                        <input type="checkbox" className="mt-0.5" checked={!!check || !!r.auto} disabled={r.auto} onChange={(e) => run(() => data.setOpsCheck(key, e.target.checked))} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={check || r.auto ? "text-text-2" : ""}>
                            {r.what}
                            {r.auto ? <span className="ml-1.5 text-[11px] text-text-3">(automatic)</span> : null}
                          </span>
                          <span className="text-[12px] text-text-3">
                            {r.when} · {r.who} · {r.time}
                            {r.cadence === "weekly" && r.weekday !== undefined && r.weekday === weekday ? " · today" : ""}
                            {overdue ? ` · was due ${WEEKDAY[r.weekday!]}` : ""}
                          </span>
                        </span>
                        {r.href ? (
                          <Link to={r.href} className="shrink-0 text-[12px] text-cyan hover:underline" onClick={(e) => e.stopPropagation()}>
                            Open ↗
                          </Link>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Delivery capacity" help="Rinor delivers on weekends. An implementer comes in at Gate 2, or earlier if setups pile up.">
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] ${cap.hireImplementer ? "bg-amber-tint" : "bg-mint-tint"}`}>
              <span style={{ color: cap.hireImplementer ? "var(--amber)" : "var(--mint)" }} className="mt-px shrink-0">
                <Icon d={cap.hireImplementer ? "M12 8v5M12 16h.01" : "M5 12l5 5L20 7"} size={15} />
              </span>
              <span>{cap.hireImplementer ? `Time to bring in a part-time implementer: ${cap.reasons.join("; ")}.` : "Setups are keeping up: no implementer needed yet."}</span>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px]">
              <span className="flex justify-between">
                <span className="text-text-2">Setups waiting</span>
                <span className="num">{cap.onboarding.length}</span>
              </span>
              <span className="flex justify-between">
                <span className="text-text-2">Deposit to go-live (90 days)</span>
                <span className={`num ${cap.avgDepositToLiveDays !== null && cap.avgDepositToLiveDays > 7 ? "text-amber" : ""}`}>{cap.avgDepositToLiveDays === null ? "—" : `${cap.avgDepositToLiveDays.toFixed(1)} days`}</span>
              </span>
              {cap.onboarding.map((o) => (
                <Link key={o.clientId} to={`/clients/${o.clientId}`} className="flex justify-between rounded-md px-2 py-1 hover:bg-surface-2/50">
                  <span>{o.companyName}</span>
                  <span className={`num ${o.waitingDays > 7 ? "text-coral" : "text-text-2"}`}>{o.waitingDays} days</span>
                </Link>
              ))}
            </div>
            <Table minW="min-w-0" cols="grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]" head={["Work", "Hours", "Limit"]} rows={DELIVERY_CAPACITY.map((d) => [d.work, d.hours, d.limit])} />
          </Card>

          <Card title="Service levels to clients" help="First line: the BDR in US hours, the co-founder in European hours. Second line: Rinor on weekends.">
            <Table minW="min-w-0" cols="grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]" head={["Issue", "First response", "Fix"]} rows={SERVICE_LEVELS.map((s) => [s.issue, s.first, s.fix])} />
          </Card>
        </div>
      </div>

      <Card
        title="SOPs to write"
        help={`Format: ${SOP_FORMAT}.`}
        action={
          <span className="flex flex-col items-end gap-1 text-[12px]">
            <span className="text-text-2">
              {written} of {home.sops.length} written
            </span>
            <span className={firstFour.every((s) => s.status === "done") ? "text-mint" : "text-amber"}>SOPs 1–4 needed before {SOPS_DEADLINE.slice(8)} Oct: {firstFour.filter((s) => s.status === "done").length} of 4</span>
          </span>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-[32px_minmax(0,0.9fr)_minmax(0,1.8fr)_100px_96px_120px_minmax(0,1fr)] gap-3 border-b border-line pb-2 text-[12px] text-text-3">
            <span>#</span>
            <span>SOP</span>
            <span>Covers</span>
            <span>Owner</span>
            <span>Due</span>
            <span>Status</span>
            <span>Written SOP</span>
          </div>
          {home.sops.map((s) => {
            const late = s.status !== "done" && s.due < today;
            return (
              <div key={s.id} className="grid min-w-[980px] grid-cols-[32px_minmax(0,0.9fr)_minmax(0,1.8fr)_100px_96px_120px_minmax(0,1fr)] items-center gap-3 border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
                <span className="num text-text-3">{s.num}</span>
                <span className="font-medium">{s.title}</span>
                <span className="text-[12px] text-text-2">{s.covers}</span>
                <span className="text-text-2">{s.owner}</span>
                <span className={`num text-[12px] ${late ? "text-coral" : "text-text-2"}`}>
                  {late ? "⚠ " : ""}
                  {s.due}
                </span>
                {home.canEdit ? (
                  <label className="relative">
                    <Pill hue={SOP_STATUS[s.status].hue} dot>
                      {SOP_STATUS[s.status].label}
                    </Pill>
                    <select aria-label={`SOP ${s.num} status`} className="absolute inset-0 cursor-pointer opacity-0" value={s.status} onChange={(e) => run(() => data.updateSop(s.id, { status: e.target.value as SopStatus }), `SOP ${s.num}: ${SOP_STATUS[e.target.value as SopStatus].label}`)}>
                      {(Object.keys(SOP_STATUS) as SopStatus[]).map((x) => (
                        <option key={x} value={x}>
                          {SOP_STATUS[x].label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <Pill hue={SOP_STATUS[s.status].hue} dot>
                    {SOP_STATUS[s.status].label}
                  </Pill>
                )}
                <span className="min-w-0">
                  {s.link ? (
                    <a href={s.link} target={s.link.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className="truncate text-cyan hover:underline">
                      Open ↗
                    </a>
                  ) : home.canEdit ? (
                    <form
                      className="flex gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = (linkDraft[s.id] ?? "").trim();
                        if (v) run(() => data.updateSop(s.id, { link: v }), "Link saved");
                      }}
                    >
                      <input aria-label={`Link to SOP ${s.num}`} className="input h-7 min-w-0 flex-1 text-[12px]" placeholder="https://…" value={linkDraft[s.id] ?? ""} onChange={(e) => setLinkDraft({ ...linkDraft, [s.id]: e.target.value })} />
                    </form>
                  ) : (
                    <span className="text-[12px] text-text-3">Not written yet</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Who does what" help="Stage 1.">
        <Table cols="grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)_minmax(0,0.9fr)_minmax(0,1fr)]" head={["Person", "Owns", "Hours", "Tools"]} rows={PEOPLE_STAGE1.map((p) => [p.who, p.owns, p.hours, p.tools])} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Compliance operations">
          <Table
            cols="grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.8fr)]"
            head={["Area", "Rule", "Owner", "Where"]}
            rows={COMPLIANCE_OPS.map((c) => [
              c.area,
              c.rule,
              c.owner,
              c.href ? (
                <Link key={c.area} to={c.href} className="text-cyan hover:underline">
                  {c.where} ↗
                </Link>
              ) : (
                c.where
              ),
            ])}
          />
        </Card>
        <Card title="Vendors">
          <Table cols="grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_minmax(0,0.9fr)]" head={["Vendor", "Use", "Owner", "Review"]} rows={VENDORS.map((v) => [v.vendor, v.use, v.owner, v.review])} />
        </Card>
      </div>

      <Card title="Risk register">
        <Table
          cols="grid-cols-[minmax(0,1.2fr)_80px_80px_100px_minmax(0,1.6fr)]"
          head={["Risk", "Chance", "Impact", "Owner", "Mitigation"]}
          rows={RISKS.map((r) => [
            r.risk,
            <Pill key="c" hue={LEVEL_HUE[r.chance]}>{r.chance}</Pill>,
            <Pill key="i" hue={LEVEL_HUE[r.impact]}>{r.impact}</Pill>,
            r.owner,
            r.mitigation,
          ])}
        />
      </Card>
    </div>
  );
};

export default OperationsPlan;
