import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_OUTPUT } from "@/config/callRubric";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource, TeamOverview } from "@/data/types";
import { humanGap, insights, scoreTranscript, weightedTotal, type CallMeta, type TranscriptLine } from "@/services/coach";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026 (W40); last week is W39
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
const source = async (email: string, now: () => number = () => NOW) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now, storage: new MemoryStorage() });
  await switchTo(src, email);
  return src;
};
const withScoring = async (now: () => number = () => NOW) => {
  const src = await source("rinor@atlas.test", now);
  await src.setAiScoring(true);
  return src;
};
const overview = async (src: DataSource) => (await src.teamOverview()) as TeamOverview;

const meta = (over: Partial<CallMeta> = {}): CallMeta => ({ activityId: "a1", userId: "u-bdr", repName: "Diego", prospectName: "Dan", company: "X", disposition: "Meeting booked", durationS: 180, at: "2026-09-24T14:00:00Z", localHour: 8, ...over });
const L = (t: number, speaker: TranscriptLine["speaker"], text: string): TranscriptLine => ({ t, speaker, text });
const MOCKUP_CALL = [
  L(0, "rep", "Hi, is this Dan? It's Diego with Gllarix. This call is recorded. Quick one: when your techs are out on a job, who answers the phone?"),
  L(14, "prospect", "Honestly, mostly nobody. My wife when she can."),
  L(22, "rep", "How many calls would you say go to voicemail in a normal week?"),
  L(72, "prospect", "Maybe ten. But these AI things sound robotic."),
  L(78, "rep", "Fair. Don't take my word for it: call this number now and try to trip it up. It also tells callers it's an AI."),
  L(151, "rep", "Great. Can we do 20 minutes Thursday at 11?"),
  L(160, "prospect", "Thursday works."),
];

describe("coach scoring (rubric, evidence, compliance)", () => {
  it("scores the mockup call: every score quotes transcript lines; discovery counts double", () => {
    const r = scoreTranscript(meta(), MOCKUP_CALL);
    expect(r.status).toBe("scored");
    for (const it of r.items.filter((i) => i.score !== null)) {
      expect(it.evidence.length).toBeGreaterThan(0);
      for (const e of it.evidence) expect(MOCKUP_CALL.some((l) => l.t === e.t && l.text === e.text)).toBe(true);
    }
    expect(r.compliancePass).toBe(true);
    expect(Object.values(r.tags).flat().map((t) => t.text)).toEqual(expect.arrayContaining(["OPENER 14 S · RECORDING NOTICE GIVEN", "DISCOVERY · MISSED CALLS", "OBJECTION · SOUNDS ROBOTIC", "HANDLED WITH THE LIVE DEMO LINE", "MISSED: JOB VALUE NOT ASKED BEFORE BOOKING", "NEXT STEP BOOKED"]));
    expect(r.flaggedLine).toBe(5);
    expect(r.tryNext[0].example).toMatch(/typical job worth/);
    expect(weightedTotal([{ key: "opener", score: 100 }, { key: "discovery", score: 50 }])).toBe(67);
  });

  it("compliance is strict: no recording notice or an unapproved claim fails", () => {
    const noNotice = [L(0, "rep", "Hi, it's Diego with Gllarix. Who answers when you're on a job?"), ...MOCKUP_CALL.slice(1)];
    expect(scoreTranscript(meta(), noNotice).compliance.find((c) => c.key === "recording_notice")?.pass).toBe(false);
    const claim = [...MOCKUP_CALL, L(170, "rep", "Our clients see 95% less human error on the phones.")];
    const r = scoreTranscript(meta(), claim);
    expect(r.compliancePass).toBe(false);
    expect(r.compliance.find((c) => c.key === "honest_claims")?.evidence[0].text).toMatch(/95% less human error/);
  });

  it("calls under 60 seconds, gatekeepers and wrong numbers are not scored", () => {
    expect(scoreTranscript(meta({ durationS: 45 }), MOCKUP_CALL)).toMatchObject({ status: "not_scored", reason: "Under 60 seconds" });
    expect(scoreTranscript(meta({ disposition: "Gatekeeper" }), MOCKUP_CALL).status).toBe("not_scored");
  });

  it("human check: a gap over 15 points flags the rubric", () => {
    expect(humanGap(74, 85)).toEqual({ gap: 11, flagged: false });
    expect(humanGap(74, 90)).toEqual({ gap: 16, flagged: true });
  });

  it("'what's working' hides patterns with fewer than 30 calls", () => {
    const scored = Array.from({ length: 20 }, (_, i) => ({ meta: meta({ activityId: `a${i}` }), result: scoreTranscript(meta(), MOCKUP_CALL) }));
    expect(insights({ scored, attempts: [] })).toEqual([]);
  });
});

