import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { Avatar, EmptyState, KpiCard, Pill, SkeletonRows } from "@/components/ui/primitives";
import CalendarView from "@/components/CalendarView";
import NewMeetingModal from "@/components/NewMeetingModal";
import { GoogleCalendarCard } from "@/components/CalendarSettings";
import { MEETING_TYPE_HUE, type Hue } from "@/config/colors";
import { APPROVAL_CHECKS, MEETING_BONUS_MINOR, type ApprovalCheck } from "@/config/targets";
import { data, type MeetingRow, type MeetingStatus, type MeetingsWeek } from "@/data";
import { isoWeekKey, localDateKey, localHHMM, rangeLabel, shiftWeek, zoneAbbr } from "@/services/time";

export const STATUS: Record<MeetingStatus, { label: string; hue: Hue }> = {
  upcoming: { label: "Upcoming", hue: "blue" },
  to_hold: { label: "Mark held", hue: "amber" },
  to_approve: { label: "To approve", hue: "lavender" },
  approved: { label: "Approved", hue: "mint" },
  rejected: { label: "Rejected", hue: "coral" },
  no_show: { label: "No-show", hue: "text-3" },
};

const usd = (minor: number) => `$${(minor / 100).toLocaleString("en-US")}`;

const when = (iso: string, tz: string) =>
  `${new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(new Date(iso))} ${localHHMM(new Date(iso), tz)}`;

