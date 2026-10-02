import { dispositionByLabel } from "@/config/dispositions";
import { GATES, KPI_TARGETS, kpiStatus, MRR_PLAN_EUR, USD_PER_EUR, type KpiKey } from "@/config/targets";
import type { Activity, Company, Lead } from "@/data/leadTypes";
import type { DailyQueue, Meeting } from "@/data/queueTypes";
import type { DailyBdrReport, Deal, FunnelStep, GateProgress, KpiRow, MeetingStatus, MrrPoint, WeeklyReport } from "@/data/salesTypes";
import type { User } from "@/data/types";
import { businessDaysBetween, isoWeekKey, isoWeekRange, localDateKey, monthRange, rangeLabel, shiftDateKey, zonedToUtc } from "./time";

const NOT_CONNECTED = new Set(["No answer", "Voicemail"]);
const DAY = 86_400_000;

/** Meeting status for the Meetings screen (08_MEETINGS.md). */
export const meetingStatus = (m: Meeting, now: number): MeetingStatus => {
  if (m.attended === false) return "no_show";
  if (m.approved === true) return "approved";
  if (m.approved === false) return "rejected";
  if (m.attended === true) return "to_approve";
  if (new Date(m.scheduledAt).getTime() <= now) return "to_hold";
  return "upcoming";
};

export interface ReportInput {
  now: number;
  tz: string;
  period: { kind: "week" | "month"; key: string };
  /** A user id, or "team" for everyone with a queue. */
  personId: string | "team";
  users: User[];
  activities: Activity[];
  meetings: Meeting[];
  deals: Deal[];
  leads: Lead[];
  /** Clients (M7): churned clients drop out of MRR from the day they churn. */
  clients?: { dealId: string; churnedAt: string | null }[];
}

export const periodBounds = (kind: "week" | "month", key: string, tz: string) => {
  const { start, end } = kind === "week" ? isoWeekRange(key) : monthRange(key);
  return { start, end, from: zonedToUtc(start, "00:00", tz), to: zonedToUtc(shiftDateKey(end, 1), "00:00", tz) };
};

export const currentPeriodKey = (kind: "week" | "month", now: number, tz: string) =>
  kind === "week" ? isoWeekKey(localDateKey(now, tz)) : localDateKey(now, tz).slice(0, 7);

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** Monthly recurring revenue in EUR at a moment: won deals' monthly fees minus churned clients, USD converted at the planning rate. */
export const mrrEurAt = (deals: Deal[], at: number, clients: { dealId: string; churnedAt: string | null }[] = []) =>
  deals
    .filter((d) => d.stage === "won" && d.wonAt && new Date(d.wonAt).getTime() <= at)
    .filter((d) => {
      const churned = clients.find((c) => c.dealId === d.id)?.churnedAt;
      return !churned || new Date(churned).getTime() > at;
    })
    .reduce((sum, d) => sum + (d.currency === "USD" ? d.monthlyMinor / USD_PER_EUR : d.monthlyMinor) / 100, 0);

