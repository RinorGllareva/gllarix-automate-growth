/**
 * Port of config/capacity.yaml v1 (CRM_BUILD_PROMPT Appendix 4). Hours are planning assumptions until the founders
 * confirm them; people edit their own windows, split and time off in the Workload screen (stored as availability).
 */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
/** Date.getUTCDay() → weekday key. */
export const WEEKDAY_BY_INDEX: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const FOCUS_FACTOR = 0.8;
export const DEFAULT_BUFFER = 0.3;
/** Placement chunks are at least 30 minutes. */
export const CHUNK_HOURS = 0.5;
export const HORIZON_WEEKS = 12;

export interface CapacitySeed {
  timezone: string;
  windows: Partial<Record<Weekday, string>>;
  /** Category split; must sum to 1. */
  split: Record<string, number>;
  /** Which split categories count as task time (the rest is calling or other work). Default: all. */
  planned?: string[];
  skills: string[];
}

/** By Atlas user id. */
export const CAPACITY_SEED: Record<string, CapacitySeed> = {
  "u-rinor": { timezone: "Europe/Belgrade", windows: { sat: "09:00-15:00", sun: "09:00-15:00" }, split: { development: 0.7, review: 0.2, management: 0.1 }, skills: ["development", "architecture", "review", "3d"] },
  "u-cofounder": {
    timezone: "Europe/Belgrade",
    windows: { mon: "08:00-15:00", tue: "08:00-15:00", wed: "08:00-15:00", thu: "08:00-15:00", fri: "08:00-15:00" },
    split: { sales: 0.63, operations: 0.23, development: 0.14 },
    // The co-founder's sales share is calling and pipeline work; tasks fit in the ops + dev hours (13 h).
    planned: ["operations", "development"],
    skills: ["sales", "operations", "management", "development", "research", "lead_gen", "review"],
  },
  "u-bdr": { timezone: "America/Caracas", windows: { mon: "08:00-16:00", tue: "08:00-16:00", wed: "08:00-16:00", thu: "08:00-16:00", fri: "08:00-16:00" }, split: { sales: 1 }, skills: ["sales", "lead_gen"] },
  // Not in Appendix 4: the implementer's hours are an assumption (QUESTIONS.md).
  "u-implementer": { timezone: "Europe/Zurich", windows: { mon: "09:00-13:00", tue: "09:00-13:00", wed: "09:00-13:00", thu: "09:00-13:00", fri: "09:00-13:00" }, split: { delivery: 1 }, skills: ["delivery", "operations"] },
};

/** The Codex agent: no hour limit, but each agent task books review hours on its reviewer. */
export const AGENT = { id: "agent-codex", name: "Codex agent", reviewHoursPerTask: 1.5, reviewers: ["u-rinor", "u-cofounder"], skills: ["development"] };

/** Task category → split key and skill. */
export const CATEGORY_KEY: Record<string, string> = {
  Development: "development",
  Sales: "sales",
  "Lead gen": "lead_gen",
  Operations: "operations",
  Management: "management",
  Research: "research",
  Finance: "management",
  Delivery: "delivery",
  Marketing: "sales",
};

/** Owner colors on the timeline (token names). */
export const OWNER_COLORS = ["lavender", "cyan", "amber", "text-3", "mint"] as const;
