import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@/auth/AuthContext";
import { data, ROLE_LABEL, type QueueView } from "@/data";
import { QUEUE_UPDATED } from "@/lib/events";
import { localHHMM, zoneAbbr } from "@/services/time";
import { APPS, appEntriesFor, appForPath, appsForRole, canAccess, homePathFor, NAV_ITEMS, type AppDef } from "@/lib/nav";
import { AtlasMark, Icon, ICONS, ThemeSwitch } from "@/components/ui/primitives";
import { useTheme } from "@/lib/theme";
import { CalendarSettingsModal } from "@/components/CalendarSettings";
import { setPageJobsVisible, usePageJobsVisible } from "./PageJob";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** "ET 07:00–09:00 window open until 09:00" or "Next: CT 07:00–09:00 opens 08:00 VET". */
const windowText = (view: QueueView | null, tz: string) => {
  const next = view?.rows.find((r) => r.status === "open" && r.channel === "call" && r.windowStartAt && r.windowEndAt);
  if (!view) return "Loading queue…";
  if (!next) return view.done ? "All calls done for today" : "No calls due today";
  const start = new Date(next.windowStartAt!).getTime();
  const end = new Date(next.windowEndAt!).getTime();
  if (Date.now() >= start) return `${next.windowName} open until ${localHHMM(end, tz)} ${zoneAbbr(tz)}`;
  return `Next: ${next.windowName} opens ${localHHMM(start, tz)} ${zoneAbbr(tz)}`;
};

const QueueCard = ({ capacity, tz }: { capacity: number; tz: string }) => {
  const [view, setView] = useState<QueueView | null>(null);
  useEffect(() => {
    const refresh = () => data.getQueue().then(setView).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(QUEUE_UPDATED, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(QUEUE_UPDATED, refresh);
    };
  }, []);
  const done = view?.done ?? 0;
  return (
    <div className="flex flex-col gap-2.5 border border-line rounded-lg bg-surface px-3.5 pb-4 pt-3.5">
      <div className="flex justify-between text-[12px] font-medium text-label">
        <span>Queue</span>
        <span className="num tracking-normal">
          {done} / {capacity}
        </span>
      </div>
      <div
        className="h-[3px] bg-line"
        role="progressbar"
        aria-label="Queue progress"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={done}
      >
        <div className="h-[3px] bg-cyan" style={{ width: `${Math.min(100, (done / capacity) * 100)}%` }} />
      </div>
      <span className="text-[12px] text-text-2">{windowText(view, tz)}</span>
    </div>
  );
};

