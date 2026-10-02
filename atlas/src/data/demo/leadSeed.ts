import type { ListType, Stage } from "@/config/leads";
import { scoreLead } from "@/services/scoring";
import { LEAD_OFFER, listPriceMinor, marketForCountry, PRICE_ITEMS } from "@/config/priceBook";
import { MEETING_BONUS_CURRENCY, MEETING_BONUS_MINOR } from "@/config/targets";
import { QUEUE } from "@/config/queue";
import { isBusinessDay, localDateKey, shiftDateKey, zonedToUtc } from "@/services/time";
import type { Commission, Deal, DealStage } from "../salesTypes";
import type { Activity, Company, Contact, Lead, Signal, Source, Suppression } from "../leadTypes";
import type { Meeting } from "../queueTypes";

/**
 * Deterministic fake leads: 500 US trades + 150 developers (AE, GB, CH). Every company is invented.
 * Domains use the reserved .example TLD and phones use fictional ranges (US 555-01xx, Ofcom drama numbers).
 */

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const US_CITIES = [
  ["Charlotte", "NC", "704", "America/New_York"], ["Tampa", "FL", "813", "America/New_York"], ["Atlanta", "GA", "404", "America/New_York"],
  ["Columbus", "OH", "614", "America/New_York"], ["Richmond", "VA", "804", "America/New_York"], ["Orlando", "FL", "407", "America/New_York"],
  ["Raleigh", "NC", "919", "America/New_York"], ["Jacksonville", "FL", "904", "America/New_York"], ["Pittsburgh", "PA", "412", "America/New_York"],
  ["Clearwater", "FL", "727", "America/New_York"], ["Sarasota", "FL", "941", "America/New_York"], ["Savannah", "GA", "912", "America/New_York"],
  ["Nashville", "TN", "615", "America/Chicago"], ["Dallas", "TX", "214", "America/Chicago"], ["Houston", "TX", "713", "America/Chicago"],
  ["San Antonio", "TX", "210", "America/Chicago"], ["Tulsa", "OK", "918", "America/Chicago"], ["Madison", "WI", "608", "America/Chicago"],
  ["Kansas City", "MO", "816", "America/Chicago"], ["Omaha", "NE", "402", "America/Chicago"], ["Memphis", "TN", "901", "America/Chicago"],
  ["Denver", "CO", "303", "America/Denver"], ["Phoenix", "AZ", "602", "America/Phoenix"], ["Albuquerque", "NM", "505", "America/Denver"],
  ["Boise", "ID", "208", "America/Boise"], ["Salt Lake City", "UT", "801", "America/Denver"], ["Sacramento", "CA", "916", "America/Los_Angeles"],
  ["San Diego", "CA", "619", "America/Los_Angeles"], ["Portland", "OR", "503", "America/Los_Angeles"], ["Spokane", "WA", "509", "America/Los_Angeles"],
] as const;

const PREFIXES = [
  "Blue Line", "Ridgeway", "Summit", "Keystone", "Harbor", "Lakeview", "Coastal", "Pioneer", "Ironwood", "Maple Leaf", "Granite",
  "Cedar Ridge", "Liberty", "Patriot", "Evergreen", "Northside", "Southern Star", "Precision", "Reliable", "Allied", "Bluewater",
  "Red Oak", "Silver Creek", "Twin Rivers", "Westfield", "Brightway", "Clearview", "Frontier", "Heritage", "Highland", "Riverbend",
  "Sunrise", "Tri-County", "Valley Pro", "Anchor", "Benchmark", "Cornerstone", "Eagle Rock", "First Choice", "Gold Star", "Hometown",
  "Lone Pine", "Metro", "Old Mill", "Prairie", "Quality First", "Rapid", "Stonebridge", "True North", "Victory",
];

const TRADES: Record<string, string[]> = {
  hvac: ["Heating & Air", "Air Conditioning", "Comfort Systems", "Climate Control", "HVAC Services"],
  plumbing: ["Plumbing", "Plumbing & Drain", "Rooter & Plumbing", "Plumbing Services"],
  roofing: ["Roofing", "Roofing Co.", "Roof Systems", "Roofing & Gutters"],
  electrical: ["Electric", "Electrical Services", "Electric Co.", "Power & Light"],
};

