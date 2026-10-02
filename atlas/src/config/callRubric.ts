/**
 * Port of config/call_rubric.yaml (CRM_BUILD_PROMPT A17), versioned. Compliance is pass/fail and shown separately;
 * any fail flags the call for review. Scores are coaching advice only: pay never reads them (services/commissions.ts).
 */
export type RubricItemKey = "opener" | "discovery" | "objections" | "next_step";
export type ComplianceKey = "recording_notice" | "ai_disclosure" | "honest_claims";

export const CALL_RUBRIC = {
  version: "2026-09-28.v1",
  items: [
    { key: "opener", label: "Opener under 20 seconds", short: "Opener under 20 s", weight: 1, good: "States who you are, gives the recording notice and asks the first question within 20 s." },
    { key: "discovery", label: "Discovery: calls, job value, after-hours", short: "Discovery", weight: 2, good: "Asks about missed calls, what a typical job is worth, and what happens after hours." },
    { key: "objections", label: "Objection handling", short: "Objection handling", weight: 1, good: "Acknowledges the objection and answers it with the approved answer (e.g. the live demo line)." },
    { key: "next_step", label: "Clear next step booked or set", short: "Next step", weight: 1, good: "Ends with a booked meeting, a callback time or a dated follow-up." },
  ] as { key: RubricItemKey; label: string; short: string; weight: number; good: string }[],
  compliance: [
    { key: "recording_notice", label: "Recording notice given" },
    { key: "ai_disclosure", label: "Says the receptionist is an AI" },
    { key: "honest_claims", label: "Only approved claims" },
  ] as { key: ComplianceKey; label: string }[],
} as const;

/** Claims not on the approved list (rules: "no unproven marketing claims"). */
export const BANNED_CLAIMS = [/95% less human error/i, /guarantee[ds]? (more|\d+)/i, /never miss (a|another) call again, guaranteed/i];

export const COACHING = {
  /** Calls shorter than this aren't scored (A17). */
  minScoredSeconds: 60,
  /** Human check: a gap above this flags the rubric or prompt for review. */
  humanGapPoints: 15,
  /** Random scored calls the co-founder checks each week. */
  humanChecksPerWeek: 3,
  /** "What's working" shows only patterns with at least this many calls. */
  insightMinCalls: 30,
  /** Retention (configurable in settings): recordings 90 days, transcripts and scores 12 months, then anonymised. */
  recordingDays: 90,
  transcriptDays: 365,
};

/** Fields the coaching output may never contain (EU AI Act: no emotion recognition at work; A17 guardrails). */
export const FORBIDDEN_OUTPUT = /emotion|sentiment|tone of voice|mood|personality|stress level|biometric/i;
