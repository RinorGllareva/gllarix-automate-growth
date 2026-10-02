import { MEETING_TYPE_HUE } from "@/config/colors";
import { localDateKey, shiftDateKey, zonedToUtc } from "@/services/time";
import type { AlertType, CalendarApi, CalendarConnection, CalendarEvent, NotificationPrefs, StaffEmail } from "../calendarTypes";
import { ALERT_TYPES } from "../calendarTypes";
import type { Company, Lead } from "../leadTypes";
import type { Meeting } from "../queueTypes";
import type { Task } from "../taskTypes";
import { AccessError, type Notification, type User } from "../types";

const MIN = 60_000;
const DAY = 86_400_000;

/** An event on a person's (fake) Google Calendar: their own, or one Atlas pushed. */
export interface GoogleEvent {
  id: string;
  userId: string;
  title: string;
  start: string;
  end: string;
  source: "google" | "atlas";
  /** Atlas event id ("meeting:…", "callback:…") for pushed events. */
  atlasRef: string | null;
}

export interface CalendarStore {
  meetings: Meeting[];
  leads: Lead[];
  companies: Company[];
  tasks: Task[];
  calendarConnections: CalendarConnection[];
  googleEvents: GoogleEvent[];
  notificationPrefs: NotificationPrefs[];
  staffEmails: StaffEmail[];
}

export const emptyCalendarState = () => ({
  calendarConnections: [] as CalendarConnection[],
  googleEvents: [] as GoogleEvent[],
  notificationPrefs: [] as NotificationPrefs[],
  staffEmails: [] as StaffEmail[],
});

interface Ctx<S extends CalendarStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
}

const defaultPrefs = (userId: string): NotificationPrefs => ({
  userId,
  email: Object.fromEntries(ALERT_TYPES.map((a) => [a.type, true])) as Record<AlertType, boolean>,
  calendarPromptDismissedAt: null,
});

