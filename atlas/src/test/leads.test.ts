import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import { generateLeadSeed } from "@/data/demo/leadSeed";
import type { Company, Contact, LeadQuery, Signal } from "@/data/leadTypes";
import { CLEARED_QUERY, parseLeadQuery, serializeLeadQuery } from "@/lib/leadQuery";
import { nameSimilarity, normalizeDomain, normalizeName, normalizePhone, preparedSimilarity, prepareName, similarityUpperBound } from "@/services/dedup";
import { autoMap, fillEmpty, normalizeRow, planImport, type ColumnMapping } from "@/services/importPlan";
import { scoreLead } from "@/services/scoring";

const PASSWORD = "pw";
const ALL: LeadQuery = { ...CLEARED_QUERY, sort: "score", dir: "desc", page: 1 };

const signedIn = async (email: string) => {
  const src = createDemoSource({ password: PASSWORD, persistLeads: false });
  const res = await src.signInWithPassword(email, PASSWORD);
  if (!res.ok) throw new Error("sign-in failed");
  return src;
};

describe("normalisation (dedup.py port)", () => {
  it.each([
    ["(813) 555-0142", "US", "+18135550142"],
    ["+1 813.555.0142", null, "+18135550142"],
    ["020 7946 0123", "GB", "+442079460123"],
    ["044 555 12 34", "CH", "+41445551234"],
    ["not a phone", "US", null],
  ])("phone %s (%s) → %s", (raw, country, e164) => {
    expect(normalizePhone(raw, country)).toBe(e164);
  });

  it.each([
    ["https://www.Ridgeway-Air.com/contact?x=1", "ridgeway-air.com"],
    ["ridgeway-air.com.", "ridgeway-air.com"],
    ["owner@ridgeway-air.com", "ridgeway-air.com"],
    ["bob@gmail.com", null],
    ["not a domain", null],
  ])("domain %s → %s", (raw, domain) => {
    expect(normalizeDomain(raw)).toBe(domain);
  });

  it("drops legal suffixes and punctuation from names", () => {
    expect(normalizeName("Ridgeway Heating & Air, LLC")).toBe(normalizeName("ridgeway heating and air"));
  });

  it.each([
    ["Ridgeway Heating and Air LLC", "Ridgeway Heating & Air", 100],
    ["Sun Coast Plumbing", "Suncoast Plumbing Inc.", 90],
    ["Bay Area AC Repair", "Bay Area A/C & Repair", 90],
    ["Tampa Comfort Pros", "Comfort Pros Tampa", 100],
  ])("%s ≈ %s (≥ %i)", (a, b, min) => {
    expect(nameSimilarity(a, b)).toBeGreaterThanOrEqual(min);
  });

  it("keeps different companies apart", () => {
    expect(nameSimilarity("Summit Roofing", "Keystone Electric")).toBeLessThan(60);
  });

  it("the upper bound used to skip comparisons is never below the real similarity", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const words = ["sun", "coast", "heating", "air", "ridge", "way", "plumbing", "pro", "a1", "best", "roofing", "and", "co", "gulf", "breeze", "electric", "24", "7"];
    const name = () => Array.from({ length: 1 + Math.floor(rand() * 4) }, () => words[Math.floor(rand() * words.length)]).join(" ");
    const mutate = (n: string) => {
      const i = Math.floor(rand() * Math.max(1, n.length));
      const r = rand();
      return r < 0.33 ? n.slice(0, i) + n.slice(i + 1) : r < 0.66 ? n.replace(" ", "") : n.split(" ").reverse().join(" ");
    };
    for (let k = 0; k < 3000; k++) {
      const a = name();
      const b = rand() < 0.5 ? mutate(a) : name();
      const pa = prepareName(a);
      const pb = prepareName(b);
      expect(similarityUpperBound(pa, pb), `${a} | ${b}`).toBeGreaterThanOrEqual(preparedSimilarity(pa, pb));
    }
  });
});