/** Weekly (or monthly) funnel, KPIs against targets, MRR against the €10k plan and stage gates (11_REPORTS.md). */
export const computeReport = (input: ReportInput): WeeklyReport => {
  const { now, tz, period, personId } = input;
  const b = periodBounds(period.kind, period.key, tz);
  const inPeriod = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= b.from && t < b.to;
  };
  const people = personId === "team" ? new Set(input.users.filter((u) => u.dailyCapacity).map((u) => u.id)) : new Set([personId]);
  const leadOwner = new Map(input.leads.map((l) => [l.id, l.ownerId]));

  const calls = input.activities.filter((a) => a.type === "call" && a.userId && people.has(a.userId) && inPeriod(a.at));
  const connects = calls.filter((a) => a.disposition && !NOT_CONNECTED.has(a.disposition));
  const conversations = calls.filter((a) => a.disposition && dispositionByLabel(a.disposition)?.conversation);
  const booked = input.meetings.filter((m) => people.has(m.bookedBy) && inPeriod(m.createdAt));
  const mine = input.meetings.filter((m) => people.has(m.bookedBy));
  const scheduled = mine.filter((m) => inPeriod(m.scheduledAt));
  const held = scheduled.filter((m) => m.attended === true);
  const due = scheduled.filter((m) => new Date(m.scheduledAt).getTime() <= now);
  const dueMarked = due.filter((m) => m.attended !== null);
  const won = input.deals.filter((d) => d.stage === "won" && inPeriod(d.wonAt) && people.has(d.ownerId ?? leadOwner.get(d.leadId) ?? ""));

  const funnelCounts: [FunnelStep["key"], string, number][] = [
    ["dials", "Dials", calls.length],
    ["connects", "Connects", connects.length],
    ["conversations", "Conversations", conversations.length],
    ["booked", "Booked", booked.length],
    ["held", "Held", held.length],
    ["won", "Won", won.length],
  ];
  const funnel: FunnelStep[] = funnelCounts.map(([key, label, count], i) => ({
    key,
    label,
    count,
    rate: i === 0 ? null : ratio(count, funnelCounts[i - 1][2]),
  }));

  // Business days elapsed in the period, so "per day" isn't diluted by days still to come.
  const todayKey = localDateKey(now, tz);
  const lastKey = todayKey < b.end ? todayKey : b.end;
  const daysElapsed = todayKey < b.start ? 0 : Math.max(1, businessDaysBetween(shiftDateKey(b.start, -1), lastKey));
  const weeks = period.kind === "week" ? 1 : Math.max(1, (new Date(`${b.end}T00:00:00Z`).getTime() - new Date(`${b.start}T00:00:00Z`).getTime() + DAY) / (7 * DAY));
  const followedUp = held.filter((m) => {
    const t = new Date(m.scheduledAt).getTime();
    return input.activities.some((a) => a.leadId === m.leadId && a.type !== "created" && new Date(a.at).getTime() > t && new Date(a.at).getTime() <= t + DAY);
  });

  const values: Record<KpiKey, number | null> = {
    dials_per_day: daysElapsed ? calls.length / daysElapsed : null,
    conversations_per_day: daysElapsed ? conversations.length / daysElapsed : null,
    meetings_booked: booked.length / weeks,
    show_rate: ratio(dueMarked.filter((m) => m.attended).length, dueMarked.length),
    approved_per_booked: ratio(booked.filter((m) => m.approved === true).length, booked.filter((m) => m.approved !== null).length),
    crm_same_day: ratio(calls.filter((a) => a.disposition).length, calls.length),
    close_rate_held: ratio(won.length, held.length),
    followup_24h: ratio(followedUp.length, held.length),
  };
  const kpis: KpiRow[] = KPI_TARGETS.map((t) => ({
    key: t.key,
    label: t.label,
    value: values[t.key],
    target: t.text,
    unit: t.unit,
    status: kpiStatus(values[t.key], t.min),
  }));

  // MRR: actual up to this month, plan for every month of the €10k plan.
  const thisMonth = localDateKey(now, tz).slice(0, 7);
  const mrr: MrrPoint[] = MRR_PLAN_EUR.map((p) => {
    if (p.month > thisMonth) return { month: p.month, planEur: p.eur, actualEur: null };
    const end = p.month === thisMonth ? now : periodBounds("month", p.month, tz).to;
    return { month: p.month, planEur: p.eur, actualEur: Math.round(mrrEurAt(input.deals, end, input.clients)) };
  });
  const current = mrr.find((p) => p.month === thisMonth);
  const actualNow = current?.actualEur ?? Math.round(mrrEurAt(input.deals, now, input.clients));
  const planNow = current?.planEur ?? 0;
  // ±10% of plan (11_REPORTS.md); with a zero plan, any revenue is ahead.
  const mrrStatus = planNow === 0 ? (actualNow > 0 ? "ahead" : "on_plan") : actualNow >= planNow * 1.1 ? "ahead" : actualNow >= planNow * 0.9 ? "on_plan" : "behind";

  const payingClients = new Set(input.deals.filter((d) => d.stage === "won" && d.depositPaid && d.wonAt && new Date(d.wonAt).getTime() <= now).map((d) => d.leadId)).size;
  const monthEnds = [-2, -1].map((n) => {
    const [y, m] = thisMonth.split("-").map(Number);
    const key = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
    return mrrEurAt(input.deals, periodBounds("month", key, tz).to, input.clients);
  });
  const gates: GateProgress[] = [
    { ...GATES[0], value: `${payingClients} / 3`, progress: Math.min(1, payingClients / 3), met: payingClients >= 3 },
    { ...GATES[1], value: `€${actualNow.toLocaleString("en-US")}`, progress: Math.min(1, actualNow / 2000), met: monthEnds.every((v) => v >= 2000) },
    { ...GATES[2], value: `€${actualNow.toLocaleString("en-US")}`, progress: Math.min(1, actualNow / 5000), met: false },
  ].map((g) => ({ key: g.key, label: g.label, note: g.note, value: g.value, progress: g.progress, met: g.met }));

  return {
    period: { kind: period.kind, key: period.key, start: b.start, end: b.end, label: `${period.kind === "week" ? `Week ${Number(period.key.split("W")[1])}` : period.key} · ${rangeLabel(b.start, b.end)}` },
    personId,
    funnel,
    kpis,
    mrr,
    mrrStatus,
    gates,
    computedAt: new Date(now).toISOString(),
  };
};

/** End-of-shift report for one BDR (A13 item 10); rejection reasons from that day are included (08_MEETINGS.md). */
export const computeDailyReport = (input: {
  user: User;
  date: string;
  now: number;
  activities: Activity[];
  meetings: Meeting[];
  queue: DailyQueue | null;
  companies: Map<string, Company>;
  leads: Map<string, Lead>;
}): DailyBdrReport => {
  const { user, date } = input;
  const onDay = (iso: string | null | undefined) => Boolean(iso) && localDateKey(new Date(iso!), user.timezone) === date;
  const calls = input.activities.filter((a) => a.type === "call" && a.userId === user.id && onDay(a.at));
  const outcomes = new Map<string, number>();
  calls.forEach((a) => outcomes.set(a.disposition ?? "—", (outcomes.get(a.disposition ?? "—") ?? 0) + 1));
  const companyOf = (leadId: string) => input.companies.get(input.leads.get(leadId)?.companyId ?? "")?.name ?? "—";
  return {
    userId: user.id,
    userName: user.name,
    date,
    dials: calls.length,
    conversations: calls.filter((a) => a.disposition && dispositionByLabel(a.disposition)?.conversation).length,
    booked: input.meetings.filter((m) => m.bookedBy === user.id && onDay(m.createdAt)).length,
    outcomes: [...outcomes].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    queueDone: input.queue ? input.queue.items.filter((i) => i.status !== "open").length : 0,
    queueTotal: input.queue?.items.length ?? 0,
    rejections: input.meetings
      .filter((m) => m.bookedBy === user.id && m.approved === false && onDay(m.decidedAt))
      .map((m) => ({ company: companyOf(m.leadId), reason: m.rejectReason ?? "—" })),
    generatedAt: new Date(input.now).toISOString(),
  };
};
