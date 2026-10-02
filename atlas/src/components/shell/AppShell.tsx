import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { data, type Notification, type User } from "@/data";
import { isTypingTarget } from "@/lib/hotkeys";
import { canAccess, navForRole, navItemForPath, type PageId } from "@/lib/nav";
import CommandPalette from "@/components/overlays/CommandPalette";
import NotificationsPanel from "@/components/overlays/NotificationsPanel";
import { CalendarPrompt } from "@/components/CalendarSettings";
import { PageChromeContext } from "./PageChrome";
import Sidebar from "./Sidebar";
import TimerBar from "./TimerBar";
import TopBar, { type PageChrome } from "./TopBar";

const NOTIFICATION_POLL_MS = 30_000;
const G_CHORD_MS = 1200;
const SENDER_INTERVAL_MS = 60_000;

/** "TUE 1 DEC" in the user's timezone. */
const todayLabel = (user: User) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: user.timezone })
    .format(new Date())
    .replace(",", "")
    .toUpperCase();

const chromeFor = (page: PageId | undefined, user: User): PageChrome => {
  const can = (p: PageId) => canAccess(user.role, p);
  switch (page) {
    case "today":
      return { context: todayLabel(user), action: can("call") ? { label: "Start calling", to: "/call" } : undefined };
    case "leads":
      return { context: "Leads", action: user.role === "admin" ? { label: "Import CSV", to: "/leads/import" } : undefined };
    case "deals":
      return { context: "Deals and quotes", action: { label: "Create deal", to: "/deals/new" } };
    case "tasks":
      return { context: "Tasks", action: { label: "Plan with AI", to: "/planner" } };
    default:
      return { context: page ? navForRole(user.role).find((n) => n.id === page)?.label : undefined };
  }
};

const SmallScreenNotice = () => (
  <div className="flex min-h-screen flex-col items-start justify-center gap-4 bg-bg px-6 lg:hidden">
    <span className="label-caps">Atlas</span>
    <p className="m-0 max-w-sm text-[15px] leading-relaxed text-text-2">
      This page needs a larger screen. Today, your scorecard and the AI co-founder work on a phone.
    </p>
  </div>
);

const AppShell = () => {
  const user = useUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navItem = navItemForPath(pathname);

  const [palette, setPalette] = useState<{ query: string } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<Notification[]>([]);
  const [chromeOverride, setChromeOverride] = useState<PageChrome | null>(null);

  const refreshNotes = useCallback(() => {
    data.listNotifications(user.id).then(setNotes);
  }, [user.id]);

  useEffect(() => {
    refreshNotes();
    const timer = window.setInterval(refreshNotes, NOTIFICATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshNotes]);

  // The email sender is a background job (pg_cron + Edge Function in Supabase mode); in demo mode it runs every minute while Atlas is open.
  useEffect(() => {
    if (data.kind !== "demo") return;
    // Plus the nightly job (rescore + retention), which runs once a day after 02:00 UTC.
    const tick = () => {
      data.runSender().catch(() => undefined);
      data.runNightlyJobs().catch(() => undefined);
      data.runAlertJobs().catch(() => undefined); // email alerts + Google Calendar sync
    };
    tick();
    const timer = window.setInterval(tick, SENDER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // ⌘K / Ctrl K opens the palette; "G then letter" jumps between pages. Never while typing.
  const gPressedAt = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => (p ? null : { query: "" }));
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || palette || notesOpen) return;
      const key = e.key.toUpperCase();
      if (key === "G") {
        gPressedAt.current = Date.now();
        return;
      }
      if (Date.now() - gPressedAt.current < G_CHORD_MS) {
        gPressedAt.current = 0;
        const target = navForRole(user.role).find((n) => n.key === key);
        if (target) {
          e.preventDefault();
          navigate(target.path);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, notesOpen, palette, user.role]);

  const chrome = { ...chromeFor(navItem?.id, user), ...(chromeOverride ?? {}) };
  const mobileOk = navItem?.mobile ?? false;

  return (
    <>
      {mobileOk ? null : <SmallScreenNotice />}
      <div className={`${mobileOk ? "flex" : "hidden lg:flex"} min-h-screen bg-bg`}>
        <div className={mobileOk ? "hidden lg:block" : "contents"}>
          <Sidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={mobileOk ? "hidden lg:block" : "contents"}>
            <TopBar
              {...chrome}
              unread={notes.filter((n) => !n.readAt).length}
              onOpenPalette={(query = "") => setPalette({ query })}
              onOpenNotifications={() => setNotesOpen(true)}
            />
          </div>
          {user.role !== "viewer" ? <TimerBar /> : null}
          <main id="content" className="flex-1 px-5 py-6 lg:px-10 lg:py-8">
            <PageChromeContext.Provider value={setChromeOverride}>
              <CalendarPrompt />
              <Outlet />
            </PageChromeContext.Provider>
          </main>
        </div>
      </div>

      {palette ? <CommandPalette initialQuery={palette.query} onClose={() => setPalette(null)} /> : null}
      <NotificationsPanel
        open={notesOpen}
        items={notes}
        onClose={() => setNotesOpen(false)}
        onRead={(id) => data.markNotificationRead(id).then(refreshNotes)}
        onReadAll={() => data.markAllNotificationsRead(user.id).then(refreshNotes)}
      />
    </>
  );
};

export default AppShell;
