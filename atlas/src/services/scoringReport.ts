import { SCORING } from "@/config/scoring";
import type { Activity, Lead, Tier } from "@/data/leadTypes";
import type { Meeting } from "@/data/queueTypes";

/**
 * Monthly scoring report (CRM_BUILD_PROMPT M8; admin/04_SCORING_MODELS.md): of the leads first contacted in the month,
 * how many booked a meeting, by tier and by scoring rule (signal present vs absent).
 */
export interface ConversionRow {
  key: string;
  label: string;
  contacted: number;
  meetings: number;
  rate: number | null;
  /** Rate with the rule ÷ rate without it (signal rows only). */
  lift: number | null;
  /** Leads without the rule (signal rows only). */
  without?: { contacted: number; meetings: number; rate: number | null };
}

export interface ScoringReport {
  month: string;
  contacted: number;
  meetings: number;
  rate: number | null;
  byTier: ConversionRow[];
  byRule: ConversionRow[];
  /** "Suggest weights" needs at least this many contacted leads in total. */
  enoughForWeights: boolean;
  totalContacted: number;
}

const TOUCH = new Set<Activity["type"]>(["call", "email", "linkedin"]);
const rate = (m: number, c: number) => (c ? m / c : null);

export const scoringReport = (input: { month: string; leads: Lead[]; activities: Activity[]; meetings: Meeting[] }): ScoringReport => {
  const firstTouch = new Map<string, string>();
  for (const a of input.activities) {
    if (!TOUCH.has(a.type) || !a.userId) continue;
    const prev = firstTouch.get(a.leadId);
    if (!prev || a.at < prev) firstTouch.set(a.leadId, a.at);
  }
  const meetingAt = new Map<string, string>();
  for (const m of input.meetings) {
    const prev = meetingAt.get(m.leadId);
    if (!prev || m.createdAt < prev) meetingAt.set(m.leadId, m.createdAt);
  }
  const leadsById = new Map(input.leads.map((l) => [l.id, l]));
  const cohort = [...firstTouch.entries()].filter(([, at]) => at.startsWith(input.month)).map(([id]) => leadsById.get(id)).filter(Boolean) as Lead[];
  const converted = (l: Lead) => {
    const m = meetingAt.get(l.id);
    return !!m && m >= firstTouch.get(l.id)!.slice(0, 10);
  };
  const count = (ls: Lead[]) => ({ contacted: ls.length, meetings: ls.filter(converted).length });

  const byTier: ConversionRow[] = (["A", "B", "C", "D"] as Tier[]).map((t) => {
    const c = count(cohort.filter((l) => l.tier === t));
    return { key: t, label: `Tier ${t}`, ...c, rate: rate(c.meetings, c.contacted), lift: null };
  });

  const rules = Object.values(SCORING.models).flat().filter((r) => !r.exclude);
  const seen = new Set<string>();
  const byRule: ConversionRow[] = [];
  for (const r of rules) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const relevant = cohort.filter((l) => SCORING.models[l.listType].some((x) => x.id === r.id));
    if (!relevant.length) continue;
    const has = relevant.filter((l) => l.scoreBreakdown.some((b) => b.ruleId === r.id));
    const not = relevant.filter((l) => !l.scoreBreakdown.some((b) => b.ruleId === r.id));
    const a = count(has);
    const b = count(not);
    const ra = rate(a.meetings, a.contacted);
    const rb = rate(b.meetings, b.contacted);
    byRule.push({ key: r.id, label: r.label, ...a, rate: ra, lift: ra !== null && rb ? ra / rb : null, without: { ...b, rate: rb } });
  }
  byRule.sort((x, y) => (y.lift ?? -1) - (x.lift ?? -1));
  const all = count(cohort);
  return { month: input.month, ...all, rate: rate(all.meetings, all.contacted), byTier, byRule, enoughForWeights: firstTouch.size >= 500, totalContacted: firstTouch.size };
};
