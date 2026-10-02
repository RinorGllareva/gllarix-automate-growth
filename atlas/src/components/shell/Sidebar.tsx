import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@/auth/AuthContext";
import { data, ROLE_LABEL, type QueueView } from "@/data";
import { QUEUE_UPDATED } from "@/lib/events";
import { localHHMM, zoneAbbr } from "@/services/time";
import { NAV_GROUPS, navForRole } from "@/lib/nav";
import { AtlasMark, Icon, ICONS, ThemeSwitch } from "@/components/ui/primitives";
import { useTheme } from "@/lib/theme";
import { CalendarSettingsModal } from "@/components/CalendarSettings";

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
    <div className="flex flex-col gap-2.5 border border-line bg-surface px-3.5 pb-4 pt-3.5">
      <div className="flex justify-between text-[11px] uppercase tracking-label text-label">
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-button bg-surface text-[12px] tracking-[0.08em]">
          {initials(user.name)}
        </span>
        <span className={`min-w-0 flex-col gap-0.5 ${compact ? "hidden" : "flex"}`}>
          <span className="truncate text-[13px]">{user.name}</span>
          <span className="text-[11px] text-label">{ROLE_LABEL[user.role]}</span>
        </span>
      </button>
      {open ? (
        <div role="menu" className={`absolute bottom-12 left-0 z-30 flex flex-col ${compact ? "w-60" : "right-0"} border border-line-strong bg-surface py-1 shadow-card`}>
          <div className="border-b border-line-soft px-3.5 py-2.5">
            <div className="truncate text-[13px]">{user.email}</div>
            <div className="mt-1 text-[11px] text-text-3">Timezone · {user.timezone}</div>
          </div>
          <div className="flex flex-col gap-1.5 border-b border-line-soft px-3.5 py-2.5">
            <span className="text-[11px] uppercase tracking-[0.16em] text-label">Theme</span>
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

const Sidebar = () => {
  const user = useUser();
  const items = navForRole(user.role);
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

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-chrome pb-5 pt-7 transition-[width] duration-150 ${collapsed ? "w-[68px] px-2.5" : "w-60 px-4"}`}
    >
      <div className={`flex items-center pb-6 ${collapsed ? "flex-col gap-4" : "justify-between gap-2 pr-1"}`}>
        <Link to={items[0]?.path ?? "/"} className={`flex items-center gap-3 text-text ${collapsed ? "" : "px-3"}`} aria-label="Atlas home">
          <AtlasMark />
          {collapsed ? null : (
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-medium tracking-[0.28em]">ATLAS</span>
              <span className="text-[10px] tracking-label text-label">BY GLLARIX</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text"
        >
          <Icon d={collapsed ? ICONS.chevronRight : ICONS.chevronLeft} size={16} />
        </button>
      </div>

      <nav aria-label="Main" className="flex min-h-0 flex-col overflow-y-auto">
        {NAV_GROUPS.filter((g) => items.some((i) => i.group === g)).map((g, gi) => (
          <div key={g} className={`flex flex-col gap-0.5 ${gi ? "mt-3 border-t border-line pt-3" : ""}`}>
            {collapsed ? null : <div className="label-caps px-3 pb-1.5">{g}</div>}
        {items.filter((i) => i.group === g).map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? `${item.label} · G ${item.key}` : undefined}
            className={({ isActive }) =>
              `group flex h-9 shrink-0 items-center gap-3 text-[14px] transition-colors ${collapsed ? "justify-center px-0" : "px-3"} ${
                isActive ? "bg-ice text-ice-ink" : "text-text-2 hover:bg-surface-2 hover:text-text"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon d={item.icon} className={isActive ? "text-ice-ink" : "text-text-3"} />
                {collapsed ? null : (
                  <>
                    <span>{item.label}</span>
                    <span className={`ml-auto font-mono text-[11px] ${isActive ? "text-ice-ink" : "text-text-3"}`}>
                      G {item.key}
                    </span>
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4 pt-4">
        {user.dailyCapacity && !collapsed ? <QueueCard capacity={user.dailyCapacity} tz={user.timezone} /> : null}
        <UserMenu compact={collapsed} />
      </div>
    </aside>
  );
};

export default Sidebar;
