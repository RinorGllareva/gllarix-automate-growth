import type { ListType } from "./leads";

/** Port of config/queue.yaml v1 (CRM_BUILD_PROMPT Appendix 2). Change numbers here, never in services. */
export type Channel = "call" | "email" | "linkedin";

export interface CadenceStep {
  day: number;
  channel: Channel;
  template?: string;
}

export const QUEUE = {
  /** Shift by role; capacity and timezone come from the user record. */
  shifts: { bdr: "08:00-16:00", closer: "08:00-16:00", admin: "08:00-15:00" } as Record<string, string>,
  reserveFollowupsPct: 20,
  minNewATierPct: 30,
  tierWeight: { A: 1.0, B: 0.7, C: 0.3, D: 0 } as Record<string, number>,
  limits: {
    maxCallAttemptsPer10BusinessDays: 3,
    minDaysBetweenEmails: 3,
  },
  /** Lead-local calling windows per list. */
  windows: {
    trades: { call: ["07:00-09:00", "16:00-18:00"], secondary: ["09:00-12:00"] },
    developers: { call: ["09:00-12:00", "14:00-17:00"], secondary: [] as string[] },
  } as Record<ListType, { call: string[]; secondary: string[] }>,
  cadences: {
    trades_v1: [
      { day: 1, channel: "call" },
      { day: 1, channel: "email", template: "trades_intro" },
      { day: 3, channel: "call" },
      { day: 6, channel: "call" },
      { day: 6, channel: "email", template: "trades_proof" },
      { day: 10, channel: "email", template: "trades_breakup" },
    ],
    developers_v1: [
      { day: 1, channel: "linkedin", template: "dev_connect" },
      { day: 1, channel: "email", template: "dev_intro" },
      { day: 4, channel: "call" },
      { day: 8, channel: "email", template: "dev_3d_teaser" },
      { day: 14, channel: "email", template: "dev_breakup" },
    ],
  } as Record<string, CadenceStep[]>,
  cadenceFor: { trades: "trades_v1", developers: "developers_v1" } as Record<ListType, string>,
  /**
   * Default lead-local hours when a market has no explicit calling hours.
   * Assumption (docs/QUESTIONS.md): 07:00–21:00, so the founders' 07:00 trades window works; to confirm with counsel.
   * Markets with their own hours (e.g. AE 09:00–18:00) override it.
   */
  defaultCallHoursLocal: "07:00-21:00",
  /** Emails are queued alongside calls, never instead of them: lower priority and at most this share of capacity. */
  emailWeight: 0.5,
  maxEmailPct: 25,
} as const;

export const CADENCE_LABEL: Record<string, string> = { trades_v1: "Trades v1", developers_v1: "Developers v1" };
