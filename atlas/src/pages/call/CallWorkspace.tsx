import OfferPrices from "@/components/OfferPrices";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { usePageChrome } from "@/components/shell/PageChrome";
import { Modal, useToast } from "@/components/ui/overlay";
import { BrandChip, EmptyState, SkeletonRows } from "@/components/ui/primitives";
import { DISPOSITIONS, type Disposition, type DispositionKey } from "@/config/dispositions";
import { industryLabel, LIST_LABEL } from "@/config/leads";
import { QUEUE } from "@/config/queue";
import { fillScript, SCRIPTS } from "@/config/scripts";
import { AccessError, data, type CallContext, type Meeting, type TodayStats } from "@/data";
import { timelineDate } from "@/lib/format";
import { isTypingTarget } from "@/lib/hotkeys";
import { Forbidden } from "@/pages/StatusPages";
import EmailCompose from "@/components/EmailCompose";
import { queueUpdated } from "@/lib/events";
import { addBusinessDays, localDateKey, localHHMM, parseWindow, zonedToUtc, zoneAbbr } from "@/services/time";
import { telephony, type CallHandle, type CallResult, type CallStatus } from "@/services/telephony";

type Pending = Extract<DispositionKey, "gatekeeper" | "call_back" | "meeting_booked" | "do_not_contact"> | "skip" | null;
const NEEDS_FORM = new Set<DispositionKey>(["gatekeeper", "call_back", "meeting_booked", "do_not_contact"]);
/** Allowed even when calling is blocked: they fix the data, not call it. */
const ALWAYS_ALLOWED = new Set<DispositionKey>(["wrong_number", "do_not_contact"]);
const NOTES_DEBOUNCE_MS = 1000;

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const TIER_TONE = { A: "border-mint text-mint", B: "border-cyan text-cyan", C: "border-lavender text-lavender", D: "border-text-3 text-text-3" } as const;

/** "YYYY-MM-DDTHH:MM" in the lead's zone → UTC ISO. */
const localInputToIso = (value: string, tz: string) => {
  const [date, time] = value.split("T");
  return new Date(zonedToUtc(date, time, tz)).toISOString();
};
const isoToLocalInput = (ms: number, tz: string) => `${localDateKey(ms, tz)}T${localHHMM(ms, tz)}`;

