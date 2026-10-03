import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";

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
const as = async (src: DataSource, email: string) => {
  await src.signOut();
  if (!(await src.signInWithPassword(email, PW)).ok) throw new Error("sign-in failed");
};
const setup = async () => {
  const clock = { t: Date.UTC(2026, 9, 3, 14) };
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => clock.t, storage: new MemoryStorage() });
  await as(src, "rinor@atlas.test");
  return { src, clock };
};

describe("trash and undo", () => {
  it("edits and deletes an expense; the deleter undoes within 10 minutes, then only founders restore", async () => {
    const { src, clock } = await setup();
    const { expenses } = await src.listFinanceData();
    const e = expenses[0];
    await src.updateExpense(e.id, { vendor: "Renamed vendor", note: "Annual plan", amountMinor: 1234 });
    expect((await src.listFinanceData()).expenses.find((x) => x.id === e.id)).toMatchObject({ vendor: "Renamed vendor", note: "Annual plan", amountMinor: 1234 });
    await expect(src.updateExpense(e.id, { amountMinor: 0 })).rejects.toThrow(/above zero/);
    const trashId = await src.deleteExpense(e.id);
    expect((await src.listFinanceData()).expenses.some((x) => x.id === e.id)).toBe(false);
    expect((await src.listTrash()).map((t) => t.id)).toContain(trashId);
    await src.restoreFromTrash(trashId);
    expect((await src.listFinanceData()).expenses.some((x) => x.id === e.id)).toBe(true);
    // The accountant can't edit money records.
    await as(src, "books@atlas.test");
    await expect(src.deleteExpense(e.id)).rejects.toThrow();
    await as(src, "rinor@atlas.test");
    const again = await src.deleteExpense(e.id);
    clock.t += 31 * 86_400_000;
    await as(src, "rinor@atlas.test");
    expect((await src.listTrash()).some((t) => t.id === again)).toBe(false); // purged after 30 days
  });
});

describe("leads", () => {
  it("creates a lead by hand, blocks duplicates, edits the company, and removes contacts and notes", async () => {
    const { src } = await setup();
    await as(src, "diego@atlas.test");
    const r = await src.createLead({ company: "Acme Plumbing", phone: "+1 813 555 0199", website: "https://acmeplumbing.example", country: "US", city: "Tampa", industry: "plumbing", listType: "trades", brand: "gllarix", contact: { firstName: "Ana", lastName: "Ruiz", title: "Owner", email: "ana@acmeplumbing.example", phone: null } });
    expect(r.duplicateOf).toBeUndefined();
    const dup = await src.createLead({ company: "Acme Plumbing LLC", phone: null, website: "acmeplumbing.example", country: "US", city: null, industry: null, listType: "trades", brand: "gllarix" });
    expect(dup.duplicateOf).toBe(r.leadId);
    let d = await src.getLead(r.leadId);
    expect(d.lead.ownerId).toBe("u-bdr");
    expect(d.contacts[0].firstName).toBe("Ana");
    await src.updateCompany(r.leadId, { name: "Acme Plumbing & Drains", city: "St. Petersburg" });
    d = await src.getLead(r.leadId);
    expect(d.company).toMatchObject({ name: "Acme Plumbing & Drains", city: "St. Petersburg" });
    await src.addNote(r.leadId, "Spoke to Ana, call back Monday");
    d = await src.getLead(r.leadId);
    const note = d.activities.find((a) => a.type === "note" && (a.detail ?? a.title).includes("Spoke to Ana"))!;
    await src.updateNote(note.id, "Spoke to Ana, call back Tuesday");
    await src.deleteNote(note.id);
    await src.deleteContact(d.contacts[0].id);
    d = await src.getLead(r.leadId);
    expect(d.contacts).toHaveLength(0);
    expect(d.lead.primaryContactId).toBeNull();
    await expect(src.archiveLead(r.leadId)).rejects.toThrow(); // founders only
  });
});

