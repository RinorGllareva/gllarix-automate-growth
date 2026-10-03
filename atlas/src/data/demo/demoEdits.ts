import { normalizeDomain, normalizeEmail, normalizePhone } from "@/services/dedup";
import { inferTimezone } from "@/services/time";
import type { Activity, Company, Contact, Lead } from "../leadTypes";
import type { EditsApi } from "../editTypes";
import type { EmailMessage } from "../emailTypes";
import type { Meeting } from "../queueTypes";
import type { InvoicePaidEvent } from "../quoteTypes";
import type { Deal } from "../salesTypes";
import type { TrashEntity } from "../trashTypes";
import { AccessError, type User } from "../types";
import type { LeadStore } from "./demoLeads";

interface Ctx {
  load: () => Promise<LeadStore>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: { userId: string; type: "meeting_booked" | "task"; text: string; href: string }) => void;
  activity: (s: LeadStore, a: Omit<Activity, "id" | "at">) => void;
  rescoreLead: (s: LeadStore, lead: Lead) => void;
  canSeeLead: (user: User, lead: Lead) => boolean;
  canSeeDeal: (user: User, deal: Deal) => boolean;
  canSeeMeeting: (user: User, m: Meeting) => boolean;
  queueEmail: (s: LeadStore, lead: Lead, opts: { kind: EmailMessage["kind"]; templateKey: string; meeting?: Meeting; notBefore?: string | null; extraVars?: Record<string, string> }) => unknown;
  trashRecord: (s: LeadStore, collection: string, entityId: string, entity: TrashEntity, label: string, by: string | null) => string;
  /** Seeds the starter pages on first use, like listDocs does. */
  docsOf: (s: LeadStore) => NonNullable<LeadStore["docs"]>;
  applyInvoicePaid: (s: LeadStore, event: InvoicePaidEvent) => void;
}

const NOTE_EDIT_MINUTES = 15;
const money = (minor: number, c: string) => `${c === "USD" ? "$" : "€"}${Math.round(minor / 100).toLocaleString("en-US")}`;

