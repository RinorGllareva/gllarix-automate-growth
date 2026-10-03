/**
 * People › KPIs per role (spec/backbone/05 "KPIs by role"). Every role's KPIs with its target, the value Atlas measures
 * where it can, and how it's measured. Values Atlas can't measure yet say what's needed instead of guessing.
 * Includes the diagnostic rule: activity on target but no meetings → the script or the list; activity off target → the rep.
 */
import { OWNER_KEYS } from "@/config/ai";
import { kpiStatus, type KpiKey, type KpiStatus } from "@/config/targets";
import type { Client, Payment } from "@/data/quoteTypes";
import type { TeamMemberToday } from "@/data/queueTypes";
import type { WeeklyReport } from "@/data/salesTypes";
import type { User } from "@/data/types";

const DAY = 86_400_000;

export interface KpiLine {
  label: string;
  target: string;
  /** Display value; null when Atlas can't measure it yet. */
  value: string | null;
  status: KpiStatus | null;
  /** How it's measured, or what's needed to measure it. */
  how: string;
}

export interface RoleBlock {
  role: string;
  /** People in the role; empty when nobody holds it yet. */
  people: { id: string; name: string }[];
  /** For an empty role: when it gets hired. */
  hireWhen?: string;
  lines: KpiLine[];
  diagnostic?: { tone: "good" | "script" | "rep"; text: string };
}

export interface RoleKpiInput {
  users: User[];
  /** Weekly report per user id (admin can ask for anyone). */
  reports: Record<string, WeeklyReport>;
  today: TeamMemberToday[];
  payments: Payment[];
  clients: Client[];
  /** Deal id → won date: the deposit date when no deposit payment is on record (won needs a paid deposit). */
  wonAt?: Record<string, string | null>;
  now: number;
}

const pct = (v: number | null) => (v === null ? null : `${Math.round(v * 100)}%`);
const fromReport = (r: WeeklyReport | undefined, key: KpiKey, label: string, how: string): KpiLine => {
  const k = r?.kpis.find((x) => x.key === key);
  const v = k?.value ?? null;
  const shown = v === null ? null : k!.unit === "pct" ? pct(v) : k!.unit === "rate" ? v.toFixed(1) : String(v);
  return { label, target: k?.target ?? "—", value: shown, status: k?.status ?? null, how };
};
const tracked = (label: string, value: string | null, how: string): KpiLine => ({ label, target: "Tracked", value, status: null, how });

/** Days from the setup deposit to go-live, per client that went live in the last 90 days. */
export const depositToLive = (payments: Payment[], clients: Client[], now: number, wonAt: Record<string, string | null> = {}) =>
  clients
    .filter((c) => c.liveAt && now - new Date(c.liveAt).getTime() <= 90 * DAY)
    .map((c) => {
      const dep = payments.filter((p) => p.dealId === c.dealId && p.type === "setup_deposit" && p.status === "paid").sort((a, b) => a.paidAt.localeCompare(b.paidAt))[0]?.paidAt ?? wonAt[c.dealId] ?? null;
      return dep ? Math.max(0, Math.round((new Date(c.liveAt!).getTime() - new Date(dep).getTime()) / DAY)) : null;
    })
    .filter((d): d is number => d !== null);

/** Clients that churned within 30 days of going live (first-month churn), among those live in the last 90 days. */
export const firstMonthChurn = (clients: Client[], now: number) =>
  clients.filter((c) => c.liveAt && now - new Date(c.liveAt).getTime() <= 90 * DAY && c.churnedAt && new Date(c.churnedAt).getTime() - new Date(c.liveAt).getTime() <= 30 * DAY).length;

/** The diagnostic rule from the spec, on one rep's week (dials and conversations per working day; not today's half-done queue). */
export const diagnose = (r: WeeklyReport | undefined): RoleBlock["diagnostic"] => {
  if (!r) return undefined;
  const get = (k: KpiKey) => r.kpis.find((x) => x.key === k);
  const activity = [get("dials_per_day")?.status, get("conversations_per_day")?.status];
  if (activity.every((s) => s === null || s === undefined)) return undefined;
  const activityOk = activity.every((s) => s === "on_track" || s === "watch");
  const meetingsOk = get("meetings_booked")?.status === "on_track";
  if (activityOk && meetingsOk) return { tone: "good", text: "Activity and meetings are on target." };
  if (activityOk) return { tone: "script", text: "Activity is on target but meetings aren't: the script or the list is the problem. The founders fix it." };
  return { tone: "rep", text: "Activity is off target: talk it through with the rep in the next 1:1." };
};

