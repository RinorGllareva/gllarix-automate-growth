/** Hiring scorecard and training gates (spec/backbone/05). Pure functions shared by the demo data layer and the pages. */
import { SCORECARD, TRAINING_BLOCKS, type BlockKey, type BlockProgress, type Candidate, type ObjectionCount } from "@/data/peopleTypes";

/** Weighted scorecard out of 100 (each criterion 1–5); null until something is scored. */
export const weightedScore = (scores: Candidate["scores"]) => {
  const scored = SCORECARD.filter((c) => typeof scores[c.key] === "number");
  if (!scored.length) return { score: null, scored: 0, complete: false };
  const total = scored.reduce((n, c) => n + (c.weight * (scores[c.key] ?? 0)) / 5, 0);
  const weight = scored.reduce((n, c) => n + c.weight, 0);
  // Partly scored: scale to the criteria scored so far, so early screens are comparable.
  return { score: Math.round((total / weight) * 100), scored: scored.length, complete: scored.length === SCORECARD.length };
};

/** Hire bar: 70+ and no red flags (a proposal; the founders decide). */
export const scoreVerdict = (score: number | null, redFlags: number) =>
  score === null ? { label: "Not scored", hue: "text-3" as const } : redFlags ? { label: `${redFlags} red flag${redFlags > 1 ? "s" : ""}`, hue: "coral" as const } : score >= 70 ? { label: "Strong", hue: "mint" as const } : score >= 55 ? { label: "Maybe", hue: "amber" as const } : { label: "Below the bar", hue: "coral" as const };

/** "Objection: X" lines that the call workspace writes into call notes → counts, most heard first. */
export const countObjections = (notes: (string | null)[], scripts: { objections: { label: string; answer: string }[] }[]): ObjectionCount[] => {
  const counts = new Map<string, number>();
  for (const n of notes)
    for (const m of (n ?? "").matchAll(/^Objection: (.+)$/gm)) counts.set(m[1].trim(), (counts.get(m[1].trim()) ?? 0) + 1);
  const answered = (label: string) => scripts.some((s) => s.objections.some((o) => o.label === label && !o.answer.startsWith("[")));
  return [...counts].map(([label, count]) => ({ label, count, answered: answered(label) })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

export const ROLEPLAY_PASS = 7;
export const QUIZ_PASS = 8;

/** Is a block's gate met by its evidence? Check-type gates are a judgment the trainer makes. */
export const gateEvidence = (block: BlockKey, p: BlockProgress, firstApprovedMeetingAt: string | null): { met: boolean; text: string } => {
  const b = TRAINING_BLOCKS.find((x) => x.key === block)!;
  if (b.kind === "roleplays") {
    const good = p.scores.filter((s) => s >= ROLEPLAY_PASS).length;
    return { met: good >= b.need, text: `${good} of ${b.need} roleplays at ${ROLEPLAY_PASS}/10 or more` };
  }
  if (b.kind === "quiz") {
    const best = p.scores.length ? Math.max(...p.scores) : null;
    return { met: best !== null && best >= QUIZ_PASS, text: best === null ? "Quiz not taken" : `Best quiz score ${best}/10` };
  }
  if (b.kind === "meeting") return { met: !!firstApprovedMeetingAt, text: firstApprovedMeetingAt ? "Approved meeting found in Atlas" : "No approved meeting yet" };
  return { met: true, text: "Trainer's call" };
};

/** Program day (1–10) on working days from the start date; 0 before the start. */
export const programDay = (startDate: string, today: string) => {
  if (today < startDate) return 0;
  let n = 0;
  const d = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${today}T12:00:00Z`);
  while (d <= end) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return Math.min(10, n);
};

export const emptyBlocks = (): Record<BlockKey, BlockProgress> =>
  Object.fromEntries(TRAINING_BLOCKS.map((b): [BlockKey, BlockProgress] => [b.key, { scores: [], passedAt: null, passedBy: null, note: "" }])) as Record<BlockKey, BlockProgress>;