export const ApprovalPanel = ({ row, isAdmin, canMark, onChanged, embedded = false }: { row: MeetingRow; isAdmin: boolean; canMark: boolean; onChanged: () => void; embedded?: boolean }) => {
  const toast = useToast();
  const m = row.meeting;
  const [checks, setChecks] = useState<Record<ApprovalCheck, boolean>>(() =>
    Object.fromEntries(APPROVAL_CHECKS.map((c) => [c.key, Boolean(m.checks?.[c.key])])) as Record<ApprovalCheck, boolean>,
  );
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("30");
  useEffect(() => {
    setChecks(Object.fromEntries(APPROVAL_CHECKS.map((c) => [c.key, Boolean(m.checks?.[c.key] ?? (m.attended && c.key === "held"))])) as Record<ApprovalCheck, boolean>);
  }, [m.id, m.checks, m.attended]);

  const run = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      toast(msg, "good");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const allTrue = APPROVAL_CHECKS.every((c) => checks[c.key]);
  const decidable = isAdmin && m.attended === true && !row.locked;
  const tz = row.company.timezone ?? "UTC";

  return (
    <section aria-label={`Approve ${row.company.name}`} className="card flex flex-col gap-4 self-start p-5">
      <span className="flex items-center justify-between gap-2">
        <span className="label-caps">{embedded ? "Outcome and approval" : `Approve · ${row.company.name}`}</span>
        {embedded ? null : (
          <Link to={`/meetings/${m.id}`} className="text-[12px] text-cyan hover:underline">
            Open meeting
          </Link>
        )}
      </span>
      <span className="text-[13px] text-text-2">
        {m.attended === true ? "Held" : m.attended === false ? "No-show" : new Date(m.scheduledAt).getTime() > Date.now() ? "Scheduled" : "Was due"} {when(m.scheduledAt, tz)} {zoneAbbr(tz)} local
        {m.durationMin ? ` · ${m.durationMin} min` : ""}
        {m.recordingUrl ? " · recording available" : ""}
      </span>
      <span className="text-[12px] text-text-3">
        Booked by {row.bookedByName ?? "—"} · with {m.withWhom} · <Link to={`/leads/${row.lead.id}`} className="text-cyan">lead</Link>
      </span>

      {row.status === "to_hold" && canMark ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber/40 p-3.5">
          <span className="text-[13px]">Did this meeting happen?</span>
          <label className="flex items-center gap-2 text-[13px] text-text-2">
            Duration (min)
            <input type="number" min={1} className="input h-9 w-20" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-primary h-10 text-[11px]" onClick={() => run(() => data.markMeeting(m.id, { attended: true, durationMin: Number(duration) || undefined }), "Marked held · waiting for approval")}>
              Held
            </button>
            <button type="button" className="btn-outline h-10 text-[11px]" onClick={() => run(() => data.markMeeting(m.id, { attended: false }), "No-show · follow-up scheduled")}>
              No-show
            </button>
          </div>
        </div>
      ) : null}

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0" disabled={!decidable}>
        <legend className="sr-only">Approval checks</legend>
        {APPROVAL_CHECKS.map((c) => (
          <label key={c.key} className="flex items-center gap-3 text-[13px]">
            <input
              type="checkbox"
              checked={checks[c.key]}
              onChange={(e) => setChecks({ ...checks, [c.key]: e.target.checked })}
              className="h-4 w-4 accent-[var(--mint)]"
            />
            <span className={checks[c.key] ? "text-text" : "text-text-2"}>{c.label}</span>
          </label>
        ))}
      </fieldset>
      <span className="text-[12px] text-text-3">Counts for the $15 bonus only if all are true.</span>

      {row.locked ? <span className="text-[12px] text-amber">This month is closed; the decision is locked.</span> : null}
      {m.approved === false && m.rejectReason ? <span className="text-[12px] text-coral">Rejected: {m.rejectReason}</span> : null}

      {isAdmin ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary h-11 flex-1 justify-between text-[11px]"
            disabled={!decidable || !allTrue}
            onClick={() => run(() => data.approveMeeting(m.id, checks), `Approved · ${usd(MEETING_BONUS_MINOR)} bonus pending`)}
          >
            <span>Approve · {usd(MEETING_BONUS_MINOR)}</span>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="btn-outline h-11 text-[11px]" disabled={!decidable} onClick={() => setRejecting(true)}>
            Reject
          </button>
        </div>
      ) : (
        <span className="text-[12px] text-text-3">Admins approve meetings. You'll see rejections and their reasons on your daily report.</span>
      )}
      <span className="text-[12px] text-text-3">Rejections need a reason; the BDR sees it on the daily report.</span>

      <Modal open={rejecting} onClose={() => setRejecting(false)} title={`Reject · ${row.company.name}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await run(() => data.rejectMeeting(m.id, reason), "Rejected · the reason is on the BDR's daily report");
            setRejecting(false);
            setReason("");
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="field-label">Reason</span>
            <input className="input" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Decision-maker not on the call" />
          </label>
          <button type="submit" className="btn-danger" disabled={!reason.trim()}>
            Reject meeting
          </button>
        </form>
      </Modal>
    </section>
  );
};

const Meetings = () => {
  const user = useUser();
  const toast = useToast();
  const isAdmin = user.role === "admin";
  const [params, setParams] = useSearchParams();
  const thisWeek = isoWeekKey(localDateKey(Date.now(), user.timezone));
  const week = /^\d{4}-W\d{2}$/.test(params.get("week") ?? "") ? params.get("week")! : thisWeek;
  const [view, setView] = useState<MeetingsWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingPath, setBookingPath] = useState<string | null>(null);
  // Phones open on the list: a week calendar doesn't fit 375 px.
  const narrow = typeof window !== "undefined" && window.matchMedia?.("(max-width: 1023px)").matches;
  const mode = (params.get("view") ?? (narrow ? "list" : "calendar")) === "list" ? "list" : "calendar";
  const [calendarUser, setCalendarUser] = useState(user.id);
  const [calendarKey, setCalendarKey] = useState(0);
  const [booking, setBooking] = useState<{ date: string; time: string } | null | false>(false);
  const canBook = ["admin", "bdr", "closer"].includes(user.role);
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (user.role === "admin") data.listUsers().then((us) => setTeam(us.filter((u) => u.active && u.role !== "viewer")));
  }, [user.role]);
  useEffect(() => {
    data.bookingPath().then(setBookingPath);
  }, []);

  const load = useCallback(() => {
    setError(null);
    data
      .listMeetings(week)
      .then(setView)
      .catch((e: Error) => setError(e.message));
  }, [week]);
  useEffect(load, [load]);

  const selectedId = params.get("id");
  const selected = useMemo(
    () => view?.rows.find((r) => r.meeting.id === selectedId) ?? view?.rows.find((r) => r.status === "to_approve" || r.status === "to_hold") ?? view?.rows[0] ?? null,
    [view, selectedId],
  );

  const go = (w: string) => setParams(w === thisWeek ? {} : { week: w });
  const weekNo = Number(week.split("W")[1]);
  usePageChrome({ context: view ? `Week ${weekNo} · ${rangeLabel(view.start, view.end)}` : `Week ${weekNo}` });

  if (error) return <EmptyState title={error} action={<button className="btn-outline" type="button" onClick={load}>Retry</button>} />;
  if (!view) return <SkeletonRows rows={8} />;

  const s = view.stats;
  const month = localDateKey(Date.now(), user.timezone).slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const lastMonth = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  const cols = "grid-cols-[110px_minmax(0,1.6fr)_minmax(0,0.8fr)_120px_80px]";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title m-0">Meetings</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-outline h-9 px-3" aria-label="Previous week" onClick={() => go(shiftWeek(week, -1))}>
            ←
          </button>
          <span className="min-w-44 text-center text-[13px] text-text-2">
            Week {weekNo} · {rangeLabel(view.start, view.end)}
          </span>
          <button type="button" className="btn-outline h-9 px-3" aria-label="Next week" onClick={() => go(shiftWeek(week, 1))}>
            →
          </button>
          {week !== thisWeek ? (
            <button type="button" className="btn-ghost ml-2" onClick={() => go(thisWeek)}>
              This week
            </button>
          ) : null}
          {bookingPath ? (
            <button
              type="button"
              className="btn-outline h-9 text-[11px]"
              onClick={async () => {
                const url = `${location.origin}${bookingPath}`;
                try {
                  await navigator.clipboard.writeText(url);
                  toast(`Copied ${url}`, "good");
                } catch {
                  toast(url, "info");
                }
              }}
            >
              Booking link ↗
            </button>
          ) : null}
          {isAdmin && !view.closedMonths.includes(lastMonth) ? (
            <button
              type="button"
              className="btn-outline h-9 text-[11px]"
              onClick={async () => {
                try {
                  await data.closeMonth(lastMonth);
                  toast(`Closed ${lastMonth} · approvals locked, bonuses earned`, "good");
                  load();
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }}
            >
              Close {lastMonth}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard title="Booked" value={s.booked} caption="This week · target 4+" />
        <KpiCard title="Held" value={s.held} caption={`${s.toCome} still to come`} tone="cyan" />
        <KpiCard
          title="Show rate"
          value={s.showRate === null ? "—" : `${Math.round(s.showRate * 100)}%`}
          caption="Of meetings already due · target 70%+"
          tone={s.showRate !== null && s.showRate >= 0.7 ? "mint" : "text"}
        />
        <KpiCard title="Approved" value={s.approved} caption={`${s.waiting} waiting`} tone="lavender" />
        <KpiCard title="Bonus this week" value={usd(s.bonusMinor)} caption="$15 per approved" />
      </div>

      {user.role !== "viewer" ? (
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Meetings view" className="flex overflow-hidden rounded-lg border border-line-strong">
            {(["calendar", "list"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setParams({ ...Object.fromEntries(params), view: m })} className={`h-8 px-3.5 text-[12px] font-medium ${mode === m ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface-2"}`}>
                {m}
              </button>
            ))}
          </div>
          {canBook ? (
            <button type="button" className="btn-primary ml-auto h-9 text-[11px]" onClick={() => setBooking(null)}>
              + New meeting
            </button>
          ) : null}
          {mode === "calendar" && isAdmin ? (
            <select aria-label="Whose calendar" className="input h-8 w-48 text-[12px]" value={calendarUser} onChange={(e) => setCalendarUser(e.target.value)}>
              {team.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === user.id ? "My calendar" : `${u.name}'s calendar`}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {user.role === "viewer" ? (
        <EmptyState title="Your role sees meeting totals only. Ask an admin if you need the individual meetings." />
      ) : mode === "calendar" ? (
        <div className="flex flex-col gap-3">
          {calendarUser === user.id ? <GoogleCalendarCard onChange={() => setCalendarKey((k) => k + 1)} /> : null}
          <CalendarView key={calendarKey} timezone={user.timezone} userId={calendarUser === user.id ? undefined : calendarUser} onSlot={canBook ? (date, time) => setBooking({ date, time }) : undefined} />
        </div>
      ) : !view.rows.length ? (
        <EmptyState title="No meetings scheduled this week. Booked meetings from the call workspace show up here." action={<Link className="btn-outline" to="/call">Start calling →</Link>} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Phones: one card per meeting, opening its page. */}
          <section aria-label="Meetings this week" className="flex flex-col gap-2 sm:hidden">
            {view.rows.map((r) => {
              const tz = r.company.timezone ?? user.timezone;
              return (
                <Link key={r.meeting.id} to={`/meetings/${r.meeting.id}`} className="card flex items-center gap-3 p-3.5">
                  <span className="flex w-16 shrink-0 flex-col font-mono text-[12px]">
                    {when(r.meeting.scheduledAt, tz)}
                    <span className="text-[10px] text-text-3">{zoneAbbr(tz)}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium">{r.company.name}</span>
                    <span className="truncate text-[12px] text-text-3">{r.meeting.withWhom}</span>
                  </span>
                  <Pill hue={STATUS[r.status].hue} dot>
                    {STATUS[r.status].label}
                  </Pill>
                </Link>
              );
            })}
          </section>
          <section aria-label="Meetings this week, table" className="card hidden min-w-0 overflow-x-auto sm:block">
            <div className={`grid ${cols} min-w-[640px] gap-3 border-b border-line px-5 py-3 text-[12px] font-medium text-text-3 bg-surface-2`}>
              <span>When</span>
              <span>Company</span>
              <span>Owner</span>
              <span>Status</span>
              <span>Bonus</span>
            </div>
            {view.rows.map((r) => {
              const tz = r.company.timezone ?? user.timezone;
              const active = selected?.meeting.id === r.meeting.id;
              return (
                <button
                  key={r.meeting.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParams({ ...(week === thisWeek ? {} : { week }), id: r.meeting.id })}
                  className={`grid w-full ${cols} min-w-[640px] items-center gap-3 border-b border-line-soft px-5 py-3 text-left text-[13px] last:border-b-0 hover:bg-surface-2 ${
                    active || r.status === "to_approve" ? "bg-surface-2" : ""
                  }`}
                >
                  <span className="font-mono text-[12px]" title={`Your time: ${when(r.meeting.scheduledAt, user.timezone)} ${zoneAbbr(user.timezone)}`}>
                    {when(r.meeting.scheduledAt, tz)}
                    <span className="block text-[10px] text-text-3">{zoneAbbr(tz)} local</span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[14px]">{r.company.name}</span>
                    <span className="truncate text-[12px] text-text-3">
                      <span style={{ color: `var(--${MEETING_TYPE_HUE[r.meeting.type]})` }}>{r.meeting.type === "in_person" ? "In person" : r.meeting.type === "phone" ? "Phone" : "Video"}</span> · {r.contact?.title ?? r.meeting.withWhom}
                      {r.status === "rejected" && r.meeting.rejectReason ? ` · ${r.meeting.rejectReason}` : ""}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-text-2">
                    <Avatar id={r.meeting.bookedBy} name={r.bookedByName} size={20} />
                    <span className="truncate">{r.bookedByName ?? "—"}</span>
                  </span>
                  <span className="justify-self-start">
                    <Pill hue={STATUS[r.status].hue} dot>
                      {STATUS[r.status].label}
                    </Pill>
                  </span>
                  <span className={`num ${r.bonus === "earned" ? "text-mint" : "text-text-3"}`}>{r.bonus === "earned" ? `+${usd(MEETING_BONUS_MINOR)}` : r.bonus === "pending" ? "pending" : "—"}</span>
                </button>
              );
            })}
          </section>
          {selected ? (
            <div className="hidden sm:contents">
            <ApprovalPanel
              row={selected}
              isAdmin={isAdmin}
              canMark={isAdmin || selected.meeting.bookedBy === user.id || selected.meeting.ownerId === user.id}
              onChanged={load}
            />
            </div>
          ) : null}
        </div>
      )}
      <NewMeetingModal
        open={booking !== false}
        initial={booking || null}
        onClose={() => setBooking(false)}
        onBooked={() => {
          load();
          setCalendarKey((k) => k + 1);
        }}
      />
    </div>
  );
};

export default Meetings;
