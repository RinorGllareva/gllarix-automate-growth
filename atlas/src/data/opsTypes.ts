import type { SystemAutomationKey } from "@/config/systemAutomations";
/** Sell › Inbound and Work › Operations plan (spec/backbone/10 "Inbound", 04 "Operations plan"). */

export type InboundChannel = "website_form" | "demo_line" | "booking_link" | "referral" | "google_profile" | "chat";
export type InboundStatus = "new" | "contacted" | "converted" | "not_fit" | "spam";

export interface InboundRequest {
  id: string;
  receivedAt: string;
  channel: InboundChannel;
  brand: "gllarix" | "arcadian";
  name: string;
  company: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  message: string;
  status: InboundStatus;
  assignedTo: string | null;
  /** First human reply (call or email): the speed-to-lead clock stops here. */
  firstResponseAt: string | null;
  leadId: string | null;
  referredBy?: string | null;
}

export interface InboundHome {
  requests: (InboundRequest & { assigneeName: string | null })[];
  kpis: {
    open: number;
    /** Share answered within the target, last 30 days; null with nothing answered. */
    withinTarget: number | null;
    medianResponseMin: number | null;
    converted30d: number;
    received30d: number;
  };
  targetMinutes: number;
  canAct: boolean;
}

export interface InboundApi {
  inboundHome(): Promise<InboundHome>;
  /** Website forms, the demo line and referrals post here (an Edge Function in Supabase mode; a test button in the demo). */
  receiveInbound(input: Omit<InboundRequest, "id" | "receivedAt" | "status" | "assignedTo" | "firstResponseAt" | "leadId">): Promise<InboundRequest>;
  claimInbound(id: string): Promise<void>;
  /** Log the first reply (stops the clock). */
  respondInbound(id: string, note?: string): Promise<void>;
  /** Create (or match) the lead, owned by the assignee; returns the lead id. */
  convertInbound(id: string): Promise<string>;
  dismissInbound(id: string, reason: "not_fit" | "spam"): Promise<void>;
}

export type SopStatus = "not_started" | "draft" | "in_review" | "done";

export interface Sop {
  id: string;
  num: number;
  title: string;
  covers: string;
  owner: string;
  due: string;
  status: SopStatus;
  /** Link to the written SOP (doc, Notion page, repo file). */
  link: string | null;
  updatedAt: string;
}

export interface OpsHome {
  sops: Sop[];
  /** "itemKey:period" → who ticked it and when. */
  checks: Record<string, { at: string; by: string }>;
  capacity: {
    onboarding: { clientId: string; companyName: string; waitingDays: number }[];
    avgDepositToLiveDays: number | null;
    /** The implementer trigger from the plan: more than 2 setups queued, or a setup waiting over 7 days. */
    hireImplementer: boolean;
    reasons: string[];
  };
  canEdit: boolean;
}

export interface OpsApi {
  opsHome(): Promise<OpsHome>;
  /** Founders: how often each built-in automation ran in the last `days` days. */
  automationLedger(days?: number): Promise<Partial<Record<SystemAutomationKey, number>>>;
  updateSop(id: string, patch: Partial<Pick<Sop, "status" | "link" | "owner" | "due">>): Promise<void>;
  /** Tick (or untick) a rhythm item for its current period. */
  setOpsCheck(key: string, done: boolean): Promise<void>;
}
