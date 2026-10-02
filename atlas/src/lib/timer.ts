/** Broadcast so the global timer bar and the time page refresh when either starts or stops a timer. */
export const TIMER_EVENT = "atlas:timer";
export const timerChanged = () => window.dispatchEvent(new Event(TIMER_EVENT));

/** "00:42:10" from milliseconds. */
export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
