import { describe, expect, it } from "vitest";
import { dispositionByLabel } from "@/config/dispositions";
import { listPriceMinor } from "@/config/priceBook";
import { APPROVAL_CHECKS, kpiStatus, MEETING_BONUS_MINOR, type ApprovalCheck } from "@/config/targets";
import { createDemoSource } from "@/data/demo/demoSource";
import { generateLeadSeed } from "@/data/demo/leadSeed";
import type { Meeting } from "@/data/queueTypes";
import { bonusTotalMinor } from "@/services/commissions";
import { computeReport, meetingStatus, periodBounds } from "@/services/reports";
import { isoWeekKey, isoWeekRange } from "@/services/time";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026
const PW = "pw";
const ALL_TRUE = Object.fromEntries(APPROVAL_CHECKS.map((c) => [c.key, true])) as Record<ApprovalCheck, boolean>;

/** Each test user gets its own storage, like separate browsers (one browser shares one session). */
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

const as = async (email: string, now = () => NOW) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now, storage: new MemoryStorage() });
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
  return src;
};

describe("price book (list prices for deals)", () => {
  it("prices the lead offers per market, with pilot pricing", () => {
    expect(listPriceMinor(["rec_m"], "us")).toEqual({ setupMinor: 150_000, monthlyMinor: 69_900, currency: "USD" });
    expect(listPriceMinor(["rec_m"], "us", true)).toEqual({ setupMinor: 60_000, monthlyMinor: 52_400, currency: "USD" }); // $600 + $524 (mockup)
    expect(listPriceMinor(["d3_p"], "we")).toEqual({ setupMinor: 1_200_000, monthlyMinor: 44_900, currency: "EUR" });
    expect(listPriceMinor(["d3_p"], "ch").setupMinor).toBe(1_500_000);
  });
});

