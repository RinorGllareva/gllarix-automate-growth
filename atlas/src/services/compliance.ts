import { CALL_BLOCK_LABEL, COUNTRY_RULES } from "@/config/countryRules";
import { countryLabel } from "@/config/leads";
import { QUEUE, type Channel } from "@/config/queue";
import type { Activity, Company, Contact, Lead, Suppression } from "@/data/leadTypes";
import type { ComplianceResult } from "@/data/queueTypes";
import { normalizeDomain } from "./dedup";
import { businessDaysBetween, localDateKey, localHHMM, parseWindow } from "./time";

/** Channels compliance knows about: the queue's, plus texts (cold SMS needs consent almost everywhere). */
export type ComplianceChannel = Channel | "sms";

export interface ContactCheck {
  lead: Lead;
  company: Company;
  contacts: Contact[];
  channel: ComplianceChannel;
  /** "auto" for an autodialer or prerecorded voice. Atlas only dials by hand; this exists so a future dialer is checked. */
  dialer?: "manual" | "auto";
  /** When the contact would happen (ms). */
  at: number;
  suppression: Suppression[];
  /** This lead's activities (for attempt limits). */
  activities: Activity[];
  /** The lead's primary contact, if any. */
  contact: Contact | null;
}

/** Is any phone, email or domain of this company on the opt-out list? Domain entries block every contact at that domain. */
export const isOnOptOutList = (company: Company, contacts: Contact[], suppression: Suppression[]) => {
  const set = new Set(suppression.map((s) => `${s.type}:${s.value}`));
  const domains = [company.domain, ...contacts.map((c) => normalizeDomain(c.email))].filter(Boolean);
  return (
    (company.phone !== null && set.has(`phone:${company.phone}`)) ||
    domains.some((d) => set.has(`domain:${d}`)) ||
    contacts.some((c) => (c.email && set.has(`email:${c.email}`)) || (c.phone && set.has(`phone:${c.phone}`)))
  );
};

/** Call attempts in the last 10 business days, counted in the lead's local calendar. */
export const recentCallAttempts = (activities: Activity[], at: number, tz: string) => {
  const today = localDateKey(at, tz);
  return activities.filter((a) => a.type === "call" && businessDaysBetween(localDateKey(new Date(a.at), tz), today) < 10).length;
};

/**
 * compliance.can_contact (A10): called by the queue builder, the dialer and (from M5) the email sender.
 * Suppression, stage, country channel rules, calling hours in the lead's local time, and attempt limits.
 */
export const canContact = (c: ContactCheck): ComplianceResult => {
  const { lead, company, channel, at } = c;
  const blocked: string[] = [];
  const rule = company.country ? COUNTRY_RULES[company.country] : undefined;
  const market = countryLabel(company.country);

  if (lead.erasedAt) blocked.push("Personal data was erased (GDPR or retention)");
  if (lead.suppressed || isOnOptOutList(company, c.contacts, c.suppression)) blocked.push("On the opt-out list");
  if (lead.stage === "lost" || lead.stage === "won") blocked.push(`Lead is ${lead.stage === "won" ? "a client" : "closed as lost"}`);
  if (!rule) blocked.push(`No outreach rules for ${market} yet`);

  const allowed: string[] = [market];

  if (channel === "call") {
    if (rule && !rule.call) blocked.push(`Cold calls aren't allowed in ${market}`);
    const phone = c.contact?.phone ?? company.phone;
    if (!phone || c.contact?.phoneInvalid) blocked.push("No valid phone number");
    // call_block: number flags that rule out a cold call (e.g. the Swiss directory asterisk).
    const flags = new Set([...(c.contact?.phone ? (c.contact.phoneFlags ?? []) : (company.phoneFlags ?? []))]);
    for (const b of rule?.callBlock ?? []) if (flags.has(b)) blocked.push(`Number is ${CALL_BLOCK_LABEL[b] ?? b}`);
    const mobile = c.contact?.phone ? c.contact.phoneType === "mobile" : false;
    if (c.dialer === "auto" && mobile && rule?.autodialerToMobile !== true) blocked.push(`No autodialed or prerecorded calls to mobiles in ${market}`);
    if (!company.timezone) {
      blocked.push("Local time unknown (no timezone)");
    } else {
      const [from, to] = parseWindow(rule?.callHoursLocal ?? QUEUE.defaultCallHoursLocal);
      const local = localHHMM(at, company.timezone);
      if (local < from || local >= to) blocked.push(`Outside calling hours (${local} local; allowed ${from}–${to})`);
      else allowed.push(`inside calling hours (${local} local)`);
      const attempts = recentCallAttempts(c.activities, at, company.timezone);
      if (attempts >= QUEUE.limits.maxCallAttemptsPer10BusinessDays) {
        blocked.push(`${attempts} call attempts in the last 10 business days (limit ${QUEUE.limits.maxCallAttemptsPer10BusinessDays})`);
      }
    }
    allowed.splice(1, 0, "dialed by hand");
    if (rule?.callRequires?.includes("tps_ctps_screen")) allowed.push("TPS/CTPS screen required before dialing");
  } else if (channel === "sms") {
    if (rule?.smsCold !== true) blocked.push(`Cold texts aren't allowed in ${market} (they need prior consent)`);
    if (!c.contacts.some((x) => x.phone && x.phoneType === "mobile" && !x.phoneInvalid)) blocked.push("No mobile number");
  } else if (channel === "email") {
    if (rule && rule.email === false) blocked.push(`Cold email isn't allowed in ${market}`);
    if (!c.contacts.some((x) => x.email && x.emailStatus !== "invalid")) blocked.push("No valid email address");
    if (rule?.email === "conditional") allowed.push(`conditional: ${rule.notes}`);
  }

  allowed.push("not on the opt-out list");
  return blocked.length ? { allowed: false, reasons: blocked } : { allowed: true, reasons: allowed };
};

/**
 * Retention (A10): is this lead's personal data due for erasure? Lost leads, and leads never worked (no touch,
 * still new or researched), older than `months` since their last touch or creation. Won and active leads are kept.
 */
export const retentionDue = (lead: Lead, at: number, months: number) => {
  if (lead.erasedAt) return false;
  const lost = lead.stage === "lost";
  const unworked = !lead.lastTouchAt && (lead.stage === "new" || lead.stage === "researched") && lead.attemptsCount === 0;
  if (!lost && !unworked) return false;
  // Never-worked leads age from creation; lost ones from their last touch (updatedAt moves on every rescore).
  const since = new Date(lost ? (lead.lastTouchAt ?? lead.updatedAt) : lead.createdAt);
  const cutoff = new Date(at);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return since < cutoff;
};
