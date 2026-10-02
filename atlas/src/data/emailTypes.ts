import type { TemplateDef } from "@/config/emailTemplates";
import type { Brand } from "./leadTypes";

export interface Inbox {
  id: string;
  address: string;
  brand: Brand;
  senderName: string;
  dailyCap: number;
  /** Warm-up: today's cap = min(dailyCap, warmupStart + warmupStep × days since warmupStartedAt). */
  warmupStart: number;
  warmupStep: number;
  warmupStartedAt: string;
  active: boolean;
}

export interface EmailTemplate extends TemplateDef {
  updatedAt: string;
  updatedBy: string | null;
}

export type EmailKind = "cadence" | "send_info" | "no_show" | "booking_confirmation" | "reminder_24h" | "reminder_1h" | "manual";

export interface EmailMessage {
  id: string;
  leadId: string;
  ownerId: string | null;
  meetingId: string | null;
  kind: EmailKind;
  templateKey: string | null;
  /** Cadence step "day:email", so it's never sent twice. */
  step: string | null;
  to: string | null;
  subject: string;
  body: string;
  transactional: boolean;
  status: "queued" | "sent" | "blocked" | "cancelled";
  /** Why it's blocked, cancelled or still waiting. */
  reason: string | null;
  /** Don't send before (reminders, windows). */
  notBefore: string | null;
  inboxId: string | null;
  threadId: string | null;
  queuedAt: string;
  sentAt: string | null;
  repliedAt: string | null;
  replySnippet: string | null;
  unsubscribedAt: string | null;
}

export interface Branding {
  /** Postal address in every email footer (CAN-SPAM). Sending waits until it's set. */
  footerAddress: string;
  /** Live demo line, used by the trades intro. */
  demoNumber: string;
}

export interface SenderRun {
  at: string;
  sent: number;
  deferred: { id: string; reason: string }[];
  blocked: { id: string; reason: string }[];
  cancelled: number;
  replies: number;
  ms: number;
}

export interface InboxUsage extends Inbox {
  capToday: number;
  sentToday: number;
}

export interface BookingSlot {
  start: string;
  end: string;
}

export interface BookingPage {
  slug: string;
  ownerName: string;
  brand: Brand;
  /** Owner's timezone (slots are also shown in the visitor's own time). */
  timezone: string;
  slots: BookingSlot[];
}

export interface BookingInput {
  slug: string;
  start: string;
  name: string;
  email: string;
  company: string;
  phone?: string;
  country?: string;
  notes?: string;
}

export interface UnsubscribeResult {
  ok: boolean;
  email: string | null;
  alreadyUnsubscribed: boolean;
}