export const createDemoCalendar = <S extends CalendarStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
  const companyOf = (s: S, leadId: string) => s.companies.find((c) => c.id === s.leads.find((l) => l.id === leadId)?.companyId)?.name ?? "—";
  const prefsOf = (s: S, userId: string) => {
    let p = s.notificationPrefs.find((x) => x.userId === userId);
    if (!p) {
      p = defaultPrefs(userId);
      s.notificationPrefs.push(p);
    }
    return p;
  };

  /** The Atlas events that belong on a person's calendar (meetings they own or booked, their callbacks, their tasks). */
  const atlasEvents = (s: S, userId: string, from: number, to: number): CalendarEvent[] => {
    const out: CalendarEvent[] = [];
    for (const m of s.meetings) {
      if (m.ownerId !== userId && m.bookedBy !== userId) continue;
      const start = new Date(m.scheduledAt).getTime();
      if (start < from || start > to) continue;
      const status = m.approved === true ? "approved" : m.approved === false ? "rejected" : m.attended === false ? "no-show" : m.attended ? "held" : start > now() ? "upcoming" : "to mark";
      out.push({
        id: `meeting:${m.id}`, kind: "meeting", title: companyOf(s, m.leadId), sub: `${m.type === "in_person" ? "In person" : m.type === "phone" ? "Phone" : "Video"} · ${m.withWhom}`,
        start: m.scheduledAt, end: iso(start + (m.durationMin ?? 30) * MIN), allDay: false, hue: MEETING_TYPE_HUE[m.type] ?? "blue",
        href: `/meetings?id=${m.id}`, ownerId: m.ownerId, ownerName: nameOf(m.ownerId), status, synced: false,
      });
    }
    for (const l of s.leads) {
      if (l.ownerId !== userId || l.nextActionType !== "callback" || !l.nextActionAt) continue;
      const start = new Date(l.nextActionAt).getTime();
      if (start < from || start > to) continue;
      out.push({ id: `callback:${l.id}`, kind: "callback", title: `Call back ${companyOf(s, l.id)}`, sub: "Callback", start: l.nextActionAt, end: iso(start + 15 * MIN), allDay: false, hue: "orange", href: `/call/${l.id}`, ownerId: userId, ownerName: nameOf(userId), status: null, synced: false });
    }
    for (const t of s.tasks) {
      if (t.deletedAt || t.parentId || !t.dueAt || !t.assigneeIds.includes(userId) || t.status === "done" || t.status === "cancelled") continue;
      const due = new Date(t.dueAt).getTime();
      if (due < from || due > to) continue;
      out.push({ id: `task:${t.id}`, kind: "task", title: t.title, sub: `Task · ${t.priority}`, start: t.dueAt, end: t.dueAt, allDay: true, hue: "lavender", href: `/tasks?task=${t.id}`, ownerId: userId, ownerName: nameOf(userId), status: t.priority, synced: false });
    }
    return out;
  };

  // ---------------------------------------------------------------- Google sync (demo: a fake calendar per person)

  /** A few of the person's own (non-Atlas) events, so busy time shows next to Atlas work. */
  const seedGoogle = (s: S, user: User) => {
    const items: [number, string, string, number][] = [
      [1, "Dentist", "09:30", 60], [2, "School pickup", "15:00", 45], [3, "Gym", "07:00", 60], [5, "Family lunch", "12:30", 90],
      [8, "Accountant call", "11:00", 30], [9, "School pickup", "15:00", 45], [12, "Gym", "07:00", 60],
    ];
    const today = localDateKey(now(), user.timezone);
    for (const [d, title, hhmm, mins] of items) {
      const start = zonedToUtc(shiftDateKey(today, d), hhmm, user.timezone);
      s.googleEvents.push({ id: uid("ge"), userId: user.id, title, start: iso(start), end: iso(start + mins * MIN), source: "google", atlasRef: null });
    }
  };

  /** Push this person's meetings and callbacks (−7 to +60 days) to Google; update moved ones; remove gone ones. */
  const syncUser = (s: S, userId: string) => {
    const conn = s.calendarConnections.find((c) => c.userId === userId && c.status === "connected");
    if (!conn) return null;
    const wanted = atlasEvents(s, userId, now() - 7 * DAY, now() + 60 * DAY).filter((e) => e.kind !== "task");
    let pushed = 0;
    let removed = 0;
    for (const e of wanted) {
      const g = s.googleEvents.find((x) => x.userId === userId && x.atlasRef === e.id);
      const title = e.kind === "meeting" ? `Atlas · Meeting · ${e.title}` : `Atlas · ${e.title}`;
      if (!g) {
        s.googleEvents.push({ id: uid("ge"), userId, title, start: e.start, end: e.end, source: "atlas", atlasRef: e.id });
        pushed++;
      } else if (g.start !== e.start || g.end !== e.end || g.title !== title) {
        Object.assign(g, { start: e.start, end: e.end, title });
        pushed++;
      }
    }
    const ids = new Set(wanted.map((e) => e.id));
    const before = s.googleEvents.length;
    s.googleEvents = s.googleEvents.filter((g) => g.userId !== userId || g.source !== "atlas" || ids.has(g.atlasRef ?? "") || new Date(g.start).getTime() < now() - 7 * DAY);
    removed = before - s.googleEvents.length;
    const busy = s.googleEvents.filter((g) => g.userId === userId && g.source === "google").length;
    Object.assign(conn, { lastSyncAt: iso(), pushed: s.googleEvents.filter((g) => g.userId === userId && g.source === "atlas").length, busy });
    return { pushed, removed, busy };
  };

  // ---------------------------------------------------------------- alerts

  const sendAlert = (s: S, user: User, type: AlertType, key: string, subject: string, body: string, href: string | null) => {
    if (s.staffEmails.some((e) => e.key === key)) return false;
    if (!prefsOf(s, user.id).email[type]) {
      s.staffEmails.push({ id: uid("se"), userId: user.id, to: "", type, subject: "(email alerts off)", body: "", href, key, sentAt: iso() });
      return false;
    }
    s.staffEmails.push({ id: uid("se"), userId: user.id, to: user.email, type, subject, body, href, key, sentAt: iso() });
    return true;
  };

  const runAlerts = (s: S) => {
    let sent = 0;
    const t = now();
    const local = (at: string, tz: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(at));
    for (const u of users.filter((x) => x.active && x.role !== "viewer")) {
      for (const m of s.meetings) {
        const start = new Date(m.scheduledAt).getTime();
        const company = companyOf(s, m.leadId);
        if (m.ownerId === u.id && m.bookedBy !== u.id && t - new Date(m.createdAt).getTime() < DAY && start > t) {
          if (sendAlert(s, u, "meeting_booked", `mb:${m.id}:${u.id}`, `New meeting: ${company}, ${local(m.scheduledAt, u.timezone)}`, `${nameOf(m.bookedBy) ?? "Someone"} booked a ${m.type.replace("_", " ")} meeting with ${m.withWhom} at ${company} for you, ${local(m.scheduledAt, u.timezone)} your time.`, `/meetings?id=${m.id}`)) sent++;
        }
        if ((m.ownerId ?? m.bookedBy) === u.id && start > t && start - t <= 60 * MIN && m.attended === null) {
          if (sendAlert(s, u, "meeting_soon", `ms:${m.id}`, `In 1 hour: ${company}`, `Your meeting with ${m.withWhom} at ${company} starts ${local(m.scheduledAt, u.timezone)}. Open the lead for notes and the quote.`, `/leads/${m.leadId}`)) sent++;
        }
      }
      for (const l of s.leads) {
        if (l.ownerId !== u.id || l.nextActionType !== "callback" || !l.nextActionAt) continue;
        const at = new Date(l.nextActionAt).getTime();
        if (at > t && at - t <= 15 * MIN) {
          if (sendAlert(s, u, "callback_due", `cb:${l.id}:${l.nextActionAt}`, `Callback in 15 min: ${companyOf(s, l.id)}`, `You scheduled a callback with ${companyOf(s, l.id)} for ${local(l.nextActionAt, u.timezone)}.`, `/call/${l.id}`)) sent++;
        }
      }
      for (const task of s.tasks) {
        if (task.deletedAt || !task.assigneeIds.includes(u.id) || task.status === "done" || task.status === "cancelled") continue;
        if (task.priority === "urgent" && task.createdBy !== u.id && t - new Date(task.createdAt).getTime() < DAY) {
          if (sendAlert(s, u, "task_urgent", `tu:${task.id}:${u.id}`, `Urgent task: ${task.title}`, `${nameOf(task.createdBy) ?? "Atlas"} assigned you an urgent task: ${task.title}${task.dueAt ? `, due ${task.dueAt.slice(0, 10)}` : ""}.`, `/tasks?task=${task.id}`)) sent++;
        }
        if ((task.priority === "urgent" || task.priority === "high") && task.dueAt && new Date(task.dueAt).getTime() < t) {
          if (sendAlert(s, u, "task_overdue", `to:${task.id}:${u.id}:${localDateKey(t, u.timezone)}`, `Overdue: ${task.title}`, `"${task.title}" was due ${task.dueAt.slice(0, 10)}. Move the date or mark it done.`, `/tasks?task=${task.id}`)) sent++;
        }
      }
    }
    return sent;
  };

  // ---------------------------------------------------------------- API

  const api: CalendarApi = {
    async calendarEvents(q) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const target = q.userId && q.userId !== user.id ? q.userId : user.id;
      if (target !== user.id && user.role !== "admin") throw new AccessError(403, "You see your own calendar.");
      const s = await load();
      const from = new Date(q.from).getTime();
      const to = new Date(q.to).getTime();
      const events = atlasEvents(s, target, from, to);
      const pushed = new Set(s.googleEvents.filter((g) => g.userId === target && g.source === "atlas").map((g) => g.atlasRef));
      for (const e of events) e.synced = pushed.has(e.id);
      // The person's own Google events show as busy (titles only to themselves).
      for (const g of s.googleEvents.filter((x) => x.userId === target && x.source === "google")) {
        const st = new Date(g.start).getTime();
        if (st < from || st > to) continue;
        events.push({ id: `google:${g.id}`, kind: "google", title: target === user.id ? g.title : "Busy", sub: "Google Calendar", start: g.start, end: g.end, allDay: false, hue: "text-3", href: null, ownerId: target, ownerName: nameOf(target), status: null, synced: true });
      }
      return events.sort((a, b) => a.start.localeCompare(b.start));
    },

    async calendarConnection() {
      const user = await viewer();
      const s = await load();
      return s.calendarConnections.find((c) => c.userId === user.id) ?? null;
    },

    async connectGoogleCalendar({ email }) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Enter the Google account's email.");
      const s = await load();
      s.calendarConnections = s.calendarConnections.filter((c) => c.userId !== user.id);
      const conn: CalendarConnection = { userId: user.id, provider: "google", email: email.trim().toLowerCase(), calendarName: "Primary", status: "connected", connectedAt: iso(), lastSyncAt: null, pushed: 0, busy: 0, test: true };
      s.calendarConnections.push(conn);
      if (!s.googleEvents.some((g) => g.userId === user.id && g.source === "google")) seedGoogle(s, user);
      syncUser(s, user.id);
      audit(user.id, "calendar.connect", "user", user.id, null, { provider: "google", email: conn.email });
      await save();
      return conn;
    },

    async disconnectGoogleCalendar() {
      const user = await viewer();
      const s = await load();
      s.calendarConnections = s.calendarConnections.filter((c) => c.userId !== user.id);
      // Atlas events come off the Google calendar; the person's own events stay theirs.
      s.googleEvents = s.googleEvents.filter((g) => g.userId !== user.id || g.source === "google");
      audit(user.id, "calendar.disconnect", "user", user.id, null, { provider: "google" });
      await save();
    },

    async syncCalendar() {
      const user = await viewer();
      const s = await load();
      const r = syncUser(s, user.id);
      if (r) await save();
      return r;
    },

    async notificationPrefs() {
      const user = await viewer();
      const s = await load();
      return { ...prefsOf(s, user.id) };
    },

    async setNotificationPrefs(patch) {
      const user = await viewer();
      const s = await load();
      const p = prefsOf(s, user.id);
      if (patch.email) p.email = { ...p.email, ...patch.email };
      if (patch.dismissCalendarPrompt) p.calendarPromptDismissedAt = iso();
      audit(user.id, "settings.notifications", "user", user.id, null, patch);
      await save();
    },

    async runAlertJobs() {
      await viewer();
      const s = await load();
      const sent = runAlerts(s);
      for (const c of s.calendarConnections) {
        if (!c.lastSyncAt || now() - new Date(c.lastSyncAt).getTime() > 5 * MIN) syncUser(s, c.userId);
      }
      if (sent || s.calendarConnections.length) await save();
      return { sent };
    },

    async myAlertEmails() {
      const user = await viewer();
      const s = await load();
      return s.staffEmails.filter((e) => e.userId === user.id && e.to).sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 50);
    },
  };

  return { api, syncUser, runAlerts };
};