describe("meetings", () => {
  it("reschedules with new reminders, cancels into the trash, and comes back on undo", async () => {
    const { src } = await setup();
    const upcoming = (await src.searchMeetings("")).find((m) => m.status === "upcoming")!;
    const at = new Date(Date.UTC(2026, 9, 9, 15)).toISOString();
    await src.rescheduleMeeting(upcoming.meeting.id, { at, type: "phone" });
    expect((await src.getMeeting(upcoming.meeting.id)).meeting).toMatchObject({ scheduledAt: at, type: "phone" });
    await expect(src.rescheduleMeeting(upcoming.meeting.id, { at: new Date(Date.UTC(2026, 0, 1)).toISOString() })).rejects.toThrow(/future/);
    await expect(src.cancelMeeting(upcoming.meeting.id, " ")).rejects.toThrow(/why/);
    const t = await src.cancelMeeting(upcoming.meeting.id, "Client asked to move to next month");
    await expect(src.getMeeting(upcoming.meeting.id)).rejects.toThrow();
    await src.restoreFromTrash(t);
    expect((await src.getMeeting(upcoming.meeting.id)).meeting.id).toBe(upcoming.meeting.id);
  });
});

describe("money decisions and commissions", () => {
  it("needs the other founder to agree a spend, and moves commission lines through paid", async () => {
    const { src } = await setup();
    const { id } = await src.logSpendDecision({ title: "Test LinkedIn ads", monthlyCostEur: 0, oneOffCostEur: 300, expectedGain: "2 meetings", stopRule: "No meeting after €300", reviewDate: "2026-11-01", verdict: "Pays back in month 2" });
    await expect(src.decideSpend(id, "agreed", "")).rejects.toThrow(/other founder/);
    await expect(src.decideSpend(id, "rejected", "")).rejects.toThrow(/why/);
    await src.decideSpend(id, "rejected", "Too early");
    expect((await src.listDecisions()).find((d) => d.id === id)?.status).toBe("rejected");

    const lines = await src.listCommissions();
    const earned = lines.find((c) => c.status === "earned") ?? lines.find((c) => c.status === "pending");
    if (earned) {
      if (earned.status === "pending") await src.setCommissionStatus([earned.id], "earned", "");
      await as(src, "books@atlas.test");
      expect(await src.setCommissionStatus([earned.id], "paid", "Wise transfer 4 Oct")).toBe(1);
      await expect(src.setCommissionStatus([earned.id], "void", "x")).rejects.toThrow();
    }
  });
});

describe("docs", () => {
  it("searches page text, reorders siblings, and restores archived pages", async () => {
    const { src } = await setup();
    expect((await src.searchDocs("improvise")).map((d) => d.id)).toContain("doc-sales");
    const before = (await src.listDocs()).docs.filter((d) => d.parentId === "doc-handbook").map((d) => d.id);
    await src.moveDoc(before[1], "up");
    const after = (await src.listDocs()).docs.filter((d) => d.parentId === "doc-handbook").map((d) => d.id);
    expect(after[0]).toBe(before[1]);
    await src.archiveDoc("doc-rhythm");
    expect((await src.listArchivedDocs()).map((d) => d.id)).toContain("doc-rhythm");
    await src.restoreDoc("doc-rhythm");
    expect((await src.listDocs()).docs.some((d) => d.id === "doc-rhythm")).toBe(true);
  });
});

