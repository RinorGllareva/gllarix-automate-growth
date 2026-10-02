import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import { generateLeadSeed } from "@/data/demo/leadSeed";
import type { Branding, EmailMessage, Inbox } from "@/data/emailTypes";
import type { Contact } from "@/data/leadTypes";
import { openSlots, slugFor } from "@/services/booking";
import { inboxCapToday, planSends, type SendContext } from "@/services/emailSender";
import { renderTemplate, unfinishedParts, validateTemplate } from "@/services/templates";

// Thu 1 Oct 2026, 14:00 UTC = 10:00 ET, 07:00 PT, 15:00 UK, 16:00 CH.
const NOW = Date.UTC(2026, 9, 1, 14, 0);
const PW = "pw";
const BRANDING: Branding = { footerAddress: "Gllarix, 1 Example Street, Prishtina 10000, Kosovo", demoNumber: "+1 555 0100" };

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

describe("templates", () => {
  it("fills variables and flags missing values and unwritten placeholders", () => {
    expect(renderTemplate("Hi {{contact.first_name}} at {{company.name}}", { "contact.first_name": "Ana", "company.name": "Bluewater" })).toBe("Hi Ana at Bluewater");
    const r = renderTemplate("Call {{demo_number}} [TO WRITE: case study]", {});
    expect(unfinishedParts(r)).toEqual(['Template still has "[TO WRITE: case study]"', "No value for demo_number"]);
  });

  it("can't save a template without the unsubscribe link or with unknown variables", () => {
    expect(validateTemplate("Hi", "Body")).toContain("Every template needs the {{unsubscribe_url}} variable.");
    expect(validateTemplate("Hi {{nope}}", "x {{unsubscribe_url}}").join(" ")).toMatch(/Unknown variable: {{nope}}/);
    expect(validateTemplate("Hi", "x {{unsubscribe_url}}")).toEqual([]);
  });
});

