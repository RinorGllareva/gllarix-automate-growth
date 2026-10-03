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
  | "finance"
  | "payments"
  | "plan"
  | "roi"
  | "prices"
  | "commissions"
  | "hiring"
  | "training"
  | "kpis"
  | "marketing"
  | "markets"
  | "inbound"
  | "ops"
  | "support"
  | "docs"
  | "agent"
  | "tracker"
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
  { id: "meetings", group: "Sell", label: "Meetings", path: "/meetings", key: "M", milestone: "M4", mobile: true, icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { id: "deals", group: "Sell", label: "Deals and quotes", path: "/deals", key: "D", milestone: "M6", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
  { id: "clients", group: "Deliver", label: "Clients", path: "/clients", key: "K", milestone: "M7", icon: "M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 9h1M15 9h1M8 13h1M15 13h1" },
  { id: "reports", group: "Insight", label: "Reports", path: "/reports", key: "R", milestone: "M4", icon: "M4 20V10M10 20V4M16 20v-7M3 20h18" },
  { id: "tasks", group: "Deliver", label: "Tasks and planner", path: "/tasks", key: "W", milestone: "M9", mobile: true, icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { id: "team", group: "Insight", label: "Team performance", path: "/team", key: "E", milestone: "M12", mobile: true, icon: "M4 20h16M6 16l4-5 3 3 5-7M18 7h-3M18 7v3" },
  { id: "time", group: "Deliver", label: "Time tracking", path: "/time", key: "H", milestone: "M13", icon: "M12 8v4l2.5 2.5M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M9 1.5h6" },
  { id: "advisor", group: "Insight", label: "AI co-founder", path: "/advisor", key: "I", milestone: "M14", mobile: true, icon: "M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" },
  { id: "finance", group: "Manage", label: "Finance", path: "/finance", key: "F", milestone: "Apps", icon: "M12 3v18M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.5 9.2 10.4 12 11s5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" },
  { id: "payments", group: "Manage", label: "Payments", path: "/payments", key: "Y", milestone: "Apps", icon: "M3 6h18v12H3zM3 10h18M7 15h3" },
  { id: "plan", group: "Manage", label: "Financial plan", path: "/plan", key: "N", milestone: "Apps", icon: "M4 20V10M10 20V4M16 20v-7M3 20h18" },
  { id: "roi", group: "Manage", label: "ROI and investment", path: "/roi", key: "O", milestone: "Apps", icon: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  { id: "prices", group: "Manage", label: "Prices and calculator", path: "/prices", key: "Q", milestone: "Apps", icon: "M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h6" },
  { id: "commissions", group: "Insight", label: "Bonuses and commissions", path: "/commissions", key: "B", milestone: "Apps", icon: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1" },
  { id: "hiring", group: "Insight", label: "Hiring", path: "/hiring", key: "J", milestone: "Apps", icon: "M10 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8M4 21v-2a4 4 0 0 1 4-4h4M17 14v6M14 17h6" },
  { id: "training", group: "Insight", label: "Training", path: "/training", key: "U", milestone: "Apps", icon: "M3 8l9-4 9 4-9 4zM7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5" },
  { id: "kpis", group: "Insight", label: "KPIs per role", path: "/kpis", key: "V", milestone: "Apps", icon: "M12 21a9 9 0 1 0 0-18M12 3v9l6 6" },
  { id: "marketing", group: "Insight", label: "Marketing", path: "/marketing", key: "Z", milestone: "Apps", icon: "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8M12 12h.01" },
  { id: "markets", group: "Insight", label: "Market and competitors", path: "/markets", key: "X", milestone: "Apps", icon: "M4 20V10M10 20V4M16 20v-7M3 20h18" },
  { id: "inbound", group: "Sell", label: "Inbound", path: "/inbound", key: "S", milestone: "Apps", mobile: true, icon: "M4 13l2.5-7h11l2.5 7v6H4zM4 13h5l1 2h4l1-2h5" },
  { id: "ops", group: "Deliver", label: "Operations plan", path: "/ops", key: "0", milestone: "Apps", icon: "M4 5h16v14H4zM8 9h8M8 13h5" },
  { id: "support", group: "Deliver", label: "Support", path: "/support", key: "1", milestone: "Apps", mobile: true, icon: "M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-1v-6h3M4 12v5a2 2 0 0 0 2 2h1v-6H4M15 21h-3" },
  { id: "docs", group: "Deliver", label: "Docs and wiki", path: "/docs", key: "2", milestone: "Apps", mobile: true, icon: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7" },
  { id: "agent", group: "Insight", label: "AI BDR agent", path: "/ai/agent", key: "3", milestone: "Apps", icon: "M12 2v3M8 5h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM9 11h.01M15 11h.01M9 15h6M2 11v3M22 11v3" },
  { id: "tracker", group: "Insight", label: "AI performance tracker", path: "/ai/tracker", key: "4", milestone: "Apps", mobile: true, icon: "M4 19h16M7 16V9M12 16V5M17 16v-4" },
  { id: "admin", group: "Manage", label: "Admin", path: "/admin", key: "A", milestone: "M0–M2", icon: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4" },
];

/** Sidebar visibility by role (00_SHARED_LAYOUT.md). Closer follows BDR (A5). */
const ACCESS: Record<Role, PageId[] | "all"> = {
  admin: "all",
  // Market and competitors has no job for sellers: channel rules are enforced on every call and send anyway.
  bdr: ["today", "call", "leads", "pipeline", "meetings", "deals", "tasks", "team", "time", "advisor", "commissions", "training", "marketing", "inbound", "ops", "docs", "tracker"],
  closer: ["today", "call", "leads", "pipeline", "meetings", "deals", "tasks", "team", "time", "advisor", "commissions", "training", "marketing", "inbound", "ops", "docs", "tracker"],
  // The viewer is the accountant: the books (finance, payments, payouts), the pipeline value and the monthly report.
  viewer: ["reports", "pipeline", "finance", "payments", "commissions", "docs"],
  implementer: ["clients", "support", "tasks", "time", "ops", "docs"],
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

// ---------------------------------------------------------------- Apps
// One platform, several apps (Sell, Work, Money, People, Growth, AI). Each app has its own sidebar and accent; records
// stay shared. An entry can point inside another module (Automations live in Tasks) and is shown only when the
// person can open the page it belongs to. "Soon" entries are the planned parts of each app, shown dimmed.

export type AppId = "sell" | "work" | "money" | "people" | "growth" | "ai";

export interface AppEntry {
  label: string;
  /** Route; omitted for "soon" entries. */
  to?: string;
  /** Page whose access decides visibility. */
  page?: PageId;
  icon: string;
  /** "G then letter" shortcut, when the entry is a top-level page. */
  key?: string;
  soon?: boolean;
}

export interface AppDef {
  id: AppId;
  label: string;
  /** One line in the switcher. */
  blurb: string;
  /** Hue token (src/styles/tokens.css). */
  hue: "cyan" | "lavender" | "mint" | "amber" | "orange" | "blue";
  icon: string;
  entries: AppEntry[];
}

const I = Object.fromEntries(NAV_ITEMS.map((n) => [n.id, n.icon])) as Record<PageId, string>;
const page = (id: PageId, label?: string): AppEntry => {
  const n = NAV_ITEMS.find((x) => x.id === id)!;
  return { label: label ?? n.label, to: n.path, page: id, icon: n.icon, key: n.key };
};

const IC = {
  sell: "M3 17l6-6 4 4 8-8M15 7h6v6",
  work: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  money: "M12 3v18M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.5 9.2 10.4 12 11s5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  people: "M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9",
  growth: "M4 20h16M7 16V10M12 16V6M17 16v-4",
  ai: "M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z",
  inbox: "M4 13l2.5-7h11l2.5 7v6H4zM4 13h5l1 2h4l1-2h5",
  plan: "M4 5h16v14H4zM8 9h8M8 13h5",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  chart: "M4 20V10M10 20V4M16 20v-7M3 20h18",
  flow: "M6 4h4v4H6zM14 16h4v4h-4zM8 8v4a2 2 0 0 0 2 2h6v2",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  target: "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8M12 12h.01",
  hire: "M10 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8M4 21v-2a4 4 0 0 1 4-4h4M17 14v6M14 17h6",
  learn: "M3 8l9-4 9 4-9 4zM7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1",
};

export const APPS: AppDef[] = [
  {
    id: "sell",
    label: "Sell",
    blurb: "Leads, calls, meetings, pipeline and deals",
    hue: "cyan",
    icon: IC.sell,
    entries: [page("today"), page("inbound"), page("call"), page("leads"), page("pipeline"), page("meetings"), page("deals"), page("clients"), page("reports")],
  },
  {
    id: "work",
    label: "Work",
    blurb: "Tasks, projects, AI planner and time",
    hue: "lavender",
    icon: IC.work,
    entries: [
      page("tasks", "Tasks and projects"),
      { label: "AI planner", to: "/tasks/planner", page: "tasks", icon: I.advisor },
      page("support"),
      page("time"),
      page("ops"),
      page("docs"),
    ],
  },
  {
    id: "money",
    label: "Money",
    blurb: "Cash, expenses, prices and the calculator",
    hue: "mint",
    icon: IC.money,
    entries: [page("finance"), page("payments"), page("plan"), page("roi"), page("prices")],
  },
  {
    id: "people",
    label: "People",
    blurb: "Performance, bonuses, hiring and training",
    hue: "amber",
    icon: IC.people,
    entries: [page("team"), page("kpis"), page("commissions"), page("hiring"), page("training")],
  },
  {
    id: "growth",
    label: "Growth",
    blurb: "Automations, outreach, marketing and market",
    hue: "orange",
    icon: IC.growth,
    entries: [
      { label: "Automations", to: "/automations", page: "admin", icon: IC.flow },
      { label: "Outreach cadences", to: "/cadences", page: "admin", icon: IC.mail },
      page("marketing"),
      page("markets"),
    ],
  },
  {
    id: "ai",
    label: "AI",
    blurb: "Co-founder, agents and trackers",
    hue: "blue",
    icon: IC.ai,
    entries: [page("advisor"), page("agent"), page("tracker")],
  },
];

/** Entries this role can open (and the "soon" ones, so people see what is coming). */
export const appEntriesFor = (app: AppDef, role: Role) => app.entries.filter((e) => e.soon || (e.page && canAccess(role, e.page)));

/** Apps with at least one page this role can open. */
export const appsForRole = (role: Role) => APPS.filter((a) => a.entries.some((e) => !e.soon && e.page && canAccess(role, e.page)));

/** The app a route belongs to: the entry with the longest matching path wins (/tasks/automations → Growth). */
export const appForPath = (pathname: string): AppDef | null => {
  let best: { app: AppDef; len: number } | null = null;
  for (const app of APPS)
    for (const e of app.entries) {
      if (!e.to) continue;
      if ((pathname === e.to || pathname.startsWith(`${e.to}/`)) && (!best || e.to.length > best.len)) best = { app, len: e.to.length };
    }
  return best?.app ?? null;
};
