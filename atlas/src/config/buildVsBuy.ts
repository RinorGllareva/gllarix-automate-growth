/**
 * Build or buy (spec/backbone/09 ROI test: "Build in-house: hours × €700/day vs the tool over 12 months; build core IP,
 * buy commodity"). What Atlas already replaces, how each current subscription should be treated, and the calculator maths.
 * Tool names are examples of the category; prices are never assumed here: they come from your own expenses or input.
 */

/** €700 a day ÷ 8 hours (spec/backbone/09). */
export const HOUR_VALUE_EUR = 87.5;
/** Rinor's delivery hours on a weekend (spec/backbone/04 delivery capacity). */
export const WEEKEND_HOURS = 7.5;

export const BUILT_IN_ATLAS: { capability: string; instead: string; to: string }[] = [
  { capability: "CRM, leads and pipeline", instead: "HubSpot, Pipedrive, Zoho CRM, Notion CRM", to: "/leads" },
  { capability: "Call queue, script and call logging", instead: "Close, Aircall power dialers (the phone line itself stays Twilio)", to: "/call" },
  { capability: "Outreach cadences and email templates", instead: "Apollo sequences, Lemlist, Instantly (sending stays on Workspace)", to: "/cadences" },
  { capability: "Booking page", instead: "Calendly", to: "/meetings" },
  { capability: "Quotes, price book and click-to-accept", instead: "PandaDoc, Proposify (e-signed contracts still to do)", to: "/deals" },
  { capability: "Tasks, projects and AI planner", instead: "ClickUp, Asana, Notion", to: "/tasks" },
  { capability: "Time tracking and timesheets", instead: "Toggl, Harvest, Clockify", to: "/time" },
  { capability: "Client usage, monthly reports and invoices", instead: "Custom reports, usage-billing add-ons", to: "/clients" },
  { capability: "Dashboards against targets", instead: "Databox, Geckoboard", to: "/reports" },
  { capability: "Call reviews and coaching scorecards", instead: "Gong, Chorus", to: "/team" },
  { capability: "Hiring pipeline and scorecards", instead: "Workable, Breezy", to: "/hiring" },
  { capability: "Training program with gates", instead: "An LMS", to: "/training" },
  { capability: "Cash, runway and financial plan", instead: "Finance dashboards, spreadsheets", to: "/finance" },
  { capability: "Inbound inbox with speed-to-lead", instead: "Shared inboxes, form tools' lead routing", to: "/inbound" },
  { capability: "AI co-founder on your own data", instead: "Seats on generic AI tools that can't see Atlas", to: "/advisor" },
];

export type Verdict = "keep" | "replace" | "review";

/** How to treat a subscription, by what it is. First match wins. */
export const SUBSCRIPTION_RULES: { match: RegExp; verdict: Verdict; reason: string; to?: string }[] = [
  { match: /workspace|gmail|google/i, verdict: "keep", reason: "Email and calendar infrastructure: not worth rebuilding" },
  { match: /supabase|vercel|hosting|sentry|domain/i, verdict: "keep", reason: "Atlas runs on it" },
  { match: /twilio|dialer|number|telephony/i, verdict: "keep", reason: "Phone carrier: regulated and per minute; Atlas uses it for calls" },
  { match: /demo line|usage|voice|retell|vapi/i, verdict: "keep", reason: "Cost of sales, covered by client fees" },
  { match: /lead data|places|registry|zefix|companies house/i, verdict: "keep", reason: "Data we can't make ourselves; watch it against the monthly cap" },
  { match: /wise|payoneer|stripe|fees/i, verdict: "keep", reason: "Payment rails" },
  { match: /bdr|setter|closer|freelanc|contractor|salary/i, verdict: "keep", reason: "People, not software" },
  { match: /record|gong|chorus/i, verdict: "replace", reason: "Record calls through Twilio inside the call workspace (part of the real-calling work); cancel when it's live", to: "/call" },
  { match: /calendly|booking|savvycal/i, verdict: "replace", reason: "Atlas has a booking page per seller", to: "/meetings" },
  { match: /notion|clickup|asana|monday|trello/i, verdict: "replace", reason: "Atlas Tasks, planner and imports from Notion", to: "/tasks" },
  { match: /hubspot|pipedrive|zoho|close\.com|crm/i, verdict: "replace", reason: "Atlas is the CRM", to: "/leads" },
  { match: /toggl|harvest|clockify/i, verdict: "replace", reason: "Atlas time tracking", to: "/time" },
  { match: /lemlist|instantly|apollo|mailchimp|sequence/i, verdict: "replace", reason: "Atlas cadences (sending stays on Workspace)", to: "/cadences" },
  { match: /pandadoc|docusign|proposify/i, verdict: "review", reason: "Quotes are in Atlas; keep e-signature only until contracts are built" },
];

export const verdictFor = (vendor: string) => SUBSCRIPTION_RULES.find((r) => r.match.test(vendor)) ?? { verdict: "review" as Verdict, reason: "No rule yet: run the build-or-buy check below", to: undefined };

export interface BuildInput {
  /** Price per seat per month (EUR). */
  priceEur: number;
  seats: number;
  buildHours: number;
  /** Fixes, updates, support per month. */
  maintainHoursPerMonth: number;
  hourValueEur: number;
  /** Core IP (how we win) or commodity. */
  core: boolean;
}

export const buildVsBuy = (i: BuildInput) => {
  const buyMonthly = i.priceEur * i.seats;
  const buildOnce = i.buildHours * i.hourValueEur;
  const maintainMonthly = i.maintainHoursPerMonth * i.hourValueEur;
  const savingMonthly = buyMonthly - maintainMonthly;
  const breakEvenMonths = savingMonthly > 0 ? buildOnce / savingMonthly : null;
  const buy12 = buyMonthly * 12;
  const build12 = buildOnce + maintainMonthly * 12;
  const weekends = i.buildHours / WEEKEND_HOURS;
  // Core IP pays back within a year; commodity only if it's quick (6 months) — otherwise buy it.
  const limit = i.core ? 12 : 6;
  const verdict: "build" | "buy" | "later" =
    breakEvenMonths === null ? "buy" : breakEvenMonths <= limit ? "build" : i.core ? "later" : "buy";
  return { buyMonthly, buildOnce, maintainMonthly, savingMonthly, breakEvenMonths, buy12, build12, weekends, verdict, limit };
};
