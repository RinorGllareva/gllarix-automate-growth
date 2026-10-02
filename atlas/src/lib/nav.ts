import type { Role } from "@/data/types";

export type PageId =
  | "today"
  | "call"
  | "leads"
  | "pipeline"
  | "meetings"
  | "deals"
  | "clients"
  | "reports"
  | "tasks"
  | "team"
  | "time"
  | "advisor"
  | "admin";

export interface NavItem {
  id: PageId;
  label: string;
  path: string;
  /** Second key of the "G then letter" shortcut. */
  key: string;
  /** Stroke path, 24×24, from the Sidebar mockup. */
  icon: string;
  milestone: string;
  /** Pages that must work on a 390 px phone; the rest show a "larger screen" notice below 1024 px. */
  mobile?: boolean;
  /** Sidebar section. */
  group: NavGroup;
}

/** Sidebar sections, in order: what the page is for. */
export const NAV_GROUPS = ["Sell", "Deliver", "Insight", "Manage"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export const NAV_ITEMS: NavItem[] = [
  { id: "today", group: "Sell", label: "Today", path: "/today", key: "T", milestone: "M3", mobile: true, icon: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18" },
  { id: "call", group: "Sell", label: "Call workspace", path: "/call", key: "C", milestone: "M3", icon: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" },
  { id: "leads", group: "Sell", label: "Leads", path: "/leads", key: "L", milestone: "M1", icon: "M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9" },
  { id: "pipeline", group: "Sell", label: "Pipeline", path: "/pipeline", key: "P", milestone: "M4", icon: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z" },
  { id: "meetings", group: "Sell", label: "Meetings", path: "/meetings", key: "M", milestone: "M4", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { id: "deals", group: "Sell", label: "Deals and quotes", path: "/deals", key: "D", milestone: "M6", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
  { id: "clients", group: "Deliver", label: "Clients", path: "/clients", key: "K", milestone: "M7", icon: "M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 9h1M15 9h1M8 13h1M15 13h1" },
  { id: "reports", group: "Insight", label: "Reports", path: "/reports", key: "R", milestone: "M4", icon: "M4 20V10M10 20V4M16 20v-7M3 20h18" },
  { id: "tasks", group: "Deliver", label: "Tasks and planner", path: "/tasks", key: "W", milestone: "M9", icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { id: "team", group: "Insight", label: "Team performance", path: "/team", key: "E", milestone: "M12", mobile: true, icon: "M4 20h16M6 16l4-5 3 3 5-7M18 7h-3M18 7v3" },
  { id: "time", group: "Deliver", label: "Time tracking", path: "/time", key: "H", milestone: "M13", icon: "M12 8v4l2.5 2.5M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M9 1.5h6" },
  { id: "advisor", group: "Insight", label: "AI co-founder", path: "/advisor", key: "I", milestone: "M14", mobile: true, icon: "M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" },
  { id: "admin", group: "Manage", label: "Admin", path: "/admin", key: "A", milestone: "M0–M2", icon: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4" },
];

/** Sidebar visibility by role (00_SHARED_LAYOUT.md). Closer follows BDR (A5). */
const ACCESS: Record<Role, PageId[] | "all"> = {
  admin: "all",
  bdr: ["today", "call", "leads", "pipeline", "meetings", "deals", "tasks", "team", "time", "advisor"],
  closer: ["today", "call", "leads", "pipeline", "meetings", "deals", "tasks", "team", "time", "advisor"],
  viewer: ["reports", "team", "pipeline"],
  implementer: ["clients", "tasks", "time"],
};

export const canAccess = (role: Role, page: PageId) => {
  const allowed = ACCESS[role];
  return allowed === "all" || allowed.includes(page);
};

export const navForRole = (role: Role) => NAV_ITEMS.filter((item) => canAccess(role, item.id));

/** Where a user lands after sign-in: Today if they have it, else their first page. */
export const homePathFor = (role: Role) => navForRole(role)[0]?.path ?? "/login";

export const navItemForPath = (pathname: string) =>
  NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
