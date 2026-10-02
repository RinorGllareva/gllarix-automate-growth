/**
 * QA sweep: every route, for every role, renders without crashing, without console errors, without stuck loading
 * states and without "NaN" / "undefined" / "[object Object]" leaking into the page. Forbidden pages must show the 403.
 */
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { navForRole } from "@/lib/nav";

const PW = "atlas-demo";
const USERS = { admin: "rinor@atlas.test", bdr: "diego@atlas.test", implementer: "lena@atlas.test", viewer: "books@atlas.test" } as const;
type RoleKey = keyof typeof USERS;

const ADMIN_SECTIONS = ["users", "settings", "country-rules", "scoring", "cadences", "price-book", "opt-out", "jobs", "advisor", "integrations", "audit"];
const TASK_VIEWS = ["", "/board", "/my-work", "/inbox", "/timeline", "/workload", "/planner", "/automations", "/goals", "/import"];

// jsdom gaps the app relies on.
beforeAll(() => {
  Element.prototype.scrollIntoView ??= function () {};
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  URL.createObjectURL ??= () => "blob:test";
});

const problems: string[] = [];
const seen: string[] = [];
/** Pages only admins open, inside modules other roles can use. */
const ADMIN_ONLY = ["/leads/import"];
afterAll(() => {
  if (process.env.QA_VERBOSE) console.log(seen.join("\n"));
  if (problems.length) console.log(`\nQA problems (${problems.length}):\n${problems.join("\n")}`);
});

const signIn = async (role: RoleKey) => {
  const { data } = await import("@/data");
  await data.signOut();
  const r = await data.signInWithPassword(USERS[role], PW);
  if (!r.ok) throw new Error(`sign-in failed for ${role}`);
  return data;
};

/** Real ids for detail routes, from what this role can see. */
const idsFor = async (role: RoleKey) => {
  const data = await signIn(role);
  const safe = async <T,>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };
  const leads = await safe(() => data.listLeads({ tiers: [], lists: [], countries: [], stages: [], owners: [], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 }));
  const deals = await safe(() => data.listDeals());
  const clients = await safe(() => data.clientsOverview());
  const home = await safe(() => data.tasksHome());
  const team = await safe(() => data.teamOverview());
  const threads = await safe(() => data.advisorHome());
  const plans = await safe(() => data.planLog());
  return {
    lead: leads?.rows[0]?.lead.id,
    deal: deals?.[0]?.deal.id,
    client: clients?.cards.find((c) => c.status !== "proposal")?.id,
    task: (home as { myWork?: { task: { id: string } }[] } | null)?.myWork?.[0]?.task.id,
    person: team && "cards" in team ? team.cards.find((c) => "userId" in c && c.userId)?.userId : undefined,
    thread: threads?.threads[0]?.id,
    plan: (plans as { id: string }[] | null)?.[0]?.id,
  };
};

const pathsFor = async (role: RoleKey) => {
  const ids = await idsFor(role);
  const nav = navForRole(role).map((n) => n.path);
  const all = new Set<string>(["/today", "/call", "/leads", "/pipeline", "/meetings", "/deals", "/clients", "/reports", "/tasks", "/team", "/time", "/advisor", "/admin/users"]);
  nav.forEach((p) => all.add(p));
  if (nav.includes("/leads")) ["/leads/import", ids.lead && `/leads/${ids.lead}`, ids.lead && `/call/${ids.lead}`].forEach((p) => p && all.add(p));
  if (nav.includes("/deals")) ["/deals/new", ids.deal && `/deals/${ids.deal}`].forEach((p) => p && all.add(p));
  if (nav.includes("/clients") && ids.client) all.add(`/clients/${ids.client}`);
  if (nav.includes("/tasks")) {
    TASK_VIEWS.forEach((v) => all.add(`/tasks${v}`));
    if (ids.task) all.add(`/tasks/${ids.task}`);
    if (ids.plan) all.add(`/tasks/planner/${ids.plan}`);
  }
  if (nav.includes("/team") && ids.person) all.add(`/team/${ids.person}`);
  if (nav.includes("/time")) all.add("/time/reports");
  if (nav.includes("/advisor") && ids.thread) all.add(`/advisor/${ids.thread}`);
  if (nav.includes("/admin")) ADMIN_SECTIONS.forEach((s) => all.add(`/admin/${s}`));
  ["/styleguide", "/does-not-exist"].forEach((p) => all.add(p));
  return { paths: [...all], nav };
};

const settle = async (container: HTMLElement) => {
  for (let i = 0; i < 50; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    if (!container.querySelector(".skeleton, .animate-pulse")) return true;
  }
  return false;
};

const LEAKS = [/\bNaN\b/, /\bundefined\b/, /\[object Object\]/, /Infinity/];
const ERROR_TEXT = [/Sign in first/i, /not wired yet/i, /Cannot read prop/i, /is not a function/i, /Something went wrong/i];

const run = async (role: RoleKey, path: string, allowed: boolean) => {
  await signIn(role);
  const errors: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => errors.push(a.map(String).join(" ").slice(0, 300)));
  const onRejection = (e: PromiseRejectionEvent) => errors.push(`unhandled rejection: ${String(e.reason).slice(0, 200)}`);
  window.addEventListener("unhandledrejection", onRejection);
  const issues: string[] = [];
  try {
    const { AppRoutes } = await import("@/App");
    const { AuthProvider } = await import("@/auth/AuthContext");
    const { ToastProvider } = await import("@/components/ui/overlay");
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    const done = await settle(container);
    const text = container.textContent ?? "";
    if (!done && path !== "/styleguide") issues.push("still loading after 5 s"); // the styleguide shows skeletons on purpose
    seen.push(`${role} ${path} · ${text.length} chars · ${text.replace(/\s+/g, " ").slice(0, 70)}`);
    if (!text.trim()) issues.push("blank page");
    for (const re of LEAKS) if (re.test(text)) issues.push(`text leak ${re}: …${text.slice(Math.max(0, text.search(re) - 60), text.search(re) + 40)}…`);
    for (const re of ERROR_TEXT) if (re.test(text)) issues.push(`error text ${re}`);
    const forbidden = /You don't have access to this page/.test(text);
    if (allowed && forbidden) issues.push("403 on an allowed page");
    if (!allowed && !forbidden && !/Page not found|isn't here|Sign in/i.test(text) && path !== "/styleguide") issues.push("forbidden page rendered content");
    // React's act() warnings are noise for this sweep; keep real errors.
    for (const e of errors.filter((x) => !/not wrapped in act|act\(\.\.\.\)|React Router Future Flag/.test(x))) issues.push(`console: ${e}`);
  } finally {
    cleanup();
    spy.mockRestore();
    window.removeEventListener("unhandledrejection", onRejection);
  }
  if (issues.length) problems.push(`[${role}] ${path}\n   - ${issues.join("\n   - ")}`);
  return issues;
};

describe("QA: every route renders cleanly for every role", () => {
  for (const role of Object.keys(USERS) as RoleKey[]) {
    it(`${role}`, async () => {
      const { paths, nav } = await pathsFor(role);
      const failed: string[] = [];
      for (const p of paths) {
        const base = `/${p.split("/")[1]}`;
        const allowed = (nav.includes(base) && (role === "admin" || !ADMIN_ONLY.includes(p))) || p === "/styleguide" || p === "/does-not-exist";
        const issues = await run(role, p, allowed);
        if (issues.length) failed.push(`${p}: ${issues.join(" | ")}`);
      }
      expect(failed).toEqual([]);
    }, 600_000);
  }
});
