import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { hueTint, hueVar } from "@/config/colors";
import { data, type CalendarEvent } from "@/data";
import { localDateKey, localHHMM, shiftDateKey, zonedToUtc } from "@/services/time";

const START_H = 0;
const END_H = 24;
const ROW = 44; // px per hour
/** The grid opens scrolled to this hour; all 24 hours are reachable by scrolling inside it. */
const SCROLL_TO_H = 7;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const mondayOf = (dateKey: string) => {
  const d = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return shiftDateKey(dateKey, -((d + 6) % 7));
};
const minutesOf = (iso: string, tz: string) => {
  const [h, m] = localHHMM(new Date(iso), tz).split(":").map(Number);
  return h * 60 + m;
};
const dayLabel = (key: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));

const LEGEND: { label: string; hue: Parameters<typeof hueVar>[0]; striped?: boolean }[] = [
  { label: "Video meeting", hue: "blue" },
  { label: "Phone meeting", hue: "teal" },
  { label: "In person", hue: "pink" },
  { label: "Callback", hue: "orange" },
  { label: "Task due", hue: "lavender" },
  { label: "Google Calendar (busy)", hue: "text-3", striped: true },
];

const EventChip = ({ e, compact, onOpen }: { e: CalendarEvent; compact?: boolean; onOpen: (e: CalendarEvent) => void }) => {
  const google = e.kind === "google";
  return (
    <button
      type="button"
      onClick={() => onOpen(e)}
      title={`${e.title} · ${e.sub}${e.synced && !google ? " · on Google Calendar" : ""}`}
      className={`flex w-full min-w-0 items-center gap-1.5 overflow-hidden text-left text-[11px] leading-tight ${compact ? "h-5 px-1.5" : "px-1.5 py-1"} ${google ? "cursor-default" : "hover:brightness-110"}`}
      style={{
        color: google ? "var(--text-2)" : hueVar(e.hue),
        background: google ? "repeating-linear-gradient(135deg, var(--surface-2) 0 6px, var(--line-soft) 6px 12px)" : hueTint(e.hue, 22),
        borderLeft: `3px solid ${google ? "var(--line-strong)" : hueVar(e.hue)}`,
      }}
    >
      <span className="truncate font-medium">{e.title}</span>
      {e.synced && !google ? <span className="ml-auto shrink-0 text-[9px] opacity-70" aria-label="On Google Calendar">G</span> : null}
    </button>
  );
};

