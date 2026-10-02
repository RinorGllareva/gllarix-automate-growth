/**
 * Default email and LinkedIn templates for the cadences in config/queue.ts, plus transactional emails.
 * DRAFTS: facts come only from the price book and the messaging kit (backbone/10). Anything that needs real content is a
 * [TO WRITE: …] placeholder, and the sender refuses to send a message that still contains one.
 * Admins edit them in Admin › Cadences › Templates. Every template must contain {{unsubscribe_url}}.
 */
export interface TemplateDef {
  key: string;
  name: string;
  channel: "email" | "linkedin";
  /** Which list uses it ("any" for transactional emails). */
  list: "trades" | "developers" | "any";
  /** Requested or transactional (booking, reminders, info the contact asked for): skips cold-email country rules. */
  transactional: boolean;
  subject: string;
  body: string;
}

export const TEMPLATE_VARIABLES = [
  { key: "contact.first_name", hint: "Contact's first name, or \"there\"" },
  { key: "company.name", hint: "Company name" },
  { key: "company.trade", hint: "Trade, e.g. HVAC" },
  { key: "bdr.name", hint: "Lead owner's first name" },
  { key: "offer.name", hint: "Lead offer for the list" },
  { key: "offer.price", hint: "Lead offer list price in the lead's market" },
  { key: "demo_number", hint: "Live demo line (Admin › Settings)" },
  { key: "booking_url", hint: "Owner's booking page" },
  { key: "meeting.time", hint: "Meeting time in the lead's local time" },
  { key: "quote_url", hint: "Link to the client's quote page" },
  { key: "report_url", hint: "Link to the client's monthly results report (PDF)" },
  { key: "report.period", hint: "Report month, e.g. November 2026" },
  { key: "report.calls", hint: "Calls answered in the month" },
  { key: "report.after_hours", hint: "After-hours calls captured" },
  { key: "report.booked", hint: "Jobs booked" },
  { key: "report.missed", hint: "Missed calls" },
  { key: "footer_address", hint: "Postal address (CAN-SPAM)" },
  { key: "unsubscribe_url", hint: "One-click unsubscribe link (required)" },
] as const;

const FOOTER = "\n\n—\n{{footer_address}}\nDon't want these emails? Unsubscribe: {{unsubscribe_url}}";

