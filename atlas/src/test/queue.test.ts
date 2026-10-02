import { describe, expect, it } from "vitest";
import { DISPOSITIONS } from "@/config/dispositions";
import { createDemoSource } from "@/data/demo/demoSource";
import { generateLeadSeed } from "@/data/demo/leadSeed";
import type { Company, Contact, Lead } from "@/data/leadTypes";
import type { User } from "@/data/types";
import { canContact } from "@/services/compliance";
import { planOutcome } from "@/services/outcomes";
import { buildQueue } from "@/services/queue";
import { addBusinessDays, businessDaysBetween, localDateKey, localHHMM, zonedToUtc } from "@/services/time";

// Thu 1 Oct 2026, 12:30 UTC = 08:30 in Caracas (BDR shift 08:00–16:00) and 08:30 ET.
const NOW = Date.UTC(2026, 9, 1, 12, 30);
const PW = "pw";

const asUser = async (email: string, now = () => NOW) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now });
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
  return src;
};

describe("time maths", () => {
  it("converts lead-local wall clock to UTC across daylight saving", () => {
    // New York: EDT (UTC-4) before 1 Nov 2026, EST (UTC-5) after.
    expect(new Date(zonedToUtc("2026-10-30", "07:00", "America/New_York")).toISOString()).toBe("2026-10-30T11:00:00.000Z");
    expect(new Date(zonedToUtc("2026-11-02", "07:00", "America/New_York")).toISOString()).toBe("2026-11-02T12:00:00.000Z");
    // Phoenix never shifts.
    expect(localHHMM(Date.UTC(2026, 6, 1, 15, 0), "America/Phoenix")).toBe("08:00");
    expect(localHHMM(Date.UTC(2026, 11, 1, 15, 0), "America/Phoenix")).toBe("08:00");
  });

  it("counts business days", () => {
    expect(addBusinessDays("2026-10-02", 1)).toBe("2026-10-05"); // Fri → Mon
    expect(addBusinessDays("2026-10-03", 0)).toBe("2026-10-05"); // Sat rolls to Mon
    expect(businessDaysBetween("2026-10-01", "2026-10-08")).toBe(5);
  });
});

