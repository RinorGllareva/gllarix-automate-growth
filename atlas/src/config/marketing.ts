/**
 * Marketing and markets (spec/backbone/10 and 11). Positioning, words we don't use, the messaging kit, the two
 * outbound lists and the market list. Status of each item lives in the spec; keep this file in sync with it.
 */

export const POSITIONING = [
  {
    brand: "gllarix" as const,
    name: "Gllarix",
    for: "US trades and home-service owners (HVAC, plumbing, roofing, electrical); later other local businesses",
    promise: "Never miss a job: every call answered, every lead followed up, every job turned into a review.",
    proof: "The live demo line; pilot results (calls answered, after-hours calls captured, jobs booked)",
  },
  {
    brand: "arcadian" as const,
    name: "Arcadian",
    for: "Property developers and agencies worldwide",
    promise: "Sell off-plan units faster: buyers explore the building in 3D and pick a unit with live availability.",
    proof: "3D showcase project; the first client's case study",
  },
];

/** Never used (spec/backbone/10), plus any claim without client data. */
export const BANNED_PHRASES = ["95% less human error", "30+ hours saved", "first Albanian AI voice agent", "unlock your digital potential"];

export const MESSAGING_KIT = [
  { key: "opener", label: "Opener (trades)", text: "Hi [name], it's [BDR] with Gllarix. This call is recorded. Quick one: when your team is on a job, who picks up the phone?" },
  { key: "discovery", label: "Discovery", text: "How many calls do you miss a week? · What's an average job worth? · What happens to calls after 18:00?" },
  { key: "proof", label: "Proof", text: "Call this number now and try to trip it up. It tells callers it's an AI." },
  { key: "close", label: "Close", text: "Pilot or Standard price, the Stripe link, onboarding in about 7 days." },
  { key: "developer", label: "Opener (developers)", text: "We help developers sell off-plan faster: buyers walk the building in 3D and pick a unit with live availability. Can I send a 90-second example?" },
];

export const OBJECTIONS = ["AI sounds robotic", "I answer my own phone", "Send me info", "Too expensive", "We have a receptionist"];

export const OUTBOUND_LISTS = [
  {
    name: "Trades (US first)",
    who: "BDR",
    offer: "Gllarix Receptionist Standard ($1,500 + $699; pilot $600 + $524)",
    crossSell: "Speed-to-lead, reviews, Arcadian conversion landing page",
    channels: "Calls dialed by hand; email (CAN-SPAM); no cold SMS",
    cadence: "Day 1 call + email · day 3 call · day 6 call + email · day 10 closing email",
  },
  {
    name: "Developers (worldwide)",
    who: "Co-founder (Dubai, UK, CH, Kosovo) · BDR (US developers)",
    offer: "Arcadian 3D sales platform (€12,000 + €449) or 3D building (€6,500 + €249)",
    crossSell: "Gllarix sales-office receptionist, project landing page",
    channels: "Per country rules",
    cadence: "Day 1 LinkedIn (by hand) + email · day 4 call · day 8 email with a 3D teaser · day 14 closing email",
  },
];

