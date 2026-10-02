import { COUNTRY_RULES } from "@/config/countryRules";
import { QUEUE, type Channel } from "@/config/queue";
import { SCORING } from "@/config/scoring";
import type { Activity, Company, Contact, Lead, Signal, Suppression, Tier } from "@/data/leadTypes";
import type { DailyQueue, QueueItem, QueueKind, QueueSummary } from "@/data/queueTypes";
import type { User } from "@/data/types";
import { canContact } from "./compliance";
import { addBusinessDays, businessDaysBetween, isBusinessDay, localDateKey, localHHMM, parseWindow, zonedToUtc, zoneAbbr } from "./time";

export interface QueueInput {
  owner: User;
  now: number;
  leads: Lead[];
  companies: Map<string, Company>;
  contactsByCompany: Map<string, Contact[]>;
  activitiesByLead: Map<string, Activity[]>;
  signalsByLead?: Map<string, Signal[]>;
  suppression: Suppression[];
}

/** Stages a cadence still works. Replied, meetings and later stages leave the cadence (stop_on). */
const WORKABLE = new Set(["new", "researched", "contacted", "replied", "qualified", "nurture"]);
const DUE_WEIGHT: Record<QueueKind | "overdue", number> = { callback: 1.5, overdue: 1.3, follow_up: 1.2, cadence: 1.1, new: 1.0 };
const SIGNAL_RULES = new Set(
  Object.values(SCORING.models)
    .flat()
    .filter((r) => "signal" in r.when)
    .map((r) => r.id),
);

export const shiftFor = (owner: User) => parseWindow(QUEUE.shifts[owner.role] ?? QUEUE.shifts.bdr);

/**
 * The owner-local date a queue is for: today until the shift ends on a business day,
 * otherwise the next business day (the queue is built ahead, like the 05:00 job).
 */
export const queueDateFor = (owner: User, now: number) => {
  const tz = owner.timezone;
  const today = localDateKey(now, tz);
  const [, to] = shiftFor(owner);
  if (!isBusinessDay(today)) return addBusinessDays(today, 0);
  return now >= zonedToUtc(today, to, tz) ? addBusinessDays(today, 1) : today;
};

export const cadenceDay = (lead: Lead, todayKey: string, tz: string) =>
  lead.cadenceStartedAt ? businessDaysBetween(localDateKey(new Date(lead.cadenceStartedAt), tz), todayKey) + 1 : 1;

interface Candidate extends QueueItem {
  tier: Tier;
  sortAt: number;
}

/**
 * Daily queue builder (A9): candidates → due work → fill to capacity by
 * priority = tier_weight × score × due_weight × window_fit, ordered by window (rolling west), A-tier first.
 */
