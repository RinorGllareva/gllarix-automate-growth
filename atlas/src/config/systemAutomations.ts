import { HOUR_VALUE_EUR, WEEKEND_HOURS } from "./buildVsBuy";

/**
 * What Atlas does by itself, with the manual minutes each run replaces. The minutes are planning assumptions
 * (a founder or BDR doing the same step by hand); change them here when real timings exist.
 */
export type SystemAutomationKey = "queue" | "cadence" | "meeting_emails" | "send_info" | "rescore" | "inbound" | "daily_report" | "task_rules";

export interface SystemAutomation {
  key: SystemAutomationKey;
  name: string;
  what: string;
  /** Who would do it by hand. */
  saves: "BDR" | "Founders" | "Implementer";
  /** The tool we'd otherwise pay for, if any. */
  instead: string | null;
  minutesPerRun: number;
}

export const SYSTEM_AUTOMATIONS: SystemAutomation[] = [
  { key: "queue", name: "Daily call queue", what: "Picks and orders each BDR's leads for the day by score, time zone and callbacks", saves: "BDR", instead: "A power dialer (Close, Aircall)", minutesPerRun: 30 },
  { key: "cadence", name: "Outreach cadence emails", what: "Sends the next email step and stops on reply, booking or opt-out", saves: "BDR", instead: "Apollo, Lemlist, Instantly", minutesPerRun: 3 },
  { key: "meeting_emails", name: "Meeting confirmations and reminders", what: "Confirmation with the invite, then reminders 24 h and 1 h before", saves: "BDR", instead: "Calendly", minutesPerRun: 2 },
  { key: "send_info", name: "Send-info follow-up", what: "Emails the one-pager the moment a call is logged as Send info", saves: "BDR", instead: null, minutesPerRun: 4 },
  { key: "rescore", name: "Nightly rescore and retention", what: "Rescores every active lead and erases expired personal data", saves: "Founders", instead: null, minutesPerRun: 45 },
  { key: "inbound", name: "Inbound routing", what: "Logs every web, booking and referral request, creates the lead and alerts the BDR", saves: "Founders", instead: "A shared inbox tool", minutesPerRun: 5 },
  { key: "daily_report", name: "Daily BDR report", what: "Dials, conversations, outcomes and queue progress, compiled at end of shift", saves: "Founders", instead: null, minutesPerRun: 15 },
  { key: "task_rules", name: "Task rules (below)", what: "Onboarding tasks on a won deal, review and overdue alerts", saves: "Implementer", instead: "ClickUp or Asana automations", minutesPerRun: 10 },
];

export interface LedgerRow extends SystemAutomation {
  runs: number;
  hours: number;
}

/** A BDR hour on the phones: 60 dials over an 8-hour shift. */
export const DIALS_PER_BDR_HOUR = 7.5;

/**
 * Runs per automation → hours saved. Founder and implementer hours (delivery is founder weekends today) are priced at
 * the founder hour; BDR hours are not worth €87.50, so they're shown as dials they get back instead.
 */
export const automationValue = (runs: Partial<Record<SystemAutomationKey, number>>, hourValueEur = HOUR_VALUE_EUR) => {
  const rows: LedgerRow[] = SYSTEM_AUTOMATIONS.map((a) => {
    const n = runs[a.key] ?? 0;
    return { ...a, runs: n, hours: (n * a.minutesPerRun) / 60 };
  }).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  const founderHours = rows.filter((r) => r.saves !== "BDR").reduce((n, r) => n + r.hours, 0);
  const bdrHours = rows.filter((r) => r.saves === "BDR").reduce((n, r) => n + r.hours, 0);
  return { rows, founderHours, founderEur: founderHours * hourValueEur, weekends: founderHours / WEEKEND_HOURS, bdrHours, extraDials: Math.round(bdrHours * DIALS_PER_BDR_HOUR) };
};
