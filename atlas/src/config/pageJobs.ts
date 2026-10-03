/**
 * Every page has a job for each role that can open it: what the person comes to do, and the decision or action it
 * leads to. A role with no job on a page doesn't get the page (see ACCESS in lib/nav.ts). Shown as a one-line
 * "why you're here" under the top bar, so nobody wonders what a page is for.
 */
import type { Role } from "@/data/types";

export interface PageJob {
  /** What you come here to do (one line, starts with a verb). */
  job: string;
  /** The decision or action it should end in. */
  outcome: string;
}

/** Page key (nav id, or a standalone route key) → role → job. Founders are role "admin". */
export const PAGE_JOBS: Record<string, Partial<Record<Role, PageJob>>> = {
  today: {
    admin: { job: "See the team's day and everything waiting for a founder", outcome: "Clear the decisions list before lunch" },
    bdr: { job: "Start the shift: your queue, callbacks, inbound and what you've earned", outcome: "Press Start calling" },
    closer: { job: "Start the day: meetings, callbacks and deals to close", outcome: "Know your first three calls" },
  },
  inbound: {
    admin: { job: "Make sure every website form and demo-line call gets an answer fast", outcome: "Nothing waits longer than 15 minutes" },
    bdr: { job: "Answer website forms, demo-line calls and referrals before they go cold", outcome: "Reply, then make it a lead" },
    closer: { job: "Pick up inbound requests that are ready to buy", outcome: "Reply and book the meeting" },
  },
  call: {
    admin: { job: "Call from your own queue with the script and the lead's history", outcome: "Log the outcome; book the meeting" },
    bdr: { job: "Call one lead at a time with the script, objections and history in front of you", outcome: "Log the outcome; book the meeting" },
    closer: { job: "Run your calls and callbacks", outcome: "Log the outcome; move the deal" },
  },
  leads: {
    admin: { job: "Import, assign and clean the lists", outcome: "A full queue of A/B leads for tomorrow" },
    bdr: { job: "Look up a lead before a callback or when someone calls back", outcome: "Open the lead and call" },
    closer: { job: "Look up a company and its history", outcome: "Open the lead or its deal" },
  },
  pipeline: {
    admin: { job: "See what's stuck and what will close this month", outcome: "Unblock the oldest deals" },
    bdr: { job: "Move your deals forward after each call", outcome: "Drag the deal to its new stage" },
    closer: { job: "Move your deals to won", outcome: "Drag the deal to its new stage" },
    viewer: { job: "Read the open pipeline value for the books", outcome: "Note the expected revenue" },
  },
  meetings: {
    admin: { job: "Approve held meetings (each approved one pays the $15 bonus)", outcome: "Approve or reject with the 6 checks" },
    bdr: { job: "See your bookings and mark each one held or no-show", outcome: "Mark it the same day" },
    closer: { job: "Prepare and run today's meetings", outcome: "Mark it held; open the deal" },
  },
  deals: {
    admin: { job: "Approve discounts and check the margin on quotes", outcome: "Approve, or send it back" },
    bdr: { job: "Build the quote from the price book and send it", outcome: "Send the quote; ask for the deposit" },
    closer: { job: "Quote, follow up and get the deposit", outcome: "Deposit paid → won" },
  },
  clients: {
    admin: { job: "Watch client health, usage and invoices", outcome: "Call any client under 60 health within 48 h" },
    implementer: { job: "Take each new client from deposit to go-live", outcome: "Tick the onboarding steps; go live within 7 days" },
  },
  reports: {
    admin: { job: "Check the week against the targets and the €10k plan", outcome: "Pick the one number to fix next week" },
    viewer: { job: "Read the monthly numbers for the books", outcome: "Export the month" },
  },
  tasks: {
    admin: { job: "Plan and track the company's work", outcome: "Everyone knows their next task" },
    bdr: { job: "See the tasks you own (follow-ups, onboarding asks)", outcome: "Close today's tasks" },
    closer: { job: "See the tasks you own", outcome: "Close today's tasks" },
    implementer: { job: "Work through onboarding and delivery tasks", outcome: "Close today's tasks" },
  },
  time: {
    admin: { job: "Log hours so client work is billed and estimates get better", outcome: "Submit the week" },
    bdr: { job: "Clock your shift (optional; your pay doesn't depend on it)", outcome: "Start and stop the timer" },
    closer: { job: "Log time on client work", outcome: "Submit the week" },
    implementer: { job: "Log setup and delivery hours per client", outcome: "Submit the week" },
  },
  team: {
    admin: { job: "Coach: scorecards, call reviews and 1:1 agendas", outcome: "One thing to practise per person this week" },
    bdr: { job: "See your scorecard, call reviews and the 1:1 agenda", outcome: "Know what to practise this week" },
    closer: { job: "See your scorecard and call reviews", outcome: "Know what to practise this week" },
  },
  advisor: {
    admin: { job: "Ask money, hiring and strategy questions; every answer shows its sources", outcome: "Log the decision or create the tasks" },
    bdr: { job: "Prepare for a meeting or an objection", outcome: "Walk into the call with a plan" },
    closer: { job: "Prepare for a meeting or a negotiation", outcome: "Walk into the call with a plan" },
  },
  finance: {
    admin: { job: "Log costs and cash; check the runway", outcome: "Stay above the €3,000 reserve" },
    viewer: { job: "Reconcile expenses and cash balances", outcome: "Books match the bank" },
  },
  payments: {
    admin: { job: "See cash in and chase late invoices", outcome: "Every late invoice has a next step" },
    viewer: { job: "Match Stripe payments to invoices", outcome: "Books match Stripe" },
  },
  plan: { admin: { job: "Test a hire, a price or a slower month before deciding", outcome: "Decide with the cash curve in front of you" } },
  roi: { admin: { job: "Decide if a spend, a tool or a build is worth it", outcome: "Log it with a stop rule, or don't buy it" } },
  prices: { admin: { job: "Keep the price book every quote uses up to date", outcome: "Quotes always use current prices" } },
  commissions: {
    admin: { job: "Check what each person earned before the 5th", outcome: "Approve the payout statements" },
    bdr: { job: "See what you've earned and when it's paid", outcome: "No surprises on payday" },
    closer: { job: "See what you've earned and when it's paid", outcome: "No surprises on payday" },
    viewer: { job: "Pay the monthly statements", outcome: "Everyone paid by the 5th" },
  },
  kpis: { admin: { job: "See every role against its targets", outcome: "Fix the script/list, or talk to the person" } },
  hiring: { admin: { job: "Run candidates through the hiring steps and the scorecard", outcome: "Hire only when the gate is passed" } },
  training: {
    admin: { job: "Run each new hire's 10-day program", outcome: "Pass a gate only with the evidence" },
    bdr: { job: "See your next training gate and what it needs", outcome: "Pass the gate" },
    closer: { job: "See your next training gate", outcome: "Pass the gate" },
  },
  automations: { admin: { job: "See the hours Atlas gives back, and turn any step you repeat into a rule", outcome: "Fewer things to remember, fewer tools to pay" } },
  cadences: { admin: { job: "Edit the outreach steps and email templates", outcome: "Every lead gets the right next touch" } },
  marketing: {
    admin: { job: "Build inbound, run tests with stop rules, keep the claims honest", outcome: "Only spend on tests that pass" },
    bdr: { job: "Copy the opener, proof line and objection answers", outcome: "Say it the same way on every call" },
    closer: { job: "Copy the messaging and objection answers", outcome: "Say it the same way on every call" },
  },
  markets: { admin: { job: "Choose markets and keep competitor prices current", outcome: "Know where to sell and how we win" } },
  ops: {
    admin: { job: "Run the weekly rhythm and get the SOPs written", outcome: "Nothing in the routine is missed" },
    bdr: { job: "See the routine, the service levels and the SOPs you follow", outcome: "Know who does what and when" },
    closer: { job: "See the routine and the SOPs you follow", outcome: "Know who does what and when" },
    implementer: { job: "Check the onboarding SOP and service levels", outcome: "Deliver to the SOP" },
  },
  support: {
    admin: { job: "See that no client waits past the promised reply or fix time", outcome: "Every ticket inside its service level" },
    implementer: { job: "Answer and fix client issues, most urgent first", outcome: "Every ticket answered and fixed in time" },
  },
  docs: {
    admin: { job: "Keep the handbook, playbooks and SOPs in one place, and finish the move off Notion", outcome: "One source for how we work" },
    bdr: { job: "Look up the playbook, the routine or an SOP", outcome: "Answer your own how-do-I question" },
    closer: { job: "Look up the playbook and the offer details", outcome: "Answer your own how-do-I question" },
    implementer: { job: "Follow and improve the delivery SOPs", outcome: "Every setup done the same way" },
    viewer: { job: "Find the finance and month-end procedures", outcome: "Close the month the agreed way" },
  },
  agent: { admin: { job: "Let an AI call back inbound requests in minutes and book them with a human", outcome: "No inbound request waits for a call" } },
  tracker: {
    admin: { job: "Prepare each seller's Saturday 1:1 from the week's numbers", outcome: "One clear focus per person for next week" },
    bdr: { job: "See your week the way a founder sees it, before the 1:1", outcome: "Know the one thing to fix next week" },
    closer: { job: "See your week the way a founder sees it, before the 1:1", outcome: "Know the one thing to fix next week" },
  },
  admin: { admin: { job: "Set users, rules, scoring and integrations", outcome: "Atlas works the way the company does" } },
};

export const jobFor = (pageKey: string | null | undefined, role: Role): PageJob | null => (pageKey ? (PAGE_JOBS[pageKey]?.[role] ?? null) : null);