describe("scoring (A8)", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const company: Company = {
    id: "c", name: "Test HVAC", domain: "test.example", phone: "+18135550100", country: "US", region: "FL", city: "Tampa",
    timezone: "America/New_York", industry: "hvac", listType: "trades", brandInterest: ["gllarix"], employeesEst: 10,
    reviewsCount: 120, rating: 4.6, sourceId: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  const contact: Contact = {
    id: "p", companyId: "c", firstName: "A", lastName: "B", title: "Owner", email: "a@test.example", emailStatus: "valid",
    phone: null, phoneType: "landline", phoneVerified: true, phoneInvalid: false, linkedinUrl: null, isDecisionMaker: true,
  };
  const signal = (key: string, daysAgo: number, value: boolean | number = true): Signal => ({
    id: key, leadId: "l", key, value, source: "test", observedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), expiresAt: null,
  });

  it("adds up the fired rules and clamps to 100", () => {
    const r = scoreLead({ listType: "trades", company, contact, signals: [signal("reviews_missed_calls", 5), signal("runs_lsa_or_google_ads", 5)], suppressed: false, now });
    // 15 trade + 10 reviews + 5 size + 5 callable + 5 english + 10 missed calls + 7 ads + 5 phone + 5 owner + 5 email
    expect(r.score).toBe(72);
    expect(r.tier).toBe("A");
    expect(r.breakdown.reduce((s, l) => s + l.points, 0)).toBe(r.score);
  });

  it("ignores signals older than the rule's expiry", () => {
    const fresh = scoreLead({ listType: "trades", company, contact, signals: [signal("runs_lsa_or_google_ads", 10)], suppressed: false, now });
    const stale = scoreLead({ listType: "trades", company, contact, signals: [signal("runs_lsa_or_google_ads", 61)], suppressed: false, now });
    expect(fresh.score - stale.score).toBe(7);
  });

  it("applies penalties and the opt-out exclusion", () => {
    const r = scoreLead({ listType: "trades", company: { ...company, rating: 3.1 }, contact, signals: [signal("is_franchise_or_chain", 1)], suppressed: true, now });
    expect(r.breakdown.map((l) => l.ruleId)).toEqual(expect.arrayContaining(["franchise_chain", "low_rating"]));
    expect(r.excluded).toBe(true);
  });

  it("scores developers with the developer model", () => {
    const dev = { ...company, industry: "property_developer", country: "GB", listType: "developers" as const };
    const r = scoreLead({ listType: "developers", company: dev, contact: { ...contact, title: "Sales and marketing director" }, signals: [signal("project_units", 2, 84), signal("no_3d_unit_picker", 3)], suppressed: false, now });
    expect(r.breakdown.map((l) => l.ruleId)).toEqual(expect.arrayContaining(["project_size", "no_3d_unit_picker", "named_sales_director", "target_market"]));
  });
});

