import knowledgeFiles from "virtual:atlas-knowledge";
import { AI_MONTHLY_CAP_MINOR, OWNER_KEYS } from "@/config/ai";
import { BY_ID, MARKETS, type MarketId } from "@/config/priceBook";
import { USD_PER_EUR } from "@/config/targets";
import {
  answerCostMinor, classify, createFakeAdvisorProvider, EXCLUDED_DOCS, FINANCE_DOCS, FINANCE_ROLES, NOT_FOR_ROLE, TOOL_ACCESS, unsourcedFigures,
  type AdvisorProvider, type CapacityData, type ClientsData, type DecisionsData, type FinanceData, type KpiData, type MrrData, type PassageData, type QuoteData,
  type ScenarioData, type TasksData, type TeamData, type TimeData, type ToolRun,
} from "@/services/advisor";
import { buildIndex, knowledgeVersion, parseDecisionLog, tokenize, type KnowledgeIndex } from "@/services/knowledge";
import { compute, selectionFromItems } from "@/services/pricing";
import { runScenario, type Hire } from "@/services/scenarios";
import { isoWeekKey, isoWeekRange, localDateKey, shiftDateKey, zonedToUtc } from "@/services/time";
import type {
  AdvisorApi, AdvisorDocument, AdvisorMessage, AdvisorRole, AdvisorSettings, AdvisorThread, CashSnapshot, Decision, Expense, MemoryFact, ProposedAction, ProposedTask, ThreadListItem, ToolCall, ToolName,
} from "../advisorTypes";
import { ADVISOR_ROLES, DRAFT_TOOLS } from "../advisorTypes";
import type { Availability, CapacityPlan } from "../capacityTypes";
import type { ClientDetail, ClientsOverview } from "../clientTypes";
import type { Scorecard } from "../coachTypes";
import type { Activity, Company, Lead, Source } from "../leadTypes";
import type { Meeting } from "../queueTypes";
import type { Client, Payment } from "../quoteTypes";
import type { DealRow, PipelineQuery, WeeklyReport } from "../salesTypes";
import type { Task } from "../taskTypes";
import type { ReportGroup, TimeReport } from "../timeTypes";
import { AccessError, type Notification, type User } from "../types";

const DAY = 86_400_000;
const CET = "Europe/Berlin";
const DEFAULT_RESERVE_EUR = 3000;

export interface AdvisorStore {
  tasks: Task[];
  clients: Client[];
  payments: Payment[];
  leads: Lead[];
  companies: Company[];
  sources: Source[];
  activities: Activity[];
  meetings: Meeting[];
  plans: { createdAt: string; costMinor: number }[];
  availability: Availability[];
  expenses: Expense[];
  cashSnapshots: CashSnapshot[];
  decisions: Decision[];
  advisorThreads: AdvisorThread[];
  advisorMessages: AdvisorMessage[];
  advisorActions: ProposedAction[];
  advisorMemory: MemoryFact[];
  advisorDocs: AdvisorDocument[];
  advisorSettings: AdvisorSettings;
  advisorJobKeys: string[];
}

export const emptyAdvisorState = () => ({
  expenses: [] as Expense[],
  cashSnapshots: [] as CashSnapshot[],
  decisions: [] as Decision[],
  advisorThreads: [] as AdvisorThread[],
  advisorMessages: [] as AdvisorMessage[],
  advisorActions: [] as ProposedAction[],
  advisorMemory: [] as MemoryFact[],
  advisorDocs: [] as AdvisorDocument[],
  advisorSettings: { roles: { bdr: true, closer: true, implementer: false, viewer: false }, disabledTools: {}, monthlyCapMinor: AI_MONTHLY_CAP_MINOR } as AdvisorSettings,
  advisorJobKeys: [] as string[],
});

/** Tables the advisor writes itself (threads, drafts, logs). Everything else is off limits to tools. */
const ADVISOR_KEYS = new Set(Object.keys(emptyAdvisorState()));

/** The API surface the tools call, as the asking user (so every access rule applies). */
export interface AdvisorReadApi {
  report(input: { kind: "week" | "month"; key?: string; personId?: string | "team" }): Promise<WeeklyReport>;
  pipeline(query: PipelineQuery): Promise<DealRow[]>;
  capacityPlan(q?: { from?: string; weeks?: number }): Promise<CapacityPlan>;
  timeReport(q: { month: string; group: ReportGroup }): Promise<TimeReport>;
  clientsOverview(): Promise<ClientsOverview>;
  getClient(id: string, period?: string): Promise<ClientDetail>;
  scorecard(userId: string, weeks?: number): Promise<Scorecard>;
}

interface Ctx<S extends AdvisorStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  api: () => AdvisorReadApi;
  canSeeTask: (s: S, user: User, t: Task) => boolean;
  canSeeLead: (user: User, lead: Lead) => boolean;
  mrrEur: (s: S) => number;
  /** Accept: creates a task in Company › AI co-founder. */
  createTask: (s: S, user: User, input: { title: string; ownerId: string | null; hours: number; due: string }) => Task;
  provider?: AdvisorProvider;
}

