import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COUNTRY_RULES, type CountryRule } from "@/config/countryRules";
import type { ListType } from "@/config/leads";
import { SCORING, type Condition, type Rule } from "@/config/scoring";
import { createDemoSource } from "@/data/demo/demoSource";
import type { Company, Contact, Lead, Signal } from "@/data/leadTypes";
import type { DataSource } from "@/data/types";
import { canContact, retentionDue, type ComplianceChannel } from "@/services/compliance";
import { scoreLead, tierFor } from "@/services/scoring";
import { zonedToUtc } from "@/services/time";

const now = new Date("2026-10-01T12:00:00Z");
const DAY = 86_400_000;

// ---------------------------------------------------------------- scoring: every rule passes once and fails once

/** A lead on which no rule fires. Each case changes exactly one input. */
const neutral = () => ({
  company: {
    id: "c", name: "Neutral Co", domain: "", phone: "+15550000000", country: "ZZ", region: null, city: null, timezone: "America/New_York", industry: "other",
    listType: "trades", brandInterest: ["gllarix"], employeesEst: null, reviewsCount: null, rating: null, sourceId: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  } as Company,
  contact: {
    id: "p", companyId: "c", firstName: "A", lastName: "B", title: null, email: null, emailStatus: "unknown", phone: null, phoneType: "unknown", phoneVerified: false, phoneInvalid: false, linkedinUrl: null, isDecisionMaker: false,
  } as Contact,
  signals: [] as Signal[],
  suppressed: false,
});
type Input = ReturnType<typeof neutral>;

const FIELD: Record<string, (i: Input, v: unknown) => void> = {
  "company.industry": (i, v) => (i.company.industry = v as string),
  "company.reviews_count": (i, v) => (i.company.reviewsCount = v as number),
  "company.employees_est": (i, v) => (i.company.employeesEst = v as number),
  "company.country": (i, v) => (i.company.country = v as string),
  "company.rating": (i, v) => (i.company.rating = v as number),
  "company.domain": (i, v) => (i.company.domain = v as string),
  "company.updated_days_ago": (i, v) => (i.company.updatedAt = new Date(now.getTime() - (v as number) * DAY).toISOString()),
  "contact.phone_verified": (i, v) => (i.contact.phoneVerified = v as boolean),
  "contact.is_decision_maker": (i, v) => (i.contact.isDecisionMaker = v as boolean),
  "contact.email_status": (i, v) => (i.contact.emailStatus = v as Contact["emailStatus"]),
  "contact.title": (i, v) => (i.contact.title = v as string),
  "lead.suppressed": (i, v) => (i.suppressed = v as boolean),
};
/** Titles for `matches` rules. */
const MATCH = { pass: "Sales Director", fail: "Chief Accountant" };

const signal = (key: string, value: boolean | number, daysAgo = 1): Signal => ({ id: key, leadId: "l", key, value, source: "test", observedAt: new Date(now.getTime() - daysAgo * DAY).toISOString(), expiresAt: null });

/** [passing value, failing value] straight from the rule's condition. */
const values = (c: Condition): [unknown, unknown] => {
  if ("in" in c) return [c.in[0], "zz_not_listed"];
  if ("between" in c) return [c.between[0], c.between[1] + 1];
  if ("eq" in c) return [c.eq, typeof c.eq === "boolean" ? !c.eq : "zz_other"];
  if ("lt" in c) return [c.lt - 0.1, c.lt];
  if ("gt" in c) return [c.gt + 1, c.gt];
  if ("gte" in c) return [c.gte, c.gte - 1];
  if ("exists" in c) return ["site.example", ""];
  return [MATCH.pass, MATCH.fail];
};

const apply = (rule: Rule, v: unknown, daysAgo = 1) => {
  const i = neutral();
  if ("signal" in rule.when) i.signals.push(signal(rule.when.signal, v as boolean | number, daysAgo));
  else FIELD[rule.when.field](i, v);
  return i;
};
const fires = (model: ListType, rule: Rule, i: Input) => {
  const r = scoreLead({ listType: model, ...i, now });
  return rule.exclude ? r.excluded : r.breakdown.some((l) => l.ruleId === rule.id);
};