describe("import planning (06_IMPORT.md)", () => {
  const headers = ["Business Name", "Phone", "Website", "City", "State"];
  const mapping: ColumnMapping = autoMap(headers);
  const row = (n: number, name: string, phone: string, site: string, city: string) =>
    normalizeRow({ "Business Name": name, Phone: phone, Website: site, City: city, State: "FL" }, n, mapping, "US");
  const existing: Company = {
    id: "co-x", name: "Ridgeway Heating & Air", domain: "ridgeway.example", phone: "+18135550142", country: "US", region: "FL", city: "Tampa",
    timezone: null, industry: "hvac", listType: "trades", brandInterest: ["gllarix"], employeesEst: null, reviewsCount: null, rating: 4.4,
    sourceId: null, createdAt: "", updatedAt: "",
  };

  it("auto-maps common headers", () => {
    expect(mapping).toEqual({ "Business Name": "companyName", Phone: "phone", Website: "website", City: "city", State: "region" });
  });

  it("skips exact duplicates, flags fuzzy ones, and rejects rows without phone or website", () => {
    const rows = [
      row(1, "Ridgeway HVAC", "(813) 555-0142", "", "Tampa"), // exact phone match in Atlas
      row(2, "Ridgeway Heating and Air LLC", "813 555 0177", "", "Tampa"), // fuzzy name + same city
      row(3, "Sun Coast Plumbing", "727 555 0101", "suncoast.example", "Clearwater"),
      row(4, "Suncoast Plumbing Inc.", "727 555 0102", "", "Clearwater"), // fuzzy with row 3, in file
      row(5, "Nameless Phone", "", "", "Tampa"), // invalid
      row(6, "Sun Coast Twin", "727-555-0101", "", "Clearwater"), // exact phone dup of row 3, in file
    ];
    const plan = planImport(rows, { companies: [existing], suppression: [] });
    expect(plan.exact.map((e) => e.row.row)).toEqual([1, 6]);
    expect(plan.invalid.map((r) => r.row)).toEqual([5]);
    expect(plan.possible.map((p) => [p.row.row, p.match.kind])).toEqual([
      [2, "atlas"],
      [4, "file"],
    ]);
  });

  it("marks rows on the opt-out list", () => {
    const plan = planImport([row(1, "Quiet Co", "813 555 0190", "quiet.example", "Tampa")], {
      companies: [],
      suppression: [{ id: "s", value: "quiet.example", type: "domain", reason: "opt_out", source: "manual", addedBy: null, createdAt: "" }],
    });
    expect(plan.suppressedRows).toEqual([1]);
  });

  it("merge fills empty fields and never overwrites", () => {
    const merged = fillEmpty(existing, { rating: 2.1, reviewsCount: 88, domain: "other.example", industry: "" });
    expect(merged.rating).toBe(4.4);
    expect(merged.domain).toBe("ridgeway.example");
    expect(merged.reviewsCount).toBe(88);
    expect(merged.industry).toBe("hvac");
  });

  it("plans 2,000 rows against 650 leads quickly", () => {
    const seed = generateLeadSeed(new Date("2026-10-01T12:00:00Z"));
    const rows = Array.from({ length: 2000 }, (_, i) =>
      row(i + 1, `${["Alpha", "Beta", "Gamma", "Delta"][i % 4]} Heating ${i}`, `+1813555${String(1000 + i).padStart(4, "0")}`, `co${i}.example`, ["Tampa", "Orlando", "Dallas"][i % 3]),
    );
    const t0 = performance.now();
    planImport(rows, { companies: seed.companies, suppression: seed.suppression });
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

describe("demo leads (access, import, undo)", () => {
  it("seeds 500 trades + 150 developer leads with unique phones", () => {
    const seed = generateLeadSeed();
    expect(seed.leads.filter((l) => l.listType === "trades")).toHaveLength(500);
    expect(seed.leads.filter((l) => l.listType === "developers")).toHaveLength(150);
    const phones = seed.companies.map((c) => c.phone);
    expect(new Set(phones).size).toBe(phones.length);
    expect(seed.companies.every((c) => !c.domain || c.domain.endsWith(".example"))).toBe(true);
  });

  it("shows the BDR only their own leads and 403s the rest", async () => {
    const admin = await signedIn("rinor@atlas.test");
    const all = await admin.listLeads(ALL);
    const bdr = await signedIn("diego@atlas.test");
    const mine = await bdr.listLeads(ALL);
    expect(mine.total).toBeGreaterThan(0);
    expect(mine.total).toBeLessThan(all.total);
    expect(mine.rows.every((r) => r.lead.ownerId === "u-bdr")).toBe(true);
    const notMine = all.rows.find((r) => r.lead.ownerId !== "u-bdr")!;
    await expect(bdr.getLead(notMine.lead.id)).rejects.toMatchObject({ status: 403 });
    await expect(bdr.bulkAssign([mine.rows[0].lead.id], "u-bdr")).rejects.toMatchObject({ status: 403 });
    await expect(bdr.exportLeads([mine.rows[0].lead.id])).rejects.toMatchObject({ status: 403 });
  });

  it("keeps implementers and viewers out of leads", async () => {
    for (const email of ["lena@atlas.test", "books@atlas.test"]) {
      const src = await signedIn(email);
      await expect(src.listLeads(ALL)).rejects.toMatchObject({ status: 403 });
    }
  });

  it("logs stage changes in the timeline and the audit log", async () => {
    const admin = await signedIn("rinor@atlas.test");
    const { rows } = await admin.listLeads(ALL);
    const id = rows[0].lead.id;
    await admin.updateLead(id, { stage: "qualified" });
    const detail = await admin.getLead(id);
    expect(detail.lead.stage).toBe("qualified");
    expect(detail.activities[0].type).toBe("stage_change");
    expect((await admin.listAudit()).some((a) => a.action === "lead.update" && a.entityId === id)).toBe(true);
  });

  it("filters combine with AND", async () => {
    const admin = await signedIn("rinor@atlas.test");
    const page = await admin.listLeads({ ...ALL, tiers: ["A"], lists: ["developers"], countries: ["GB"] });
    expect(page.rows.every((r) => r.lead.tier === "A" && r.lead.listType === "developers" && r.company.country === "GB")).toBe(true);
  });

  it("filters 20,000 leads in under 500 ms", async () => {
    const admin = await signedIn("rinor@atlas.test");
    await admin.listLeads(ALL); // load the seed
    const t0 = performance.now();
    for (let i = 0; i < 30; i += 1) await admin.listLeads({ ...ALL, tiers: ["A", "B"], q: "plumb" });
    // 650 leads × 30 runs ≈ 20,000 leads filtered.
    expect(performance.now() - t0).toBeLessThan(500 * 3);
  });

  it("imports, never creates exact duplicates, merges without overwriting, and undoes only untouched leads", async () => {
    const admin = await signedIn("rinor@atlas.test");
    const ctx = await admin.dedupContext();
    const target = ctx.companies[0];
    const mapping = autoMap(["Company", "Phone", "City", "Rating"]);
    const rows = [
      normalizeRow({ Company: "Brand New Heating", Phone: "+1 614 555 0198", City: "Columbus", Rating: "4.9" }, 1, mapping, "US"),
      normalizeRow({ Company: "Copy", Phone: target.phone!, City: target.city!, Rating: "1.0" }, 2, mapping, "US"),
      normalizeRow({ Company: `${target.name} LLC`, Phone: "+1 999 555 0100", City: target.city!, Rating: "1.0" }, 3, mapping, "US"),
      normalizeRow({ Company: "Second New Roofing", Phone: "+1 614 555 0197", City: "Columbus", Rating: "" }, 4, mapping, "US"),
    ];
    const plan = planImport(rows, ctx);
    expect(plan.exact).toHaveLength(1);
    expect(plan.possible.map((p) => p.row.row)).toContain(3);

    const job = await admin.commitImport({ fileName: "t.csv", sourceName: "Test list", plan, decisions: { 3: "merge" }, ownerId: "u-bdr", listType: "trades", lawfulBasis: "Legitimate interest · B2B", suppressedMode: "suppress" });
    expect(job.created).toBe(2);
    expect(job.merged).toBe(1);
    expect(job.skipped).toBe(1);
    const after = await admin.dedupContext();
    expect(after.companies.find((c) => c.id === target.id)!.rating).toBe(target.rating);
    expect(after.companies.filter((c) => c.phone === target.phone)).toHaveLength(1);

    // Touch one imported lead, then undo: only the untouched one goes.
    await admin.addNote(job.leadIds[0], "Called back, keep this one");
    const undo = await admin.undoImport(job.id);
    expect(undo).toEqual({ removed: 1, kept: 1 });
    await expect(admin.getLead(job.leadIds[1])).rejects.toMatchObject({ status: 404 });
    expect((await admin.getLead(job.leadIds[0])).company.name).toBe("Brand New Heating");
  });

  it("adding an opt-out suppresses matching leads at once", async () => {
    const admin = await signedIn("rinor@atlas.test");
    const { rows } = await admin.listLeads(ALL);
    const victim = rows.find((r) => r.company.phone)!;
    await admin.addSuppression(victim.company.phone!, "do_not_call");
    const detail = await admin.getLead(victim.lead.id);
    expect(detail.lead.suppressed).toBe(true);
    expect(detail.lead.excluded).toBe(true);
  });
});

describe("leads URL filters", () => {
  it("round-trips through the URL and keeps defaults out of it", () => {
    const q = parseLeadQuery(new URLSearchParams(""));
    expect(q.tiers).toEqual(["A", "B"]);
    expect(serializeLeadQuery(q).toString()).toBe("");
    const custom = { ...q, tiers: [] as LeadQuery["tiers"], countries: ["GB", "CH"], q: "homes", page: 3 };
    expect(parseLeadQuery(serializeLeadQuery(custom))).toEqual(custom);
  });
});