/** Target markets (spec/backbone/11). */
export const MARKETS = [
  { key: "us_trades", name: "US (trades)", countries: ["US"], listType: "trades", brand: "Gllarix", language: "English", tz: "−6 h (ET)", whoSells: "BDR", priceLevel: "100% USD", priority: 1 },
  { key: "uk", name: "UK", countries: ["GB"], listType: null, brand: "Both", language: "English", tz: "−1 h", whoSells: "Co-founder", priceLevel: "100% EUR", priority: 2 },
  { key: "uae", name: "Dubai / UAE", countries: ["AE"], listType: null, brand: "Arcadian (+ sales-office receptionist)", language: "English, Arabic", tz: "+3 h", whoSells: "Co-founder", priceLevel: "Open (research)", priority: 2 },
  { key: "ch", name: "Switzerland", countries: ["CH"], listType: null, brand: "Arcadian", language: "German, French, English", tz: "0", whoSells: "Co-founder", priceLevel: "125%", priority: 2 },
  { key: "xk", name: "Kosovo / Albania", countries: ["XK", "AL"], listType: null, brand: "Arcadian 3D + Gllarix", language: "Albanian", tz: "0", whoSells: "Co-founder", priceLevel: "50%", priority: 2 },
  { key: "us_dev", name: "US (developers)", countries: ["US"], listType: "developers", brand: "Arcadian", language: "English", tz: "−6 to −9 h", whoSells: "BDR", priceLevel: "100% USD", priority: 3 },
  { key: "ca", name: "Canada", countries: ["CA"], listType: null, brand: "Gllarix", language: "English, French", tz: "−6 h", whoSells: "BDR", priceLevel: "100% USD", priority: 4 },
  { key: "dach", name: "DACH", countries: ["DE", "AT"], listType: null, brand: "Arcadian", language: "German", tz: "0", whoSells: "Co-founder (LinkedIn, events, referrals)", priceLevel: "100%", priority: 4 },
  { key: "nordics", name: "Nordics", countries: ["NO", "SE", "DK", "FI"], listType: null, brand: "Both", language: "English", tz: "0", whoSells: "Co-founder", priceLevel: "100%", priority: 5 },
] as const;

/** Our list prices to compare competitors against (price book v2). */
export const OUR_PRICE = { gllarix: "$1,500 setup + $699/mo (pilot $600 + $524)", arcadian: "€6,500 + €249/mo (3D building) · €12,000 + €449/mo (sales platform)" };

/** Competitor prices are checked by hand each quarter until the R1 price monitor exists. */
export const COMPETITOR_CHECK_DAYS = 90;

export interface ClaimIssue {
  text: string;
  reason: string;
  severity: "banned" | "needs_proof";
}

/** Flags banned phrases and claims that need client data before they go on a website, post or email. */
export const checkClaims = (copy: string): ClaimIssue[] => {
  const out: ClaimIssue[] = [];
  const taken: [number, number][] = [];
  const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && b > x);
  const lower = copy.toLowerCase();
  for (const p of BANNED_PHRASES) {
    let at = lower.indexOf(p.toLowerCase());
    while (at >= 0) {
      out.push({ text: copy.slice(at, at + p.length), reason: "On the list of words we don't use", severity: "banned" });
      taken.push([at, at + p.length]);
      at = lower.indexOf(p.toLowerCase(), at + p.length);
    }
  }
  const patterns: [RegExp, string][] = [
    [/\bsave[sd]?\s+(?:you\s+)?\d+\+?\s?(?:hours?|hrs?)\b(?:\s+(?:a|per)\s+(?:week|month)|\s+weekly)?/gi, "Time saved needs client data"],
    [/\b\d+\+?\s?(?:hours?|hrs?)\s+(?:saved|back)\b/gi, "Time saved needs client data"],
    [/\b\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?\s?%/g, "A percentage needs client data behind it"],
    [/\b(?:outperform\w*|better than|beats?|faster than|cheaper than)\b[^.,;:]{0,40}/gi, "A comparison needs data behind it"],
    [/\b(?:guarantee[sd]?|never (?:miss|fail)s? (?:a|any) (?:call|lead)|100% of (?:calls|leads))\b/gi, "A guarantee we can't prove"],
    [/\b(?:first|only|#1|number one|best)\b[^.]{0,40}\b(?:in the world|on the market|in (?:the )?(?:us|europe|kosovo|albania)|ai)\b/gi, "A 'first/best/only' claim needs proof"],
    [/\b\d+(?:\.\d+)?x\b/gi, "A multiple needs client data"],
  ];
  for (const [re, reason] of patterns)
    for (const m of copy.matchAll(re)) {
      const a = m.index ?? 0;
      const b = a + m[0].length;
      if (!free(a, b)) continue;
      taken.push([a, b]);
      out.push({ text: m[0].trim(), reason, severity: "needs_proof" });
    }
  return out;
};