const eurOf = (minor: number, currency: "USD" | "EUR") => (currency === "USD" ? minor / USD_PER_EUR : minor) / 100;
const round = (n: number) => Math.round(n);
/** "€3,420", "−€945" for tool summaries. */
const fe = (n: number) => `${n < 0 ? "−" : ""}€${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export const createDemoAdvisor = <S extends AdvisorStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify } = ctx;
  const provider = ctx.provider ?? createFakeAdvisorProvider();
  const iso = (t = now()) => new Date(t).toISOString();
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
  const isFinance = (u: User) => FINANCE_ROLES.includes(u.role);

  // ---------------------------------------------------------------- knowledge

  const docs = knowledgeFiles.filter((d) => !EXCLUDED_DOCS.includes(d.path));
  let fullIndex: KnowledgeIndex | null = null;
  let limitedIndex: KnowledgeIndex | null = null;
  const indexFor = (u: User) => {
    if (isFinance(u)) return (fullIndex ??= buildIndex(docs));
    return (limitedIndex ??= buildIndex(docs.filter((d) => !FINANCE_DOCS.some((p) => d.path.startsWith(p)))));
  };
  const version = knowledgeVersion(docs);

  // ---------------------------------------------------------------- access and settings

  const canUse = (s: S, u: User) => u.role === "admin" || Boolean(s.advisorSettings.roles[u.role as keyof AdvisorSettings["roles"]]);
  const requireUse = (s: S, u: User) => {
    if (!canUse(s, u)) throw new AccessError(403, "The AI co-founder isn't switched on for your role.");
  };
  const requireAdmin = (u: User) => {
    if (u.role !== "admin") throw new AccessError(403);
  };
  const monthSpendMinor = (s: S) => {
    const m = iso().slice(0, 7);
    const advisor = s.advisorMessages.filter((x) => x.createdAt.startsWith(m)).reduce((n, x) => n + x.costMinor, 0);
    const planner = s.plans.filter((p) => p.createdAt.startsWith(m)).reduce((n, p) => n + p.costMinor, 0);
    return Math.round((advisor + planner) / USD_PER_EUR);
  };
  const reserve = (s: S) => {
    const fact = s.advisorMemory.filter((f) => f.status === "approved" && /reserve/i.test(f.fact)).pop();
    const n = fact?.fact.match(/€\s?([\d,]+)/)?.[1];
    return n ? { eur: Number(n.replace(/,/g, "")), source: "advisor memory (approved)" } : { eur: DEFAULT_RESERVE_EUR, source: "backbone/03 cash reserve rule" };
  };

  // ---------------------------------------------------------------- read-only guard

  const fingerprint = (s: S) => JSON.stringify(s, (k, v) => (ADVISOR_KEYS.has(k) ? undefined : v));
  /** Read tools must not change records. If one does, the change is undone and the call fails. */
  const readOnly = async <T,>(s: S, fn: () => Promise<T>): Promise<T> => {
    const before = fingerprint(s);
    try {
      return await fn();
    } finally {
      if (fingerprint(s) !== before) {
        const restored = JSON.parse(before) as Record<string, unknown>;
        for (const [k, v] of Object.entries(restored)) (s as Record<string, unknown>)[k] = v;
        throw new Error("A read-only tool tried to change data; the change was undone.");
      }
    }
  };

  // ---------------------------------------------------------------- tools

  const financeData = (s: S, monthArg?: string): FinanceData => {
    const month = monthArg || iso().slice(0, 7);
    const end = `${month}-31T23:59:59Z`;
    const paid = s.payments.filter((p) => p.status === "paid" && p.paidAt.startsWith(month));
    const exp = s.expenses.filter((e) => e.date.startsWith(month));
    const byCat = new Map<string, number>();
    for (const e of exp) byCat.set(e.category, (byCat.get(e.category) ?? 0) + eurOf(e.amountMinor, e.currency));
    const lastRecurringMonth = s.expenses.filter((e) => e.recurring && e.date <= end).map((e) => e.date.slice(0, 7)).sort().pop();
    const recurring = s.expenses.filter((e) => e.recurring && lastRecurringMonth && e.date.startsWith(lastRecurringMonth)).reduce((n, e) => n + eurOf(e.amountMinor, e.currency), 0);
    const cash = s.cashSnapshots.filter((c) => c.date <= end.slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).pop() ?? null;
    const r = reserve(s);
    return {
      month, revenueEur: round(paid.reduce((n, p) => n + eurOf(p.amountMinor, p.currency), 0)), costsEur: round([...byCat.values()].reduce((a, b) => a + b, 0)),
      byCategory: [...byCat.entries()].map(([category, eur]) => ({ category, eur: round(eur) })).sort((a, b) => b.eur - a.eur),
      recurringCostsEur: round(recurring), cash: cash ? { date: cash.date, balanceEur: round(cash.balanceMinor / 100) } : null, reserveEur: r.eur, reserveSource: r.source,
      mrrEur: round(ctx.mrrEur(s)), payingClients: s.clients.filter((c) => c.status !== "churned" && s.payments.some((p) => p.clientId === c.id && p.status === "paid")).length,
    };
  };

  const ownerFor = (user: User, owner: unknown): User | null => {
    if (user.role !== "admin") return user; // non-admins propose tasks for themselves only
    const key = String(owner ?? "");
    const id = (OWNER_KEYS as Record<string, string>)[key] ?? key;
    return users.find((u) => u.id === id) ?? null;
  };

  const tools: Record<ToolName, (s: S, user: User, args: Record<string, unknown>, messageId: string) => Promise<{ summary: string; data: unknown; sources?: string[] }>> = {
    async search_knowledge(_s, user, args) {
      const passages = indexFor(user).search(String(args.query ?? ""), { limit: 4 }).map(({ path, heading, text }) => ({ path, heading, text }));
      return { summary: passages.length ? passages.slice(0, 2).map((p) => `${p.path.replace(/\.md$/, "")} · ${p.heading}`).join(" · ") : "No passages found", data: { passages } satisfies PassageData, sources: [...new Set(passages.map((p) => p.path))] };
    },
    async get_decisions(s, _user, args) {
      const q = tokenize(String(args.query ?? ""));
      const status = args.status ? String(args.status) : null;
      const scored = s.decisions
        .filter((d) => !status || d.status.startsWith(status))
        .map((d) => ({ d, score: q.length ? tokenize(`${d.title} ${d.reason}`).filter((t) => q.includes(t)).length : 1 }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      const decisions = scored.map(({ d }) => ({ title: d.title, date: d.date, status: d.status, owner: d.owner, reason: d.reason, reviewDate: d.reviewDate, source: d.source }));
      return { summary: decisions.length ? `${decisions.length} decision${decisions.length > 1 ? "s" : ""} · ${decisions[0].title.slice(0, 60)}` : "No matching decisions", data: { decisions } satisfies DecisionsData, sources: ["context/07_ROADMAP_DECISIONS_AND_OPEN_QUESTIONS.md"] };
    },
    async get_kpis(s, user, args) {
      const kind = args.period === "month" ? "month" : "week";
      const key = kind === "week" && args.last ? isoWeekKey(localDateKey(now() - 7 * DAY, user.timezone)) : undefined;
      const r = await ctx.api().report({ kind, key, personId: user.role === "admin" || user.role === "viewer" ? "team" : user.id });
      const data: KpiData = {
        period: r.period.label,
        kpis: r.kpis.map((k) => ({ label: k.label, value: k.value === null ? null : Math.round(k.value * 100) / 100, target: k.target, status: k.status, unit: k.unit })),
        gates: isFinance(user) ? r.gates.map((g) => ({ label: g.label, value: g.value, met: g.met, note: g.note })) : [],
      };
      if (args.by === "source") {
        const since = now() - 90 * DAY;
        const rows = new Map<string, { contacted: Set<string>; meetings: number }>();
        const visible = new Set(s.leads.filter((l) => ctx.canSeeLead(user, l)).map((l) => l.id));
        const srcOf = (leadId: string) => {
          const lead = s.leads.find((l) => l.id === leadId);
          const company = s.companies.find((c) => c.id === lead?.companyId);
          return s.sources.find((x) => x.id === company?.sourceId)?.name ?? "Unknown";
        };
        for (const a of s.activities) {
          if (!visible.has(a.leadId) || !["call", "email", "linkedin"].includes(a.type) || new Date(a.at).getTime() < since) continue;
          const k2 = srcOf(a.leadId);
          if (!rows.has(k2)) rows.set(k2, { contacted: new Set(), meetings: 0 });
          rows.get(k2)!.contacted.add(a.leadId);
        }
        for (const m of s.meetings) if (visible.has(m.leadId) && new Date(m.createdAt).getTime() >= since) rows.get(srcOf(m.leadId)) && rows.get(srcOf(m.leadId))!.meetings++;
        data.bySource = [...rows.entries()].map(([source, v]) => ({ source, contacted: v.contacted.size, meetings: v.meetings, rate: v.contacted.size ? Math.round((v.meetings / v.contacted.size) * 1000) / 1000 : null }));
      }
      return { summary: data.kpis.slice(0, 3).map((k) => `${k.label} ${k.value ?? "—"}`).join(" · "), data };
    },
    async get_pipeline(_s, user, args) {
      const rows = await ctx.api().pipeline({ brand: (args.brand as PipelineQuery["brand"]) ?? "both", ownerId: "all", allWon: false });
      const byStage = new Map<string, number>();
      for (const r of rows) byStage.set(r.deal.stage, (byStage.get(r.deal.stage) ?? 0) + 1);
      const deals = rows.slice(0, 20).map((r) => ({ company: r.company.name, stage: r.deal.stage, brand: r.deal.brand, owner: r.ownerName, ...(isFinance(user) ? { monthlyMinor: r.deal.monthlyMinor, currency: r.deal.currency } : {}) }));
      return { summary: `${rows.length} open deals · ${[...byStage.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")}`, data: { deals, byStage: Object.fromEntries(byStage) } };
    },
    async get_mrr_history() {
      const r = await ctx.api().report({ kind: "month", personId: "team" });
      const data: MrrData = { months: r.mrr.map((m) => ({ month: m.month, planEur: Math.round(m.planEur), actualEur: m.actualEur === null ? null : Math.round(m.actualEur) })), status: r.mrrStatus };
      const last = data.months.filter((m) => m.actualEur !== null).pop();
      return { summary: last ? `MRR ${fe(last.actualEur ?? 0)} in ${last.month} vs plan ${fe(last.planEur)} · ${data.status.replace("_", " ")}` : "No MRR yet", data };
    },
    async get_finance(s, _u, args) {
      const f = financeData(s, args.month ? String(args.month) : undefined);
      return { summary: `${f.month}: revenue ${fe(f.revenueEur)} · costs ${fe(f.costsEur)}${f.cash ? ` · cash ${fe(f.cash.balanceEur)} (${f.cash.date})` : " · no cash snapshot"} · reserve ${fe(f.reserveEur)}`, data: f };
    },
    async get_expenses(s, _u, args) {
      const lines = s.expenses.filter((e) => (!args.month || e.date.startsWith(String(args.month))) && (!args.category || e.category === args.category)).map((e) => ({ date: e.date, vendor: e.vendor, category: e.category, eur: Math.round(eurOf(e.amountMinor, e.currency)), recurring: e.recurring }));
      return { summary: `${lines.length} lines · ${fe(lines.reduce((n, l) => n + l.eur, 0))}`, data: { lines } };
    },
    async run_price_quote(_s, _u, args) {
      const items = (Array.isArray(args.items) ? args.items : []).map(String).filter((i) => BY_ID[i]);
      if (!items.length) throw new Error("No known price-book items.");
      const market = (MARKETS[String(args.market) as MarketId] ? String(args.market) : "us") as MarketId;
      const pilot = Boolean((args.options as { pilot?: boolean } | undefined)?.pilot);
      const r = compute(selectionFromItems(items, market, pilot));
      const m = MARKETS[market];
      const data: QuoteData = { market: m.label, currency: m.currency as "USD" | "EUR", symbol: m.symbol, items, itemNames: items.map((i) => BY_ID[i].name), pilot, setup: Math.round(r.setup), monthly: Math.round(r.monthly), firstYear: Math.round(r.firstYear), note: m.hint };
      return { summary: `${data.itemNames.join(" + ")} · ${m.label}${pilot ? " · pilot" : ""}: setup ${m.symbol}${data.setup} · monthly ${m.symbol}${data.monthly}`, data };
    },
    async run_scenario(s, _u, args) {
      const scenario = (["worst", "realistic", "best"].includes(String(args.scenario)) ? String(args.scenario) : "realistic") as "worst" | "realistic" | "best";
      const cash = financeData(s).cash?.balanceEur ?? 0;
      const compare = (Array.isArray(args.compare) ? args.compare : [{ label: scenario, hires: (args.hires as Hire[]) ?? [] }]) as { label: string; hires: Hire[] }[];
      const runs = compare.map((c) => {
        const r = runScenario({ scenario, hires: c.hires, openingCashEur: cash });
        return { label: c.label, lowPoint: r.lowPoint, mrrEnd: r.mrrEnd, totals: r.totals, months: r.months.map((m) => ({ month: m.month, mrr: m.mrr, cash: m.cash })) };
      });
      const data: ScenarioData = { runs, method: runScenario({ scenario }).method };
      return { summary: runs.map((r) => `${r.label}: low point ${fe(r.lowPoint.cash)} (${r.lowPoint.month})`).join(" · "), data, sources: ["models/scenarios_by_brand.py", "models/scenarios_combined_v2.py"] };
    },
    async get_capacity(_s, user, args) {
      const plan = await ctx.api().capacityPlan({ weeks: Math.min(12, Number(args.weeks ?? 4)) });
      const people = plan.people
        .filter((p) => p.kind === "person" && (user.role === "admin" || p.id === user.id))
        .map((p) => ({ id: p.id, name: p.name, rows: plan.weeks.map((w) => { const c = plan.cells.find((x) => x.personId === p.id && x.week === w.key); return { week: w.key, cap: c?.cap ?? 0, used: Math.round((c?.used ?? 0) * 10) / 10, free: Math.round((c?.free ?? 0) * 10) / 10 }; }) }));
      const data: CapacityData = { weeks: plan.weeks.map((w) => ({ key: w.key, label: w.label })), people };
      return { summary: people.map((p) => `${p.name.split(" ")[0]} ${p.rows[0]?.used ?? 0}/${p.rows[0]?.cap ?? 0} h`).join(" · "), data };
    },
    async get_tasks(s, user, args) {
      const open = s.tasks.filter((t) => !t.deletedAt && !t.parentId && !["done", "cancelled"].includes(t.status) && ctx.canSeeTask(s, user, t));
      const P: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      let list = open;
      if (args.overdue_days) list = open.filter((t) => t.dueAt && now() - new Date(t.dueAt).getTime() > Number(args.overdue_days) * DAY);
      else if (args.pick === "this_week") list = open.filter((t) => t.dueAt && new Date(t.dueAt).getTime() - now() < 8 * DAY).sort((a, b) => P[a.priority] - P[b.priority] || (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
      const tasks = list.slice(0, Number(args.limit ?? 10)).map((t) => ({ id: t.id, title: t.title, ownerName: nameOf(t.assigneeIds[0] ?? null), due: t.dueAt?.slice(0, 10) ?? null, estimateHours: t.estimateMinutes ? t.estimateMinutes / 60 : null, priority: t.priority, status: t.status }));
      return { summary: tasks.length ? tasks.slice(0, 3).map((t) => t.title.slice(0, 40)).join(" · ") : "No matching tasks", data: { tasks } satisfies TasksData };
    },
    async get_time_report(_s, _u, args) {
      const r = await ctx.api().timeReport({ month: String(args.month ?? iso().slice(0, 7)), group: (args.group_by as ReportGroup) ?? "client" });
      const data: TimeData = { month: r.month, rows: r.rows.map((x) => ({ label: x.label, type: x.type, hours: x.hours, revenueMinor: x.revenueMinor, perHourMinor: x.perHourMinor, marginMinor: x.marginMinor, currency: x.currency, status: x.status })), totalHours: r.totalHours };
      return { summary: `${r.month}: ${r.totalHours} h · ${r.rows.slice(0, 2).map((x) => `${x.label} ${x.hours} h`).join(" · ")}`, data };
    },
    async get_clients(_s, _u, args) {
      const o = await ctx.api().clientsOverview();
      const cards = o.cards.filter((c) => c.status !== "proposal" && (!args.name || c.companyName.toLowerCase().includes(String(args.name).toLowerCase())));
      const clients: ClientsData["clients"] = [];
      for (const c of cards.slice(0, 12)) {
        const d = await ctx.api().getClient(c.id);
        clients.push({ id: c.id, name: c.companyName, status: c.status, plan: d.plan, health: d.health ? { score: d.health.score, risk: d.health.risk, reason: d.health.reason } : null, currency: d.finance?.currency ?? null, monthlyMinor: d.finance?.subscription?.monthlyMinor ?? null, usageCostMinor: d.costs?.usageCostMinor ?? null, marginPct: d.costs?.marginPct ?? null });
      }
      const risky = clients.filter((c) => c.health && c.health.risk !== "low");
      return { summary: `${clients.length} clients${risky.length ? ` · at risk: ${risky.map((c) => `${c.name} (${c.health!.score})`).join(", ")}` : " · none at risk"}`, data: { clients } satisfies ClientsData };
    },
    async get_team_performance(_s, _u, args) {
      const sc = await ctx.api().scorecard(String(args.person ?? "u-bdr"), 4);
      const data: TeamData = { name: sc.name, kpis: sc.kpis.map((k) => ({ label: k.label, latest: k.values[k.values.length - 1] ?? null, target: k.target, status: k.status })), agenda: sc.agenda?.points.map((p) => p.text) ?? [] };
      return { summary: `${sc.name}: ${data.kpis.slice(0, 3).map((k) => `${k.label} ${k.latest ?? "—"}`).join(" · ")}`, data };
    },
    async get_market_notes(_s, user, args) {
      const passages = indexFor(user).search(String(args.topic ?? ""), { limit: 4, paths: ["context/05", "backbone/11", "backbone/07", "plans/usage_pricing_analysis", "plans/new_services_ranked"] }).map(({ path, heading, text }) => ({ path, heading, text }));
      return { summary: passages.map((p) => `${p.path.replace(/\.md$/, "")} · ${p.heading}`).slice(0, 2).join(" · ") || "No market notes", data: { passages } satisfies PassageData, sources: [...new Set(passages.map((p) => p.path))] };
    },
    async web_research() {
      throw new Error("Web research is off in demo mode (it needs the server-side search connector).");
    },
    async propose_tasks(s, user, args, messageId) {
      const plan = await ctx.api().capacityPlan({ weeks: 8 });
      const booked = new Map<string, number>();
      const goalDue = parseDue(String(args.due ?? ""));
      // Tasks run in order: each one is due no earlier than the one before.
      let prevDue = "";
      const tasks: ProposedTask[] = (Array.isArray(args.tasks) ? args.tasks : []).slice(0, 5).map((raw) => {
        const t = raw as { title: string; owner?: string; hours?: number };
        const owner = ownerFor(user, t.owner);
        const hours = Math.max(0.5, Number(t.hours ?? 1));
        // First week the owner has the hours free (counting what this proposal already books).
        let due = goalDue ?? shiftDateKey(localDateKey(now(), user.timezone), 7);
        if (owner) {
          const avail = s.availability?.find((a) => a.userId === owner.id);
          const weekendOnly = avail ? !["mon", "tue", "wed", "thu", "fri"].some((d) => avail.windows[d as "mon"]) : false;
          for (const w of plan.weeks) {
            const cell = plan.cells.find((c) => c.personId === owner.id && c.week === w.key);
            const k = `${owner.id}:${w.key}`;
            const candidate = shiftDateKey(w.start, weekendOnly ? 6 : 4);
            if (candidate >= prevDue && (cell?.free ?? 0) - (booked.get(k) ?? 0) >= hours) {
              booked.set(k, (booked.get(k) ?? 0) + hours);
              due = candidate;
              break;
            }
          }
        }
        prevDue = due > prevDue ? due : prevDue;
        return { title: String(t.title).slice(0, 140), ownerId: owner?.id ?? null, ownerName: owner?.name ?? "Unassigned", hours, due };
      });
      const action = draft(s, messageId, { kind: "tasks", tasks });
      return { summary: `${tasks.length} draft tasks · ${tasks.map((t) => `${t.ownerName.split(" ")[0]} ${t.hours} h ${t.due}`).join(" · ")}`, data: { actionId: action.id, tasks } };
    },
    async propose_decision(s, _u, args, messageId) {
      const decision = { title: String(args.title ?? "Proposed decision"), reason: String(args.reason ?? ""), expectedImpact: String(args.expectedImpact ?? ""), reviewDate: String(args.reviewDate ?? shiftDateKey(iso().slice(0, 10), 30)), owner: String(args.owner ?? "founders") };
      const action = draft(s, messageId, { kind: "decision", decision });
      return { summary: `Draft decision · ${decision.title}`, data: { actionId: action.id, title: decision.title } };
    },
    async draft_document(s, _u, args, messageId) {
      const document = { kind: String(args.kind ?? "document"), title: String(args.title ?? "Draft"), content: String(args.content ?? "") };
      const action = draft(s, messageId, { kind: "document", document });
      return { summary: `Draft ${document.kind.replace("_", " ")} · ${document.title}`, data: { actionId: action.id, title: document.title } };
    },
  };

  /** "31 Oct" → the next 31 Oct (YYYY-MM-DD). */
  function parseDue(text: string): string | null {
    const m = text.match(/(\d{1,2})\s+([A-Za-z]{3})/);
    if (!m) return null;
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].toLowerCase());
    if (month < 0) return null;
    const year = new Date(now()).getUTCFullYear();
    const d = new Date(Date.UTC(year, month, Number(m[1])));
    if (d.getTime() < now() - DAY) d.setUTCFullYear(year + 1);
    return d.toISOString().slice(0, 10);
  }

  function draft(s: S, messageId: string, a: Pick<ProposedAction, "kind" | "tasks" | "decision" | "document">) {
    const action: ProposedAction = { id: uid("aa"), messageId, status: "draft", acceptedBy: null, acceptedAt: null, createdIds: [], ...a };
    s.advisorActions.push(action);
    return action;
  }

  const runnerFor = (s: S, user: User, messageId: string, calls: ToolCall[]): ToolRun => async (name, args = {}) => {
    const off = s.advisorSettings.disabledTools[user.id] ?? [];
    let call: ToolCall;
    if (!TOOL_ACCESS[name].includes(user.role) || off.includes(name)) {
      call = { name, args, ok: false, summary: NOT_FOR_ROLE, error: `403 · ${off.includes(name) ? "switched off for you by an admin" : "not available for your role"}` };
    } else {
      try {
        const exec = () => tools[name](s, user, args, messageId);
        const r = DRAFT_TOOLS.includes(name) ? await exec() : await readOnly(s, exec);
        call = { name, args, ok: true, summary: r.summary, data: r.data, sources: r.sources };
      } catch (e) {
        const err = e as Error & { status?: number };
        call = { name, args, ok: false, summary: err.status === 403 ? NOT_FOR_ROLE : err.message, error: err.status === 403 ? "403 · not available for your role" : err.message };
      }
    }
    calls.push(call);
    return call;
  };

  // ---------------------------------------------------------------- threads and answers

  const visibleThread = (u: User, t: AdvisorThread) => t.userId === u.id || (t.userId === null && u.role === "admin");
  const metaOf = (t: AdvisorThread) => {
    const d = new Date(t.updatedAt);
    const today = localDateKey(now(), "UTC");
    const day = localDateKey(d, "UTC");
    const when = day === today ? "TODAY" : day === shiftDateKey(today, -1) ? "YESTERDAY" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d).toUpperCase();
    if (t.kind === "briefing") return "AUTO · MON 07:00";
    if (t.kind === "month_end") return "AUTO · MONTH-END";
    if (t.kind === "alert") return `ALERT · ${when}`;
    return `${t.topic.toUpperCase()} · ${when}`;
  };
  const TOPIC: Record<string, string> = { price: "PRICING", hire: "BOARD MEMO", cash: "FINANCE", break_even: "FINANCE", roi: "FINANCE", mrr_track: "FINANCE", margin: "FINANCE", lead_source: "SALES", churn: "CLIENTS", capacity: "CAPACITY", plan: "PLAN", country_rules: "RISK", ai_calling: "RISK", bdr_focus: "PEOPLE", draft: "DOCUMENT", commission: "PEOPLE", build_buy: "ENGINEERING", decisions: "DECISIONS", competitors: "MARKET", general: "QUESTION" };

  /** Run the provider for one question and store both messages. */
  const answerIn = async (s: S, user: User, thread: AdvisorThread, text: string, roleHint: AdvisorRole | null, mode: "question" | "briefing" | "month_end" | "alert", alert?: { kind: string; detail: string }) => {
    const userMsg: AdvisorMessage = { id: uid("am"), threadId: thread.id, role: "user", userId: mode === "question" ? user.id : null, content: text, roleHint, answer: null, toolCalls: [], sources: [], actionIds: [], model: null, costMinor: 0, knowledgeVersion: null, createdAt: iso() };
    s.advisorMessages.push(userMsg);
    const id = uid("am");
    const calls: ToolCall[] = [];
    const memory = s.advisorMemory.filter((f) => f.status === "approved").map((f) => f.fact);
    const r = await provider.answer({ mode, question: text, roleHint, user: { id: user.id, name: user.name, role: user.role }, memory, now: now(), alert }, runnerFor(s, user, id, calls));
    const answer = { ...r.answer, unsourced: unsourcedFigures(r.answer, calls, text) };
    const msg: AdvisorMessage = {
      id, threadId: thread.id, role: "assistant", userId: null, content: answer.short, roleHint, answer, toolCalls: calls,
      sources: [...new Set(calls.flatMap((c) => c.sources ?? []))], actionIds: s.advisorActions.filter((a) => a.messageId === id).map((a) => a.id),
      model: (r.kind === "memo" ? "claude-opus-5-5" : "claude-sonnet-5-5") + (provider.name === "fake-advisor" ? " (fake provider)" : ""),
      costMinor: answerCostMinor(r.kind, r.tokens), knowledgeVersion: version, createdAt: iso(),
    };
    s.advisorMessages.push(msg);
    thread.updatedAt = iso();
    audit(user.id, `advisor.${mode}`, "advisor_thread", thread.id, null, { tools: calls.map((c) => `${c.name}:${c.ok ? "ok" : "refused"}`), costMinor: msg.costMinor, unsourced: answer.unsourced.length });
    return msg;
  };

  const newThread = (s: S, userId: string | null, title: string, kind: AdvisorThread["kind"], topic: string, key: string | null = null) => {
    const t: AdvisorThread = { id: uid("at"), userId, title: title.length > 70 ? `${title.slice(0, 67)}…` : title, kind, topic, key, createdAt: iso(), updatedAt: iso() };
    s.advisorThreads.push(t);
    return t;
  };

  // ---------------------------------------------------------------- jobs

  const runJobs = async (s: S, admin: User) => {
    const run = { briefings: 0, closes: 0, alerts: 0 };
    const admins = users.filter((u) => u.role === "admin" && u.active);
    const once = async (key: string, title: string, kind: AdvisorThread["kind"], text: string, mode: "briefing" | "month_end" | "alert", alert?: { kind: string; detail: string }) => {
      if (s.advisorJobKeys.includes(key)) return false;
      s.advisorJobKeys.push(key);
      const t = newThread(s, null, title, kind, kind, key);
      await answerIn(s, admin, t, text, null, mode, alert);
      for (const a of admins) notify({ userId: a.id, type: kind === "alert" ? "client_health" : "briefing", text: title, href: `/advisor/${t.id}` });
      return true;
    };
    // Monday briefing, Mon 07:00 CET.
    const week = isoWeekKey(localDateKey(now(), CET));
    const mondayAt = zonedToUtc(isoWeekRange(week).start, "07:00", CET);
    if (now() >= mondayAt && (await once(`briefing:${week}`, `Monday briefing · W${Number(week.slice(6))}`, "briefing", `Monday briefing ${week}`, "briefing"))) run.briefings++;
    // Month-end close on the 1st, for last month.
    const d = new Date(now());
    const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
    const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${prev}-01T00:00:00Z`));
    if (await once(`close:${prev}`, `Month-end close · ${label}`, "month_end", `Month-end close ${prev}`, "month_end")) run.closes++;
    // Alerts.
    const f = financeData(s);
    const alerts: { key: string; kind: string; detail: string }[] = [];
    const lastCash = [...s.cashSnapshots].sort((a, b) => a.date.localeCompare(b.date)).pop();
    if (lastCash && lastCash.balanceMinor / 100 < f.reserveEur) alerts.push({ key: `alert:cash:${lastCash.id}`, kind: "cash", detail: `Cash €${Math.round(lastCash.balanceMinor / 100)} is below the €${f.reserveEur} reserve (${lastCash.date})` });
    if (monthSpendMinor(s) >= s.advisorSettings.monthlyCapMinor) alerts.push({ key: `alert:cap:${iso().slice(0, 7)}`, kind: "cap", detail: `AI spending cap reached: €${s.advisorSettings.monthlyCapMinor / 100} this month` });
    try {
      const r = await ctx.api().report({ kind: "month", personId: "team" });
      for (const g of r.gates.filter((x) => x.met)) alerts.push({ key: `alert:gate:${g.key}`, kind: "gate", detail: `${g.label} passed: ${g.value}` });
      const o = await ctx.api().clientsOverview();
      for (const c of o.cards.filter((x) => x.status === "live")) {
        const detail = await ctx.api().getClient(c.id);
        if (detail.health?.risk === "high") alerts.push({ key: `alert:churn:${c.id}:${iso().slice(0, 7)}`, kind: "churn", detail: `${c.companyName} at churn risk: health ${detail.health.score} · ${detail.health.reason}` });
      }
    } catch {
      // reports unavailable: skip those alerts this run
    }
    const late = s.tasks.filter((t) => !t.deletedAt && !t.parentId && !["done", "cancelled"].includes(t.status) && t.dueAt && now() - new Date(t.dueAt).getTime() > 7 * DAY);
    if (late.length) alerts.push({ key: `alert:slip:${week}`, kind: "slip", detail: `${late.length} task${late.length > 1 ? "s" : ""} more than a week late: ${late.slice(0, 3).map((t) => t.title).join(", ")}` });
    for (const a of alerts) if (await once(a.key, a.detail, "alert", a.detail, "alert", { kind: a.kind, detail: a.detail })) run.alerts++;
    return run;
  };

  // ---------------------------------------------------------------- API

  const api: AdvisorApi = {
    async advisorHome() {
      const user = await viewer();
      const s = await load();
      requireUse(s, user);
      // Newest first; same timestamp → the later-created thread first.
      const threads: ThreadListItem[] = s.advisorThreads
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => visibleThread(user, t))
        .sort((a, b) => b.t.updatedAt.localeCompare(a.t.updatedAt) || b.i - a.i)
        .map(({ t }) => ({ id: t.id, title: t.title, meta: metaOf(t), kind: t.kind, updatedAt: t.updatedAt, mine: t.userId === user.id }));
      const spend = monthSpendMinor(s);
      return {
        threads, knowledgeVersion: version, spendMinor: spend, capMinor: s.advisorSettings.monthlyCapMinor, blocked: spend >= s.advisorSettings.monthlyCapMinor,
        memory: user.role === "admin" ? s.advisorMemory.filter((m) => m.status !== "rejected") : s.advisorMemory.filter((m) => m.status === "approved"),
        can: { admin: user.role === "admin", roles: [...ADVISOR_ROLES] },
      };
    },

    async getAdvisorThread(id) {
      const user = await viewer();
      const s = await load();
      requireUse(s, user);
      const thread = s.advisorThreads.find((t) => t.id === id);
      if (!thread || !visibleThread(user, thread)) throw new AccessError(404);
      const messages = s.advisorMessages.filter((m) => m.threadId === id);
      return { thread, messages, actions: s.advisorActions.filter((a) => messages.some((m) => m.id === a.messageId)) };
    },

    async askAdvisor({ threadId, text, roleHint = null }) {
      const user = await viewer();
      const s = await load();
      requireUse(s, user);
      const q = text.trim();
      if (!q) throw new Error("Ask a question.");
      if (q.length > 4000) throw new Error("Keep questions under 4,000 characters.");
      if (monthSpendMinor(s) >= s.advisorSettings.monthlyCapMinor) throw new Error(`The monthly AI cap (€${s.advisorSettings.monthlyCapMinor / 100}) is reached. Questions start again next month, or an admin raises the cap.`);
      let thread = threadId ? s.advisorThreads.find((t) => t.id === threadId) : undefined;
      if (threadId && (!thread || !visibleThread(user, thread))) throw new AccessError(404);
      thread ??= newThread(s, user.id, q.replace(/\s+/g, " "), "question", TOPIC[classify(q)] ?? "QUESTION");
      const message = await answerIn(s, user, thread, q, roleHint, "question");
      await save();
      return { threadId: thread.id, message };
    },

    async acceptAdvisorAction(actionId) {
      const user = await viewer();
      const s = await load();
      requireUse(s, user);
      const a = s.advisorActions.find((x) => x.id === actionId);
      if (!a) throw new AccessError(404);
      const msg = s.advisorMessages.find((m) => m.id === a.messageId);
      const thread = s.advisorThreads.find((t) => t.id === msg?.threadId);
      if (!thread || !visibleThread(user, thread)) throw new AccessError(404);
      if (a.status !== "draft") throw new Error(`Already ${a.status}.`);
      if (a.kind === "decision" && user.role !== "admin") throw new AccessError(403, "Founders log decisions.");
      if (a.kind === "tasks") {
        for (const t of a.tasks ?? []) {
          if (user.role !== "admin" && t.ownerId && t.ownerId !== user.id) throw new AccessError(403, "You can accept tasks for yourself only.");
          a.createdIds.push(ctx.createTask(s, user, t).id);
        }
      } else if (a.kind === "decision" && a.decision) {
        const d: Decision = { id: uid("dc"), ...a.decision, date: iso().slice(0, 10), status: "proposed", links: [`/advisor/${thread.id}`], source: "advisor", createdBy: user.id };
        s.decisions.push(d);
        a.createdIds.push(d.id);
      } else if (a.kind === "document" && a.document) {
        const doc: AdvisorDocument = { id: uid("ad"), ...a.document, acceptedBy: user.id, acceptedAt: iso(), messageId: a.messageId };
        s.advisorDocs.push(doc);
        a.createdIds.push(doc.id);
      }
      Object.assign(a, { status: "accepted", acceptedBy: user.id, acceptedAt: iso() });
      audit(user.id, "advisor.accept", "advisor_action", a.id, null, { kind: a.kind, created: a.createdIds });
      await save();
      return { createdIds: a.createdIds };
    },

    async dismissAdvisorAction(actionId) {
      const user = await viewer();
      const s = await load();
      const a = s.advisorActions.find((x) => x.id === actionId);
      const thread = s.advisorThreads.find((t) => t.id === s.advisorMessages.find((m) => m.id === a?.messageId)?.threadId);
      if (!a || !thread || !visibleThread(user, thread)) throw new AccessError(404);
      if (a.status === "draft") a.status = "dismissed";
      await save();
    },

    async logMemoAsDecision(messageId) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const msg = s.advisorMessages.find((m) => m.id === messageId);
      const thread = s.advisorThreads.find((t) => t.id === msg?.threadId);
      if (!msg?.answer || !thread || !visibleThread(user, thread)) throw new AccessError(404);
      const pick = msg.answer.options?.find((o) => o.pick === "YES");
      const d: Decision = {
        id: uid("dc"), title: pick ? `${thread.title} → ${pick.name.replace(/^[A-Z] · /, "")}` : thread.title, date: iso().slice(0, 10), owner: user.name, status: "proposed",
        reason: msg.answer.short, expectedImpact: (msg.answer.measure ?? []).join("; "), reviewDate: shiftDateKey(iso().slice(0, 10), 30), links: [`/advisor/${thread.id}`], source: "advisor", createdBy: user.id,
      };
      s.decisions.push(d);
      audit(user.id, "advisor.log_decision", "decision", d.id, null, { messageId });
      await save();
      return d;
    },

    async rememberFromMessage(messageId, fact) {
      const user = await viewer();
      const s = await load();
      requireUse(s, user);
      const msg = s.advisorMessages.find((m) => m.id === messageId);
      const thread = s.advisorThreads.find((t) => t.id === msg?.threadId);
      if (!msg || !thread || !visibleThread(user, thread)) throw new AccessError(404);
      if (!fact.trim()) throw new Error("Write the fact to remember.");
      const f: MemoryFact = { id: uid("mf"), fact: fact.trim().slice(0, 300), status: "draft", proposedBy: user.id, approvedBy: null, sourceMessageId: messageId, createdAt: iso() };
      s.advisorMemory.push(f);
      for (const a of users.filter((u) => u.role === "admin" && u.active && u.id !== user.id)) notify({ userId: a.id, type: "briefing", text: `Approve a fact for the AI co-founder: "${f.fact.slice(0, 80)}"`, href: "/advisor?memory=1" });
      await save();
      return f;
    },

    async reviewMemory(id, approve) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const f = s.advisorMemory.find((x) => x.id === id);
      if (!f) throw new AccessError(404);
      Object.assign(f, { status: approve ? "approved" : "rejected", approvedBy: approve ? user.id : null });
      audit(user.id, approve ? "advisor.memory_approve" : "advisor.memory_reject", "advisor_memory", id, null, { fact: f.fact });
      await save();
    },

    async searchKnowledge(q) {
      const user = await viewer();
      const s = await load();
      requireUse(s, user);
      return indexFor(user).search(q, { limit: 8 }).map(({ path, heading, text }) => ({ path, heading, text }));
    },

    async listDecisions(status) {
      const user = await viewer();
      const s = await load();
      requireUse(s, user);
      return s.decisions.filter((d) => !status || d.status.startsWith(status));
    },

    async logSpendDecision(input) {
      const user = await viewer();
      requireAdmin(user);
      if (!input.title.trim()) throw new Error("Name the spend.");
      if (!input.stopRule.trim()) throw new Error("Every spend needs a stop rule.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reviewDate)) throw new Error("Pick a review date.");
      if (!(input.monthlyCostEur >= 0) || !(input.oneOffCostEur >= 0) || input.monthlyCostEur + input.oneOffCostEur <= 0) throw new Error("Enter what it costs.");
      const s = await load();
      const cost = [input.monthlyCostEur ? `€${Math.round(input.monthlyCostEur).toLocaleString("en-US")}/month` : "", input.oneOffCostEur ? `€${Math.round(input.oneOffCostEur).toLocaleString("en-US")} once` : ""].filter(Boolean).join(" + ");
      const d: Decision = {
        id: uid("dc"),
        title: `Spend: ${input.title.trim()}`,
        date: iso().slice(0, 10),
        owner: user.name,
        status: "proposed",
        reason: `Cost ${cost}. ${input.verdict} Stop rule: ${input.stopRule.trim()}`,
        expectedImpact: input.expectedGain.trim(),
        reviewDate: input.reviewDate,
        links: ["/roi"],
        source: "spend",
        createdBy: user.id,
      };
      s.decisions.push(d);
      audit(user.id, "spend.log", "decision", d.id, null, { title: d.title, cost });
      for (const a of users.filter((u) => u.role === "admin" && u.active && u.id !== user.id)) notify({ userId: a.id, type: "briefing", text: `${user.name} proposed a spend: ${input.title.trim()} (${cost})`, href: "/roi" });
      await save();
      return d;
    },

    async runAdvisorJobs() {
      const user = await viewer();
      const s = await load();
      if (user.role !== "admin") return { briefings: 0, closes: 0, alerts: 0 };
      const r = await runJobs(s, user);
      if (r.briefings || r.closes || r.alerts) await save();
      return r;
    },

    async advisorSettings() {
      const user = await viewer();
      requireAdmin(user);
      return (await load()).advisorSettings;
    },

    async setAdvisorSettings(patch) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      const before = structuredClone(s.advisorSettings);
      if (patch.monthlyCapMinor !== undefined && !(patch.monthlyCapMinor >= 0)) throw new Error("The cap is a positive amount.");
      Object.assign(s.advisorSettings, patch);
      audit(user.id, "advisor.settings", "settings", "advisor", before, s.advisorSettings);
      await save();
    },

    async listFinanceData() {
      const user = await viewer();
      if (user.role !== "viewer") requireAdmin(user); // the accountant reads; only founders write
      const s = await load();
      return { expenses: [...s.expenses].sort((a, b) => b.date.localeCompare(a.date)), cash: [...s.cashSnapshots].sort((a, b) => b.date.localeCompare(a.date)) };
    },

    async addExpense(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      if (!input.vendor.trim() || !(input.amountMinor > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Date, vendor and a positive amount are needed.");
      const e: Expense = { id: uid("ex"), source: "manual", ...input, vendor: input.vendor.trim() };
      s.expenses.push(e);
      audit(user.id, "expense.add", "expense", e.id, null, e);
      await save();
    },

    async addCashSnapshot(input) {
      const user = await viewer();
      requireAdmin(user);
      const s = await load();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(input.balanceMinor)) throw new Error("A date and a balance are needed.");
      const c: CashSnapshot = { id: uid("cs"), date: input.date, balanceMinor: Math.round(input.balanceMinor), currency: "EUR", source: "manual", createdBy: user.id };
      s.cashSnapshots.push(c);
      audit(user.id, "cash.snapshot", "cash_snapshot", c.id, null, c);
      await save();
    },
  };

  /** Seed: the context/07 decision log, September tool costs and pay, a cash snapshot, and the reserve as an approved fact. */
  const seedAdvisor = (s: S) => {
    if (s.decisions.length || s.expenses.length) return;
    const log = docs.find((d) => d.path.startsWith("context/07_"));
    for (const d of log ? parseDecisionLog(log.content) : []) s.decisions.push({ id: uid("dc"), ...d, links: ["context/07_ROADMAP_DECISIONS_AND_OPEN_QUESTIONS.md"], source: "context/07", createdBy: null });
    const E = (date: string, vendor: string, category: Expense["category"], amount: number, currency: "USD" | "EUR", recurring = true, note: string | null = null) =>
      s.expenses.push({ id: uid("ex"), date, vendor, category, amountMinor: Math.round(amount * 100), currency, recurring, source: "bank_export", note });
    for (const m of ["2026-09"]) {
      E(`${m}-01`, "Google Workspace (3 seats)", "tools", 25, "EUR");
      E(`${m}-02`, "Supabase", "tools", 25, "USD");
      E(`${m}-03`, "US number + dialer", "tools", 30, "USD");
      E(`${m}-05`, "Lead data", "data", 45, "USD");
      E(`${m}-05`, "Gllarix demo line (usage)", "usage", 40, "USD");
      E(`${m}-10`, "Call recorder", "tools", 15, "USD");
      E(`${m}-28`, "Diego Marín · BDR base", "people", 500, "USD", true, "Contractor, paid by the 5th");
      E(`${m}-28`, "Wise fees (Venezuela)", "fees", 12, "EUR");
      E(`${m}-14`, "3D freelancer · Prishtina Tower", "freelance", 975, "EUR", false, "30% of the fixed price");
    }
    s.cashSnapshots.push({ id: uid("cs"), date: "2026-09-30", balanceMinor: 342_000, currency: "EUR", source: "bank_export", createdBy: null });
    s.advisorMemory.push({ id: uid("mf"), fact: "Cash reserve target €3,000 (backbone/03 cash reserve rule)", status: "approved", proposedBy: "u-rinor", approvedBy: "u-cofounder", sourceMessageId: null, createdAt: "2026-09-28T10:00:00.000Z" });
  };

  return { api, seedAdvisor, runJobs, version };
};

export type { AdvisorRole };