describe("team performance (M12 done-when)", () => {
  it("with the legal flag off, no AI scores render anywhere", async () => {
    const src = await source("rinor@atlas.test");
    await src.runCoachingJobs();
    const o = await overview(src);
    expect(o.aiOn).toBe(false);
    expect(o.insights).toBeNull();
    expect(o.cards.find((c) => c.userId === "u-bdr")!.stats.find((x) => x.key === "quality")!.value).toBe("off");
    const sc = await src.scorecard("u-bdr");
    expect(sc.quality).toBeNull();
    expect(sc.agenda).toBeNull();
    expect(sc.reviews).toEqual([]);
  });

  it("a seeded week of 40 calls produces scores with evidence, a human check, a 1:1 agenda, and the BDR sees only his own scorecard", async () => {
    const src = await withScoring();
    // Scores with evidence.
    const sc = await src.scorecard("u-bdr", 4);
    const lastWeek = sc.reviews.filter((r) => r.at < "2026-09-28");
    // The seeded week has 40 conversations (older seeded calls in the window are scored too).
    expect(lastWeek.filter((r) => r.status === "scored").length).toBeGreaterThanOrEqual(40);
    expect(lastWeek.filter((r) => r.status === "not_scored").length).toBeGreaterThanOrEqual(4);
    const one = await src.getCallReview(lastWeek.find((r) => r.status === "scored")!.id);
    for (const it of one.review.result.items.filter((i) => i.score !== null)) {
      expect(it.evidence.length).toBeGreaterThan(0);
      for (const e of it.evidence) expect(one.review.lines!.some((l) => l.t === e.t && l.text === e.text)).toBe(true);
    }
    // A human check: 3 sampled calls for the co-founder.
    await switchTo(src, "artin@atlas.test");
    const checks = (await overview(src)).humanChecks;
    expect(checks.filter((c) => c.reason === "sample").length).toBeGreaterThanOrEqual(3);
    const target = await src.getCallReview(checks[0].reviewId);
    // 20 points away from the AI score, in whichever direction stays within 0–100 (the sampled call varies).
    const ai = target.review.result.total!;
    await src.humanCheck(target.review.id, ai <= 80 ? ai + 20 : ai - 20);
    const after = await src.getCallReview(target.review.id);
    expect(after.review.human).toMatchObject({ reviewerId: "u-cofounder", gap: 20, flagged: true });
    expect((await overview(src)).rubricFlags.map((f) => f.reviewId)).toContain(target.review.id);
    // A 1:1 agenda: strength, focus with two example calls, a practical fix; under 70 words.
    await switchTo(src, "rinor@atlas.test");
    const sc2 = await src.scorecard("u-bdr");
    expect(sc2.agenda?.points.map((p) => p.kind)).toEqual(["strength", "focus", "fix"]);
    expect(sc2.agenda!.points.find((p) => p.kind === "focus")!.reviewIds).toHaveLength(2);
    expect(sc2.agenda!.points.map((p) => p.text).join(" ").split(/\s+/).length).toBeLessThan(70);
    // The BDR sees only his own scorecard.
    await switchTo(src, "diego@atlas.test");
    expect(await src.teamOverview()).toEqual({ redirectTo: "u-bdr" });
    expect((await src.scorecard("u-bdr")).quality?.scored).toBeGreaterThan(0);
    await expect(src.scorecard("u-cofounder")).rejects.toMatchObject({ status: 403 });
  });

  it("viewers see team totals only; nobody else opens a scorecard; every view is audited", async () => {
    const src = await withScoring();
    await switchTo(src, "books@atlas.test");
    const o = await overview(src);
    expect(o.cards).toEqual([]);
    expect(o.insights).toBeNull();
    expect(o.totals.length).toBeGreaterThan(0);
    await expect(src.scorecard("u-bdr")).rejects.toMatchObject({ status: 403 });
    await switchTo(src, "rinor@atlas.test");
    await src.scorecard("u-bdr");
    const log = await src.listAudit(200);
    expect(log.some((e) => e.action === "team.view" && e.userId === "u-viewer")).toBe(true);
    expect(log.some((e) => e.action === "scorecard.view" && e.entityId === "u-bdr" && e.userId === "u-rinor")).toBe(true);
  });

  it("a dispute flags the review for a human re-check and notifies the co-founder", async () => {
    const src = await withScoring();
    await switchTo(src, "diego@atlas.test");
    const id = (await src.scorecard("u-bdr")).reviews.find((r) => r.status === "scored")!.id;
    await src.disputeReview(id, "The prospect had already told me the job value by email.");
    const r = (await src.getCallReview(id)).review;
    expect(r.disputed).toMatchObject({ by: "u-bdr", resolvedAt: null });
    expect(r.humanRequested).toMatchObject({ assigneeId: "u-cofounder", reason: "dispute" });
    expect((await src.listNotifications("u-cofounder")).some((n) => /disputes a call score/.test(n.text))).toBe(true);
    expect((await src.scorecard("u-bdr")).comments.some((c) => c.kind === "dispute")).toBe(true);
  });

  it("guardrails: pay never reads AI scores, no ranking, no emotion output", async () => {
    // Earnings equal the commission rows for the month, whatever the scores are.
    const src = await withScoring();
    const before = await src.scorecard("u-bdr");
    const commissions = (await src.listCommissions()).filter((c) => c.userId === "u-bdr" && c.period === "2026-10" && c.status !== "void" && c.status !== "clawed_back");
    expect(before.earnings.totalMinor).toBe(commissions.reduce((n, c) => n + c.amountMinor, 0));
    await switchTo(src, "artin@atlas.test");
    for (const c of (await overview(src)).humanChecks) await src.humanCheck(c.reviewId, 0);
    await switchTo(src, "rinor@atlas.test");
    expect((await src.scorecard("u-bdr")).earnings).toEqual(before.earnings);
    const commissionsSource = readFileSync(resolve(__dirname, "../services/commissions.ts"), "utf8");
    expect(commissionsSource).not.toMatch(/coach|callReview|call_review|scoreTranscript/);
    // Cards come in a fixed role order, not by any score.
    const o = await overview(src);
    expect(o.cards.map((c) => c.name)).toEqual(["Diego Marín", "Artin", "Codex agent"]);
    // No emotion, sentiment, tone-of-voice or personality output anywhere.
    const sc = await src.scorecard("u-bdr");
    const all = JSON.stringify([{ ...o, guardrails: [] }, sc, ...(await Promise.all(sc.reviews.slice(0, 10).map((r) => src.getCallReview(r.id))))]);
    expect(all).not.toMatch(FORBIDDEN_OUTPUT);
  });

  it("insights appear once at least 30 scored calls are behind them", async () => {
    const src = await withScoring();
    const o = await overview(src);
    expect(o.scoredCalls).toBeGreaterThanOrEqual(30);
    expect(o.insights!.length).toBeGreaterThan(0);
    for (const i of o.insights!) expect(i.calls).toBeGreaterThanOrEqual(30);
  });

  it("retention: recordings go after 90 days; transcripts and scores are anonymised after 12 months", async () => {
    let now = NOW;
    const src = await withScoring(() => now);
    const id = (await src.scorecard("u-bdr")).reviews.find((r) => r.status === "scored")!.id;
    now = NOW + 91 * 86_400_000;
    await switchTo(src, "rinor@atlas.test");
    await src.runCoachingJobs();
    expect((await src.getCallReview(id)).review.recording.url).toBeNull();
    now = NOW + 400 * 86_400_000;
    await switchTo(src, "rinor@atlas.test");
    const r = await src.runCoachingJobs();
    expect(r.anonymised).toBeGreaterThan(0);
    await expect(src.getCallReview(id)).rejects.toMatchObject({ status: 404 });
  });
});