export const buildQueue = (input: QueueInput): DailyQueue => {
  const started = performance.now();
  const { owner, now } = input;
  const capacity = owner.dailyCapacity ?? 0;
  const ownerTz = owner.timezone;
  const today = queueDateFor(owner, now);
  const [shiftFrom, shiftTo] = shiftFor(owner);
  const shiftStart = zonedToUtc(today, shiftFrom, ownerTz);
  const shiftEnd = zonedToUtc(today, shiftTo, ownerTz);
  const from = Math.max(shiftStart, now);

  const candidates: Candidate[] = [];
  let blocked = 0;

  for (const lead of input.leads) {
    if (lead.ownerId !== owner.id || lead.suppressed || lead.excluded || !WORKABLE.has(lead.stage)) continue;
    const company = input.companies.get(lead.companyId);
    if (!company) continue;
    const contacts = input.contactsByCompany.get(company.id) ?? [];
    const contact = contacts.find((c) => c.id === lead.primaryContactId) ?? contacts[0] ?? null;
    const activities = input.activitiesByLead.get(lead.id) ?? [];
    const tz = company.timezone ?? ownerTz;
    const isNew = lead.attemptsCount === 0 && (lead.stage === "new" || lead.stage === "researched");
    const due = lead.nextActionAt ? new Date(lead.nextActionAt).getTime() : null;
    const dueToday = due !== null && due <= shiftEnd;
    const day = cadenceDay(lead, localDateKey(from, tz), tz);
    // cadenceId null = taken off the cadence (import "No cadence", Leads › Add to cadence). Nurture keeps its old behaviour.
    const cadence = lead.cadenceId === null && lead.stage !== "nurture" ? [] : (QUEUE.cadences[lead.cadenceId ?? QUEUE.cadenceFor[lead.listType]] ?? []);
    const tierOk = (channel: Channel) => lead.tier === "A" || lead.tier === "B" || (lead.tier === "C" && lead.stage === "nurture" && channel === "email");

    const check = (channel: Channel, at: number) =>
      canContact({ lead, company, contacts, contact, channel, at, suppression: input.suppression, activities });

    const push = (item: Omit<Candidate, "tier" | "status" | "doneAt" | "note">) => candidates.push({ ...item, tier: lead.tier, status: "open", doneAt: null, note: null });

    /** Best call window today: primary windows, then secondary, then any allowed hour inside the shift. */
    const callSlot = () => {
      const leadDate = localDateKey(from, tz);
      const windows = QUEUE.windows[lead.listType];
      const tries: [string[], number][] = [
        [windows.call, 1],
        [windows.secondary, 0.6],
        [[QUEUE.defaultCallHoursLocal], 0.25],
      ];
      // Every slot is also clipped to the market's allowed calling hours.
      const rule = company.country ? COUNTRY_RULES[company.country] : undefined;
      const [hoursFrom, hoursTo] = parseWindow(rule?.callHoursLocal ?? QUEUE.defaultCallHoursLocal);
      const allowedFrom = zonedToUtc(leadDate, hoursFrom, tz);
      const allowedTo = zonedToUtc(leadDate, hoursTo, tz);
      for (const [list, fit] of tries) {
        for (const w of list) {
          const [ws, we] = parseWindow(w);
          const start = Math.max(zonedToUtc(leadDate, ws, tz), from, allowedFrom);
          const end = Math.min(zonedToUtc(leadDate, we, tz), shiftEnd, allowedTo);
          if (end - start >= 15 * 60_000) return { start, end, fit, name: `${zoneAbbr(tz)} ${ws}–${we}` };
        }
      }
      return null;
    };

    const tierWeight = QUEUE.tierWeight[lead.tier] ?? 0;
    const base = tierWeight * lead.score;

    // 1. Calls: callbacks at their time, due follow-ups, or day-1 calls for new leads.
    const callType = lead.nextActionType === "callback" ? "callback" : ["call", "follow_up"].includes(lead.nextActionType ?? "") ? "call" : null;
    const wantsCall = (callType && dueToday) || (isNew && cadence.some((s) => s.channel === "call" && s.day <= day));
    if (wantsCall && tierOk("call")) {
      if (callType === "callback" && due !== null) {
        const at = Math.max(due, from);
        const ok = check("call", at);
        if (!ok.allowed) blocked += 1;
        else
          push({
            leadId: lead.id,
            channel: "call",
            kind: "callback",
            step: "Callback",
            priority: base * DUE_WEIGHT.callback,
            windowStartAt: new Date(at).toISOString(),
            windowEndAt: new Date(at + 30 * 60_000).toISOString(),
            windowName: `Callback ${localHHMM(due, tz)} ${zoneAbbr(tz)}`,
            dueAt: new Date(due).toISOString(),
            sortAt: at,
          });
      } else {
        const slot = callSlot();
        const ok = slot ? check("call", slot.start) : null;
        if (!slot || !ok?.allowed) blocked += 1;
        else {
          const kind: QueueKind = isNew ? "new" : "follow_up";
          const overdue = due !== null && due < shiftStart;
          push({
            leadId: lead.id,
            channel: "call",
            kind,
            step: day <= Math.max(0, ...cadence.map((c) => c.day)) ? `Day ${day} · call` : "Follow-up · call",
            priority: base * (overdue ? DUE_WEIGHT.overdue : DUE_WEIGHT[kind]) * slot.fit,
            windowStartAt: new Date(slot.start).toISOString(),
            windowEndAt: new Date(slot.end).toISOString(),
            windowName: slot.name,
            dueAt: null,
            sortAt: slot.start,
          });
        }
      }
    }

    // 2. Non-call cadence steps due today (email from M5, LinkedIn as a manual task), plus due email/LinkedIn actions.
    const stepItems = cadence.filter((s) => s.channel !== "call" && s.day === day && !lead.cadenceStepsDone.includes(`${s.day}:${s.channel}`));
    if (dueToday && (lead.nextActionType === "email" || lead.nextActionType === "linkedin")) {
      const ch = lead.nextActionType as Channel;
      if (!stepItems.some((s) => s.channel === ch)) stepItems.push({ day, channel: ch });
    }
    if (lead.stage === "replied") stepItems.length = 0; // a reply stops the cadence; follow-ups are calls
    for (const s of stepItems) {
      if (!tierOk(s.channel)) continue;
      if (s.channel === "email" && !check("email", from).allowed) {
        blocked += 1;
        continue;
      }
      push({
        leadId: lead.id,
        channel: s.channel,
        kind: "cadence",
        template: s.template ?? null,
        step: `Day ${s.day} · ${s.channel === "linkedin" ? "LinkedIn" : "email"}`,
        priority: base * DUE_WEIGHT.cadence * (s.channel === "email" ? QUEUE.emailWeight : 1),
        windowStartAt: null,
        windowEndAt: null,
        windowName: null,
        dueAt: null,
        // LinkedIn tasks are manual morning work; emails go out in a batch at the end of the shift.
        sortAt: s.channel === "email" ? shiftEnd - 30 * 60_000 : shiftStart,
      });
    }
  }

  // Fill to capacity: reserve 20% for follow-ups and callbacks, then ≥30% of the rest for new A-tier.
  const byPriority = (a: Candidate, b: Candidate) => b.priority - a.priority;
  const followups = candidates.filter((c) => c.kind === "callback" || c.kind === "follow_up").sort(byPriority);
  const newA = candidates.filter((c) => c.kind === "new" && c.tier === "A").sort(byPriority);
  const picked = new Set<Candidate>();
  followups.slice(0, Math.floor((capacity * QUEUE.reserveFollowupsPct) / 100)).forEach((c) => picked.add(c));
  const rest = capacity - picked.size;
  newA.slice(0, Math.ceil((rest * QUEUE.minNewATierPct) / 100)).forEach((c) => picked.add(c));
  const maxEmails = Math.floor((capacity * QUEUE.maxEmailPct) / 100);
  let emails = 0;
  for (const c of [...candidates].sort(byPriority)) {
    if (picked.size >= capacity) break;
    if (picked.has(c)) continue;
    if (c.channel === "email") {
      if (emails >= maxEmails) continue;
      emails += 1;
    }
    picked.add(c);
  }

  const tierRank: Record<Tier, number> = { A: 0, B: 1, C: 2, D: 3 };
  const items = [...picked]
    .sort((a, b) => a.sortAt - b.sortAt || tierRank[a.tier] - tierRank[b.tier] || b.priority - a.priority)
    .map(({ tier: _tier, sortAt: _sortAt, ...item }) => ({ ...item, priority: Math.round(item.priority * 10) / 10 }));

  const leadTier = new Map(input.leads.map((l) => [l.id, l.tier]));
  const summary: QueueSummary = {
    capacity,
    total: items.length,
    byChannel: { call: 0, email: 0, linkedin: 0 },
    byTier: { A: 0, B: 0, C: 0, D: 0 },
    byWindow: [],
    followUps: items.filter((i) => i.kind === "follow_up" || i.kind === "callback").length,
    newLeads: items.filter((i) => i.kind === "new").length,
    shortfall: Math.max(0, capacity - items.length),
    blocked,
    buildMs: 0,
  };
  const windows = new Map<string, number>();
  for (const i of items) {
    summary.byChannel[i.channel] += 1;
    summary.byTier[leadTier.get(i.leadId) ?? "D"] += 1;
    if (i.windowName) windows.set(i.windowName, (windows.get(i.windowName) ?? 0) + 1);
  }
  summary.byWindow = [...windows].map(([name, count]) => ({ name, count }));
  summary.buildMs = Math.round(performance.now() - started);

  return { ownerId: owner.id, date: today, builtAt: new Date(now).toISOString(), items, summary };
};

/** "Why now" for a queue row: the callback, or the strongest fired signal rule. */
export const whyNow = (lead: Lead, item: QueueItem) => {
  if (item.kind === "callback") return "Asked for a callback";
  const signal = lead.scoreBreakdown.find((l) => SIGNAL_RULES.has(l.ruleId) && l.points > 0);
  return signal?.label ?? lead.scoreBreakdown[0]?.label ?? "—";
};
