import type { ListType, Stage } from "@/config/leads";
import type { DuplicateDecision, ImportPlan, PlanContext } from "@/services/importPlan";
import type { ComplianceOverview, ImportJob, LeadDetail, LeadPage, LeadQuery, NightlyRun, Source, Suppression, SuppressionReason } from "./leadTypes";
import type { CallContext, OutcomeInput, OutcomeResult, QueueView, TeamMemberToday, TodayStats } from "./queueTypes";
import type { ApprovalCheck } from "@/config/targets";
import type { CheckoutSession, Client, DealDetail, DiscountApproval, ParityResult, Payment, PublicQuote, Quote, StripeEvent } from "./quoteTypes";
import type { QuoteSelection } from "@/services/pricing";
import type { ClientsApi } from "./clientTypes";
import type { LeadSourcesApi } from "./sourceTypes";
import type { TasksApi } from "./taskTypes";
import type { CapacityApi } from "./capacityTypes";
import type { AutomationsApi, PlannerApi } from "./plannerTypes";
import type { TeamApi } from "./coachTypes";
import type { TimeApi } from "./timeTypes";
import type { AdvisorApi } from "./advisorTypes";
import type { CalendarApi } from "./calendarTypes";
import type { BookingInput, BookingPage, Branding, EmailMessage, EmailTemplate, InboxUsage, SenderRun, UnsubscribeResult } from "./emailTypes";
import type { Commission, DailyBdrReport, DealRow, MeetingRow, MeetingsWeek, MoveDealInput, PipelineQuery, WeeklyReport } from "./salesTypes";

export * from "./leadTypes";
export * from "./queueTypes";
export * from "./salesTypes";
export * from "./emailTypes";
export * from "./quoteTypes";
export * from "./clientTypes";
export * from "./sourceTypes";
export * from "./taskTypes";
export * from "./capacityTypes";
export * from "./plannerTypes";
export * from "./coachTypes";
export * from "./timeTypes";
export * from "./advisorTypes";
export * from "./calendarTypes";

export type Role ="admin" | "bdr" | "closer" | "implementer" | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  bdr: "BDR",
  closer: "Closer",
  implementer: "Implementer",
  viewer: "Viewer",
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** IANA timezone, e.g. "America/Caracas". */
  timezone: string;
  /** Daily queue capacity (150 BDR / 80 co-founder); null for users without a queue. */
  dailyCapacity: number | null;
  active: boolean;
}

export type NotificationType =
  | "meeting_booked"
  | "payment_paid"
  | "payment_failed"
  | "job_paused"
  | "tier_moved"
  | "meeting_approval"
  | "bdr_report"
  | "task"
  | "mention"
  | "briefing"
  | "client_health";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  text: string;
  /** In-app link to the related record. */
  href: string;
  createdAt: string;
  readAt: string | null;
}

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  at: string;
}

export type SignInResult =
  | { ok: true; user: User }
  | { ok: false; error: "invalid" | "paused" | "rate_limited" };

/** Thrown when the signed-in user may not see or change a record (the UI renders 403 / 404). */
export class AccessError extends Error {
  constructor(
    public status: 403 | 404,
    message = status === 403 ? "You don't have access to this." : "Not found.",
  ) {
    super(message);
  }
}

export interface LeadPatch {
  stage?: Stage;
  ownerId?: string | null;
}

export interface CommitImportInput {
  fileName: string;
  sourceName: string;
  plan: ImportPlan;
  /** Decision per possible duplicate, keyed by file row number. Missing = keep both. */
  decisions: Record<number, DuplicateDecision>;
  ownerId: string | null;
  listType: ListType;
  lawfulBasis: string;
  /** Rows on the opt-out list: import them as suppressed (never queued), or skip them. */
  suppressedMode: "suppress" | "skip";
  /** Cadence for the new leads: a cadence id, null for none; missing = the list's default. */
  cadenceId?: string | null;
}

