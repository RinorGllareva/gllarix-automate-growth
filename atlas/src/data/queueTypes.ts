import type { Channel } from "@/config/queue";
import type { DispositionKey } from "@/config/dispositions";
import type { Company, Contact, Lead, LeadDetail, Tier } from "./leadTypes";

export type QueueKind = "new" | "follow_up" | "callback" | "cadence";

/** One line of a person's daily queue (A9), in working order. */
export interface QueueItem {
  leadId: string;
  channel: Channel;
  kind: QueueKind;
  /** "DAY 1 · CALL", "CALLBACK", "DAY 6 · EMAIL" */
  step: string;
  priority: number;
  /** Best calling window today, as UTC instants (calls only). */
  windowStartAt: string | null;
  windowEndAt: string | null;
  windowName: string | null;
  /** Exact time for callbacks. */
  dueAt: string | null;
  /** Template for email and LinkedIn steps (config/emailTemplates.ts). */
  template?: string | null;
  status: "open" | "done" | "skipped" | "removed";
  doneAt: string | null;
  note: string | null;
}

export interface QueueSummary {
  capacity: number;
  total: number;
  byChannel: Record<Channel, number>;
  byTier: Record<Tier, number>;
  byWindow: { name: string; count: number }[];
  followUps: number;
  newLeads: number;
  /** "need 42 more A/B leads — run list build" */
  shortfall: number;
  blocked: number;
  buildMs: number;
}

export interface DailyQueue {
  ownerId: string;
  /** Owner-local date, YYYY-MM-DD. */
  date: string;
  builtAt: string;
  items: QueueItem[];
  summary: QueueSummary;
}

export interface QueueRow extends QueueItem {
  lead: Lead;
  company: Company;
  contact: Contact | null;
  /** Top scoring signal or the reason it's due. */
  whyNow: string;
}

export interface QueueView {
  queue: DailyQueue;
  rows: QueueRow[];
  done: number;
}

export interface Meeting {
  id: string;
  leadId: string;
  bookedBy: string;
  ownerId: string | null;
  scheduledAt: string;
  withWhom: string;
  type: "video" | "phone" | "in_person";
  /** Held (true) / no-show (false), marked by the owner after the meeting. */
  attended: boolean | null;
  /** Admin decision: true approved, false rejected, null waiting. */
  approved: boolean | null;
  checks?: Partial<Record<string, boolean>>;
  approvedBy?: string | null;
  decidedAt?: string | null;
  rejectReason?: string | null;
  durationMin?: number | null;
  recordingUrl?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface TodayStats {
  dials: number;
  conversations: number;
  meetingsBookedWeek: number;
  approvedWeek: number;
  callbacksSoon: { leadId: string; company: string; at: string }[];
  meetingsAwaitingApproval: number;
}

export interface TeamMemberToday {
  userId: string;
  name: string;
  capacity: number;
  done: number;
  total: number;
  dials: number;
  conversations: number;
  meetingsBookedWeek: number;
}

export interface ComplianceResult {
  allowed: boolean;
  /** Plain-English reasons; when allowed, what was checked. */
  reasons: string[];
}

export interface CallContext {
  detail: LeadDetail;
  compliance: ComplianceResult;
  /** 1-based position in today's queue, if it's in it. */
  position: { index: number; total: number; done: number } | null;
  nextUp: QueueRow | null;
  draftNotes: string;
}

export interface OutcomeInput {
  leadId: string;
  disposition: DispositionKey;
  notes: string;
  durationS: number;
  recordingUrl: string | null;
  gatekeeperName?: string;
  /** UTC ISO instant, chosen in the lead's local time. */
  callbackAt?: string;
  meeting?: { at: string; withWhom: string; type: Meeting["type"] };
}

export interface OutcomeResult {
  message: string;
  nextActionAt: string | null;
  nextActionType: string | null;
}
