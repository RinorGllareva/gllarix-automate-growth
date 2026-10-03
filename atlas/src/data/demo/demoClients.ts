import { HEALTH_TASK_BELOW, HEALTH_TASK_HOURS, ONBOARDING_STEPS, type OnboardingKey } from "@/config/clients";
import { BY_ID, COMM_MONTHS, COMM_PCT, DEPOSIT_SHARE, MARKETS, PRICE_ITEMS } from "@/config/priceBook";
import {
  addMonths,
  annualCharge,
  dayKey,
  dueDate,
  feeForPeriod,
  healthScore,
  kpisFor,
  marginPct,
  money,
  monthEndLines,
  monthKey,
  monthLabel,
  monthStart,
  monthsBetween,
  nextMonth,
  overage,
  overLimitFrom,
  total,
} from "@/services/billing";
import { compute, selectionFromItems, type QuoteSelection } from "@/services/pricing";
import { createFakeUsagePortal, hash01, type FakeVoiceAccount } from "@/services/usagePortal";
import type { TemplateVars } from "@/services/templates";
import type {
  ClientCard,
  ClientDetail,
  ClientReport,
  ClientsApi,
  ClientTask,
  Invoice,
  InvoiceLine,
  OnboardingStep,
  Subscription,
  UsageDay,
  UsageRecord,
} from "../clientTypes";
import type { Activity, Company, Contact, Lead } from "../leadTypes";
import type { Client, InvoicePaidEvent, Payment, Quote } from "../quoteTypes";
import type { Commission, Deal } from "../salesTypes";
import type { Task } from "../taskTypes";
import type { TimeInvoiceItem } from "../timeTypes";
import type { Ticket } from "../supportTypes";
import { openTicketCount } from "@/services/support";
import type { SystemTaskInput } from "./demoTasks";
import { AccessError, type Notification, type User } from "../types";

const DAY = 86_400_000;

/** The parts of the demo store the clients module reads and writes. */
export interface ClientsStore {
  /** Support tickets (demoSupport); open ones lower the health score. */
  tickets?: Pick<Ticket, "clientId" | "status">[];
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  deals: Deal[];
  quotes: Quote[];
  payments: Payment[];
  clients: Client[];
  commissions: Commission[];
  subscriptions: Subscription[];
  usageDays: UsageDay[];
  usageRecords: UsageRecord[];
  invoices: Invoice[];
  clientReports: ClientReport[];
  tasks: Task[];
  /** Fake voice platform accounts (UsagePortal). */
  voiceAccounts: Record<string, FakeVoiceAccount>;
  stripeEvents: string[];
  /** Approved billable time (M13) waiting for the client's next invoice. */
  timeInvoiceItems: TimeInvoiceItem[];
}

interface Ctx<S extends ClientsStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  activity: (s: S, a: Omit<Activity, "id" | "at"> & { at?: string }) => void;
  queueEmail: (s: S, lead: Lead, opts: { kind: "manual"; templateKey: string; transactional?: boolean; extraVars?: TemplateVars }) => { id: string };
  /** Client follow-ups are tasks in Delivery › Client care (M9). */
  addTask: (s: S, input: SystemTaskInput) => Task;
  completeTask: (s: S, taskId: string, userId: string) => void;
  origin: () => string;
}

export const emptyClientsState = () => ({
  subscriptions: [] as Subscription[],
  usageDays: [] as UsageDay[],
  usageRecords: [] as UsageRecord[],
  invoices: [] as Invoice[],
  clientReports: [] as ClientReport[],
  voiceAccounts: {} as Record<string, FakeVoiceAccount>,
});

export const newOnboarding = (ownerId: string | null): OnboardingStep[] =>
  ONBOARDING_STEPS.map((st) => ({ key: st.key, done: false, doneAt: null, doneBy: null, ownerId: st.auto ? null : ownerId }));

const COST_PER_MINUTE_MINOR = 10; // our voice platform cost estimate: 0.10 per minute (calculator default costMin)