export interface LeadsApi {
  listLeads(query: LeadQuery): Promise<LeadPage>;
  getLead(id: string): Promise<LeadDetail>;
  updateLead(id: string, patch: LeadPatch): Promise<void>;
  addNote(leadId: string, text: string): Promise<void>;
  setPrimaryContact(leadId: string, contactId: string): Promise<void>;
  markContact(contactId: string, patch: { emailInvalid?: boolean; phoneInvalid?: boolean }): Promise<void>;
  bulkAssign(leadIds: string[], ownerId: string | null, listType?: ListType): Promise<number>;
  /** Put leads on a cadence (restarts it), or take them off (null). Owners for their own leads; admins for any. */
  setCadence(leadIds: string[], cadenceId: string | null): Promise<number>;
  rescore(leadIds: string[]): Promise<number>;
  exportLeads(leadIds: string[]): Promise<string>;
  leadFacets(): Promise<{ countries: string[]; sources: Source[] }>;
  listSuppression(): Promise<Suppression[]>;
  addSuppression(value: string, reason: SuppressionReason): Promise<Suppression>;
  removeSuppression(id: string, reason: string): Promise<void>;
  dedupContext(): Promise<PlanContext>;
  commitImport(input: CommitImportInput): Promise<ImportJob>;
  listImports(): Promise<ImportJob[]>;
  undoImport(jobId: string): Promise<{ removed: number; kept: number }>;
  /** Nightly job (M2): rescore all active leads, then erase personal data past retention. Once per day (UTC), after 02:00. */
  runNightlyJobs(): Promise<NightlyRun | null>;
  complianceOverview(): Promise<ComplianceOverview>;
  setRetentionMonths(months: number): Promise<void>;
  /** GDPR access request: everything Atlas holds on the lead's people, as JSON (admin). */
  exportPersonalData(leadId: string): Promise<string>;
  /** GDPR erasure: names, emails, phones, notes and email bodies go; stats stay; identifiers go on the opt-out list (admin). */
  erasePersonalData(leadId: string, reason: string): Promise<void>;
}

export interface QueueApi {
  /** Today's queue for the signed-in user (built on first use each day); null for users without a daily capacity. */
  getQueue(): Promise<QueueView | null>;
  /** Rebuild now, keeping what was already worked today. */
  buildQueue(): Promise<QueueView>;
  todayStats(): Promise<TodayStats>;
  /** Admins: every person with a queue. */
  teamToday(): Promise<TeamMemberToday[]>;
  /** A lead to work: by id, or (no id) the next open call in today's queue. null = queue finished. */
  callContext(leadId?: string): Promise<CallContext | null>;
  saveCallNotes(leadId: string, notes: string): Promise<void>;
  logOutcome(input: OutcomeInput): Promise<OutcomeResult>;
  skipLead(leadId: string, reason: string): Promise<void>;
}

export interface SalesApi {
  /** Meetings scheduled in an ISO week ("2026-W40"); default this week. Viewers get totals only. */
  listMeetings(week?: string): Promise<MeetingsWeek>;
  getMeeting(id: string): Promise<MeetingRow>;
  /** Owner (or admin) marks a past meeting held or no-show. A no-show schedules the follow-up. */
  markMeeting(id: string, patch: { attended: boolean; durationMin?: number; notes?: string }): Promise<void>;
  /** Book a meeting from the Meetings page (no call logged): deal, confirmation and reminders, calendar sync, as from a call. */
  createMeeting(input: { leadId: string; at: string; withWhom: string; type: "video" | "phone" | "in_person"; notes?: string }): Promise<{ meetingId: string }>;
  /** Admin: all 6 checks must be true. Creates the pending $15 bonus. */
  approveMeeting(id: string, checks: Record<ApprovalCheck, boolean>): Promise<void>;
  rejectMeeting(id: string, reason: string): Promise<void>;
  /** Admin: lock a month's approvals ("YYYY-MM"). */
  closeMonth(month: string): Promise<void>;
  pipeline(query: PipelineQuery): Promise<DealRow[]>;
  moveDeal(id: string, input: MoveDealInput): Promise<void>;
  report(input: { kind: "week" | "month"; key?: string; personId?: string | "team" }): Promise<WeeklyReport>;
  /** Latest end-of-shift report for a BDR (default: yourself, or the first BDR for admins). */
  dailyReport(userId?: string, date?: string): Promise<DailyBdrReport | null>;
  listCommissions(): Promise<Commission[]>;
}