export const createDemoEdits = (ctx: Ctx) => {
  const { load, save, viewer, now, users, uid, audit, notify, activity, rescoreLead, canSeeLead, canSeeDeal, canSeeMeeting, queueEmail, trashRecord, docsOf, applyInvoicePaid } = ctx;
  const iso = () => new Date(now()).toISOString();
  const admin = async (msg = "Founders do this.") => {
    const u = await viewer();
    if (u.role !== "admin") throw new AccessError(403, msg);
    return u;
  };
  const seller = async () => {
    const u = await viewer();
    if (!["admin", "bdr", "closer"].includes(u.role)) throw new AccessError(403);
    return u;
  };
  const leadFor = (s: LeadStore, user: User, leadId: string) => {
    const lead = s.leads.find((l) => l.id === leadId);
    if (!lead) throw new AccessError(404);
    if (!canSeeLead(user, lead)) throw new AccessError(403);
    if (lead.erasedAt) throw new Error("This lead's personal data was erased.");
    return lead;
  };
  const companyOf = (s: LeadStore, lead: Lead) => s.companies.find((c) => c.id === lead.companyId)!;
  const findOr404 = <T extends { id: string }>(list: T[] | undefined, id: string) => {
    const x = list?.find((r) => r.id === id);
    if (!x) throw new AccessError(404);
    return x;
  };

  const api: EditsApi = {
    // ---------------------------------------------------------------- Finance
    async updateExpense(id, patch) {
      const user = await admin("Founders edit expenses.");
      const s = await load();
      const e = findOr404(s.expenses, id);
      const before = { ...e };
      if (patch.amountMinor !== undefined && (!Number.isFinite(patch.amountMinor) || patch.amountMinor <= 0)) throw new Error("Enter an amount above zero.");
      if (patch.vendor !== undefined && !patch.vendor.trim()) throw new Error("The vendor can't be empty.");
      Object.assign(e, patch, patch.vendor ? { vendor: patch.vendor.trim() } : {});
      audit(user.id, "expense.update", "expense", id, before, e);
      await save();
    },
    async deleteExpense(id) {
      const user = await admin("Founders delete expenses.");
      const s = await load();
      const e = findOr404(s.expenses, id);
      const t = trashRecord(s, "expenses", id, "expense", `Expense · ${e.vendor} · ${money(e.amountMinor, e.currency)}`, user.id);
      await save();
      return t;
    },
    async updateCashSnapshot(id, patch) {
      const user = await admin("Founders edit cash snapshots.");
      const s = await load();
      const c = findOr404(s.cashSnapshots, id);
      const before = { ...c };
      if (patch.balanceMinor !== undefined && !Number.isFinite(patch.balanceMinor)) throw new Error("Enter the balance.");
      Object.assign(c, patch);
      audit(user.id, "cash.update", "cash_snapshot", id, before, c);
      await save();
    },
    async deleteCashSnapshot(id) {
      const user = await admin("Founders delete cash snapshots.");
      const s = await load();
      const c = findOr404(s.cashSnapshots, id);
      const t = trashRecord(s, "cashSnapshots", id, "cash_snapshot", `Cash snapshot · ${c.date} · ${money(c.balanceMinor, "EUR")}`, user.id);
      await save();
      return t;
    },

    // ---------------------------------------------------------------- ROI decisions
    async decideSpend(id, verdict, note) {
      const user = await admin("Founders decide spends.");
      const s = await load();
      const d = findOr404(s.decisions, id);
      const proposed = d.status.startsWith("proposed");
      if ((verdict === "agreed" || verdict === "rejected") && !proposed) throw new Error("Only a proposed spend can be agreed or rejected.");
      if ((verdict === "kept" || verdict === "stopped") && d.status !== "agreed") throw new Error("Keep or stop a spend once it's agreed and running.");
      // The founder who proposed it can't agree it alone, as long as there's another founder.
      const otherFounder = users.some((u) => u.role === "admin" && u.active && u.id !== d.createdBy);
      if (verdict === "agreed" && d.createdBy === user.id && otherFounder) throw new Error("The other founder agrees spends you proposed.");
      if (!note.trim() && verdict !== "agreed") throw new Error("Say why, in one line.");
      const before = d.status;
      d.status = verdict;
      d.reason = [d.reason, `${verdict} by ${user.name} on ${iso().slice(0, 10)}${note.trim() ? `: ${note.trim()}` : ""}`].filter(Boolean).join("\n");
      audit(user.id, "decision.decide", "decision", id, { status: before }, { status: verdict, note });
      await save();
    },

    // ---------------------------------------------------------------- Commissions
    async setCommissionStatus(ids, status, reason) {
      const user = await viewer();
      // The accountant pays; founders approve, void and claw back.
      if (status === "paid" ? !["admin", "viewer"].includes(user.role) : user.role !== "admin") throw new AccessError(403);
      if ((status === "void" || status === "clawed_back") && !reason.trim()) throw new Error("A reason is required.");
      const s = await load();
      let n = 0;
      for (const id of ids) {
        const c = s.commissions.find((x) => x.id === id);
        if (!c) continue;
        const allowed =
          status === "earned" ? c.status === "pending" : status === "paid" ? c.status === "earned" : status === "void" ? c.status === "pending" || c.status === "earned" : c.status === "earned" || c.status === "paid";
        if (!allowed) continue;
        const before = c.status;
        c.status = status;
        if (reason.trim()) c.note = [c.note, `${status}: ${reason.trim()}`].filter(Boolean).join(" · ");
        audit(user.id, "commission.status", "commission", c.id, { status: before }, { status, reason });
        if (status === "paid") notify({ userId: c.userId, type: "task", text: `Paid: ${money(c.amountMinor, c.currency)} (${c.type.replace(/_/g, " ")}, ${c.period})`, href: "/commissions" });
        n++;
      }
      if (!n) throw new Error("None of these lines can move to that status.");
      await save();
      return n;
    },

    // ---------------------------------------------------------------- Payments
    async sendInvoiceReminder(invoiceId) {
      const user = await admin("Founders send invoice reminders.");
      const s = await load();
      const inv = findOr404(s.invoices, invoiceId);
      if (inv.status !== "open") throw new Error("Only open invoices get reminders.");
      const client = s.clients.find((c) => c.id === inv.clientId);
      const lead = client ? s.leads.find((l) => l.id === client.leadId) : undefined;
      if (!lead) throw new Error("No contact for this client.");
      const period = inv.period === "go-live" ? "the go-live setup" : new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${inv.period}-01T00:00:00Z`));
      queueEmail(s, lead, {
        kind: "manual",
        templateKey: "invoice_reminder",
        extraVars: { "invoice.total": money(inv.totalMinor, inv.currency), "invoice.due": inv.dueAt.slice(0, 10), "invoice.period": period },
      });
      activity(s, { leadId: lead.id, userId: user.id, type: "email", title: "Invoice reminder sent", detail: `${period} · ${money(inv.totalMinor, inv.currency)}`, disposition: null, durationS: null });
      audit(user.id, "invoice.reminder", "invoice", inv.id, null, null);
      await save();
    },
    async markInvoicePaid(invoiceId, input) {
      const user = await viewer();
      if (user.role !== "admin" && user.role !== "viewer") throw new AccessError(403);
      const s = await load();
      const inv = findOr404(s.invoices, invoiceId);
      if (inv.status !== "open") throw new Error(`This invoice is ${inv.status}.`);
      if (!input.reference.trim()) throw new Error("Add the bank reference, so the books can be matched.");
      const at = new Date(`${input.paidAt}T12:00:00Z`);
      if (Number.isNaN(at.getTime())) throw new Error("Pick the day the money arrived.");
      applyInvoicePaid(s, { id: `manual:${input.reference.trim()}:${uid("ev")}`, type: "invoice.paid", created: at.toISOString(), data: { object: { id: inv.stripeInvoiceId, amount_paid: inv.totalMinor, currency: inv.currency.toLowerCase(), metadata: { invoiceId: inv.id } } } });
      audit(user.id, "invoice.mark_paid", "invoice", inv.id, { status: "open" }, { status: "paid", reference: input.reference.trim(), paidAt: input.paidAt });
      await save();
    },

    // ---------------------------------------------------------------- Leads
    async createLead(input) {
      const user = await seller();
      const s = await load();
      const name = input.company.trim();
      if (!name) throw new Error("Enter the company name.");
      const country = input.country?.trim().toUpperCase() || null;
      const phone = input.phone?.trim() ? normalizePhone(input.phone, country || "US") : null;
      const domain = input.website?.trim() ? normalizeDomain(input.website) : null;
      // Duplicates are blocked before saving: same phone, same domain, or the same name in the same city.
      const dup = s.companies.find(
        (c) => (phone && c.phone === phone) || (domain && c.domain === domain) || (c.name.toLowerCase() === name.toLowerCase() && (c.city ?? "").toLowerCase() === (input.city ?? "").trim().toLowerCase()),
      );
      if (dup) {
        const lead = s.leads.find((l) => l.companyId === dup.id);
        if (lead) return { leadId: lead.id, duplicateOf: lead.id };
      }
      const at = iso();
      const company: Company = {
        id: uid("co"), name, domain, phone, country, region: null, city: input.city?.trim() || null, timezone: inferTimezone(country, null) ?? user.timezone,
        industry: input.industry?.trim() || null, listType: input.listType, brandInterest: [input.brand], employeesEst: null, reviewsCount: null, rating: null,
        sourceId: null, createdAt: at, updatedAt: at,
      };
      const ownerId = user.role === "admin" ? (input.ownerId ?? user.id) : user.id;
      const lead: Lead = {
        id: uid("ld"), companyId: company.id, primaryContactId: null, ownerId, listType: input.listType, stage: "new", score: 0, tier: "D", scoreBreakdown: [],
        scoreModelVersion: "", scoredAt: at, excluded: false, suppressed: false, nextActionAt: null, nextActionType: null, attemptsCount: 0, lastTouchAt: null,
        lawfulBasis: "Legitimate interest (B2B, added by hand)", importJobId: null, cadenceId: null, cadenceStartedAt: null, cadenceStepsDone: [], statusReason: null, createdAt: at, updatedAt: at,
      };
      s.companies.push(company);
      s.leads.push(lead);
      const c = input.contact;
      if (c?.firstName.trim()) {
        const contact: Contact = {
          id: uid("ct"), companyId: company.id, firstName: c.firstName.trim(), lastName: c.lastName.trim(), title: c.title?.trim() || null, email: c.email?.trim() ? normalizeEmail(c.email) : null,
          emailStatus: "unknown", phone: c.phone?.trim() ? normalizePhone(c.phone, country || "US") : null, phoneType: "unknown", phoneVerified: false, phoneInvalid: false, linkedinUrl: null, isDecisionMaker: false,
        };
        s.contacts.push(contact);
        lead.primaryContactId = contact.id;
      }
      activity(s, { leadId: lead.id, userId: user.id, type: "created", title: "Lead added by hand", detail: name, disposition: null, durationS: null });
      rescoreLead(s, lead);
      audit(user.id, "lead.create", "lead", lead.id, null, { company: name });
      await save();
      return { leadId: lead.id };
    },
    async updateCompany(leadId, patch) {
      const user = await seller();
      const s = await load();
      const lead = leadFor(s, user, leadId);
      const company = companyOf(s, lead);
      const before = { ...company };
      if (patch.name !== undefined && !patch.name.trim()) throw new Error("The company needs a name.");
      const country = patch.country !== undefined ? patch.country?.trim().toUpperCase() || null : company.country;
      Object.assign(company, {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.industry !== undefined ? { industry: patch.industry?.trim() || null } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone?.trim() ? normalizePhone(patch.phone, country || "US") : null } : {}),
        ...(patch.domain !== undefined ? { domain: patch.domain?.trim() ? normalizeDomain(patch.domain) : null } : {}),
        ...(patch.city !== undefined ? { city: patch.city?.trim() || null } : {}),
        ...(patch.region !== undefined ? { region: patch.region?.trim() || null } : {}),
        ...(patch.country !== undefined ? { country, timezone: inferTimezone(country, company.region) ?? company.timezone } : {}),
        ...(patch.brandInterest ? { brandInterest: patch.brandInterest } : {}),
        ...(patch.listType ? { listType: patch.listType } : {}),
        updatedAt: iso(),
      });
      if (patch.listType) lead.listType = patch.listType;
      lead.updatedAt = iso();
      const changed = Object.keys(patch).filter((k) => JSON.stringify((before as unknown as Record<string, unknown>)[k]) !== JSON.stringify((company as unknown as Record<string, unknown>)[k]));
      if (changed.length) activity(s, { leadId, userId: user.id, type: "note", title: `Company updated · ${changed.join(", ")}`, detail: null, disposition: null, durationS: null });
      rescoreLead(s, lead);
      audit(user.id, "company.update", "company", company.id, before, company);
      await save();
    },
    async archiveLead(leadId) {
      const user = await admin("Founders archive leads.");
      const s = await load();
      const lead = findOr404(s.leads, leadId);
      const t = trashRecord(s, "leads", leadId, "lead", `Lead · ${companyOf(s, lead)?.name ?? leadId}`, user.id);
      await save();
      return t;
    },
    async deleteContact(contactId) {
      const user = await seller();
      const s = await load();
      const c = findOr404(s.contacts, contactId);
      const lead = s.leads.find((l) => l.companyId === c.companyId);
      if (lead) leadFor(s, user, lead.id);
      if (lead?.primaryContactId === c.id) lead.primaryContactId = s.contacts.find((x) => x.companyId === c.companyId && x.id !== c.id)?.id ?? null;
      const t = trashRecord(s, "contacts", contactId, "contact", `Contact · ${c.firstName} ${c.lastName}`.trim(), user.id);
      if (lead) activity(s, { leadId: lead.id, userId: user.id, type: "note", title: `Contact removed · ${c.firstName} ${c.lastName}`.trim(), detail: null, disposition: null, durationS: null });
      await save();
      return t;
    },
    async updateNote(activityId, text) {
      const user = await seller();
      const s = await load();
      const a = findOr404(s.activities, activityId);
      if (a.type !== "note") throw new Error("Only notes can be edited.");
      const fresh = now() - new Date(a.at).getTime() < NOTE_EDIT_MINUTES * 60_000;
      if (user.role !== "admin" && !(a.userId === user.id && fresh)) throw new AccessError(403, `You can edit your own notes for ${NOTE_EDIT_MINUTES} minutes.`);
      if (!text.trim()) throw new Error("The note can't be empty: delete it instead.");
      const before = a.detail ?? a.title;
      if (a.detail !== null && a.detail !== undefined) a.detail = text.trim();
      else a.title = text.trim();
      audit(user.id, "note.update", "note", a.id, before, text.trim());
      await save();
    },
    async deleteNote(activityId) {
      const user = await seller();
      const s = await load();
      const a = findOr404(s.activities, activityId);
      if (a.type !== "note") throw new Error("Only notes can be deleted. Calls, emails and stage changes stay in the history.");
      if (user.role !== "admin" && a.userId !== user.id) throw new AccessError(403, "You can delete your own notes.");
      const t = trashRecord(s, "activities", activityId, "note", `Note · ${(a.detail ?? a.title).slice(0, 60)}`, user.id);
      await save();
      return t;
    },

    // ---------------------------------------------------------------- Meetings
    async rescheduleMeeting(id, input) {
      const user = await seller();
      const s = await load();
      const m = findOr404(s.meetings, id);
      if (!canSeeMeeting(user, m)) throw new AccessError(403);
      if (m.attended !== null) throw new Error("This meeting already happened (marked held or no-show).");
      const startMs = new Date(input.at).getTime();
      if (!Number.isFinite(startMs) || startMs < now()) throw new Error("Pick a time in the future.");
      if (input.ownerId !== undefined && input.ownerId !== m.ownerId && user.role !== "admin") throw new AccessError(403, "Founders change who runs a meeting.");
      const before = { scheduledAt: m.scheduledAt, type: m.type, withWhom: m.withWhom, ownerId: m.ownerId };
      Object.assign(m, { scheduledAt: new Date(startMs).toISOString(), ...(input.type ? { type: input.type } : {}), ...(input.withWhom?.trim() ? { withWhom: input.withWhom.trim() } : {}), ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}) });
      // Old reminders go; new ones are queued with the confirmation of the new time.
      for (const e of s.outbox) if (e.meetingId === m.id && e.status === "queued") Object.assign(e, { status: "cancelled", reason: "Meeting moved" });
      const lead = s.leads.find((l) => l.id === m.leadId);
      if (lead) {
        queueEmail(s, lead, { kind: "booking_confirmation", templateKey: "booking_confirmation", meeting: m });
        if (startMs - 24 * 3_600_000 > now()) queueEmail(s, lead, { kind: "reminder_24h", templateKey: "reminder_24h", meeting: m, notBefore: new Date(startMs - 24 * 3_600_000).toISOString() });
        if (startMs - 3_600_000 > now()) queueEmail(s, lead, { kind: "reminder_1h", templateKey: "reminder_1h", meeting: m, notBefore: new Date(startMs - 3_600_000).toISOString() });
        lead.nextActionAt = m.scheduledAt;
        activity(s, { leadId: lead.id, userId: user.id, type: "meeting", title: "Meeting moved", detail: `${before.scheduledAt.slice(0, 16).replace("T", " ")} → ${m.scheduledAt.slice(0, 16).replace("T", " ")} UTC`, disposition: null, durationS: null });
      }
      if (m.ownerId && m.ownerId !== user.id) notify({ userId: m.ownerId, type: "meeting_booked", text: `Meeting moved by ${user.name}`, href: `/meetings/${m.id}` });
      audit(user.id, "meeting.reschedule", "meeting", m.id, before, { scheduledAt: m.scheduledAt, type: m.type, withWhom: m.withWhom, ownerId: m.ownerId });
      await save();
    },
    async cancelMeeting(id, reason) {
      const user = await seller();
      const s = await load();
      const m = findOr404(s.meetings, id);
      if (!canSeeMeeting(user, m)) throw new AccessError(403);
      if (m.approved !== null) throw new Error("An approved or rejected meeting can't be cancelled.");
      if (!reason.trim()) throw new Error("Say why it's cancelled.");
      for (const e of s.outbox) if (e.meetingId === m.id && e.status === "queued") Object.assign(e, { status: "cancelled", reason: "Meeting cancelled" });
      const lead = s.leads.find((l) => l.id === m.leadId);
      const label = `Meeting · ${lead ? companyOf(s, lead)?.name : ""} · ${m.scheduledAt.slice(0, 10)}`;
      const t = trashRecord(s, "meetings", id, "meeting", label, user.id);
      if (lead) {
        if (lead.nextActionType === "meeting") Object.assign(lead, { nextActionType: "call", nextActionAt: iso() });
        activity(s, { leadId: lead.id, userId: user.id, type: "meeting", title: "Meeting cancelled", detail: reason.trim(), disposition: null, durationS: null });
      }
      await save();
      return t;
    },

    // ---------------------------------------------------------------- Deals
    async updateDeal(id, patch) {
      const user = await seller();
      const s = await load();
      const d = findOr404(s.deals, id);
      if (!canSeeDeal(user, d) || user.role === "viewer") throw new AccessError(403);
      if ((patch.ownerId !== undefined || patch.brand !== undefined) && user.role !== "admin") throw new AccessError(403, "Founders change the owner or the brand.");
      if (patch.ownerId && !users.some((u) => u.id === patch.ownerId && u.active && ["admin", "bdr", "closer"].includes(u.role))) throw new Error("Pick an active seller or founder.");
      const before = { ownerId: d.ownerId, brand: d.brand, expectedCloseAt: d.expectedCloseAt };
      Object.assign(d, patch, { updatedAt: iso() });
      if (patch.ownerId && patch.ownerId !== before.ownerId) notify({ userId: patch.ownerId, type: "task", text: `${user.name} gave you a deal`, href: `/deals/${d.id}` });
      audit(user.id, "deal.update", "deal", d.id, before, patch);
      await save();
    },
    async deleteDeal(id) {
      const user = await admin("Founders delete deals.");
      const s = await load();
      const d = findOr404(s.deals, id);
      if (s.quotes.some((q) => q.dealId === id && q.sentAt)) throw new Error("A quote was sent on this deal: mark it lost instead, so the history stays.");
      if (s.payments.some((p) => p.dealId === id)) throw new Error("This deal has payments: it can't be deleted.");
      const lead = s.leads.find((l) => l.id === d.leadId);
      const t = trashRecord(s, "deals", id, "deal", `Deal · ${lead ? companyOf(s, lead)?.name : id}`, user.id);
      await save();
      return t;
    },

    // ---------------------------------------------------------------- Growth
    async deleteCompetitor(id) {
      const user = await admin();
      const s = await load();
      const c = findOr404(s.competitors, id);
      const t = trashRecord(s, "competitors", id, "competitor", `Competitor · ${c.name}`, user.id);
      await save();
      return t;
    },
    async addChannel(input) {
      const user = await admin();
      const s = await load();
      if (!input.name.trim()) throw new Error("Name the channel.");
      (s.marketingChannels ??= []).push({ id: uid("ch"), name: input.name.trim(), build: input.build.trim(), owner: input.owner.trim(), due: "", kpi: input.kpi.trim(), status: "not_started", note: "", updatedAt: iso() });
      audit(user.id, "channel.create", "channel", null, null, input);
      await save();
    },
    async deleteChannel(id) {
      const user = await admin();
      const s = await load();
      const c = findOr404(s.marketingChannels, id);
      const t = trashRecord(s, "marketingChannels", id, "channel", `Channel · ${c.name}`, user.id);
      await save();
      return t;
    },
    async deleteExperiment(id) {
      const user = await admin();
      const s = await load();
      const x = findOr404(s.experiments, id);
      const t = trashRecord(s, "experiments", id, "experiment", `Test · ${x.name}`, user.id);
      await save();
      return t;
    },

    // ---------------------------------------------------------------- Ops
    async addSop(input) {
      const user = await admin();
      const s = await load();
      if (!input.title.trim()) throw new Error("Give the SOP a title.");
      const sops = (s.sops ??= []);
      sops.push({ id: uid("sop"), num: sops.reduce((n, x) => Math.max(n, x.num), 0) + 1, title: input.title.trim(), covers: "", owner: input.owner.trim(), due: input.due, status: "not_started", link: null, updatedAt: iso() });
      audit(user.id, "sop.create", "sop", null, null, input);
      await save();
    },
    async deleteSop(id) {
      const user = await admin();
      const s = await load();
      const x = findOr404(s.sops, id);
      const t = trashRecord(s, "sops", id, "sop", `SOP ${x.num} · ${x.title}`, user.id);
      await save();
      return t;
    },

    // ---------------------------------------------------------------- Hiring and training
    async deleteCandidate(id) {
      const user = await admin();
      const s = await load();
      const c = findOr404(s.candidates, id);
      if (c.status === "hired") throw new Error("A hired candidate stays on record.");
      const t = trashRecord(s, "candidates", id, "candidate", `Candidate · ${c.name}`, user.id);
      await save();
      return t;
    },
    async deleteOpening(id) {
      const user = await admin();
      const s = await load();
      const o = findOr404(s.openings, id);
      if ((s.candidates ?? []).some((c) => c.openingId === id && !["rejected"].includes(c.status))) throw new Error("This opening still has candidates: close it instead, or reject them first.");
      const t = trashRecord(s, "openings", id, "opening", `Opening · ${o.role}`, user.id);
      await save();
      return t;
    },
    async updateProgram(id, patch) {
      const user = await admin();
      const s = await load();
      const p = findOr404(s.trainees, id);
      if (patch.name !== undefined && !patch.name.trim()) throw new Error("The trainee needs a name.");
      if (patch.startDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.startDate)) throw new Error("Pick a start date.");
      const before = { name: p.name, role: p.role, startDate: p.startDate };
      Object.assign(p, patch);
      audit(user.id, "training.update", "trainee", id, before, patch);
      await save();
    },
    async cancelProgram(id, reason) {
      const user = await admin();
      const s = await load();
      const p = findOr404(s.trainees, id);
      if (!reason.trim()) throw new Error("Say why the program stops.");
      const t = trashRecord(s, "trainees", id, "program", `Training · ${p.name} (${reason.trim()})`, user.id);
      await save();
      return t;
    },
    async removeBlockScore(traineeId, block, index) {
      const user = await admin();
      const s = await load();
      const p = findOr404(s.trainees, traineeId);
      const b = (p.blocks as Record<string, { scores: number[]; passedAt: string | null }>)[block];
      if (!b) throw new AccessError(404);
      if (b.passedAt) throw new Error("Reopen the gate before changing its scores.");
      if (index < 0 || index >= b.scores.length) throw new AccessError(404);
      const [removed] = b.scores.splice(index, 1);
      audit(user.id, "training.score_remove", "trainee", traineeId, { block, score: removed }, null);
      await save();
    },

    // ---------------------------------------------------------------- Docs
    async listArchivedDocs() {
      await admin();
      const s = await load();
      return docsOf(s).filter((d) => d.archived).map((d) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt }));
    },
    async restoreDoc(id) {
      const user = await admin();
      const s = await load();
      const d = findOr404(docsOf(s), id);
      if (d.parentId && !docsOf(s).some((x) => x.id === d.parentId && !x.archived)) d.parentId = null;
      d.archived = false;
      d.updatedAt = iso();
      audit(user.id, "doc.restore", "doc", id, null, null);
      await save();
    },
    async searchDocs(q) {
      await viewer();
      const s = await load();
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      return docsOf(s)
        .filter((d) => !d.archived && words.every((w) => `${d.title}\n${d.body}`.toLowerCase().includes(w)))
        .map((d) => {
          const i = d.body.toLowerCase().indexOf(words[0]);
          const snippet = i < 0 ? d.body.slice(0, 120) : `${i > 40 ? "…" : ""}${d.body.slice(Math.max(0, i - 40), i + 80)}…`;
          return { id: d.id, title: d.title, snippet: snippet.replace(/[#*`[\]]/g, "").replace(/\s+/g, " ").trim() };
        })
        .slice(0, 20);
    },
    async moveDoc(id, direction) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const s = await load();
      const all = docsOf(s);
      const d = findOr404(all, id);
      const siblings = all.filter((x) => !x.archived && x.parentId === d.parentId).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.title.localeCompare(b.title));
      siblings.forEach((x, i) => (x.order = i));
      const i = siblings.findIndex((x) => x.id === id);
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= siblings.length) return;
      [siblings[i].order, siblings[j].order] = [siblings[j].order, siblings[i].order];
      await save();
    },
  };
  return { api };
};
