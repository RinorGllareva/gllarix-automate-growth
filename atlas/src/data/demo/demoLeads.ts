import { STAGE_LABEL, STAGES } from "@/config/leads";
import { normalizeDomain, normalizeEmail, normalizePhone, phoneDigits, phoneType } from "@/services/dedup";
import { fillEmpty } from "@/services/importPlan";
import { scoreLead } from "@/services/scoring";
import { dispositionByKey, dispositionByLabel } from "@/config/dispositions";
import { QUEUE } from "@/config/queue";
import { canContact, retentionDue } from "@/services/compliance";
import { COUNTRY_RULES, RETENTION_MONTHS_DEFAULT } from "@/config/countryRules";
import type { NightlyRun, ScoreHistoryEntry } from "../leadTypes";
import { planOutcome } from "@/services/outcomes";
import { buildQueue, queueDateFor, shiftFor, whyNow } from "@/services/queue";
import {
  COMM_MIN,
  COMM_MONTHS,
  COMM_PCT,
  DEPOSIT_SHARE,
  DISCOUNT_HARD_MAX,
  DISCOUNT_SELF_MAX,
  LEAD_OFFER,
  listPriceMinor,
  marketForCountry,
  MARKETS,
  PILOTS_PER_BRAND,
  PRICE_BOOK_VERSION,
  PRICE_ITEMS,
  QUOTE_VALID_DAYS,
} from "@/config/priceBook";
import { compute, formatMoney, quoteSummary, selectionFromItems, selectionItems, type QuoteSelection } from "@/services/pricing";
import { runParity } from "@/services/parity";
import { APPROVAL_CHECKS } from "@/config/targets";
import { bonusTotalMinor, meetingBonus } from "@/services/commissions";
import { computeDailyReport, computeReport, currentPeriodKey, meetingStatus } from "@/services/reports";
import { DEFAULT_INBOXES, DEFAULT_TEMPLATES } from "@/config/emailTemplates";
import { industryLabel } from "@/config/leads";
import { openSlots, slugFor } from "@/services/booking";
import { createFakeEmailProvider, type FakeMailbox } from "@/services/emailProvider";
import { inboxCapToday, planSends, STOP_STAGES, type SendContext } from "@/services/emailSender";
import { renderTemplate, unfinishedParts, validateTemplate, type TemplateVars } from "@/services/templates";
import { addBusinessDays, inferTimezone, isoWeekKey, isoWeekRange, localDateKey, localHHMM, parseWindow, shiftDateKey, weekdayOf, zonedToUtc, zoneAbbr } from "@/services/time";
import {
  AccessError,
  PAGE_SIZE,
  type Activity,
  type Company,
  type Contact,
  type ImportJob,
  type Lead,
  type LeadRow,
  type LeadsApi,
  type Notification,
  type QueueApi,
  type SalesApi,
  type EmailApi,
  type DealsApi,
  type DealDetail,
  type DealRow,
  type Deal,
  type Quote,
  type DiscountApproval,
  type Payment,
  type Client,
  type CheckoutSession,
  type CheckoutCompletedEvent,
  type ClientsApi,
  type Branding,
  type EmailMessage,
  type EmailTemplate,
  type Inbox,
  type SenderRun,
  type DailyBdrReport,
  type DealStage,
  type Meeting,
  type MeetingRow,
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  BDR_MAX_STAGE,
  type DailyQueue,
  type QueueRow,
  type QueueView,
  type TodayStats,
  type Source,
  type Suppression,
  type SuppressionType,
  type User,
} from "../types";
import { localTime } from "@/lib/format";
import { idbGet, idbSet } from "./idb";
import { createDemoClients, emptyClientsState, newOnboarding } from "./demoClients";
import { createDemoSources, emptySourcesState } from "./demoSources";
import { createDemoTasks, emptyTasksState } from "./demoTasks";
import { createDemoCapacity, emptyCapacityState } from "./demoCapacity";
import { createDemoPlanner, emptyPlannerState } from "./demoPlanner";
import { createDemoCoaching, emptyCoachingState } from "./demoCoaching";
import { createDemoTime, emptyTimeState } from "./demoTime";
import { createDemoAdvisor, emptyAdvisorState, type AdvisorReadApi } from "./demoAdvisor";
import { createDemoCalendar, emptyCalendarState } from "./demoCalendar";
import type { TeamApi } from "../coachTypes";
import type { TimeApi } from "../timeTypes";
import type { AdvisorApi } from "../advisorTypes";
import type { CalendarApi } from "../calendarTypes";
import type { AutomationsApi, PlannerApi } from "../plannerTypes";
import { mrrEurAt } from "@/services/reports";
import type { SchedPerson, SchedTask } from "@/services/scheduler";
import type { Task } from "../taskTypes";
import type { KpiRow } from "../salesTypes";
import type { CapacityApi } from "../capacityTypes";
import type { TasksApi } from "../taskTypes";
import type { LeadSourcesApi } from "../sourceTypes";
import { generateLeadSeed, type LeadSeed } from "./leadSeed";

const STORE_KEY = "leads-v18";
const CHANNEL = "atlas-demo-leads";

type ClientsExtra = ReturnType<typeof emptyClientsState> & ReturnType<typeof emptySourcesState> & ReturnType<typeof emptyTasksState> & ReturnType<typeof emptyCapacityState> & ReturnType<typeof emptyPlannerState> & ReturnType<typeof emptyCoachingState> & ReturnType<typeof emptyTimeState> & ReturnType<typeof emptyAdvisorState> & ReturnType<typeof emptyCalendarState>;

interface LeadStore extends LeadSeed, ClientsExtra {
  imports: ImportJob[];
  queues: DailyQueue[];
  /** Unsaved call notes per "userId:leadId", so notes survive switching leads. */
  drafts: Record<string, string>;
  /** Months whose meeting approvals are locked ("YYYY-MM"). */
  closedMonths: string[];
  dailyReports: DailyBdrReport[];
  templates: EmailTemplate[];
  inboxes: Inbox[];
  outbox: EmailMessage[];
  branding: Branding;
  mailbox: FakeMailbox;
  senderRuns: SenderRun[];
  lastReplyCheck: string;
  quotes: Quote[];
  discountApprovals: DiscountApproval[];
  payments: Payment[];
  clients: Client[];
  checkoutSessions: CheckoutSession[];
  /** Processed Stripe event ids (webhook idempotency). */
  stripeEvents: string[];
  /** M2: score_history, the nightly job's runs, and retention. */
  scoreHistory: ScoreHistoryEntry[];
  nightlyRuns: NightlyRun[];
  complianceSettings: { retentionMonths: number };
}

interface Deps {
  currentUser: () => Promise<User | null>;
  users: User[];
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  now?: () => number;
  /** Persist to IndexedDB (off in tests). */
  persist?: boolean;
  aiProvider?: import("@/services/aiProvider").AIProvider;
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

const csvEscape = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};


type DemoLeadsApi = LeadsApi & QueueApi & SalesApi & EmailApi & DealsApi & ClientsApi & LeadSourcesApi & TasksApi & CapacityApi & PlannerApi & AutomationsApi & TeamApi & TimeApi & AdvisorApi & CalendarApi;