describe("M2 scoring: every rule in config/scoring.ts (Appendix 1)", () => {
  for (const model of Object.keys(SCORING.models) as ListType[]) {
    it(`${model}: no rule fires on the neutral lead`, () => {
      const r = scoreLead({ listType: model, ...neutral(), now });
      expect(r.breakdown).toEqual([]);
      expect(r.excluded).toBe(false);
      expect(r.score).toBe(0);
    });
    describe(model, () => {
      for (const rule of SCORING.models[model]) {
        const [pass, fail] = values(rule.when);
        it(`${rule.id}: passes on ${JSON.stringify(pass)}, fails on ${JSON.stringify(fail)}`, () => {
          expect(fires(model, rule, apply(rule, pass))).toBe(true);
          expect(fires(model, rule, apply(rule, fail))).toBe(false);
          if (!rule.exclude) {
            const r = scoreLead({ listType: model, ...apply(rule, pass), now });
            expect(r.breakdown.find((l) => l.ruleId === rule.id)?.points).toBe(rule.points);
          }
        });
        if (rule.expiresDays) {
          it(`${rule.id}: counts for ${rule.expiresDays} days, not after`, () => {
            expect(fires(model, rule, apply(rule, pass, rule.expiresDays! - 1))).toBe(true);
            expect(fires(model, rule, apply(rule, pass, rule.expiresDays! + 1))).toBe(false);
          });
        }
      }
    });
  }

  it("named_sales_director matches sales and marketing leaders in either word order (v2)", () => {
    const rule = SCORING.models.developers.find((r) => r.id === "named_sales_director")!;
    for (const t of ["Sales Director", "Marketing Manager", "Head of Sales", "Director of Marketing", "VP Sales", "Chief Marketing Officer", "Sales & Marketing Lead", "head of sales and leasing"]) {
      expect(fires("developers", rule, apply(rule, t)), t).toBe(true);
    }
    for (const t of ["Sales Associate", "Marketing Coordinator", "Managing Director", "Head of Construction", "Wholesale Manager", "Salesforce Admin"]) {
      expect(fires("developers", rule, apply(rule, t)), t).toBe(false);
    }
  });

  it("config/scoring.ts matches the spec's Appendix 1 (model version, every rule's points, expiry and pattern)", () => {
    const spec = resolve(__dirname, "../../spec/prompts/CRM_BUILD_PROMPT.md");
    if (!existsSync(spec)) return; // spec pack not on this machine
    const yaml = readFileSync(spec, "utf8").split("# Appendix 1")[1].split("```")[1];
    expect(yaml.match(/model_version: "([^"]+)"/)![1]).toBe(SCORING.modelVersion);
    let comparedPatterns = 0;
    for (const model of Object.keys(SCORING.models) as ListType[]) {
      const block = yaml.split(new RegExp(`^  ${model}:`, "m"))[1].split(/^  \w+:/m)[0];
      const lines = block.split("\n").filter((l) => l.trim().startsWith("- {id:"));
      expect(lines.map((l) => l.match(/id: (\w+)/)![1]), model).toEqual(SCORING.models[model].map((r) => r.id));
      for (const line of lines) {
        const id = line.match(/id: (\w+)/)![1];
        const rule = SCORING.models[model].find((r) => r.id === id)!;
        const points = line.match(/points: (-?\d+)/)?.[1];
        const expires = line.match(/expires_days: (\d+)/)?.[1];
        const pattern = line.match(/matches: '([^']+)'/)?.[1] ?? line.match(/matches: "([^"]+)"/)?.[1];
        expect(rule.points ?? null, id).toBe(points ? Number(points) : null);
        expect(rule.expiresDays ?? null, id).toBe(expires ? Number(expires) : null);
        if (pattern) {
          expect("matches" in rule.when && rule.when.matches, id).toBe(pattern);
          comparedPatterns++;
        }
      }
    }
    expect(comparedPatterns).toBe(1); // named_sales_director
  });

  it("every condition type and field in the config has a test path", () => {
    for (const rule of Object.values(SCORING.models).flat()) {
      if (!("signal" in rule.when)) expect(FIELD[rule.when.field], rule.id).toBeDefined();
    }
  });

  it("clamps to 0–100 and maps tiers at A 70 · B 50 · C 30", () => {
    const i = neutral();
    i.signals.push(signal("is_franchise_or_chain", true), signal("uses_ai_receptionist", true));
    expect(scoreLead({ listType: "trades", ...i, now }).score).toBe(0);
    expect([70, 69, 50, 49, 30, 29].map(tierFor)).toEqual(["A", "B", "B", "C", "C", "D"]);
    expect(SCORING.tiers).toEqual({ A: 70, B: 50, C: 30 });
  });
});