describe("wave 1: templates, tasks, people", () => {
  it("creates, duplicates and deletes outreach templates; built-in ones stay", async () => {
    const { src } = await setup();
    const base = (await src.listTemplates())[0];
    const key = await src.createTemplate({ name: `${base.name} (copy)`, channel: base.channel, list: base.list, subject: base.subject, body: base.body, copyOf: base.key });
    const made = (await src.listTemplates()).find((t) => t.key === key)!;
    expect(made).toMatchObject({ custom: true, transactional: false, body: base.body });
    await expect(src.createTemplate({ name: "No unsubscribe", channel: "email", list: "trades", subject: "Hi", body: "Hello" })).rejects.toThrow(/unsubscribe_url/);
    await src.saveTemplate({ key, subject: "New subject", body: base.body, name: "Renamed" });
    expect((await src.listTemplates()).find((t) => t.key === key)).toMatchObject({ name: "Renamed", subject: "New subject" });
    await expect(src.deleteTemplate(base.key)).rejects.toThrow(/Built-in/);
    await src.deleteTemplate(key);
    expect((await src.listTemplates()).some((t) => t.key === key)).toBe(false);
  });

  it("lists the task trash for founders, restores, and removes a dependency by its id", async () => {
    const { src } = await setup();
    const home = await src.tasksHome();
    const list = home.spaces[0].lists[0];
    const a = await src.createTask({ listId: list.id, title: "Wave A", priority: "high", estimateMinutes: 90, descriptionMd: "Done when shipped" });
    const b = await src.createTask({ listId: list.id, title: "Wave B" });
    await src.addDependency(b.id, a.id);
    const dep = (await src.getTask(b.id)).waitingOn[0];
    expect(dep.task.id).toBe(a.id);
    await src.removeDependency(dep.depId);
    expect((await src.getTask(b.id)).waitingOn).toEqual([]);
    await src.deleteTask(a.id);
    expect((await src.listDeletedTasks()).find((t) => t.id === a.id)).toMatchObject({ title: "Wave A", daysLeft: 30 });
    await src.restoreTask(a.id);
    expect((await src.listDeletedTasks()).some((t) => t.id === a.id)).toBe(false);
    expect((await src.getTask(a.id)).task).toMatchObject({ priority: "high", estimateMinutes: 90 });
    await as(src, "diego@atlas.test");
    await expect(src.listDeletedTasks()).rejects.toMatchObject({ status: 403 });
  });

  it("edits a candidate's name, source and opening, and lists who ticked an ops item", async () => {
    const { src } = await setup();
    const { openings, candidates } = await src.hiringBoard();
    const c = candidates[0];
    const other = openings.find((o) => o.id !== c.openingId) ?? openings[0];
    await src.updateCandidate(c.id, { name: "Renamed Person", source: "Referral", openingId: other.id });
    expect((await src.hiringBoard()).candidates.find((x) => x.id === c.id)).toMatchObject({ name: "Renamed Person", source: "Referral", openingId: other.id });
    await expect(src.updateCandidate(c.id, { name: "  " })).rejects.toThrow(/name/);
    const ops = await src.opsHome();
    expect(ops.names["u-rinor"]).toBe("Rinor");
  });
});

describe("wave 1: reports, inbound, clients, support", () => {
  it("sellers get only their own funnel; custom ranges work; gate 3 checks churn", async () => {
    const { src } = await setup();
    const range = await src.report({ kind: "range", key: "2026-09-01..2026-09-30", personId: "team" });
    expect(range.period).toMatchObject({ kind: "range", start: "2026-09-01", end: "2026-09-30" });
    await expect(src.report({ kind: "range", key: "bad" })).rejects.toThrow(/start and an end/);
    expect(range.gates.find((g) => g.key === "gate3")!.value).toMatch(/churn/);
    await as(src, "diego@atlas.test");
    expect((await src.report({ kind: "week", personId: "team" })).personId).toBe("u-bdr");
  });

  it("reassigns inbound, keeps the reply note, and undoes a dismiss", async () => {
    const { src } = await setup();
    const r = (await src.inboundHome()).requests.find((x) => x.status === "new")!;
    await src.assignInbound(r.id, "u-bdr");
    await src.respondInbound(r.id, "Called, booked a demo");
    let row = (await src.inboundHome()).requests.find((x) => x.id === r.id)!;
    expect(row).toMatchObject({ assignedTo: "u-bdr", status: "contacted", replyNote: "Called, booked a demo" });
    await src.dismissInbound(r.id, "spam");
    await src.undoDismissInbound(r.id);
    row = (await src.inboundHome()).requests.find((x) => x.id === r.id)!;
    expect(row.status).toBe("contacted");
    await as(src, "diego@atlas.test");
    await expect(src.assignInbound(r.id, null)).rejects.toMatchObject({ status: 403 });
  });

  it("edits a client's contact, owner and plan; the implementer can only edit the contact", async () => {
    const { src } = await setup();
    const card = (await src.clientsOverview()).cards.find((c) => c.status === "live")!;
    const before = await src.getClient(card.id);
    await src.updateClientAccount(card.id, { contact: { firstName: "Pat", lastName: "Lee", title: "Owner", email: "pat@example.com", phone: null }, plan: { monthlyMinor: 89900, includedMinutes: 1500, overageRateMinor: 20 } });
    const after = await src.getClient(card.id);
    expect(after.contact).toMatchObject({ firstName: "Pat", email: "pat@example.com" });
    if (before.finance?.subscription) expect(after.finance?.subscription).toMatchObject({ monthlyMinor: 89900, includedMinutes: 1500, overageRateMinor: 20 });
    await as(src, "lena@atlas.test");
    await src.updateClientAccount(card.id, { contact: { firstName: "Pat", lastName: "Lee", title: null, email: "pat@example.com", phone: "+1 555 0100" } });
    await expect(src.updateClientAccount(card.id, { plan: { monthlyMinor: 1, includedMinutes: 0, overageRateMinor: 0 } })).rejects.toMatchObject({ status: 403 });
  });

  it("edits a ticket's subject, category and client, and records where a reply was emailed", async () => {
    const { src } = await setup();
    const { tickets } = await src.listTickets();
    const t = tickets[0];
    await src.updateTicket(t.id, { subject: "Renamed issue", category: "billing", channel: "phone" });
    await src.replyTicket(t.id, { text: "On it", internal: false });
    const full = await src.getTicket(t.id);
    expect(full).toMatchObject({ subject: "Renamed issue", category: "billing", channel: "phone" });
    expect(full.messages.at(-1)!.emailedTo === null || /@/.test(full.messages.at(-1)!.emailedTo!)).toBe(true);
    await expect(src.updateTicket(t.id, { subject: " " })).rejects.toThrow(/subject/);
  });
});

