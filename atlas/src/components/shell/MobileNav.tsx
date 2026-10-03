import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUser } from "@/auth/AuthContext";
import { Icon, ICONS } from "@/components/ui/primitives";
import { navForRole, navItemForPath, type PageId } from "@/lib/nav";

/** Phone order: what each person reaches for first away from the desk. */
const PHONE_ORDER: PageId[] = ["today", "meetings", "tasks", "inbound", "support", "docs", "team", "advisor"];
const TABS = 4;

/** Phones: a slim top bar (page, search, notifications) and a bottom tab bar with the phone-ready pages. */
export const MobileTopBar = ({ unread, onSearch, onNotifications }: { unread: number; onSearch: () => void; onNotifications: () => void }) => {
  const { pathname } = useLocation();
  const item = navItemForPath(pathname);
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{item?.label ?? "Atlas"}</span>
      <button type="button" aria-label="Search" onClick={onSearch} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text">
        <Icon d={ICONS.search} size={18} />
      </button>
      <button type="button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={onNotifications} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text">
        <Icon d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" size={18} />
        {unread ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral" aria-hidden="true" /> : null}
      </button>
    </header>
  );
};

export const MobileTabBar = () => {
  const user = useUser();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const pages = navForRole(user.role)
    .filter((n) => n.mobile)
    .sort((a, b) => PHONE_ORDER.indexOf(a.id) - PHONE_ORDER.indexOf(b.id));
  if (!pages.length) return null;
  const tabs = pages.length > TABS + 1 ? pages.slice(0, TABS) : pages;
  const rest = pages.length > TABS + 1 ? pages.slice(TABS) : [];
  const current = navItemForPath(pathname)?.id;
  const tab = (active: boolean) => `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "text-text" : "text-text-3"}`;
  return (
    <>
      {more ? (
        <div className="fixed inset-0 z-40 bg-bg-deep/70 lg:hidden" onClick={() => setMore(false)}>
          <nav aria-label="More pages" className="absolute inset-x-3 bottom-[76px] flex flex-col rounded-xl border border-line-strong bg-surface p-1.5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            {rest.map((n) => (
              <Link key={n.id} to={n.path} onClick={() => setMore(false)} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-[14px] ${current === n.id ? "bg-surface-2 text-text" : "text-text-2"}`}>
                <Icon d={n.icon} size={18} />
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
      <nav aria-label="Phone navigation" className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map((n) => (
          <Link key={n.id} to={n.path} aria-current={current === n.id ? "page" : undefined} className={tab(current === n.id)}>
            <Icon d={n.icon} size={20} />
            <span className="max-w-[72px] truncate">{n.id === "advisor" ? "AI" : n.label.split(" ")[0]}</span>
          </Link>
        ))}
        {rest.length ? (
          <button type="button" aria-expanded={more} onClick={() => setMore((x) => !x)} className={tab(rest.some((n) => n.id === current))}>
            <Icon d="M5 12h.01M12 12h.01M19 12h.01" size={20} />
            More
          </button>
        ) : null}
      </nav>
    </>
  );
};
