import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useToast } from "@/components/ui/overlay";
import { TIMER_CONFIRM_HOURS } from "@/config/time";
import { data, type MyWeek } from "@/data";
import { clock, TIMER_EVENT, timerChanged } from "@/lib/timer";

/**
 * The global timer (A18): a thin bar on every page while a timer runs. It only shows what the person started:
 * no idle detection or activity tracking. A timer left running past 10 h asks whether to keep it.
 */
const TimerBar = () => {
  const toast = useToast();
  const { pathname } = useLocation();
  const [timer, setTimer] = useState<MyWeek["timer"]>(null);
  const [now, setNow] = useState(Date.now());
  const asked = useRef<string | null>(null);

  const refresh = useCallback(() => {
    data.runningTimer().then(setTimer, () => setTimer(null));
  }, []);
  useEffect(refresh, [refresh, pathname]);
  useEffect(() => {
    window.addEventListener(TIMER_EVENT, refresh);
    return () => window.removeEventListener(TIMER_EVENT, refresh);
  }, [refresh]);
  useEffect(() => {
    if (!timer) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [timer]);

  const stop = useCallback(
    async (endAt?: string) => {
      try {
        await data.stopRunningTimer(endAt);
        toast("Time logged", "good");
        timerChanged();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
    [toast],
  );

  // A forgotten timer: confirm on the next page load instead of logging a 14-hour day.
  useEffect(() => {
    if (!timer || asked.current === timer.startedAt) return;
    const hours = (Date.now() - new Date(timer.startedAt).getTime()) / 3_600_000;
    if (hours < TIMER_CONFIRM_HOURS) return;
    asked.current = timer.startedAt;
    if (window.confirm(`Your timer on "${timer.label}" has run for ${Math.floor(hours)} hours. Still working on it?\n\nOK keeps it running. Cancel stops it, and you can set when you stopped.`)) return;
    const when = window.prompt("When did you stop? (HH:MM today, or leave empty to stop it now)", "");
    if (when && /^\d{1,2}:\d{2}$/.test(when.trim())) {
      const [h, m] = when.trim().split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      stop(d.toISOString());
    } else stop();
  }, [timer, stop]);

  if (!timer || pathname === "/time") return null;
  return (
    <div role="status" aria-label="Running timer" className="flex h-10 items-center gap-3 border-b border-line bg-surface px-5 text-[13px] lg:px-10">
      <span className="h-2 w-2" style={{ background: "var(--mint)" }} />
      <Link to="/time" className="min-w-0 truncate text-text hover:text-cyan">
        {timer.label}
      </Link>
      <span className="hidden truncate text-[11px] uppercase tracking-[0.18em] text-text-3 md:inline">{timer.sub}</span>
      <span className="ml-auto font-mono">{clock(now - new Date(timer.startedAt).getTime())}</span>
      <button type="button" className="btn-outline h-7 px-3 text-[11px] tracking-[0.2em]" onClick={() => stop()}>
        STOP
      </button>
    </div>
  );
};

export default TimerBar;
