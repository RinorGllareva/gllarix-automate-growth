/**
 * Operations plan (spec/backbone/04) and inbound speed-to-lead (spec/backbone/10). Static parts of the plan live here;
 * SOP status and rhythm ticks are data. Keep in sync with the spec.
 */
import { isoWeekKey } from "@/services/time";

/** Proposed speed-to-lead target for inbound requests (minutes, in business hours). Confirm with the founders. */
export const INBOUND_RESPONSE_TARGET_MIN = 15;

export const PEOPLE_STAGE1 = [
  { who: "Rinor", owns: "Architecture, Gllarix and Arcadian delivery builds, code review, weekly context update", hours: "Sat–Sun, ~12 h", tools: "GitHub, Codex, voice platform, Atlas admin" },
  { who: "Co-founder", owns: "Operations, European and developer sales, BDR coaching, finance close, hiring, compliance", hours: "Mon–Fri 08:00–15:00 CET", tools: "Atlas, Stripe, Workspace" },
  { who: "BDR", owns: "US trades calling, booking and closing standard offers, first-line client support in US hours", hours: "Mon–Fri 08:00–16:00 VET", tools: "Atlas call workspace, demo line" },
  { who: "Codex agent", owns: "Code for Atlas milestones and automations", hours: "Continuous", tools: "Repo, AGENTS.md" },
  { who: "Freelance 3D artist", owns: "3D models for Arcadian projects", hours: "Per project", tools: "Brief + files from the co-founder" },
  { who: "Accountant, lawyer (to find)", owns: "Tax, entity, contracts, country rules, AI Act and GDPR checks", hours: "As needed", tools: "—" },
];

export type Cadence = "daily" | "weekly" | "monthly" | "quarterly";

/** The operating rhythm. `auto` items happen without anyone ticking them (shown, not ticked). */
export const RHYTHM: { key: string; when: string; what: string; who: string; time: string; cadence: Cadence; weekday?: number; auto?: boolean; href?: string }[] = [
  { key: "coaching", when: "Daily 13:00–15:00 CET", what: "BDR coaching overlap: yesterday's calls, today's plan, early US calls", who: "Co-founder + BDR", time: "30–60 min", cadence: "daily", href: "/team" },
  { key: "daily_report", when: "Daily, end of shift", what: "Daily report generated in Atlas (activity, meetings, blockers)", who: "BDR (auto)", time: "0", cadence: "daily", auto: true, href: "/reports" },
  { key: "eu_outreach", when: "Daily 09:00–11:00 CET", what: "European and developer outreach block", who: "Co-founder", time: "2 h", cadence: "daily", href: "/call" },
  { key: "monday_briefing", when: "Monday 07:00", what: "Read the AI Monday briefing: KPIs, gates, risks, top 3 tasks", who: "Auto → both", time: "10 min read", cadence: "weekly", weekday: 1, href: "/advisor" },
  { key: "codex_task", when: "Wednesday", what: "Write next week's Codex task; triage feedback issues", who: "Co-founder", time: "20 min", cadence: "weekly", weekday: 3, href: "/tasks" },
  { key: "weekly_review", when: "Friday", what: "Weekly review: KPIs vs targets, pipeline, tasks; owners update the backbone files", who: "Co-founder", time: "30 min", cadence: "weekly", weekday: 5, href: "/reports" },
  { key: "saturday", when: "Saturday", what: "Review and merge PRs, deploy, BDR 1:1 (30 min), delivery work", who: "Rinor", time: "3–4 h + delivery", cadence: "weekly", weekday: 6, href: "/team" },
  { key: "sunday", when: "Sunday", what: "Context update, decision log, release notes to the BDR", who: "Rinor", time: "30 min", cadence: "weekly", weekday: 0 },
  { key: "month_close", when: "1st of the month", what: "Month-end close, gate check, capacity review", who: "Co-founder", time: "1.5 h", cadence: "monthly", href: "/finance" },
  { key: "quarterly", when: "Quarterly", what: "Prices, ICP, scripts and scoring review; update the scenarios", who: "Both", time: "2 h", cadence: "quarterly", href: "/plan" },
];