export interface EmailApi {
  listTemplates(): Promise<EmailTemplate[]>;
  /** Admin. Rejected without {{unsubscribe_url}} or with unknown variables. */
  saveTemplate(t: { key: string; subject: string; body: string }): Promise<void>;
  /** Render a template for a real lead (or the first visible one). */
  previewTemplate(key: string, leadId?: string): Promise<{ subject: string; body: string; problems: string[]; leadName: string | null }>;
  /** Queue an email to a lead now (compliance runs when the sender picks it up). */
  composeEmail(leadId: string, input: { templateKey: string }): Promise<EmailMessage>;
  outbox(filter?: { leadId?: string }): Promise<EmailMessage[]>;
  inboxes(): Promise<InboxUsage[]>;
  /** The sender job: materialise due cadence emails, poll replies, send what's allowed. Runs every minute while Atlas is open. */
  runSender(): Promise<SenderRun>;
  lastSenderRun(): Promise<SenderRun | null>;
  /** Demo only: pretend the recipient replied. */
  simulateReply(messageId: string, text: string): Promise<void>;
  getBranding(): Promise<Branding>;
  saveBranding(b: Branding): Promise<void>;
  /** The signed-in user's booking page URL path, e.g. "/book/diego". */
  bookingPath(): Promise<string | null>;
  /** Public (no sign-in). */
  bookingPage(slug: string): Promise<BookingPage | null>;
  /** Public. Creates or matches the lead, the meeting, the deal, the confirmation and reminders. */
  book(input: BookingInput): Promise<{ meetingAt: string; ownerName: string; timezone: string }>;
  /** Public, one click from any email. */
  unsubscribe(token: string): Promise<UnsubscribeResult>;
}

export interface DealsApi {
  listDeals(): Promise<DealRow[]>;
  getDeal(id: string): Promise<DealDetail>;
  /** Open (or reuse) a deal for a lead; returns its id. */
  createDeal(leadId: string): Promise<string>;
  /** Recompute with pricing.compute(); the server enforces discount limits and pilot caps. */
  updateDraft(id: string, selection: QuoteSelection): Promise<DealDetail>;
  requestDiscount(dealId: string, pct: number, note: string): Promise<void>;
  /** A different admin from the requester decides (both founders' OK). */
  decideDiscount(approvalId: string, approve: boolean): Promise<void>;
  pendingDiscounts(): Promise<DiscountApproval[]>;
  /** Save the draft as a new immutable quote version. */
  saveQuote(dealId: string): Promise<Quote>;
  /** Email the quote link to the client (compliance-checked) and mark it sent. */
  sendQuote(quoteId: string): Promise<void>;
  /** Public quote page (no sign-in). Records the first open. */
  publicQuote(token: string): Promise<PublicQuote | null>;
  /** Public: click-to-accept terms with the signer's name. */
  acceptQuote(token: string, name: string): Promise<void>;
  /** Public: Stripe Checkout for the 50% setup deposit (test mode). */
  startCheckout(token: string): Promise<CheckoutSession>;
  checkoutSession(id: string): Promise<{ session: CheckoutSession; companyName: string } | null>;
  /** Demo only: the fake Stripe completes the test payment and fires checkout.session.completed. */
  completeTestCheckout(id: string): Promise<void>;
  /** Idempotent by event id: replaying an event changes nothing. */
  stripeWebhook(event: StripeEvent): Promise<{ duplicate: boolean }>;
  listPayments(): Promise<Payment[]>;
  listClients(): Promise<Client[]>;
  parityCheck(): Promise<ParityResult[]>;
}

/** Everything the UI needs from a backend. The demo source and the Supabase source both implement it. */
export interface DataSource extends LeadsApi, QueueApi, SalesApi, EmailApi, DealsApi, ClientsApi, LeadSourcesApi, TasksApi, CapacityApi, PlannerApi, AutomationsApi, TeamApi, TimeApi, AdvisorApi, CalendarApi {
  readonly kind: "demo" | "supabase";
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  currentUser(): Promise<User | null>;
  listUsers(): Promise<User[]>;
  listNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  listAudit(limit?: number): Promise<AuditEntry[]>;
}