const ShieldIcon = ({ ok }: { ok: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={`mt-0.5 shrink-0 ${ok ? "text-mint" : "text-coral"}`}>
    <path d={ok ? "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5" : "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 9l6 6M15 9l-6 6"} />
  </svg>
);

const Finished = ({ onPull }: { onPull: () => void }) => {
  const [stats, setStats] = useState<TodayStats | null>(null);
  useEffect(() => {
    data.todayStats().then(setStats);
  }, []);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title m-0">Queue done. Great work.</h1>
      {stats ? (
        <p className="m-0 text-[15px] text-text-2">
          Today: <span className="num text-text">{stats.dials}</span> dials · <span className="num text-text">{stats.conversations}</span> conversations ·{" "}
          <span className="num text-text">{stats.meetingsBookedWeek}</span> meetings booked this week.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={onPull}>
          Pull more leads →
        </button>
        <Link to="/today" className="btn-outline">
          Back to Today
        </Link>
      </div>
    </div>
  );
};

const CallWorkspace = () => {
  const { leadId } = useParams();
  const [params] = useSearchParams();
  /** Opened from the lead page's Book meeting: book, then go back to the lead. */
  const bookOnly = params.get("book") === "1";
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();

  const [ctx, setCtx] = useState<CallContext | null | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<CallStatus>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [composing, setComposing] = useState(false);
  const [objection, setObjection] = useState<string | null>(null);
  const [form, setForm] = useState({ gatekeeper: "", callback: "", meeting: "", withWhom: "", type: "video" as Meeting["type"], skip: "" });

  const handle = useRef<CallHandle | null>(null);
  const ended = useRef<Promise<CallResult> | null>(null);
  const result = useRef<CallResult | null>(null);
  const connectedAt = useRef<number | null>(null);
  const notesDirty = useRef(false);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const notesEl = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    setError(null);
    data
      .callContext(leadId)
      .then((c) => {
        setCtx(c);
        if (c && !leadId) navigate(`/call/${c.detail.lead.id}`, { replace: true });
      })
      .catch((e: Error) => setError(e));
  }, [leadId, navigate]);

  // New lead: reset the call state and load its context (and saved draft notes).
  useEffect(() => {
    setCtx(undefined);
    setStatus("ready");
    setElapsed(0);
    setMuted(false);
    setHeld(false);
    setPending(null);
    setObjection(null);
    handle.current = null;
    ended.current = null;
    result.current = null;
    connectedAt.current = null;
    load();
  }, [load]);

  useEffect(() => {
    if (ctx && bookOnly) setPending("meeting_booked");
  }, [ctx, bookOnly]);

  useEffect(() => {
    if (!ctx) return;
    setNotes(ctx.draftNotes);
    notesDirty.current = false;
    const tz = ctx.detail.company.timezone ?? user.timezone;
    const contact = ctx.detail.contact;
    const firstWindow = parseWindow(QUEUE.windows[ctx.detail.lead.listType].call[0])[0];
    setForm({
      gatekeeper: "",
      callback: isoToLocalInput(Math.ceil((Date.now() + 3_600_000) / 900_000) * 900_000, tz),
      meeting: `${addBusinessDays(localDateKey(Date.now(), tz), 1)}T${firstWindow === "07:00" ? "10:00" : firstWindow}`,
      withWhom: contact ? `${contact.firstName} ${contact.lastName}`.trim() : "",
      type: "video",
      skip: "",
    });
  }, [ctx, user.timezone]);

  // Notes are saved automatically (1 s debounce) and flushed when leaving the lead.
  const currentLead = ctx?.detail.lead.id;
  useEffect(() => {
    if (!currentLead || !notesDirty.current) return;
    const t = window.setTimeout(() => {
      data.saveCallNotes(currentLead, notesRef.current);
      notesDirty.current = false;
    }, NOTES_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [notes, currentLead]);
  useEffect(
    () => () => {
      if (currentLead && notesDirty.current) data.saveCallNotes(currentLead, notesRef.current);
    },
    [currentLead],
  );

  // Call timer.
  useEffect(() => {
    if (status !== "connected") return;
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - (connectedAt.current ?? Date.now())) / 1000)), 250);
    return () => window.clearInterval(t);
  }, [status]);

  const tz = ctx?.detail.company.timezone ?? user.timezone;
  const phone = ctx ? (ctx.detail.contact?.phone ?? ctx.detail.company.phone) : null;
  const canCall = Boolean(ctx?.compliance.allowed && phone && telephony.available);
  const live = status === "ringing" || status === "connected";

  const startCall = () => {
    if (!ctx || !canCall || live || !phone) return;
    result.current = null;
    setElapsed(0);
    const { handle: h, ended: e } = telephony.call(phone, {
      onStatus: (s) => {
        if (s === "connected") connectedAt.current = Date.now();
        setStatus(s);
      },
    });
    handle.current = h;
    ended.current = e.then((r) => (result.current = r));
  };

  const hangUp = async () => {
    if (!handle.current || !live) return result.current;
    handle.current.hangUp();
    return ended.current;
  };

  const advance = useCallback(async () => {
    queueUpdated();
    const next = await data.callContext();
    if (next) navigate(`/call/${next.detail.lead.id}`);
    else {
      setCtx(null);
      navigate("/call", { replace: true });
    }
  }, [navigate]);

  const submit = async (key: DispositionKey) => {
    if (!ctx || busy) return;
    setBusy(true);
    try {
      const r = (await hangUp()) ?? result.current;
      const out = await data.logOutcome({
        leadId: ctx.detail.lead.id,
        disposition: key,
        notes: notesRef.current,
        durationS: r?.durationS ?? 0,
        recordingUrl: r?.recordingUrl ?? null,
        gatekeeperName: key === "gatekeeper" ? form.gatekeeper.trim() || undefined : undefined,
        callbackAt: key === "call_back" ? localInputToIso(form.callback, tz) : undefined,
        meeting: key === "meeting_booked" ? { at: localInputToIso(form.meeting, tz), withWhom: form.withWhom.trim() || "Contact", type: form.type } : undefined,
      });
      notesDirty.current = false;
      setPending(null);
      toast(`${ctx.detail.company.name} · ${out.message}`, "good");
      if (bookOnly && key === "meeting_booked") navigate(`/leads/${ctx.detail.lead.id}`);
      else await advance();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const choose = (d: Disposition) => {
    if (!ctx || busy) return;
    if (!ctx.compliance.allowed && !ALWAYS_ALLOWED.has(d.key) && status !== "ended") {
      toast("Calling is blocked for this lead. Skip it, or log Wrong number / Do not contact.", "error");
      return;
    }
    if (NEEDS_FORM.has(d.key)) setPending(d.key as Pending);
    else submit(d.key);
  };

  const skip = async () => {
    if (!ctx || !form.skip.trim()) return;
    try {
      await hangUp();
      if (notesDirty.current) await data.saveCallNotes(ctx.detail.lead.id, notesRef.current);
      await data.skipLead(ctx.detail.lead.id, form.skip);
      setPending(null);
      toast(`Skipped ${ctx.detail.company.name}`, "info");
      await advance();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  // Keyboard: C call/hang up · 1–9 outcome · N skip · E email · B book · M mute · ? help. Never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (!ctx || pending || help || composing) return;
      const k = e.key.toLowerCase();
      const d = DISPOSITIONS.find((x) => x.hotkey === k);
      if (d) {
        e.preventDefault();
        choose(d);
      } else if (k === "c") {
        e.preventDefault();
        if (live) hangUp();
        else startCall();
      } else if (k === "n") {
        e.preventDefault();
        setPending("skip");
      } else if (k === "b") {
        e.preventDefault();
        setPending("meeting_booked");
      } else if (k === "e") {
        e.preventDefault();
        setComposing(true);
      } else if (k === "m" && live) {
        setMuted((m) => {
          handle.current?.setMuted(!m);
          return !m;
        });
      } else if (e.key === "?") {
        setHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  usePageChrome(
    ctx
      ? {
          context: ctx.position ? `Lead ${ctx.position.index} of ${ctx.position.total}` : `Lead · ${ctx.detail.company.name}`,
          action: { label: "Today", to: "/today" },
        }
      : null,
  );

  if (error instanceof AccessError && error.status === 403) return <Forbidden />;
  if (error)
    return (
      <div className="flex items-center gap-4 text-[14px] text-coral">
        {error.message}
        <button type="button" className="btn-outline h-9" onClick={load}>
          Retry
        </button>
      </div>
    );
  if (ctx === undefined) return <SkeletonRows rows={8} />;
  if (ctx === null)
    return user.dailyCapacity ? (
      <Finished
        onPull={async () => {
          await data.buildQueue();
          queueUpdated();
          load();
        }}
      />
    ) : (
      <EmptyState title="You don't have a daily queue. Open a lead from Leads and press Call there." action={<Link className="btn-outline" to="/leads">Go to leads →</Link>} />
    );

  const { lead, company, contact } = ctx.detail;
  const script = SCRIPTS[lead.listType];
  const why = lead.scoreBreakdown.filter((l) => l.points > 0);
  const contactName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : "";

  return (
    <div className="-mx-10 -my-8 grid min-h-[calc(100vh-72px)] xl:grid-cols-[330px_minmax(0,1fr)_300px]">
      {/* Left: the lead */}
      <section aria-label="Lead" className="flex flex-col gap-5 border-b border-line px-7 py-7 xl:border-b-0 xl:border-r">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {company.brandInterest.slice(0, 1).map((b) => (
              <BrandChip key={b} brand={b} />
            ))}
            <span className="chip border-line-strong text-text-2">
              {LIST_LABEL[lead.listType]} · {industryLabel(company.industry)}
            </span>
          </div>
          <h1 className="m-0 text-[30px] font-light leading-tight tracking-[-0.01em]">
            <Link to={`/leads/${lead.id}`} className="hover:text-cyan">
              {company.name}
            </Link>
          </h1>
          <div className="text-[13px] text-text-2">
            {[company.city, company.region].filter(Boolean).join(", ")} · local time <span className="num text-text">{company.timezone ? localHHMM(Date.now(), company.timezone) : "—"}</span>
            {company.reviewsCount ? ` · ${company.reviewsCount} reviews` : ""}
            {company.rating ? ` · ${company.rating}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-4 border border-line p-4">
          <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center border ${TIER_TONE[lead.tier]}`}>
            <span className="font-mono text-[22px]">{lead.score}</span>
            <span className="text-[10px] tracking-[0.2em]">TIER {lead.tier}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1 text-[13px]">
            <span className="truncate">{contactName ? `${contactName}${contact?.title ? ` · ${contact.title}` : ""}` : "No named contact"}</span>
            <span className="font-mono text-text-2">{phone ?? "No phone"}</span>
            <span className="text-[12px] text-text-3">
              {contact?.phoneInvalid ? "Marked invalid" : contact?.phone ? "Direct line" : "Main line"}
              {contact?.phoneVerified ? " · verified" : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-caps">Why this score</span>
          {why.slice(0, 6).map((l) => (
            <div key={l.ruleId} className="flex justify-between border-b border-line-soft py-1.5 text-[13px]">
              <span className="text-text-2">{l.label}</span>
              <span className="num text-mint">+{l.points}</span>
            </div>
          ))}
          {why.length > 6 ? (
            <Link to={`/leads/${lead.id}`} className="text-[12px] text-text-3 hover:text-text">
              + {why.length - 6} more rules · see lead detail
            </Link>
          ) : null}
        </div>

        <div role="status" className={`flex items-start gap-2.5 border px-3.5 py-3 text-[12px] ${ctx.compliance.allowed ? "border-line text-text-2" : "border-coral text-coral"}`}>
          <ShieldIcon ok={ctx.compliance.allowed} />
          <span>{ctx.compliance.allowed ? `Allowed to call: ${ctx.compliance.reasons.join(", ")}.` : `Blocked: ${ctx.compliance.reasons.join(" · ")}.`}</span>
        </div>
      </section>

      {/* Center: the call */}
      <section aria-label="Live call" className="flex min-w-0 flex-col gap-5 px-8 py-7">
        <div className="card flex flex-wrap items-center justify-between gap-4 px-6 py-[22px]">
          <div className="flex flex-col gap-1.5">
            <span
              className={`text-[11px] uppercase tracking-label ${status === "connected" ? "text-mint" : status === "ringing" ? "text-cyan" : status === "ended" ? "text-text-2" : "text-label"}`}
              aria-live="polite"
            >
              ● {status}
              {muted ? " · muted" : ""}
              {held ? " · on hold" : ""}
            </span>
            <span className="font-mono text-[34px]">{mmss(elapsed)}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {live ? (
              <>
                <button
                  type="button"
                  className="btn-outline h-11 text-[11px]"
                  aria-pressed={muted}
                  onClick={() => {
                    handle.current?.setMuted(!muted);
                    setMuted(!muted);
                  }}
                >
                  {muted ? "Unmute" : "Mute"}
                </button>
                <button
                  type="button"
                  className="btn-outline h-11 text-[11px]"
                  aria-pressed={held}
                  onClick={() => {
                    handle.current?.setHeld(!held);
                    setHeld(!held);
                  }}
                >
                  {held ? "Resume" : "Hold"}
                </button>
                <button type="button" className="btn-outline h-11 text-[11px]" disabled title="Keypad arrives with Twilio calling">
                  Keypad
                </button>
                <button type="button" className="btn-danger h-11 text-[11px]" onClick={() => hangUp()}>
                  End call
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary h-11"
                disabled={!canCall}
                title={canCall ? `Call ${phone} (C)` : ctx.compliance.reasons.join(" · ")}
                onClick={startCall}
              >
                {status === "ended" ? "Call again" : "Call"} <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </div>
        <span className="-mt-3 text-[11px] text-text-3">
          {telephony.name} · calls over 60 s are recorded{result.current?.recordingUrl ? " · this call was recorded" : ""}
        </span>

        <div className="flex flex-col gap-3.5 border border-line px-6 py-5">
          <span className="label-caps">
            Script · {LIST_LABEL[lead.listType]} · opener under 20 seconds{script.draft ? " · draft" : ""}
          </span>
          <p className="m-0 text-[18px] font-light leading-relaxed">"{fillScript(script.opener, contact?.firstName ?? "", user.name.split(" ")[0])}"</p>
          <div className="grid gap-3 md:grid-cols-3">
            {script.questions.map((q, i) => (
              <div key={q} className="flex gap-2 text-[13px] text-text-2">
                <span className="font-mono text-text-3">0{i + 1}</span>
                <span>{q}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {script.objections.map((o) => (
              <button
                key={o.label}
                type="button"
                aria-expanded={objection === o.label}
                onClick={() => setObjection(objection === o.label ? null : o.label)}
                className={`h-8 border px-3 text-[12px] ${objection === o.label ? "border-ice bg-ice text-ice-ink" : "border-line-strong text-text-2 hover:text-text"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {objection ? <p className="m-0 text-[13px] text-amber">{script.objections.find((o) => o.label === objection)?.answer}</p> : null}
        </div>

        <label className="flex flex-col gap-2">
          <span className="label-caps">Notes · saved automatically</span>
          <textarea
            ref={notesEl}
            value={notes}
            onChange={(e) => {
              notesDirty.current = true;
              setNotes(e.target.value);
            }}
            rows={3}
            className="input h-auto resize-y bg-surface py-3 text-[14px]"
            placeholder="What did you learn? Esc to leave the notes and use shortcuts."
          />
        </label>

        <div className="flex flex-col gap-2.5">
          <span className="label-caps">Outcome · press 1–9</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {DISPOSITIONS.map((d) => {
              const disabled = busy || (!ctx.compliance.allowed && !ALWAYS_ALLOWED.has(d.key) && status !== "ended");
              return (
                <button
                  key={d.key}
                  type="button"
                  title={d.effect}
                  disabled={disabled}
                  onClick={() => choose(d)}
                  className={`flex h-[46px] items-center gap-3 border px-3.5 text-left text-[14px] disabled:opacity-40 ${
                    d.tone === "ice"
                      ? "border-ice bg-ice text-ice-ink hover:bg-text"
                      : d.tone === "coral"
                        ? "border-coral/60 text-coral hover:border-coral"
                        : "border-line-strong text-text hover:border-line-button hover:bg-surface"
                  }`}
                >
                  <span className="border border-current px-1.5 font-mono text-[11px] opacity-80">{d.hotkey}</span>
                  <span>{d.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right: offer and history */}
      <section aria-label="Offer and history" className="flex flex-col gap-5 border-t border-line px-6 py-7 xl:border-l xl:border-t-0">
        <div className="card flex flex-col gap-3 p-[18px]">
          <span className="label-caps">Offer · {script.offerName}</span>
          <OfferPrices listType={lead.listType} country={company.country} />
          <Link to={`/deals/new?lead=${lead.id}`} className="btn-primary h-10 justify-between text-[11px]">
            <span>Create quote</span>
            <span aria-hidden="true">→</span>
          </Link>
          <button type="button" className="btn-outline h-10 justify-between text-[11px]" onClick={() => setComposing(true)}>
            <span>Email (E)</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <span className="label-caps">History</span>
          {ctx.detail.activities.slice(0, 5).map((a) => (
            <div key={a.id} className="flex gap-3 text-[13px]">
              <span className="w-12 shrink-0 font-mono text-text-3">{timelineDate(a.at, user.timezone)}</span>
              <span className="text-text-2">{a.title}</span>
            </div>
          ))}
          {!ctx.detail.activities.length ? <span className="text-[13px] text-text-2">No history yet.</span> : null}
        </div>

        <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3.5 text-[12px] text-text-3">
          <span>
            <span className="font-mono">C</span> call · <span className="font-mono">1–9</span> outcome · <span className="font-mono">N</span> skip ·{" "}
            <span className="font-mono">B</span> book · <span className="font-mono">?</span> help
          </span>
          {ctx.position ? (
            <span>
              {ctx.position.done} of {ctx.position.total} calls done today
            </span>
          ) : null}
          <span>{ctx.nextUp ? `Next up: ${ctx.nextUp.company.name} · ${ctx.nextUp.company.city ?? ""}` : "Last call in today's queue"}</span>
        </div>
      </section>

      <EmailCompose open={composing} leadId={lead.id} listType={lead.listType} companyName={company.name} onClose={() => setComposing(false)} onQueued={load} />

      {/* Outcome forms */}
      <Modal open={pending === "gatekeeper"} onClose={() => setPending(null)} title="3 · Gatekeeper">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit("gatekeeper");
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="field-label">Gatekeeper's name (optional)</span>
            <input className="input" value={form.gatekeeper} onChange={(e) => setForm({ ...form, gatekeeper: e.target.value })} />
          </label>
          <button type="submit" className="btn-primary justify-between" disabled={busy}>
            <span>Log · retry next business day</span>
            <span aria-hidden="true">↵</span>
          </button>
        </form>
      </Modal>

      <Modal open={pending === "call_back"} onClose={() => setPending(null)} title="6 · Call back">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit("call_back");
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="field-label">When · {company.name} local time ({zoneAbbr(tz)})</span>
            <input type="datetime-local" required className="input" value={form.callback} onChange={(e) => setForm({ ...form, callback: e.target.value })} />
          </label>
          <button type="submit" className="btn-primary justify-between" disabled={busy}>
            <span>Schedule callback</span>
            <span aria-hidden="true">↵</span>
          </button>
        </form>
      </Modal>

      <Modal open={pending === "meeting_booked"} onClose={() => setPending(null)} title="8 · Meeting booked">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit("meeting_booked");
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="field-label">Date and time · {company.name} local time ({zoneAbbr(tz)})</span>
            <input type="datetime-local" required className="input" value={form.meeting} onChange={(e) => setForm({ ...form, meeting: e.target.value })} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">With whom</span>
            <input className="input" required value={form.withWhom} onChange={(e) => setForm({ ...form, withWhom: e.target.value })} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="field-label">Type</span>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Meeting["type"] })}>
              <option value="video">Video call</option>
              <option value="phone">Phone</option>
              <option value="in_person">In person</option>
            </select>
          </label>
          <span className="text-[12px] text-text-3">The contact gets a confirmation email with the invite, and reminders 24 h and 1 h before.</span>
          <button type="submit" className="btn-primary justify-between" disabled={busy}>
            <span>Book meeting</span>
            <span aria-hidden="true">↵</span>
          </button>
        </form>
      </Modal>

      <Modal open={pending === "do_not_contact"} onClose={() => setPending(null)} title="9 · Do not contact">
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[14px] text-text-2">
            Removes {company.name} from all lists and channels: its phone and emails go on the opt-out list, every cadence stops, and the lead is closed as lost.
          </p>
          <button type="button" className="btn-danger" disabled={busy} onClick={() => submit("do_not_contact")} autoFocus>
            Confirm do not contact
          </button>
        </div>
      </Modal>

      <Modal open={pending === "skip"} onClose={() => setPending(null)} title="Skip without an outcome">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            skip();
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="field-label">Reason</span>
            <input className="input" required value={form.skip} onChange={(e) => setForm({ ...form, skip: e.target.value })} placeholder="e.g. Already spoke yesterday" />
          </label>
          <button type="submit" className="btn-outline" disabled={!form.skip.trim()}>
            Skip to next lead →
          </button>
        </form>
      </Modal>

      <Modal open={help} onClose={() => setHelp(false)} title="Shortcuts">
        <dl className="m-0 grid grid-cols-[60px_1fr] gap-y-2 text-[14px]">
          {[
            ["C", "Call / hang up"],
            ["1–9", "Log the outcome"],
            ["N", "Skip to the next lead (needs a reason)"],
            ["B", "Book a meeting"],
            ["E", "Email"],
            ["M", "Mute"],
            ["Esc", "Leave the notes field"],
            ["?", "This help"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-text-2">{k}</dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
};

export default CallWorkspace;
