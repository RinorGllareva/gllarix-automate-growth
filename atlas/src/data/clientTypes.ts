import type { OnboardingKey } from "@/config/clients";
import type { MarketId } from "@/config/priceBook";
import type { Client } from "./quoteTypes";
import type { Deal } from "./salesTypes";

export type Currency = "USD" | "EUR";

export interface OnboardingStep {
  key: OnboardingKey;
  done: boolean;
  doneAt: string | null;
  /** User id, or null when an automation ticked it. */
  doneBy: string | null;
  ownerId: string | null;
}

/** Stripe subscription (test mode; faked in demo mode). Money in minor units. */
export interface Subscription {
  id: string;
  clientId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currency: Currency;
  market: MarketId;
  /** Contracted monthly fee (pilot rate while the pilot lasts). */
  monthlyMinor: number;
  /** List monthly fee, charged after the pilot's 12 months. */
  listMonthlyMinor: number;
  includedMinutes: number;
  /** Minor units per minute, e.g. 25 = $0.25. */
  overageRateMinor: number;
  billing: "monthly" | "annual";
  pilot: boolean;
  /** Pilot: first month free. */
  freeUntil: string | null;
  /** Pilot rate ends (12 months after go-live). */
  pilotUntil: string | null;
  /** Annual prepay covers until this date. */
  prepaidUntil: string | null;
  /** The voice platform account usage is imported from. */
  voiceAccountId: string;
  status: "active" | "paused" | "canceled";
  startedAt: string;
  pausedAt: string | null;
  canceledAt: string | null;
}

/** One day of usage from the voice platform (UsagePortal). */
export interface UsageDay {
  clientId: string;
  /** YYYY-MM-DD (UTC). */
  date: string;
  minutes: number;
  calls: number;
  afterHours: number;
  booked: number;
  missed: number;
  /** Our cost for the minutes (estimate). */
  costMinor: number;
}

/** A closed month of usage (usage_records). */
export interface UsageRecord {
  id: string;
  clientId: string;
  period: string; // YYYY-MM
  minutesUsed: number;
  callsCount: number;
  includedMinutes: number;
  overageMinutes: number;
  overageMinor: number;
  costMinor: number;
  source: "fake_portal" | "voice_platform";
  createdAt: string;
}

export interface InvoiceLine {
  /** "time": approved billable hours (M13 → Stripe invoice items). */
  type: "monthly" | "overage" | "setup_balance" | "annual" | "time";
  description: string;
  amountMinor: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  dealId: string;
  /** The usage month this invoice closes (YYYY-MM), or "go-live". */
  period: string;
  lines: InvoiceLine[];
  totalMinor: number;
  currency: Currency;
  status: "open" | "paid" | "void";
  stripeInvoiceId: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
}

export interface ClientKpis {
  callsAnswered: number;
  afterHours: number;
  jobsBooked: number;
  missed: number;
  minutes: number;
}

export interface ClientReport {
  id: string;
  clientId: string;
  period: string;
  token: string;
  kpis: ClientKpis;
  emailId: string | null;
  sentAt: string;
  /** User id, or null when the month-end job sent it. */
  sentBy: string | null;
}

export interface ClientTask {
  id: string;
  clientId: string;
  type: "health_call" | "number_release" | "export_data";
  title: string;
  assigneeId: string | null;
  dueAt: string;
  doneAt: string | null;
  createdAt: string;
}

export interface ClientHealth {
  score: number;
  risk: "low" | "medium" | "high";
  reason: string;
  parts: { usage: number; bookings: number; payment: number; tickets: number };
}

export interface ClientCard {
  id: string;
  /** "proposal" cards are accepted quotes still waiting for the deposit. */
  status: Client["status"] | "proposal";
  companyName: string;
  plan: string;
  /** 0–1: usage against included minutes (live) or onboarding progress. */
  progress: number;
  over: boolean;
  line: string;
  href: string;
}

export interface ClientsOverview {
  cards: ClientCard[];
  count: number;
  /** Current MRR per currency; null for roles without finance totals. */
  mrr: Partial<Record<Currency, number>> | null;
  nextInvoiceAt: string | null;
}

export interface InvoicePreview {
  date: string;
  lines: InvoiceLine[];
  totalMinor: number;
}

export interface ClientDetail {
  client: Client;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  deal: Pick<Deal, "id" | "brand" | "items" | "pilot" | "ownerId">;
  ownerName: string | null;
  plan: string;
  onboarding: OnboardingStep[];
  period: string;
  periods: string[];
  days: UsageDay[];
  usage: { used: number; included: number; overMinutes: number; overFrom: string | null; metered: boolean };
  kpis: ClientKpis;
  health: ClientHealth | null;
  tasks: ClientTask[];
  reports: ClientReport[];
  /** Finance (admin; BDRs see their own client's plan and invoices). Null for the implementer. */
  finance: {
    currency: Currency;
    subscription: Subscription | null;
    next: InvoicePreview | null;
    invoices: Invoice[];
  } | null;
  /** Admin only: our usage cost and margin after usage for the period. */
  costs: { usageCostMinor: number; marginPct: number | null } | null;
  can: { onboard: boolean; status: boolean; report: boolean };
}

export interface PublicClientReport {
  companyName: string;
  brandName: string;
  period: string;
  kpis: ClientKpis;
  includedMinutes: number;
  days: { date: string; minutes: number }[];
}

export interface BillingRun {
  usageDays: number;
  invoices: number;
  reports: number;
  tasks: number;
  autoSteps: number;
}

/** An invoice with its client's name (Money › Payments). */
export interface InvoiceRow extends Invoice {
  companyName: string;
  clientId: string;
}

export interface ClientsApi {
  /** Daily usage import, month-end invoices + reports, auto onboarding steps, health tasks. Idempotent; a cron in Supabase mode. */
  runBillingJobs(): Promise<BillingRun>;
  clientsOverview(): Promise<ClientsOverview>;
  getClient(id: string, period?: string): Promise<ClientDetail>;
  /** Admin: every invoice across clients, newest first. */
  listInvoices(): Promise<InvoiceRow[]>;
  setOnboardingStep(clientId: string, key: OnboardingKey, done: boolean): Promise<void>;
  /** Pause (billing stops from the next period), resume, or cancel (final invoice, number release + export tasks). */
  setClientStatus(clientId: string, status: "live" | "paused" | "churned", reason: string): Promise<void>;
  sendClientReport(clientId: string, period: string): Promise<ClientReport>;
  publicClientReport(token: string): Promise<PublicClientReport | null>;
  completeClientTask(taskId: string): Promise<void>;
  /** CSV of a client's usage days (cancel → export data). */
  exportClientUsage(clientId: string): Promise<string>;
}
