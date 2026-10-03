import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Avatar, EmptyState, Icon, SkeletonRows } from "@/components/ui/primitives";
import { data, type User } from "@/data";
import { performanceReview, type Review } from "@/services/performanceReview";
import { isoWeekKey, localDateKey, shiftWeek } from "@/services/time";

const TONE = { good: { label: "On target", color: "var(--mint)" }, watch: { label: "One thing to fix", color: "var(--amber)" }, act: { label: "Talk this week", color: "var(--coral)" } } as const;
const fmt = (v: number | null, unit: string) => (v === null ? "—" : unit === "pct" ? `${Math.round(v * 100)}%` : unit === "rate" ? v.toFixed(1) : String(Math.round(v)));

/**
 * AI › Performance tracker: each seller's week read the way a founder would before the Saturday 1:1. Founders see
 * everyone; a BDR sees their own. It never decides pay: bonuses come only from approved meetings.
 */
const Tracker = () => {
  const me = useUser();
  const [rows, setRows] = useState<{ user: Pick<User, "id" | "name">; review: Review }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePageChrome({ context: me.role === "admin" ? "AI · the team's week" : "AI · your week" });

  useEffect(() => {
    (async () => {
      try {
        const week = isoWeekKey(localDateKey(Date.now(), me.timezone));
        const last = shiftWeek(week, -1);
        const people = me.role === "admin" ? (await data.listUsers()).filter((u) => u.active && (u.role === "bdr" || u.role === "closer")) : [me];
        const out = await Promise.all(
          people.map(async (u) => {
            const [now, before] = await Promise.all([data.report({ kind: "week", key: week, personId: u.id }), data.report({ kind: "week", key: last, personId: u.id }).catch(() => null)]);
            return { user: { id: u.id, name: u.name }, review: performanceReview(u.name, now, before) };
          }),
        );
        setRows(out);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [me]);

  if (error) return <EmptyState title={error} />;
  if (!rows) return <SkeletonRows rows={6} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="page-title m-0">Performance tracker</h1>
        <p className="m-0 max-w-3xl text-[14px] text-text-2">
          This week against the targets and last week, with one focus for next week. Written from the numbers by rules in demo mode; with AI connected, the co-founder writes it from the same numbers. It never sets pay.
        </p>
      </div>
      {!rows.length ? <EmptyState title="No sellers yet. Add a BDR in Settings › Users." /> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {rows.map(({ user, review: r }) => (
          <article key={user.id} aria-label={`${user.name}'s week`} className="card flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar id={user.id} name={user.name} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">{r.headline}</span>
                <span className="text-[12px]" style={{ color: TONE[r.tone].color }}>
                  {TONE[r.tone].label}
                </span>
              </div>
              {me.role === "admin" ? (
                <Link to={`/team/${user.id}`} className="text-[12px] text-cyan hover:underline">
                  Scorecard
                </Link>
              ) : null}
            </div>

            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <span className="block text-[12px] text-text-3">Focus for next week</span>
              <span className="text-[14px] leading-relaxed">{r.focus}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-text-3">Went well</span>
                {r.wins.length ? (
                  r.wins.map((w) => (
                    <span key={w} className="flex items-start gap-2 text-[13px]">
                      <Icon d="M5 12l5 5L20 7" size={14} className="mt-0.5 shrink-0 text-mint" />
                      {w}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-text-3">Nothing on target yet this week.</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-text-3">Below target</span>
                {r.gaps.length ? (
                  r.gaps.map((g) => (
                    <span key={g} className="flex items-start gap-2 text-[13px]">
                      <Icon d="M12 8v5M12 16h.01" size={14} className="mt-0.5 shrink-0 text-coral" />
                      {g}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-text-3">Nothing below target.</span>
                )}
              </div>
            </div>

            <table className="w-full text-[13px]">
              <caption className="sr-only">This week against last week</caption>
              <thead>
                <tr className="text-left text-[12px] text-text-3">
                  <th className="py-1 font-medium">Number</th>
                  <th className="py-1 text-right font-medium">Last week</th>
                  <th className="py-1 text-right font-medium">This week</th>
                </tr>
              </thead>
              <tbody>
                {r.trend.map((t) => (
                  <tr key={t.key} className="border-t border-line-soft">
                    <td className="py-1.5 text-text-2">{t.label}</td>
                    <td className="num py-1.5 text-right text-text-3">{fmt(t.before, t.unit)}</td>
                    <td className="num py-1.5 text-right" style={{ color: t.better === true ? "var(--mint)" : t.better === false ? "var(--coral)" : undefined }}>
                      {fmt(t.now, t.unit)}
                      {t.better === true ? " ↑" : t.better === false ? " ↓" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </div>
  );
};

export default Tracker;
