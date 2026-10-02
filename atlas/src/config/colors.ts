import type { CSSProperties } from "react";
import type { Stage } from "./leads";

/**
 * One color per category, used everywhere the category appears (pipeline columns, chips, calendar events, avatars).
 * Values are hue token names from src/styles/tokens.css, so both themes work.
 */
export type Hue = "cyan" | "mint" | "lavender" | "amber" | "coral" | "blue" | "teal" | "orange" | "pink" | "lime" | "text-3";

export const DEAL_STAGE_HUE: Record<string, Hue> = {
  qualified: "cyan",
  meeting_booked: "blue",
  meeting_held: "lavender",
  opportunity: "orange",
  proposal_sent: "amber",
  negotiation: "pink",
  won: "mint",
  lost: "coral",
};

export const LEAD_STAGE_HUE: Record<Stage, Hue> = {
  new: "teal",
  researched: "lime",
  contacted: "cyan",
  replied: "lavender",
  qualified: "cyan",
  meeting_booked: "blue",
  meeting_completed: "lavender",
  opportunity: "orange",
  proposal_sent: "amber",
  negotiation: "pink",
  won: "mint",
  lost: "coral",
  nurture: "text-3",
};

export const TASK_STATUS_HUE: Record<string, Hue> = {
  todo: "text-3",
  in_progress: "blue",
  review: "lavender",
  blocked: "coral",
  done: "mint",
  cancelled: "text-3",
};

export const PRIORITY_HUE: Record<string, Hue> = { urgent: "coral", high: "orange", normal: "blue", low: "text-3" };

export const MEETING_TYPE_HUE: Record<string, Hue> = { video: "blue", phone: "teal", in_person: "pink" };

export const CATEGORY_HUE: Record<string, Hue> = {
  Development: "lavender", Sales: "cyan", "Lead gen": "mint", Management: "pink", Finance: "amber", Operations: "teal", Research: "lime", Delivery: "orange", Marketing: "pink",
};

export const BRAND_HUE = { gllarix: "cyan", arcadian: "amber" } as const;

/** People get a stable color from their id (avatars, calendar rows, owners). */
const PEOPLE: Hue[] = ["blue", "pink", "teal", "orange", "lavender", "lime", "cyan", "amber"];
export const personHue = (id: string | null | undefined): Hue => {
  if (!id) return "text-3";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PEOPLE[h % PEOPLE.length];
};

export const hueVar = (hue: Hue) => `var(--${hue})`;
/** Translucent fill of a hue (follows the theme's tint strength). */
export const hueTint = (hue: Hue, pct?: number) => `color-mix(in srgb, var(--${hue}) ${pct ? `${pct}%` : "var(--tint-strength)"}, transparent)`;

/** Text + fill + border for a pill or chip. */
export const pillStyle = (hue: Hue): CSSProperties => ({
  color: hueVar(hue),
  background: hueTint(hue),
  borderColor: `color-mix(in srgb, var(--${hue}) 45%, transparent)`,
});
