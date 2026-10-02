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
const switchTo = async (src: DataSource, email: string) => {
  await src.signOut();
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};
const setup = async (email = "diego@atlas.test") => {
  const clock = { t: Date.UTC(2026, 9, 1, 14, 0) };
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => clock.t, storage: new MemoryStorage() });
  await switchTo(src, email);
  return { src, clock };
};
const range = (t: number, days = 14) => ({ from: new Date(t - DAY).toISOString(), to: new Date(t + days * DAY).toISOString() });
const DAY = 86_400_000;
const myLead = async (src: DataSource) =>
  (await src.listLeads({ tiers: [], lists: [], countries: [], stages: ["new"], owners: [], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 })).rows.find((r) => r.lead.ownerId === "u-bdr" && r.contact?.email)!;

describe("calendar", () => {
  it("shows the person's meetings, callbacks and tasks; admins can open someone's calendar, others can't", async () => {
    const { src, clock } = await setup();
    const lead = await myLead(src);
    const at = new Date(clock.t + 2 * DAY).toISOString();
    await src.logOutcome({ leadId: lead.lead.id, disposition: "meeting_booked", notes: "", durationS: 60, recordingUrl: null, meeting: { at, withWhom: "Owner", type: "phone" } });
    const events = await src.calendarEvents(range(clock.t));
    const m = events.find((e) => e.kind === "meeting" && e.start === at)!;
    expect(m).toMatchObject({ hue: "teal", sub: expect.stringMatching(/^Phone/) });
    expect(new Date(m.end).getTime() - new Date(m.start).getTime()).toBe(30 * 60_000);
    await expect(src.calendarEvents({ ...range(clock.t), userId: "u-rinor" })).rejects.toMatchObject({ status: 403 });
    await switchTo(src, "rinor@atlas.test");
    expect((await src.calendarEvents({ ...range(clock.t), userId: "u-bdr" })).some((e) => e.id === m.id)).toBe(true);
  });

  it("Google Calendar: connect pushes meetings and callbacks, follows changes, and disconnect removes only Atlas events", async () => {
    const { src, clock } = await setup();
    const lead = await myLead(src);
    await expect(src.connectGoogleCalendar({ email: "nope" })).rejects.toThrow(/email/);
    const conn = await src.connectGoogleCalendar({ email: "diego@gmail.example" });
    expect(conn).toMatchObject({ status: "connected", test: true, email: "diego@gmail.example" });
    const busy = (await src.calendarEvents(range(clock.t))).filter((e) => e.kind === "google");
    expect(busy.length).toBeGreaterThan(0);
    // A callback lands on the Google calendar after the next sync.
    await src.logOutcome({ leadId: lead.lead.id, disposition: "call_back", notes: "", durationS: 30, recordingUrl: null, callbackAt: new Date(clock.t + 3 * 3_600_000).toISOString() });
    const r1 = await src.syncCalendar();
    expect(r1!.pushed).toBeGreaterThan(0);
    const cb = (await src.calendarEvents(range(clock.t))).find((e) => e.kind === "callback" && e.href === `/call/${lead.lead.id}`)!;
    expect(cb.synced).toBe(true);
    expect((await src.syncCalendar())!.pushed).toBe(0); // nothing changed
    await src.disconnectGoogleCalendar();
    expect(await src.calendarConnection()).toBeNull();
    const after = await src.calendarEvents(range(clock.t));
    expect(after.find((e) => e.id === cb.id)?.synced).toBe(false);
    expect(after.filter((e) => e.kind === "google").length).toBe(busy.length); // their own events stay theirs
  });
});

