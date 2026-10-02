import { WEEKDAYS } from "@/config/capacity";
import { USD_PER_EUR } from "@/config/targets";
import {
  CATEGORY_COLOR,
  CELL_STEP_HOURS,
  COST_RATE_SEED,
  defaultHourlyRateMinor,
  PER_HOUR_TARGET_MINOR,
  SPLIT_CATEGORIES,
  SPLIT_LABEL,
  WEEKEND_TARGET_HOURS,
} from "@/config/time";
import { windowHours } from "@/services/scheduler";
import { isoWeekKey, isoWeekRange, localDateKey, shiftDateKey, zonedToUtc } from "@/services/time";
import type { Availability } from "../capacityTypes";
import type { Client, Payment } from "../quoteTypes";
import type { Company, Lead } from "../leadTypes";
import type { Deal } from "../salesTypes";
import type { RunningTimer, Task, TaskList, Space, TimeEntry } from "../taskTypes";
import type { CostRate, GridRow, MyWeek, ReportGroup, TimeApi, TimeInvoiceItem, TimeLink, TimeProject, Timesheet, TimeReport, TimeReportRow } from "../timeTypes";
import { AccessError, type Notification, type User } from "../types";

const DAY = 86_400_000;

export interface TimeStore {
  tasks: Task[];
  taskLists: TaskList[];
  spaces: Space[];
  timeEntries: TimeEntry[];
  timers: RunningTimer[];
  availability: Availability[];
  clients: Client[];
  deals: Deal[];
  leads: Lead[];
  companies: Company[];
  payments: Payment[];
  timeProjects: TimeProject[];
  timesheets: Timesheet[];
  costRates: CostRate[];
  timeInvoiceItems: TimeInvoiceItem[];
}

export const emptyTimeState = () => ({
  timeProjects: [] as TimeProject[],
  timesheets: [] as Timesheet[],
  costRates: [] as CostRate[],
  timeInvoiceItems: [] as TimeInvoiceItem[],
});

interface Ctx<S extends TimeStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  notify: (n: Omit<Notification, "id" | "createdAt" | "readAt">) => void;
  logTask: (s: S, taskId: string, userId: string, text: string) => void;
  companyOfClient: (s: S, clientId: string) => string;
}