/** Google-Calendar-style week and month views of meetings, callbacks, tasks and Google busy time. */
const CalendarView = ({ timezone, userId, initialMode = "week", onSlot }: { timezone: string; userId?: string; initialMode?: "week" | "month"; onSlot?: (date: string, time: string) => void }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const today = localDateKey(Date.now(), timezone);
  const [mode, setMode] = useState<"week" | "month">(initialMode);
  const [anchor, setAnchor] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (mode === "week") {
      const start = mondayOf(anchor);
      return { start, days: Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i)) };
    }
    const first = `${anchor.slice(0, 7)}-01`;
    const start = mondayOf(first);
    return { start, days: Array.from({ length: 42 }, (_, i) => shiftDateKey(start, i)) };
  }, [mode, anchor]);

  useEffect(() => {
    setError(null);
    const from = new Date(zonedToUtc(range.days[0], "00:00", timezone)).toISOString();
    const to = new Date(zonedToUtc(shiftDateKey(range.days[range.days.length - 1], 1), "00:00", timezone)).toISOString();
    data.calendarEvents({ from, to, userId }).then(setEvents, (e: Error) => setError(e.message));
  }, [range, timezone, userId]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events ?? []) {
      const k = localDateKey(new Date(e.start), timezone);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [events, timezone]);

  const open = (e: CalendarEvent) => {
    if (e.href) navigate(e.href);
  };
  const step = (n: number) => {
    if (mode === "week") setAnchor(shiftDateKey(anchor, 7 * n));
    else {
      const [y, m] = anchor.split("-").map(Number);
      setAnchor(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10));
    }
  };
  const title =
    mode === "week"
      ? `${dayLabel(range.days[0])} – ${dayLabel(range.days[6])}`
      : new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${anchor.slice(0, 7)}-15T12:00:00Z`));
  const nowMin = minutesOf(new Date().toISOString(), timezone);
  useEffect(() => {
    if (mode === "week" && scroller.current) scroller.current.scrollTop = SCROLL_TO_H * ROW;
  }, [mode]);
  /** Click on empty time: book at that slot (rounded to 30 minutes). */
  const slotClick = (d: string) => (e: MouseEvent<HTMLDivElement>) => {
    if (!onSlot || e.target !== e.currentTarget) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const mins = Math.min(23 * 60 + 30, Math.max(0, Math.floor(((y / ROW) * 60) / 30) * 30));
    onSlot(d, `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
  };

  return (
    <section aria-label="Calendar" className="card flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
        <button type="button" className="btn-outline h-8 px-3 text-[11px]" onClick={() => setAnchor(today)}>
          Today
        </button>
        <button type="button" className="btn-outline h-8 w-8 px-0" aria-label="Previous" onClick={() => step(-1)}>
          ←
        </button>
        <button type="button" className="btn-outline h-8 w-8 px-0" aria-label="Next" onClick={() => step(1)}>
          →
        </button>
        <span className="ml-1 text-[15px] font-medium">{title}</span>
        <div role="radiogroup" aria-label="Calendar view" className="ml-auto flex border border-line-strong">
          {(["week", "month"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`h-8 px-3 text-[11px] uppercase tracking-[0.16em] ${mode === m ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="m-0 px-4 py-6 text-[13px] text-coral">{error}</p> : null}

      {mode === "week" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Day headers */}
            <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-line">
              <span />
              {range.days.map((d, i) => (
                <div key={d} className={`flex flex-col items-center gap-0.5 border-l border-line-soft py-2 ${d === today ? "" : ""}`}>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-label">{DOW[i]}</span>
                  <span className={`flex h-7 min-w-7 items-center justify-center px-1 text-[15px] ${d === today ? "bg-blue font-medium text-ice-ink" : "text-text"}`} style={d === today ? { background: hueVar("blue"), color: "var(--ice-ink)" } : undefined}>
                    {Number(d.slice(8))}
                  </span>
                </div>
              ))}
            </div>
            {/* All-day row (tasks due) */}
            <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-line">
              <span className="px-1.5 py-1.5 text-[9px] uppercase tracking-[0.14em] text-text-3">All day</span>
              {range.days.map((d) => (
                <div key={d} className="flex min-h-7 flex-col gap-0.5 border-l border-line-soft p-0.5">
                  {(byDay.get(d) ?? []).filter((e) => e.allDay).slice(0, 3).map((e) => (
                    <EventChip key={e.id} e={e} compact onOpen={open} />
                  ))}
                  {(byDay.get(d) ?? []).filter((e) => e.allDay).length > 3 ? <span className="px-1 text-[10px] text-text-3">+{(byDay.get(d) ?? []).filter((e) => e.allDay).length - 3} more</span> : null}
                </div>
              ))}
            </div>
            {/* Hour grid: all 24 hours, scrolls inside the calendar */}
            <div ref={scroller} className="max-h-[min(62vh,640px)] overflow-y-auto">
            <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
              <div className="flex flex-col">
                {Array.from({ length: END_H - START_H }, (_, i) => (
                  <span key={i} className="relative text-right font-mono text-[10px] text-text-3" style={{ height: ROW }}>
                    <span className="absolute -top-1.5 right-1.5">{String(START_H + i).padStart(2, "0")}:00</span>
                  </span>
                ))}
              </div>
              {range.days.map((d) => (
                <div
                  key={d}
                  onClick={slotClick(d)}
                  title={onSlot ? "Click an empty slot to book a meeting" : undefined}
                  className={`relative border-l border-line-soft ${onSlot ? "cursor-cell" : ""}`}
                  style={{ height: ROW * (END_H - START_H), background: d === today ? hueTint("blue", 5) : undefined }}
                >
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <div key={i} className="pointer-events-none absolute left-0 right-0 border-t border-line-soft" style={{ top: i * ROW }} />
                  ))}
                  {d === today && nowMin >= START_H * 60 && nowMin <= END_H * 60 ? (
                    <div className="pointer-events-none absolute left-0 right-0 z-10 h-0.5" style={{ top: ((nowMin - START_H * 60) / 60) * ROW, background: hueVar("coral") }} />
                  ) : null}
                  {(byDay.get(d) ?? [])
                    .filter((e) => !e.allDay)
                    .map((e, idx, list) => {
                      const s = Math.max(START_H * 60, minutesOf(e.start, timezone));
                      const end = Math.min(END_H * 60, Math.max(s + 20, minutesOf(e.end, timezone)));
                      // Side-by-side when events overlap.
                      const overlapping = list.filter((o) => minutesOf(o.start, timezone) < end && minutesOf(o.end, timezone) > s);
                      const col = overlapping.indexOf(e);
                      const width = 100 / Math.max(1, overlapping.length);
                      return (
                        <div key={e.id} className="absolute z-[5] overflow-hidden" style={{ top: ((s - START_H * 60) / 60) * ROW + 1, height: Math.max(18, ((end - s) / 60) * ROW - 2), left: `calc(${col * width}% + 2px)`, width: `calc(${width}% - 4px)` }}>
                          <div className="flex h-full flex-col">
                            <EventChip e={e} onOpen={open} />
                            {((end - s) / 60) * ROW > 34 ? (
                              <span className="truncate px-2 text-[10px]" style={{ color: e.kind === "google" ? "var(--text-3)" : hueVar(e.hue) }}>
                                {localHHMM(new Date(e.start), timezone)} · {e.sub}
                              </span>
                            ) : null}
                          </div>
                          <span className="sr-only">{idx}</span>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {DOW.map((d) => (
            <span key={d} className="border-b border-line px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] text-label">
              {d}
            </span>
          ))}
          {range.days.map((d) => {
            const list = byDay.get(d) ?? [];
            const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
            return (
              <div key={d} className={`flex min-h-[104px] flex-col gap-0.5 border-b border-r border-line-soft p-1 ${inMonth ? "" : "opacity-45"}`} style={{ background: d === today ? hueTint("blue", 7) : undefined }}>
                <span className="px-1 text-[12px]" style={d === today ? { color: hueVar("blue"), fontWeight: 600 } : undefined}>
                  {Number(d.slice(8))}
                </span>
                {list.slice(0, 4).map((e) => (
                  <EventChip key={e.id} e={e} compact onOpen={open} />
                ))}
                {list.length > 4 ? (
                  <button type="button" className="px-1 text-left text-[10px] text-text-3 hover:text-text" onClick={() => { setAnchor(d); setMode("week"); }}>
                    +{list.length - 4} more
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-3 py-2 text-[11px] text-text-2">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5" style={{ background: l.striped ? "repeating-linear-gradient(135deg, var(--surface-2) 0 3px, var(--line-strong) 3px 6px)" : hueVar(l.hue) }} />
            {l.label}
          </span>
        ))}
        <span className="ml-auto text-text-3">Times in {timezone}</span>
      </div>
    </section>
  );
};

export default CalendarView;