export const DEFAULT_TEMPLATES: TemplateDef[] = [
  {
    key: "trades_intro",
    name: "Trades · day 1 intro",
    channel: "email",
    list: "trades",
    transactional: false,
    subject: "{{company.name}}: who answers when you're on a job?",
    body:
      "Hi {{contact.first_name}},\n\nWhen your team is out on a job, who picks up the phone?\n\nGllarix answers your calls, books jobs into your calendar and texts back anyone who couldn't get through. It tells callers it's an AI.\n\nTry to trip it up: call our demo line on {{demo_number}}.\n\n{{bdr.name}}\nGllarix" +
      FOOTER,
  },
  {
    key: "trades_proof",
    name: "Trades · day 6 proof",
    channel: "email",
    list: "trades",
    transactional: false,
    subject: "What a missed call costs {{company.name}}",
    body: "Hi {{contact.first_name}},\n\n[TO WRITE: pilot #1's real results once the case study exists]\n\nWorth a 15-minute look?\n\n{{bdr.name}}\nGllarix" + FOOTER,
  },
  {
    key: "trades_breakup",
    name: "Trades · day 10 last email",
    channel: "email",
    list: "trades",
    transactional: false,
    subject: "Should I close your file?",
    body:
      "Hi {{contact.first_name}},\n\nI haven't heard back, so I'll assume answering calls isn't a problem right now. If that changes, reply to this email and I'll pick it up.\n\n{{bdr.name}}\nGllarix" +
      FOOTER,
  },
  {
    key: "dev_connect",
    name: "Developers · day 1 LinkedIn connect",
    channel: "linkedin",
    list: "developers",
    transactional: false,
    subject: "LinkedIn note (sent by hand)",
    body: "Hi {{contact.first_name}}, I work with developers on selling off-plan units with 3D. Would be glad to connect.\n\n(LinkedIn notes are sent by hand. {{unsubscribe_url}} is kept for the template rule only.)",
  },
  {
    key: "dev_intro",
    name: "Developers · day 1 intro",
    channel: "email",
    list: "developers",
    transactional: false,
    subject: "{{company.name}}: selling off-plan in 3D",
    body:
      "Hi {{contact.first_name}},\n\nWe help developers sell off-plan faster: buyers walk the building in 3D and pick a unit with live availability.\n\nCan I send a 90-second example?\n\n{{bdr.name}}\nArcadian" +
      FOOTER,
  },
  {
    key: "dev_3d_teaser",
    name: "Developers · day 8 3D teaser",
    channel: "email",
    list: "developers",
    transactional: false,
    subject: "A 90-second example for {{company.name}}",
    body: "Hi {{contact.first_name}},\n\nHere's the example I mentioned: [TO WRITE: link to the 90-second 3D example]\n\n{{bdr.name}}\nArcadian" + FOOTER,
  },
  {
    key: "dev_breakup",
    name: "Developers · day 14 last email",
    channel: "email",
    list: "developers",
    transactional: false,
    subject: "Closing the loop",
    body: "Hi {{contact.first_name}},\n\nI'll stop here. If 3D sales tools become relevant for your next launch, reply and I'll send the example.\n\n{{bdr.name}}\nArcadian" + FOOTER,
  },
  {
    key: "nurture_checkin",
    name: "Nurture · check-in (90 days)",
    channel: "email",
    list: "any",
    transactional: false,
    subject: "Checking in, {{contact.first_name}}",
    body: "Hi {{contact.first_name}},\n\nWe spoke a while ago about {{offer.name}}. Has anything changed on your side? Happy to show it in 15 minutes: {{booking_url}}\n\n{{bdr.name}}" + FOOTER,
  },
  {
    key: "send_info",
    name: "Info you asked for (after a call)",
    channel: "email",
    list: "any",
    transactional: true,
    subject: "The info you asked for · {{offer.name}}",
    body:
      "Hi {{contact.first_name}},\n\nThanks for the call. As promised, here's the short version:\n\n{{offer.name}} · {{offer.price}}\n\nWhen's a good time for a 15-minute walkthrough? You can pick a slot here: {{booking_url}}\n\n{{bdr.name}}" +
      FOOTER,
  },
  {
    key: "quote_sent",
    name: "Your quote",
    channel: "email",
    list: "any",
    transactional: true,
    subject: "Your quote · {{offer.name}}",
    body:
      "Hi {{contact.first_name}},\n\nAs discussed, here's your quote: {{quote_url}}\n\nYou can read the details, accept the terms and pay the deposit on that page. The quote is valid for 30 days.\n\n{{bdr.name}}" +
      FOOTER,
  },
  {
    key: "client_report",
    name: "Monthly client results",
    channel: "email",
    list: "any",
    transactional: true,
    subject: "Your {{report.period}} results · {{company.name}}",
    body:
      "Hi {{contact.first_name}},\n\nHere's what your AI receptionist did in {{report.period}}:\n\n· Calls answered: {{report.calls}}\n· After-hours calls captured: {{report.after_hours}}\n· Jobs booked: {{report.booked}}\n· Missed: {{report.missed}}\n\nThe full report (save it as a PDF): {{report_url}}\n\n{{bdr.name}}" +
      FOOTER,
  },
  {
    key: "no_show",
    name: "No-show follow-up",
    channel: "email",
    list: "any",
    transactional: false,
    subject: "Sorry we missed you",
    body: "Hi {{contact.first_name}},\n\nWe missed each other today. Want to pick a new time? {{booking_url}}\n\n{{bdr.name}}" + FOOTER,
  },
  {
    key: "booking_confirmation",
    name: "Booking confirmed",
    channel: "email",
    list: "any",
    transactional: true,
    subject: "Confirmed: {{meeting.time}}",
    body: "Hi {{contact.first_name}},\n\nYou're booked with {{bdr.name}} on {{meeting.time}}. Need another time? {{booking_url}}\n\n(Calendar invite to follow.)" + FOOTER,
  },
  {
    key: "reminder_24h",
    name: "Reminder · 24 hours before",
    channel: "email",
    list: "any",
    transactional: true,
    subject: "Tomorrow: {{meeting.time}}",
    body: "Hi {{contact.first_name}},\n\nA reminder that we're meeting on {{meeting.time}}. Need another time? {{booking_url}}\n\n{{bdr.name}}" + FOOTER,
  },
  {
    key: "reminder_1h",
    name: "Reminder · 1 hour before",
    channel: "email",
    list: "any",
    transactional: true,
    subject: "In an hour: {{meeting.time}}",
    body: "Hi {{contact.first_name}},\n\nSee you in an hour ({{meeting.time}}).\n\n{{bdr.name}}" + FOOTER,
  },
];

/** Fake sending inboxes for demo mode (reserved .test domain). Daily caps ramp up during warm-up. */
export const DEFAULT_INBOXES = [
  { id: "ib-g1", address: "diego@outreach-gllarix.test", brand: "gllarix" as const, senderName: "Diego · Gllarix", dailyCap: 40, warmupStart: 10, warmupStep: 5 },
  { id: "ib-g2", address: "team@outreach-gllarix.test", brand: "gllarix" as const, senderName: "Gllarix", dailyCap: 40, warmupStart: 10, warmupStep: 5 },
  { id: "ib-a1", address: "artin@outreach-arcadian.test", brand: "arcadian" as const, senderName: "Artin · Arcadian", dailyCap: 30, warmupStart: 10, warmupStep: 5 },
];

/** Cold emails go out on business days in this lead-local window (assumption; docs/QUESTIONS.md). */
export const EMAIL_SEND_WINDOW = "08:00-17:00";