describe("weeks and KPI status", () => {
  it("computes ISO weeks", () => {
    expect(isoWeekKey("2026-10-01")).toBe("2026-W40");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    expect(isoWeekRange("2026-W40")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
  });
  it("ON TRACK when met, WATCH within 10%, OFF TRACK otherwise", () => {
    expect(kpiStatus(4, 4)).toBe("on_track");
    expect(kpiStatus(0.75, 0.8)).toBe("watch");
    expect(kpiStatus(0.5, 0.8)).toBe("off_track");
    expect(kpiStatus(null, 1)).toBeNull();
  });
});

describe("meetings and approval (08_MEETINGS.md)", () => {
  const findHeld = async (src: Awaited<ReturnType<typeof as>>) => {
    for (let w = 0; w < 4; w += 1) {
      const week = await src.listMeetings(isoWeekKey(new Date(NOW - w * 7 * 86_400_000).toISOString().slice(0, 10)));
      const row = week.rows.find((r) => r.status === "to_approve");
      if (row) return row;
    }
    throw new Error("no meeting waiting for approval in the seed");
  };

  it("can't approve unless all 6 checks are true; approval creates the $15 bonus", async () => {
    const admin = await as("rinor@atlas.test");
    const row = await findHeld(admin);
    await expect(admin.approveMeeting(row.meeting.id, { ...ALL_TRUE, decision_maker: false })).rejects.toThrow(/All 6 checks/);
    await admin.approveMeeting(row.meeting.id, ALL_TRUE);
    expect((await admin.getMeeting(row.meeting.id)).status).toBe("approved");
    const bonus = (await admin.listCommissions()).find((c) => c.meetingId === row.meeting.id)!;
    expect(bonus).toMatchObject({ type: "meeting_bonus", amountMinor: MEETING_BONUS_MINOR, status: "pending", userId: row.meeting.bookedBy });
  });

  it("only admins approve; rejection needs a reason and shows on the BDR's daily report", async () => {
    const admin = await as("rinor@atlas.test");
    const row = await findHeld(admin);
    const bdrId = row.meeting.bookedBy;
    if (bdrId === "u-bdr") {
      const bdr = await as("diego@atlas.test");
      await expect(bdr.approveMeeting(row.meeting.id, ALL_TRUE)).rejects.toMatchObject({ status: 403 });
    }
    await expect(admin.rejectMeeting(row.meeting.id, " ")).rejects.toThrow(/reason/);
    await admin.rejectMeeting(row.meeting.id, "Decision-maker not on the call");
    const report = await admin.dailyReport(bdrId);
    expect(report?.rejections).toContainEqual({ company: row.company.name, reason: "Decision-maker not on the call" });
  });

  it("weekly bonus = $15 × approved, and show rate uses only meetings already due", async () => {
    const admin = await as("rinor@atlas.test");
    const week = await admin.listMeetings(isoWeekKey("2026-09-24"));
    const approved = week.rows.filter((r) => r.meeting.approved === true).length;
    expect(week.stats.bonusMinor).toBe(approved * MEETING_BONUS_MINOR);
    const due = week.rows.filter((r) => new Date(r.meeting.scheduledAt).getTime() <= NOW && r.meeting.attended !== null);
    const expected = due.length ? due.filter((r) => r.meeting.attended).length / due.length : null;
    expect(week.stats.showRate).toBe(expected);
  });

  it("closing a month locks approvals and marks its bonuses earned", async () => {
    const admin = await as("rinor@atlas.test");
    const row = await findHeld(admin);
    const month = row.meeting.scheduledAt.slice(0, 7);
    await admin.closeMonth(month);
    await expect(admin.approveMeeting(row.meeting.id, ALL_TRUE)).rejects.toThrow(/closed/);
    expect((await admin.listCommissions()).filter((c) => c.period === month).every((c) => c.status !== "pending")).toBe(true);
  });

  it("marking held asks admins to approve; a no-show schedules the follow-up call", async () => {
    let now = NOW;
    const admin = await as("rinor@atlas.test", () => now);
    const upcoming = (await admin.listMeetings()).rows.find((r) => r.status === "upcoming")!;
    await expect(admin.markMeeting(upcoming.meeting.id, { attended: true })).rejects.toThrow(/once its time has passed/);
    now = new Date(upcoming.meeting.scheduledAt).getTime() + 3_600_000;
    await admin.signInWithPassword("rinor@atlas.test", PW); // the jump may pass the 12 h idle timeout
    await admin.markMeeting(upcoming.meeting.id, { attended: false });
    const lead = await admin.getLead(upcoming.lead.id);
    expect(lead.lead).toMatchObject({ stage: "contacted", nextActionType: "call" });
    expect(new Date(lead.lead.nextActionAt!).getTime()).toBeGreaterThan(now);
  });

  it("viewers see meeting totals but no rows", async () => {
    const viewer = await as("books@atlas.test");
    const week = await viewer.listMeetings(isoWeekKey("2026-09-24"));
    expect(week.rows).toHaveLength(0);
    expect(week.stats.held).toBeGreaterThanOrEqual(0);
  });

  it("meeting statuses", () => {
    const base: Meeting = { id: "m", leadId: "l", bookedBy: "u", ownerId: "u", scheduledAt: new Date(NOW - 3_600_000).toISOString(), withWhom: "x", type: "video", attended: null, approved: null, createdAt: "" };
    expect(meetingStatus(base, NOW)).toBe("to_hold");
    expect(meetingStatus({ ...base, scheduledAt: new Date(NOW + 3_600_000).toISOString() }, NOW)).toBe("upcoming");
    expect(meetingStatus({ ...base, attended: true }, NOW)).toBe("to_approve");
    expect(meetingStatus({ ...base, attended: true, approved: true }, NOW)).toBe("approved");
    expect(meetingStatus({ ...base, attended: false }, NOW)).toBe("no_show");
    expect(bonusTotalMinor([{ ...base, approved: true }, { ...base, approved: false }])).toBe(MEETING_BONUS_MINOR);
  });
});

describe("pipeline (07_PIPELINE.md)", () => {
  it("column sums equal the cards per currency, and the brand filter changes both", async () => {
    const admin = await as("rinor@atlas.test");
    const all = await admin.pipeline({ brand: "both", ownerId: "all", allWon: false });
    const gl = await admin.pipeline({ brand: "gllarix", ownerId: "all", allWon: false });
    expect(gl.every((r) => r.deal.brand === "gllarix")).toBe(true);
    expect(gl.length).toBeLessThan(all.length);
    const usd = all.filter((r) => r.deal.currency === "USD").reduce((s, r) => s + r.deal.setupMinor, 0);
    const eur = all.filter((r) => r.deal.currency === "EUR").reduce((s, r) => s + r.deal.setupMinor, 0);
    expect(usd + eur).toBe(all.reduce((s, r) => s + r.deal.setupMinor, 0));
  });

  it("BDRs move their own deals up to Proposal sent; Won needs a deposit or an admin override; Lost needs a reason", async () => {
    const bdr = await as("diego@atlas.test");
    const mine = (await bdr.pipeline({ brand: "both", ownerId: "all", allWon: false })).filter((r) => r.deal.stage !== "won");
    expect(mine.every((r) => r.deal.ownerId === "u-bdr")).toBe(true);
    const row = mine[0];
    await bdr.moveDeal(row.deal.id, { stage: "proposal_sent" });
    await expect(bdr.moveDeal(row.deal.id, { stage: "negotiation" })).rejects.toMatchObject({ status: 403 });
    await expect(bdr.moveDeal(row.deal.id, { stage: "won" })).rejects.toMatchObject({ status: 403 });
    await expect(bdr.moveDeal(row.deal.id, { stage: "lost" })).rejects.toThrow(/reason/);

    const admin = await as("rinor@atlas.test");
    const open = (await admin.pipeline({ brand: "both", ownerId: "all", allWon: false })).find((r) => r.deal.stage === "negotiation" || r.deal.stage === "opportunity")!;
    await expect(admin.moveDeal(open.deal.id, { stage: "won" })).rejects.toThrow(/override reason/);
    await admin.moveDeal(open.deal.id, { stage: "won", overrideReason: "Paid by bank transfer" });
    const lead = await admin.getLead(open.lead.id);
    expect(lead.lead.stage).toBe("won");
    expect((await admin.listAudit()).some((a) => a.action === "deal.stage")).toBe(true);
  });

  it("a meeting booked from the call workspace opens a deal at the list's lead-offer price", async () => {
    const bdr = await as("diego@atlas.test");
    await bdr.getQueue();
    const ctx = (await bdr.callContext())!;
    await bdr.logOutcome({ leadId: ctx.detail.lead.id, disposition: "meeting_booked", notes: "", durationS: 200, recordingUrl: null, meeting: { at: new Date(NOW + 86_400_000).toISOString(), withWhom: "Owner", type: "video" } });
    const deal = (await bdr.pipeline({ brand: "both", ownerId: "all", allWon: false })).find((r) => r.lead.id === ctx.detail.lead.id)!;
    expect(deal.deal.stage).toBe("meeting_booked");
    expect(deal.deal.setupMinor).toBeGreaterThan(0);
  });
});

describe("reports (11_REPORTS.md): a week of seeded activity", () => {
  const seed = generateLeadSeed(new Date(NOW));
  const users = [
    { id: "u-bdr", name: "Diego", email: "", role: "bdr" as const, timezone: "America/Caracas", dailyCapacity: 150, active: true },
    { id: "u-cofounder", name: "Artin", email: "", role: "admin" as const, timezone: "Europe/Belgrade", dailyCapacity: 80, active: true },
  ];
  const week = isoWeekKey("2026-09-24"); // the full week before NOW
  const report = computeReport({ now: NOW, tz: "America/Caracas", period: { kind: "week", key: week }, personId: "u-bdr", users, activities: seed.activities, meetings: seed.meetings, deals: seed.deals, leads: seed.leads });
  const b = periodBounds("week", week, "America/Caracas");
  const inWeek = (iso: string | null) => Boolean(iso) && new Date(iso!).getTime() >= b.from && new Date(iso!).getTime() < b.to;

  it("funnel counts equal the raw activities, meetings and deals", () => {
    const calls = seed.activities.filter((a) => a.type === "call" && a.userId === "u-bdr" && inWeek(a.at));
    expect(report.funnel[0].count).toBe(calls.length);
    expect(report.funnel[1].count).toBe(calls.filter((a) => a.disposition !== "No answer" && a.disposition !== "Voicemail").length);
    expect(report.funnel[2].count).toBe(calls.filter((a) => dispositionByLabel(a.disposition ?? "")?.conversation).length);
    expect(report.funnel[3].count).toBe(seed.meetings.filter((m) => m.bookedBy === "u-bdr" && inWeek(m.createdAt)).length);
    expect(report.funnel[4].count).toBe(seed.meetings.filter((m) => m.bookedBy === "u-bdr" && inWeek(m.scheduledAt) && m.attended === true).length);
    expect(report.funnel[5].count).toBe(seed.deals.filter((d) => d.stage === "won" && d.ownerId === "u-bdr" && inWeek(d.wonAt)).length);
    expect(report.funnel[0].count).toBeGreaterThan(0);
  });

  it("dials per day divide by the 5 business days of a finished week", () => {
    const dials = report.kpis.find((k) => k.key === "dials_per_day")!;
    expect(dials.value).toBeCloseTo(report.funnel[0].count / 5);
  });

  it("MRR follows won deals at the 1.15 planning rate, and the plan line matches the strategy", () => {
    expect(report.mrr.map((m) => m.planEur)).toEqual([0, 0, 84, 565, 3066, 4535, 6576, 8818, 11712]);
    const october = report.mrr.find((m) => m.month === "2026-10")!;
    const expected = seed.deals
      .filter((d) => d.stage === "won" && d.wonAt && new Date(d.wonAt).getTime() <= NOW)
      .reduce((s, d) => s + (d.currency === "USD" ? d.monthlyMinor / 1.15 : d.monthlyMinor) / 100, 0);
    expect(october.actualEur).toBe(Math.round(expected));
    expect(report.mrr.find((m) => m.month === "2027-01")!.actualEur).toBeNull();
  });

  it("gate 1 counts won deals with a paid deposit", () => {
    const paying = new Set(seed.deals.filter((d) => d.stage === "won" && d.depositPaid).map((d) => d.leadId)).size;
    expect(report.gates[0].value).toBe(`${paying} / 3`);
  });

  it("BDRs only get their own funnel; viewers get team totals", async () => {
    const bdr = await as("diego@atlas.test");
    expect((await bdr.report({ kind: "week", personId: "u-cofounder" })).personId).toBe("u-bdr");
    const viewer = await as("books@atlas.test");
    expect((await viewer.report({ kind: "week" })).personId).toBe("team");
  });
});
