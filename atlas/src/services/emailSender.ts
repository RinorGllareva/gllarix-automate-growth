import { EMAIL_SEND_WINDOW } from "@/config/emailTemplates";
import { QUEUE } from "@/config/queue";
import type { Branding, EmailMessage, Inbox } from "@/data/emailTypes";
import type { Activity, Company, Contact, Lead, Suppression } from "@/data/leadTypes";
import { canContact, isOnOptOutList } from "./compliance";
import { normalizeDomain } from "./dedup";
import { unfinishedParts } from "./templates";
import { isBusinessDay, localDateKey, localHHMM, parseWindow } from "./time";

/** Stages where cold outreach stops (queue.yaml stop_on: reply, opt_out, meeting_booked, won, lost). */
export const STOP_STAGES = new Set(["replied", "meeting_booked", "meeting_completed", "won", "lost"]);

export interface SendContext {
  now: number;
  leads: Map<string, Lead>;
  companies: Map<string, Company>;
  contactsByCompany: Map<string, Contact[]>;
  activitiesByLead: Map<string, Activity[]>;
  suppression: Suppression[];
  inboxes: Inbox[];
  /** Messages already sent per inbox today. */
  sentToday: Map<string, number>;
  /** Last cold email sent per lead (ISO). */
  lastColdEmail: Map<string, string>;
  branding: Branding;
}

export type SendDecision =
  | { id: string; action: "send"; inboxId: string }
  | { id: string; action: "defer"; reason: string }
  | { id: string; action: "block"; reason: string }
  | { id: string; action: "cancel"; reason: string };

/** Today's cap during warm-up. */
export const inboxCapToday = (inbox: Inbox, now: number) => {
  const days = Math.max(0, Math.floor((now - new Date(inbox.warmupStartedAt).getTime()) / 86_400_000));
  return Math.min(inbox.dailyCap, inbox.warmupStart + inbox.warmupStep * days);
};

/**
 * Decide, for each queued message, whether to send it now, wait, block it or cancel it (O3 / M5).
 * Every send runs the compliance check; cold emails also need the lead-local send window,
 * a gap of QUEUE.limits.minDaysBetweenEmails, and an inbox with room under today's cap.
 */
export const planSends = (messages: EmailMessage[], ctx: SendContext): SendDecision[] => {
  const used = new Map(ctx.sentToday);
  const decisions: SendDecision[] = [];
  const brandOf = (lead: Lead) => (lead.listType === "developers" ? "arcadian" : "gllarix");

  for (const m of messages) {
    const lead = ctx.leads.get(m.leadId);
    if (!lead) {
      decisions.push({ id: m.id, action: "cancel", reason: "Lead no longer exists" });
      continue;
    }
    const company = ctx.companies.get(lead.companyId)!;
    const contacts = ctx.contactsByCompany.get(company.id) ?? [];
    const contact = contacts.find((c) => c.id === lead.primaryContactId) ?? contacts[0] ?? null;
    const tz = company.timezone ?? "UTC";

    if (m.notBefore && new Date(m.notBefore).getTime() > ctx.now) {
      decisions.push({ id: m.id, action: "defer", reason: "Scheduled for later" });
      continue;
    }
    if (!m.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.to) || contacts.some((c) => c.email === m.to && c.emailStatus === "invalid")) {
      decisions.push({ id: m.id, action: "block", reason: "No valid email address" });
      continue;
    }
    const recipient = { ...company, domain: normalizeDomain(m.to) ?? company.domain };
    if (lead.suppressed || isOnOptOutList(recipient, contacts, ctx.suppression) || ctx.suppression.some((s) => s.type === "email" && s.value === m.to)) {
      decisions.push({ id: m.id, action: "block", reason: "On the opt-out list" });
      continue;
    }
    if (!m.transactional) {
      if (STOP_STAGES.has(lead.stage)) {
        decisions.push({ id: m.id, action: "cancel", reason: `Cadence stopped (${lead.stage.replace("_", " ")})` });
        continue;
      }
      const ok = canContact({ lead, company, contacts, contact, channel: "email", at: ctx.now, suppression: ctx.suppression, activities: ctx.activitiesByLead.get(lead.id) ?? [] });
      if (!ok.allowed) {
        decisions.push({ id: m.id, action: "block", reason: ok.reasons.join(" · ") });
        continue;
      }
      const [from, to] = parseWindow(EMAIL_SEND_WINDOW);
      const local = localHHMM(ctx.now, tz);
      if (!isBusinessDay(localDateKey(ctx.now, tz)) || local < from || local >= to) {
        decisions.push({ id: m.id, action: "defer", reason: `Outside the send window (${local} local; sends ${from}–${to} on business days)` });
        continue;
      }
      const last = ctx.lastColdEmail.get(lead.id);
      if (last && ctx.now - new Date(last).getTime() < QUEUE.limits.minDaysBetweenEmails * 86_400_000) {
        decisions.push({ id: m.id, action: "defer", reason: `Last email under ${QUEUE.limits.minDaysBetweenEmails} days ago` });
        continue;
      }
    }
    const branding = [!ctx.branding.footerAddress.trim() ? "Set the footer postal address in Admin › Settings (CAN-SPAM)" : null, ...unfinishedParts(`${m.subject}\n${m.body}`)].filter(Boolean) as string[];
    if (branding.length) {
      decisions.push({ id: m.id, action: "defer", reason: branding.join(" · ") });
      continue;
    }
    // Least-used inbox of the lead's brand with room under today's (warm-up) cap.
    const inbox = ctx.inboxes
      .filter((i) => i.active && i.brand === brandOf(lead) && (used.get(i.id) ?? 0) < inboxCapToday(i, ctx.now))
      .sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0))[0];
    if (!inbox) {
      decisions.push({ id: m.id, action: "defer", reason: "Every inbox for this brand is at today's cap" });
      continue;
    }
    used.set(inbox.id, (used.get(inbox.id) ?? 0) + 1);
    if (!m.transactional) ctx.lastColdEmail.set(lead.id, new Date(ctx.now).toISOString());
    decisions.push({ id: m.id, action: "send", inboxId: inbox.id });
  }
  return decisions;
};