export const roleKpis = (i: RoleKpiInput): RoleBlock[] => {
  const active = i.users.filter((u) => u.active);
  const days = depositToLive(i.payments, i.clients, i.now, i.wonAt);
  const avgDays = days.length ? days.reduce((a, b) => a + b, 0) / days.length : null;
  const within7 = days.length ? days.filter((d) => d <= 7).length / days.length : null;
  const churned = firstMonthChurn(i.clients, i.now);
  const blocks: RoleBlock[] = [];

  for (const u of active.filter((x) => x.role === "bdr")) {
    const r = i.reports[u.id];
    const t = i.today.find((x) => x.userId === u.id);
    const queueDone = t && t.capacity ? t.done / t.capacity : null;
    blocks.push({
      role: "BDR",
      people: [{ id: u.id, name: u.name }],
      lines: [
        { label: "Queue done today", target: `100% of ${u.dailyCapacity ?? 150}`, value: t ? `${t.done} of ${t.capacity}` : null, status: kpiStatus(queueDone, 1), how: "Today's call queue, so far" },
        fromReport(r, "dials_per_day", "Dials per day", "Calls per working day this week"),
        fromReport(r, "conversations_per_day", "Conversations per day", "Calls with a conversation outcome, per working day this week"),
        fromReport(r, "meetings_booked", "Meetings booked this week", "Meetings this person booked"),
        fromReport(r, "approved_per_booked", "Approved / booked", "Meetings passing all 6 approval checks"),
        fromReport(r, "show_rate", "Show rate", "Held ÷ meetings that were due"),
        fromReport(r, "close_rate_held", "Close rate on held", "Won ÷ held"),
        fromReport(r, "crm_same_day", "CRM updated same day", "Calls with an outcome logged"),
        fromReport(r, "followup_24h", "Follow-up within 24 h", "Held meetings followed up within a day"),
      ],
      diagnostic: diagnose(r),
    });
  }

  // There is no setter role in Atlas yet: it's added with the first setter hire (Gate 1).
  blocks.push({
    role: "Setter",
    people: [],
    hireWhen: "Gate 1: 3 paying clients",
    lines: [
      { label: "Approved meetings per month", target: "12–16", value: null, status: null, how: "From the setter's approved meetings once one is hired" },
      { label: "Show rate", target: "70%+", value: null, status: null, how: "Held ÷ due" },
    ],
  });

  const closers = active.filter((x) => x.role === "closer");
  const cr = closers[0] ? i.reports[closers[0].id] : undefined;
  blocks.push({
    role: "Closer",
    people: closers.map((u) => ({ id: u.id, name: u.name })),
    hireWhen: "Gate 1: the BDR is promoted",
    lines: closers.length
      ? [fromReport(cr, "close_rate_held", "Close rate", "Won ÷ held"), tracked("Held meetings per month", null, "Capacity 30–40"), tracked("Cash collected", null, "From Money › Payments")]
      : [
          { label: "Held meetings per month", target: "30–40 capacity", value: null, status: null, how: "Once a closer is hired" },
          { label: "Close rate", target: "20%+", value: null, status: null, how: "Won ÷ held" },
          { label: "Cash collected", target: "Tracked", value: null, status: null, how: "From Money › Payments" },
        ],
  });

  const implementers = active.filter((x) => x.role === "implementer");
  blocks.push({
    role: "Implementer",
    people: implementers.map((u) => ({ id: u.id, name: u.name })),
    hireWhen: "Gate 2: €2,000 MRR for 2 months",
    lines: [
      { label: "Setup time", target: "≤ 3 h (templated)", value: null, status: null, how: "Needs setup hours logged on each client's time project" },
      { label: "Days from deposit to go-live", target: "≤ 7", value: avgDays === null ? null : `${avgDays.toFixed(1)} days`, status: avgDays === null ? null : avgDays <= 7 ? "on_track" : avgDays <= 7.7 ? "watch" : "off_track", how: `Average over ${days.length} client${days.length === 1 ? "" : "s"} live in the last 90 days` },
      { label: "First-month churn", target: "0", value: String(churned), status: churned === 0 ? "on_track" : "off_track", how: "Clients lost within 30 days of going live" },
    ],
  });

  const co = active.find((u) => u.id === OWNER_KEYS.cofounder);
  if (co) {
    const r = i.reports[co.id];
    const dials = r?.kpis.find((x) => x.key === "dials_per_day")?.value ?? null;
    blocks.push({
      role: "Co-founder",
      people: [{ id: co.id, name: co.name }],
      lines: [
        { label: "Developer contacts per day", target: "80", value: dials === null ? null : dials.toFixed(1), status: kpiStatus(dials, 80), how: "Calls per working day this week" },
        tracked("Meetings this week", r ? String(r.kpis.find((x) => x.key === "meetings_booked")?.value ?? 0) : null, "Meetings booked"),
        { label: "Month-end close on time", target: "Yes, by the 1st", value: null, status: null, how: "Needs the close logged in Atlas (Money › Finance)" },
      ],
    });
  }

  const rinor = active.find((u) => u.id === OWNER_KEYS.rinor);
  if (rinor)
    blocks.push({
      role: "Rinor",
      people: [{ id: rinor.id, name: rinor.name }],
      lines: [
        { label: "PRs reviewed within 7 days", target: "100%", value: null, status: null, how: "Needs the GitHub connection" },
        { label: "Setups delivered within 7 days", target: "100%", value: pct(within7), status: kpiStatus(within7, 1), how: `Deposit to go-live, ${days.length} recent client${days.length === 1 ? "" : "s"}` },
      ],
    });

  return blocks;
};
