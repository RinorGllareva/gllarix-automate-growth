import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, KpiCard, SkeletonRows, TierBadge } from "@/components/ui/primitives";
import { QUEUE } from "@/config/queue";
import { data, ROLE_LABEL, type QueueRow, type QueueView, type TeamMemberToday, type TodayStats, type User } from "@/data";
import { count } from "@/lib/format";
import { QUEUE_UPDATED, queueUpdated } from "@/lib/events";
import { isTypingTarget } from "@/lib/hotkeys";
import { shiftFor } from "@/services/queue";
import { localDateKey, localHHMM, zonedToUtc, zoneAbbr } from "@/services/time";

const REFRESH_MS = 60_000;
const UP_NEXT = 8;

const todayLabel = (user: User) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: user.timezone }).format(new Date()).replace(",", "").toUpperCase();

/** "41% done · on pace for 150 by 15:40 VET" */
const paceText = (user: User, done: number, capacity: number) => {
  const tz = user.timezone;
  const [from, to] = shiftFor(user);
  const start = zonedToUtc(localDateKey(Date.now(), tz), from, tz);
  const pct = capacity ? Math.round((done / capacity) * 100) : 0;
  if (!done || Date.now() <= start) return `${pct}% done · shift ${from}–${to} ${zoneAbbr(tz)}`;
  const rate = done / (Date.now() - start);
  const finish = start + capacity / rate;
  return `${pct}% done · on pace for ${capacity} by ${localHHMM(finish, tz)} ${zoneAbbr(tz)}`;
};

/** "Today's queue", or "Queue for Fri 2 Oct" when it was built ahead for the next business day. */
const queueLabel = (date: string, tz: string) => {
  if (date === localDateKey(Date.now(), tz)) return "Today's queue";
  const [y, m, d] = date.split("-").map(Number);
  return `Queue for ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d)).replace(",", "")}`;
};

const stepText = (row: QueueRow) => {
  if (row.channel === "call" && row.kind !== "callback" && row.windowStartAt && new Date(row.windowStartAt).getTime() > Date.now() + 60_000) {
    const tz = row.company.timezone ?? "UTC";
    return `Opens ${localHHMM(new Date(row.windowStartAt), tz)} ${zoneAbbr(tz)}`;
  }
  return row.step;
};

const UpNext = ({ rows, onOpen }: { rows: QueueRow[]; onOpen: (row: QueueRow) => void }) => {
  const open = rows.filter((r) => r.status === "open");
  const first = open.find((r) => r.windowName) ?? open[0];
  const cols = "sm:grid-cols-[52px_minmax(0,1.6fr)_minmax(0,1fr)_56px_minmax(0,1.6fr)_110px]";
  return (
    <section aria-label="Up next" className="card min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <span className="label-caps truncate">Up next{first?.windowName ? ` · ${first.windowName} local` : ""}</span>
        <Link to="/call" className="btn-ghost shrink-0">
          Open full queue ↗
        </Link>
      </div>
      {open.length ? (
        <>
          <div className={`hidden sm:grid ${cols} gap-3 border-b border-line px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-text-3 bg-surface-2`}>
            <span>Tier</span>
            <span>Company</span>
            <span>Location</span>
            <span>Local</span>
            <span>Why now</span>
            <span>Step</span>
          </div>
          {open.slice(0, UP_NEXT).map((r) => (
            <button
              key={`${r.leadId}-${r.channel}`}
              type="button"
              onClick={() => onOpen(r)}
              className={`grid w-full grid-cols-[52px_1fr] items-center gap-x-3 gap-y-1 border-b border-line-soft px-5 py-3 text-left text-[14px] last:border-b-0 hover:bg-surface-2 ${cols} sm:h-[52px] sm:py-0`}
            >
              <span>
                <TierBadge tier={r.lead.tier} score={r.lead.score} />
              </span>
              <span className="truncate">{r.company.name}</span>
              <span className="col-start-2 truncate text-[13px] text-text-2 sm:col-start-auto">
                {[r.company.city, r.company.country === "US" ? r.company.region : r.company.country].filter(Boolean).join(", ")}
              </span>
              <span className="col-start-2 font-mono text-[13px] text-text-2 sm:col-start-auto">{r.company.timezone ? localHHMM(Date.now(), r.company.timezone) : "—"}</span>
              <span className="col-start-2 truncate text-[13px] text-text-2 sm:col-start-auto">{r.whyNow}</span>
              <span className="col-start-2 text-[11px] uppercase tracking-[0.16em] text-label sm:col-start-auto">{stepText(r)}</span>
            </button>
          ))}
        </>
      ) : (
        <div className="p-5">
          <EmptyState title="No calls due. Build tomorrow's list or check Tasks." />
        </div>
      )}
    </section>
  );
};