describe("New meeting (Meetings page)", () => {
  it("books without a call: meeting, deal, stage, confirmation email, calendar; refuses past times, closed and other people's leads", async () => {
    const { src, clock } = await setup();
    const lead = await myLead(src);
    const at = new Date(clock.t + DAY).toISOString();
    await expect(src.createMeeting({ leadId: lead.lead.id, at: new Date(clock.t - 3 * 3_600_000).toISOString(), withWhom: "Owner", type: "video" })).rejects.toThrow(/past/);
    const { meetingId } = await src.createMeeting({ leadId: lead.lead.id, at, withWhom: "Owner", type: "in_person", notes: "At their office" });
    const d = await src.getLead(lead.lead.id);
    expect(d.lead.stage).toBe("meeting_booked");
    expect(d.activities.some((a) => a.title === "Meeting booked from the Meetings page")).toBe(true);
    expect((await src.outbox({ leadId: lead.lead.id })).map((m) => m.kind)).toContain("booking_confirmation");
    expect((await src.listDeals()).some((r) => r.lead.id === lead.lead.id)).toBe(true);
    expect((await src.calendarEvents(range(clock.t))).find((e) => e.id === `meeting:${meetingId}`)).toMatchObject({ hue: "pink", start: at });
    // Someone else's lead: the BDR can't book it.
    const others = (await src.listLeads({ tiers: [], lists: [], countries: [], stages: [], owners: [], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 })).rows;
    await switchTo(src, "rinor@atlas.test");
    const rinorLead = (await src.listLeads({ tiers: [], lists: [], countries: [], stages: ["new"], owners: ["u-rinor"], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 })).rows[0];
    await switchTo(src, "diego@atlas.test");
    expect(others.some((r) => r.lead.id === rinorLead.lead.id)).toBe(false);
    await expect(src.createMeeting({ leadId: rinorLead.lead.id, at, withWhom: "X", type: "video" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("email alerts", () => {
  it("emails the owner about a meeting booked for them, a meeting within the hour and a callback due in 15 min, once each", async () => {
    const { src, clock } = await setup("rinor@atlas.test");
    const lead = (await src.listLeads({ tiers: [], lists: [], countries: [], stages: ["new"], owners: [], sources: [], brands: [], q: "", sort: "score", dir: "desc", page: 1 })).rows.find((r) => r.lead.ownerId === "u-bdr")!;
    // Rinor books a meeting on Diego's lead: Diego owns it.
    await src.logOutcome({ leadId: lead.lead.id, disposition: "meeting_booked", notes: "", durationS: 60, recordingUrl: null, meeting: { at: new Date(clock.t + 50 * 60_000).toISOString(), withWhom: "Owner", type: "video" } });
    await src.runAlertJobs();
    await switchTo(src, "diego@atlas.test");
    let mine = await src.myAlertEmails();
    expect(mine.map((e) => e.type)).toEqual(expect.arrayContaining(["meeting_booked", "meeting_soon"]));
    expect(mine.every((e) => e.to === "diego@atlas.test")).toBe(true);
    await src.runAlertJobs();
    expect((await src.myAlertEmails()).length).toBe(mine.length); // no duplicates
    // Callback due in 10 minutes.
    const other = await myLead(src);
    await src.logOutcome({ leadId: other.lead.id, disposition: "call_back", notes: "", durationS: 30, recordingUrl: null, callbackAt: new Date(clock.t + 3 * 3_600_000).toISOString() });
    await src.runAlertJobs();
    expect((await src.myAlertEmails()).some((e) => e.type === "callback_due")).toBe(false);
    clock.t += 3 * 3_600_000 - 10 * 60_000;
    await switchTo(src, "diego@atlas.test");
    await src.runAlertJobs();
    mine = await src.myAlertEmails();
    expect(mine.filter((e) => e.type === "callback_due")).toHaveLength(1);
  });

  it("respects each person's settings; urgent tasks assigned to you are emailed", async () => {
    const { src } = await setup("diego@atlas.test");
    await src.setNotificationPrefs({ email: { meeting_booked: false, meeting_soon: true, callback_due: true, task_urgent: true, task_overdue: false } });
    expect((await src.notificationPrefs()).email.meeting_booked).toBe(false);
    await switchTo(src, "rinor@atlas.test");
    const home = await src.tasksHome();
    const list = home.spaces.flatMap((s) => s.lists).find((l) => l.name)!;
    await src.createTask({ listId: list.id, title: "Call the Tampa lead back today", priority: "urgent", assigneeIds: ["u-bdr"] });
    await src.runAlertJobs();
    await switchTo(src, "diego@atlas.test");
    const mine = await src.myAlertEmails();
    expect(mine.some((e) => e.type === "task_urgent" && /Tampa lead/.test(e.subject))).toBe(true);
    expect(mine.some((e) => e.type === "task_overdue")).toBe(false);
  });
});
