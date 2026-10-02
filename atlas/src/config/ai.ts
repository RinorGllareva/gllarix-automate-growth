/**
 * Model per AI job (CRM_BUILD_PROMPT Appendix 6 config/models.yaml). Switch models here, never in code.
 * Prices are estimates in USD cents per million tokens; check current prices before relying on the cost log.
 */
export type AiJob = "planner" | "planner_split";

export const AI_JOBS: Record<AiJob, { model: string; inputPerMTokMinor: number; outputPerMTokMinor: number }> = {
  planner: { model: "claude-sonnet-5-5", inputPerMTokMinor: 300, outputPerMTokMinor: 1500 },
  planner_split: { model: "claude-haiku-4-5-20251001", inputPerMTokMinor: 100, outputPerMTokMinor: 500 },
};

/** Monthly AI cost cap (Appendix 6: max_monthly_cost_eur 30), in EUR cents. */
export const AI_MONTHLY_CAP_MINOR = 3000;
/** Planning: USD → EUR at the planning rate (config/targets). */
export const PLANNER_HORIZON_WEEKS = 8;
/** Freelancers work outside the team's capacity; their tasks run at this many hours per weekday. */
export const EXTERNAL_HOURS_PER_WEEKDAY = 2;

/** Planner owner keys (Appendix 5) → Atlas user ids; codex and freelancer are not users. */
export const OWNER_KEYS = { rinor: "u-rinor", cofounder: "u-cofounder", bdr: "u-bdr" } as const;
export type OwnerKey = keyof typeof OWNER_KEYS | "codex" | "freelancer";
export const OWNER_LABEL: Record<OwnerKey, string> = { rinor: "Rinor", cofounder: "Co-founder", bdr: "BDR", codex: "Codex agent", freelancer: "Freelancer" };
export const PLAN_CATEGORIES = ["Research", "Lead gen", "Sales", "Delivery", "Development", "Finance", "Operations", "Management"] as const;