const round2 = (h: number) => Math.round(h * 100) / 100;
const toHours = (minutes: number) => round2(minutes / 60);
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const createDemoTime = <S extends TimeStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, notify } = ctx;
  const iso = (t = now()) => new Date(t).toISOString();
  const userOf = (id: string) => users.find((u) => u.id === id);
  const tzOf = (id: string) => userOf(id)?.timezone ?? "UTC";
  const dateOf = (e: { startedAt: string; userId: string }) => localDateKey(new Date(e.startedAt), tzOf(e.userId));
  const weekOfEntry = (e: { startedAt: string; userId: string }) => isoWeekKey(dateOf(e));
  const weekDays = (week: string) => Array.from({ length: 7 }, (_, i) => shiftDateKey(isoWeekRange(week).start, i));

  // ---------------------------------------------------------------- timesheets and locks

  const sheet = (s: S, userId: string, week: string): Timesheet => {
    let t = s.timesheets.find((x) => x.userId === userId && x.week === week);
    if (!t) {
      t = { id: uid("ts"), userId, week, status: "draft", submittedAt: null, approvedBy: null, approvedAt: null, comment: null };
      s.timesheets.push(t);
    }
    return t;
  };
  const isLocked = (s: S, userId: string, startedAt: string) => {
    const w = isoWeekKey(localDateKey(new Date(startedAt), tzOf(userId)));
    const t = s.timesheets.find((x) => x.userId === userId && x.week === w);
    return !!t && t.status !== "draft";
  };
  const requireOpen = (s: S, userId: string, week: string) => {
    const t = s.timesheets.find((x) => x.userId === userId && x.week === week);
    if (t && t.status !== "draft") throw new Error(`This week is ${t.status}. ${t.status === "approved" ? "An admin" : "An admin"} has to reopen it before it can change.`);
  };
  const targetUser = (viewerUser: User, userId?: string) => {
    if (!userId || userId === viewerUser.id) return viewerUser;
    if (viewerUser.role !== "admin") throw new AccessError(403, "People enter their own time.");
    const u = userOf(userId);
    if (!u) throw new AccessError(404);
    return u;
  };

  // ---------------------------------------------------------------- rows

  const linkOf = (_s: S, e: TimeEntry): TimeLink | null => (e.taskId ? { type: "task", id: e.taskId } : (e.linked ?? null));
  const categoryOf = (s: S, e: TimeEntry) => e.category ?? (e.taskId ? s.tasks.find((t) => t.id === e.taskId)?.category : null) ?? "Operations";
  const rowKeyOf = (link: TimeLink | null, category: string, billable: boolean) => `${link ? `${link.type}:${link.id}` : "none"}|${category}|${billable ? 1 : 0}`;
  const parseRowKey = (key: string) => {
    const [l, category, b] = key.split("|");
    const link = l === "none" ? null : ({ type: l.split(":")[0], id: l.split(":").slice(1).join(":") } as TimeLink);
    return { link, category, billable: b === "1" };
  };
  const describe = (s: S, link: TimeLink | null): { label: string; sub: string } => {
    if (!link) return { label: "Other", sub: "Not linked" };
    if (link.type === "task") {
      const t = s.tasks.find((x) => x.id === link.id);
      const list = s.taskLists.find((l) => l.id === t?.listId);
      const space = s.spaces.find((x) => x.id === list?.spaceId);
      return { label: t?.title ?? "Deleted task", sub: `${space?.name ?? "—"} / ${list?.name ?? "—"}` };
    }
    if (link.type === "project") {
      const p = s.timeProjects.find((x) => x.id === link.id);
      return { label: p?.name ?? "Project", sub: p?.sub ?? "" };
    }
    if (link.type === "client") return { label: ctx.companyOfClient(s, link.id), sub: "Client" };
    const leadId = link.type === "deal" ? s.deals.find((d) => d.id === link.id)?.leadId : link.id;
    const lead = s.leads.find((l) => l.id === leadId);
    return { label: s.companies.find((c) => c.id === lead?.companyId)?.name ?? "—", sub: link.type === "deal" ? "Deal · pre-sale" : "Lead · pre-sale" };
  };

  /** The client a billable entry is billed to (direct, via a project, or via a task's link). */
  const clientOf = (s: S, e: TimeEntry): string | null => {
    const link = linkOf(s, e);
    if (!link) return null;
    if (link.type === "client") return link.id;
    if (link.type === "project") return s.timeProjects.find((p) => p.id === link.id)?.clientId ?? null;
    if (link.type === "task") {
      const t = s.tasks.find((x) => x.id === link.id);
      if (t?.linked?.type === "client") return t.linked.id;
      if (t?.linked?.type === "deal") return s.clients.find((c) => c.dealId === t.linked!.id)?.id ?? null;
    }
    if (link.type === "deal") return s.clients.find((c) => c.dealId === link.id)?.id ?? null;
    return null;
  };
  const rateFor = (s: S, clientId: string | null) => {
    const deal = s.deals.find((d) => d.id === s.clients.find((c) => c.id === clientId)?.dealId);
    const market = deal?.market ?? "us";
    return { rateMinor: defaultHourlyRateMinor(market), currency: (deal?.currency ?? "USD") as "USD" | "EUR" };
  };

  const buildWeek = (s: S, user: User, week: string, viewerUser: User): MyWeek => {
    const days = weekDays(week);
    const entries = s.timeEntries.filter((e) => e.userId === user.id && weekOfEntry(e) === week);
    const rows = new Map<string, GridRow & { minutes: number[] }>();
    for (const e of entries) {
      const link = linkOf(s, e);
      const category = categoryOf(s, e);
      const key = rowKeyOf(link, category, !!e.billable);
      if (!rows.has(key)) {
        const d = describe(s, link);
        rows.set(key, { key, label: d.label, sub: d.sub, category, billable: !!e.billable, rateMinor: e.rateMinor ?? null, currency: e.currency ?? null, link, cells: [], total: 0, minutes: [0, 0, 0, 0, 0, 0, 0] });
      }
      const r = rows.get(key)!;
      const i = days.indexOf(dateOf(e));
      if (i >= 0) r.minutes[i] += e.minutes;
    }
    // Totals add up exactly: everything is summed in minutes and shown as hours.
    const out = [...rows.values()].map(({ minutes, ...r }) => ({ ...r, cells: minutes.map(toHours), total: toHours(minutes.reduce((a, b) => a + b, 0)) }));
    out.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
    const dayMinutes = days.map((_, i) => [...rows.values()].reduce((n, r) => n + r.minutes[i], 0));
    const a = s.availability.find((x) => x.userId === user.id);
    const capacity = a ? WEEKDAYS.reduce((n, d) => n + windowHours(a.windows[d]), 0) : null;
    const catMinutes = (cats: string[]) => entries.filter((e) => cats.includes(categoryOf(s, e))).reduce((n, e) => n + e.minutes, 0);
    const split = a
      ? Object.entries(a.split)
          .filter(([k]) => SPLIT_CATEGORIES[k])
          .map(([k, share]) => ({ key: k, label: SPLIT_LABEL[k] ?? k, hours: toHours(catMinutes(SPLIT_CATEGORIES[k])), target: Math.round((capacity ?? 0) * share * 10) / 10 }))
      : [];
    const done = s.tasks.filter((t) => t.assigneeIds.includes(user.id) && t.status === "done" && t.estimateMinutes);
    const actual = done.map((t) => s.timeEntries.filter((e) => e.taskId === t.id && e.userId === user.id).reduce((n, e) => n + e.minutes, 0));
    const withTime = done.filter((_, i) => actual[i] > 0);
    const est = withTime.reduce((n, t) => n + t.estimateMinutes!, 0);
    const act = actual.filter((x) => x > 0).reduce((n, x) => n + x, 0);
    const running = s.timers.find((t) => t.userId === user.id);
    const timer = running ? { ...describe(s, running.taskId ? { type: "task", id: running.taskId } : (running.linked ?? null)), startedAt: running.startedAt, link: running.linked ?? null, taskId: running.taskId } : null;
    const ts = s.timesheets.find((x) => x.userId === user.id && x.week === week) ?? { id: "", userId: user.id, week, status: "draft" as const, submittedAt: null, approvedBy: null, approvedAt: null, comment: null };
    const { start, end } = isoWeekRange(week);
    const f = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
    return {
      userId: user.id, name: user.name, week, weekLabel: `Week ${Number(week.slice(6))} · ${f(start)} – ${f(end)}`,
      days: days.map((d) => ({ date: d, label: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)).toUpperCase() })),
      rows: out, dayTotals: dayMinutes.map(toHours), total: toHours(dayMinutes.reduce((x, y) => x + y, 0)), capacityHours: capacity, split,
      estimates: { tasks: withTime.length, estimatedHours: toHours(est), actualHours: toHours(act), ratio: est ? Math.round((act / est) * 100) / 100 : null },
      timesheet: ts, timer: timer ? { label: timer.label, sub: timer.sub, startedAt: timer.startedAt, link: timer.link, taskId: timer.taskId } : null,
      canEdit: ts.status === "draft", people: viewerUser.role === "admin" ? users.filter((u) => u.active && u.role !== "viewer").map((u) => ({ id: u.id, name: u.name })) : null,
    };
  };

  const addEntry = (s: S, user: User, input: { date: string; minutes: number; link: TimeLink | null; category: string; billable: boolean; note?: string | null }) => {
    if (!(input.minutes > 0) || input.minutes > 24 * 60) throw new Error("Enter between a quarter of an hour and 24 hours.");
    const startedAt = new Date(zonedToUtc(input.date, "09:00", user.timezone)).toISOString();
    requireOpen(s, user.id, isoWeekKey(input.date));
    const taskId = input.link?.type === "task" ? input.link.id : null;
    const entry: TimeEntry = {
      id: uid("te"), taskId, userId: user.id, startedAt, minutes: Math.round(input.minutes), source: "manual", note: input.note?.trim() || null,
      category: input.category, linked: taskId ? null : input.link, billable: input.billable,
    };
    if (input.billable) {
      const r = rateFor(s, clientOf(s, entry));
      Object.assign(entry, r);
    }
    s.timeEntries.push(entry);
    if (taskId) ctx.logTask(s, taskId, user.id, `Logged ${toHours(entry.minutes)}h`);
    return entry;
  };

  const stopTimer = (s: S, user: User, endAt?: string) => {
    const running = s.timers.find((t) => t.userId === user.id);
    if (!running) return null;
    const end = endAt ? Math.min(now(), new Date(endAt).getTime()) : now();
    const minutes = Math.max(1, Math.round((end - new Date(running.startedAt).getTime()) / 60_000));
    if (isLocked(s, user.id, running.startedAt)) throw new Error("That week is submitted. Ask an admin to reopen it before logging more time.");
    s.timers = s.timers.filter((t) => t !== running);
    const task = running.taskId ? s.tasks.find((t) => t.id === running.taskId) : undefined;
    const entry: TimeEntry = {
      id: uid("te"), taskId: running.taskId, userId: user.id, startedAt: running.startedAt, minutes, source: "timer", note: null, endedAt: iso(end),
      category: running.category ?? task?.category ?? "Operations", linked: running.linked ?? null, billable: false,
    };
    s.timeEntries.push(entry);
    if (running.taskId) ctx.logTask(s, running.taskId, user.id, `Timer: ${minutes} min`);
    return entry;
  };

  // ---------------------------------------------------------------- reports

  const monthEntries = (s: S, month: string) => s.timeEntries.filter((e) => dateOf(e).startsWith(month));
  const toEur = (minor: number, c: "USD" | "EUR") => (c === "USD" ? minor / USD_PER_EUR : minor);
  const fromEur = (eur: number, c: "USD" | "EUR") => (c === "USD" ? eur * USD_PER_EUR : eur);
  const costOf = (s: S, userId: string, minutes: number, currency: "USD" | "EUR") => {
    const r = s.costRates.filter((c) => c.userId === userId).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    return r ? fromEur(toEur((r.hourlyMinor * minutes) / 60, r.currency), currency) : 0;
  };

  type Bucket = { key: string; label: string; sub: string; type: string; kind: TimeProject["kind"] | "client" | "presale"; minutes: number; byUser: Map<string, number>; revenueMinor: number | null; currency: "USD" | "EUR" | null; brand: "gllarix" | "arcadian" | null; direct: number; entries: TimeEntry[] };

  const clientBuckets = (s: S, entries: TimeEntry[], month: string) => {
    const buckets = new Map<string, Bucket>();
    const add = (key: string, init: () => Omit<Bucket, "minutes" | "byUser" | "entries">, e: TimeEntry) => {
      if (!buckets.has(key)) buckets.set(key, { ...init(), minutes: 0, byUser: new Map(), entries: [] });
      const b = buckets.get(key)!;
      b.minutes += e.minutes;
      b.byUser.set(e.userId, (b.byUser.get(e.userId) ?? 0) + e.minutes);
      b.entries.push(e);
    };
    for (const e of entries) {
      const link = linkOf(s, e);
      const clientId = clientOf(s, e);
      if (link?.type === "project") {
        const p = s.timeProjects.find((x) => x.id === link.id);
        if (p) {
          add(`project:${p.id}`, () => ({ key: `project:${p.id}`, label: p.name, sub: p.sub, type: { arcadian: "Arcadian", gllarix: "Gllarix", presale: "Pre-sale", internal: "Internal" }[p.kind], kind: p.kind, revenueMinor: p.fixedPriceMinor, currency: p.currency, brand: p.kind === "arcadian" || p.kind === "gllarix" ? p.kind : null, direct: p.directCostMinor }), e);
          continue;
        }
      }
      if (clientId) {
        const client = s.clients.find((c) => c.id === clientId);
        const deal = s.deals.find((d) => d.id === client?.dealId);
        add(`client:${clientId}`, () => {
          // Recurring clients: their payments in the period.
          const paid = s.payments.filter((p) => p.clientId === clientId && p.status === "paid" && p.paidAt.startsWith(month));
          return { key: `client:${clientId}`, label: ctx.companyOfClient(s, clientId), sub: "Client · payments in the period", type: deal?.brand === "arcadian" ? "Arcadian" : "Gllarix", kind: "client", revenueMinor: paid.reduce((n, p) => n + p.amountMinor, 0), currency: deal?.currency ?? "USD", brand: deal?.brand ?? "gllarix", direct: 0 };
        }, e);
        continue;
      }
      if (link?.type === "lead" || link?.type === "deal") {
        const d = describe(s, link);
        add(`presale:${link.id}`, () => ({ key: `presale:${link.id}`, label: d.label, sub: "Proposal and meeting prep", type: "Pre-sale", kind: "presale", revenueMinor: null, currency: null, brand: null, direct: 0 }), e);
        continue;
      }
      const space = link?.type === "task" ? s.spaces.find((x) => x.id === s.taskLists.find((l) => l.id === s.tasks.find((t) => t.id === link.id)?.listId)?.spaceId)?.name : null;
      const key = `internal:${space ?? "other"}`;
      add(key, () => ({ key, label: space ? `${space} tasks` : "Other internal time", sub: "Internal", type: "Internal", kind: "internal", revenueMinor: null, currency: null, brand: null, direct: 0 }), e);
    }
    return [...buckets.values()];
  };

  const accuracyByCategory = (s: S) => {
    const map = new Map<string, { est: number; act: number; tasks: number }>();
    for (const t of s.tasks) {
      if (t.status !== "done" || !t.estimateMinutes || t.deletedAt) continue;
      const act = s.timeEntries.filter((e) => e.taskId === t.id).reduce((n, e) => n + e.minutes, 0);
      if (!act) continue;
      const k = t.category ?? "Other";
      const m = map.get(k) ?? { est: 0, act: 0, tasks: 0 };
      map.set(k, { est: m.est + t.estimateMinutes, act: m.act + act, tasks: m.tasks + 1 });
    }
    return map;
  };

  const report = (s: S, user: User, month: string, group: ReportGroup): TimeReport => {
    const money = user.role === "admin";
    const entries = monthEntries(s, month);
    const total = entries.reduce((n, e) => n + e.minutes, 0);
    const byPerson = users.filter((u) => entries.some((e) => e.userId === u.id)).map((u) => ({ userId: u.id, name: u.name, hours: toHours(entries.filter((e) => e.userId === u.id).reduce((n, e) => n + e.minutes, 0)) }));
    const buckets = clientBuckets(s, entries, month);
    const clientMinutes = buckets.filter((b) => b.kind === "arcadian" || b.kind === "gllarix" || b.kind === "client").reduce((n, b) => n + b.minutes, 0);
    const billable = entries.filter((e) => e.billable).reduce((n, e) => n + e.minutes, 0);
    const acc = accuracyByCategory(s);
    const allEst = [...acc.values()].reduce((n, x) => n + x.est, 0);
    const allAct = [...acc.values()].reduce((n, x) => n + x.act, 0);
    let rows: TimeReportRow[];
    if (group === "client") {
      rows = buckets.map((b) => {
        const hours = toHours(b.minutes);
        const perHour = b.revenueMinor !== null && b.minutes ? Math.round(b.revenueMinor / (b.minutes / 60)) : null;
        const cost = b.currency ? [...b.byUser.entries()].reduce((n, [u, m]) => n + costOf(s, u, m, b.currency!), 0) : 0;
        const target = b.brand ? PER_HOUR_TARGET_MINOR[b.brand] : null;
        const status: TimeReportRow["status"] = b.kind === "presale" ? "SALES" : b.kind === "internal" ? "INTERNAL" : perHour !== null && target !== null && toEur(perHour, b.currency!) >= toEur(target, b.brand === "gllarix" ? "USD" : "EUR") ? "HEALTHY" : "OK";
        return {
          key: b.key, label: b.label, sub: b.sub, type: b.type, hours,
          revenueMinor: money ? b.revenueMinor : null, perHourMinor: money ? perHour : null,
          marginMinor: money && b.revenueMinor !== null ? Math.round(b.revenueMinor - cost - b.direct) : null, currency: money ? b.currency : null, status,
        };
      });
      const order = { Arcadian: 0, Gllarix: 1, "Pre-sale": 2, Internal: 3 } as Record<string, number>;
      rows.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.hours - b.hours);
      rows.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || (a.type === "Internal" ? a.hours - b.hours : b.hours - a.hours));
    } else if (group === "person") {
      rows = byPerson.map((p) => {
        const mine = entries.filter((e) => e.userId === p.userId);
        const cost = costOf(s, p.userId, mine.reduce((n, e) => n + e.minutes, 0), "EUR");
        return { key: p.userId, label: p.name, sub: `${toHours(mine.filter((e) => e.billable).reduce((n, e) => n + e.minutes, 0))} h billable`, type: userOf(p.userId)?.role ?? "", hours: p.hours, revenueMinor: null, perHourMinor: null, marginMinor: money ? -Math.round(cost) : null, currency: money ? "EUR" : null, status: null };
      });
    } else {
      const cats = new Map<string, number>();
      for (const e of entries) cats.set(categoryOf(s, e), (cats.get(categoryOf(s, e)) ?? 0) + e.minutes);
      rows = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([c, m]) => ({ key: c, label: c, sub: CATEGORY_COLOR[c] ? "" : "", type: "Category", hours: toHours(m), revenueMinor: null, perHourMinor: null, marginMinor: null, currency: null, status: null }));
    }
    // Rinor's weekend hours: Saturday and Sunday entries in his timezone, per week of the month.
    const rinor = users.find((u) => u.id === "u-rinor");
    const weeks = [...new Set(Array.from({ length: 31 }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter((d) => !Number.isNaN(Date.parse(d)) && d.startsWith(month) && new Date(`${d}T00:00:00Z`).getUTCMonth() + 1 === Number(month.slice(5))).filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 6).map((d) => isoWeekKey(d)))];
    const weekend = rinor
      ? weeks.map((w) => {
          const [sat, sun] = [shiftDateKey(isoWeekRange(w).start, 5), shiftDateKey(isoWeekRange(w).start, 6)];
          const m = s.timeEntries.filter((e) => e.userId === rinor.id && [sat, sun].includes(localDateKey(new Date(e.startedAt), rinor.timezone))).reduce((n, e) => n + e.minutes, 0);
          return { week: w, label: `W${Number(w.slice(6))}`, hours: toHours(m) };
        })
      : [];
    const LABEL: Record<string, string> = { Delivery: "Client setup (delivery)", Sales: "Sales tasks" };
    const ORDER = ["Development", "Delivery", "Sales", "Research"];
    const accuracy = [...acc.entries()]
      .sort((a, b) => (ORDER.indexOf(a[0]) + 1 || 9) - (ORDER.indexOf(b[0]) + 1 || 9))
      .map(([k, v]) => ({ category: LABEL[k] ?? k, ratio: v.est ? Math.round((v.act / v.est) * 10) / 10 : null, tasks: v.tasks }));
    return {
      month, group, money, totalHours: toHours(total), rows, weekend, weekendTarget: WEEKEND_TARGET_HOURS, accuracy, byPerson,
      kpis: [
        { key: "hours", label: "HOURS LOGGED", value: String(toHours(total)), note: byPerson.map((p) => `${p.name.split(" ")[0]} ${p.hours}`).join(" · ") },
        { key: "client", label: "CLIENT WORK", value: `${toHours(clientMinutes)} h`, note: `${total ? Math.round((clientMinutes / total) * 100) : 0}% of all hours` },
        { key: "billable", label: "BILLABLE BY THE HOUR", value: `${toHours(billable)} h`, note: billable ? "custom software only" : "custom software only · none yet" },
        { key: "estimates", label: "ESTIMATES", value: allEst ? `${(allAct / allEst).toFixed(1)}×` : "—", note: "actual vs estimate, all tasks" },
      ],
    };
  };

  // ---------------------------------------------------------------- API

  const api: TimeApi = {
    async myWeek(q = {}) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const target = targetUser(user, q.userId);
      const s = await load();
      const week = q.week ?? isoWeekKey(localDateKey(now(), target.timezone));
      if (target.id !== user.id) audit(user.id, "time.view", "user", target.id, null, { week });
      return buildWeek(s, target, week, user);
    },

    async setTimeCell(q) {
      const user = await viewer();
      const target = targetUser(user, q.userId);
      const s = await load();
      requireOpen(s, target.id, q.week);
      if (!(q.hours >= 0) || q.hours > 24) throw new Error("Hours per day are 0–24.");
      const hours = Math.round(q.hours / CELL_STEP_HOURS) * CELL_STEP_HOURS;
      const { link, category, billable } = parseRowKey(q.rowKey);
      const date = weekDays(q.week)[q.day];
      const same = (e: TimeEntry) => e.userId === target.id && dateOf(e) === date && rowKeyOf(linkOf(s, e), categoryOf(s, e), !!e.billable) === q.rowKey;
      const timerMinutes = s.timeEntries.filter((e) => same(e) && e.source === "timer").reduce((n, e) => n + e.minutes, 0);
      const manual = Math.round(hours * 60) - timerMinutes;
      if (manual < 0) throw new Error(`The timer already logged ${toHours(timerMinutes)} h here. Remove timer entries in the entry list to go lower.`);
      s.timeEntries = s.timeEntries.filter((e) => !(same(e) && e.source === "manual"));
      if (manual > 0) addEntry(s, target, { date, minutes: manual, link, category, billable });
      await save();
    },

    async addManualEntry(input) {
      const user = await viewer();
      const target = targetUser(user, input.userId);
      const s = await load();
      addEntry(s, target, input);
      await save();
    },

    async listWeekEntries(q) {
      const user = await viewer();
      const target = targetUser(user, q.userId);
      const s = await load();
      return s.timeEntries
        .filter((e) => e.userId === target.id && weekOfEntry(e) === q.week)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        .map((e) => ({ id: e.id, date: dateOf(e), minutes: e.minutes, source: e.source, label: describe(s, linkOf(s, e)).label, category: categoryOf(s, e), billable: !!e.billable, note: e.note, locked: isLocked(s, e.userId, e.startedAt) }));
    },

    async deleteManualEntry(id) {
      const user = await viewer();
      const s = await load();
      const e = s.timeEntries.find((x) => x.id === id);
      if (!e) return;
      if (e.userId !== user.id && user.role !== "admin") throw new AccessError(403);
      if (isLocked(s, e.userId, e.startedAt)) throw new Error("That week is submitted. Ask an admin to reopen it first.");
      s.timeEntries = s.timeEntries.filter((x) => x.id !== id);
      await save();
    },

    async startTimerOn(link, category) {
      const user = await viewer();
      if (user.role === "viewer") throw new AccessError(403);
      const s = await load();
      if (s.timers.some((t) => t.userId === user.id)) stopTimer(s, user);
      s.timers.push({ userId: user.id, taskId: link.type === "task" ? link.id : null, linked: link.type === "task" ? null : link, startedAt: iso(), category: category ?? null });
      await save();
    },

    async runningTimer() {
      const user = await viewer();
      const s = await load();
      const r = s.timers.find((t) => t.userId === user.id);
      if (!r) return null;
      const d = describe(s, r.taskId ? { type: "task", id: r.taskId } : (r.linked ?? null));
      return { label: d.label, sub: d.sub, startedAt: r.startedAt, link: r.linked ?? null, taskId: r.taskId };
    },

    async stopRunningTimer(endAt) {
      const user = await viewer();
      const s = await load();
      stopTimer(s, user, endAt);
      await save();
    },

    async submitWeek(week) {
      const user = await viewer();
      const s = await load();
      const t = sheet(s, user.id, week);
      if (t.status !== "draft") throw new Error(`This week is already ${t.status}.`);
      if (s.timers.some((x) => x.userId === user.id && isoWeekKey(localDateKey(new Date(x.startedAt), user.timezone)) === week)) throw new Error("Stop the running timer first.");
      Object.assign(t, { status: "submitted", submittedAt: iso(), comment: null });
      for (const a of users.filter((u) => u.role === "admin" && u.active && u.id !== user.id)) notify({ userId: a.id, type: "task", text: `${user.name.split(" ")[0]} submitted ${week} for approval`, href: `/time?user=${user.id}&week=${week}` });
      audit(user.id, "timesheet.submit", "timesheet", t.id, null, { week });
      await save();
    },

    async approveWeek(userId, week) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      if (userId === user.id && users.some((u) => u.role === "admin" && u.active && u.id !== user.id)) throw new AccessError(403, "Another admin approves your week.");
      const s = await load();
      const t = sheet(s, userId, week);
      if (t.status !== "submitted") throw new Error("Only a submitted week can be approved.");
      Object.assign(t, { status: "approved", approvedBy: user.id, approvedAt: iso() });
      // The M7 hook: billable hours become Stripe invoice items on the client's next invoice.
      const billable = s.timeEntries.filter((e) => e.userId === userId && e.billable && weekOfEntry(e) === week);
      const byClient = new Map<string, TimeEntry[]>();
      for (const e of billable) {
        const c = clientOf(s, e);
        if (c) byClient.set(c, [...(byClient.get(c) ?? []), e]);
      }
      let n = 0;
      for (const [clientId, es] of byClient) {
        const byRate = new Map<number, TimeEntry[]>();
        for (const e of es) byRate.set(e.rateMinor ?? rateFor(s, clientId).rateMinor, [...(byRate.get(e.rateMinor ?? rateFor(s, clientId).rateMinor) ?? []), e]);
        for (const [rate, group] of byRate) {
          const minutes = group.reduce((x, e) => x + e.minutes, 0);
          const currency = group[0].currency ?? rateFor(s, clientId).currency;
          const sym = currency === "USD" ? "$" : "€";
          s.timeInvoiceItems.push({
            id: uid("ii"), clientId, timesheetId: t.id, userId, minutes, rateMinor: rate, amountMinor: Math.round((minutes / 60) * rate), currency,
            description: `Custom software · ${toHours(minutes)} h × ${sym}${(rate / 100).toFixed(2)} · ${week} · ${userOf(userId)?.name.split(" ")[0]}`,
            stripeItemId: `ii_test_${uid("").slice(1)}`, status: "pending", invoiceId: null, createdAt: iso(),
          });
          n++;
        }
      }
      notify({ userId, type: "task", text: `${week} approved${n ? ` · ${n} invoice item${n > 1 ? "s" : ""} for billable time` : ""}`, href: `/time?week=${week}` });
      audit(user.id, "timesheet.approve", "timesheet", t.id, null, { userId, week, invoiceItems: n });
      await save();
      return { invoiceItems: n };
    },

    async reopenWeek(userId, week, comment) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      if (!comment.trim()) throw new Error("Say why the week is reopened.");
      const s = await load();
      const t = sheet(s, userId, week);
      if (t.status === "draft") return;
      // Items not yet on an invoice are withdrawn; approving again recreates them.
      s.timeInvoiceItems = s.timeInvoiceItems.filter((i) => !(i.timesheetId === t.id && i.status === "pending"));
      Object.assign(t, { status: "draft", comment: comment.trim(), approvedBy: null, approvedAt: null });
      notify({ userId, type: "task", text: `${week} reopened: ${comment.trim()}`, href: `/time?week=${week}` });
      audit(user.id, "timesheet.reopen", "timesheet", t.id, null, { comment });
      await save();
    },

    async pendingTimesheets() {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      const s = await load();
      return s.timesheets
        .filter((t) => t.status === "submitted")
        .map((t) => ({ ...t, name: userOf(t.userId)?.name ?? "—", hours: toHours(s.timeEntries.filter((e) => e.userId === t.userId && weekOfEntry(e) === t.week).reduce((n, e) => n + e.minutes, 0)) }));
    },

    async timeReport(q) {
      const user = await viewer();
      if (user.role !== "admin" && user.role !== "implementer") throw new AccessError(403, "Time reports are for admins (and hours-only for the implementer).");
      const s = await load();
      audit(user.id, "time.report", "time", null, null, q);
      return report(s, user, q.month, q.group);
    },

    async exportTimeCsv(q) {
      const user = await viewer();
      if (user.role !== "admin" && user.role !== "implementer") throw new AccessError(403);
      const s = await load();
      const r = report(s, user, q.month, q.group);
      const head = r.money ? ["name", "detail", "type", "hours", "revenue", "per_hour", "margin", "currency", "status"] : ["name", "detail", "type", "hours", "status"];
      const lines = r.rows.map((x) => (r.money ? [x.label, x.sub, x.type, x.hours, x.revenueMinor === null ? "" : (x.revenueMinor / 100).toFixed(2), x.perHourMinor === null ? "" : (x.perHourMinor / 100).toFixed(2), x.marginMinor === null ? "" : (x.marginMinor / 100).toFixed(2), x.currency ?? "", x.status ?? ""] : [x.label, x.sub, x.type, x.hours, x.status ?? ""]));
      return [head, ...lines].map((l) => l.map(csvCell).join(",")).join("\n");
    },

    async listTimeProjects() {
      await viewer();
      return (await load()).timeProjects.filter((p) => !p.archived);
    },

    async timeTargets() {
      const user = await viewer();
      const s = await load();
      return {
        projects: s.timeProjects.filter((p) => !p.archived),
        tasks: s.tasks.filter((t) => !t.deletedAt && !t.parentId && t.status !== "done" && t.status !== "cancelled" && (user.role === "admin" || t.assigneeIds.includes(user.id))).slice(0, 200).map((t) => ({ id: t.id, title: t.title, category: t.category })),
        clients: user.role === "viewer" ? [] : s.clients.filter((c) => c.status !== "churned").map((c) => ({ id: c.id, name: ctx.companyOfClient(s, c.id) })),
      };
    },

    async listInvoiceItems(clientId) {
      const user = await viewer();
      if (user.role !== "admin") throw new AccessError(403);
      const s = await load();
      return s.timeInvoiceItems.filter((i) => !clientId || i.clientId === clientId);
    },
  };

  /** Demo seed: September 2026 as in the Time reports mockup (345 h: Rinor 49 · co-founder 128 · BDR 168), approved weeks, cost rates, and August tasks that set the estimate accuracy. */
  const seedTime = (s: S, makeTask: (input: { spaceName: string; listName: string; title: string; assigneeIds: string[]; category: string; estimateMinutes: number; doneAt: string }) => Task) => {
    if (s.timeProjects.length) return;
    const P = (id: string, name: string, sub: string, kind: TimeProject["kind"], price: number | null, currency: "USD" | "EUR"): TimeProject => ({ id, name, sub, kind, fixedPriceMinor: price, currency, clientId: null, directCostMinor: 0, archived: false });
    s.timeProjects.push(
      P("tp-prishtina", "Prishtina Tower Residences", "3D building · fixed €3,250 · freelancer extra", "arcadian", 325_000, "EUR"),
      P("tp-sunrise", "Sunrise HVAC", "Receptionist setup · pilot", "gllarix", 60_000, "USD"),
      P("tp-bluewater", "Bluewater Plumbing", "Receptionist setup · pilot", "gllarix", 60_000, "USD"),
      P("tp-thameside", "Thameside Homes", "Proposal and meeting prep", "presale", null, "EUR"),
      P("tp-atlas", "Atlas CRM", "Internal · reviews and setup", "internal", null, "EUR"),
      P("tp-outreach", "Outreach and calls", "BDR shifts + co-founder mornings", "internal", null, "USD"),
    );
    for (const [userId, r] of Object.entries(COST_RATE_SEED)) if (users.some((u) => u.id === userId)) s.costRates.push({ userId, hourlyMinor: r.hourlyMinor, currency: r.currency, validFrom: "2026-09-01" });
    const entry = (userId: string, date: string, hours: number, project: string, category: string, time = "09:00") =>
      s.timeEntries.push({ id: uid("te"), taskId: null, userId, startedAt: new Date(zonedToUtc(date, time, tzOf(userId))).toISOString(), minutes: Math.round(hours * 60), source: "manual", note: null, category, linked: { type: "project", id: project }, billable: false });
    const cat: Record<string, string> = { "tp-prishtina": "Delivery", "tp-sunrise": "Delivery", "tp-bluewater": "Delivery", "tp-thameside": "Sales", "tp-atlas": "Development", "tp-outreach": "Sales" };
    // Rinor: weekends only (11, 12, 14, 12 h).
    const rinor: [string, [string, number][]][] = [
      ["2026-09-05", [["tp-atlas", 7], ["tp-prishtina", 4]]],
      ["2026-09-12", [["tp-atlas", 6], ["tp-prishtina", 4], ["tp-sunrise", 2]]],
      ["2026-09-19", [["tp-atlas", 7.5], ["tp-prishtina", 3], ["tp-sunrise", 2.5], ["tp-bluewater", 1]]],
      ["2026-09-26", [["tp-atlas", 7], ["tp-prishtina", 3], ["tp-bluewater", 2]]],
    ];
    for (const [sat, rows] of rinor) for (const [p, h] of rows) {
      entry("u-rinor", sat, h / 2, p, cat[p], "09:00");
      entry("u-rinor", shiftDateKey(sat, 1), h / 2, p, cat[p], "09:00");
    }
    // Co-founder: weekday mornings, 128 h.
    const weekdays = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`).filter((d) => ![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()));
    const extra: Record<string, [string, number][]> = {
      "2026-09-03": [["tp-thameside", 2]], "2026-09-08": [["tp-prishtina", 2]], "2026-09-10": [["tp-sunrise", 1.5]], "2026-09-15": [["tp-prishtina", 2]], "2026-09-16": [["tp-thameside", 2]],
      "2026-09-17": [["tp-sunrise", 1.5]], "2026-09-22": [["tp-prishtina", 2]], "2026-09-23": [["tp-atlas", 1]], "2026-09-24": [["tp-bluewater", 2]], "2026-09-25": [["tp-atlas", 2.5]],
      "2026-09-29": [["tp-prishtina", 2]], "2026-09-30": [["tp-thameside", 2]],
    };
    weekdays.forEach((d, i) => {
      entry("u-cofounder", d, 4.5 + (i < 13 ? 0.5 : 0), "tp-outreach", "Sales", "08:00");
      for (const [p, h] of extra[d] ?? []) entry("u-cofounder", d, h, p, cat[p], "13:00");
    });
    // BDR: 8-hour shifts on 21 weekdays (from 2 Sep).
    for (const d of weekdays.slice(1)) entry("u-bdr", d, 8, "tp-outreach", "Sales", "08:00");
    // September weeks are approved; this week stays open.
    for (const u of ["u-rinor", "u-cofounder", "u-bdr"]) {
      for (const w of ["2026-W36", "2026-W37", "2026-W38", "2026-W39"]) {
        s.timesheets.push({ id: uid("ts"), userId: u, week: w, status: "approved", submittedAt: iso(Date.parse(`${shiftDateKey(isoWeekRange(w).start, 6)}T18:00:00Z`)), approvedBy: u === "u-cofounder" ? "u-rinor" : "u-cofounder", approvedAt: iso(Date.parse(`${shiftDateKey(isoWeekRange(w).start, 7)}T10:00:00Z`)), comment: null });
      }
    }
    // August tasks that set the estimate accuracy (Development 1.3×, delivery 1.1×, sales 1.0×, research 1.4×).
    const acc: [string, string, string, string, string, number, number, string][] = [
      ["Company", "Atlas CRM build", "Set up the Atlas repo, CI and preview deploys", "u-rinor", "Development", 10, 13, "2026-08-08"],
      ["Sales", "BDR onboarding", "Draft the first call script", "u-bdr", "Sales", 6, 6, "2026-08-10"],
      ["Delivery", "Onboarding", "Write the pilot onboarding checklist", "u-implementer", "Delivery", 10, 11, "2026-08-11"],
      ["Research", "Market research", "Read the voice platforms' FAQ and limits", "u-implementer", "Research", 5, 7, "2026-08-17"],
    ];
    for (const [space, list, title, who, category, est, act, date] of acc) {
      const t = makeTask({ spaceName: space, listName: list, title, assigneeIds: [who], category, estimateMinutes: est * 60, doneAt: `${date}T16:00:00.000Z` });
      const parts = [act / 2, act / 2];
      parts.forEach((h, i) => s.timeEntries.push({ id: uid("te"), taskId: t.id, userId: who, startedAt: new Date(zonedToUtc(shiftDateKey(date, i), "10:00", tzOf(who))).toISOString(), minutes: Math.round(h * 60), source: "timer", note: null, category, billable: false }));
    }
  };

  return { api, seedTime, isLocked, DAY };
};