const FIRST = ["James", "Maria", "Robert", "Linda", "Michael", "Patricia", "David", "Jennifer", "Carlos", "Angela", "Kevin", "Tanya", "Brian", "Denise", "Marcus", "Rachel", "Tom", "Keisha", "Greg", "Nina", "Sarah", "Omar", "Priya", "Lukas", "Elena", "Hamid", "Fatima", "Oliver", "Chloe", "Noah"];
const LAST = ["Walker", "Hughes", "Delgado", "Brennan", "Foster", "Okafor", "Kowalski", "Reyes", "Holt", "Mercer", "Navarro", "Pratt", "Sullivan", "Tran", "Whitaker", "Ibarra", "Lindqvist", "Hartmann", "Rahman", "Costa", "Ferreira", "Novak", "Bauer", "Kaya", "Morgan"];

const DEV_PLACES = [
  { country: "AE", city: "Dubai", region: "Dubai", tz: "Asia/Dubai", phone: (n: number) => `+9714${String(5550000 + n).padStart(7, "0")}` },
  { country: "AE", city: "Abu Dhabi", region: "Abu Dhabi", tz: "Asia/Dubai", phone: (n: number) => `+9712${String(5550000 + n).padStart(7, "0")}` },
  { country: "GB", city: "London", region: "England", tz: "Europe/London", phone: (n: number) => `+44207946${String(n % 1000).padStart(4, "0")}` },
  { country: "GB", city: "Manchester", region: "England", tz: "Europe/London", phone: (n: number) => `+44161496${String(n % 1000).padStart(4, "0")}` },
  { country: "GB", city: "Birmingham", region: "England", tz: "Europe/London", phone: (n: number) => `+44121496${String(n % 1000).padStart(4, "0")}` },
  { country: "CH", city: "Zürich", region: "ZH", tz: "Europe/Zurich", phone: (n: number) => `+4144555${String(n % 10000).padStart(4, "0")}` },
  { country: "CH", city: "Zug", region: "ZG", tz: "Europe/Zurich", phone: (n: number) => `+4141555${String(n % 10000).padStart(4, "0")}` },
  { country: "CH", city: "Geneva", region: "GE", tz: "Europe/Zurich", phone: (n: number) => `+4122555${String(n % 10000).padStart(4, "0")}` },
];

const DEV_WORDS = ["Thameside", "Marina Crest", "Alpenblick", "Riverside Quarter", "Palm Vista", "Seefeld", "Canal Wharf", "Desert Rose", "Lindenhof", "Northgate", "Al Noor", "Harbourview", "Bergsicht", "Crescent Bay", "Elmstead", "Sandstone", "Lakeshore", "Oakfield", "Skyline", "Victoria Park", "Wiesental", "Azure Coast", "Kingsbridge", "Rosengarten", "Meridian"];
const DEV_SUFFIX: Record<string, string[]> = {
  AE: ["Properties", "Developments", "Real Estate Development", "Residences"],
  GB: ["Homes", "Developments", "Living", "Property Group"],
  CH: ["Wohnbau", "Immobilien", "Development", "Residenzen"],
};

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

export interface LeadSeed {
  sources: Source[];
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  signals: Signal[];
  activities: Activity[];
  suppression: Suppression[];
  meetings: Meeting[];
  deals: Deal[];
  commissions: Commission[];
}

