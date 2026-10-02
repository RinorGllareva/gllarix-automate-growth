/**
 * KPI targets (context/03 · "targets are assumptions"), the €10k MRR plan (plans/mrr_10k_strategy.md, Reports mockup)
 * and stage gates. Admins edit targets in Admin › Settings (later); until then they live here.
 */
export type KpiKey =
  | "dials_per_day"
  | "conversations_per_day"
  | "meetings_booked"
  | "show_rate"
  | "approved_per_booked"
  | "crm_same_day"
  | "close_rate_held"
  | "followup_24h";

export interface KpiTarget {
  key: KpiKey;
  label: string;
  /** The value that counts as met. */
  min: number;
  /** Shown to people, e.g. "60–70 · stretch 100". */
  text: string;
  unit: "count" | "pct" | "rate";
}

export const KPI_TARGETS: KpiTarget[] = [
  { key: "dials_per_day", label: "Dials per day", min: 60, text: "60–70 · stretch 100", unit: "rate" },
  { key: "conversations_per_day", label: "Conversations per day", min: 6, text: "6–10", unit: "rate" },
  { key: "meetings_booked", label: "Meetings booked", min: 4, text: "4+", unit: "count" },
  { key: "show_rate", label: "Show rate", min: 0.7, text: "70%+", unit: "pct" },
  { key: "approved_per_booked", label: "Approved / booked", min: 0.8, text: "80%+", unit: "pct" },
  { key: "crm_same_day", label: "CRM updated same day", min: 1, text: "100%", unit: "pct" },
  { key: "close_rate_held", label: "Close rate on held", min: 0.2, text: "20%+", unit: "pct" },
  { key: "followup_24h", label: "Follow-up within 24 h of a meeting", min: 1, text: "100%", unit: "pct" },
];

export type KpiStatus = "on_track" | "watch" | "off_track";

/** ON TRACK when the target is met; WATCH within 10% of it; OFF TRACK otherwise (11_REPORTS.md). */
export const kpiStatus = (value: number | null, min: number): KpiStatus | null => {
  if (value === null) return null;
  if (value >= min) return "on_track";
  if (value >= min * 0.9) return "watch";
  return "off_track";
};

/** Planning rate from models/*.py: FX = 1.15 USD per EUR. */
export const USD_PER_EUR = 1.15;

/** €10k MRR plan line, end of month (Reports mockup / mrr_10k_strategy.md). */
export const MRR_PLAN_EUR: { month: string; eur: number }[] = [
  { month: "2026-10", eur: 0 },
  { month: "2026-11", eur: 0 },
  { month: "2026-12", eur: 84 },
  { month: "2027-01", eur: 565 },
  { month: "2027-02", eur: 3066 },
  { month: "2027-03", eur: 4535 },
  { month: "2027-04", eur: 6576 },
  { month: "2027-05", eur: 8818 },
  { month: "2027-06", eur: 11712 },
];

export const GATES = [
  { key: "gate1", label: "Gate 1 · 3 paying clients", note: "Then promote the BDR to closer and hire setter #1" },
  { key: "gate2", label: "Gate 2 · €2,000 MRR for 2 months", note: "Then add a second channel and an implementer" },
  { key: "gate3", label: "Gate 3 · €5,000 MRR, churn under 5%", note: "Then build pods of 1 closer + 2–3 setters" },
] as const;

/** Approved-meeting definition (context/03) as the 6 checks on the Meetings screen. */
export const APPROVAL_CHECKS = [
  { key: "icp", label: "Matches the target customer" },
  { key: "contact", label: "Contact details are valid" },
  { key: "need", label: "Real business need" },
  { key: "decision_maker", label: "Decision-maker attended" },
  { key: "held", label: "The meeting took place" },
  { key: "not_duplicate", label: "Not a duplicate or out of target" },
] as const;

export type ApprovalCheck = (typeof APPROVAL_CHECKS)[number]["key"];

/** $15 per approved meeting (context/03 compensation table). */
export const MEETING_BONUS_MINOR = 1500;
export const MEETING_BONUS_CURRENCY = "USD";

export const LOST_REASONS = ["Price", "Timing", "No need", "Competitor", "No response", "Other"] as const;
