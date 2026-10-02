import { dispositionByKey, type DispositionKey } from "@/config/dispositions";
import type { Stage } from "@/config/leads";
import { QUEUE } from "@/config/queue";
import type { Company, Lead } from "@/data/leadTypes";
import type { OutcomeInput } from "@/data/queueTypes";
import { addBusinessDays, localDateKey, localHHMM, parseWindow, shiftDateKey, zonedToUtc, zoneAbbr } from "./time";

export interface OutcomePlan {
  stage: Stage;
  statusReason: string | null;
  nextActionAt: string | null;
  nextActionType: string | null;
  attemptsCount: number;
  cadenceStartedAt: string | null;
  /** Mark the primary contact's phone invalid (wrong number). */
  phoneInvalid: boolean;
  /** Add the lead's phones and emails to the opt-out list (do not contact). */
  suppress: boolean;
  /** Create a meeting (meeting booked). */
  meeting: OutcomeInput["meeting"] | null;
  /** Extra timeline entries, e.g. the queued info email. */
  extraActivities: { type: "email" | "meeting"; title: string; detail: string | null }[];
  /** One line for the toast and the activity detail: "Next: call Thu 07:00 ET". */
  message: string;
}

const NEXT_DAYS_AFTER_SEND_INFO = 2;
const NURTURE_DAYS = 90;

/** First primary calling window of the list, at its start, on a lead-local date. */
const windowStart = (lead: Lead, dateKey: string, tz: string, which = 0) => {
  const windows = QUEUE.windows[lead.listType].call;
  const [start] = parseWindow(windows[Math.min(which, windows.length - 1)]);
  return zonedToUtc(dateKey, start, tz);
};

const fmt = (at: number, tz: string) =>
  `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(at)} ${localHHMM(at, tz)} ${zoneAbbr(tz)}`;

/**
 * What happens after an outcome (A7 / 03_CALL_WORKSPACE.md). Pure: the data layer applies the plan.
 */
export const planOutcome = (lead: Lead, company: Company, input: OutcomeInput, now: number): OutcomePlan => {
  const disposition = dispositionByKey(input.disposition);
  if (!disposition) throw new Error(`Unknown outcome: ${input.disposition}`);
  const tz = company.timezone ?? "UTC";
  const today = localDateKey(now, tz);
  const attemptsCount = lead.attemptsCount + (disposition.attempt ? 1 : 0);
  const cadenceStartedAt = lead.cadenceStartedAt ?? new Date(now).toISOString();
  const firstTouchStage: Stage = lead.stage === "new" || lead.stage === "researched" ? "contacted" : lead.stage;

  const plan: OutcomePlan = {
    stage: firstTouchStage,
    statusReason: lead.statusReason,
    nextActionAt: null,
    nextActionType: null,
    attemptsCount,
    cadenceStartedAt,
    phoneInvalid: false,
    suppress: false,
    meeting: null,
    extraActivities: [],
    message: "",
  };

  const nextCallPerCadence = () => {
    const cadence = QUEUE.cadences[lead.cadenceId ?? QUEUE.cadenceFor[lead.listType]] ?? [];
    const callDays = cadence.filter((s) => s.channel === "call").map((s) => s.day);
    const nextDay = callDays[attemptsCount];
    if (nextDay === undefined) {
      // Cadence finished without a conversation: nurture by email.
      plan.stage = "nurture";
      plan.statusReason = "Cadence finished";
      const at = windowStart(lead, shiftDateKey(today, NURTURE_DAYS), tz);
      plan.nextActionAt = new Date(at).toISOString();
      plan.nextActionType = "email";
      plan.message = `Cadence finished · nurture email ${fmt(at, tz)}`;
      return;
    }
    const startKey = localDateKey(new Date(cadenceStartedAt), tz);
    let dateKey = addBusinessDays(startKey, nextDay - 1);
    if (dateKey <= today) dateKey = addBusinessDays(today, 1);
    const at = windowStart(lead, dateKey, tz);
    plan.nextActionAt = new Date(at).toISOString();
    plan.nextActionType = "call";
    plan.message = `Next: day ${nextDay} call ${fmt(at, tz)}`;
  };

  switch (input.disposition as DispositionKey) {
    case "no_answer":
    case "voicemail":
      nextCallPerCadence();
      break;

    case "gatekeeper": {
      // Next business day, in the other primary window from the one just tried.
      const windows = QUEUE.windows[lead.listType].call;
      const second = windows[1] ? parseWindow(windows[1])[0] : null;
      const triedSecond = second !== null && localHHMM(now, tz) >= second;
      const at = windowStart(lead, addBusinessDays(today, 1), tz, triedSecond ? 0 : 1);
      plan.nextActionAt = new Date(at).toISOString();
      plan.nextActionType = "call";
      plan.message = `Gatekeeper${input.gatekeeperName ? ` (${input.gatekeeperName})` : ""} · retry ${fmt(at, tz)}`;
      break;
    }

    case "wrong_number":
      plan.phoneInvalid = true;
      plan.nextActionAt = new Date(now).toISOString();
      plan.nextActionType = "re_enrich";
      plan.message = "Phone marked invalid · sent to re-enrichment · removed from today";
      break;

    case "not_interested": {
      plan.stage = "nurture";
      plan.statusReason = "Not interested";
      const at = windowStart(lead, shiftDateKey(today, NURTURE_DAYS), tz);
      plan.nextActionAt = new Date(at).toISOString();
      plan.nextActionType = "email";
      plan.message = `Nurture · email ${fmt(at, tz)} where legal`;
      break;
    }

    case "call_back": {
      if (!input.callbackAt) throw new Error("Pick a callback time.");
      const at = new Date(input.callbackAt).getTime();
      if (at <= now) throw new Error("The callback time must be in the future.");
      plan.nextActionAt = new Date(at).toISOString();
      plan.nextActionType = "callback";
      plan.message = `Callback ${fmt(at, tz)}`;
      break;
    }

    case "send_info": {
      const at = windowStart(lead, addBusinessDays(today, NEXT_DAYS_AFTER_SEND_INFO), tz);
      plan.nextActionAt = new Date(at).toISOString();
      plan.nextActionType = "call";
      plan.extraActivities.push({ type: "email", title: "Info email to send", detail: "Sends when the send window and inbox caps allow" });
      plan.message = `Info email queued · call ${fmt(at, tz)}`;
      break;
    }

    case "meeting_booked": {
      if (!input.meeting) throw new Error("Add the meeting date and time.");
      const at = new Date(input.meeting.at).getTime();
      if (at <= now) throw new Error("The meeting must be in the future.");
      plan.stage = "meeting_booked";
      plan.meeting = input.meeting;
      plan.nextActionAt = input.meeting.at;
      plan.nextActionType = "meeting";
      plan.extraActivities.push({ type: "meeting", title: `Meeting booked · ${fmt(at, tz)}`, detail: `${input.meeting.type.replace("_", " ")} · ${input.meeting.withWhom}` });
      plan.message = `Meeting booked ${fmt(at, tz)} · cadence stopped`;
      break;
    }

    case "do_not_contact":
      plan.stage = "lost";
      plan.statusReason = "Opt-out";
      plan.suppress = true;
      plan.message = "Added to the opt-out list · all cadences stopped";
      break;
  }

  return plan;
};