// ---------------------------------------------------------------- compliance: every country rule

const TZ: Record<string, string> = {
  US: "America/New_York", CA: "America/Toronto", GB: "Europe/London", CH: "Europe/Zurich", DE: "Europe/Berlin", AT: "Europe/Vienna", AE: "Asia/Dubai",
  XK: "Europe/Belgrade", AL: "Europe/Tirane", NO: "Europe/Oslo", SE: "Europe/Stockholm", DK: "Europe/Copenhagen",
};
const check = (country: string, channel: ComplianceChannel, opts: { hhmm?: string; flags?: string[]; mobile?: boolean; dialer?: "manual" | "auto" } = {}) => {
  const tz = TZ[country] ?? "UTC";
  const company: Company = { ...neutral().company, country, timezone: tz, phoneFlags: opts.flags };
  const contact: Contact = { ...neutral().contact, email: "owner@site.example", emailStatus: "valid", phone: "+15551112222", phoneType: opts.mobile ? "mobile" : "landline", phoneFlags: opts.flags };
  const lead = { id: "l", companyId: "c", stage: "new", suppressed: false, erasedAt: null } as unknown as Lead;
  return canContact({ lead, company, contacts: [contact], contact, channel, at: zonedToUtc("2026-10-01", opts.hhmm ?? "10:00", tz), suppression: [], activities: [], dialer: opts.dialer });
};
const text = (r: { reasons: string[] }) => r.reasons.join(" · ");

/** Keys of country_rules.yaml and the test that covers each. */
const TESTED_KEYS = ["call", "email", "notes", "verified", "callRequires", "callBlock", "callHoursLocal", "smsCold", "autodialerToMobile"];

