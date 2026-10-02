import { DEFAULTS, MARKETS, type MarketId } from "./priceBook";

/**
 * Time tracking (CRM_BUILD_PROMPT A18). People enter their own time: there is no idle detection, activity monitoring,
 * screenshots or app tracking anywhere in Atlas.
 */

export const TIME_CATEGORIES = ["Sales", "Lead gen", "Management", "Finance", "Operations", "Development", "Research", "Delivery"] as const;
export type TimeCategory = (typeof TIME_CATEGORIES)[number];

/** Token color per category (grid labels and split bars). */
export const CATEGORY_COLOR: Record<string, string> = {
  Sales: "cyan", "Lead gen": "mint", Management: "lavender", Finance: "amber", Operations: "text-2", Development: "lavender", Research: "cyan", Delivery: "amber",
};

/** Availability split keys → time categories (for "this week" bars against the target split). */
export const SPLIT_CATEGORIES: Record<string, string[]> = {
  sales: ["Sales", "Lead gen"],
  operations: ["Operations", "Management", "Finance"],
  development: ["Development"],
  review: ["Development"],
  management: ["Management"],
  delivery: ["Delivery"],
  research: ["Research"],
};
export const SPLIT_LABEL: Record<string, string> = { sales: "Sales", operations: "Operations and management", development: "Development", review: "Reviews", management: "Management", delivery: "Delivery", research: "Research" };

/** A timer running longer than this asks for confirmation on the next page load. */
export const TIMER_CONFIRM_HOURS = 10;
/** Grid cells round to a quarter hour. */
export const CELL_STEP_HOURS = 0.25;

/** Default billable rate: the custom-software day rate ÷ 8, adjusted for the market (minor units per hour). */
export const defaultHourlyRateMinor = (market: MarketId) => Math.round((DEFAULTS.rate / 8) * MARKETS[market].mult * 100);

/** Revenue-per-hour targets (screen 25): Gllarix setups ≥ $120/h; 3D projects ≥ €100/h after freelancer cost. */
export const PER_HOUR_TARGET_MINOR = { gllarix: 12_000, arcadian: 10_000 } as const;

/** Rinor's weekend target (the profit-split rule for buying back his time). */
export const WEEKEND_TARGET_HOURS = 12;

/** Internal cost rates (admin only) — planning assumptions until the founders set them. Minor units per hour. */
export const COST_RATE_SEED: Record<string, { hourlyMinor: number; currency: "USD" | "EUR" }> = {
  "u-rinor": { hourlyMinor: 4000, currency: "EUR" },
  "u-cofounder": { hourlyMinor: 3000, currency: "EUR" },
  "u-bdr": { hourlyMinor: 800, currency: "USD" },
  "u-implementer": { hourlyMinor: 2500, currency: "EUR" },
};