export const createDemoClients = <S extends ClientsStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify, activity } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();
  const portalAccounts = { current: {} as Record<string, FakeVoiceAccount> };
  const portal = createFakeUsagePortal(() => portalAccounts.current);

  const CLIENT_TASK_TYPES: ClientTask["type"][] = ["health_call", "number_release", "export_data"];
  /** Tasks linked to a client, in the shape the client panel shows. */
  const clientTasksOf = (s: S, clientId: string): ClientTask[] =>
    s.tasks
      .filter((t) => !t.deletedAt && t.linked?.type === "client" && t.linked.id === clientId)
      .map((t) => ({
        id: t.id, clientId, type: CLIENT_TASK_TYPES.find((x) => t.tags.includes(x)) ?? "health_call", title: t.title, assigneeId: t.assigneeIds[0] ?? null,
        dueAt: t.dueAt ? `${t.dueAt}T12:00:00.000Z` : t.createdAt, doneAt: t.status === "done" ? (t.completedAt ?? t.updatedAt) : null, createdAt: t.createdAt,
      }));

  const dealOf = (s: S, c: Client) => s.deals.find((d) => d.id === c.dealId)!;
  const leadOf = (s: S, c: Client) => s.leads.find((l) => l.id === c.leadId)!;
  const companyOf = (s: S, c: Client) => s.companies.find((x) => x.id === c.companyId);
  const subOf = (s: S, c: Client) => s.subscriptions.find((x) => x.clientId === c.id) ?? null;
  const implementer = () => users.find((u) => u.role === "implementer" && u.active) ?? null;
  const admins = () => users.filter((u) => u.role === "admin" && u.active);

  const canSeeClient = (s: S, user: User, c: Client) =>
    user.role === "admin" || user.role === "implementer" || user.role === "viewer" || ((user.role === "bdr" || user.role === "closer") && dealOf(s, c)?.ownerId === user.id);
  const requireClientsAccess = (user: User) => {
    if (!["admin", "implementer", "viewer", "bdr", "closer"].includes(user.role)) throw new AccessError(403);
  };
  const seesFinance = (user: User) => user.role !== "implementer";

  const selectionFor = (s: S, deal: Deal): QuoteSelection => {
    const paid = s.quotes.filter((q) => q.dealId === deal.id && (q.status === "paid" || q.status === "accepted")).sort((a, b) => b.version - a.version)[0];
    return paid?.selection ?? deal.draft ?? selectionFromItems(deal.items, deal.market, deal.pilot);
  };
  const itemName = (code: string) => BY_ID[code]?.name ?? PRICE_ITEMS.find((i) => i.code === code)?.name ?? code;
  const planText = (deal: Deal, sub: Subscription | null, withPrice: boolean) => {
    const names = deal.items.map(itemName);
    const head = names.length > 1 ? `${names[0].replace(/ \(.*\)$/, "")} + ${names.length - 1} more` : (names[0] ?? "Custom").replace(/ \(.*\)$/, "");
    const price = withPrice && sub ? ` · ${money(sub.monthlyMinor, sub.currency, false)}/mo` : withPrice ? ` · ${money(deal.monthlyMinor, deal.currency, false)}/mo` : "";
    return `${head}${deal.pilot ? " · pilot" : ""}${price}`;
  };

  // ---------------------------------------------------------------- payments (Stripe invoice.paid)

  /** invoice.paid: payments per line type, recurring commission (10% of monthly, first 6 monthly payments, 30-day clawback). */
  const applyInvoicePaid = (s: S, event: InvoicePaidEvent) => {
    const inv = s.invoices.find((i) => i.id === event.data.object.metadata.invoiceId);
    if (!inv || inv.status === "paid") return;
    const at = event.created;
    Object.assign(inv, { status: "paid", paidAt: at });
    const deal = s.deals.find((d) => d.id === inv.dealId)!;
    for (const line of inv.lines) {
      s.payments.push({
        id: uid("py"), dealId: inv.dealId, clientId: inv.clientId, amountMinor: line.amountMinor, currency: inv.currency,
        type: line.type === "annual" ? "monthly" : line.type, status: "paid", stripeEventId: event.id, stripeSessionId: null, paidAt: at,
      });
    }
    const owner = users.find((u) => u.id === deal.ownerId);
    if (!owner || (owner.role !== "bdr" && owner.role !== "closer")) return;
    const already = s.commissions.filter((c) => c.dealId === deal.id && c.type === "recurring_commission").reduce((n, c) => n + (c.note?.startsWith("Annual") ? COMM_MONTHS : 1), 0);
    for (const line of inv.lines) {
      if (line.type !== "monthly" && line.type !== "annual") continue;
      if (already >= COMM_MONTHS) break;
      const months = line.type === "annual" ? COMM_MONTHS - already : 1;
      const base = line.type === "annual" ? (line.amountMinor / 12) * months : line.amountMinor;
      s.commissions.push({
        id: uid("cm"), userId: owner.id, meetingId: null, dealId: deal.id, type: "recurring_commission",
        amountMinor: Math.round(base * COMM_PCT), currency: inv.currency, status: "pending", period: at.slice(0, 7),
        earnableAt: iso(new Date(at).getTime() + 30 * DAY),
        note: line.type === "annual" ? `Annual prepay: 10% of ${months} months' fees` : `10% of monthly fee · payment ${already + 1} of ${COMM_MONTHS}`,
        createdAt: at,
      });
    }
  };

  /** The fake Stripe charges the card on file right away and sends invoice.paid (idempotent by event id). */
  /** Pending Stripe invoice items from approved billable time (M13), created before `at`. */
  const pendingTimeItems = (s: S, clientId: string, at: number) =>
    (s.timeInvoiceItems ?? []).filter((i) => i.clientId === clientId && i.status === "pending" && new Date(i.createdAt).getTime() <= at);
  const timeLines = (items: TimeInvoiceItem[]): InvoiceLine[] => items.map((i) => ({ type: "time", description: i.description, amountMinor: i.amountMinor }));

  const issueInvoice = (s: S, client: Client, period: string, baseLines: InvoiceLine[], issuedAt: number) => {
    const items = period === "go-live" ? [] : pendingTimeItems(s, client.id, issuedAt).filter((i) => i.currency === dealOf(s, client).currency);
    const lines = [...baseLines, ...timeLines(items)];
    if (!lines.length) return null;
    const deal = dealOf(s, client);
    const inv: Invoice = {
      id: uid("in"), clientId: client.id, dealId: deal.id, period, lines, totalMinor: total(lines), currency: deal.currency,
      status: "open", stripeInvoiceId: `in_test_${uid("").slice(1)}`, issuedAt: iso(issuedAt), dueAt: dueDate(issuedAt), paidAt: null,
    };
    s.invoices.push(inv);
    for (const i of items) Object.assign(i, { status: "invoiced", invoiceId: inv.id });
    const event: InvoicePaidEvent = {
      id: `evt_test_${inv.stripeInvoiceId.slice(8)}`, type: "invoice.paid", created: iso(Math.min(now(), issuedAt + 3_600_000)),
      data: { object: { id: inv.stripeInvoiceId, amount_paid: inv.totalMinor, currency: inv.currency.toLowerCase(), metadata: { invoiceId: inv.id } } },
    };
    if (!s.stripeEvents.includes(event.id)) {
      s.stripeEvents.push(event.id);
      applyInvoicePaid(s, event);
    }
    return inv;
  };

  // ---------------------------------------------------------------- go-live, usage, month end

  const goLive = (s: S, client: Client, at: number, userId: string | null) => {
    const deal = dealOf(s, client);
    const sel = selectionFor(s, deal);
    const r = compute(sel);
    const list = compute({ ...sel, pilot: false });
    const includedMinutes = r.lines.reduce((sum, l) => sum + (BY_ID[l.id]?.mins ?? 0) * l.q, 0);
    const paidQuote = s.quotes.find((q) => q.dealId === deal.id && q.status === "paid");
    const monthlyMinor = paidQuote?.monthlyMinor ?? deal.monthlyMinor;
    const voiceAccountId = `va_${client.id}`;
    const sub: Subscription = {
      id: uid("sub"), clientId: client.id, stripeCustomerId: `cus_test_${uid("").slice(1)}`, stripeSubscriptionId: `sub_test_${uid("").slice(1)}`,
      currency: MARKETS[sel.market].currency, market: sel.market, monthlyMinor, listMonthlyMinor: Math.max(monthlyMinor, Math.round(list.monthly * 100)),
      includedMinutes, overageRateMinor: Math.round(sel.overRate * 100), billing: sel.billing, pilot: sel.pilot,
      freeUntil: sel.pilot ? iso(addMonths(at, 1)) : null, pilotUntil: sel.pilot ? iso(addMonths(at, 12)) : null,
      prepaidUntil: sel.billing === "annual" ? iso(addMonths(at, 12)) : null, voiceAccountId,
      status: "active", startedAt: iso(at), pausedAt: null, canceledAt: null,
    };
    s.subscriptions.push(sub);
    if (includedMinutes > 0) {
      s.voiceAccounts[voiceAccountId] ??= { minutesPerDay: includedMinutes / 30, level: 0.85 + hash01(client.id) * 0.35, declineFrom: null, declineTo: 1 };
    }
    Object.assign(client, { status: "live", liveAt: iso(at) });
    // Setup balance (50% at launch) plus the first (partial) month, or the annual prepay.
    const deposits = s.payments.filter((p) => p.dealId === deal.id && p.type === "setup_deposit").reduce((n, p) => n + p.amountMinor, 0);
    const setup = paidQuote?.setupMinor ?? deal.setupMinor;
    const balance = setup - (deposits || (deal.depositPaid ? Math.round(setup * DEPOSIT_SHARE) : 0));
    const lines: InvoiceLine[] = [];
    if (balance > 0) lines.push({ type: "setup_balance", description: "Setup · balance due at launch", amountMinor: balance });
    if (sub.billing === "annual") lines.push({ type: "annual", description: "Annual prepay · 12 months for 10", amountMinor: annualCharge(sub) });
    else {
      const fee = feeForPeriod(sub, monthKey(at));
      if (fee > 0) lines.push({ type: "monthly", description: `Monthly · ${monthLabel(monthKey(at))} (from go-live)`, amountMinor: fee });
    }
    issueInvoice(s, client, "go-live", lines, at);
    activity(s, { leadId: client.leadId, userId, type: "stage_change", title: "Client went live", detail: `Billing started${sub.pilot ? " · pilot: first month free" : ""}`, disposition: null, durationS: null, at: iso(at) });
    audit(userId, "client.go_live", "client", client.id, null, { subscription: sub.stripeSubscriptionId });
  };

  const importUsage = (s: S, until: string) => {
    portalAccounts.current = s.voiceAccounts;
    let added = 0;
    const lastByClient = new Map<string, string>();
    for (const d of s.usageDays) if ((lastByClient.get(d.clientId) ?? "") < d.date) lastByClient.set(d.clientId, d.date);
    for (const sub of s.subscriptions) {
      if (!s.voiceAccounts[sub.voiceAccountId]) continue;
      const stopAt = sub.canceledAt ?? sub.pausedAt;
      const end = stopAt && dayKey(stopAt) <= until ? dayKey(new Date(stopAt).getTime() - DAY) : until;
      const last = lastByClient.get(sub.clientId);
      let t = last ? Date.parse(`${last}T00:00:00Z`) + DAY : Date.parse(`${dayKey(sub.startedAt)}T00:00:00Z`);
      for (; dayKey(t) <= end; t += DAY) {
        const raw = portal.dailyUsage(sub.voiceAccountId, dayKey(t));
        s.usageDays.push({ clientId: sub.clientId, date: dayKey(t), ...raw, costMinor: raw.minutes * COST_PER_MINUTE_MINOR });
        added++;
      }
    }
    return added;
  };

  const daysIn = (s: S, clientId: string, period: string) => s.usageDays.filter((d) => d.clientId === clientId && d.date.startsWith(period)).sort((a, b) => a.date.localeCompare(b.date));

  const closeUsageMonth = (s: S, sub: Subscription, period: string) => {
    const days = daysIn(s, sub.clientId, period);
    const minutesUsed = days.reduce((n, d) => n + d.minutes, 0);
    const over = overage(minutesUsed, sub.includedMinutes, sub.overageRateMinor);
    const rec: UsageRecord = {
      id: uid("ur"), clientId: sub.clientId, period, minutesUsed, callsCount: days.reduce((n, d) => n + d.calls, 0), includedMinutes: sub.includedMinutes,
      overageMinutes: over.overMinutes, overageMinor: over.amountMinor, costMinor: days.reduce((n, d) => n + d.costMinor, 0), source: "fake_portal", createdAt: iso(),
    };
    s.usageRecords.push(rec);
    return rec;
  };

  const reportFor = (s: S, client: Client, period: string, sentBy: string | null, at = now()) => {
    const lead = leadOf(s, client);
    const company = companyOf(s, client);
    const kpis = kpisFor(daysIn(s, client.id, period));
    const token = `${uid("rp")}${uid("").slice(1)}`;
    const url = `${ctx.origin()}/r/${token}`;
    const email = ctx.queueEmail(s, lead, {
      kind: "manual", templateKey: "client_report", transactional: true,
      extraVars: {
        report_url: url, "report.period": monthLabel(period), "report.calls": kpis.callsAnswered.toLocaleString("en-US"),
        "report.after_hours": kpis.afterHours.toLocaleString("en-US"), "report.booked": kpis.jobsBooked.toLocaleString("en-US"), "report.missed": String(kpis.missed),
      },
    });
    const report: ClientReport = { id: uid("cr"), clientId: client.id, period, token, kpis, emailId: email.id, sentAt: iso(at), sentBy };
    s.clientReports.push(report);
    activity(s, { leadId: lead.id, userId: sentBy, type: "email", title: `Monthly report · ${monthLabel(period)}`, detail: `${kpis.callsAnswered} calls answered · ${kpis.jobsBooked} jobs booked · sent to ${company?.name ?? "client"}`, disposition: null, durationS: null, at: iso(at) });
    audit(sentBy, "client.report", "client", client.id, null, { period, emailId: email.id });
    return report;
  };

  const healthOf = (s: S, client: Client, sub: Subscription | null) =>
    healthScore({
      days: s.usageDays.filter((d) => d.clientId === client.id),
      now: now(),
      invoices: s.invoices.filter((i) => i.clientId === client.id),
      openTickets: openTicketCount(s.tickets ?? [], client.id),
      metered: !!sub && sub.includedMinutes > 0,
    });

  const autoSteps = (s: S) => {
    let n = 0;
    for (const c of s.clients) {
      if (c.status !== "onboarding") continue;
      for (const [auto, after] of [["agent_drafted", "intake"], ["test_calls", "number_forwarded"]] as const) {
        const step = c.onboarding.find((x) => x.key === auto)!;
        const prev = c.onboarding.find((x) => x.key === after)!;
        if (step.done || !prev.done || !prev.doneAt) continue;
        const at = new Date(prev.doneAt).getTime() + DAY;
        if (at > now()) continue;
        Object.assign(step, { done: true, doneAt: iso(at), doneBy: null });
        n++;
      }
    }
    return n;
  };

  const runJobs = (s: S) => {
    const t = now();
    const run = { usageDays: 0, invoices: 0, reports: 0, tasks: 0, autoSteps: autoSteps(s) };
    run.usageDays = importUsage(s, dayKey(t - DAY));
    const current = monthKey(t);
    for (const sub of s.subscriptions) {
      const client = s.clients.find((c) => c.id === sub.clientId)!;
      const lastMonth = sub.canceledAt ? monthKey(sub.canceledAt) : current;
      for (const period of monthsBetween(monthKey(sub.startedAt), lastMonth)) {
        if (period >= current) break;
        if (s.usageRecords.some((r) => r.clientId === sub.clientId && r.period === period)) continue;
        const rec = closeUsageMonth(s, sub, period);
        const issuedAt = monthStart(nextMonth(period));
        if (issueInvoice(s, client, period, monthEndLines(sub, period, rec.minutesUsed), issuedAt)) run.invoices++;
        if (sub.includedMinutes > 0 && client.status !== "churned" && !s.clientReports.some((r) => r.clientId === client.id && r.period === period)) {
          reportFor(s, client, period, null, issuedAt);
          run.reports++;
        }
      }
    }
    // Health under 60 → a call task within 48 h (at most one open per client).
    for (const client of s.clients.filter((c) => c.status === "live")) {
      const h = healthOf(s, client, subOf(s, client));
      if (h.score >= HEALTH_TASK_BELOW) continue;
      if (clientTasksOf(s, client.id).some((x) => x.type === "health_call" && !x.doneAt)) continue;
      const deal = dealOf(s, client);
      const assignee = deal.ownerId ?? admins()[0]?.id ?? null;
      const name = companyOf(s, client)?.name ?? "client";
      ctx.addTask(s, {
        spaceName: "Delivery", listName: "Client care", title: `Call ${name}: health ${h.score} · ${h.reason}`, assigneeIds: assignee ? [assignee] : [],
        dueAt: iso(t + HEALTH_TASK_HOURS * 3_600_000).slice(0, 10), linked: { type: "client", id: client.id }, tags: ["health_call"], priority: "urgent",
        descriptionMd: `Health dropped under ${HEALTH_TASK_BELOW}: ${h.reason}. Call within ${HEALTH_TASK_HOURS} hours.`,
      });
      for (const u of new Set([assignee, ...admins().map((a) => a.id)])) if (u) notify({ userId: u, type: "client_health", text: `Churn risk: ${name} · health ${h.score} (${h.reason})`, href: `/clients/${client.id}` });
      run.tasks++;
    }
    return run;
  };

  /** Demo seed: won deals with a paid deposit become clients; older ones are live with billing history. */
  const seedClients = (s: S) => {
    const t = now();
    const won = s.deals.filter((d) => d.stage === "won" && d.depositPaid && d.wonAt).sort((a, b) => a.wonAt!.localeCompare(b.wonAt!));
    let declined = false;
    for (const deal of won) {
      const lead = s.leads.find((l) => l.id === deal.leadId);
      if (!lead || s.clients.some((c) => c.dealId === deal.id)) continue;
      const wonAt = new Date(deal.wonAt!).getTime();
      const client: Client = {
        id: `cl-${deal.id.slice(3)}`, companyId: lead.companyId, leadId: lead.id, dealId: deal.id, status: "onboarding",
        liveAt: null, churnedAt: null, churnReason: null, createdAt: deal.wonAt!, onboarding: newOnboarding(implementer()?.id ?? null),
      };
      s.clients.push(client);
      const age = (t - wonAt) / DAY;
      const stepsDone = age >= 12 ? 5 : Math.min(4, Math.floor(age / 2.5));
      client.onboarding.slice(0, stepsDone).forEach((st, i) => Object.assign(st, { done: true, doneAt: iso(wonAt + (i + 1) * 1.5 * DAY), doneBy: st.ownerId }));
      if (stepsDone === 5) {
        goLive(s, client, wonAt + 8 * DAY, null);
        const sub = subOf(s, client)!;
        // One client's usage drops in the last 10 days, to show the churn-risk flow.
        if (!declined && sub.includedMinutes > 0 && age > 30) {
          s.voiceAccounts[sub.voiceAccountId].declineFrom = dayKey(t - 10 * DAY);
          s.voiceAccounts[sub.voiceAccountId].declineTo = 0.3;
          declined = true;
        }
      }
    }
  };

  // ---------------------------------------------------------------- API

  const api: ClientsApi = {
    async runBillingJobs() {
      await viewer();
      const s = await load();
      const run = runJobs(s);
      if (run.usageDays || run.invoices || run.reports || run.tasks || run.autoSteps) await save();
      return run;
    },

    async listInvoices() {
      const user = await viewer();
      if (user.role !== "admin" && user.role !== "viewer") throw new AccessError(403, "Invoices are for the founders and the accountant.");
      const s = await load();
      return s.invoices
        .map((i) => {
          const c = s.clients.find((x) => x.id === i.clientId);
          return { ...i, companyName: (c && companyOf(s, c)?.name) ?? "—" };
        })
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    },

    async clientsOverview() {
      const user = await viewer();
      requireClientsAccess(user);
      const s = await load();
      const finance = seesFinance(user);
      const current = monthKey(now());
      const cards: ClientCard[] = [];
      for (const c of s.clients.filter((x) => canSeeClient(s, user, x))) {
        const deal = dealOf(s, c);
        const sub = subOf(s, c);
        const name = companyOf(s, c)?.name ?? "—";
        const plan = planText(deal, sub, finance);
        if (c.status === "onboarding") {
          const done = c.onboarding.filter((x) => x.done).length;
          const next = ONBOARDING_STEPS.find((st) => !c.onboarding.find((x) => x.key === st.key)?.done);
          cards.push({ id: c.id, status: "onboarding", companyName: name, plan, progress: done / ONBOARDING_STEPS.length, over: false, line: `Step ${done + 1} of ${ONBOARDING_STEPS.length} · ${next?.label ?? "ready"}`, href: `/clients/${c.id}` });
        } else if (sub && sub.includedMinutes > 0 && c.status !== "churned") {
          const used = daysIn(s, c.id, current).reduce((n, d) => n + d.minutes, 0);
          const over = Math.max(0, used - sub.includedMinutes);
          cards.push({
            id: c.id, status: c.status, companyName: name, plan, progress: Math.min(1, used / sub.includedMinutes), over: over > 0,
            line: `${used.toLocaleString("en-US")} / ${sub.includedMinutes.toLocaleString("en-US")} min${over ? ` · +${over.toLocaleString("en-US")} over` : ""}${c.status === "paused" ? " · paused" : ""}`,
            href: `/clients/${c.id}`,
          });
        } else {
          const line = c.status === "churned" ? `Churned ${dayKey(c.churnedAt ?? now())} · ${c.churnReason ?? ""}` : `Live since ${dayKey(c.liveAt ?? now())} · no usage metering`;
          cards.push({ id: c.id, status: c.status, companyName: name, plan, progress: c.status === "churned" ? 0 : 1, over: false, line, href: `/clients/${c.id}` });
        }
      }
      // Accepted quotes waiting for the deposit (not for the implementer).
      if (finance) {
        for (const q of s.quotes.filter((x) => x.status === "accepted")) {
          const deal = s.deals.find((d) => d.id === q.dealId);
          if (!deal || (user.role !== "admin" && user.role !== "viewer" && deal.ownerId !== user.id)) continue;
          const lead = s.leads.find((l) => l.id === deal.leadId);
          const name = s.companies.find((x) => x.id === lead?.companyId)?.name ?? "—";
          cards.push({ id: `q-${q.id}`, status: "proposal", companyName: name, plan: `${planText(deal, null, false)} · quote v${q.version}`, progress: 0, over: false, line: "Waiting for deposit", href: `/deals/${deal.id}` });
        }
      }
      const order = { live: 0, onboarding: 1, paused: 2, proposal: 3, churned: 4 } as const;
      cards.sort((a, b) => order[a.status] - order[b.status] || a.companyName.localeCompare(b.companyName));
      const activeSubs = s.subscriptions.filter((x) => x.status === "active" && canSeeClient(s, user, s.clients.find((c) => c.id === x.clientId)!));
      let mrr: Partial<Record<"USD" | "EUR", number>> | null = null;
      if (user.role === "admin" || user.role === "viewer") {
        mrr = {};
        for (const sub of activeSubs) {
          const monthly = sub.billing === "annual" ? Math.round(annualCharge(sub) / 12) : sub.pilot && sub.pilotUntil && new Date(sub.pilotUntil).getTime() > now() ? sub.monthlyMinor : sub.listMonthlyMinor;
          mrr[sub.currency] = (mrr[sub.currency] ?? 0) + monthly;
        }
      }
      return {
        cards,
        count: cards.filter((c) => c.status !== "proposal" && c.status !== "churned").length,
        mrr,
        nextInvoiceAt: activeSubs.length ? iso(monthStart(nextMonth(current))) : null,
      };
    },

    async getClient(id, periodArg) {
      const user = await viewer();
      requireClientsAccess(user);
      const s = await load();
      const c = s.clients.find((x) => x.id === id);
      if (!c) throw new AccessError(404);
      if (!canSeeClient(s, user, c)) throw new AccessError(403);
      const deal = dealOf(s, c);
      const lead = leadOf(s, c);
      const sub = subOf(s, c);
      const contact = s.contacts.find((x) => x.id === lead.primaryContactId) ?? null;
      const current = monthKey(now());
      const lastPeriod = c.churnedAt ? monthKey(c.churnedAt) : current;
      const periods = c.liveAt ? monthsBetween(monthKey(c.liveAt), lastPeriod).reverse() : [current];
      // Default: this month, or last month on the 1st before any usage has been imported.
      const fallback = periods.length > 1 && !daysIn(s, c.id, periods[0]).length ? periods[1] : periods[0];
      const period = periodArg && periods.includes(periodArg) ? periodArg : fallback;
      const days = daysIn(s, c.id, period);
      const metered = !!sub && sub.includedMinutes > 0;
      const used = days.reduce((n, d) => n + d.minutes, 0);
      const included = sub?.includedMinutes ?? 0;
      const finance = seesFinance(user);
      let next = null;
      if (sub && period === current && sub.status !== "canceled") {
        const lines = [...monthEndLines(sub, period, used), ...timeLines(pendingTimeItems(s, c.id, Infinity).filter((i) => i.currency === sub.currency))];
        next = { date: iso(monthStart(nextMonth(period))), lines, totalMinor: total(lines) };
      }
      const usageCost = days.reduce((n, d) => n + d.costMinor, 0);
      const revenue = sub ? feeForPeriod(sub, period) + overage(used, included, sub.overageRateMinor).amountMinor : 0;
      const detail: ClientDetail = {
        client: c,
        companyName: companyOf(s, c)?.name ?? "—",
        contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
        contactEmail: contact?.email ?? null,
        deal: { id: deal.id, brand: deal.brand, items: deal.items, pilot: deal.pilot, ownerId: deal.ownerId },
        ownerName: users.find((u) => u.id === deal.ownerId)?.name ?? null,
        plan: planText(deal, sub, finance),
        onboarding: c.onboarding,
        period,
        periods,
        days,
        usage: { used, included, overMinutes: Math.max(0, used - included), overFrom: metered ? overLimitFrom(days, included) : null, metered },
        kpis: kpisFor(days),
        health: c.status === "live" || c.status === "paused" ? healthOf(s, c, sub) : null,
        tasks: clientTasksOf(s, c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        reports: s.clientReports.filter((r) => r.clientId === c.id).sort((a, b) => b.period.localeCompare(a.period)),
        finance: finance ? { currency: deal.currency, subscription: sub, next, invoices: s.invoices.filter((i) => i.clientId === c.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)) } : null,
        costs: user.role === "admin" ? { usageCostMinor: usageCost, marginPct: marginPct(revenue, usageCost) } : null,
        can: {
          onboard: (user.role === "admin" || user.role === "implementer") && c.status === "onboarding",
          status: user.role === "admin" && c.status !== "onboarding" && c.status !== "churned",
          report: (user.role === "admin" || user.role === "implementer") && metered,
        },
      };
      return detail;
    },

    async setOnboardingStep(clientId, key: OnboardingKey, done) {
      const user = await viewer();
      if (user.role !== "admin" && user.role !== "implementer") throw new AccessError(403);
      const s = await load();
      const c = s.clients.find((x) => x.id === clientId);
      if (!c) throw new AccessError(404);
      if (c.status !== "onboarding") throw new Error("Onboarding is finished for this client.");
      const idx = ONBOARDING_STEPS.findIndex((st) => st.key === key);
      const step = c.onboarding[idx];
      if (key === "go_live") {
        if (!done) return;
        const missing = c.onboarding.slice(0, idx).filter((x) => !x.done);
        if (missing.length) throw new Error(`Finish these first: ${missing.map((m) => ONBOARDING_STEPS.find((st) => st.key === m.key)!.label.toLowerCase()).join(", ")}.`);
        Object.assign(step, { done: true, doneAt: iso(), doneBy: user.id });
        goLive(s, c, now(), user.id);
      } else {
        Object.assign(step, done ? { done: true, doneAt: iso(), doneBy: user.id } : { done: false, doneAt: null, doneBy: null });
        audit(user.id, "client.onboarding", "client", c.id, null, { key, done });
      }
      await save();
    },

    async setClientStatus(clientId, status, reason) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403, "Only admins change a client's status.");
      if (!reason.trim()) throw new Error("Add a reason.");
      const s = await load();
      const c = s.clients.find((x) => x.id === clientId);
      if (!c) throw new AccessError(404);
      const sub = subOf(s, c);
      if (!sub || c.status === "onboarding" || c.status === "churned") throw new Error("Only live or paused clients can change status.");
      const before = c.status;
      const t = now();
      const name = companyOf(s, c)?.name ?? "client";
      if (status === "paused") {
        if (c.status !== "live") throw new Error("Only a live client can be paused.");
        Object.assign(sub, { status: "paused", pausedAt: iso(t) });
        c.status = "paused";
      } else if (status === "live") {
        if (c.status !== "paused") throw new Error("Only a paused client can be resumed.");
        // Usage from the pause to now isn't imported; billing resumes from the next period.
        importUsage(s, dayKey(t - DAY));
        Object.assign(sub, { status: "active", pausedAt: null });
        c.status = "live";
      } else {
        // Cancel: final invoice for this month's usage so far; number release and data export tasks; claw back unearned commissions.
        importUsage(s, dayKey(t - DAY));
        Object.assign(sub, { status: "canceled", canceledAt: iso(t) });
        const period = monthKey(t);
        if (!s.usageRecords.some((r) => r.clientId === c.id && r.period === period)) {
          const rec = closeUsageMonth(s, sub, period);
          issueInvoice(s, c, period, monthEndLines(sub, period, rec.minutesUsed), t);
        }
        Object.assign(c, { status: "churned", churnedAt: iso(t), churnReason: reason.trim() });
        const assignee = implementer()?.id ?? user.id;
        for (const [type, title] of [["number_release", `Release ${name}'s forwarded number`], ["export_data", `Export ${name}'s data and send it to them`]] as const) {
          ctx.addTask(s, { spaceName: "Delivery", listName: "Client care", title, assigneeIds: [assignee], dueAt: iso(t + 2 * DAY).slice(0, 10), linked: { type: "client", id: c.id }, tags: [type] });
        }
        for (const cm of s.commissions) {
          if (cm.dealId === c.dealId && cm.status === "pending" && cm.earnableAt && new Date(cm.earnableAt).getTime() > t) cm.status = "clawed_back";
        }
      }
      activity(s, { leadId: c.leadId, userId: user.id, type: "stage_change", title: `Client ${before} → ${c.status}`, detail: reason.trim(), disposition: null, durationS: null });
      audit(user.id, "client.status", "client", c.id, { status: before }, { status: c.status, reason: reason.trim() });
      await save();
    },

    async sendClientReport(clientId, period) {
      const user = await viewer();
      if (user.role !== "admin" && user.role !== "implementer") throw new AccessError(403);
      const s = await load();
      const c = s.clients.find((x) => x.id === clientId);
      if (!c) throw new AccessError(404);
      const sub = subOf(s, c);
      if (!sub || sub.includedMinutes === 0) throw new Error("This client has no usage to report.");
      const report = reportFor(s, c, period, user.id);
      await save();
      return report;
    },

    async publicClientReport(token) {
      const s = await load();
      const r = s.clientReports.find((x) => x.token === token);
      if (!r) return null;
      const c = s.clients.find((x) => x.id === r.clientId)!;
      const deal = dealOf(s, c);
      return {
        companyName: companyOf(s, c)?.name ?? "",
        brandName: deal.brand === "gllarix" ? "Gllarix" : "Arcadian",
        period: r.period,
        kpis: r.kpis,
        includedMinutes: subOf(s, c)?.includedMinutes ?? 0,
        days: daysIn(s, c.id, r.period).map((d) => ({ date: d.date, minutes: d.minutes })),
      };
    },

    async completeClientTask(taskId) {
      const user = await viewer();
      const s = await load();
      const task = s.tasks.find((x) => x.id === taskId && !x.deletedAt);
      if (!task || task.linked?.type !== "client") throw new AccessError(404);
      if (user.role !== "admin" && !task.assigneeIds.includes(user.id)) throw new AccessError(403);
      ctx.completeTask(s, taskId, user.id);
      audit(user.id, "client.task_done", "client", task.linked.id, null, { taskId });
      await save();
    },

    async exportClientUsage(clientId) {
      const user = await viewer();
      if (user.role !== "admin" && user.role !== "implementer") throw new AccessError(403);
      const s = await load();
      const rows = s.usageDays.filter((d) => d.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date));
      const head = "date,minutes,calls_answered,after_hours,jobs_booked,missed";
      return [head, ...rows.map((d) => [d.date, d.minutes, d.calls, d.afterHours, d.booked, d.missed].join(","))].join("\n");
    },
  };

  return { api, applyInvoicePaid, seedClients, runJobs };
};
