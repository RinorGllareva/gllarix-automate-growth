/** Lead stages (CRM_BUILD_PROMPT A7). */
export const STAGES = [
  "new",
  "researched",
  "contacted",
  "replied",
  "qualified",
  "meeting_booked",
  "meeting_completed",
  "opportunity",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
  "nurture",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New lead",
  researched: "Researched",
  contacted: "Contacted",
  replied: "Replied",
  qualified: "Qualified",
  meeting_booked: "Meeting booked",
  meeting_completed: "Meeting completed",
  opportunity: "Opportunity",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
};

/** Short chip text, as in the Leads mockup. */
export const STAGE_CHIP: Record<Stage, string> = {
  new: "New",
  researched: "Researched",
  contacted: "Contacted",
  replied: "Replied",
  qualified: "Qualified",
  meeting_booked: "Meeting",
  meeting_completed: "Met",
  opportunity: "Opportunity",
  proposal_sent: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
};

/** "Open" = still being worked: the Leads list default. */
export const OPEN_STAGES: Stage[] = STAGES.filter((s) => !["won", "lost", "nurture"].includes(s));

export type ListType = "trades" | "developers";
export const LIST_LABEL: Record<ListType, string> = { trades: "Trades", developers: "Developers" };

export const INDUSTRY_LABEL: Record<string, string> = {
  hvac: "HVAC",
  plumbing: "Plumbing",
  roofing: "Roofing",
  electrical: "Electrical",
  property_developer: "Developer",
};

export const industryLabel = (industry: string | null) =>
  industry ? (INDUSTRY_LABEL[industry] ?? industry.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())) : "—";

/** ISO code shown to people: GB reads as UK. */
export const countryLabel = (code: string | null) => (code === "GB" ? "UK" : (code ?? "—"));

export const LAWFUL_BASES = ["Legitimate interest · B2B", "Consent", "Existing customer"] as const;
