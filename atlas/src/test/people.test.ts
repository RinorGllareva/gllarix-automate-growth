import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/data/demo/demoSource";
import type { DataSource } from "@/data/types";
import { emptyBlocks, gateEvidence, programDay, scoreVerdict, weightedScore } from "@/services/people";

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
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};
const setup = async () => {
  const src = createDemoSource({ password: PW, persistLeads: false, now: () => Date.UTC(2026, 9, 2, 12), storage: new MemoryStorage() });
  await as(src, "rinor@atlas.test");
  return src;
};

describe("scorecard and gates (spec/backbone/05)", () => {
  it("weights the scorecard to 100 and flags red flags", () => {
    expect(weightedScore({})).toEqual({ score: null, scored: 0, complete: false });
    expect(weightedScore({ english: 5, us_sales: 5, roleplay: 5, self_direction: 5, power: 5, honesty: 5 }).score).toBe(100);
    // 25% at 5 + 20% at 3 → (25 + 12) / 45.
    expect(weightedScore({ english: 5, us_sales: 3 }).score).toBe(82);
    expect(scoreVerdict(82, 0).label).toBe("Strong");
    expect(scoreVerdict(82, 1).label).toBe("1 red flag");
    expect(scoreVerdict(50, 0).label).toBe("Below the bar");
  });

  it("checks the evidence for each gate and counts working days", () => {
    const b = emptyBlocks();
    b.script.scores = [6, 7, 8, 9];
    expect(gateEvidence("script", b.script, null)).toEqual({ met: false, text: "3 of 5 roleplays at 7/10 or more" });
    b.compliance.scores = [7, 8];
    expect(gateEvidence("compliance", b.compliance, null).met).toBe(true);
    expect(gateEvidence("live", b.live, null).met).toBe(false);
    expect(gateEvidence("live", b.live, "2026-10-01T10:00:00Z").met).toBe(true);
    expect(programDay("2026-10-05", "2026-10-02")).toBe(0);
    expect(programDay("2026-09-28", "2026-10-02")).toBe(5);
    expect(programDay("2026-09-28", "2026-10-30")).toBe(10);
  });
});

describe("hiring and training", () => {
  it("runs SOP 8 in order, hires into training, and enforces the gates", async () => {
    const src = await setup();
    const { openings, candidates } = await src.hiringBoard();
    const bdr = openings.find((o) => o.status === "open")!;
    const c = await src.addCandidate({ openingId: bdr.id, name: "Test Rep", source: "LinkedIn" });
    expect(c.status).toBe("applied");
    await expect(src.updateCandidate(c.id, { status: "trial" })).rejects.toThrow(/15-min screen/);
    await expect(src.updateCandidate(c.id, { scores: { english: 7 } })).rejects.toThrow(/1–5/);
    await src.updateCandidate(c.id, { status: "screen", scores: { english: 5 } });
    expect((await src.hiringBoard()).candidates.find((x) => x.id === c.id)!.scores).toEqual({ english: 5 });

    const valentina = candidates.find((x) => x.name === "Valentina R.")!;
    await src.updateCandidate(valentina.id, { status: "offer" });
    const t = await src.startTraining({ candidateId: valentina.id, role: bdr.role, startDate: "2026-10-05" });
    const board = await src.hiringBoard();
    expect(board.candidates.find((x) => x.id === valentina.id)!.status).toBe("hired");
    expect(board.openings.find((o) => o.id === bdr.id)!.status).toBe("filled");
    await expect(src.startTraining({ candidateId: valentina.id, role: bdr.role, startDate: "2026-10-05" })).rejects.toThrow(/already/);

    // Gates in order, with evidence.
    await expect(src.setBlockPassed(t.id, "script", true)).rejects.toThrow(/Gate not met/);
    await src.setBlockPassed(t.id, "company", true);
    for (const s of [7, 8, 7.5, 9, 8]) await src.addBlockScore(t.id, "script", s);
    await src.setBlockPassed(t.id, "script", true);
    await src.addBlockScore(t.id, "compliance", 9);
    await expect(src.setBlockPassed(t.id, "closing", true)).rejects.toThrow();
    await src.setBlockPassed(t.id, "compliance", true);
    // No Atlas account → no approved meeting can be found for the live block.
    await expect(src.setBlockPassed(t.id, "live", true)).rejects.toThrow(/No approved meeting/);
    const v = (await src.trainingView()).trainees.find((x) => x.id === t.id)!;
    expect(v.current).toBe(3);
  });

  it("keeps hiring for the founders and shows each person only their own training", async () => {
    const src = await setup();
    await as(src, "diego@atlas.test");
    await expect(src.hiringBoard()).rejects.toMatchObject({ status: 403 });
    const mine = await src.trainingView();
    expect(mine.canEdit).toBe(false);
    expect(mine.trainees.map((t) => t.userId)).toEqual(["u-bdr"]);
    await expect(src.addBlockScore(mine.trainees[0].id, "script", 9)).rejects.toMatchObject({ status: 403 });
  });
});

describe("objections heard on calls", () => {
  it("counts the lines the call workspace writes, most heard first, and knows which have an approved answer", async () => {
    const { countObjections } = await import("@/services/people");
    const scripts = [{ objections: [{ label: "Too expensive", answer: "[to write]" }, { label: "Send me info", answer: "Happy to. What should it answer?" }] }];
    const out = countObjections(["Objection: Too expensive\nNo decision", null, "Spoke to Nina\nObjection: Too expensive\nObjection: Send me info", "nothing"], scripts);
    expect(out).toEqual([
      { label: "Too expensive", count: 2, answered: false },
      { label: "Send me info", count: 1, answered: true },
    ]);
  });
});
