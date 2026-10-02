import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Modal, useToast } from "@/components/ui/overlay";
import { Toggle } from "@/components/ui/primitives";
import { hueTint, hueVar } from "@/config/colors";
import { ALERT_TYPES, data, type CalendarConnection, type NotificationPrefs, type StaffEmail } from "@/data";

const when = (iso: string | null, tz: string) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso)) : "never");

const GoogleMark = () => (
  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-[13px] font-semibold" style={{ background: hueTint("blue", 22), color: hueVar("blue") }} aria-hidden="true">
    G
  </span>
);

/** Connect / status card for the signed-in person's Google Calendar. */
export const GoogleCalendarCard = ({ onChange }: { onChange?: () => void }) => {
  const user = useUser();
  const toast = useToast();
  const [conn, setConn] = useState<CalendarConnection | null | undefined>(undefined);
  const [consent, setConsent] = useState(false);
  const [email, setEmail] = useState(user.email);
  const load = useCallback(() => data.calendarConnection().then(setConn), []);
  useEffect(() => {
    load();
  }, [load]);

  if (conn === undefined) return null;
  return (
    <section aria-label="Google Calendar" className="flex flex-wrap items-center gap-3 border p-3" style={{ borderColor: conn ? `color-mix(in srgb, var(--mint) 45%, transparent)` : "var(--line)", background: conn ? hueTint("mint", 8) : "var(--surface)" }}>
      <GoogleMark />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-medium">{conn ? `Google Calendar connected · ${conn.email}` : "Connect your Google Calendar"}</span>
        <span className="text-[12px] text-text-2">
          {conn
            ? `${conn.pushed} Atlas events on your calendar · ${conn.busy} of your own events shown as busy · synced ${when(conn.lastSyncAt, user.timezone)}${conn.test ? " · test connection" : ""}`
            : "Your meetings and callbacks go on your own calendar and stay in sync; your busy time shows here."}
        </span>
      </div>
      {conn ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-outline h-8 text-[11px]"
            onClick={async () => {
              const r = await data.syncCalendar();
              toast(r ? `Synced · ${r.pushed} updated, ${r.removed} removed` : "Not connected", "good");
              load();
              onChange?.();
            }}
          >
            Sync now
          </button>
          <button
            type="button"
            className="btn-ghost h-8 text-[11px] text-coral"
            onClick={async () => {
              await data.disconnectGoogleCalendar();
              toast("Google Calendar disconnected · Atlas events removed from it", "good");
              load();
              onChange?.();
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button type="button" className="btn-primary h-9 text-[11px]" onClick={() => setConsent(true)}>
          Connect Google Calendar
        </button>
      )}

      <Modal open={consent} onClose={() => setConsent(false)} title="Google Calendar · test mode">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await data.connectGoogleCalendar({ email });
              toast("Google Calendar connected", "good");
              setConsent(false);
              load();
              onChange?.();
            } catch (err) {
              toast((err as Error).message, "error");
            }
          }}
        >
          <p className="m-0 text-[13px] text-text-2">
            In Atlas with Supabase this opens Google's own sign-in, where you pick your account and allow access. Atlas never sees your Google password. In demo mode it creates a test connection.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Google account</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <div className="flex flex-col gap-1.5 border border-line p-3 text-[12px] text-text-2">
            <span className="label-caps">Atlas will be able to</span>
            <span>✓ Create, move and remove the events it adds (your meetings and callbacks)</span>
            <span>✓ See when you're busy, so booking avoids those times</span>
            <span>✗ It doesn't read or change your other events' details</span>
          </div>
          <button type="submit" className="btn-primary justify-between">
            <span>Allow and connect</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </Modal>
    </section>
  );
};

/** User menu → Calendar and alerts: Google Calendar, which alerts arrive by email, and the last ones sent. */
export const CalendarSettingsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const user = useUser();
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [emails, setEmails] = useState<StaffEmail[]>([]);
  const load = useCallback(() => {
    data.notificationPrefs().then(setPrefs);
    data.myAlertEmails().then(setEmails);
  }, []);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <Modal open={open} onClose={onClose} title="Calendar and alerts" width={620}>
      <div className="flex flex-col gap-5">
        <GoogleCalendarCard />
        <div className="flex flex-col gap-2">
          <span className="label-caps">Email me at {user.email} when</span>
          {prefs
            ? ALERT_TYPES.map((a) => (
                <div key={a.type} className="flex items-center justify-between gap-3 border-b border-line-soft pb-2 last:border-b-0">
                  <div className="flex flex-col">
                    <span className="text-[13px]">{a.label}</span>
                    <span className="text-[11px] text-text-3">{a.detail}</span>
                  </div>
                  <Toggle
                    checked={prefs.email[a.type]}
                    label={prefs.email[a.type] ? "On" : "Off"}
                    onChange={async (v) => {
                      await data.setNotificationPrefs({ email: { ...prefs.email, [a.type]: v } });
                      toast(`${a.label}: email ${v ? "on" : "off"}`, "good");
                      load();
                    }}
                  />
                </div>
              ))
            : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label-caps">Last alerts sent to you · {emails.length}</span>
          <div className="flex max-h-56 flex-col overflow-y-auto border border-line">
            {emails.length ? (
              emails.map((e) => (
                <div key={e.id} className="flex flex-col gap-0.5 border-b border-line-soft px-3 py-2 text-[12px] last:border-b-0">
                  <div className="flex justify-between gap-3">
                    <span className="truncate font-medium text-text">{e.subject}</span>
                    <span className="shrink-0 text-text-3">{when(e.sentAt, user.timezone)}</span>
                  </div>
                  <span className="text-text-2">{e.body}</span>
                  {e.href ? (
                    <Link to={e.href} onClick={onClose} className="text-cyan">
                      Open in Atlas →
                    </Link>
                  ) : null}
                </div>
              ))
            ) : (
              <span className="px-3 py-3 text-[12px] text-text-3">No alerts yet.</span>
            )}
          </div>
          <span className="text-[11px] text-text-3">Demo mode keeps these in Atlas; with Supabase they're sent from the team inbox.</span>
        </div>
      </div>
    </Modal>
  );
};

/** Shown once after sign-in until the person connects or says later. */
export const CalendarPrompt = () => {
  const user = useUser();
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (user.role === "viewer") return;
    Promise.all([data.calendarConnection(), data.notificationPrefs()])
      .then(([c, p]) => setShow(!c && !p.calendarPromptDismissedAt))
      .catch(() => undefined);
  }, [user.id, user.role]);
  // Meetings has its own card next to the calendar.
  if (!show || pathname.startsWith("/meetings")) return null;
  return (
    <div className="mb-5 flex flex-col gap-2">
      <GoogleCalendarCard onChange={() => setShow(false)} />
      <button
        type="button"
        className="btn-ghost self-end text-[11px]"
        onClick={async () => {
          await data.setNotificationPrefs({ dismissCalendarPrompt: true });
          setShow(false);
        }}
      >
        Later (Calendar and alerts in your menu)
      </button>
    </div>
  );
};