describe("sender decisions (planSends)", () => {
  const seed = generateLeadSeed(new Date(NOW));
  const contactsByCompany = new Map<string, Contact[]>();
  seed.contacts.forEach((c) => contactsByCompany.set(c.companyId, [...(contactsByCompany.get(c.companyId) ?? []), c]));
  const inbox: Inbox = { id: "ib", address: "a@outreach.test", brand: "gllarix", senderName: "A", dailyCap: 3, warmupStart: 3, warmupStep: 0, warmupStartedAt: new Date(NOW).toISOString(), active: true };
  const arcInbox: Inbox = { ...inbox, id: "ib-a", brand: "arcadian", dailyCap: 50, warmupStart: 50 };
  const ctx = (over: Partial<SendContext> = {}): SendContext => ({
    now: NOW,
    leads: new Map(seed.leads.map((l) => [l.id, { ...l, suppressed: false }])),
    companies: new Map(seed.companies.map((c) => [c.id, c])),
    contactsByCompany,
    activitiesByLead: new Map(),
    suppression: [],
    inboxes: [inbox, arcInbox],
    sentToday: new Map(),
    lastColdEmail: new Map(),
    branding: BRANDING,
    ...over,
  });
  const leadIn = (country: string, tzPrefix?: string) =>
    seed.leads.find((l) => {
      const c = seed.companies.find((x) => x.id === l.companyId)!;
      return c.country === country && (!tzPrefix || c.timezone?.startsWith(tzPrefix)) && l.stage === "new" && seed.contacts.find((x) => x.id === l.primaryContactId)?.email;
    })!;
  const msg = (leadId: string, over: Partial<EmailMessage> = {}): EmailMessage => ({
    id: `m-${leadId}-${Math.random()}`,
    leadId,
    ownerId: null,
    meetingId: null,
    kind: "cadence",
    templateKey: "x",
    step: "1:email",
    to: seed.contacts.find((c) => c.id === seed.leads.find((l) => l.id === leadId)!.primaryContactId)!.email,
    subject: "Hello",
    body: "Body",
    transactional: false,
    status: "queued",
    reason: null,
    notBefore: null,
    inboxId: null,
    threadId: null,
    queuedAt: new Date(NOW).toISOString(),
    sentAt: null,
    repliedAt: null,
    replySnippet: null,
    unsubscribedAt: null,
    ...over,
  });

  it("sends cold email only where the country allows it", () => {
    const us = leadIn("US", "America/New_York");
    const ch = leadIn("CH");
    const [usD, chD] = planSends([msg(us.id), msg(ch.id)], ctx());
    expect(usD.action).toBe("send");
    expect(chD).toMatchObject({ action: "block" });
    expect((chD as { reason: string }).reason).toMatch(/Cold email isn't allowed in CH/);
  });

  it("transactional email (booking confirmation) skips cold-email country rules but never the opt-out list", () => {
    const ch = leadIn("CH");
    expect(planSends([msg(ch.id, { transactional: true, kind: "booking_confirmation" })], ctx())[0].action).toBe("send");
    const m = msg(ch.id, { transactional: true });
    expect(planSends([m], ctx({ suppression: [{ id: "s", type: "email", value: m.to!, reason: "opt_out", source: "unsubscribe", addedBy: null, createdAt: "" }] }))[0].action).toBe("block");
  });

  it("respects each inbox's daily cap and spreads across inboxes", () => {
    const usLeads = seed.leads.filter((l) => l.stage === "new" && seed.companies.find((c) => c.id === l.companyId)?.timezone === "America/New_York" && seed.contacts.find((x) => x.id === l.primaryContactId)?.email).slice(0, 5);
    const d = planSends(usLeads.map((l) => msg(l.id)), ctx());
    expect(d.filter((x) => x.action === "send")).toHaveLength(3);
    expect(d.filter((x) => x.action === "defer").every((x) => (x as { reason: string }).reason.includes("cap"))).toBe(true);
  });

  it("waits for the lead-local send window, the footer address and the 3-day gap", () => {
    const west = leadIn("US", "America/Los_Angeles"); // 07:00 PT, window opens 08:00
    expect(planSends([msg(west.id)], ctx())[0]).toMatchObject({ action: "defer" });
    const east = leadIn("US", "America/New_York");
    expect((planSends([msg(east.id)], ctx({ branding: { ...BRANDING, footerAddress: "" } }))[0] as { reason: string }).reason).toMatch(/footer/);
    expect((planSends([msg(east.id)], ctx({ lastColdEmail: new Map([[east.id, new Date(NOW - 86_400_000).toISOString()]]) }))[0] as { reason: string }).reason).toMatch(/3 days/);
    expect((planSends([msg(east.id, { body: "x [TO WRITE: link]" })], ctx())[0] as { reason: string }).reason).toMatch(/TO WRITE/);
  });

  it("cancels cold email once the lead replied or booked", () => {
    const east = leadIn("US", "America/New_York");
    const leads = ctx().leads;
    leads.set(east.id, { ...leads.get(east.id)!, stage: "replied" });
    expect(planSends([msg(east.id)], ctx({ leads }))[0]).toMatchObject({ action: "cancel" });
  });

  it("warm-up raises the cap day by day up to the inbox's daily cap", () => {
    const i = { ...inbox, dailyCap: 40, warmupStart: 10, warmupStep: 5, warmupStartedAt: new Date(NOW - 3 * 86_400_000).toISOString() };
    expect(inboxCapToday(i, NOW)).toBe(25);
    expect(inboxCapToday({ ...i, warmupStartedAt: new Date(NOW - 30 * 86_400_000).toISOString() }, NOW)).toBe(40);
  });
});

describe("M5 done-when: a cadence sends only where allowed, within caps, and stops on reply or unsubscribe", () => {
  it("end to end in one store: send, cap, reply stops the cadence, unsubscribe stops everything", async () => {
    const storage = new MemoryStorage();
    const src = createDemoSource({ password: PW, persistLeads: false, now: () => NOW, storage });
    await src.signInWithPassword("rinor@atlas.test", PW);
    await src.saveBranding(BRANDING);
    await src.signInWithPassword("diego@atlas.test", PW);
    const view = (await src.getQueue())!;
    const emailItems = view.queue.items.filter((i) => i.channel === "email");
    expect(emailItems.length).toBeGreaterThan(0);

    const run = await src.runSender(); // the job sends for everyone's queue, not just the BDR's
    expect((await src.outbox()).every((m) => m.ownerId === "u-bdr")).toBe(true); // the BDR sees only their own
    await src.signInWithPassword("rinor@atlas.test", PW);
    const sent = (await src.outbox()).filter((m) => m.status === "sent");
    expect(run.sent).toBe(sent.length);
    // Never over an inbox's cap.
    for (const i of await src.inboxes()) expect(i.sentToday).toBeLessThanOrEqual(i.capToday);
    // Only to markets that allow cold email (the BDR's trades leads are US).
    for (const m of sent.filter((x) => !x.transactional)) {
      const lead = await src.getLead(m.leadId);
      // CH, DE and AT forbid cold email; GB and CA are conditional (corporate / published addresses).
      expect(["CH", "DE", "AT"]).not.toContain(lead.company.country);
    }
    const first = sent.find((m) => !m.transactional && !/\[TO WRITE/.test(m.body))!;
    expect(first.body).toContain(BRANDING.footerAddress);
    expect(first.body).toContain(`/u/${first.id}`);
    expect((await src.getLead(first.leadId)).activities.some((a) => a.title.startsWith("Email sent"))).toBe(true);

    // Reply → stage Replied, cadence stopped, cold emails cancelled, follow-up call scheduled.
    await src.simulateReply(first.id, "Yes, call me Thursday");
    expect((await src.runSender()).replies).toBe(1);
    const replied = await src.getLead(first.leadId);
    expect(replied.lead).toMatchObject({ stage: "replied", cadenceId: null, nextActionType: "follow_up" });
    expect((await src.outbox({ leadId: first.leadId })).filter((m) => m.status === "queued" && !m.transactional)).toHaveLength(0);

    // Unsubscribe (public, no session) → opt-out list, lead suppressed, nothing more queued.
    const other = sent.find((m) => m.leadId !== first.leadId)!;
    await src.signOut();
    const res = await src.unsubscribe(other.id);
    expect(res).toMatchObject({ ok: true, email: other.to });
    await src.signInWithPassword("rinor@atlas.test", PW);
    expect((await src.listSuppression()).some((s) => s.type === "email" && s.value === other.to)).toBe(true);
    const unsubLead = await src.getLead(other.leadId);
    expect(unsubLead.lead.suppressed).toBe(true);
    const composed = await src.composeEmail(other.leadId, { templateKey: "trades_breakup" });
    await src.runSender();
    expect((await src.outbox({ leadId: other.leadId })).find((m) => m.id === composed.id)!.status).toBe("blocked");
  });
});

describe("booking page (O6)", () => {
  it("offers 30-minute slots inside the owner's shift, at least 2 hours ahead, avoiding existing meetings", () => {
    const meeting = { id: "m", leadId: "l", bookedBy: "u", ownerId: "u", scheduledAt: new Date(Date.UTC(2026, 9, 2, 14, 0)).toISOString(), withWhom: "x", type: "video" as const, attended: null, approved: null, createdAt: "" };
    const slots = openSlots({ tz: "America/Caracas", shift: "08:00-16:00", now: NOW, meetings: [meeting] });
    expect(slots.length).toBeGreaterThan(40);
    expect(slots.every((s) => new Date(s.start).getTime() >= NOW + 2 * 3_600_000)).toBe(true);
    expect(slots.some((s) => s.start === meeting.scheduledAt)).toBe(false);
    expect(slugFor("Diego Marín")).toBe("diego");
  });

  it("booking creates the lead, meeting, deal, confirmation and reminders; the slot can't be booked twice", async () => {
    const storage = new MemoryStorage();
    const src = createDemoSource({ password: PW, persistLeads: false, now: () => NOW, storage });
    const page = (await src.bookingPage("diego"))!;
    expect(page.ownerName).toBe("Diego");
    const start = page.slots.find((x) => new Date(x.start).getTime() > NOW + 26 * 3_600_000)!.start;
    const r = await src.book({ slug: "diego", start, name: "Ana Pérez", email: "ana@newroofing.example", company: "New Roofing Co", phone: "+1 404 555 0177", country: "US" });
    expect(r.meetingAt).toBe(start);
    await expect(src.book({ slug: "diego", start, name: "X", email: "x@y.example", company: "Y" })).rejects.toThrow(/just taken/);

    await src.signInWithPassword("rinor@atlas.test", PW);
    const week = await src.listMeetings();
    const booked = week.rows.find((m) => m.company.name === "New Roofing Co")!;
    expect(booked.lead.lawfulBasis).toMatch(/Consent/);
    const mails = await src.outbox({ leadId: booked.lead.id });
    expect(mails.map((m) => m.kind).sort()).toEqual(["booking_confirmation", "reminder_1h", "reminder_24h"]);
    expect(mails.find((m) => m.kind === "reminder_1h")!.notBefore).toBe(new Date(new Date(start).getTime() - 3_600_000).toISOString());
    const deal = (await src.pipeline({ brand: "both", ownerId: "all", allWon: false })).find((d) => d.lead.id === booked.lead.id);
    expect(deal?.deal.stage).toBe("meeting_booked");
  });

  it("an unknown booking page returns nothing", async () => {
    const src = createDemoSource({ password: PW, persistLeads: false, now: () => NOW, storage: new MemoryStorage() });
    expect(await src.bookingPage("nobody")).toBeNull();
  });
});