export const createDemoLeads = ({ currentUser, users, audit, notify, now = Date.now, persist = true, aiProvider }: Deps): DemoLeadsApi => {
  let store: LeadStore | null = null;
  let loading: Promise<LeadStore> | null = null;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

  // Another tab changed the data: reload it on next use.
  channel?.addEventListener("message", () => {
    store = null;
    loading = null;
  });

  const load = async (): Promise<LeadStore> => {
    if (store) return store;
    loading ??= (async () => {
      const saved = persist ? await idbGet<LeadStore>(STORE_KEY) : null;
      store = saved ?? { ...generateLeadSeed(new Date(now())), imports: [], queues: [], drafts: {}, closedMonths: [], dailyReports: [], ...emailSeed(), quotes: [], discountApprovals: [], payments: [], clients: [], checkoutSessions: [], stripeEvents: [], scoreHistory: [], nightlyRuns: [], complianceSettings: { retentionMonths: RETENTION_MONTHS_DEFAULT }, ...emptyClientsState(), ...emptySourcesState(), ...emptyTasksState(), ...emptyCapacityState(), ...emptyPlannerState(), ...emptyCoachingState(), ...emptyTimeState(), ...emptyAdvisorState(), ...emptyCalendarState() };
      if (!saved) {
        // score_history starts with each seeded lead's first score.
        for (const l of store.leads) store.scoreHistory.push({ id: `sh-${l.id}`, leadId: l.id, score: l.score, tier: l.tier, prevScore: null, prevTier: null, modelVersion: l.scoreModelVersion, breakdown: l.scoreBreakdown, reason: "initial", at: l.scoredAt });
        // Two Swiss numbers carry the directory asterisk ("no advertising calls"): compliance blocks cold calls to them.
        store.companies.filter((c) => c.country === "CH" && c.phone).slice(0, 2).forEach((c) => (c.phoneFlags = ["directory_asterisk"]));
        tasksMod.seedTasks(store);
        capacityMod.seedCapacity(store);
        plannerMod.seedAutomations(store);
        coachingMod.seedCalls(store);
        clientsMod.seedClients(store);
        timeMod.seedTime(store, (input): Task => tasksMod.seedDoneTask(store!, input));
        advisorMod.seedAdvisor(store);
      }
      if (!saved && persist) await idbSet(STORE_KEY, store);
      return store;
    })();
    return loading;
  };

  /** Templates, fake inboxes (warming up for 4 days), empty branding so nothing sends until it's set. */
  function emailSeed() {
    const at = new Date(now()).toISOString();
    return {
      templates: DEFAULT_TEMPLATES.map((t) => ({ ...t, updatedAt: at, updatedBy: null })),
      inboxes: DEFAULT_INBOXES.map((i) => ({ ...i, warmupStartedAt: new Date(now() - 4 * 86_400_000).toISOString(), active: true })),
      outbox: [] as EmailMessage[],
      branding: { footerAddress: "", demoNumber: "" },
      mailbox: { sent: [], replies: [] } as FakeMailbox,
      senderRuns: [] as SenderRun[],
      lastReplyCheck: at,
    };
  }

  const save = async () => {
    if (!store || !persist) return;
    await idbSet(STORE_KEY, store);
    channel?.postMessage("changed");
  };

  const iso = () => new Date(now()).toISOString();

  /** Who may see which leads (mirrors the RLS policies in the M1 migration). */
  const viewer = async () => {
    const user = await currentUser();
    if (!user) throw new AccessError(403, "Sign in first.");
    return user;
  };
  const canSeeLead = (user: User, lead: Lead) =>
    user.role === "admin" || ((user.role === "bdr" || user.role === "closer") && lead.ownerId === user.id);
  const requireLeadsAccess = (user: User) => {
    if (!["admin", "bdr", "closer"].includes(user.role)) throw new AccessError(403);
  };
  const requireAdmin = (user: User) => {
    if (user.role !== "admin") throw new AccessError(403);
  };

  const ownerName = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? null) : null);

  const rowFor = (lead: Lead, companies: Map<string, Company>, contacts: Map<string, Contact>, sources: Map<string, Source>): LeadRow => {
    const company = companies.get(lead.companyId)!;
    return {
      lead,
      company,
      contact: lead.primaryContactId ? (contacts.get(lead.primaryContactId) ?? null) : null,
      ownerName: ownerName(lead.ownerId),
      sourceName: company.sourceId ? (sources.get(company.sourceId)?.name ?? null) : null,
    };
  };

  const indexes = (s: LeadStore) => ({
    companies: new Map(s.companies.map((c) => [c.id, c])),
    contacts: new Map(s.contacts.map((c) => [c.id, c])),
    sources: new Map(s.sources.map((c) => [c.id, c])),
  });

  const activity = (s: LeadStore, a: Omit<Activity, "id" | "at"> & { at?: string }) => {
    s.activities.push({ ...a, id: uid("ac"), at: a.at ?? iso() });
  };

  /** Rescore one lead (A8). score_history gets a row only when the score or tier changes (or it's the lead's first score). */
  const rescoreLead = (s: LeadStore, lead: Lead, reason: ScoreHistoryEntry["reason"] = "change") => {
    const company = s.companies.find((c) => c.id === lead.companyId)!;
    const contact = s.contacts.find((c) => c.id === lead.primaryContactId) ?? null;
    const signals = s.signals.filter((g) => g.leadId === lead.id);
    const r = scoreLead({ listType: lead.listType, company, contact, signals, suppressed: lead.suppressed, now: new Date(now()) });
    const changed = r.score !== lead.score || r.tier !== lead.tier;
    const first = !(s.scoreHistory ??= []).some((h) => h.leadId === lead.id);
    if (changed) {
      activity(s, { leadId: lead.id, userId: null, type: "score_change", title: `Score ${lead.tier} ${lead.score} → ${r.tier} ${r.score}`, detail: `Model ${r.modelVersion}`, disposition: null, durationS: null });
    }
    if (changed || first) {
      s.scoreHistory.push({ id: uid("sh"), leadId: lead.id, score: r.score, tier: r.tier, prevScore: first ? null : lead.score, prevTier: first ? null : lead.tier, modelVersion: r.modelVersion, breakdown: r.breakdown, reason: first ? "initial" : reason, at: iso() });
    }
    Object.assign(lead, { score: r.score, tier: r.tier, scoreBreakdown: r.breakdown, scoreModelVersion: r.modelVersion, scoredAt: iso(), excluded: r.excluded });
    return changed;
  };

  /** GDPR erasure / retention: personal data goes; the lead, its stage, score and activity counts stay for stats. */
  const erasePersonal = (s: LeadStore, lead: Lead, why: string, by: string | null) => {
    const company = s.companies.find((c) => c.id === lead.companyId);
    const people = s.contacts.filter((c) => c.companyId === lead.companyId);
    // Keep the identifiers on the opt-out list so an import or list build never brings them back.
    const ids = [...people.flatMap((c) => [c.email && { type: "email" as const, value: c.email.toLowerCase() }, c.phone && { type: "phone" as const, value: c.phone }]), company?.phone && { type: "phone" as const, value: company.phone }].filter(Boolean) as { type: "email" | "phone"; value: string }[];
    for (const x of ids) if (!s.suppression.some((e) => e.type === x.type && e.value === x.value)) s.suppression.push({ id: uid("sp"), type: x.type, value: x.value, reason: "erasure", source: "manual", addedBy: by, createdAt: iso() });
    for (const c of people) Object.assign(c, { firstName: "Erased", lastName: "", title: null, email: null, emailStatus: "unknown", phone: null, phoneVerified: false, linkedinUrl: null });
    for (const a of s.activities.filter((x) => x.leadId === lead.id)) Object.assign(a, { detail: null, title: a.type === "note" ? "Note (erased)" : a.title });
    for (const m of s.outbox.filter((x) => x.leadId === lead.id)) Object.assign(m, { to: "erased", body: "", subject: "(erased)" });
    for (const k of Object.keys(s.drafts)) if (k.endsWith(`:${lead.id}`)) delete s.drafts[k];
    Object.assign(lead, { erasedAt: iso(), suppressed: true, nextActionAt: null, nextActionType: null, statusReason: why });
    activity(s, { leadId: lead.id, userId: by, type: "note", title: "Personal data erased", detail: why, disposition: null, durationS: null });
  };

  const isSuppressed = (s: LeadStore, company: Company, contacts: Contact[]) => {
    const values = new Set(s.suppression.map((x) => `${x.type}:${x.value}`));
    return (
      (company.phone && values.has(`phone:${company.phone}`)) ||
      (company.domain && values.has(`domain:${company.domain}`)) ||
      contacts.some((c) => (c.email && (values.has(`email:${c.email}`) || values.has(`domain:${normalizeDomain(c.email)}`))) || (c.phone && values.has(`phone:${c.phone}`)))
    );
  };

  // ---- M3 helpers: queue building, rows, stats.
  const makeQueue = (s: LeadStore, owner: User) => {
    const companies = new Map(s.companies.map((c) => [c.id, c]));
    const contactsByCompany = new Map<string, Contact[]>();
    for (const c of s.contacts) contactsByCompany.set(c.companyId, [...(contactsByCompany.get(c.companyId) ?? []), c]);
    const activitiesByLead = new Map<string, Activity[]>();
    for (const a of s.activities) if (a.type === "call") activitiesByLead.set(a.leadId, [...(activitiesByLead.get(a.leadId) ?? []), a]);
    return buildQueue({ owner, now: now(), leads: s.leads, companies, contactsByCompany, activitiesByLead, suppression: s.suppression });
  };

  const queueRow = (s: LeadStore, item: DailyQueue["items"][number]): QueueRow => {
    const lead = s.leads.find((l) => l.id === item.leadId)!;
    const company = s.companies.find((c) => c.id === lead.companyId)!;
    const contact = s.contacts.find((c) => c.id === lead.primaryContactId) ?? null;
    return { ...item, lead, company, contact, whyNow: whyNow(lead, item) };
  };

  const viewFor = (s: LeadStore, q: DailyQueue): QueueView => ({
    queue: q,
    rows: q.items.filter((i) => s.leads.some((l) => l.id === i.leadId)).map((i) => queueRow(s, i)),
    done: q.items.filter((i) => i.status !== "open").length,
  });

  const detailFor = (s: LeadStore, lead: Lead) => {
    const { companies, contacts, sources } = indexes(s);
    const row = rowFor(lead, companies, contacts, sources);
    return {
      ...row,
      contacts: s.contacts.filter((c) => c.companyId === lead.companyId),
      signals: s.signals.filter((g) => g.leadId === lead.id).sort((a, b) => b.observedAt.localeCompare(a.observedAt)),
      activities: s.activities.filter((a) => a.leadId === lead.id).sort((a, b) => b.at.localeCompare(a.at)),
      source: row.company.sourceId ? (sources.get(row.company.sourceId) ?? null) : null,
    };
  };

  /** Monday of the owner's local week. */
  const weekStartKey = (tz: string) => {
    const today = localDateKey(now(), tz);
    const back = (weekdayOf(today) + 6) % 7;
    return shiftDateKey(today, -back);
  };

  const statsFor = (s: LeadStore, user: User): TodayStats => {
    const tz = user.timezone;
    const today = localDateKey(now(), tz);
    const week = weekStartKey(tz);
    const calls = s.activities.filter((a) => a.type === "call" && a.userId === user.id && localDateKey(new Date(a.at), tz) === today);
    const conversation = (label: string | null) => Boolean(label && dispositionByLabel(label)?.conversation);
    const booked = s.meetings.filter((m) => m.bookedBy === user.id && localDateKey(new Date(m.createdAt), tz) >= week);
    const soon = now() + 30 * 60_000;
    const callbacksSoon = s.leads
      .filter(
        (l) =>
          l.ownerId === user.id &&
          l.nextActionType === "callback" &&
          l.nextActionAt !== null &&
          new Date(l.nextActionAt).getTime() <= soon &&
          localDateKey(new Date(l.nextActionAt), tz) === today,
      )
      .sort((a, b) => a.nextActionAt!.localeCompare(b.nextActionAt!))
      .map((l) => ({ leadId: l.id, company: s.companies.find((c) => c.id === l.companyId)?.name ?? "—", at: l.nextActionAt! }));
    const mine = user.role === "admin" ? s.meetings : s.meetings.filter((m) => m.bookedBy === user.id);
    return {
      dials: calls.length,
      conversations: calls.filter((a) => conversation(a.disposition)).length,
      meetingsBookedWeek: booked.length,
      approvedWeek: booked.filter((m) => m.approved).length,
      callbacksSoon,
      meetingsAwaitingApproval: mine.filter((m) => m.attended === true && m.approved === null).length,
    };
  };

  // ---- M4 helpers: meetings, deals, reports.
  const LEAD_STAGE_FOR_DEAL: Record<DealStage, Lead["stage"]> = {
    qualified: "qualified",
    meeting_booked: "meeting_booked",
    meeting_held: "meeting_completed",
    opportunity: "opportunity",
    proposal_sent: "proposal_sent",
    negotiation: "negotiation",
    won: "won",
    lost: "lost",
  };

  const canSeeMeeting = (user: User, m: Meeting) => user.role === "admin" || m.bookedBy === user.id || m.ownerId === user.id;
  const monthOf = (iso: string, tz: string) => localDateKey(new Date(iso), tz).slice(0, 7);
  const isLocked = (s: LeadStore, m: Meeting) => s.closedMonths.includes(monthOf(m.scheduledAt, "UTC"));

  const meetingRow = (s: LeadStore, m: Meeting): MeetingRow => {
    const lead = s.leads.find((l) => l.id === m.leadId)!;
    const company = s.companies.find((c) => c.id === lead.companyId)!;
    const status = meetingStatus(m, now());
    return {
      meeting: m,
      lead,
      company,
      contact: s.contacts.find((c) => c.id === lead.primaryContactId) ?? null,
      ownerName: ownerName(m.ownerId),
      bookedByName: ownerName(m.bookedBy),
      status,
      bonus: status === "approved" ? "earned" : status === "to_approve" || status === "to_hold" ? "pending" : "none",
      locked: isLocked(s, m),
    };
  };

  /** The lead's open deal, if any (one open deal per lead in M4). */
  const openDeal = (s: LeadStore, leadId: string) => s.deals.find((d) => d.leadId === leadId && d.stage !== "won" && d.stage !== "lost");

  /** A booked meeting opens a deal for the list's lead offer, or moves the open one to Meeting booked. */
  const dealForMeeting = (s: LeadStore, lead: Lead, userId: string) => {
    const at = iso();
    const existing = openDeal(s, lead.id);
    if (existing) {
      Object.assign(existing, { stage: "meeting_booked", stageChangedAt: at, updatedAt: at });
      return;
    }
    const company = s.companies.find((c) => c.id === lead.companyId)!;
    const market = marketForCountry(company.country);
    const items = [LEAD_OFFER[lead.listType]];
    const price = listPriceMinor(items, market);
    s.deals.push({
      id: uid("dl"),
      leadId: lead.id,
      brand: PRICE_ITEMS.find((i) => i.code === items[0])!.brand,
      stage: "meeting_booked",
      market,
      currency: price.currency,
      setupMinor: price.setupMinor,
      monthlyMinor: price.monthlyMinor,
      pilot: false,
      items,
      ownerId: lead.ownerId ?? userId,
      stageChangedAt: at,
      expectedCloseAt: null,
      wonAt: null,
      lostReason: null,
      lostNote: null,
      depositPaid: false,
      wonOverrideReason: null,
      createdAt: at,
      updatedAt: at,
    });
  };

  /** End-of-shift reports: generated once per BDR per day after the shift, and admins are notified. */
  const ensureDailyReports = (s: LeadStore) => {
    let changed = false;
    for (const u of users.filter((x) => x.active && x.dailyCapacity && x.role !== "admin")) {
      const date = localDateKey(now(), u.timezone);
      const [, to] = shiftFor(u);
      if (now() < zonedToUtc(date, to, u.timezone) || s.dailyReports.some((r) => r.userId === u.id && r.date === date)) continue;
      s.dailyReports.push(dailyFor(s, u, date));
      users
        .filter((a) => a.role === "admin" && a.active)
        .forEach((a) => notify({ userId: a.id, type: "bdr_report", text: `Daily BDR report is ready · ${u.name}`, href: `/reports?person=${u.id}` }));
      changed = true;
    }
    return changed;
  };

  const dailyFor = (s: LeadStore, u: User, date: string) =>
    computeDailyReport({
      user: u,
      date,
      now: now(),
      activities: s.activities,
      meetings: s.meetings,
      queue: s.queues.find((q) => q.ownerId === u.id && q.date === date) ?? null,
      companies: new Map(s.companies.map((c) => [c.id, c])),
      leads: new Map(s.leads.map((l) => [l.id, l])),
    });

  // ---- M5 helpers: email rendering, queueing, sending, replies, booking.
  const origin = () => (typeof location !== "undefined" && location.origin && !location.origin.startsWith("file") ? location.origin : "https://crm.gllarix.com");
  const provider = createFakeEmailProvider(() => store!.mailbox, now);

  const templateFor = (s: LeadStore, key: string) => s.templates.find((t) => t.key === key);

  const varsFor = (s: LeadStore, lead: Lead, messageId: string, meeting?: Meeting, extra: TemplateVars = {}): TemplateVars => {
    const company = s.companies.find((c) => c.id === lead.companyId)!;
    const contact = s.contacts.find((c) => c.id === lead.primaryContactId) ?? s.contacts.find((c) => c.companyId === company.id) ?? null;
    const owner = users.find((u) => u.id === lead.ownerId);
    const market = marketForCountry(company.country);
    const offerCode = LEAD_OFFER[lead.listType];
    const price = listPriceMinor([offerCode], market);
    const sym = price.currency === "USD" ? "$" : "€";
    const tz = company.timezone ?? "UTC";
    return {
      "contact.first_name": contact?.firstName || "there",
      "company.name": company.name,
      "company.trade": industryLabel(company.industry),
      "bdr.name": owner ? owner.name.split(" ")[0] : "The Gllarix team",
      "offer.name": PRICE_ITEMS.find((i) => i.code === offerCode)!.name,
      "offer.price": `${sym}${(price.setupMinor / 100).toLocaleString("en-US")} setup + ${sym}${(price.monthlyMinor / 100).toLocaleString("en-US")}/month`,
      demo_number: s.branding.demoNumber,
      booking_url: owner?.dailyCapacity ? `${origin()}/book/${slugFor(owner.name)}` : "",
      "meeting.time": meeting
        ? `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(new Date(meeting.scheduledAt))} ${localHHMM(new Date(meeting.scheduledAt), tz)} (${zoneAbbr(tz)})`
        : "",
      footer_address: s.branding.footerAddress,
      unsubscribe_url: `${origin()}/u/${messageId}`,
      ...extra,
    };
  };

  /** Put an email in the outbox. The sender decides when (and whether) it goes. */
  const queueEmail = (
    s: LeadStore,
    lead: Lead,
    opts: { kind: EmailMessage["kind"]; templateKey: string; step?: string | null; notBefore?: string | null; meeting?: Meeting; transactional?: boolean; extraVars?: TemplateVars },
  ) => {
    const template = templateFor(s, opts.templateKey);
    if (!template) throw new Error(`Unknown template: ${opts.templateKey}`);
    const id = uid("em");
    const vars = varsFor(s, lead, id, opts.meeting, opts.extraVars);
    const contact = s.contacts.find((c) => c.id === lead.primaryContactId) ?? s.contacts.find((c) => c.companyId === lead.companyId) ?? null;
    const message: EmailMessage = {
      id,
      leadId: lead.id,
      ownerId: lead.ownerId,
      meetingId: opts.meeting?.id ?? null,
      kind: opts.kind,
      templateKey: template.key,
      step: opts.step ?? null,
      to: contact?.email ?? null,
      subject: renderTemplate(template.subject, vars),
      body: renderTemplate(template.body, vars),
      transactional: opts.transactional ?? template.transactional,
      status: "queued",
      reason: null,
      notBefore: opts.notBefore ?? null,
      inboxId: null,
      threadId: null,
      queuedAt: iso(),
      sentAt: null,
      repliedAt: null,
      replySnippet: null,
      unsubscribedAt: null,
    };
    s.outbox.push(message);
    return message;
  };

  /** A reply stops the cadence (stop_on: reply): stage Replied, cold emails cancelled, a follow-up call next business day. */
  const applyReply = (s: LeadStore, message: EmailMessage, snippet: string, at: string) => {
    if (message.repliedAt) return false;
    message.repliedAt = at;
    message.replySnippet = snippet;
    const lead = s.leads.find((l) => l.id === message.leadId);
    if (!lead) return false;
    const company = s.companies.find((c) => c.id === lead.companyId)!;
    const tz = company.timezone ?? "UTC";
    const [first] = parseWindow(QUEUE.windows[lead.listType].call[0]);
    const next = zonedToUtc(addBusinessDays(localDateKey(now(), tz), 1), first, tz);
    activity(s, { leadId: lead.id, userId: null, type: "email", title: "Replied to an email", detail: `"${snippet}" · re: ${message.subject}`, disposition: null, durationS: null });
    if (!STOP_STAGES.has(lead.stage)) {
      activity(s, { leadId: lead.id, userId: null, type: "stage_change", title: `Stage · ${STAGE_LABEL[lead.stage]} → Replied`, detail: "Cadence stopped on reply", disposition: null, durationS: null });
      Object.assign(lead, { stage: "replied", cadenceId: null, nextActionType: "follow_up", nextActionAt: new Date(next).toISOString(), lastTouchAt: at, updatedAt: at });
    }
    for (const m of s.outbox) if (m.leadId === lead.id && m.status === "queued" && !m.transactional) Object.assign(m, { status: "cancelled", reason: "Contact replied" });
    for (const q of s.queues) for (const i of q.items) if (i.leadId === lead.id && i.status === "open" && i.channel !== "call") Object.assign(i, { status: "removed", doneAt: at, note: "Replied" });
    if (lead.ownerId) notify({ userId: lead.ownerId, type: "task", text: `${company.name} replied to your email`, href: `/leads/${lead.id}` });
    return true;
  };

  const sendContext = (s: LeadStore): SendContext => {
    const today = new Date(now()).toISOString().slice(0, 10);
    const sentToday = new Map<string, number>();
    const lastColdEmail = new Map<string, string>();
    for (const m of s.outbox) {
      if (m.status !== "sent" || !m.sentAt) continue;
      if (m.inboxId && m.sentAt.slice(0, 10) === today) sentToday.set(m.inboxId, (sentToday.get(m.inboxId) ?? 0) + 1);
      if (!m.transactional && (!lastColdEmail.get(m.leadId) || lastColdEmail.get(m.leadId)! < m.sentAt)) lastColdEmail.set(m.leadId, m.sentAt);
    }
    const contactsByCompany = new Map<string, Contact[]>();
    for (const c of s.contacts) contactsByCompany.set(c.companyId, [...(contactsByCompany.get(c.companyId) ?? []), c]);
    const activitiesByLead = new Map<string, Activity[]>();
    for (const a of s.activities) if (a.type === "call") activitiesByLead.set(a.leadId, [...(activitiesByLead.get(a.leadId) ?? []), a]);
    return {
      now: now(),
      leads: new Map(s.leads.map((l) => [l.id, l])),
      companies: new Map(s.companies.map((c) => [c.id, c])),
      contactsByCompany,
      activitiesByLead,
      suppression: s.suppression,
      inboxes: s.inboxes,
      sentToday,
      lastColdEmail,
      branding: s.branding,
    };
  };

  // ---- M6 helpers: quote builder, pilots, discounts, Stripe.
  /** Pilots used = won deals with pilot pricing for the brand (max 2 per brand). */
  const pilotsLeftFor = (s: LeadStore, brand: Deal["brand"], exceptDealId?: string) =>
    Math.max(0, PILOTS_PER_BRAND - s.deals.filter((d) => d.brand === brand && d.stage === "won" && d.pilot && d.id !== exceptDealId).length);

  const maxDiscountFor = (user: User) => (user.role === "admin" || user.role === "closer" ? DISCOUNT_SELF_MAX : 0);

  const draftOf = (d: Deal) => {
    if (d.draft) return d.draft;
    const sel = selectionFromItems(d.items, d.market, d.pilot);
    sel.bdr = true;
    return sel;
  };

  const dealRowFor = (s: LeadStore, d: Deal): DealRow => {
    const lead = s.leads.find((l) => l.id === d.leadId)!;
    const next = s.meetings.filter((m) => m.leadId === d.leadId && new Date(m.scheduledAt).getTime() > now()).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
    return { deal: d, lead, company: s.companies.find((c) => c.id === lead.companyId)!, ownerName: ownerName(d.ownerId), nextMeetingAt: next?.scheduledAt ?? null };
  };

  const canSeeDeal = (user: User, d: Deal) => user.role === "admin" || user.role === "viewer" || d.ownerId === user.id;
  const canEditDeal = (user: User, d: Deal) => user.role === "admin" || ((user.role === "bdr" || user.role === "closer") && d.ownerId === user.id);

  const approvedDiscount = (s: LeadStore, dealId: string) =>
    s.discountApprovals.filter((a) => a.dealId === dealId && a.status === "approved").reduce((max, a) => Math.max(max, a.pct), 0);

  const dealDetail = (s: LeadStore, user: User, d: Deal): DealDetail => {
    const draft = draftOf(d);
    const quotes = s.quotes.filter((q) => q.dealId === d.id).sort((a, b) => b.version - a.version);
    return {
      row: dealRowFor(s, d),
      draft,
      result: compute(draft),
      quotes,
      approval: s.discountApprovals.filter((a) => a.dealId === d.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null,
      pilotsLeft: pilotsLeftFor(s, d.brand, d.id),
      editable: !quotes.some((q) => q.status === "accepted" || q.status === "paid") && d.stage !== "won" && d.stage !== "lost",
      payments: s.payments.filter((p) => p.dealId === d.id),
      maxDiscount: Math.max(maxDiscountFor(user), user.role === "bdr" ? 0 : approvedDiscount(s, d.id)),
    };
  };

  /** Server-side checks for a draft: BDRs give no extra discount, >10% needs an approved request, pilots are capped. */
  const checkDraft = (s: LeadStore, user: User, d: Deal, sel: QuoteSelection) => {
    if (sel.disc < 0 || sel.disc > DISCOUNT_HARD_MAX) throw new Error(`Extra discount must be 0–${DISCOUNT_HARD_MAX}%.`);
    if (sel.disc > 0 && user.role === "bdr") throw new AccessError(403, "BDRs quote from the price book without extra discount.");
    if (sel.disc > DISCOUNT_SELF_MAX && sel.disc > approvedDiscount(s, d.id)) {
      throw new Error(`An extra discount above ${DISCOUNT_SELF_MAX}% needs both founders. Request approval first.`);
    }
    if (sel.pilot && !d.pilot && pilotsLeftFor(s, d.brand, d.id) === 0) throw new Error(`No pilots left for ${d.brand === "gllarix" ? "Gllarix" : "Arcadian"} (max ${PILOTS_PER_BRAND}).`);
    if (!MARKETS[sel.market]) throw new Error("Unknown market.");
  };

  /** checkout.session.completed: payment, Won, client, setup commission. Idempotent by event id. */
  const applyCheckoutCompleted = (s: LeadStore, event: CheckoutCompletedEvent) => {
    const obj = event.data.object;
    const quote = s.quotes.find((q) => q.id === obj.metadata.quoteId);
    const deal = s.deals.find((d) => d.id === obj.metadata.dealId);
    if (!quote || !deal) throw new Error("Unknown quote or deal in the Stripe event.");
    const at = event.created;
    const lead = s.leads.find((l) => l.id === deal.leadId)!;
    let client = s.clients.find((c) => c.dealId === deal.id);
    if (!client) {
      client = { id: uid("cl"), companyId: lead.companyId, leadId: lead.id, dealId: deal.id, status: "onboarding", liveAt: null, churnedAt: null, churnReason: null, createdAt: at, onboarding: newOnboarding(users.find((u) => u.role === "implementer" && u.active)?.id ?? null) };
      s.clients.push(client);
    }
    s.payments.push({
      id: uid("py"), dealId: deal.id, clientId: client.id, amountMinor: obj.amount_total, currency: quote.currency,
      type: "setup_deposit", status: "paid", stripeEventId: event.id, stripeSessionId: obj.id, paidAt: at,
    });
    Object.assign(quote, { status: "paid", paidAt: at });
    const before = deal.stage;
    Object.assign(deal, {
      stage: "won", wonAt: at, depositPaid: true, stageChangedAt: at, updatedAt: at,
      setupMinor: quote.setupMinor, monthlyMinor: quote.monthlyMinor, pilot: quote.selection.pilot, items: selectionItems(quote.selection), currency: quote.currency,
    });
    Object.assign(lead, { stage: "won", updatedAt: at, nextActionAt: null, nextActionType: null, cadenceId: null });
    activity(s, { leadId: lead.id, userId: null, type: "stage_change", title: `Deal · ${DEAL_STAGE_LABEL[before]} → Won`, detail: `Deposit paid · ${formatMoney(obj.amount_total / 100, quote.selection.market)} (Stripe test mode)`, disposition: null, durationS: null });
    // Setup commission: 10% of setup, minimum 100, on cash collected; earnable after the 30-day clawback window.
    const owner = users.find((u) => u.id === deal.ownerId);
    if (owner && (owner.role === "bdr" || owner.role === "closer") && !s.commissions.some((c) => c.dealId === deal.id && c.type === "setup_commission")) {
      const setupMajor = quote.setupMinor / 100;
      s.commissions.push({
        id: uid("cm"), userId: owner.id, meetingId: null, dealId: deal.id, type: "setup_commission",
        amountMinor: Math.round(Math.max(COMM_MIN, setupMajor * COMM_PCT) * 100), currency: quote.currency, status: "pending",
        period: at.slice(0, 7), earnableAt: new Date(new Date(at).getTime() + 30 * 86_400_000).toISOString(),
        note: `10% of setup (min ${COMM_MIN}); recurring 10% × ${COMM_MONTHS} months is added as monthly fees are collected (M7)`, createdAt: at,
      });
    }
    users.filter((u) => u.role === "admin" && u.active).forEach((u) => notify({ userId: u.id, type: "payment_paid", text: `Deposit paid · ${s.companies.find((c) => c.id === lead.companyId)?.name} · ${formatMoney(obj.amount_total / 100, quote.selection.market)}`, href: `/deals/${deal.id}` }));
    // Automations (M11): e.g. deal Won → Gllarix onboarding tasks.
    plannerMod.fire(s, { type: "deal_won", dealId: deal.id, leadId: lead.id, brand: deal.brand, ownerId: deal.ownerId, clientId: client.id, pilot: deal.pilot });
    audit(null, "stripe.checkout_completed", "deal", null, { stage: before }, { dealId: deal.id, eventId: event.id, amountMinor: obj.amount_total });
  };

  // ---- M7: clients, usage and billing (demoClients.ts).
  const clientsMod = createDemoClients<LeadStore>({
    load, save, viewer, now, users, uid, audit, notify, activity, origin,
    queueEmail: (s, lead, opts) => queueEmail(s, lead, opts),
    addTask: (s, input): Task => tasksMod.addSystemTask(s, input),
    completeTask: (s, id, userId): void => tasksMod.completeTask(s, id, userId),
  });

  // ---- M9: tasks (demoTasks.ts). Links resolve to CRM records; a lead also shows its deals', meetings' and client's tasks.
  const companyName = (s: LeadStore, leadId: string) => s.companies.find((c) => c.id === s.leads.find((l) => l.id === leadId)?.companyId)?.name ?? "—";
  const tasksMod = createDemoTasks<LeadStore>({
    load, save, viewer, now, users, uid, audit, notify,
    describeLink: (s, type, id) => {
      if (type === "lead") return s.leads.some((l) => l.id === id) ? { label: `Lead · ${companyName(s, id)}`, href: `/leads/${id}` } : null;
      if (type === "deal") {
        const d = s.deals.find((x) => x.id === id);
        return d ? { label: `Deal · ${companyName(s, d.leadId)} · ${DEAL_STAGE_LABEL[d.stage]}`, href: `/deals/${id}` } : null;
      }
      if (type === "client") {
        const c = s.clients.find((x) => x.id === id);
        return c ? { label: `Client · ${companyName(s, c.leadId)}`, href: `/clients/${id}` } : null;
      }
      const m = s.meetings.find((x) => x.id === id);
      return m ? { label: `Meeting · ${companyName(s, m.leadId)} · ${m.scheduledAt.slice(0, 10)}`, href: `/leads/${m.leadId}` } : null;
    },
    onEvent: (s, e): void => plannerMod.fire(s, e),
    onTick: (s): boolean => plannerMod.tick(s),
    isWeekLocked: (s, userId, startedAt): boolean => timeMod.isLocked(s, userId, startedAt),
    relatedToLead: (s, leadId) => [
      ...s.deals.filter((d) => d.leadId === leadId).map((d) => ({ type: "deal" as const, id: d.id })),
      ...s.meetings.filter((m) => m.leadId === leadId).map((m) => ({ type: "meeting" as const, id: m.id })),
      ...s.clients.filter((c) => c.leadId === leadId).map((c) => ({ type: "client" as const, id: c.id })),
    ],
  });

  // ---- M10: capacity, timeline, workload (demoCapacity.ts; scheduler in services/scheduler.ts).
  const capacityMod = createDemoCapacity<LeadStore>({
    load, save, viewer, now, users, uid, audit,
    canSeeTask: (s, user, t): boolean => tasksMod.canSee(s, user, t),
    updateTask: (s, user, id, patch): void => tasksMod.patchTask(s, user, id, patch),
    createTask: (s, user, input): void => {
      tasksMod.addTaskAs(s, user, input);
    },
  });

  // ---- M11: AI planner, automations, templates, goals (demoPlanner.ts).
  const plannerMod = createDemoPlanner<LeadStore>({
    load, save, viewer, now, users, uid, audit, notify, provider: aiProvider,
    schedPeople: (s): SchedPerson[] => capacityMod.schedPeople(s),
    schedTasks: (s): SchedTask[] => capacityMod.schedTasks(s),
    canSeeTask: (s, user, t): boolean => tasksMod.canSee(s, user, t),
    patchTask: (s, user, id, patch): void => tasksMod.patchTask(s, user, id, patch),
    addAiTask: (s, user, input): Task => tasksMod.addAiTask(s, user, input),
    addSystemTask: (s, input): Task => tasksMod.addSystemTask(s, input),
    addDep: (s, a, b): void => tasksMod.addDep(s, a, b),
    systemPatch: (s, id, patch, text): void => tasksMod.systemPatch(s, id, patch, text),
    companyOfDeal: (s, dealId): string => companyName(s, s.deals.find((d) => d.id === dealId)?.leadId ?? ""),
    kpiValue: (s, kpi): number => {
      const month = new Date(now()).toISOString().slice(0, 7);
      if (kpi === "mrr_eur") return Math.round(mrrEurAt(s.deals, now(), s.clients));
      if (kpi === "paying_clients") return s.clients.filter((c) => c.status !== "churned" && s.payments.some((p) => p.dealId === c.dealId && p.status === "paid")).length || s.clients.filter((c) => c.status === "live").length;
      if (kpi === "approved_meetings_month") return s.meetings.filter((m) => m.approved === true && m.scheduledAt.startsWith(month)).length;
      if (kpi === "meetings_booked_month") return s.meetings.filter((m) => m.createdAt.startsWith(month)).length;
      return s.deals.filter((d) => d.stage === "won").length;
    },
  });

  // ---- M12: team performance and AI coaching (demoCoaching.ts).
  const coachingMod = createDemoCoaching<LeadStore>({
    load, save, viewer, now, users, uid, audit, notify,
    addSystemTask: (s, input): Task => tasksMod.addSystemTask(s, input),
    weekKpis: (s, userId, week): KpiRow[] =>
      computeReport({
        now: now(), tz: users.find((u) => u.id === userId)?.timezone ?? "UTC", period: { kind: "week", key: week }, personId: userId, users,
        activities: s.activities, meetings: s.meetings, deals: s.deals, leads: s.leads, clients: s.clients,
      }).kpis,
  });

  // ---- M13: time tracking, timesheets, time reports (demoTime.ts).
  const timeMod = createDemoTime<LeadStore>({
    load, save, viewer, now, users, uid, audit, notify,
    logTask: (s, taskId, userId, text): void => {
      s.taskActivity.push({ id: uid("ta"), taskId, userId, at: new Date(now()).toISOString(), text });
    },
    companyOfClient: (s, clientId): string => companyName(s, s.clients.find((c) => c.id === clientId)?.leadId ?? ""),
  });

  // ---- M14: AI co-founder (demoAdvisor.ts; provider in services/advisor.ts). Tools call this module's own API as the asking user.
  const advisorMod = createDemoAdvisor<LeadStore>({
    load, save, viewer, now, users, uid, audit, notify,
    api: (): AdvisorReadApi => self,
    canSeeTask: (s, user, t): boolean => tasksMod.canSee(s, user, t),
    canSeeLead: (user, lead): boolean => canSeeLead(user, lead),
    mrrEur: (s): number => mrrEurAt(s.deals, now(), s.clients),
    createTask: (s, user, input): Task => tasksMod.addAdvisorTask(s, user, input),
  });

  // ---- Calendar, Google Calendar per person, staff email alerts (demoCalendar.ts).
  const calendarMod = createDemoCalendar<LeadStore>({ load, save, viewer, now, users, uid, audit, notify });

  // ---- M8: lead sources, list build, enrichment (demoSources.ts).
  const sourcesMod = createDemoSources<LeadStore>({
    load, save, viewer, now, users, uid, audit, notify, activity, rescoreLead,
    shortfallFor: (s, owner) => makeQueue(s, owner).summary.shortfall,
  });

  const self: DemoLeadsApi = {
    ...clientsMod.api,
    ...sourcesMod.api,
    ...tasksMod.api,
    ...capacityMod.api,
    ...plannerMod.planner,
    ...plannerMod.automationsApi,
    ...coachingMod.api,
    ...timeMod.api,
    ...advisorMod.api,
    ...calendarMod.api,
    async listLeads(q) {
      const user = await viewer();
      requireLeadsAccess(user);
      const s = await load();
      const { companies, contacts, sources } = indexes(s);
      const visible = s.leads.filter((l) => canSeeLead(user, l));
      const needle = q.q.trim().toLowerCase();
      const digits = phoneDigits(needle);

      const matches = visible.filter((l) => {
        const c = companies.get(l.companyId)!;
        if (q.tiers.length && !q.tiers.includes(l.tier)) return false;
        if (q.lists.length && !q.lists.includes(l.listType)) return false;
        if (q.countries.length && !q.countries.includes(c.country ?? "")) return false;
        if (q.stages.length && !q.stages.includes(l.stage)) return false;
        if (q.owners.length && !q.owners.includes(l.ownerId ?? "none")) return false;
        if (q.sources.length && !q.sources.includes(c.sourceId ?? "")) return false;
        if (q.brands.length && !q.brands.some((b) => c.brandInterest.includes(b))) return false;
        if (needle) {
          const hit =
            c.name.toLowerCase().includes(needle) ||
            (c.domain ?? "").includes(needle) ||
            (digits.length >= 4 && phoneDigits(c.phone ?? "").includes(digits));
          if (!hit) return false;
        }
        return true;
      });

      const at = new Date(now());
      // Local time once per timezone (Intl formatting inside the sort comparator was the slow part).
      const byTz = new Map<string | null, string>();
      const local = (l: Lead) => {
        const tz = companies.get(l.companyId)!.timezone;
        let v = byTz.get(tz);
        if (v === undefined) byTz.set(tz, (v = localTime(tz, at)));
        return v;
      };
      const stageIndex = (l: Lead) => STAGES.indexOf(l.stage);
      const dir = q.dir === "asc" ? 1 : -1;
      const cmp: Record<typeof q.sort, (a: Lead, b: Lead) => number> = {
        score: (a, b) => (a.score - b.score) * dir || local(a).localeCompare(local(b)),
        company: (a, b) => companies.get(a.companyId)!.name.localeCompare(companies.get(b.companyId)!.name) * dir,
        stage: (a, b) => (stageIndex(a) - stageIndex(b)) * dir,
        owner: (a, b) => (ownerName(a.ownerId) ?? "~").localeCompare(ownerName(b.ownerId) ?? "~") * dir,
        last: (a, b) => (a.lastTouchAt ?? "").localeCompare(b.lastTouchAt ?? "") * dir,
        next: (a, b) => (a.nextActionAt ?? "9").localeCompare(b.nextActionAt ?? "9") * dir,
      };
      matches.sort(cmp[q.sort]);

      const start = Math.max(0, q.page - 1) * PAGE_SIZE;
      return {
        rows: matches.slice(start, start + PAGE_SIZE).map((l) => rowFor(l, companies, contacts, sources)),
        total: matches.length,
        visibleTotal: visible.length,
        visibleAB: visible.filter((l) => l.tier === "A" || l.tier === "B").length,
        matchingIds: matches.map((l) => l.id),
      };
    },

    async getLead(id) {
      const user = await viewer();
      requireLeadsAccess(user);
      const s = await load();
      const lead = s.leads.find((l) => l.id === id);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      const d = detailFor(s, lead);
      const check = (channel: "call" | "email" | "sms") =>
        canContact({ lead, company: d.company, contacts: d.contacts, contact: d.contact, channel, at: now(), suppression: s.suppression, activities: d.activities });
      return {
        ...d,
        scoreHistory: (s.scoreHistory ?? []).filter((h) => h.leadId === id).sort((a, b) => b.at.localeCompare(a.at)),
        compliance: { call: check("call"), email: check("email"), sms: check("sms") },
      };
    },

    async updateLead(id, patch) {
      const user = await viewer();
      const s = await load();
      const lead = s.leads.find((l) => l.id === id);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      if (patch.ownerId !== undefined && user.role !== "admin") throw new AccessError(403, "Only admins change owners.");
      const before = { stage: lead.stage, ownerId: lead.ownerId };
      if (patch.stage && patch.stage !== lead.stage) {
        activity(s, { leadId: id, userId: user.id, type: "stage_change", title: `Stage · ${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[patch.stage]}`, detail: null, disposition: null, durationS: null });
        lead.stage = patch.stage;
      }
      if (patch.ownerId !== undefined && patch.ownerId !== lead.ownerId) {
        activity(s, { leadId: id, userId: user.id, type: "owner_change", title: `Owner · ${ownerName(lead.ownerId) ?? "Unassigned"} → ${ownerName(patch.ownerId) ?? "Unassigned"}`, detail: null, disposition: null, durationS: null });
        lead.ownerId = patch.ownerId;
      }
      lead.updatedAt = iso();
      audit(user.id, "lead.update", "lead", id, before, { stage: lead.stage, ownerId: lead.ownerId });
      await save();
    },

    async addNote(leadId, text) {
      const user = await viewer();
      const s = await load();
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      const body = text.trim();
      if (!body) return;
      activity(s, { leadId, userId: user.id, type: "note", title: `Note · ${user.name}`, detail: body, disposition: null, durationS: null });
      lead.updatedAt = iso();
      audit(user.id, "lead.note", "lead", leadId, null, { text: body });
      await save();
    },

    async setPrimaryContact(leadId, contactId) {
      const user = await viewer();
      const s = await load();
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      const before = lead.primaryContactId;
      lead.primaryContactId = contactId;
      lead.updatedAt = iso();
      rescoreLead(s, lead);
      audit(user.id, "lead.primary_contact", "lead", leadId, { primaryContactId: before }, { primaryContactId: contactId });
      await save();
    },

    async markContact(contactId, patch) {
      const user = await viewer();
      const s = await load();
      const contact = s.contacts.find((c) => c.id === contactId);
      if (!contact) throw new AccessError(404);
      const lead = s.leads.find((l) => l.companyId === contact.companyId);
      if (!lead || !canSeeLead(user, lead)) throw new AccessError(403);
      const before = { emailStatus: contact.emailStatus, phoneInvalid: contact.phoneInvalid };
      if (patch.emailInvalid !== undefined) contact.emailStatus = patch.emailInvalid ? "invalid" : "unknown";
      if (patch.phoneInvalid !== undefined) contact.phoneInvalid = patch.phoneInvalid;
      rescoreLead(s, lead);
      audit(user.id, "contact.update", "contact", contactId, before, { emailStatus: contact.emailStatus, phoneInvalid: contact.phoneInvalid });
      await save();
    },

    async setCadence(leadIds, cadenceId) {
      const user = await viewer();
      requireLeadsAccess(user);
      if (cadenceId !== null && !QUEUE.cadences[cadenceId]) throw new Error("Unknown cadence.");
      const s = await load();
      const ids = new Set(leadIds);
      let n = 0;
      for (const lead of s.leads) {
        if (!ids.has(lead.id) || !canSeeLead(user, lead)) continue;
        // Closed, suppressed or erased leads never go back on a cadence.
        if (cadenceId && (lead.stage === "won" || lead.stage === "lost" || lead.suppressed || lead.erasedAt)) continue;
        Object.assign(lead, { cadenceId, cadenceStartedAt: null, cadenceStepsDone: [], updatedAt: iso() });
        activity(s, { leadId: lead.id, userId: user.id, type: "note", title: cadenceId ? `Added to cadence ${cadenceId}` : "Taken off the cadence", detail: null, disposition: null, durationS: null });
        n += 1;
      }
      audit(user.id, "lead.set_cadence", "lead", null, null, { count: n, cadenceId });
      await save();
      return n;
    },

    async bulkAssign(leadIds, ownerId, listType) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const ids = new Set(leadIds);
      let n = 0;
      for (const lead of s.leads) {
        if (!ids.has(lead.id)) continue;
        if (lead.ownerId !== ownerId) {
          activity(s, { leadId: lead.id, userId: user.id, type: "owner_change", title: `Owner · ${ownerName(lead.ownerId) ?? "Unassigned"} → ${ownerName(ownerId) ?? "Unassigned"}`, detail: "Bulk assign", disposition: null, durationS: null });
        }
        lead.ownerId = ownerId;
        if (listType && listType !== lead.listType) {
          lead.listType = listType;
          rescoreLead(s, lead);
        }
        lead.updatedAt = iso();
        n += 1;
      }
      audit(user.id, "lead.bulk_assign", "lead", null, null, { count: n, ownerId, listType: listType ?? null });
      await save();
      return n;
    },

    async rescore(leadIds) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const ids = new Set(leadIds);
      const leads = s.leads.filter((l) => ids.has(l.id));
      leads.forEach((l) => rescoreLead(s, l, "rescore"));
      audit(user.id, "lead.rescore", "lead", null, null, { count: leads.length });
      await save();
      return leads.length;
    },

    async runNightlyJobs() {
      await viewer();
      const s = await load();
      const date = new Date(now()).toISOString().slice(0, 10);
      if (new Date(now()).getUTCHours() < 2 || (s.nightlyRuns ??= []).some((r) => r.date === date)) return null;
      let rescored = 0;
      let changed = 0;
      for (const lead of s.leads.filter((l) => !l.erasedAt && l.stage !== "won" && l.stage !== "lost")) {
        rescored++;
        if (rescoreLead(s, lead, "nightly")) changed++;
      }
      const months = s.complianceSettings?.retentionMonths ?? RETENTION_MONTHS_DEFAULT;
      const due = s.leads.filter((l) => retentionDue(l, now(), months));
      for (const lead of due) erasePersonal(s, lead, `Retention: no work for ${months} months`, null);
      const run: NightlyRun = { date, at: iso(), rescored, changed, erased: due.length };
      s.nightlyRuns.push(run);
      s.nightlyRuns = s.nightlyRuns.slice(-30);
      audit(null, "job.nightly", "leads", null, null, run);
      await save();
      return run;
    },

    async complianceOverview() {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const months = s.complianceSettings?.retentionMonths ?? RETENTION_MONTHS_DEFAULT;
      return {
        retentionMonths: months,
        runs: [...(s.nightlyRuns ?? [])].reverse(),
        unverified: Object.entries(COUNTRY_RULES).filter(([, r]) => !r.verified).map(([k]) => k),
        dueForRetention: s.leads.filter((l) => retentionDue(l, now(), months)).length,
      };
    },

    async setRetentionMonths(months) {
      const user = await viewer();
      requireAdmin(user);
      if (!Number.isInteger(months) || months < 1 || months > 120) throw new Error("Retention is 1–120 months.");
      const s = await load();
      const before = s.complianceSettings?.retentionMonths ?? RETENTION_MONTHS_DEFAULT;
      s.complianceSettings = { retentionMonths: months };
      audit(user.id, "settings.retention", "settings", "retention", { months: before }, { months });
      await save();
    },

    async exportPersonalData(leadId) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) throw new AccessError(404);
      const company = s.companies.find((c) => c.id === lead.companyId);
      const out = {
        exportedAt: iso(), lawfulBasis: lead.lawfulBasis, source: s.sources.find((x) => x.id === company?.sourceId)?.name ?? null,
        company, contacts: s.contacts.filter((c) => c.companyId === lead.companyId),
        lead: { id: lead.id, stage: lead.stage, score: lead.score, tier: lead.tier, createdAt: lead.createdAt, lastTouchAt: lead.lastTouchAt, erasedAt: lead.erasedAt ?? null },
        activities: s.activities.filter((a) => a.leadId === leadId), meetings: s.meetings.filter((m) => m.leadId === leadId),
        emails: s.outbox.filter((m) => m.leadId === leadId).map((m) => ({ to: m.to, subject: m.subject, body: m.body, status: m.status, sentAt: m.sentAt })),
        signals: s.signals.filter((g) => g.leadId === leadId), scoreHistory: (s.scoreHistory ?? []).filter((h) => h.leadId === leadId),
        optOut: s.suppression.filter((x) => [company?.phone, company?.domain, ...s.contacts.filter((c) => c.companyId === lead.companyId).flatMap((c) => [c.email, c.phone])].includes(x.value)),
      };
      audit(user.id, "gdpr.export", "lead", leadId, null, null);
      return JSON.stringify(out, null, 2);
    },

    async erasePersonalData(leadId, reason) {
      const user = await viewer();
      requireAdmin(user);
      if (!reason.trim()) throw new Error("Record why (e.g. the request date and channel).");
      const s = await load();
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) throw new AccessError(404);
      if (lead.erasedAt) throw new Error("Already erased.");
      erasePersonal(s, lead, `GDPR erasure: ${reason.trim()}`, user.id);
      audit(user.id, "gdpr.erase", "lead", leadId, null, { reason });
      await save();
    },

    async exportLeads(leadIds) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const { companies, contacts } = indexes(s);
      const ids = new Set(leadIds);
      const header = ["company", "domain", "phone", "city", "region", "country", "industry", "list", "tier", "score", "stage", "owner", "contact", "title", "email"];
      const lines = s.leads
        .filter((l) => ids.has(l.id))
        .map((l) => {
          const c = companies.get(l.companyId)!;
          const p = l.primaryContactId ? contacts.get(l.primaryContactId) : undefined;
          return [c.name, c.domain, c.phone, c.city, c.region, c.country, c.industry, l.listType, l.tier, l.score, l.stage, ownerName(l.ownerId), p ? `${p.firstName} ${p.lastName}` : "", p?.title, p?.email]
            .map(csvEscape)
            .join(",");
        });
      // Every export is logged (04_LEADS_LIST.md).
      audit(user.id, "lead.export", "lead", null, null, { count: lines.length });
      return [header.join(","), ...lines].join("\n");
    },

    async leadFacets() {
      const user = await viewer();
      requireLeadsAccess(user);
      const s = await load();
      return {
        countries: [...new Set(s.companies.map((c) => c.country).filter((c): c is string => Boolean(c)))].sort(),
        sources: s.sources,
      };
    },

    async listSuppression() {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      return [...s.suppression].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async addSuppression(raw, reason) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const email = normalizeEmail(raw);
      const phone = /\d{6,}/.test(phoneDigits(raw)) && !raw.includes("@") ? normalizePhone(raw, "US") : null;
      const domain = !email && !phone ? normalizeDomain(raw) : null;
      const type: SuppressionType | null = email ? "email" : phone ? "phone" : domain ? "domain" : null;
      const value = email ?? phone ?? domain;
      if (!type || !value) throw new Error("Enter an email, a phone number or a domain.");
      const existing = s.suppression.find((x) => x.type === type && x.value === value);
      if (existing) return existing;
      const entry: Suppression = { id: uid("sp"), value, type, reason, source: "manual", addedBy: user.id, createdAt: iso() };
      s.suppression.push(entry);
      // Matching leads become suppressed at once: they leave every queue.
      for (const lead of s.leads) {
        const company = s.companies.find((c) => c.id === lead.companyId)!;
        if (!lead.suppressed && isSuppressed(s, company, s.contacts.filter((c) => c.companyId === company.id))) {
          lead.suppressed = true;
          rescoreLead(s, lead);
        }
      }
      audit(user.id, "suppression.add", "suppression", null, null, entry);
      await save();
      return entry;
    },

    async removeSuppression(id, reason) {
      const user = await viewer();
      requireAdmin(user);
      if (!reason.trim()) throw new Error("Give a reason for removing an opt-out.");
      const s = await load();
      const entry = s.suppression.find((x) => x.id === id);
      if (!entry) throw new AccessError(404);
      if (entry.reason === "complaint" || entry.reason === "legal") {
        throw new Error("Complaint and legal entries need a second admin to remove. That approval step arrives with the full admin section.");
      }
      s.suppression = s.suppression.filter((x) => x.id !== id);
      audit(user.id, "suppression.remove", "suppression", null, entry, { reason });
      await save();
    },

    async dedupContext() {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      return { companies: s.companies, suppression: s.suppression };
    },

    async commitImport(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const at = iso();
      const nowDate = new Date(now());

      let source = s.sources.find((x) => x.name.toLowerCase() === input.sourceName.trim().toLowerCase());
      if (!source) {
        source = { id: uid("src"), name: input.sourceName.trim() || input.fileName, kind: "csv_import", country: null, createdAt: at };
        s.sources.push(source);
      }

      const job: ImportJob = {
        id: uid("imp"),
        sourceId: source.id,
        sourceName: source.name,
        fileName: input.fileName,
        createdBy: user.id,
        createdAt: at,
        rows: input.plan.rows.length,
        created: 0,
        merged: 0,
        skipped: input.plan.exact.length,
        suppressed: 0,
        failed: input.plan.invalid.length,
        leadIds: [],
        undoneAt: null,
      };

      const suppressedRows = new Set(input.plan.suppressedRows);
      const possibleByRow = new Map(input.plan.possible.map((p) => [p.row.row, p]));
      /** File rows that became a company in this import, so in-file merges can find them. */
      const createdByRow = new Map<number, Company>();

      for (const row of input.plan.candidates) {
        const isSuppressedRow = suppressedRows.has(row.row);
        if (isSuppressedRow && input.suppressedMode === "skip") {
          job.skipped += 1;
          continue;
        }

        const possible = possibleByRow.get(row.row);
        const decision = possible ? (input.decisions[row.row] ?? "keep") : "keep";
        const companyFields: Partial<Company> = {
          domain: row.domain, phone: row.phone, city: row.city, region: row.region, country: row.country,
          industry: row.industry, reviewsCount: row.reviewsCount, rating: row.rating,
        };

        if (possible && decision === "merge") {
          const match = possible.match;
          const target = match.kind === "atlas" ? s.companies.find((c) => c.id === match.company.id) : createdByRow.get(match.row.row);
          if (target) {
            // Merge fills empty fields only and never overwrites.
            Object.assign(target, fillEmpty(target, companyFields), { updatedAt: at });
            const lead = s.leads.find((l) => l.companyId === target.id);
            if (lead) {
              activity(s, { leadId: lead.id, userId: user.id, type: "created", title: `Merged from ${source.name}`, detail: `Row ${row.row} · ${row.companyName}`, disposition: null, durationS: null });
              rescoreLead(s, lead);
            }
            job.merged += 1;
            continue;
          }
        }

        const company: Company = {
          id: uid("co"),
          name: row.companyName,
          domain: row.domain,
          phone: row.phone,
          country: row.country,
          region: row.region,
          city: row.city,
          timezone: inferTimezone(row.country, row.region),
          industry: row.industry,
          listType: input.listType,
          brandInterest: input.listType === "developers" ? ["arcadian"] : ["gllarix"],
          employeesEst: null,
          reviewsCount: row.reviewsCount,
          rating: row.rating,
          sourceId: source.id,
          createdAt: at,
          updatedAt: at,
        };
        const contact: Contact | null =
          row.firstName || row.email
            ? {
                id: uid("ct"),
                companyId: company.id,
                firstName: row.firstName,
                lastName: row.lastName,
                title: row.title,
                email: row.email,
                emailStatus: "unknown",
                phone: null,
                phoneType: phoneType(row.phone),
                phoneVerified: false,
                phoneInvalid: false,
                linkedinUrl: null,
                isDecisionMaker: /owner|founder|director|ceo|president|managing/i.test(row.title ?? ""),
              }
            : null;
        const lead: Lead = {
          id: uid("ld"),
          companyId: company.id,
          primaryContactId: contact?.id ?? null,
          ownerId: input.ownerId,
          listType: input.listType,
          stage: "new",
          score: 0,
          tier: "D",
          scoreBreakdown: [],
          scoreModelVersion: "",
          scoredAt: at,
          excluded: false,
          suppressed: isSuppressedRow,
          nextActionAt: null,
          nextActionType: null,
          attemptsCount: 0,
          lastTouchAt: null,
          lawfulBasis: input.lawfulBasis,
          importJobId: job.id,
          cadenceId: input.cadenceId === undefined ? QUEUE.cadenceFor[input.listType] : input.cadenceId,
          cadenceStartedAt: null,
          cadenceStepsDone: [],
          statusReason: null,
          createdAt: at,
          updatedAt: at,
        };
        const r = scoreLead({ listType: lead.listType, company, contact, signals: [], suppressed: lead.suppressed, now: nowDate });
        Object.assign(lead, { score: r.score, tier: r.tier, scoreBreakdown: r.breakdown, scoreModelVersion: r.modelVersion, excluded: r.excluded });

        s.companies.push(company);
        if (contact) s.contacts.push(contact);
        s.leads.push(lead);
        activity(s, { leadId: lead.id, userId: user.id, type: "created", title: `Created from ${source.name}`, detail: `Import of ${input.fileName} · row ${row.row}${row.notes ? ` · ${row.notes}` : ""}`, disposition: null, durationS: null, at });
        createdByRow.set(row.row, company);
        job.leadIds.push(lead.id);
        job.created += 1;
        if (isSuppressedRow) job.suppressed += 1;
      }

      s.imports.unshift(job);
      audit(user.id, "import.run", "import", null, null, { ...job, leadIds: job.leadIds.length });
      notify({ userId: user.id, type: "task", text: `Import finished · ${job.created} new leads from ${job.fileName}`, href: `/leads?source=${source.id}` });
      await save();
      return job;
    },

    async listImports() {
      const user = await viewer();
      requireAdmin(user);
      return (await load()).imports;
    },

    async undoImport(jobId) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const job = s.imports.find((j) => j.id === jobId);
      if (!job) throw new AccessError(404);
      if (job.undoneAt) return { removed: 0, kept: 0 };
      if (now() - new Date(job.createdAt).getTime() > 24 * 3_600_000) throw new Error("Imports can only be undone within 24 hours.");
      const ids = new Set(job.leadIds);
      // "Untouched" = nothing happened since the import: no edits and no activity besides creation.
      const touched = new Set(
        s.activities.filter((a) => ids.has(a.leadId) && a.type !== "created").map((a) => a.leadId),
      );
      const removable = s.leads.filter((l) => ids.has(l.id) && !touched.has(l.id) && l.updatedAt === job.createdAt);
      const removeLead = new Set(removable.map((l) => l.id));
      const removeCompany = new Set(removable.map((l) => l.companyId));
      s.leads = s.leads.filter((l) => !removeLead.has(l.id));
      s.companies = s.companies.filter((c) => !removeCompany.has(c.id));
      s.contacts = s.contacts.filter((c) => !removeCompany.has(c.companyId));
      s.activities = s.activities.filter((a) => !removeLead.has(a.leadId));
      s.signals = s.signals.filter((g) => !removeLead.has(g.leadId));
      job.undoneAt = iso();
      const result = { removed: removable.length, kept: job.leadIds.length - removable.length };
      audit(user.id, "import.undo", "import", null, null, { jobId, ...result });
      await save();
      return result;
    },

    // ---------------------------------------------------------------- M3: queue and call workspace

    async getQueue() {
      const user = await viewer();
      if (!user.dailyCapacity) return null;
      const s = await load();
      const today = queueDateFor(user, now());
      let q = s.queues.find((x) => x.ownerId === user.id && x.date === today);
      if (!q) {
        q = makeQueue(s, user);
        s.queues = [...s.queues.filter((x) => x.ownerId !== user.id), q];
        audit(user.id, "queue.build", "queue", null, null, { date: q.date, ...q.summary });
        await save();
      }
      return viewFor(s, q);
    },

    async buildQueue() {
      const user = await viewer();
      if (!user.dailyCapacity) throw new AccessError(403, "You don't have a daily queue.");
      const s = await load();
      const today = queueDateFor(user, now());
      const old = s.queues.find((x) => x.ownerId === user.id && x.date === today);
      const fresh = makeQueue(s, user);
      // Keep what was already worked today; fill the rest from a fresh build.
      const worked = old ? old.items.filter((i) => i.status !== "open") : [];
      const seen = new Set(worked.map((i) => `${i.leadId}:${i.channel}`));
      const open = fresh.items
        .filter((i) => !seen.has(`${i.leadId}:${i.channel}`))
        .slice(0, Math.max(0, fresh.summary.capacity - worked.length));
      const q: DailyQueue = {
        ...fresh,
        items: [...worked, ...open],
        summary: { ...fresh.summary, total: worked.length + open.length, shortfall: Math.max(0, fresh.summary.capacity - worked.length - open.length) },
      };
      s.queues = [...s.queues.filter((x) => x.ownerId !== user.id), q];
      audit(user.id, "queue.build", "queue", null, null, { date: q.date, ...q.summary, kept: worked.length });
      await save();
      return viewFor(s, q);
    },

    async todayStats() {
      const user = await viewer();
      return statsFor(await load(), user);
    },

    async teamToday() {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      return users
        .filter((u) => u.active && u.dailyCapacity)
        .map((u) => {
          const q = s.queues.find((x) => x.ownerId === u.id && x.date === queueDateFor(u, now()));
          const st = statsFor(s, u);
          return {
            userId: u.id,
            name: u.name,
            capacity: u.dailyCapacity ?? 0,
            done: q ? q.items.filter((i) => i.status !== "open").length : 0,
            total: q?.items.length ?? 0,
            dials: st.dials,
            conversations: st.conversations,
            meetingsBookedWeek: st.meetingsBookedWeek,
          };
        });
    },

    async callContext(leadId) {
      const user = await viewer();
      if (!["admin", "bdr", "closer"].includes(user.role)) throw new AccessError(403);
      const s = await load();
      const today = queueDateFor(user, now());
      const q = s.queues.find((x) => x.ownerId === user.id && x.date === today) ?? null;
      const calls = q ? q.items.filter((i) => i.channel === "call") : [];
      const id = leadId ?? calls.find((i) => i.status === "open")?.leadId;
      if (!id) return null;
      const lead = s.leads.find((l) => l.id === id);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      const detail = detailFor(s, lead);
      const compliance = canContact({
        lead,
        company: detail.company,
        contacts: detail.contacts,
        contact: detail.contact,
        channel: "call",
        at: now(),
        suppression: s.suppression,
        activities: detail.activities,
      });
      const index = calls.findIndex((i) => i.leadId === id);
      const later = calls.filter((i, n) => i.status === "open" && i.leadId !== id && (index < 0 || n > index));
      const nextItem = later[0] ?? calls.find((i) => i.status === "open" && i.leadId !== id) ?? null;
      return {
        detail,
        compliance,
        position: index >= 0 ? { index: index + 1, total: calls.length, done: calls.filter((i) => i.status !== "open").length } : null,
        nextUp: nextItem ? queueRow(s, nextItem) : null,
        draftNotes: s.drafts[`${user.id}:${id}`] ?? "",
      };
    },

    async saveCallNotes(leadId, notes) {
      const user = await viewer();
      const s = await load();
      const key = `${user.id}:${leadId}`;
      if (notes) s.drafts[key] = notes;
      else delete s.drafts[key];
      await save();
    },

    async logOutcome(input) {
      const user = await viewer();
      const s = await load();
      const lead = s.leads.find((l) => l.id === input.leadId);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      const company = s.companies.find((c) => c.id === lead.companyId)!;
      const disposition = dispositionByKey(input.disposition)!;
      const plan = planOutcome(lead, company, input, now());
      const before = { stage: lead.stage, nextActionAt: lead.nextActionAt, nextActionType: lead.nextActionType, attemptsCount: lead.attemptsCount };
      const at = iso();

      const notes = input.notes.trim();
      const extras = [input.gatekeeperName ? `Gatekeeper: ${input.gatekeeperName}` : null, plan.message].filter(Boolean).join(" · ");
      s.activities.push({
        id: uid("ac"),
        leadId: lead.id,
        userId: user.id,
        type: "call",
        title: `Call · ${disposition.label}`,
        detail: [notes || null, extras || null].filter(Boolean).join("\n"),
        disposition: disposition.label,
        durationS: input.durationS,
        recordingUrl: input.recordingUrl,
        at,
      });
      if (input.disposition === "send_info") queueEmail(s, lead, { kind: "send_info", templateKey: "send_info" });
      for (const extra of plan.extraActivities) {
        s.activities.push({ id: uid("ac"), leadId: lead.id, userId: user.id, type: extra.type, title: extra.title, detail: extra.detail, disposition: null, durationS: null, at });
      }
      if (plan.stage !== lead.stage) {
        s.activities.push({
          id: uid("ac"),
          leadId: lead.id,
          userId: user.id,
          type: "stage_change",
          title: `Stage · ${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[plan.stage]}`,
          detail: null,
          disposition: null,
          durationS: null,
          at,
        });
      }

      const stopsCadence = plan.stage === "meeting_booked" || plan.stage === "lost" || plan.stage === "nurture";
      Object.assign(lead, {
        stage: plan.stage,
        statusReason: plan.statusReason,
        nextActionAt: plan.nextActionAt,
        nextActionType: plan.nextActionType,
        attemptsCount: plan.attemptsCount,
        cadenceStartedAt: plan.cadenceStartedAt,
        cadenceId: stopsCadence ? null : (lead.cadenceId ?? QUEUE.cadenceFor[lead.listType]),
        lastTouchAt: at,
        updatedAt: at,
      });

      const contact = s.contacts.find((c) => c.id === lead.primaryContactId);
      if (plan.phoneInvalid && contact) contact.phoneInvalid = true;
      if (plan.suppress) {
        const contacts = s.contacts.filter((c) => c.companyId === company.id);
        const values: [SuppressionType, string | null][] = [
          ["phone", company.phone],
          ...contacts.flatMap((c): [SuppressionType, string | null][] => [
            ["email", c.email],
            ["phone", c.phone],
          ]),
        ];
        for (const [type, value] of values) {
          if (value && !s.suppression.some((x) => x.type === type && x.value === value)) {
            s.suppression.push({ id: uid("sp"), value, type, reason: "do_not_call", source: "call_outcome", addedBy: user.id, createdAt: at });
          }
        }
        lead.suppressed = true;
      }
      if (plan.meeting) {
        const meeting: Meeting = {
          id: uid("mt"),
          leadId: lead.id,
          bookedBy: user.id,
          ownerId: lead.ownerId,
          scheduledAt: plan.meeting.at,
          withWhom: plan.meeting.withWhom,
          type: plan.meeting.type,
          attended: null,
          approved: null,
          createdAt: at,
        };
        s.meetings.push(meeting);
        dealForMeeting(s, lead, user.id);
        // Same as the booking page: confirmation with the invite now, reminders 24 h and 1 h before (M5).
        const startMs = new Date(meeting.scheduledAt).getTime();
        queueEmail(s, lead, { kind: "booking_confirmation", templateKey: "booking_confirmation", meeting });
        if (startMs - 24 * 3_600_000 > now()) queueEmail(s, lead, { kind: "reminder_24h", templateKey: "reminder_24h", meeting, notBefore: new Date(startMs - 24 * 3_600_000).toISOString() });
        if (startMs - 3_600_000 > now()) queueEmail(s, lead, { kind: "reminder_1h", templateKey: "reminder_1h", meeting, notBefore: new Date(startMs - 3_600_000).toISOString() });
        users
          .filter((u) => u.role === "admin" && u.active && u.id !== user.id)
          .forEach((u) => notify({ userId: u.id, type: "meeting_booked", text: `${user.name} booked a meeting · ${company.name}`, href: `/meetings` }));
      }
      rescoreLead(s, lead);

      // Advance the queue: the call is done; a stop (opt-out, wrong number, meeting) removes the lead's other items today.
      const q = s.queues.find((x) => x.ownerId === user.id && x.date === queueDateFor(user, now()));
      for (const item of q?.items ?? []) {
        if (item.leadId !== lead.id || item.status !== "open") continue;
        if (item.channel === "call") Object.assign(item, { status: "done", doneAt: at, note: disposition.label });
        else if (plan.suppress || plan.phoneInvalid || plan.stage === "meeting_booked") Object.assign(item, { status: "removed", doneAt: at, note: disposition.label });
      }
      // Opt-outs leave every queue at once, whoever owns it.
      if (plan.suppress) {
        for (const other of s.queues)
          for (const item of other.items) if (item.leadId === lead.id && item.status === "open") Object.assign(item, { status: "removed", doneAt: at, note: "Do not contact" });
      }
      delete s.drafts[`${user.id}:${lead.id}`];

      audit(user.id, "call.outcome", "lead", lead.id, before, {
        disposition: disposition.key,
        stage: lead.stage,
        nextActionAt: lead.nextActionAt,
        nextActionType: lead.nextActionType,
      });
      await save();
      return { message: plan.message, nextActionAt: plan.nextActionAt, nextActionType: plan.nextActionType };
    },

    async skipLead(leadId, reason) {
      const user = await viewer();
      if (!reason.trim()) throw new Error("Give a reason to skip without an outcome.");
      const s = await load();
      const q = s.queues.find((x) => x.ownerId === user.id && x.date === queueDateFor(user, now()));
      const item = q?.items.find((i) => i.leadId === leadId && i.channel === "call" && i.status === "open");
      if (!item) throw new Error("That lead isn't open in today's queue.");
      Object.assign(item, { status: "skipped", doneAt: iso(), note: reason.trim() });
      audit(user.id, "queue.skip", "lead", leadId, null, { reason: reason.trim() });
      await save();
    },

    // ---------------------------------------------------------------- M4: meetings, pipeline, reports

    async listMeetings(week) {
      const user = await viewer();
      if (user.role === "implementer") throw new AccessError(403);
      const s = await load();
      const tz = user.timezone;
      const key = week ?? isoWeekKey(localDateKey(now(), tz));
      const { start, end } = isoWeekRange(key);
      const from = zonedToUtc(start, "00:00", tz);
      const to = zonedToUtc(shiftDateKey(end, 1), "00:00", tz);
      const inWeek = (iso: string) => {
        const t = new Date(iso).getTime();
        return t >= from && t < to;
      };
      const visible = s.meetings.filter((m) => user.role === "viewer" || canSeeMeeting(user, m));
      const scheduled = visible.filter((m) => inWeek(m.scheduledAt)).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      const due = scheduled.filter((m) => new Date(m.scheduledAt).getTime() <= now());
      const marked = due.filter((m) => m.attended !== null);
      const rows = scheduled.map((m) => meetingRow(s, m));
      return {
        week: key,
        start,
        end,
        // Viewers see totals only (no personal data).
        rows: user.role === "viewer" ? [] : rows,
        stats: {
          booked: visible.filter((m) => inWeek(m.createdAt)).length,
          held: scheduled.filter((m) => m.attended === true).length,
          toCome: scheduled.filter((m) => new Date(m.scheduledAt).getTime() > now()).length,
          due: due.length,
          showRate: marked.length ? marked.filter((m) => m.attended).length / marked.length : null,
          approved: scheduled.filter((m) => m.approved === true).length,
          waiting: rows.filter((r) => r.status === "to_approve").length,
          bonusMinor: bonusTotalMinor(scheduled),
        },
        closedMonths: s.closedMonths,
      };
    },

    async getMeeting(id) {
      const user = await viewer();
      const s = await load();
      const m = s.meetings.find((x) => x.id === id);
      if (!m) throw new AccessError(404);
      if (!canSeeMeeting(user, m)) throw new AccessError(403);
      return meetingRow(s, m);
    },

    async createMeeting(input) {
      const user = await viewer();
      if (!["admin", "bdr", "closer"].includes(user.role)) throw new AccessError(403);
      const s = await load();
      const lead = s.leads.find((l) => l.id === input.leadId);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      if (lead.erasedAt || lead.suppressed) throw new Error("This lead is on the opt-out list or erased.");
      if (lead.stage === "won" || lead.stage === "lost") throw new Error(`The lead is ${lead.stage === "won" ? "a client" : "closed as lost"}.`);
      const startMs = new Date(input.at).getTime();
      if (!Number.isFinite(startMs)) throw new Error("Pick a date and time.");
      if (startMs < now() - 3_600_000) throw new Error("That time is in the past.");
      if (!input.withWhom.trim()) throw new Error("Who is the meeting with?");
      const at = iso();
      const meeting: Meeting = {
        id: uid("mt"), leadId: lead.id, bookedBy: user.id, ownerId: lead.ownerId ?? user.id, scheduledAt: new Date(startMs).toISOString(),
        withWhom: input.withWhom.trim(), type: input.type, attended: null, approved: null, notes: input.notes?.trim() || null, createdAt: at,
      };
      s.meetings.push(meeting);
      dealForMeeting(s, lead, user.id);
      const before = lead.stage;
      const STAGE_ORDER = ["new", "researched", "contacted", "replied", "qualified", "nurture"];
      Object.assign(lead, {
        stage: STAGE_ORDER.includes(lead.stage) ? "meeting_booked" : lead.stage, nextActionType: "meeting", nextActionAt: meeting.scheduledAt, cadenceId: null, updatedAt: at,
      });
      if (before !== lead.stage) activity(s, { leadId: lead.id, userId: user.id, type: "stage_change", title: `Stage · ${STAGE_LABEL[before]} → ${STAGE_LABEL[lead.stage]}`, detail: null, disposition: null, durationS: null });
      activity(s, { leadId: lead.id, userId: user.id, type: "meeting", title: "Meeting booked from the Meetings page", detail: `${meeting.withWhom} · ${meeting.type.replace("_", " ")}${meeting.notes ? ` · ${meeting.notes}` : ""}`, disposition: null, durationS: null });
      queueEmail(s, lead, { kind: "booking_confirmation", templateKey: "booking_confirmation", meeting });
      if (startMs - 24 * 3_600_000 > now()) queueEmail(s, lead, { kind: "reminder_24h", templateKey: "reminder_24h", meeting, notBefore: new Date(startMs - 24 * 3_600_000).toISOString() });
      if (startMs - 3_600_000 > now()) queueEmail(s, lead, { kind: "reminder_1h", templateKey: "reminder_1h", meeting, notBefore: new Date(startMs - 3_600_000).toISOString() });
      rescoreLead(s, lead);
      const company = s.companies.find((c) => c.id === lead.companyId);
      users
        .filter((u) => u.role === "admin" && u.active && u.id !== user.id)
        .forEach((u) => notify({ userId: u.id, type: "meeting_booked", text: `${user.name} booked a meeting · ${company?.name ?? ""}`, href: `/meetings?id=${meeting.id}` }));
      audit(user.id, "meeting.create", "meeting", meeting.id, null, { leadId: lead.id, at: meeting.scheduledAt });
      await save();
      return { meetingId: meeting.id };
    },

    async markMeeting(id, patch) {
      const user = await viewer();
      const s = await load();
      const m = s.meetings.find((x) => x.id === id);
      if (!m) throw new AccessError(404);
      if (!canSeeMeeting(user, m) || user.role === "viewer") throw new AccessError(403);
      if (isLocked(s, m)) throw new Error("That month is closed. Ask an admin to reopen it.");
      if (new Date(m.scheduledAt).getTime() > now()) throw new Error("You can mark a meeting held or no-show once its time has passed.");
      const lead = s.leads.find((l) => l.id === m.leadId)!;
      const company = s.companies.find((c) => c.id === lead.companyId)!;
      const before = { attended: m.attended };
      const at = iso();
      Object.assign(m, { attended: patch.attended, durationMin: patch.durationMin ?? m.durationMin ?? null, notes: patch.notes ?? m.notes ?? null });
      const deal = openDeal(s, lead.id);
      if (patch.attended) {
        activity(s, { leadId: lead.id, userId: user.id, type: "meeting", title: "Meeting held", detail: patch.notes ?? null, disposition: null, durationS: (patch.durationMin ?? 0) * 60 });
        if (["meeting_booked", "qualified", "contacted", "replied"].includes(lead.stage)) lead.stage = "meeting_completed";
        if (deal && (deal.stage === "meeting_booked" || deal.stage === "qualified")) Object.assign(deal, { stage: "meeting_held", stageChangedAt: at, updatedAt: at });
        users
          .filter((u) => u.role === "admin" && u.active)
          .forEach((u) => notify({ userId: u.id, type: "meeting_approval", text: `Meeting waiting for approval · ${company.name}`, href: `/meetings?week=${isoWeekKey(localDateKey(new Date(m.scheduledAt), u.timezone))}&id=${m.id}` }));
      } else {
        // No-show: follow-up email (sent from M5) and a call next business day.
        const tz = company.timezone ?? "UTC";
        const [first] = parseWindow(QUEUE.windows[lead.listType].call[0]);
        const next = zonedToUtc(addBusinessDays(localDateKey(now(), tz), 1), first, tz);
        activity(s, { leadId: lead.id, userId: user.id, type: "meeting", title: "No-show", detail: "Follow-up email queued (where allowed) · call next business day", disposition: null, durationS: null });
        queueEmail(s, lead, { kind: "no_show", templateKey: "no_show" });
        Object.assign(lead, { stage: "contacted", nextActionAt: new Date(next).toISOString(), nextActionType: "call", cadenceId: lead.cadenceId ?? QUEUE.cadenceFor[lead.listType] });
        if (deal) Object.assign(deal, { stage: "qualified", stageChangedAt: at, updatedAt: at });
      }
      lead.updatedAt = at;
      audit(user.id, "meeting.mark", "meeting", null, before, { id, attended: patch.attended });
      await save();
    },

    async approveMeeting(id, checks) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const m = s.meetings.find((x) => x.id === id);
      if (!m) throw new AccessError(404);
      if (isLocked(s, m)) throw new Error("That month is closed. Approvals can't change after the close.");
      if (m.attended !== true) throw new Error("Only a meeting that was held can be approved.");
      if (!APPROVAL_CHECKS.every((c) => checks[c.key])) throw new Error("All 6 checks must be true to approve.");
      const before = { approved: m.approved };
      const at = iso();
      Object.assign(m, { approved: true, checks: { ...checks }, approvedBy: user.id, decidedAt: at, rejectReason: null });
      const existing = s.commissions.find((c) => c.meetingId === m.id && c.type === "meeting_bonus");
      if (existing) Object.assign(existing, { status: "pending" });
      else s.commissions.push(meetingBonus(m, monthOf(m.scheduledAt, "UTC"), uid("cm"), at));
      audit(user.id, "meeting.approve", "meeting", null, before, { id, approved: true, checks });
      await save();
    },

    async rejectMeeting(id, reason) {
      const user = await viewer();
      requireAdmin(user);
      if (!reason.trim()) throw new Error("Rejections need a reason; the BDR sees it on the daily report.");
      const s = await load();
      const m = s.meetings.find((x) => x.id === id);
      if (!m) throw new AccessError(404);
      if (isLocked(s, m)) throw new Error("That month is closed. Approvals can't change after the close.");
      const before = { approved: m.approved };
      Object.assign(m, { approved: false, approvedBy: user.id, decidedAt: iso(), rejectReason: reason.trim() });
      s.commissions.filter((c) => c.meetingId === m.id).forEach((c) => Object.assign(c, { status: "void" }));
      audit(user.id, "meeting.reject", "meeting", null, before, { id, approved: false, reason: reason.trim() });
      await save();
    },

    async closeMonth(month) {
      const user = await viewer();
      requireAdmin(user);
      if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Month must look like 2026-10.");
      const s = await load();
      if (!s.closedMonths.includes(month)) s.closedMonths.push(month);
      s.commissions.filter((c) => c.period === month && c.status === "pending").forEach((c) => Object.assign(c, { status: "earned" }));
      audit(user.id, "month.close", "settings", null, null, { month });
      await save();
    },

    async pipeline(q) {
      const user = await viewer();
      if (user.role === "implementer") throw new AccessError(403);
      const s = await load();
      const thisMonth = localDateKey(now(), user.timezone).slice(0, 7);
      return s.deals
        .filter((d) => d.stage !== "lost")
        .filter((d) => user.role === "admin" || user.role === "viewer" || d.ownerId === user.id)
        .filter((d) => q.brand === "both" || d.brand === q.brand)
        .filter((d) => q.ownerId === "all" || d.ownerId === q.ownerId)
        .filter((d) => d.stage !== "won" || q.allWon || (d.wonAt && localDateKey(new Date(d.wonAt), user.timezone).slice(0, 7) === thisMonth))
        .map((d) => {
          const lead = s.leads.find((l) => l.id === d.leadId)!;
          const next = s.meetings
            .filter((m) => m.leadId === d.leadId && new Date(m.scheduledAt).getTime() > now())
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
          return {
            deal: d,
            lead,
            company: s.companies.find((c) => c.id === lead.companyId)!,
            ownerName: ownerName(d.ownerId),
            nextMeetingAt: next?.scheduledAt ?? null,
          };
        });
    },

    async moveDeal(id, input) {
      const user = await viewer();
      if (!["admin", "bdr", "closer"].includes(user.role)) throw new AccessError(403, "The pipeline is read-only for your role.");
      const s = await load();
      const d = s.deals.find((x) => x.id === id);
      if (!d) throw new AccessError(404);
      if (user.role !== "admin" && d.ownerId !== user.id) throw new AccessError(403);
      const target = input.stage;
      if (target === d.stage) return;
      const order = DEAL_STAGES.indexOf(target);
      if (user.role !== "admin" && target !== "lost" && (order > DEAL_STAGES.indexOf(BDR_MAX_STAGE) || d.stage === "won")) {
        throw new AccessError(403, "BDRs can move deals up to Proposal sent. Ask an admin for later stages.");
      }
      if (target === "won" && !d.depositPaid) {
        if (user.role !== "admin") throw new AccessError(403, "Won needs a paid deposit. An admin can override with a reason.");
        if (!input.overrideReason?.trim()) throw new Error("Won without a paid deposit needs an override reason.");
      }
      if (target === "lost" && !input.lostReason) throw new Error("Pick a reason for losing the deal.");
      const lead = s.leads.find((l) => l.id === d.leadId)!;
      const before = { stage: d.stage };
      const at = iso();
      Object.assign(d, {
        stage: target,
        stageChangedAt: at,
        updatedAt: at,
        wonAt: target === "won" ? at : d.wonAt,
        wonOverrideReason: target === "won" && !d.depositPaid ? input.overrideReason!.trim() : d.wonOverrideReason,
        lostReason: target === "lost" ? input.lostReason! : null,
        lostNote: target === "lost" ? (input.lostNote?.trim() || null) : null,
      });
      if (target === "won") plannerMod.fire(s, { type: "deal_won", dealId: d.id, leadId: lead.id, brand: d.brand, ownerId: d.ownerId, clientId: s.clients.find((c) => c.dealId === d.id)?.id ?? null, pilot: d.pilot });
      const leadStage = LEAD_STAGE_FOR_DEAL[target];
      activity(s, {
        leadId: lead.id,
        userId: user.id,
        type: "stage_change",
        title: `Deal · ${DEAL_STAGE_LABEL[before.stage]} → ${DEAL_STAGE_LABEL[target]}`,
        detail: target === "lost" ? `${input.lostReason}${input.lostNote ? ` · ${input.lostNote}` : ""}` : target === "won" && d.wonOverrideReason ? `Override: ${d.wonOverrideReason}` : null,
        disposition: null,
        durationS: null,
      });
      Object.assign(lead, { stage: leadStage, statusReason: target === "lost" ? input.lostReason : lead.statusReason, updatedAt: at });
      audit(user.id, "deal.stage", "deal", null, before, { id, stage: target, reason: input.lostReason ?? input.overrideReason ?? null });
      await save();
    },

    async report(input) {
      const user = await viewer();
      if (user.role === "implementer") throw new AccessError(403);
      const s = await load();
      if (user.role === "admin" && ensureDailyReports(s)) await save();
      // BDRs see only their own funnel; viewers see team totals.
      const personId = user.role === "admin" ? (input.personId ?? "team") : user.role === "viewer" ? "team" : user.id;
      const key = input.key ?? currentPeriodKey(input.kind, now(), user.timezone);
      return computeReport({
        now: now(),
        tz: user.timezone,
        period: { kind: input.kind, key },
        personId,
        users,
        activities: s.activities,
        meetings: s.meetings,
        deals: s.deals,
        leads: s.leads,
        clients: s.clients,
      });
    },

    async dailyReport(userId, date) {
      const user = await viewer();
      const s = await load();
      if (user.role === "admin" && ensureDailyReports(s)) await save();
      const targetId = user.role === "admin" ? (userId ?? users.find((u) => u.role === "bdr" && u.active)?.id) : user.id;
      if (user.role !== "admin" && userId && userId !== user.id) throw new AccessError(403);
      const target = users.find((u) => u.id === targetId);
      if (!target || !target.dailyCapacity) return null;
      const day = date ?? localDateKey(now(), target.timezone);
      return s.dailyReports.find((r) => r.userId === target.id && r.date === day) ?? dailyFor(s, target, day);
    },

    async listCommissions() {
      const user = await viewer();
      const s = await load();
      return user.role === "admin" ? s.commissions : s.commissions.filter((c) => c.userId === user.id);
    },

    // ---------------------------------------------------------------- M5: email and booking

    async listTemplates() {
      await viewer();
      return (await load()).templates;
    },

    async saveTemplate(t) {
      const user = await viewer();
      requireAdmin(user);
      const errors = validateTemplate(t.subject, t.body);
      if (errors.length) throw new Error(errors.join(" "));
      const s = await load();
      const existing = templateFor(s, t.key);
      if (!existing) throw new AccessError(404);
      const before = { subject: existing.subject, body: existing.body };
      Object.assign(existing, { subject: t.subject, body: t.body, updatedAt: iso(), updatedBy: user.id });
      audit(user.id, "template.update", "template", null, before, { key: t.key, subject: t.subject, body: t.body });
      await save();
    },

    async previewTemplate(key, leadId) {
      const user = await viewer();
      const s = await load();
      const template = templateFor(s, key);
      if (!template) throw new AccessError(404);
      const lead =
        (leadId ? s.leads.find((l) => l.id === leadId && canSeeLead(user, l)) : undefined) ??
        s.leads.find((l) => canSeeLead(user, l) && (template.list === "any" || l.listType === template.list));
      if (!lead) return { subject: template.subject, body: template.body, problems: [], leadName: null };
      const vars = varsFor(s, lead, "preview", s.meetings.find((m) => m.leadId === lead.id));
      const subject = renderTemplate(template.subject, vars);
      const body = renderTemplate(template.body, vars);
      const problems = [...(!s.branding.footerAddress.trim() ? ["Footer address isn't set (Admin › Settings)"] : []), ...unfinishedParts(`${subject}\n${body}`)];
      return { subject, body, problems, leadName: s.companies.find((c) => c.id === lead.companyId)?.name ?? null };
    },

    async composeEmail(leadId, input) {
      const user = await viewer();
      const s = await load();
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      const template = templateFor(s, input.templateKey);
      if (!template || template.channel !== "email") throw new Error("Pick an email template.");
      const message = queueEmail(s, lead, { kind: "manual", templateKey: template.key });
      activity(s, { leadId, userId: user.id, type: "email", title: `Email queued · ${message.subject}`, detail: "Sends when the compliance check, send window and inbox caps allow", disposition: null, durationS: null });
      audit(user.id, "email.compose", "lead", leadId, null, { templateKey: template.key, messageId: message.id });
      await save();
      return message;
    },

    async outbox(filter) {
      const user = await viewer();
      const s = await load();
      return s.outbox
        .filter((m) => (filter?.leadId ? m.leadId === filter.leadId : true))
        .filter((m) => {
          if (user.role === "admin") return true;
          const lead = s.leads.find((l) => l.id === m.leadId);
          return Boolean(lead && canSeeLead(user, lead));
        })
        .sort((a, b) => (b.sentAt ?? b.queuedAt).localeCompare(a.sentAt ?? a.queuedAt));
    },

    async inboxes() {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const ctx = sendContext(s);
      return s.inboxes.map((i) => ({ ...i, capToday: inboxCapToday(i, now()), sentToday: ctx.sentToday.get(i.id) ?? 0 }));
    },

    async runSender() {
      await viewer();
      const started = performance.now();
      const s = await load();
      const at = iso();

      // 0. Like the 05:00 job: everyone with a capacity gets today's queue if it isn't built yet.
      for (const u of users.filter((x) => x.active && x.dailyCapacity)) {
        const date = queueDateFor(u, now());
        if (!s.queues.some((q) => q.ownerId === u.id && q.date === date)) {
          s.queues = [...s.queues.filter((q) => q.ownerId !== u.id), makeQueue(s, u)];
        }
      }

      // 1. Today's cadence emails from every queue become outbox messages (once per lead and step).
      for (const q of s.queues) {
        const owner = users.find((u) => u.id === q.ownerId);
        if (!owner || q.date !== queueDateFor(owner, now())) continue;
        for (const item of q.items) {
          if (item.channel !== "email" || item.status !== "open") continue;
          const lead = s.leads.find((l) => l.id === item.leadId);
          if (!lead) continue;
          const day = Number(/Day (\d+)/.exec(item.step)?.[1] ?? 0);
          const step = day ? `${day}:email` : `nurture:${q.date}`;
          if (s.outbox.some((m) => m.leadId === lead.id && m.step === step)) continue;
          queueEmail(s, lead, { kind: "cadence", templateKey: item.template ?? "nurture_checkin", step });
        }
      }

      // 2. Replies stop cadences.
      let replies = 0;
      for (const r of await provider.repliesSince(s.lastReplyCheck)) {
        const message = s.outbox.find((m) => m.threadId === r.threadId);
        if (message && applyReply(s, message, r.snippet, r.receivedAt)) replies += 1;
      }
      s.lastReplyCheck = at;

      // 3. Send what's allowed now.
      const queued = s.outbox.filter((m) => m.status === "queued").sort((a, b) => Number(b.transactional) - Number(a.transactional) || a.queuedAt.localeCompare(b.queuedAt));
      const decisions = planSends(queued, sendContext(s));
      const run: SenderRun = { at, sent: 0, deferred: [], blocked: [], cancelled: 0, replies, ms: 0 };
      for (const d of decisions) {
        const m = s.outbox.find((x) => x.id === d.id)!;
        const lead = s.leads.find((l) => l.id === m.leadId);
        const queueItems = () => s.queues.flatMap((q) => q.items).filter((i) => i.leadId === m.leadId && i.channel === "email" && i.status === "open");
        if (d.action === "send") {
          const inbox = s.inboxes.find((i) => i.id === d.inboxId)!;
          const sent = await provider.send({ from: inbox.address, fromName: inbox.senderName, to: m.to!, subject: m.subject, body: m.body, listUnsubscribeUrl: `${origin()}/u/${m.id}` });
          Object.assign(m, { status: "sent", sentAt: at, inboxId: inbox.id, threadId: sent.threadId, reason: null });
          if (lead) {
            activity(s, { leadId: lead.id, userId: null, type: "email", title: `Email sent · ${m.subject}`, detail: `From ${inbox.address} to ${m.to}`, disposition: null, durationS: null });
            if (m.step && !lead.cadenceStepsDone.includes(m.step)) lead.cadenceStepsDone.push(m.step);
            if (!m.transactional) lead.lastTouchAt = at;
          }
          if (m.kind === "cadence") queueItems().forEach((i) => Object.assign(i, { status: "done", doneAt: at, note: "Sent" }));
          run.sent += 1;
        } else if (d.action === "defer") {
          m.reason = d.reason;
          run.deferred.push({ id: m.id, reason: d.reason });
        } else {
          Object.assign(m, { status: d.action === "block" ? "blocked" : "cancelled", reason: d.reason });
          if (m.kind === "cadence") queueItems().forEach((i) => Object.assign(i, { status: "removed", doneAt: at, note: d.reason }));
          if (d.action === "block") run.blocked.push({ id: m.id, reason: d.reason });
          else run.cancelled += 1;
        }
      }
      run.ms = Math.round(performance.now() - started);
      s.senderRuns = [run, ...s.senderRuns].slice(0, 20);
      await save();
      return run;
    },

    async lastSenderRun() {
      await viewer();
      return (await load()).senderRuns[0] ?? null;
    },

    async simulateReply(messageId, text) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const m = s.outbox.find((x) => x.id === messageId);
      if (!m || m.status !== "sent" || !m.threadId) throw new Error("Only a sent email can get a reply.");
      s.mailbox.replies.push({ threadId: m.threadId, from: m.to ?? "", receivedAt: iso(), snippet: text.trim() || "Thanks, tell me more" });
      await save();
    },

    async getBranding() {
      await viewer();
      return (await load()).branding;
    },

    async saveBranding(b) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const before = s.branding;
      s.branding = { footerAddress: b.footerAddress.trim(), demoNumber: b.demoNumber.trim() };
      // Re-render queued messages so the new values apply (unsent ones only).
      for (const m of s.outbox.filter((x) => x.status === "queued" && x.templateKey)) {
        const lead = s.leads.find((l) => l.id === m.leadId);
        const template = templateFor(s, m.templateKey!);
        if (!lead || !template) continue;
        const vars = varsFor(s, lead, m.id, s.meetings.find((x) => x.id === m.meetingId));
        Object.assign(m, { subject: renderTemplate(template.subject, vars), body: renderTemplate(template.body, vars) });
      }
      audit(user.id, "settings.branding", "settings", null, before, s.branding);
      await save();
    },

    async bookingPath() {
      const user = await viewer();
      return user.dailyCapacity ? `/book/${slugFor(user.name)}` : null;
    },

    async bookingPage(slug) {
      const s = await load();
      const owner = users.find((u) => u.active && u.dailyCapacity && slugFor(u.name) === slug);
      if (!owner) return null;
      return {
        slug,
        ownerName: owner.name.split(" ")[0],
        brand: owner.role === "bdr" ? "gllarix" : "arcadian",
        timezone: owner.timezone,
        slots: openSlots({ tz: owner.timezone, shift: shiftFor(owner).join("-"), now: now(), meetings: s.meetings.filter((m) => m.ownerId === owner.id || m.bookedBy === owner.id) }),
      };
    },

    async book(input) {
      const s = await load();
      const owner = users.find((u) => u.active && u.dailyCapacity && slugFor(u.name) === input.slug);
      if (!owner) throw new AccessError(404, "That booking page doesn't exist.");
      const email = normalizeEmail(input.email);
      if (!email) throw new Error("Enter a valid email address.");
      if (!input.name.trim() || !input.company.trim()) throw new Error("Enter your name and company.");
      const slots = openSlots({ tz: owner.timezone, shift: shiftFor(owner).join("-"), now: now(), meetings: s.meetings.filter((m) => m.ownerId === owner.id || m.bookedBy === owner.id) });
      if (!slots.some((x) => x.start === input.start)) throw new Error("That time was just taken. Please pick another.");
      const at = iso();

      // Match an existing lead by email, then domain, then phone; otherwise create one.
      const domain = normalizeDomain(email);
      const phone = input.phone ? normalizePhone(input.phone, input.country || "US") : null;
      let contact = s.contacts.find((c) => c.email === email);
      let company = contact ? s.companies.find((c) => c.id === contact!.companyId) : undefined;
      company ??= (domain ? s.companies.find((c) => c.domain === domain) : undefined) ?? (phone ? s.companies.find((c) => c.phone === phone) : undefined);
      let lead = company ? s.leads.find((l) => l.companyId === company!.id) : undefined;
      const [firstName, ...rest] = input.name.trim().split(/\s+/);
      if (!company || !lead) {
        let source = s.sources.find((x) => x.name === "Booking page");
        if (!source) {
          source = { id: uid("src"), name: "Booking page", kind: "inbound", country: null, createdAt: at };
          s.sources.push(source);
        }
        const country = input.country?.trim().toUpperCase() || (owner.role === "bdr" ? "US" : null);
        const listType = owner.role === "bdr" ? "trades" : "developers";
        company = {
          id: uid("co"), name: input.company.trim(), domain, phone, country, region: null, city: null,
          timezone: inferTimezone(country, null) ?? owner.timezone, industry: null, listType,
          brandInterest: [listType === "trades" ? "gllarix" : "arcadian"], employeesEst: null, reviewsCount: null, rating: null,
          sourceId: source.id, createdAt: at, updatedAt: at,
        };
        s.companies.push(company);
        lead = {
          id: uid("ld"), companyId: company.id, primaryContactId: null, ownerId: owner.id, listType, stage: "new", score: 0, tier: "D",
          scoreBreakdown: [], scoreModelVersion: "", scoredAt: at, excluded: false, suppressed: false, nextActionAt: null, nextActionType: null,
          attemptsCount: 0, lastTouchAt: null, lawfulBasis: "Consent · booking page", importJobId: null, cadenceId: null, cadenceStartedAt: null,
          cadenceStepsDone: [], statusReason: null, createdAt: at, updatedAt: at,
        };
        s.leads.push(lead);
        activity(s, { leadId: lead.id, userId: null, type: "created", title: "Created from the booking page", detail: `${input.name} · ${email}`, disposition: null, durationS: null });
      }
      if (!contact) {
        contact = {
          id: uid("ct"), companyId: company.id, firstName, lastName: rest.join(" "), title: null, email, emailStatus: "unknown",
          phone, phoneType: "unknown", phoneVerified: false, phoneInvalid: false, linkedinUrl: null, isDecisionMaker: false,
        };
        s.contacts.push(contact);
      }
      lead.primaryContactId ??= contact.id;

      const meeting: Meeting = {
        id: uid("mt"), leadId: lead.id, bookedBy: owner.id, ownerId: lead.ownerId ?? owner.id, scheduledAt: input.start,
        withWhom: input.name.trim(), type: "video", attended: null, approved: null, notes: input.notes?.trim() || null, createdAt: at,
      };
      s.meetings.push(meeting);
      dealForMeeting(s, lead, owner.id);
      Object.assign(lead, { stage: "meeting_booked", nextActionType: "meeting", nextActionAt: input.start, cadenceId: null, updatedAt: at });
      rescoreLead(s, lead);
      activity(s, { leadId: lead.id, userId: null, type: "meeting", title: "Meeting booked from the booking page", detail: `${input.name} · ${email}${input.notes ? ` · "${input.notes}"` : ""}`, disposition: null, durationS: null });

      // Confirmation now; reminders 24 h and 1 h before (consent given when booking).
      const startMs = new Date(input.start).getTime();
      queueEmail(s, lead, { kind: "booking_confirmation", templateKey: "booking_confirmation", meeting });
      if (startMs - 24 * 3_600_000 > now()) queueEmail(s, lead, { kind: "reminder_24h", templateKey: "reminder_24h", meeting, notBefore: new Date(startMs - 24 * 3_600_000).toISOString() });
      queueEmail(s, lead, { kind: "reminder_1h", templateKey: "reminder_1h", meeting, notBefore: new Date(startMs - 3_600_000).toISOString() });

      users
        .filter((u) => (u.role === "admin" || u.id === owner.id) && u.active)
        .forEach((u) => notify({ userId: u.id, type: "meeting_booked", text: `Booked via ${owner.name.split(" ")[0]}'s booking page · ${company!.name}`, href: `/leads/${lead!.id}` }));
      audit(null, "booking.create", "meeting", null, null, { meetingId: meeting.id, leadId: lead.id, slug: input.slug });
      await save();
      return { meetingAt: input.start, ownerName: owner.name.split(" ")[0], timezone: owner.timezone };
    },

    async unsubscribe(token) {
      const s = await load();
      const m = s.outbox.find((x) => x.id === token);
      if (!m || !m.to) return { ok: false, email: null, alreadyUnsubscribed: false };
      const at = iso();
      const already = s.suppression.some((x) => x.type === "email" && x.value === m.to);
      if (!already) s.suppression.push({ id: uid("sp"), value: m.to, type: "email", reason: "opt_out", source: "unsubscribe", addedBy: null, createdAt: at });
      m.unsubscribedAt ??= at;
      const lead = s.leads.find((l) => l.id === m.leadId);
      if (lead && !lead.suppressed) {
        lead.suppressed = true;
        rescoreLead(s, lead);
        activity(s, { leadId: lead.id, userId: null, type: "email", title: "Unsubscribed via the email link", detail: m.to, disposition: null, durationS: null });
        for (const x of s.outbox) if (x.leadId === lead.id && x.status === "queued") Object.assign(x, { status: "cancelled", reason: "Unsubscribed" });
        for (const q of s.queues) for (const i of q.items) if (i.leadId === lead.id && i.status === "open") Object.assign(i, { status: "removed", doneAt: at, note: "Unsubscribed" });
        if (lead.ownerId) notify({ userId: lead.ownerId, type: "task", text: `${m.to} unsubscribed`, href: `/leads/${lead.id}` });
      }
      audit(null, "email.unsubscribe", "suppression", null, null, { email: m.to, messageId: m.id });
      await save();
      return { ok: true, email: m.to, alreadyUnsubscribed: already };
    },

    // ---------------------------------------------------------------- M6: deals, quotes, payments

    async listDeals() {
      const user = await viewer();
      if (user.role === "implementer") throw new AccessError(403);
      const s = await load();
      return s.deals.filter((d) => canSeeDeal(user, d)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((d) => dealRowFor(s, d));
    },

    async getDeal(id) {
      const user = await viewer();
      const s = await load();
      const d = s.deals.find((x) => x.id === id);
      if (!d) throw new AccessError(404);
      if (!canSeeDeal(user, d)) throw new AccessError(403);
      return dealDetail(s, user, d);
    },

    async createDeal(leadId) {
      const user = await viewer();
      if (!["admin", "bdr", "closer"].includes(user.role)) throw new AccessError(403);
      const s = await load();
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) throw new AccessError(404);
      if (!canSeeLead(user, lead)) throw new AccessError(403);
      const existing = openDeal(s, leadId);
      if (existing) return existing.id;
      dealForMeeting(s, lead, user.id);
      const d = openDeal(s, leadId)!;
      // A deal created by hand starts at Qualified, not Meeting booked.
      Object.assign(d, { stage: "qualified" });
      activity(s, { leadId, userId: user.id, type: "stage_change", title: "Deal created", detail: null, disposition: null, durationS: null });
      audit(user.id, "deal.create", "deal", null, null, { dealId: d.id, leadId });
      await save();
      return d.id;
    },

    async updateDraft(id, selection) {
      const user = await viewer();
      const s = await load();
      const d = s.deals.find((x) => x.id === id);
      if (!d) throw new AccessError(404);
      if (!canEditDeal(user, d)) throw new AccessError(403);
      const detail = dealDetail(s, user, d);
      if (!detail.editable) throw new Error("This deal's quote was accepted or paid, so it can't change.");
      const r = compute(selection);
      // The deal's brand follows what is quoted (first line), so pilot caps count the right brand.
      const brand: Deal["brand"] = r.lines.length ? (r.lines[0].brand === "gl" ? "gllarix" : "arcadian") : d.brand;
      checkDraft(s, user, { ...d, brand }, selection);
      Object.assign(d, {
        brand,
        draft: selection,
        market: selection.market,
        currency: MARKETS[selection.market].currency,
        setupMinor: Math.round(r.setup * 100),
        monthlyMinor: Math.round(r.monthly * 100),
        pilot: selection.pilot,
        items: selectionItems(selection),
        updatedAt: iso(),
      });
      await save();
      return dealDetail(s, user, d);
    },

    async requestDiscount(dealId, pct, note) {
      const user = await viewer();
      const s = await load();
      const d = s.deals.find((x) => x.id === dealId);
      if (!d) throw new AccessError(404);
      if (!canEditDeal(user, d) || user.role === "bdr") throw new AccessError(403, "BDRs can't give extra discounts.");
      if (pct <= DISCOUNT_SELF_MAX || pct > DISCOUNT_HARD_MAX) throw new Error(`Request between ${DISCOUNT_SELF_MAX + 1}% and ${DISCOUNT_HARD_MAX}%.`);
      s.discountApprovals.push({ id: uid("da"), dealId, pct, note: note.trim() || null, requestedBy: user.id, requestedAt: iso(), status: "pending", decidedBy: null, decidedAt: null });
      users
        .filter((u) => u.role === "admin" && u.active && u.id !== user.id)
        .forEach((u) => notify({ userId: u.id, type: "task", text: `Approve a ${pct}% extra discount? · ${dealRowFor(s, d).company.name}`, href: `/deals/${dealId}` }));
      audit(user.id, "discount.request", "deal", null, null, { dealId, pct });
      await save();
    },

    async decideDiscount(approvalId, approve) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const a = s.discountApprovals.find((x) => x.id === approvalId);
      if (!a) throw new AccessError(404);
      if (a.status !== "pending") throw new Error("Already decided.");
      if (a.requestedBy === user.id) throw new AccessError(403, "The second founder decides: you can't approve your own request.");
      Object.assign(a, { status: approve ? "approved" : "rejected", decidedBy: user.id, decidedAt: iso() });
      notify({ userId: a.requestedBy, type: "task", text: `Extra discount of ${a.pct}% ${approve ? "approved" : "rejected"}`, href: `/deals/${a.dealId}` });
      audit(user.id, "discount.decide", "deal", null, null, { approvalId, approve });
      await save();
    },

    async pendingDiscounts() {
      const user = await viewer();
      requireAdmin(user);
      return (await load()).discountApprovals.filter((a) => a.status === "pending");
    },

    async saveQuote(dealId) {
      const user = await viewer();
      const s = await load();
      const d = s.deals.find((x) => x.id === dealId);
      if (!d) throw new AccessError(404);
      if (!canEditDeal(user, d)) throw new AccessError(403);
      const detail = dealDetail(s, user, d);
      if (!detail.editable) throw new Error("This deal's quote was accepted or paid, so it can't change.");
      const sel = detail.draft;
      checkDraft(s, user, d, sel);
      const r = compute(sel);
      if (!r.lines.length) throw new Error("Add at least one item from the price book.");
      const at = iso();
      // Unsent drafts are replaced by the new version; sent versions stay as they are.
      s.quotes.filter((q) => q.dealId === dealId && q.status === "draft").forEach((q) => Object.assign(q, { status: "superseded" }));
      const version = Math.max(0, ...s.quotes.filter((q) => q.dealId === dealId).map((q) => q.version)) + 1;
      const company = dealRowFor(s, d).company;
      const quote: Quote = {
        id: uid("qt"), dealId, version, priceBookVersion: PRICE_BOOK_VERSION, selection: { ...sel, tiers: { ...sel.tiers }, qty: { ...sel.qty } },
        currency: MARKETS[sel.market].currency, setupMinor: Math.round(r.setup * 100), monthlyMinor: Math.round(r.monthly * 100),
        firstYearMinor: Math.round(r.firstYear * 100), depositMinor: Math.round(r.setup * DEPOSIT_SHARE * 100), lines: r.lines, adj: r.adj,
        summary: quoteSummary(r, sel, company.name), status: "draft", token: uid("qtk") + uid(""), validUntil: new Date(now() + QUOTE_VALID_DAYS * 86_400_000).toISOString(),
        createdAt: at, createdBy: user.id, sentAt: null, openedAt: null, acceptedAt: null, acceptedByName: null, acceptedIp: null, checkoutSessionId: null, paidAt: null,
      };
      s.quotes.push(quote);
      audit(user.id, "quote.save", "deal", null, null, { dealId, version, setup: r.setup, monthly: r.monthly });
      await save();
      return quote;
    },

    async sendQuote(quoteId) {
      const user = await viewer();
      const s = await load();
      const q = s.quotes.find((x) => x.id === quoteId);
      if (!q) throw new AccessError(404);
      const d = s.deals.find((x) => x.id === q.dealId)!;
      if (!canEditDeal(user, d)) throw new AccessError(403);
      if (q.status !== "draft" && q.status !== "sent") throw new Error("Only a draft or sent quote can be sent.");
      const lead = s.leads.find((l) => l.id === d.leadId)!;
      queueEmail(s, lead, { kind: "manual", templateKey: "quote_sent", extraVars: { quote_url: `${origin()}/q/${q.token}` } });
      const at = iso();
      Object.assign(q, { status: "sent", sentAt: q.sentAt ?? at });
      if (DEAL_STAGES.indexOf(d.stage) < DEAL_STAGES.indexOf("proposal_sent")) {
        activity(s, { leadId: lead.id, userId: user.id, type: "stage_change", title: `Deal · ${DEAL_STAGE_LABEL[d.stage]} → Proposal sent`, detail: `Quote v${q.version}`, disposition: null, durationS: null });
        Object.assign(d, { stage: "proposal_sent", stageChangedAt: at, updatedAt: at });
        lead.stage = "proposal_sent";
      }
      activity(s, { leadId: lead.id, userId: user.id, type: "email", title: `Quote v${q.version} sent`, detail: `${formatMoney(q.setupMinor / 100, q.selection.market)} setup + ${formatMoney(q.monthlyMinor / 100, q.selection.market)}/month`, disposition: null, durationS: null });
      audit(user.id, "quote.send", "deal", null, null, { quoteId, version: q.version });
      await save();
    },

    async publicQuote(token) {
      const s = await load();
      const q = s.quotes.find((x) => x.token === token && x.status !== "superseded" && x.status !== "draft");
      if (!q) return null;
      if (!q.openedAt) {
        q.openedAt = iso();
        await save();
      }
      const d = s.deals.find((x) => x.id === q.dealId)!;
      const lead = s.leads.find((l) => l.id === d.leadId)!;
      const contact = s.contacts.find((c) => c.id === lead.primaryContactId);
      const brands = [...new Set(q.lines.map((l) => (l.brand === "gl" ? "gllarix" : "arcadian")))] as ("gllarix" | "arcadian")[];
      return {
        quote: q,
        companyName: s.companies.find((c) => c.id === lead.companyId)?.name ?? "",
        contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
        ownerName: ownerName(d.ownerId),
        brands,
        terms: [
          "Prices exclude VAT.",
          `${Math.round(DEPOSIT_SHARE * 100)}% of the setup fee is due at signing, the rest at launch.`,
          "Monthly fees start at launch; extra minutes are billed in arrears at the overage rate.",
          q.selection.billing === "annual" ? "Annual prepay: 12 months for the price of 10." : "Monthly billing.",
          q.selection.pilot ? "Pilot: setup at 40%, first month free, monthly fee −25% for 12 months, in exchange for a case study." : "",
          `Quote valid until ${new Date(q.validUntil).toISOString().slice(0, 10)}.`,
        ].filter(Boolean),
        notIncluded: q.summary.split("\n").find((l) => l.startsWith("Not included:")) ?? "",
        expired: new Date(q.validUntil).getTime() < now() && !q.acceptedAt,
      };
    },

    async acceptQuote(token, name) {
      const s = await load();
      const q = s.quotes.find((x) => x.token === token);
      if (!q || q.status === "draft" || q.status === "superseded") throw new AccessError(404, "This quote isn't available.");
      if (new Date(q.validUntil).getTime() < now()) throw new Error("This quote has expired. Ask us for a fresh one.");
      if (!name.trim()) throw new Error("Type your full name to accept.");
      if (q.acceptedAt) return;
      // A newer quote replaces older open ones for the same deal.
      s.quotes.filter((x) => x.dealId === q.dealId && x.id !== q.id && x.status === "sent").forEach((x) => Object.assign(x, { status: "superseded" }));
      Object.assign(q, { status: "accepted", acceptedAt: iso(), acceptedByName: name.trim(), acceptedIp: "recorded server-side (Edge Function)" });
      const d = s.deals.find((x) => x.id === q.dealId)!;
      activity(s, { leadId: d.leadId, userId: null, type: "stage_change", title: `Quote v${q.version} accepted`, detail: `By ${name.trim()}`, disposition: null, durationS: null });
      if (d.ownerId) notify({ userId: d.ownerId, type: "task", text: `Quote accepted · ${dealRowFor(s, d).company.name}`, href: `/deals/${d.id}` });
      audit(null, "quote.accept", "deal", null, null, { quoteId: q.id, name: name.trim() });
      await save();
    },

    async startCheckout(token) {
      const s = await load();
      const q = s.quotes.find((x) => x.token === token);
      if (!q || !q.acceptedAt) throw new Error("Accept the quote's terms first.");
      if (q.status === "paid") throw new Error("The deposit is already paid. Thank you!");
      let session = s.checkoutSessions.find((c) => c.id === q.checkoutSessionId && c.status === "open");
      if (!session) {
        const id = `cs_test_${uid("").slice(1)}${uid("").slice(1)}`;
        session = {
          id, quoteId: q.id, amountMinor: q.depositMinor, currency: q.currency,
          description: `50% setup deposit · quote v${q.version}`, status: "open", url: `${origin()}/pay/${id}`, createdAt: iso(),
        };
        s.checkoutSessions.push(session);
        q.checkoutSessionId = id;
        await save();
      }
      return session;
    },

    async checkoutSession(id) {
      const s = await load();
      const session = s.checkoutSessions.find((c) => c.id === id);
      if (!session) return null;
      const q = s.quotes.find((x) => x.id === session.quoteId)!;
      const d = s.deals.find((x) => x.id === q.dealId)!;
      return { session, companyName: dealRowFor(s, d).company.name };
    },

    async completeTestCheckout(id) {
      const s = await load();
      const session = s.checkoutSessions.find((c) => c.id === id);
      if (!session) throw new AccessError(404);
      if (session.status === "complete") return;
      session.status = "complete";
      const q = s.quotes.find((x) => x.id === session.quoteId)!;
      await save();
      // What Stripe would POST to /webhooks/stripe.
      await this.stripeWebhook({
        id: `evt_test_${session.id.slice(8)}`,
        type: "checkout.session.completed",
        created: iso(),
        data: { object: { id: session.id, amount_total: session.amountMinor, currency: session.currency.toLowerCase(), metadata: { quoteId: q.id, dealId: q.dealId } } },
      });
    },

    async stripeWebhook(event) {
      // In Supabase mode the Edge Function verifies the Stripe signature before this runs.
      const s = await load();
      if (s.stripeEvents.includes(event.id)) return { duplicate: true };
      s.stripeEvents.push(event.id);
      if (event.type === "checkout.session.completed") applyCheckoutCompleted(s, event);
      else if (event.type === "invoice.paid") clientsMod.applyInvoicePaid(s, event);
      await save();
      return { duplicate: false };
    },

    async listPayments() {
      const user = await viewer();
      requireAdmin(user);
      return (await load()).payments;
    },

    async listClients() {
      const user = await viewer();
      if (!["admin", "implementer", "viewer"].includes(user.role)) throw new AccessError(403);
      return (await load()).clients;
    },

    async parityCheck() {
      await viewer();
      return runParity();
    },
  };
  return self;
};
