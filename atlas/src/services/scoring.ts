import { SCORING, type Condition, type Rule } from "@/config/scoring";
import type { Company, Contact, ScoreLine, Signal, Tier } from "@/data/leadTypes";
import type { ListType } from "@/config/leads";

export interface ScoreInput {
  listType: ListType;
  company: Company;
  contact: Contact | null;
  signals: Signal[];
  suppressed: boolean;
  now?: Date;
}

export interface ScoreResult {
  score: number;
  tier: Tier;
  breakdown: ScoreLine[];
  excluded: boolean;
  modelVersion: string;
}

const DAY = 86_400_000;

const fieldValue = (path: string, input: ScoreInput, now: Date): unknown => {
  const { company, contact } = input;
  switch (path) {
    case "company.industry":
      return company.industry;
    case "company.reviews_count":
      return company.reviewsCount;
    case "company.employees_est":
      return company.employeesEst;
    case "company.country":
      return company.country;
    case "company.rating":
      return company.rating;
    case "company.domain":
      return company.domain;
    case "company.updated_days_ago":
      return Math.floor((now.getTime() - new Date(company.updatedAt).getTime()) / DAY);
    case "contact.phone_verified":
      return contact?.phoneVerified ?? false;
    case "contact.is_decision_maker":
      return contact?.isDecisionMaker ?? false;
    case "contact.email_status":
      return contact?.emailStatus ?? "unknown";
    case "contact.title":
      return contact?.title ?? null;
    case "lead.suppressed":
      return input.suppressed;
    default:
      throw new Error(`Unknown scoring field: ${path}`);
  }
};

/** A signal counts only while fresh: its own expiry, and the rule's expires_days from when it was observed. */
const signalValue = (key: string, rule: Rule, input: ScoreInput, now: Date) => {
  const signal = input.signals
    .filter((s) => s.key === key)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  if (!signal) return undefined;
  if (signal.expiresAt && new Date(signal.expiresAt) < now) return undefined;
  if (rule.expiresDays && now.getTime() - new Date(signal.observedAt).getTime() > rule.expiresDays * DAY) return undefined;
  return signal.value;
};

const holds = (cond: Condition, value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if ("in" in cond) return cond.in.includes(value as string | number);
  if ("between" in cond) return typeof value === "number" && value >= cond.between[0] && value <= cond.between[1];
  if ("eq" in cond) return value === cond.eq;
  if ("lt" in cond) return typeof value === "number" && value < cond.lt;
  if ("gt" in cond) return typeof value === "number" && value > cond.gt;
  if ("gte" in cond) return typeof value === "number" && value >= cond.gte;
  if ("exists" in cond) return value !== "";
  if ("matches" in cond) return typeof value === "string" && new RegExp(cond.matches, "i").test(value);
  return false;
};

export const tierFor = (score: number): Tier =>
  score >= SCORING.tiers.A ? "A" : score >= SCORING.tiers.B ? "B" : score >= SCORING.tiers.C ? "C" : "D";

/** Rule-based score (A8): 0–100 clamped, tier, and every rule that fired. */
export const scoreLead = (input: ScoreInput): ScoreResult => {
  const now = input.now ?? new Date();
  const breakdown: ScoreLine[] = [];
  let excluded = false;
  for (const rule of SCORING.models[input.listType]) {
    const value = "signal" in rule.when ? signalValue(rule.when.signal, rule, input, now) : fieldValue(rule.when.field, input, now);
    if (!holds(rule.when, value)) continue;
    if (rule.exclude) excluded = true;
    else breakdown.push({ ruleId: rule.id, label: rule.label, points: rule.points ?? 0 });
  }
  breakdown.sort((a, b) => b.points - a.points);
  const score = Math.max(0, Math.min(100, breakdown.reduce((sum, l) => sum + l.points, 0)));
  return { score, tier: tierFor(score), breakdown, excluded, modelVersion: SCORING.modelVersion };
};
