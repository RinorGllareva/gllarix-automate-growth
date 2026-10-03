import type { ListType, Stage } from "@/config/leads";

/** Domain records (CRM_BUILD_PROMPT A6), camel-cased. Money is integer minor units; times are UTC ISO strings. */

export type Brand = "gllarix" | "arcadian";
export type Tier = "A" | "B" | "C" | "D";

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  phone: string | null; // E.164
  country: string | null; // ISO 3166-1 alpha-2
  region: string | null;
  city: string | null;
  timezone: string | null; // IANA
  industry: string | null;
  listType: ListType;
  brandInterest: Brand[];
  employeesEst: number | null;
  reviewsCount: number | null;
  rating: number | null;
  sourceId: string | null;
  /** Number flags from directories, e.g. "directory_asterisk" (Swiss "no advertising" marker). */
  phoneFlags?: string[];
  /** Provider ids (Places place_id, Companies House number, Zefix UID), for dedup and refreshes. */
  externalIds?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  emailStatus: "valid" | "invalid" | "unknown";
  phone: string | null;
  phoneType: "mobile" | "landline" | "unknown";
  phoneVerified: boolean;
  phoneInvalid: boolean;
  linkedinUrl: string | null;
  isDecisionMaker: boolean;
  /** Number flags, e.g. "directory_asterisk". */
  phoneFlags?: string[];
}

export interface Source {
  id: string;
  name: string;
  kind: "places_api" | "csv_import" | "companies_house" | "zefix" | "dld" | "referral" | "inbound" | "expo" | "planning_portal";
  country: string | null;
  createdAt: string;
}

export interface ScoreLine {
  ruleId: string;
  label: string;
  points: number;
}

export interface Lead {
  id: string;
  companyId: string;
  primaryContactId: string | null;
  ownerId: string | null;
  listType: ListType;
  stage: Stage;
  score: number;
  tier: Tier;
  scoreBreakdown: ScoreLine[];
  scoreModelVersion: string;
  scoredAt: string;
  excluded: boolean;
  suppressed: boolean;
  nextActionAt: string | null;
  /** call · callback · email · linkedin · follow_up · meeting · re_enrich */
  nextActionType: string | null;
  attemptsCount: number;
  /** Cadence (config/queue.ts) and which of its non-call steps are done ("day:channel"). */
  cadenceId: string | null;
  cadenceStartedAt: string | null;
  cadenceStepsDone: string[];
  statusReason: string | null;
  lastTouchAt: string | null;
  lawfulBasis: string;
  /** Personal data erased (GDPR request or retention); stats stay. */
  erasedAt?: string | null;
  /** Free tags set on the lead page ("referral", "has-crew"), lowercase. */
  tags?: string[];
  importJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Signal {
  id: string;
  leadId: string;
  key: string;
  value: boolean | number | string;
  source: string;
  observedAt: string;
  expiresAt: string | null;
}

export type ActivityType = "call" | "email" | "linkedin" | "note" | "meeting" | "sms" | "stage_change" | "score_change" | "created" | "signal" | "owner_change";

export interface Activity {
  id: string;
  leadId: string;
  userId: string | null;
  type: ActivityType;
  title: string;
  detail: string | null;
  disposition: string | null;
  durationS: number | null;
  recordingUrl?: string | null;
  at: string;
}

export type SuppressionType = "email" | "phone" | "domain";
export type SuppressionReason = "opt_out" | "do_not_call" | "complaint" | "legal" | "erasure";

/** One run of the nightly job: rescore active leads, then retention. */
export interface NightlyRun {
  date: string;
  at: string;
  rescored: number;
  changed: number;
  erased: number;
}

export interface ComplianceOverview {
  retentionMonths: number;
  runs: NightlyRun[];
  /** Markets whose rules aren't confirmed by counsel yet. */
  unverified: string[];
  /** Leads the next retention run would erase. */
  dueForRetention: number;
}

/** score_history: one row each time a lead's score or tier changes (A8). */
export interface ScoreHistoryEntry {
  id: string;
  leadId: string;
  score: number;
  tier: Tier;
  prevScore: number | null;
  prevTier: Tier | null;
  modelVersion: string;
  /** Which rules fired (rule ids with points). */
  breakdown: ScoreLine[];
  reason: "initial" | "change" | "nightly" | "rescore" | "import" | "enrichment";
  at: string;
}

export interface Suppression {
  id: string;
  value: string;
  type: SuppressionType;
  reason: SuppressionReason;
  source: "call_outcome" | "unsubscribe" | "manual" | "import";
  addedBy: string | null;
  createdAt: string;
}

export interface ImportJob {
  id: string;
  sourceId: string;
  sourceName: string;
  fileName: string;
  createdBy: string;
  createdAt: string;
  rows: number;
  created: number;
  merged: number;
  skipped: number;
  suppressed: number;
  failed: number;
  leadIds: string[];
  undoneAt: string | null;
}

/** A row in the Leads list: the lead joined with its company, primary contact and owner name. */
export interface LeadRow {
  lead: Lead;
  company: Company;
  contact: Contact | null;
  ownerName: string | null;
  sourceName: string | null;
}

export interface LeadDetail extends LeadRow {
  contacts: Contact[];
  signals: Signal[];
  activities: Activity[];
  source: Source | null;
  /** Newest first (lead detail; not in the call workspace). */
  scoreHistory?: ScoreHistoryEntry[];
  /** Live compliance.can_contact for right now. */
  compliance?: Record<"call" | "email" | "sms", import("./queueTypes").ComplianceResult>;
}

export type SortKey = "score" | "company" | "stage" | "owner" | "last" | "next";

export interface LeadQuery {
  tiers: Tier[];
  lists: ListType[];
  countries: string[];
  stages: Stage[];
  owners: string[]; // user ids, or "none" for unassigned
  sources: string[];
  brands: Brand[];
  q: string;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
}

export interface LeadPage {
  rows: LeadRow[];
  total: number;
  /** All leads visible to the viewer, and how many are tier A/B, for the top-bar context. */
  visibleTotal: number;
  visibleAB: number;
  /** Ids of every row matching the query (for "select all n matching"). */
  matchingIds: string[];
}

export const PAGE_SIZE = 50;
