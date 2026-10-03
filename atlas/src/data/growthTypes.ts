/** Growth › Marketing and Growth › Market and competitors (spec/backbone/10 and 11). */

export type ChannelStatus = "not_started" | "in_progress" | "live" | "paused";

/** An inbound channel to build (spec/backbone/10 "Inbound"). */
export interface MarketingChannel {
  id: string;
  name: string;
  build: string;
  owner: string;
  due: string;
  kpi: string;
  status: ChannelStatus;
  note: string;
  updatedAt: string;
}

/** A marketing test with a budget and a stop rule (no paid ads before the case study). */
export interface Experiment {
  id: string;
  name: string;
  channel: string;
  budgetEur: number;
  spentEur: number;
  startDate: string | null;
  endDate: string | null;
  stopRule: string;
  /** What "worked" means, e.g. 2 qualified leads. */
  goal: number;
  qualifiedLeads: number;
  status: "planned" | "running" | "won" | "stopped";
  note: string;
  createdAt: string;
}

export interface Competitor {
  id: string;
  name: string;
  brand: "gllarix" | "arcadian";
  type: string;
  priceSeen: string;
  howWeWin: string;
  source: string | null;
  lastCheckedAt: string;
}

export interface MarketRow {
  key: string;
  name: string;
  /** ISO countries in this market. */
  countries: string[];
  brand: string;
  language: string;
  tz: string;
  whoSells: string;
  priceLevel: string;
  priority: number;
  /** Live numbers from Atlas. */
  leads: number;
  openDeals: number;
  won: number;
  meetings30d: number;
}

export interface MarketingKpis {
  meetingsThisWeek: number;
  approved30d: number;
  inboundLeadsMonth: number;
  /** Share of meetings (last 90 days) from referral or inbound leads; null with no meetings. */
  referralInboundShare: number | null;
  /** Sales and marketing spend in the last 30 days ÷ approved meetings; null without approved meetings. */
  costPerApprovedMeetingEur: number | null;
  marketingSpend30dEur: number;
}

export interface GrowthApi {
  /** Everyone in sales can read; founders edit. */
  marketingHome(): Promise<{ channels: MarketingChannel[]; experiments: Experiment[]; kpis: MarketingKpis; canEdit: boolean }>;
  updateChannel(id: string, patch: Partial<Pick<MarketingChannel, "status" | "note" | "owner" | "due">>): Promise<void>;
  saveExperiment(input: Partial<Experiment> & { name: string }): Promise<Experiment>;
  marketsHome(): Promise<{ markets: MarketRow[]; competitors: Competitor[]; canEdit: boolean }>;
  saveCompetitor(input: Partial<Competitor> & { name: string; brand: Competitor["brand"] }): Promise<Competitor>;
  /** "Checked today": the quarterly manual price check. */
  markCompetitorChecked(id: string): Promise<void>;
}
