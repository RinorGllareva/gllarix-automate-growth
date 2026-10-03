/**
 * Background jobs the browser runs while Atlas is open (billing, coaching, the sender) until Supabase cron takes over.
 * A page asks for a job; it runs at most once per interval per tab, so opening a page doesn't redo the work.
 */
const lastRun = new Map<string, number>();
const running = new Map<string, Promise<unknown>>();

export const runJob = async <T>(key: string, everyMs: number, fn: () => Promise<T>): Promise<T | null> => {
  const inFlight = running.get(key);
  if (inFlight) return (await inFlight) as T;
  const last = lastRun.get(key) ?? 0;
  if (Date.now() - last < everyMs) return null;
  const p = fn().finally(() => running.delete(key));
  running.set(key, p);
  const out = await p;
  lastRun.set(key, Date.now());
  return out;
};

/** Tests and "Run now" buttons: forget when a job last ran. */
export const resetJob = (key: string) => lastRun.delete(key);
