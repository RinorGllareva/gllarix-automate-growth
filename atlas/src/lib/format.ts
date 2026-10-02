/** Local wall-clock "HH:MM" in a timezone. */
export const localTime = (tz: string | null, at = new Date()) =>
  tz ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(at) : "—";

/** "3h", "2d", "12d", "—": time since, as in the Leads mockup's LAST column. */
export const since = (iso: string | null, now = Date.now()) => {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const DAY = 86_400_000;

/** "Today", "Tomorrow", "Wed", "Tue 1 Dec" in the viewer's timezone. */
export const dayLabel = (iso: string, tz?: string, now = new Date()) => {
  const d = new Date(iso);
  const key = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(x);
  if (key(d) === key(now)) return "Today";
  if (key(d) === key(new Date(now.getTime() + DAY))) return "Tomorrow";
  if (key(d) === key(new Date(now.getTime() - DAY))) return "Yesterday";
  const diff = Math.abs(d.getTime() - now.getTime());
  return new Intl.DateTimeFormat("en-GB", diff < 6 * DAY ? { weekday: "short", timeZone: tz } : { weekday: "short", day: "numeric", month: "short", timeZone: tz })
    .format(d)
    .replace(",", "");
};

/** Short timeline date: "Today", "Mon", "24 Nov". */
export const timelineDate = (iso: string, tz?: string, now = new Date()) => {
  const label = dayLabel(iso, tz, now);
  if (label === "Today" || label === "Yesterday") return label;
  const d = new Date(iso);
  if (now.getTime() - d.getTime() < 6 * DAY && d < now) return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(d);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: tz }).format(d);
};

/** Tables: 01/12/2026. */
export const tableDate = (iso: string, tz?: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz }).format(new Date(iso));

export const count = (n: number) => n.toLocaleString("en-US");

export const NEXT_ACTION_LABEL: Record<string, string> = {
  call: "Call",
  email: "Email",
  linkedin: "LinkedIn",
  follow_up: "Follow-up",
  meeting: "Meeting",
  meeting_prep: "Meeting prep",
};

export const nextActionText = (type: string | null, at: string | null, tz?: string) => {
  if (!type || !at) return "—";
  const day = dayLabel(at, tz);
  const when = ["Today", "Tomorrow", "Yesterday"].includes(day) ? day.toLowerCase() : day;
  const overdue = new Date(at).getTime() < Date.now() - 86_400_000;
  return `${NEXT_ACTION_LABEL[type] ?? type} ${when}${overdue ? " · overdue" : ""}`;
};

export const downloadText = (filename: string, text: string, type = "text/csv") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
};