/** Admins top up the queue from the lead sources (M8 list build); new leads join the next queue build. */
const RunListBuild = () => {
  const user = useUser();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-outline mt-1 h-10 justify-between text-[11px]"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await data.runListBuild({ ownerId: user.id });
          const o = r.owners[0];
          toast(r.run.status === "succeeded" ? `List build added ${o?.added ?? 0} leads (${o?.queueReady ?? 0} queue-ready). Rebuild the queue to use them.` : `List build ${r.run.status}: ${r.run.error ?? ""}`, r.run.status === "succeeded" ? "good" : "error");
        } catch (e) {
          toast((e as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <span>{busy ? "Running list build…" : "Run list build"}</span>
      <span aria-hidden="true">→</span>
    </button>
  );
};

const NeedsAttention = ({ stats, shortfall, isAdmin, tz }: { stats: TodayStats; shortfall: number; isAdmin: boolean; tz: string }) => (
  <section aria-label="Needs attention" className="card flex flex-col gap-3 px-5 py-[18px]">
    <span className="label-caps">Needs attention</span>
    {stats.callbacksSoon.map((c) => (
      <Link key={c.leadId} to={`/call/${c.leadId}`} className="flex gap-2.5 text-[13px] text-text hover:text-cyan">
        <span className="font-mono text-cyan">{localHHMM(new Date(c.at), tz)}</span>
        <span className="truncate">Callback · {c.company}</span>
      </Link>
    ))}
    {stats.meetingsAwaitingApproval ? (
      <Link to="/meetings" className="flex gap-2.5 text-[13px] text-text hover:text-cyan">
        <span className="font-mono text-lavender">{stats.meetingsAwaitingApproval}</span>
        <span>Meeting{stats.meetingsAwaitingApproval === 1 ? "" : "s"} waiting for approval</span>
      </Link>
    ) : null}
    {shortfall ? (
      <div className="flex gap-2.5 text-[13px]">
        <span className="font-mono text-amber">{shortfall}</span>
        <span>More A/B leads needed to fill today's queue</span>
      </div>
    ) : null}
    {!stats.callbacksSoon.length && !stats.meetingsAwaitingApproval && !shortfall ? (
      <span className="text-[13px] text-text-2">Nothing waiting. Callbacks due in the next 30 minutes show up here first.</span>
    ) : null}
    {isAdmin && shortfall ? <RunListBuild /> : null}
  </section>
);

const QueueMix = ({ view, tz }: { view: QueueView; tz: string }) => {
  const s = view.queue.summary;
  const calls = view.queue.items.filter((i) => i.channel === "call" && i.kind !== "callback" && i.kind !== "follow_up").length;
  const mix = [
    { label: "Calls", n: calls, c: "bg-cyan" },
    { label: "Emails", n: s.byChannel.email, c: "bg-lavender" },
    { label: "LinkedIn tasks", n: s.byChannel.linkedin, c: "bg-mint" },
    { label: "Follow-ups and callbacks", n: s.followUps, c: "bg-amber" },
  ].filter((m) => m.n > 0 || m.label === "Calls");
  const total = Math.max(1, s.total);
  return (
    <section aria-label="Queue mix" className="card flex flex-col gap-3.5 px-5 py-[18px]">
      <span className="label-caps">Queue mix</span>
      {mix.map((m) => (
        <div key={m.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px]">
            <span>{m.label}</span>
            <span className="num text-text-2">{m.n}</span>
          </div>
          <div className="h-[3px] bg-line">
            <div className={`h-[3px] ${m.c}`} style={{ width: `${(m.n / total) * 100}%` }} />
          </div>
        </div>
      ))}
      <span className="text-[11px] text-text-3">
        Built {localHHMM(new Date(view.queue.builtAt), tz)} {zoneAbbr(tz)} in {view.queue.summary.buildMs} ms
        {view.queue.summary.blocked ? ` · ${view.queue.summary.blocked} blocked by calling rules` : ""}
      </span>
    </section>
  );
};

const TeamToday = ({ team }: { team: TeamMemberToday[] }) => (
  <section aria-label="Team today" className="card min-w-0">
    <div className="border-b border-line px-5 py-4">
      <span className="label-caps">Today's team</span>
    </div>
    {team.length ? (
      team.map((m) => (
        <div key={m.userId} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line-soft px-5 py-3.5 text-[14px] last:border-b-0">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span>{m.name}</span>
            <div className="h-[3px] max-w-80 bg-line">
              <div className="h-[3px] bg-cyan" style={{ width: `${m.capacity ? (m.done / m.capacity) * 100 : 0}%` }} />
            </div>
          </div>
          <span className="num text-right text-[13px] text-text-2">
            {m.done} of {m.capacity} · {m.dials} dials · {m.conversations} conv. · {m.meetingsBookedWeek} booked this week
          </span>
        </div>
      ))
    ) : (
      <div className="p-5">
        <EmptyState title="Nobody has a daily queue yet. Give a user a daily capacity in Admin › Users." />
      </div>
    )}
  </section>
);

const Today = () => {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = user.role === "admin";
  const hasQueue = Boolean(user.dailyCapacity);
  const [view, setView] = useState<QueueView | null>(null);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [team, setTeam] = useState<TeamMemberToday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const refresh = useCallback(() => {
    setError(null);
    Promise.all([hasQueue ? data.getQueue() : Promise.resolve(null), data.todayStats(), isAdmin ? data.teamToday() : Promise.resolve([])])
      .then(([v, s, t]) => {
        setView(v);
        setStats(s);
        setTeam(t);
      })
      .catch((e: Error) => setError(e.message));
  }, [hasQueue, isAdmin]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener(QUEUE_UPDATED, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(QUEUE_UPDATED, refresh);
    };
  }, [refresh]);

  // C start calling · R refresh (never while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "c" && hasQueue) navigate("/call");
      if (e.key === "r") refresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasQueue, navigate, refresh]);

  const [shiftFrom, shiftTo] = shiftFor(user);
  usePageChrome({
    context: hasQueue ? `${todayLabel(user)} · ${ROLE_LABEL[user.role].toUpperCase()} shift ${shiftFrom}–${shiftTo} ${zoneAbbr(user.timezone)}` : todayLabel(user),
    action: hasQueue ? { label: "Start calling", to: "/call" } : undefined,
  });

  const build = async () => {
    setBuilding(true);
    try {
      const v = await data.buildQueue();
      setView(v);
      toast(`Queue rebuilt · ${v.queue.items.length} items in ${v.queue.summary.buildMs} ms`, "good");
      queueUpdated();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBuilding(false);
    }
  };

  if (error)
    return (
      <div className="flex items-center gap-4 text-[14px] text-coral">
        {error}
        <button type="button" className="btn-outline h-9" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  if (!stats || (hasQueue && !view)) return <SkeletonRows rows={8} />;

  const capacity = user.dailyCapacity ?? 0;
  const done = view?.done ?? 0;
  const teamDials = team.reduce((n, m) => n + m.dials, 0);
  const teamConv = team.reduce((n, m) => n + m.conversations, 0);
  const convOnTrack = stats.conversations >= 6;
  const approvedPct = stats.meetingsBookedWeek ? Math.round((stats.approvedWeek / stats.meetingsBookedWeek) * 100) : 0;

  return (
    <div className="flex flex-col gap-7">
      {hasQueue && view ? (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3.5 text-[11px] uppercase tracking-label text-label">
              <span className="h-px w-10 bg-cyan-line" />
              <span>{queueLabel(view.queue.date, user.timezone)}</span>
            </div>
            <h1 className="m-0 text-[44px] font-light leading-none tracking-[-0.02em] sm:text-[56px]">
              {done} <span className="text-text-3">of</span> {capacity}
            </h1>
          </div>
          <div className="flex w-full flex-col gap-2.5 lg:w-[460px]">
            <div className="h-1 bg-line" role="progressbar" aria-label="Queue progress" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={done}>
              <div className="h-1 bg-cyan" style={{ width: `${capacity ? Math.min(100, (done / capacity) * 100) : 0}%` }} />
            </div>
            <div className="flex justify-between gap-3 text-[13px] text-text-2">
              <span>{paceText(user, done, capacity)}</span>
              <span className="num shrink-0">{Math.max(0, view.queue.items.length - done)} left</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3.5 text-[11px] uppercase tracking-label text-label">
            <span className="h-px w-10 bg-cyan-line" />
            <span>Team today</span>
          </div>
          <h1 className="page-title m-0">Today</h1>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard index="01" title="Dials" value={count(hasQueue ? stats.dials : teamDials)} caption={hasQueue ? `Target ${capacity} today` : "Team · today"} />
        <KpiCard
          index="02"
          title="Conversations"
          value={count(hasQueue ? stats.conversations : teamConv)}
          caption={hasQueue ? `Target 6–10 · ${convOnTrack ? "on track" : "below"}` : "Team · today"}
          tone={hasQueue && convOnTrack ? "mint" : "text"}
        />
        <KpiCard index="03" title="Meetings booked" value={count(stats.meetingsBookedWeek)} caption="This week · target 4+" tone="cyan" />
        <KpiCard index="04" title="Approved" value={count(stats.approvedWeek)} caption={`Of ${stats.meetingsBookedWeek} booked · ${approvedPct}%`} tone="lavender" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {hasQueue && view ? (
          <UpNext rows={view.rows} onOpen={(r) => navigate(r.channel === "call" ? `/call/${r.leadId}` : `/leads/${r.leadId}`)} />
        ) : (
          <TeamToday team={team} />
        )}
        <div className="flex flex-col gap-4">
          {view ? <QueueMix view={view} tz={user.timezone} /> : null}
          <NeedsAttention stats={stats} shortfall={view?.queue.summary.shortfall ?? 0} isAdmin={isAdmin} tz={user.timezone} />
          {hasQueue ? (
            <button type="button" className="btn-outline h-10 justify-between text-[11px]" disabled={building} onClick={build}>
              <span>{building ? "Building…" : "Rebuild queue now"}</span>
              <span aria-hidden="true">↻</span>
            </button>
          ) : null}
          <span className="text-[11px] text-text-3">
            Queues build at 05:00 your time · windows {QUEUE.windows.trades.call.join(", ")} lead-local for trades · <span className="font-mono">C</span> start calling · <span className="font-mono">R</span> refresh
          </span>
        </div>
      </div>
    </div>
  );
};

export default Today;
