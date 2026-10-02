/** Clients, onboarding, usage and billing settings (10_CLIENTS_AND_USAGE.md, CRM_BUILD_PROMPT M7). */

export type OnboardingKey = "intake" | "agent_drafted" | "number_forwarded" | "test_calls" | "go_live";

/** SOP 3 onboarding steps, in order. Automatic steps tick themselves when the automation passes. */
export const ONBOARDING_STEPS: { key: OnboardingKey; label: string; auto: boolean }[] = [
  { key: "intake", label: "Intake form received", auto: false },
  { key: "agent_drafted", label: "Agent drafted from website FAQ", auto: true },
  { key: "number_forwarded", label: "Business number forwarded", auto: false },
  { key: "test_calls", label: "Automatic test calls pass", auto: true },
  { key: "go_live", label: "Go live and start billing", auto: false },
];

/** Health score weights (sum 100). Under HEALTH_TASK_BELOW → a call task within 48 h. */
export const HEALTH_WEIGHTS = { usage: 40, bookings: 30, payment: 20, tickets: 10 } as const;
export const HEALTH_TASK_BELOW = 60;
export const HEALTH_TASK_HOURS = 48;
/** An open invoice counts as late after this many days. */
export const INVOICE_DUE_DAYS = 7;

/** Pilot terms (context/02): first month free, monthly −25% for 12 months. */
export const PILOT_FREE_MONTHS = 1;
export const PILOT_RATE_MONTHS = 12;

export const STATUS_REASONS = {
  paused: ["Seasonal slowdown", "Client asked for a break", "Payment issue", "Other"],
  churned: ["Not enough calls", "Price", "Switched provider", "Business closed", "Unhappy with the agent", "Other"],
} as const;