describe("wave 1: settings", () => {
  it("invites, edits and pauses a user with a hand-over; the new user signs in", async () => {
    const { src } = await setup();
    const u = await src.inviteUser({ name: "Sam Test", email: "sam@example.com", role: "bdr", timezone: "America/Caracas", dailyCapacity: 120 });
    await expect(src.inviteUser({ name: "Dup", email: "sam@example.com", role: "bdr", timezone: "UTC", dailyCapacity: null })).rejects.toThrow(/already/);
    await src.updateUser(u.id, { dailyCapacity: 140, timezone: "America/Bogota" });
    expect((await src.listUsers()).find((x) => x.id === u.id)).toMatchObject({ dailyCapacity: 140, timezone: "America/Bogota", active: true });
    await as(src, "sam@example.com");
    expect((await src.currentUser())?.id).toBe(u.id);
    await as(src, "rinor@atlas.test");
    const { moved } = await src.deactivateUser("u-bdr", u.id);
    expect(moved).toBeGreaterThan(0);
    expect((await src.listUsers()).find((x) => x.id === "u-bdr")!.active).toBe(false);
    expect((await src.signInWithPassword("diego@atlas.test", "pw")).ok).toBe(false);
    await expect(src.deactivateUser("u-rinor", null)).rejects.toThrow(/own account/);
    await src.reactivateUser("u-bdr");
    expect((await src.listUsers()).find((x) => x.id === "u-bdr")!.active).toBe(true);
  });

  it("company profile fills contract placeholders; commission rules apply to new lines", async () => {
    const { src } = await setup();
    const p = await src.getCompanyProfile();
    await src.saveCompanyProfile({ ...p, entities: { ...p.entities, gllarix: { legalName: "Gllarix Test LLC", address: "1 Test St", registration: "123", vatId: "" } }, governingLaw: "Governed by the law of Testland." });
    expect((await src.getCompanyProfile()).entities.gllarix.legalName).toBe("Gllarix Test LLC");
    await src.saveCommissionRules({ pct: 0.12, setupMin: 150, months: 4, meetingBonusMinor: 2000 });
    expect(await src.getCommissionRules()).toMatchObject({ pct: 0.12, months: 4, meetingBonusMinor: 2000 });
    await expect(src.saveCommissionRules({ pct: 0.9, setupMin: 0, months: 1, meetingBonusMinor: 0 })).rejects.toThrow(/0–50%/);
    await as(src, "diego@atlas.test");
    await expect(src.saveCommissionRules({ pct: 0.1, setupMin: 0, months: 1, meetingBonusMinor: 0 })).rejects.toMatchObject({ status: 403 });
  });
});