describe("M2 compliance: every rule in config/countryRules.ts (Appendix 3)", () => {
  it("every key used in the country rules is covered here", () => {
    const keys = new Set(Object.values(COUNTRY_RULES).flatMap((r) => Object.keys(r)));
    for (const k of keys) expect(TESTED_KEYS, k).toContain(k);
  });

  for (const [country, rule] of Object.entries(COUNTRY_RULES) as [string, CountryRule][]) {
    it(`${country} · call ${rule.call ? "allowed" : "blocked"}`, () => {
      const r = check(country, "call");
      expect(r.allowed).toBe(rule.call);
      if (!rule.call) expect(text(r)).toMatch(/Cold calls aren't allowed/);
    });
    it(`${country} · email ${String(rule.email)}`, () => {
      const r = check(country, "email");
      expect(r.allowed).toBe(rule.email !== false);
      if (rule.email === false) expect(text(r)).toMatch(/Cold email isn't allowed/);
      if (rule.email === "conditional") expect(text(r)).toContain(`conditional: ${rule.notes}`);
    });
    it(`${country} · calling window ${rule.callHoursLocal ?? "07:00-21:00 (default)"}`, () => {
      if (!rule.call) return;
      const [from, to] = (rule.callHoursLocal ?? "07:00-21:00").split("-");
      expect(check(country, "call", { hhmm: from }).allowed).toBe(true);
      expect(text(check(country, "call", { hhmm: to }))).toMatch(/Outside calling hours/);
    });
    it(`${country} · cold SMS blocked unless sms_cold`, () => {
      expect(check(country, "sms", { mobile: true }).allowed).toBe(rule.smsCold === true);
    });
  }

  it("unknown markets are blocked", () => {
    expect(text(check("BR", "call"))).toMatch(/No outreach rules/);
  });

  it("call_requires: UK calls carry the TPS/CTPS screen; other markets don't", () => {
    expect(text(check("GB", "call"))).toMatch(/TPS\/CTPS screen required/);
    expect(text(check("US", "call"))).not.toMatch(/TPS/);
  });

  it("call_block: a Swiss number with the directory asterisk can't be cold-called; unflagged can; the flag means nothing in the US", () => {
    expect(text(check("CH", "call", { flags: ["directory_asterisk"] }))).toMatch(/asterisk in the Swiss directory/);
    expect(check("CH", "call").allowed).toBe(true);
    expect(check("US", "call", { flags: ["directory_asterisk"] }).allowed).toBe(true);
  });

  it("autodialer_to_mobile false: no autodialed calls to US mobiles; hand dialing and landlines are fine", () => {
    expect(text(check("US", "call", { mobile: true, dialer: "auto" }))).toMatch(/No autodialed or prerecorded calls to mobiles/);
    expect(check("US", "call", { mobile: true, dialer: "manual" }).allowed).toBe(true);
    expect(check("US", "call", { mobile: false, dialer: "auto" }).allowed).toBe(true);
  });

  it("sms_cold: a market that allowed cold texts would pass (the rule, not the channel, decides)", () => {
    const saved = COUNTRY_RULES.XK.smsCold;
    COUNTRY_RULES.XK.smsCold = true;
    try {
      expect(check("XK", "sms", { mobile: true }).allowed).toBe(true);
      expect(text(check("XK", "sms", { mobile: false }))).toMatch(/No mobile number/);
    } finally {
      COUNTRY_RULES.XK.smsCold = saved;
    }
    expect(text(check("US", "sms", { mobile: true }))).toMatch(/Cold texts aren't allowed/);
  });

  it("verified: every market is still unconfirmed by counsel (admins see the warning)", () => {
    expect(Object.values(COUNTRY_RULES).every((r) => r.verified === false)).toBe(true);
  });

  it("retention: lost and never-worked leads older than the window; won or active leads never", () => {
    const at = Date.UTC(2027, 10, 1);
    const old = "2026-09-01T00:00:00Z";
    const base = { erasedAt: null, lastTouchAt: null, attemptsCount: 0, createdAt: old, updatedAt: old } as unknown as Lead;
    expect(retentionDue({ ...base, stage: "new" }, at, 12)).toBe(true);
    expect(retentionDue({ ...base, stage: "lost", lastTouchAt: old }, at, 12)).toBe(true);
    expect(retentionDue({ ...base, stage: "won" }, at, 12)).toBe(false);
    expect(retentionDue({ ...base, stage: "contacted", lastTouchAt: old, attemptsCount: 2 }, at, 12)).toBe(false);
    expect(retentionDue({ ...base, stage: "new" }, at, 24)).toBe(false);
    expect(retentionDue({ ...base, stage: "new", erasedAt: old }, at, 12)).toBe(false);
  });
});

// ---------------------------------------------------------------- the demo backend: history, nightly, GDPR

const PW = "pw";
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}
const switchTo = async (src: DataSource, email: string) => {
  await src.signOut();
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};
const source = async (clock: { t: number }, email = "rinor@atlas.test") => {
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => clock.t, storage: new MemoryStorage() });
  await switchTo(src, email);
  return src;
};
const allLeads = async (src: DataSource) => (await src.listLeads({ tiers: [], lists: [], countries: [], stages: [], owners: [], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 })).rows;

