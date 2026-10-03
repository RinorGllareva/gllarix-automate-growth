import { describe, expect, it } from "vitest";
import { buildVsBuy, verdictFor } from "@/config/buildVsBuy";
import { jobFor, PAGE_JOBS } from "@/config/pageJobs";
import { appEntriesFor, appsForRole, navForRole } from "@/lib/nav";
import type { Role } from "@/data/types";

const ROLES: Role[] = ["admin", "bdr", "closer", "implementer", "viewer"];
const KEY_OF: Record<string, string> = { "/automations": "automations", "/cadences": "cadences" };

describe("every page has a job for everyone who can open it", () => {
  it.each(ROLES)("%s: no decoration pages in the sidebar", (role) => {
    for (const n of navForRole(role)) expect(jobFor(n.id, role), `${role} on ${n.id}`).not.toBeNull();
    for (const app of appsForRole(role))
      for (const e of appEntriesFor(app, role)) {
        if (e.soon || !e.to) continue;
        const key = KEY_OF[e.to] ?? e.page!;
        expect(jobFor(key, role), `${role} on ${e.to}`).not.toBeNull();
      }
  });

  it("states a job and an outcome in plain words", () => {
    for (const [page, roles] of Object.entries(PAGE_JOBS))
      for (const [role, j] of Object.entries(roles)) {
        expect(j!.job.length, `${page}/${role}`).toBeGreaterThan(15);
        expect(j!.outcome.length, `${page}/${role}`).toBeGreaterThan(8);
        expect(j!.job).not.toMatch(/[A-Z]{4,} [A-Z]{4,}/); // no shouting
      }
  });

  it("gives the accountant the books and nothing to decorate", () => {
    const ids = navForRole("viewer").map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(["finance", "payments", "commissions", "reports"]));
    expect(ids).not.toContain("marketing");
    expect(navForRole("bdr").map((n) => n.id)).not.toContain("markets");
  });
});

describe("build or buy (spec/backbone/09)", () => {
  it("judges subscriptions: keep the plumbing, replace what Atlas does", () => {
    expect(verdictFor("Google Workspace (3 seats)").verdict).toBe("keep");
    expect(verdictFor("US number + dialer").verdict).toBe("keep");
    expect(verdictFor("Call recorder").verdict).toBe("replace");
    expect(verdictFor("Calendly Pro").verdict).toBe("replace");
    expect(verdictFor("ClickUp Business").verdict).toBe("replace");
    expect(verdictFor("Diego Marín · BDR base").verdict).toBe("keep");
    expect(verdictFor("Some new SaaS").verdict).toBe("review");
  });

  it("builds core IP that pays back within a year, buys commodity unless it's quick", () => {
    const base = { priceEur: 50, seats: 2, buildHours: 40, maintainHoursPerMonth: 0.5, hourValueEur: 87.5 };
    // Saves 100 − 43.75 = 56.25 a month; build costs 3,500 → 62 months.
    const commodity = buildVsBuy({ ...base, core: false });
    expect(commodity.breakEvenMonths).toBeCloseTo(62.2, 1);
    expect(commodity.verdict).toBe("buy");
    expect(buildVsBuy({ ...base, core: true }).verdict).toBe("later");
    const quick = buildVsBuy({ ...base, buildHours: 4, core: false });
    expect(quick.breakEvenMonths).toBeCloseTo(6.2, 1);
    expect(quick.verdict).toBe("buy");
    expect(buildVsBuy({ ...base, buildHours: 3, core: false }).verdict).toBe("build");
    expect(buildVsBuy({ ...base, maintainHoursPerMonth: 2, core: true })).toMatchObject({ breakEvenMonths: null, verdict: "buy" });
    expect(buildVsBuy({ ...base, buildHours: 15, core: true }).weekends).toBe(2);
  });
});