/** The period a rhythm item is ticked for (today, this ISO week, this month, this quarter). */
export const periodKey = (cadence: Cadence, today: string) => {
  if (cadence === "daily") return today;
  if (cadence === "weekly") return isoWeekKey(today);
  if (cadence === "monthly") return today.slice(0, 7);
  return `${today.slice(0, 4)}-Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
};

export const SOP_SEED = [
  { num: 1, title: "Lead to meeting", covers: "List build → scoring → queue → call → outcome → booking → approved-meeting check", owner: "Co-founder", due: "2026-10-18" },
  { num: 2, title: "Meeting to cash", covers: "Discovery → demo line → quote from the price book → terms → deposit → handoff", owner: "Co-founder", due: "2026-10-18" },
  { num: 3, title: "Gllarix onboarding", covers: "Intake form → agent config from template → number forwarding → 10 test calls → go-live → first-week check", owner: "Rinor", due: "2026-10-25" },
  { num: 4, title: "Support", covers: "Channels, response times, escalation from the BDR to Rinor, outages", owner: "Co-founder", due: "2026-10-25" },
  { num: 5, title: "Arcadian 3D delivery", covers: "Scope → files → freelancer brief → model review → unit picker → landing page → client approval → hosting", owner: "Rinor", due: "2026-11-15" },
  { num: 6, title: "Landing page delivery", covers: "Template → client copy → build → QA → deploy → care plan", owner: "Rinor", due: "2026-11-15" },
  { num: 7, title: "Month-end close", covers: "The financial plan's month-end steps", owner: "Co-founder", due: "2026-11-01" },
  { num: 8, title: "Hiring and onboarding a rep", covers: "The people plan's hiring steps", owner: "Co-founder", due: "2026-10-02" },
  { num: 9, title: "Compliance checks", covers: "Country rules, opt-out, AI disclosure, recording notice, US SMS registration, data retention", owner: "Co-founder", due: "2026-10-25" },
  { num: 10, title: "Offboarding a client", covers: "Cancel, final invoice, number release, data export and deletion", owner: "Co-founder", due: "2026-12-15" },
];

export const SOP_FORMAT = "Owner · trigger · inputs · steps · response time · output · KPI · automation opportunity · escalation";

export const SERVICE_LEVELS = [
  { issue: "Receptionist down / not answering", first: "1 h in client business hours", fix: "4 h" },
  { issue: "Wrong answers or bookings", first: "Same business day", fix: "2 business days" },
  { issue: "Change request", first: "1 business day", fix: "Next weekend release" },
  { issue: "Billing question", first: "1 business day", fix: "3 business days" },
];

export const DELIVERY_CAPACITY = [
  { work: "Gllarix setup (templated)", hours: "3 h target (6 h first ones)", capacity: "Rinor ~7–8 h a weekend", limit: "~2 setups a weekend" },
  { work: "Gllarix monthly support", hours: "~0.5–1 h per client", capacity: "—", limit: "~10 clients before strain" },
  { work: "Landing page (template)", hours: "6–20 h", capacity: "—", limit: "1 per weekend" },
  { work: "3D building / platform", hours: "30 h / 60 h + freelancer", capacity: "—", limit: "1 platform a month with a freelancer" },
  { work: "Custom software", hours: "Per day at €700", capacity: "—", limit: "Only when there's slack" },
];

export const COMPLIANCE_OPS = [
  { area: "Outreach by country", rule: "Allowed channels and hours per market; unverified markets show a warning", owner: "Co-founder", where: "Atlas country rules", href: "/admin/country-rules" },
  { area: "Opt-out", rule: "One list across both brands and all channels, checked before every queue and send", owner: "System", where: "Atlas", href: "/admin/opt-out" },
  { area: "AI disclosure", rule: "Every AI agent says it's an AI", owner: "Rinor", where: "Agent prompts" },
  { area: "Call recording notice", rule: "At the start of every recorded call", owner: "BDR script", where: "Script + QA" },
  { area: "US SMS", rule: "A2P 10DLC registration for demo and client numbers", owner: "Rinor", where: "Twilio" },
  { area: "Data protection", rule: "Lawful basis per lead; export and delete on request; delete dead leads after 12 months", owner: "System", where: "Atlas", href: "/admin/country-rules" },
  { area: "Claims", rule: "No unproven claims", owner: "Everyone", where: "Scripts, website", href: "/marketing" },
  { area: "Contracts", rule: "Client terms, contractor and freelancer agreements", owner: "Co-founder + lawyer", where: "—" },
];

export const VENDORS = [
  { vendor: "Voice platform (Retell or Vapi, to choose)", use: "Gllarix agents", owner: "Rinor", review: "Monthly cost per minute" },
  { vendor: "Twilio", use: "Numbers, calls, SMS", owner: "Rinor", review: "Monthly" },
  { vendor: "Supabase, hosting, Sentry", use: "Atlas", owner: "Rinor", review: "Quarterly" },
  { vendor: "Google Workspace", use: "Email, calendar", owner: "Co-founder", review: "Yearly" },
  { vendor: "Stripe", use: "Payments", owner: "Co-founder", review: "Monthly" },
  { vendor: "Lead data (Places API, registries)", use: "Lead gen", owner: "Co-founder", review: "Monthly vs cap" },
  { vendor: "Freelance 3D artist", use: "Arcadian", owner: "Co-founder", review: "Per project" },
];

export const RISKS = [
  { risk: "Rinor's weekends overloaded", chance: "High", impact: "High", owner: "Rinor", mitigation: "Codex builds, co-founder reviews; implementer at Gate 2" },
  { risk: "BDR power or internet outages (Venezuela)", chance: "Medium", impact: "Medium", owner: "Co-founder", mitigation: "Hiring criterion: UPS + mobile data; paper backup log" },
  { risk: "Legal issue from outreach", chance: "Medium", impact: "High", owner: "Co-founder", mitigation: "Country rules verified by counsel; manual dialing; opt-out" },
  { risk: "Voice platform outage", chance: "Low", impact: "High", owner: "Rinor", mitigation: "Status alerts; fallback to the client's voicemail forward" },
  { risk: "One big client dominates revenue", chance: "Medium", impact: "Medium", owner: "Co-founder", mitigation: "No client above 25% of MRR" },
  { risk: "Key-person risk (Rinor)", chance: "Medium", impact: "High", owner: "Both", mitigation: "docs/RUNBOOK.md, credentials in a shared password manager" },
];