describe("M2 score history, nightly job, live compliance, GDPR", () => {
  it("score_history: every lead has its first score; a rescore without change adds nothing", async () => {
    const clock = { t: now.getTime() };
    const src = await source(clock);
    const [row] = await allLeads(src);
    const before = (await src.getLead(row.lead.id)).scoreHistory!;
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ reason: "initial", score: row.lead.score, tier: row.lead.tier, prevScore: null });
    await src.rescore([row.lead.id]);
    expect((await src.getLead(row.lead.id)).scoreHistory).toHaveLength(1);
  });

  it("the nightly job rescores, so expired signals drop out and history records it; once a day, after 02:00 UTC", async () => {
    const clock = { t: Date.UTC(2026, 9, 1, 1, 30) };
    const src = await source(clock);
    expect(await src.runNightlyJobs()).toBeNull(); // before 02:00
    clock.t = Date.UTC(2026, 9, 1, 3);
    const first = await src.runNightlyJobs();
    expect(first).toMatchObject({ date: "2026-10-01" });
    expect(first!.rescored).toBeGreaterThan(400);
    expect(await src.runNightlyJobs()).toBeNull(); // once per day
    // 200 days on, most signals (60–180 day expiry) have lapsed.
    clock.t = Date.UTC(2027, 3, 20, 3);
    await switchTo(src, "rinor@atlas.test");
    const later = await src.runNightlyJobs();
    expect(later!.changed).toBeGreaterThan(0);
    let nightly = null;
    for (const r of await allLeads(src)) {
      nightly = (await src.getLead(r.lead.id)).scoreHistory!.find((h) => h.reason === "nightly") ?? null;
      if (nightly) break;
    }
    expect(nightly).toMatchObject({ reason: "nightly" });
    expect(nightly!.prevScore).not.toBeNull();
    expect((await src.complianceOverview()).runs.map((r) => r.date)).toEqual(["2027-04-20", "2026-10-01"]);
  });

  it("lead detail shows live compliance for call, email and text", async () => {
    const clock = { t: now.getTime() };
    const src = await source(clock);
    const [row] = await allLeads(src);
    const d = await src.getLead(row.lead.id);
    expect(Object.keys(d.compliance!)).toEqual(["call", "email", "sms"]);
    expect(d.compliance!.sms.allowed).toBe(false);
    expect(d.compliance!.call.reasons.length).toBeGreaterThan(0);
  });

  it("GDPR: admins export and erase; erased people go on the opt-out list and can't be contacted; stats stay; BDRs can't", async () => {
    const clock = { t: now.getTime() };
    const src = await source(clock);
    const lead = (await allLeads(src)).find((r) => r.contact?.email)!;
    const email = lead.contact!.email!;
    const json = JSON.parse(await src.exportPersonalData(lead.lead.id));
    expect(json.contacts.map((c: { email: string }) => c.email)).toContain(email);
    expect(json.lawfulBasis).toBeTruthy();
    await expect(src.erasePersonalData(lead.lead.id, " ")).rejects.toThrow(/Record why/);
    await src.erasePersonalData(lead.lead.id, "Email request 1 Oct 2026");
    const d = await src.getLead(lead.lead.id);
    expect(d.contacts.every((c) => c.firstName === "Erased" && c.email === null && c.phone === null)).toBe(true);
    expect(d.lead.stage).toBe(lead.lead.stage);
    expect(d.compliance!.call.reasons.join(" ")).toMatch(/Personal data was erased/);
    expect((await src.listSuppression()).some((x) => x.reason === "erasure" && x.value === email.toLowerCase())).toBe(true);
    await expect(src.erasePersonalData(lead.lead.id, "again")).rejects.toThrow(/Already erased/);
    await switchTo(src, "diego@atlas.test");
    await expect(src.exportPersonalData(lead.lead.id)).rejects.toMatchObject({ status: 403 });
  });

  it("retention: after 12 months the nightly job erases never-worked leads; admins set the window", async () => {
    const clock = { t: now.getTime() };
    const src = await source(clock);
    await expect(src.setRetentionMonths(0)).rejects.toThrow(/1–120/);
    expect((await src.complianceOverview()).dueForRetention).toBe(0);
    const count = (await allLeads(src)).length;
    clock.t = Date.UTC(2027, 10, 15, 3); // 13+ months later
    await switchTo(src, "rinor@atlas.test");
    const due = (await src.complianceOverview()).dueForRetention;
    expect(due).toBeGreaterThan(0);
    await src.setRetentionMonths(24);
    expect((await src.complianceOverview()).dueForRetention).toBe(0);
    await src.setRetentionMonths(12);
    const run = await src.runNightlyJobs();
    expect(run!.erased).toBe(due);
    expect((await allLeads(src)).length).toBe(count); // stats stay
    expect((await src.complianceOverview()).dueForRetention).toBe(0);
  });
});