describe("compliance.can_contact", () => {
  const seed = generateLeadSeed(new Date(NOW));
  const lead = seed.leads.find((l) => l.listType === "trades" && l.stage === "new")!;
  const company = seed.companies.find((c) => c.id === lead.companyId)!;
  const contacts = seed.contacts.filter((c) => c.companyId === company.id);
  const base = { lead, company, contacts, contact: contacts[0], channel: "call" as const, suppression: [], activities: [] };
  const at = (hhmm: string) => zonedToUtc(localDateKey(NOW, company.timezone!), hhmm, company.timezone!);

  it("allows a call inside calling hours and explains why", () => {
    const r = canContact({ ...base, at: at("08:30") });
    expect(r.allowed).toBe(true);
    expect(r.reasons.join(" ")).toMatch(/dialed by hand.*inside calling hours.*not on the opt-out list/);
  });

  it("blocks outside calling hours, on the opt-out list, and in no-call markets", () => {
    expect(canContact({ ...base, at: at("06:30") }).reasons[0]).toMatch(/Outside calling hours/);
    expect(canContact({ ...base, at: at("08:30"), suppression: [{ id: "s", type: "phone", value: company.phone!, reason: "opt_out", source: "manual", addedBy: null, createdAt: "" }] }).allowed).toBe(false);
    expect(canContact({ ...base, company: { ...company, country: "DE" }, at: at("08:30") }).reasons.join(" ")).toMatch(/Cold calls aren't allowed/);
  });

  it("blocks after 3 attempts in 10 business days", () => {
    const calls = [1, 2, 3].map((d) => ({ id: `a${d}`, leadId: lead.id, userId: null, type: "call" as const, title: "", detail: null, disposition: "No answer", durationS: 0, at: new Date(NOW - d * 86_400_000).toISOString() }));
    expect(canContact({ ...base, activities: calls, at: at("08:30") }).reasons.join(" ")).toMatch(/3 call attempts/);
  });
});

describe("queue builder (A9)", () => {
  const seed = generateLeadSeed(new Date(NOW));
  const companies = new Map(seed.companies.map((c) => [c.id, c]));
  const contactsByCompany = new Map<string, Contact[]>();
  seed.contacts.forEach((c) => contactsByCompany.set(c.companyId, [...(contactsByCompany.get(c.companyId) ?? []), c]));
  const activitiesByLead = new Map<string, typeof seed.activities>();
  seed.activities.filter((a) => a.type === "call").forEach((a) => activitiesByLead.set(a.leadId, [...(activitiesByLead.get(a.leadId) ?? []), a]));
  const bdr: User = { id: "u-bdr", name: "Diego Marín", email: "diego@atlas.test", role: "bdr", timezone: "America/Caracas", dailyCapacity: 150, active: true };
  const build = (owner: User, leads: Lead[] = seed.leads) => buildQueue({ owner, now: NOW, leads, companies, contactsByCompany, activitiesByLead, suppression: seed.suppression });

  it("fills the BDR's 150-item queue in under 5 s with only allowed, A/B leads they own", () => {
    const q = build(bdr);
    expect(q.items.length).toBe(150);
    // Calls lead; emails ride along (at most 25%).
    expect(q.summary.byChannel.email).toBeLessThanOrEqual(37);
    expect(q.summary.byChannel.call).toBeGreaterThan(q.summary.byChannel.email);
    expect(q.summary.buildMs).toBeLessThan(5000);
    const leads = new Map(seed.leads.map((l) => [l.id, l]));
    for (const item of q.items) {
      const lead = leads.get(item.leadId)!;
      expect(lead.ownerId).toBe("u-bdr");
      expect(["A", "B"]).toContain(lead.tier);
      expect(lead.suppressed).toBe(false);
    }
  });

  it("orders calls by window start, rolling west, with A-tier first inside each window", () => {
    const calls = build(bdr).items.filter((i) => i.channel === "call" && i.kind !== "callback");
    for (let i = 1; i < calls.length; i += 1) expect(calls[i].windowStartAt! >= calls[i - 1].windowStartAt!).toBe(true);
    const leads = new Map(seed.leads.map((l) => [l.id, l]));
    const groups = new Map<string, string[]>();
    calls.forEach((c) => groups.set(c.windowStartAt!, [...(groups.get(c.windowStartAt!) ?? []), leads.get(c.leadId)!.tier]));
    for (const tiers of groups.values()) expect(tiers.join("")).toMatch(/^A*B*$/);
  });

  it("never queues a call outside the lead's calling hours", () => {
    for (const item of build(bdr).items.filter((i) => i.channel === "call")) {
      const tz = companies.get(seed.leads.find((l) => l.id === item.leadId)!.companyId)!.timezone!;
      const local = localHHMM(new Date(item.windowStartAt!), tz);
      expect(local >= "07:00" && local < "21:00").toBe(true);
    }
  });

  it("reports a shortfall when there aren't enough leads", () => {
    const few = seed.leads.filter((l) => l.ownerId === "u-bdr").slice(0, 40);
    const q = build(bdr, few);
    expect(q.summary.shortfall).toBe(150 - q.items.length);
    expect(q.summary.shortfall).toBeGreaterThan(100);
  });
});

describe("outcomes (A7): each creates exactly its next action", () => {
  const seed = generateLeadSeed(new Date(NOW));
  const lead: Lead = { ...seed.leads.find((l) => l.listType === "trades" && l.stage === "new")!, cadenceStartedAt: null, attemptsCount: 0 };
  const company: Company = seed.companies.find((c) => c.id === lead.companyId)!;
  const tz = company.timezone!;
  const plan = (disposition: (typeof DISPOSITIONS)[number]["key"], extra = {}) =>
    planOutcome(lead, company, { leadId: lead.id, disposition, notes: "", durationS: 30, recordingUrl: null, ...extra }, NOW);

  it("no answer → +1 attempt, day-3 call per the trades cadence at the morning window", () => {
    const p = plan("no_answer");
    expect(p.attemptsCount).toBe(1);
    expect(p.nextActionType).toBe("call");
    expect(localDateKey(new Date(p.nextActionAt!), tz)).toBe(addBusinessDays(localDateKey(NOW, tz), 2));
    expect(localHHMM(new Date(p.nextActionAt!), tz)).toBe("07:00");
    expect(p.stage).toBe("contacted");
  });

  it("gatekeeper → next business day, in the other window", () => {
    const p = plan("gatekeeper", { gatekeeperName: "Pam" });
    expect(localDateKey(new Date(p.nextActionAt!), tz)).toBe(addBusinessDays(localDateKey(NOW, tz), 1));
    expect(localHHMM(new Date(p.nextActionAt!), tz)).toBe("16:00");
  });

  it("wrong number, not interested, call back, send info, meeting, do not contact", () => {
    expect(plan("wrong_number")).toMatchObject({ phoneInvalid: true, nextActionType: "re_enrich" });
    const ni = plan("not_interested");
    expect(ni).toMatchObject({ stage: "nurture", nextActionType: "email" });
    expect(Math.round((new Date(ni.nextActionAt!).getTime() - NOW) / 86_400_000)).toBe(90);
    const at = new Date(NOW + 3 * 3_600_000).toISOString();
    expect(plan("call_back", { callbackAt: at })).toMatchObject({ nextActionType: "callback", nextActionAt: at });
    const si = plan("send_info");
    expect(si.nextActionType).toBe("call");
    expect(localDateKey(new Date(si.nextActionAt!), tz)).toBe(addBusinessDays(localDateKey(NOW, tz), 2));
    expect(si.extraActivities[0].type).toBe("email");
    const meetingAt = new Date(NOW + 2 * 86_400_000).toISOString();
    expect(plan("meeting_booked", { meeting: { at: meetingAt, withWhom: "Owner", type: "video" } })).toMatchObject({ stage: "meeting_booked", nextActionType: "meeting" });
    expect(plan("do_not_contact")).toMatchObject({ stage: "lost", suppress: true, nextActionAt: null });
  });

  it("finishing the cadence moves the lead to nurture", () => {
    const p = planOutcome({ ...lead, attemptsCount: 2, cadenceStartedAt: new Date(NOW - 6 * 86_400_000).toISOString() }, company, { leadId: lead.id, disposition: "no_answer", notes: "", durationS: 0, recordingUrl: null }, NOW);
    expect(p).toMatchObject({ stage: "nurture", nextActionType: "email" });
  });

  it("rejects a callback in the past", () => {
    expect(() => plan("call_back", { callbackAt: new Date(NOW - 60_000).toISOString() })).toThrow(/future/);
  });
});

describe("working the queue (M3 done-when)", () => {
  it("lets the BDR work 20 leads in a row, each outcome well under 5 s, with correct next actions and KPIs", async () => {
    const bdr = await asUser("diego@atlas.test");
    const view = (await bdr.getQueue())!;
    expect(view.queue.items).toHaveLength(150);
    const keys = ["no_answer", "voicemail", "gatekeeper", "send_info", "not_interested"] as const;
    for (let i = 0; i < 20; i += 1) {
      const ctx = (await bdr.callContext())!;
      expect(ctx.compliance.allowed).toBe(true);
      const t0 = performance.now();
      const out = await bdr.logOutcome({ leadId: ctx.detail.lead.id, disposition: keys[i % keys.length], notes: `note ${i}`, durationS: 20, recordingUrl: null });
      expect(performance.now() - t0).toBeLessThan(5000);
      expect(out.message).toBeTruthy();
      const after = await bdr.getLead(ctx.detail.lead.id);
      expect(after.lead.nextActionAt).not.toBeNull();
      expect(after.activities[0].title).toMatch(/^(Call|Stage|Info email)/);
    }
    const after = (await bdr.getQueue())!;
    expect(after.done).toBe(20);
    const stats = await bdr.todayStats();
    expect(stats.dials).toBeGreaterThanOrEqual(20);
  });

  it("do not contact removes the lead from every queue at once and opt-outs it", async () => {
    const bdr = await asUser("diego@atlas.test");
    await bdr.getQueue();
    const ctx = (await bdr.callContext())!;
    await bdr.logOutcome({ leadId: ctx.detail.lead.id, disposition: "do_not_contact", notes: "", durationS: 10, recordingUrl: null });
    const q = (await bdr.getQueue())!;
    expect(q.queue.items.filter((i) => i.leadId === ctx.detail.lead.id && i.status === "open")).toHaveLength(0);
    const detail = await bdr.getLead(ctx.detail.lead.id);
    expect(detail.lead).toMatchObject({ stage: "lost", suppressed: true });
    const rebuilt = await bdr.buildQueue();
    expect(rebuilt.queue.items.some((i) => i.leadId === ctx.detail.lead.id && i.status === "open")).toBe(false);
  });

  it("keeps draft notes when switching leads", async () => {
    const bdr = await asUser("diego@atlas.test");
    await bdr.getQueue();
    const ctx = (await bdr.callContext())!;
    await bdr.saveCallNotes(ctx.detail.lead.id, "Misses ~15 calls a week");
    const again = await bdr.callContext(ctx.detail.lead.id);
    expect(again!.draftNotes).toBe("Misses ~15 calls a week");
  });

  it("meeting booked notifies admins and counts toward this week", async () => {
    const bdr = await asUser("diego@atlas.test");
    await bdr.getQueue();
    const ctx = (await bdr.callContext())!;
    const before = (await bdr.todayStats()).meetingsBookedWeek;
    await bdr.logOutcome({ leadId: ctx.detail.lead.id, disposition: "meeting_booked", notes: "", durationS: 240, recordingUrl: "fake", meeting: { at: new Date(NOW + 86_400_000).toISOString(), withWhom: "Owner", type: "video" } });
    expect((await bdr.todayStats()).meetingsBookedWeek).toBe(before + 1);
    expect((await bdr.listNotifications("u-rinor")).some((n) => n.type === "meeting_booked" && n.text.includes(ctx.detail.company.name))).toBe(true);
  });

  it("viewers and implementers can't open the call workspace", async () => {
    const viewer = await asUser("books@atlas.test");
    await expect(viewer.callContext()).rejects.toMatchObject({ status: 403 });
    expect(await viewer.getQueue()).toBeNull();
  });
});
