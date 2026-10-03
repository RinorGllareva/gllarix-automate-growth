import type { QuoteAdjustment, QuoteLine, QuoteResult, QuoteSelection } from "@/services/pricing";
import type { OnboardingStep } from "./clientTypes";
import type { DealRow } from "./salesTypes";

export type QuoteStatus = "draft" | "sent" | "accepted" | "paid" | "superseded";

/** A saved, versioned quote. Sent versions never change; the public page reads them by token. */
export interface Quote {
  id: string;
  dealId: string;
  version: number;
  priceBookVersion: string;
  selection: QuoteSelection;
  currency: "USD" | "EUR";
  setupMinor: number;
  monthlyMinor: number;
  firstYearMinor: number;
  depositMinor: number;
  lines: QuoteLine[];
  adj: QuoteAdjustment[];
  summary: string;
  status: QuoteStatus;
  token: string;
  validUntil: string;
  createdAt: string;
  createdBy: string;
  sentAt: string | null;
  openedAt: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  acceptedIp: string | null;
  checkoutSessionId: string | null;
  paidAt: string | null;
}

/** Extra discount above 10% needs both founders: the second admin decides. */
export interface DiscountApproval {
  id: string;
  dealId: string;
  pct: number;
  note: string | null;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface Payment {
  id: string;
  dealId: string;
  clientId: string | null;
  amountMinor: number;
  currency: "USD" | "EUR";
  type: "setup_deposit" | "setup_balance" | "monthly" | "overage" | "time";
  status: "paid" | "failed" | "refunded";
  stripeEventId: string;
  stripeSessionId: string | null;
  paidAt: string;
}

export interface Client {
  id: string;
  companyId: string;
  leadId: string;
  dealId: string;
  status: "onboarding" | "live" | "paused" | "churned";
  liveAt: string | null;
  churnedAt: string | null;
  churnReason: string | null;
  createdAt: string;
  /** SOP 3 onboarding checklist. */
  onboarding: OnboardingStep[];
}

/** Stripe Checkout session (test mode; faked in demo mode). */
export interface CheckoutSession {
  id: string;
  quoteId: string;
  amountMinor: number;
  currency: "USD" | "EUR";
  description: string;
  status: "open" | "complete";
  url: string;
  createdAt: string;
}

export interface CheckoutCompletedEvent {
  id: string;
  type: "checkout.session.completed";
  created: string;
  data: { object: { id: string; amount_total: number; currency: string; metadata: { quoteId: string; dealId: string } } };
}

export interface InvoicePaidEvent {
  id: string;
  type: "invoice.paid";
  created: string;
  data: { object: { id: string; amount_paid: number; currency: string; metadata: { invoiceId: string } } };
}

/** The Stripe webhook events Atlas handles. */
export type StripeEvent = CheckoutCompletedEvent | InvoicePaidEvent;

export interface DealDetail {
  row: DealRow;
  draft: QuoteSelection;
  result: QuoteResult;
  quotes: Quote[];
  approval: DiscountApproval | null;
  /** Pilots still available for this deal's brand (max 2 per brand). */
  pilotsLeft: number;
  /** False once a quote is accepted or paid. */
  editable: boolean;
  payments: Payment[];
  /** Highest extra discount this user may give without approval. */
  maxDiscount: number;
  /** The primary contact's email, to prefill the contract signer. */
  contactEmail?: string | null;
}

export interface PublicQuote {
  quote: Quote;
  companyName: string;
  contactName: string | null;
  ownerName: string | null;
  brands: ("gllarix" | "arcadian")[];
  terms: string[];
  notIncluded: string;
  expired: boolean;
}

export interface ParityResult {
  name: string;
  expected: { setup: number; monthly: number; firstYear?: number };
  actual: { setup: number; monthly: number; firstYear: number };
  pass: boolean;
}
