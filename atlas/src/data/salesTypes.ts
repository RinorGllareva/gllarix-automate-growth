import type { MarketId } from "@/config/priceBook";
import type { KpiKey, KpiStatus } from "@/config/targets";
import type { Brand, Company, Contact, Lead } from "./leadTypes";
import type { Meeting } from "./queueTypes";

export const DEAL_STAGES = ["qualified", "meeting_booked", "meeting_held", "opportunity", "proposal_sent", "negotiation", "won", "lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  qualified: "Qualified",
  meeting_booked: "Meeting booked",
  meeting_held: "Meeting held",
  opportunity: "Opportunity",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

/** The furthest a BDR may move a deal (07_PIPELINE.md). */
export const BDR_MAX_STAGE: DealStage = "proposal_sent";

export interface Deal {
  id: string;
  leadId: string;
  brand: Brand;
  stage: DealStage;
  market: MarketId;
  currency: "USD" | "EUR";
  setupMinor: number;
  monthlyMinor: number;
  pilot: boolean;
  items: string[];
  ownerId: string | null;
  stageChangedAt: string;
  expectedCloseAt: string | null;
  wonAt: string | null;
  lostReason: string | null;
  lostNote: string | null;
  /** 50% setup deposit paid (Stripe, M6). Won needs it, or an admin override. */
  depositPaid: boolean;
  wonOverrideReason: string | null;
  /** Quote builder draft (pricing.QuoteSelection); null until first opened in the builder. */
  draft?: import("@/services/pricing").QuoteSelection | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealRow {
  deal: Deal;
  lead: Lead;
  company: Company;
  ownerName: string | null;
  /** Next meeting, if any. */
  nextMeetingAt: string | null;
  /** Primary contact's name (deals list). */
  contactName?: string | null;
  /** Newest quote that is not superseded (deals list progress). */
  latestQuote?: { version: number; status: "draft" | "sent" | "accepted" | "paid" | "superseded"; sentAt: string | null; openedAt: string | null; paidAt: string | null } | null;
}

export interface PipelineQuery {
  brand: Brand | "both";
  ownerId: string | "all";
  /** Show every won deal, not only this month's. */
  allWon: boolean;
}

export interface MoveDealInput {
  stage: DealStage;
  lostReason?: string;
  lostNote?: string;
  /** Admin override for Won without a deposit. */
  overrideReason?: string;
}

export type MeetingStatus = "upcoming" | "to_hold" | "to_approve" | "approved" | "rejected" | "no_show";

export interface MeetingRow {
  meeting: Meeting;
  lead: Lead;
  company: Company;
  contact: Contact | null;
  ownerName: string | null;
  bookedByName: string | null;
  status: MeetingStatus;
  /** "+$15", "pending" or "—" */
  bonus: "earned" | "pending" | "none";
  locked: boolean;
}

export interface MeetingsWeek {
  week: string; // YYYY-Www
  start: string; // YYYY-MM-DD (Monday)
  end: string; // YYYY-MM-DD (Sunday)
  rows: MeetingRow[];
  stats: {
    booked: number;
    held: number;
    toCome: number;
    due: number;
    showRate: number | null;
    approved: number;
    waiting: number;
    bonusMinor: number;
  };
  closedMonths: string[];
}

export interface Commission {
  id: string;
  userId: string;
  meetingId: string | null;
  dealId: string | null;
  type: "meeting_bonus" | "setup_commission" | "recurring_commission" | "quarter_bonus";
  amountMinor: number;
  currency: "USD" | "EUR";
  status: "pending" | "earned" | "paid" | "clawed_back" | "void";
  period: string; // YYYY-MM
  /** Paid only on cash collected, after the 30-day clawback window. */
  earnableAt?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface FunnelStep {
  key: "dials" | "connects" | "conversations" | "booked" | "held" | "won";
  label: string;
  count: number;
  /** Conversion from the previous step, 0–1; null for the first. */
  rate: number | null;
}

export interface KpiRow {
  key: KpiKey;
  label: string;
  value: number | null;
  target: string;
  unit: "count" | "pct" | "rate";
  status: KpiStatus | null;
}

export interface MrrPoint {
  month: string;
  planEur: number;
  actualEur: number | null;
}

export interface GateProgress {
  key: "gate1" | "gate2" | "gate3";
  label: string;
  note: string;
  value: string;
  progress: number; // 0–1
  met: boolean;
}

export interface WeeklyReport {
  period: { kind: "week" | "month"; key: string; start: string; end: string; label: string };
  personId: string | "team";
  funnel: FunnelStep[];
  kpis: KpiRow[];
  mrr: MrrPoint[];
  mrrStatus: "ahead" | "on_plan" | "behind";
  gates: GateProgress[];
  computedAt: string;
}

export interface DailyBdrReport {
  userId: string;
  userName: string;
  date: string;
  dials: number;
  conversations: number;
  booked: number;
  outcomes: { label: string; count: number }[];
  queueDone: number;
  queueTotal: number;
  rejections: { company: string; reason: string }[];
  generatedAt: string;
}
