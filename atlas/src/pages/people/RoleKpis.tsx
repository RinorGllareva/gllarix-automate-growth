import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Avatar, EmptyState, Icon, Pill, SkeletonRows, StatusChip } from "@/components/ui/primitives";
import { OWNER_KEYS } from "@/config/ai";
import { data, type WeeklyReport } from "@/data";
import { isoWeekKey, shiftDateKey } from "@/services/time";
import { roleKpis, type RoleBlock } from "@/services/roleKpis";

const DIAG = {
  good: { hue: "mint", icon: "M5 12l5 5L20 7" },
  script: { hue: "amber", icon: "M12 8v5M12 16h.01" },
  rep: { hue: "coral", icon: "M12 8v5M12 16h.01" },
} as const;

/** People › KPIs per role: every role's targets from the people plan, with what Atlas measures this week. Founders only. */
const RoleKpis = () => {
  const me = useUser();
  const [week, setWeek] = useState<"this" | "last">("this");
  const [blocks, setBlocks] = useState<RoleBlock[] | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  usePageChrome({ context: "People · KPIs per role" });

  useEffect(() => {
    let alive = true;
    const today = new Date().toISOString().slice(0, 10);
    const key = isoWeekKey(week === "this" ? today : shiftDateKey(today, -7));
    (async () => {
      try {
        const [users, team, payments, clients, deals] = await Promise.all([data.listUsers(), data.teamToday(), data.listPayments(), data.listClients(), data.listDeals()]);
        const who = users.filter((u) => u.active && (u.role === "bdr" || u.role === "closer" || u.id === OWNER_KEYS.cofounder));
        const reps = await Promise.all(who.map((u) => data.report({ kind: "week", key, personId: u.id })));
        const reports: Record<string, WeeklyReport> = Object.fromEntries(who.map((u, i) => [u.id, reps[i]]));
        if (!alive) return;
        setLabel(reps[0]?.period.label ?? key);
        const wonAt = Object.fromEntries(deals.map((d) => [d.deal.id, d.deal.wonAt]));
        setBlocks(roleKpis({ users, reports, today: week === "this" ? team : [], payments, clients, wonAt, now: Date.now() }));
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [week, me.id]);

  if (error) return <EmptyState title={error} />;
  if (!blocks) return <SkeletonRows rows={8} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title m-0">KPIs per role</h1>
          <p className="m-0 max-w-3xl text-[14px] text-text-2">
            What each role is measured on, from the people plan, and where it stands. Reviewed in the monthly 1:1. Bonuses never come from AI scores.
          </p>
        </div>
        <div role="radiogroup" aria-label="Week" className="flex rounded-lg bg-inset p-0.5">
          {(
            [
              ["this", "This week"],
              ["last", "Last week"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={week === k} onClick={() => (setBlocks(null), setWeek(k))} className={`h-8 rounded-md px-3 text-[13px] ${week === k ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:text-text"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <span className="-mt-3 text-[12px] text-text-3">{label}</span>

      <div className="grid gap-5 xl:grid-cols-2">
        {blocks.map((b) => {
          const measured = b.lines.filter((l) => l.status !== null);
          const onTrack = measured.filter((l) => l.status === "on_track").length;
          return (
            <section key={`${b.role}-${b.people[0]?.id ?? "open"}`} aria-label={`${b.role} KPIs`} className="card flex min-w-0 flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[16px] font-semibold">{b.role}</span>
                  {b.people.length ? (
                    <span className="flex flex-wrap items-center gap-2 text-[13px] text-text-2">
                      {b.people.map((p) => (
                        <span key={p.id} className="flex items-center gap-1.5">
                          <Avatar id={p.id} name={p.name} size={20} />
                          {p.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[13px] text-text-3">
                      Nobody in this role yet · hire at {b.hireWhen}.{" "}
                      <Link to="/hiring" className="text-cyan hover:underline">
                        Open Hiring
                      </Link>
                    </span>
                  )}
                </div>
                {measured.length ? (
                  <Pill hue={onTrack === measured.length ? "mint" : onTrack >= measured.length / 2 ? "amber" : "coral"} dot>
                    {onTrack} of {measured.length} on track
                  </Pill>
                ) : null}
              </div>

              {b.diagnostic ? (
                <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] ${b.diagnostic.tone === "good" ? "bg-mint-tint" : b.diagnostic.tone === "script" ? "bg-amber-tint" : "bg-coral-tint"}`}>
                  <span className="mt-px shrink-0" style={{ color: `var(--${DIAG[b.diagnostic.tone].hue})` }}>
                    <Icon d={DIAG[b.diagnostic.tone].icon} size={15} />
                  </span>
                  <span>{b.diagnostic.text}</span>
                </div>
              ) : null}

              <div className={`overflow-hidden rounded-lg border border-line ${b.people.length ? "" : "opacity-70"}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_92px_76px_92px] gap-3 border-b border-line bg-surface-2/60 px-4 py-2 text-[12px] text-text-3">
                  <span>KPI</span>
                  <span>Target</span>
                  <span className="text-right">Now</span>
                  <span className="text-right">Status</span>
                </div>
                {b.lines.map((l) => (
                  <div key={l.label} className="grid grid-cols-[minmax(0,1fr)_92px_76px_92px] items-center gap-3 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
                    <span className="flex min-w-0 flex-col">
                      <span>{l.label}</span>
                      <span className="truncate text-[12px] text-text-3" title={l.how}>
                        {l.how}
                      </span>
                    </span>
                    <span className="text-text-2">{l.target}</span>
                    <span className={`num text-right ${l.value === null ? "text-text-3" : ""}`}>{l.value ?? "—"}</span>
                    <span className="flex justify-end">{l.status ? <StatusChip status={l.status} /> : <span className="text-[12px] text-text-3">{l.value === null ? "Not measured" : "Tracked"}</span>}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default RoleKpis;
