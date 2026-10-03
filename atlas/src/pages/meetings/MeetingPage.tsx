import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import LinkedTasks from "@/components/LinkedTasks";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Avatar, EmptyState, Pill, SkeletonRows } from "@/components/ui/primitives";
import { MEETING_TYPE_HUE } from "@/config/colors";
import { AccessError, data, type Activity, type MeetingRow } from "@/data";
import { timelineDate } from "@/lib/format";
import { Forbidden } from "@/pages/StatusPages";
import { localHHMM, zoneAbbr } from "@/services/time";
import { ApprovalPanel, STATUS } from "./Meetings";

const TYPE_LABEL = { video: "Video call", phone: "Phone", in_person: "In person" } as const;
const NOTES_DEBOUNCE_MS = 800;

const longWhen = (iso: string, tz: string) =>
  `${new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date(iso))} · ${localHHMM(new Date(iso), tz)} ${zoneAbbr(tz)}`;

/**
 * /meetings/:id: everything about one meeting in one place. Prep and notes, who's on it, the recording, the outcome
 * (held / no-show, the $15 approval) and what happens next (tasks, a quote, a follow-up meeting).
 */
const MeetingPage = () => {
  const { id = "" } = useParams();
  const user = useUser();
  const [row, setRow] = useState<MeetingRow | null>(null);
  const [history, setHistory] = useState<Activity[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState<"saved" | "saving" | null>(null);
  const dirty = useRef(false);

  const load = useCallback(() => {
    data.getMeeting(id).then(
      (r) => {
        setRow(r);
        if (!dirty.current) setNotes(r.meeting.notes ?? "");
        data.getLead(r.lead.id).then((d) => setHistory(d.activities.slice(0, 6)), () => setHistory([]));
      },
      (e: Error) => setError(e),
    );
  }, [id]);
  useEffect(load, [load]);

  // Notes save themselves.
  useEffect(() => {
    if (!dirty.current) return;
    setSaved("saving");
    const t = window.setTimeout(async () => {
      await data.saveMeetingNotes(id, notes);
      dirty.current = false;
      setSaved("saved");
    }, NOTES_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [notes, id]);

  usePageChrome(row ? { context: `Meeting · ${row.company.name}`, action: { label: "All meetings", to: "/meetings" } } : null);

  if (error instanceof AccessError && error.status === 403) return <Forbidden />;
  if (error) return <EmptyState title={error instanceof AccessError && error.status === 404 ? "This meeting doesn't exist or was removed." : error.message} action={<Link to="/meetings" className="btn-outline">Back to meetings</Link>} />;
  if (!row) return <SkeletonRows rows={8} />;

  const m = row.meeting;
  const tz = row.company.timezone ?? user.timezone;
  const upcoming = new Date(m.scheduledAt).getTime() > Date.now();
  const isAdmin = user.role === "admin";
  const canEdit = user.role !== "viewer";
  const canMark = isAdmin || m.bookedBy === user.id || m.ownerId === user.id;
  const c = row.contact;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill hue={STATUS[row.status].hue} dot>
            {STATUS[row.status].label}
          </Pill>
          <Pill hue={MEETING_TYPE_HUE[m.type]}>{TYPE_LABEL[m.type]}</Pill>
        </div>
        <h1 className="page-title m-0">
          <Link to={`/leads/${row.lead.id}`} className="hover:text-cyan">
            {row.company.name}
          </Link>
        </h1>
        <p className="m-0 text-[14px] text-text-2">
          {longWhen(m.scheduledAt, tz)} for them
          {tz !== user.timezone ? <span className="text-text-3"> · {longWhen(m.scheduledAt, user.timezone)} for you</span> : null}
          {m.durationMin ? ` · ${m.durationMin} min` : ""}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Notes" className="card flex flex-col gap-2 p-5">
            <span className="flex items-center justify-between">
              <span className="text-[15px] font-semibold">{upcoming ? "Prep" : "Notes"}</span>
              <span className="text-[12px] text-text-3" aria-live="polite">
                {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : "Saved automatically"}
              </span>
            </span>
            <textarea
              className="input h-auto min-h-[180px] resize-y bg-surface py-3 text-[14px] leading-relaxed"
              aria-label={upcoming ? "Prep notes" : "Meeting notes"}
              readOnly={!canEdit}
              value={notes}
              placeholder={
                upcoming
                  ? "What do we know? Calls they miss, job value, who decides. What do we want from this meeting?"
                  : "What did they say? Objections, the decision-maker, budget, timing, next step agreed."
              }
              onChange={(e) => {
                dirty.current = true;
                setNotes(e.target.value);
              }}
            />
          </section>

          <section aria-label="Recording" className="card flex flex-col gap-2 p-5">
            <span className="text-[15px] font-semibold">Recording</span>
            {m.recordingUrl ? (
              <>
                <audio controls src={m.recordingUrl} className="w-full" aria-label={`Recording of the meeting with ${row.company.name}`} />
                <a href={m.recordingUrl} target="_blank" rel="noreferrer" className="text-[12px] text-cyan hover:underline">
                  Open the recording ↗
                </a>
              </>
            ) : (
              <span className="text-[13px] text-text-2">
                {upcoming ? "Phone and video meetings over 60 seconds are recorded and attached here." : "No recording attached. Add the key points to the notes instead."}
              </span>
            )}
          </section>

          <section aria-label="Next steps" className="flex flex-col gap-3">
            <span className="text-[15px] font-semibold">Next steps</span>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                {user.role !== "implementer" ? (
                  <Link to={`/deals/new?lead=${row.lead.id}`} className="btn-primary h-9">
                    Create quote
                  </Link>
                ) : null}
                <Link to={`/call/${row.lead.id}?book=1`} className="btn-outline h-9">
                  Book a follow-up meeting
                </Link>
                <Link to={`/leads/${row.lead.id}`} className="btn-outline h-9">
                  Open the lead
                </Link>
              </div>
            ) : null}
            <LinkedTasks type="meeting" id={m.id} />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section aria-label="Attendees" className="card flex flex-col gap-3 p-5">
            <span className="text-[15px] font-semibold">Who's on it</span>
            <div className="flex items-start gap-3 text-[13px]">
              <Avatar id={c?.id ?? m.id} name={m.withWhom} size={28} />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{m.withWhom}</span>
                <span className="text-[12px] text-text-3">
                  {c?.title ?? "Contact"} · {row.company.name}
                </span>
                {c?.phone ? <span className="num text-[12px] text-text-2">{c.phone}</span> : null}
                {c?.email ? <span className="truncate text-[12px] text-text-2">{c.email}</span> : null}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[13px]">
              <Avatar id={m.ownerId ?? m.bookedBy} name={row.ownerName} size={28} />
              <span className="flex flex-col">
                <span className="font-medium">{row.ownerName ?? "No owner"}</span>
                <span className="text-[12px] text-text-3">Runs the meeting{row.bookedByName && row.bookedByName !== row.ownerName ? ` · booked by ${row.bookedByName}` : ""}</span>
              </span>
            </div>
          </section>

          <ApprovalPanel row={row} isAdmin={isAdmin} canMark={canMark} onChanged={load} embedded />

          <section aria-label="History with this lead" className="card flex flex-col gap-2.5 p-5">
            <span className="text-[15px] font-semibold">Before this meeting</span>
            {history.length ? (
              history.map((a) => (
                <div key={a.id} className="flex gap-3 text-[13px]">
                  <span className="w-14 shrink-0 font-mono text-[12px] text-text-3">{timelineDate(a.at, user.timezone)}</span>
                  <span className="min-w-0">
                    <span className="block text-text-2">{a.title}</span>
                    {a.detail ? <span className="block truncate text-[12px] text-text-3">{a.detail}</span> : null}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-[13px] text-text-3">No calls or emails logged yet.</span>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default MeetingPage;