const COLLAPSE_KEY = "atlas-sidebar-collapsed";
const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const UserMenu = ({ compact = false }: { compact?: boolean }) => {
  const user = useUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const jobsOn = usePageJobsVisible();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        aria-label={compact ? `${user.name} · account menu` : undefined}
        title={compact ? user.name : undefined}
        className={`flex w-full items-center gap-3 py-1 text-left hover:bg-surface-2 ${compact ? "justify-center px-0" : "px-1"}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-button rounded-lg bg-surface text-[12px] tracking-[0.08em]">
          {initials(user.name)}
        </span>
        <span className={`min-w-0 flex-col gap-0.5 ${compact ? "hidden" : "flex"}`}>
          <span className="truncate text-[13px]">{user.name}</span>
          <span className="text-[11px] text-label">{ROLE_LABEL[user.role]}</span>
        </span>
      </button>
      {open ? (
        <div role="menu" className={`absolute bottom-12 left-0 z-30 flex flex-col ${compact ? "w-60" : "right-0"} border border-line-strong rounded-lg bg-surface py-1 shadow-card`}>
          <div className="border-b border-line-soft px-3.5 py-2.5">
            <div className="truncate text-[13px]">{user.email}</div>
            <div className="mt-1 text-[11px] text-text-3">Timezone · {user.timezone}</div>
          </div>
          <div className="flex flex-col gap-1.5 border-b border-line-soft px-3.5 py-2.5">
            <span className="text-[12px] font-medium text-label">Theme</span>
            <ThemeSwitch value={theme.pref} onChange={theme.setPref} />
          </div>
          {user.role !== "viewer" ? (
            <button
              type="button"
              role="menuitem"
              className="h-10 px-3.5 text-left text-[13px] text-text-2 hover:bg-surface-2 hover:text-text"
              onClick={() => {
                setOpen(false);
                setSettingsOpen(true);
              }}
            >
              Calendar and alerts
            </button>
          ) : null}
          <button type="button" role="menuitem" className="h-10 px-3.5 text-left text-[13px] text-text-2 hover:bg-surface-2 hover:text-text" onClick={() => setPageJobsVisible(!jobsOn)}>
            {jobsOn ? "Hide page tips" : "Show what each page is for"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="h-10 px-3.5 text-left text-[13px] text-text-2 hover:bg-surface-2 hover:text-text"
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
      <CalendarSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

/** Rounded square with the app's icon in its accent color. */
const AppTile = ({ app, size = 28 }: { app: AppDef; size?: number }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center rounded-lg"
    style={{ width: size, height: size, color: `var(--${app.hue})`, background: `color-mix(in srgb, var(--${app.hue}) 16%, transparent)`, boxShadow: `inset 0 1px 0 color-mix(in srgb, var(--${app.hue}) 25%, transparent)` }}
    aria-hidden="true"
  >
    <Icon d={app.icon} size={Math.round(size * 0.58)} />
  </span>
);

/** Switch between Sell, Work, Money, People, Growth and AI. Opens on the first page you can use in that app. */
const AppSwitcher = ({ current, apps, compact }: { current: AppDef; apps: AppDef[]; compact: boolean }) => {
  const user = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`App: ${current.label}. Switch app`}
        title={compact ? `${current.label} · switch app` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 rounded-lg border border-line py-1.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2 ${compact ? "justify-center px-1" : "px-2"}`}
        style={{ background: "var(--card-gradient)", boxShadow: "var(--card-shadow)" }}
      >
        <AppTile app={current} />
        {compact ? null : (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14px] font-semibold leading-tight">{current.label}</span>
              <span className="truncate text-[11px] text-text-3">{current.blurb}</span>
            </span>
            <Icon d="M8 9l4-4 4 4M8 15l4 4 4-4" size={14} className="text-text-3" />
          </>
        )}
      </button>
      {open ? (
        <div role="menu" aria-label="Apps" className="absolute left-0 top-[calc(100%+6px)] z-40 flex w-72 flex-col gap-0.5 rounded-2xl border border-line-strong bg-surface p-1.5 shadow-pop">
          {apps.map((a) => {
            const first = appEntriesFor(a, user.role).find((e) => !e.soon && e.to);
            const on = a.id === current.id;
            return (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                aria-current={on || undefined}
                onClick={() => {
                  setOpen(false);
                  if (first?.to) navigate(first.to);
                }}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 text-left ${on ? "bg-surface-2" : "hover:bg-surface-2/70"}`}
              >
                <AppTile app={a} size={32} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14px] font-medium">{a.label}</span>
                  <span className="truncate text-[12px] text-text-3">{a.blurb}</span>
                </span>
                {on ? <Icon d="M5 12l5 5L20 7" size={14} className="text-text-2" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const Sidebar = () => {
  const user = useUser();
  const { pathname } = useLocation();
  const apps = appsForRole(user.role);
  // Pages outside every app (Admin, a lead's sub-page…) keep the last app you were in.
  const lastApp = useRef<AppDef>(apps[0] ?? APPS[0]);
  const fromPath = appForPath(pathname);
  if (fromPath && apps.some((a) => a.id === fromPath.id)) lastApp.current = fromPath;
  const app = lastApp.current;
  const entries = appEntriesFor(app, user.role);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* private window: the choice just isn't remembered */
      }
      return !c;
    });

  // The app's accent drives the active item, focus rings and highlights everywhere.
  useEffect(() => {
    document.documentElement.style.setProperty("--app", `var(--${app.hue})`);
  }, [app.hue]);

  // Longest matching entry is the active one (/tasks/planner beats /tasks).
  const activeTo = entries
    .filter((e) => e.to && (pathname === e.to || pathname.startsWith(`${e.to}/`)))
    .sort((a, b) => b.to!.length - a.to!.length)[0]?.to;

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-chrome pb-4 pt-5 transition-[width] duration-150 ${collapsed ? "w-[68px] px-2.5" : "w-[248px] px-3"}`}
    >
      <div className={`flex items-center pb-4 ${collapsed ? "flex-col gap-3" : "justify-between gap-2 px-1"}`}>
        <Link to={homePathFor(user.role)} className="flex items-center gap-2.5 text-text" aria-label="Atlas home">
          <AtlasMark />
          {collapsed ? null : (
            <span className="flex flex-col">
              <span className="text-[14px] font-semibold tracking-[0.18em]">ATLAS</span>
              <span className="text-[10px] text-text-3">by Gllarix</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text"
        >
          <Icon d={collapsed ? ICONS.chevronRight : ICONS.chevronLeft} size={16} />
        </button>
      </div>

      {apps.length > 1 ? (
        <div className="pb-4">
          <AppSwitcher current={app} apps={apps} compact={collapsed} />
        </div>
      ) : null}

      <nav aria-label={`${app.label} pages`} className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {entries.map((e) => {
          if (e.soon)
            return (
              <span
                key={e.label}
                title={`${e.label} · coming soon`}
                aria-disabled="true"
                className={`flex h-8 shrink-0 cursor-default items-center gap-2.5 rounded-lg text-[13px] text-text-3/70 ${collapsed ? "justify-center px-0" : "px-2.5"}`}
              >
                <Icon d={e.icon} size={16} className="opacity-60" />
                {collapsed ? null : (
                  <>
                    <span className="truncate">{e.label}</span>
                    <span className="ml-auto rounded-md border border-line px-1.5 text-[10px] font-medium text-text-3">Soon</span>
                  </>
                )}
              </span>
            );
          const active = e.to === activeTo;
          return (
            <Link
              key={e.label}
              to={e.to!}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? e.label : undefined}
              title={collapsed ? `${e.label}${e.key ? ` · G ${e.key}` : ""}` : undefined}
              className={`group relative flex h-8 shrink-0 items-center gap-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${collapsed ? "justify-center px-0" : "px-2.5"} ${
                active ? "bg-surface-2 text-text shadow-card" : "text-text-2 hover:bg-surface-2/60 hover:text-text"
              }`}
            >
              {active ? <span className="absolute -left-3 top-1.5 h-5 w-[3px] rounded-r-full bg-app" aria-hidden="true" /> : null}
              <Icon d={e.icon} size={16} className={active ? "text-app" : "text-text-3 group-hover:text-text-2"} />
              {collapsed ? null : (
                <>
                  <span className="truncate">{e.label}</span>
                  {e.key ? (
                    <span className="ml-auto hidden items-center gap-0.5 group-hover:flex">
                      <kbd className="kbd">G</kbd>
                      <kbd className="kbd">{e.key}</kbd>
                    </span>
                  ) : null}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-4">
        {user.dailyCapacity && !collapsed && app.id === "sell" ? <QueueCard capacity={user.dailyCapacity} tz={user.timezone} /> : null}
        {canAccess(user.role, "admin") ? (
          <Link
            to="/admin"
            aria-label={collapsed ? "Settings" : undefined}
            title={collapsed ? "Settings · G A" : undefined}
            className={`flex h-8 items-center gap-2.5 rounded-lg text-[13.5px] font-medium ${collapsed ? "justify-center" : "px-2.5"} ${pathname.startsWith("/admin") ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface-2/60 hover:text-text"}`}
          >
            <Icon d={NAV_ITEMS.find((n) => n.id === "admin")!.icon} size={16} className="text-text-3" />
            {collapsed ? null : "Settings"}
          </Link>
        ) : null}
        <UserMenu compact={collapsed} />
      </div>
    </aside>
  );
};

export default Sidebar;
