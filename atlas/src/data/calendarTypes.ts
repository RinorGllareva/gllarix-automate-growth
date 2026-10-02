/** Calendar, Google Calendar connection and staff email alerts. */
import type { Hue } from "@/config/colors";

export type CalendarEventKind = "meeting" | "callback" | "task" | "google";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  /** Subtitle: "Video · Omar Mercer", "Callback", "Task due". */
  sub: string;
  start: string;
  end: string;
  allDay: boolean;
  hue: Hue;
  href: string | null;
  ownerId: string | null;
  ownerName: string | null;
  /** Meeting status or task priority, for the legend. */
  status: string | null;
  /** On the person's Google Calendar too. */
  synced: boolean;
}

export interface CalendarConnection {
  userId: string;
  provider: "google";
  /** Google account the calendar belongs to. */
  email: string;
  calendarName: string;
  status: "connected" | "error";
  connectedAt: string;
  lastSyncAt: string | null;
  /** Atlas events on the Google calendar right now. */
  pushed: number;
  /** Google events read back as busy time. */
  busy: number;
  /** Demo mode: a test connection (no real Google account). */
  test: boolean;
}

export type AlertType = "meeting_booked" | "meeting_soon" | "callback_due" | "task_urgent" | "task_overdue";

export const ALERT_TYPES: { type: AlertType; label: string; detail: string }[] = [
  { type: "meeting_booked", label: "Meeting booked for you", detail: "When someone books a meeting you own" },
  { type: "meeting_soon", label: "Meeting in 1 hour", detail: "A reminder before each of your meetings" },
  { type: "callback_due", label: "Callback due", detail: "15 minutes before a callback you scheduled" },
  { type: "task_urgent", label: "Urgent task assigned", detail: "When an urgent task is assigned to you" },
  { type: "task_overdue", label: "Task overdue", detail: "Once a day for urgent or high tasks past their due date" },
];

export interface NotificationPrefs {
  userId: string;
  email: Record<AlertType, boolean>;
  /** The connect-your-calendar prompt was dismissed. */
  calendarPromptDismissedAt: string | null;
}

/** An alert email sent to a team member (staff, not prospects). */
export interface StaffEmail {
  id: string;
  userId: string;
  to: string;
  type: AlertType;
  subject: string;
  body: string;
  href: string | null;
  key: string;
  sentAt: string;
}

export interface CalendarApi {
  /** Events between from and to (ISO). Admins can look at someone else's calendar. */
  calendarEvents(q: { from: string; to: string; userId?: string }): Promise<CalendarEvent[]>;
  calendarConnection(): Promise<CalendarConnection | null>;
  /** Connect the signed-in person's Google Calendar (demo: a test connection; Supabase: Google OAuth in an Edge Function). */
  connectGoogleCalendar(input: { email: string }): Promise<CalendarConnection>;
  disconnectGoogleCalendar(): Promise<void>;
  /** Push Atlas meetings and callbacks to Google, read Google busy time back. Runs on its own every few minutes. */
  syncCalendar(): Promise<{ pushed: number; removed: number; busy: number } | null>;
  notificationPrefs(): Promise<NotificationPrefs>;
  setNotificationPrefs(patch: Partial<Pick<NotificationPrefs, "email">> & { dismissCalendarPrompt?: boolean }): Promise<void>;
  /** Email alerts for meetings, callbacks and urgent tasks (once each). A pg_cron job in Supabase mode. */
  runAlertJobs(): Promise<{ sent: number }>;
  /** Alert emails sent to the signed-in person (demo mailbox). */
  myAlertEmails(): Promise<StaffEmail[]>;
}
