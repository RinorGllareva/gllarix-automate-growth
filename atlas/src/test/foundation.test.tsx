import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createDemoSource, IDLE_TIMEOUT_MS, LOCKOUT_WINDOW_MS } from "@/data/demo/demoSource";
import { SEED_USERS } from "@/data/demo/seed";
import type { Role } from "@/data/types";
import { isTypingTarget } from "@/lib/hotkeys";
import { canAccess, homePathFor, NAV_ITEMS, navForRole } from "@/lib/nav";
import { safeNext } from "@/lib/safeNext";

const PASSWORD = "test-pass";

describe("safeNext (no open redirects)", () => {
  it.each(["/leads", "/leads/42?tab=score", "/today#queue"])("keeps internal path %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", "/login", "", null])(
    "rejects %s",
    (p) => {
      expect(safeNext(p)).toBeNull();
    },
  );
});

describe("role access (00_SHARED_LAYOUT.md)", () => {
  const expected: Record<Role, string[]> = {
    admin: NAV_ITEMS.map((n) => n.id),
    bdr: ["today", "call", "leads", "pipeline", "meetings", "deals", "tasks", "team", "time", "advisor"],
    closer: ["today", "call", "leads", "pipeline", "meetings", "deals", "tasks", "team", "time", "advisor"],
    viewer: ["pipeline", "reports", "team"],
    implementer: ["clients", "tasks", "time"],
  };

  it.each(Object.keys(expected) as Role[])("%s sees exactly its pages", (role) => {
    expect(navForRole(role).map((n) => n.id).sort()).toEqual([...expected[role]].sort());
  });

  it("BDR can never reach admin, clients or reports", () => {
    expect(canAccess("bdr", "admin")).toBe(false);
    expect(canAccess("bdr", "clients")).toBe(false);
    expect(canAccess("bdr", "reports")).toBe(false);
  });

  it("lands each role on its first page", () => {
    expect(homePathFor("admin")).toBe("/today");
    expect(homePathFor("viewer")).toBe("/pipeline");
    expect(homePathFor("implementer")).toBe("/clients");
  });

  it("has 13 unique G shortcuts", () => {
    const keys = NAV_ITEMS.map((n) => n.key);
    expect(keys).toHaveLength(13);
    expect(new Set(keys).size).toBe(13);
  });
});

describe("demo sign-in", () => {
  const admin = SEED_USERS.find((u) => u.role === "admin")!;
  const paused = SEED_USERS.find((u) => !u.active)!;

  it("signs in a seeded user and writes the audit log", async () => {
    const src = createDemoSource({ password: PASSWORD });
    const res = await src.signInWithPassword(admin.email.toUpperCase(), PASSWORD);
    expect(res).toEqual({ ok: true, user: admin });
    expect((await src.currentUser())?.id).toBe(admin.id);
    await src.signOut();
    expect(await src.currentUser()).toBeNull();
    const actions = (await src.listAudit()).map((a) => a.action);
    expect(actions).toEqual(["auth.sign_out", "auth.sign_in"]);
  });

  it("gives the same generic error for an unknown email and a wrong password", async () => {
    const src = createDemoSource({ password: PASSWORD });
    expect(await src.signInWithPassword("nobody@atlas.test", PASSWORD)).toEqual({ ok: false, error: "invalid" });
    expect(await src.signInWithPassword(admin.email, "wrong")).toEqual({ ok: false, error: "invalid" });
  });

  it("tells paused users their access is paused", async () => {
    const src = createDemoSource({ password: PASSWORD });
    expect(await src.signInWithPassword(paused.email, PASSWORD)).toEqual({ ok: false, error: "paused" });
  });

  it("rate-limits on the 6th attempt after 5 failures, then resets after 15 minutes", async () => {
    let now = 1_000_000;
    const src = createDemoSource({ password: PASSWORD, now: () => now });
    for (let i = 0; i < 5; i += 1) {
      expect((await src.signInWithPassword(admin.email, "wrong")).ok).toBe(false);
    }
    expect(await src.signInWithPassword(admin.email, PASSWORD)).toEqual({ ok: false, error: "rate_limited" });
    now += LOCKOUT_WINDOW_MS + 1;
    expect((await src.signInWithPassword(admin.email, PASSWORD)).ok).toBe(true);
  });

  it("expires the session after 12 idle hours", async () => {
    let now = 5_000_000;
    const src = createDemoSource({ password: PASSWORD, now: () => now });
    await src.signInWithPassword(admin.email, PASSWORD);
    now += IDLE_TIMEOUT_MS + 1;
    expect(await src.currentUser()).toBeNull();
  });
});

describe("keyboard shortcuts never fire while typing", () => {
  it("treats text fields as typing targets, checkboxes and buttons as not", () => {
    const text = document.createElement("input");
    const box = Object.assign(document.createElement("input"), { type: "checkbox" });
    expect(isTypingTarget(text)).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(box)).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
  });
});

describe("routes", () => {
  const renderAt = async (path: string, email?: string) => {
    if (email) {
      const src = createDemoSource({ password: "atlas-demo" });
      await src.signInWithPassword(email, "atlas-demo");
    }
    // The app reads the shared demo store, so import after seeding the session.
    const { AppRoutes } = await import("@/App");
    const { AuthProvider } = await import("@/auth/AuthContext");
    const { ToastProvider } = await import("@/components/ui/overlay");
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  it("sends signed-out users to sign in", async () => {
    await renderAt("/leads");
    expect(await screen.findByRole("form", { name: "Sign in" })).toBeTruthy();
  });

  it("shows a 403 to a BDR on an admin page, and hides admin from the BDR's sidebar", async () => {
    await renderAt("/admin/users", "diego@atlas.test");
    expect(await screen.findByText("You don't have access to this page.")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.textContent).not.toContain("Admin");
    expect(nav.textContent).toContain("Call workspace");
  });

  it("lets an admin open the audit log", async () => {
    await renderAt("/admin/audit", "rinor@atlas.test");
    expect(await screen.findByRole("heading", { name: "Audit log" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("auth.sign_in")).toBeTruthy());
  });

  it("G then L goes to Leads, but not while typing in the search field", async () => {
    await renderAt("/today", "rinor@atlas.test");
    await screen.findByRole("navigation", { name: "Main" });
    await screen.findByRole("heading", { level: 1, name: "Today" });
    const search = screen.getByRole("searchbox", { name: "Search leads, companies, deals" });
    act(() => {
      fireEvent.keyDown(search, { key: "g" });
      fireEvent.keyDown(search, { key: "l" });
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Today");
    act(() => {
      fireEvent.keyDown(document.body, { key: "g" });
      fireEvent.keyDown(document.body, { key: "l" });
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Leads" })).toBeTruthy();
  });
});