export const generateLeadSeed = (now = new Date()): LeadSeed => {
  const rand = mulberry32(20261001);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const chance = (p: number) => rand() < p;
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000 - int(0, 86_399) * 1000).toISOString();
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

  const seedAt = daysAgo(45);
  const sources: Source[] = [
    { id: "src-places-us", name: "Places API · US trades", kind: "places_api", country: "US", createdAt: seedAt },
    { id: "src-csv-fl", name: "CSV · Florida HVAC list", kind: "csv_import", country: "US", createdAt: seedAt },
    { id: "src-planning-gb", name: "Planning portal · UK", kind: "planning_portal", country: "GB", createdAt: seedAt },
    { id: "src-zefix-ch", name: "Zefix · Swiss register", kind: "zefix", country: "CH", createdAt: seedAt },
    { id: "src-dld-ae", name: "DLD · Dubai developers", kind: "dld", country: "AE", createdAt: seedAt },
    { id: "src-expo", name: "Cityscape expo exhibitors", kind: "expo", country: null, createdAt: seedAt },
  ];

  const out: LeadSeed = { sources, companies: [], contacts: [], leads: [], signals: [], activities: [], suppression: [], meetings: [], deals: [], commissions: [] };
  const names = new Set<string>();
  let n = 0;

  const stageFor = (): Stage => {
    const r = rand();
    if (r < 0.42) return "new";
    if (r < 0.52) return "researched";
    if (r < 0.75) return "contacted";
    if (r < 0.8) return "replied";
    if (r < 0.85) return "qualified";
    if (r < 0.885) return "meeting_booked";
    if (r < 0.895) return "meeting_completed";
    if (r < 0.905) return "opportunity";
    if (r < 0.912) return "proposal_sent";
    if (r < 0.917) return "negotiation";
    if (r < 0.927) return "won";
    if (r < 0.965) return "nurture";
    return "lost";
  };

  const add = (opts: {
    listType: ListType;
    company: Omit<Company, "id" | "createdAt" | "updatedAt" | "listType">;
    contact: Omit<Contact, "id" | "companyId">;
    signals: [string, boolean | number][];
    ownerId: string | null;
  }) => {
    n += 1;
    const id = String(n).padStart(4, "0");
    const createdAt = daysAgo(int(5, 60));
    const company: Company = { ...opts.company, id: `co-${id}`, listType: opts.listType, createdAt, updatedAt: chance(0.08) ? daysAgo(int(95, 200)) : createdAt };
    const contact: Contact = { ...opts.contact, id: `ct-${id}`, companyId: company.id };
    const leadId = `ld-${id}`;
    const signals: Signal[] = opts.signals.map(([key, value], i) => ({
      id: `sg-${id}-${i}`,
      leadId,
      key,
      value,
      source: key.startsWith("project") || key.includes("3d") ? "website audit" : key.includes("review") ? "Google reviews" : "website audit",
      observedAt: daysAgo(int(1, 40)),
      expiresAt: null,
    }));
    const scored = scoreLead({ listType: opts.listType, company, contact, signals, suppressed: false, now });
    const stage = stageFor();
    const touched = stage !== "new" && stage !== "researched";
    const lastTouchAt = touched ? daysAgo(int(0, 14)) : null;
    const nextAction =
      stage === "nurture" ? { type: "email", at: inDays(int(30, 90)) }
      : stage === "lost" ? null
      : stage === "meeting_booked" ? { type: "meeting", at: inDays(int(1, 6)) }
      : stage === "replied" ? { type: "follow_up", at: inDays(int(0, 3)) }
      : { type: opts.listType === "developers" && chance(0.3) ? "linkedin" : "call", at: inDays(int(0, 4)) };

    const lead: Lead = {
      id: leadId,
      companyId: company.id,
      primaryContactId: contact.id,
      ownerId: opts.ownerId,
      listType: opts.listType,
      stage,
      score: scored.score,
      tier: scored.tier,
      scoreBreakdown: scored.breakdown,
      scoreModelVersion: scored.modelVersion,
      scoredAt: daysAgo(0),
      excluded: scored.excluded,
      suppressed: false,
      nextActionAt: nextAction?.at ?? null,
      nextActionType: nextAction?.type ?? null,
      attemptsCount: touched ? int(1, 3) : 0,
      lastTouchAt,
      lawfulBasis: "Legitimate interest · B2B",
      importJobId: null,
      cadenceId: stage === "nurture" || stage === "lost" ? null : QUEUE.cadenceFor[opts.listType],
      cadenceStartedAt: touched ? daysAgo(int(3, 20)) : null,
      cadenceStepsDone: [],
      statusReason: stage === "lost" ? "Not a fit" : null,
      createdAt,
      updatedAt: lastTouchAt ?? createdAt,
    };
    /** A meeting slot on a weekday, 09:00–15:30 in the lead's local time, `days` from today (negative = past). */
    const meetingAt = (days: number) => {
      const tz = company.timezone ?? "UTC";
      let key = localDateKey(now.getTime() + days * 86_400_000, tz);
      while (!isBusinessDay(key)) key = shiftDateKey(key, days < 0 ? -1 : 1);
      return new Date(zonedToUtc(key, `${String(int(9, 15)).padStart(2, "0")}:${pick(["00", "30"])}`, tz)).toISOString();
    };

    // Meetings: upcoming for booked leads (a few already due and waiting to be marked held), past ones for later stages.
    const withWhom = `${contact.firstName} ${contact.lastName}`;
    const bookedBy = opts.ownerId ?? "u-bdr";
    const later = ["meeting_completed", "opportunity", "proposal_sent", "negotiation", "won"].includes(stage);
    if (stage === "meeting_booked" && nextAction) {
      const due = chance(0.25);
      out.meetings.push({
        id: `mt-${id}`, leadId, bookedBy, ownerId: opts.ownerId, withWhom, type: "video", attended: null, approved: null,
        scheduledAt: due ? meetingAt(-int(1, 2)) : meetingAt(int(1, 6)),
        createdAt: lastTouchAt ?? createdAt,
      });
      lead.nextActionAt = out.meetings[out.meetings.length - 1].scheduledAt;
    } else if (later || (stage === "contacted" && chance(0.06))) {
      const heldDaysAgo = int(1, 13);
      const noShow = !later;
      const decided = !noShow && chance(0.75);
      const approved = decided ? chance(0.85) : null;
      const meeting: Meeting = {
        id: `mt-${id}`, leadId, bookedBy, ownerId: opts.ownerId, withWhom, type: "video",
        scheduledAt: meetingAt(-heldDaysAgo),
        attended: noShow ? false : true,
        approved: noShow ? null : approved,
        checks: approved ? { icp: true, contact: true, need: true, decision_maker: true, held: true, not_duplicate: true } : {},
        approvedBy: decided ? "u-rinor" : null,
        decidedAt: decided ? daysAgo(Math.max(0, heldDaysAgo - 1)) : null,
        rejectReason: approved === false ? pick(["Decision-maker not on the call", "Out of target: franchise location", "Duplicate of an existing lead"]) : null,
        durationMin: noShow ? null : int(15, 45),
        recordingUrl: noShow ? null : `fake-recording://mt-${id}`,
        notes: null,
        createdAt: daysAgo(heldDaysAgo + int(2, 6)),
      };
      out.meetings.push(meeting);
      if (approved) {
        out.commissions.push({
          id: `cm-${id}`, userId: bookedBy, meetingId: meeting.id, dealId: null, type: "meeting_bonus",
          amountMinor: MEETING_BONUS_MINOR, currency: MEETING_BONUS_CURRENCY, status: "pending",
          period: meeting.scheduledAt.slice(0, 7), createdAt: meeting.decidedAt!,
        });
      }
    }

    // Deals for qualified leads and beyond, priced from the price book's lead offer for the list.
    const dealStage: Partial<Record<Stage, DealStage>> = {
      qualified: "qualified", meeting_booked: "meeting_booked", meeting_completed: "meeting_held",
      opportunity: "opportunity", proposal_sent: "proposal_sent", negotiation: "negotiation", won: "won",
    };
    const ds = dealStage[stage];
    if (ds) {
      const market = marketForCountry(company.country);
      const items = [LEAD_OFFER[opts.listType]];
      const pilot = opts.listType === "trades" && chance(0.35);
      const price = listPriceMinor(items, market, pilot);
      const changed = daysAgo(int(1, 18));
      out.deals.push({
        id: `dl-${id}`, leadId, brand: PRICE_ITEMS.find((i) => i.code === items[0])!.brand, stage: ds, market,
        currency: price.currency, setupMinor: price.setupMinor, monthlyMinor: price.monthlyMinor, pilot, items,
        ownerId: opts.ownerId, stageChangedAt: changed, expectedCloseAt: ds === "won" ? null : inDays(int(7, 45)),
        wonAt: ds === "won" ? daysAgo(int(1, 50)) : null, lostReason: null, lostNote: null,
        depositPaid: ds === "won" ? chance(0.85) : false, wonOverrideReason: null, createdAt: changed, updatedAt: changed,
      });
    }

    out.companies.push(company);
    out.contacts.push(contact);
    out.signals.push(...signals);
    out.leads.push(lead);
    const source = sources.find((s) => s.id === company.sourceId);
    out.activities.push({ id: `ac-${id}-0`, leadId, userId: null, type: "created", title: `Created from ${source?.name ?? "import"}`, detail: "Deduplicated on import", disposition: null, durationS: null, at: createdAt });
    if (touched) {
      const calls = lead.attemptsCount;
      for (let i = 0; i < calls; i += 1) {
        const last = i === calls - 1;
        const disposition = last && stage === "meeting_booked" ? "Meeting booked" : last && stage === "replied" ? "Send info" : pick(["No answer", "Voicemail", "Gatekeeper"]);
        out.activities.push({
          id: `ac-${id}-${i + 1}`,
          leadId,
          userId: opts.ownerId,
          type: "call",
          title: `Call · ${disposition}`,
          detail: disposition === "No answer" ? null : `${int(0, 6)} min ${int(0, 59)} s · ${contact.firstName} ${contact.lastName}`,
          disposition,
          durationS: disposition === "No answer" ? 0 : int(20, 400),
          at: last ? lastTouchAt! : daysAgo(int(15, 30)),
        });
      }
    }
  };

  // 500 US trades leads. Fictional 555-01xx numbers: 100 per area code, counted per area.
  const perArea = new Map<string, number>();
  for (let i = 0; i < 500; i += 1) {
    let [city, state, area, tz] = pick(US_CITIES);
    while ((perArea.get(area) ?? 0) >= 99) [city, state, area, tz] = pick(US_CITIES);
    const line = perArea.get(area) ?? 0;
    perArea.set(area, line + 1);
    const industry = pick(Object.keys(TRADES));
    let name = "";
    do {
      name = `${pick(PREFIXES)} ${pick(TRADES[industry])}${chance(0.25) ? pick([" LLC", " Inc."]) : ""}`;
      if (names.has(name)) name = `${name.replace(/ (LLC|Inc\.)$/, "")} of ${city}`;
    } while (names.has(name));
    names.add(name);
    const domain = chance(0.72) ? `${slug(name.replace(/ (LLC|Inc\.)$/, ""))}.example` : null;
    const first = pick(FIRST);
    const last = pick(LAST);
    const owner = chance(0.55);
    const signals: [string, boolean | number][] = [];
    if (chance(0.35)) signals.push(["reviews_missed_calls", true]);
    if (chance(0.4)) signals.push(["runs_lsa_or_google_ads", true]);
    if (chance(0.55)) signals.push(["no_online_booking", true]);
    if (chance(0.3)) signals.push(["no_answer_after_hours", true]);
    if (chance(0.12)) signals.push(["hiring_receptionist_or_dispatcher", true]);
    if (chance(0.6)) signals.push(["no_chat_widget", true]);
    if (chance(0.06)) signals.push(["is_franchise_or_chain", true]);
    if (chance(0.05)) signals.push(["uses_ai_receptionist", true]);
    const emailValid = domain !== null && chance(0.6);
    add({
      listType: "trades",
      company: {
        name,
        domain,
        phone: `+1${area}55501${String(line).padStart(2, "0")}`,
        country: "US",
        region: state,
        city,
        timezone: tz,
        industry,
        brandInterest: ["gllarix"],
        employeesEst: int(2, 60),
        reviewsCount: int(8, 900),
        rating: Math.round((3 + rand() * 2) * 10) / 10,
        sourceId: chance(0.8) ? "src-places-us" : "src-csv-fl",
      },
      contact: {
        firstName: first,
        lastName: last,
        title: owner ? "Owner" : pick(["Office manager", "General manager", "Operations manager"]),
        email: domain ? `${first.toLowerCase()}@${domain}` : null,
        emailStatus: domain ? (emailValid ? "valid" : "unknown") : "unknown",
        phone: null,
        phoneType: "landline",
        phoneVerified: chance(0.45),
        phoneInvalid: false,
        linkedinUrl: null,
        isDecisionMaker: owner,
      },
      signals,
      ownerId: chance(0.85) ? "u-bdr" : chance(0.6) ? "u-cofounder" : null,
    });
  }

  // 150 developer leads across AE, GB, CH.
  for (let i = 0; i < 150; i += 1) {
    const place = DEV_PLACES[i % DEV_PLACES.length];
    let name = "";
    do {
      name = `${pick(DEV_WORDS)} ${pick(DEV_SUFFIX[place.country])}`;
      if (names.has(name)) name = `${name} ${place.city}`;
    } while (names.has(name));
    names.add(name);
    const domain = chance(0.92) ? `${slug(name)}.example` : null;
    const units = chance(0.1) ? int(1, 4) : int(12, 420);
    const first = pick(FIRST);
    const last = pick(LAST);
    const signals: [string, boolean | number][] = [["project_units", units]];
    if (chance(0.6)) signals.push(["project_launch_12m", true]);
    if (chance(0.55)) signals.push(["no_3d_unit_picker", true]);
    if (chance(0.3)) signals.push(["launch_or_pr_90d", true]);
    if (chance(0.45)) signals.push(["static_renders_only", true]);
    if (chance(0.2)) signals.push(["expo_exhibitor", true]);
    if (chance(0.15)) signals.push(["hiring_sales_staff", true]);
    if (chance(0.4)) signals.push(["sales_office_phone_listed", true]);
    if (chance(0.12)) signals.push(["has_3d_vendor", true]);
    add({
      listType: "developers",
      company: {
        name,
        domain,
        phone: place.phone(i),
        country: place.country,
        region: place.region,
        city: place.city,
        timezone: place.tz,
        industry: chance(0.9) ? "property_developer" : "real_estate_broker",
        brandInterest: chance(0.35) ? ["arcadian", "gllarix"] : ["arcadian"],
        employeesEst: int(5, 400),
        reviewsCount: null,
        rating: null,
        sourceId: place.country === "AE" ? "src-dld-ae" : place.country === "GB" ? "src-planning-gb" : chance(0.7) ? "src-zefix-ch" : "src-expo",
      },
      contact: {
        firstName: first,
        lastName: last,
        title: pick(["Sales and marketing director", "Head of development", "Managing director", "Marketing manager", "Head of sales"]),
        email: domain ? `${first.toLowerCase()}.${last.toLowerCase()}@${domain}` : null,
        emailStatus: domain && chance(0.6) ? "valid" : "unknown",
        phone: null,
        phoneType: "landline",
        phoneVerified: chance(0.4),
        phoneInvalid: false,
        linkedinUrl: null,
        isDecisionMaker: true,
      },
      signals,
      ownerId: chance(0.8) ? "u-cofounder" : chance(0.7) ? "u-rinor" : null,
    });
  }

  out.suppression = [
    { id: "sp-1", value: "metrohomeservices.example", type: "domain", reason: "opt_out", source: "unsubscribe", addedBy: null, createdAt: daysAgo(12) },
    { id: "sp-2", value: "+18135550199", type: "phone", reason: "do_not_call", source: "call_outcome", addedBy: "u-bdr", createdAt: daysAgo(6) },
    { id: "sp-3", value: "info@quickfixhvac.example", type: "email", reason: "complaint", source: "manual", addedBy: "u-rinor", createdAt: daysAgo(2) },
  ];

  return out;
};
