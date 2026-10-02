import { BANNED_CLAIMS, CALL_RUBRIC, COACHING, type ComplianceKey, type RubricItemKey } from "@/config/callRubric";
import { hash01 } from "./usagePortal";

/**
 * Call coaching (CRM_BUILD_PROMPT A17). TranscriptionProvider turns a recording into speaker-labelled lines; the coach
 * scores the words on the call against the rubric, with quoted evidence for every score. The real coach runs in an Edge
 * Function with prompts/CALL_COACH_SYSTEM_PROMPT.md; the fakes below are deterministic and used in demo mode and tests.
 * Guardrails: work words only — no emotion, sentiment, tone-of-voice or personal judgements; scores never feed pay.
 */

export interface TranscriptLine {
  /** Seconds from the start. */
  t: number;
  speaker: "rep" | "prospect";
  text: string;
}

export interface CallMeta {
  activityId: string;
  userId: string;
  repName: string;
  prospectName: string;
  company: string;
  disposition: string | null;
  durationS: number;
  at: string;
  /** Lead-local hour of the call (for the calling-window insight). */
  localHour: number | null;
}

export interface Evidence {
  t: number;
  text: string;
}

export interface ItemScore {
  key: RubricItemKey;
  /** null = not applicable on this call. */
  score: number | null;
  evidence: Evidence[];
}

export interface LineTag {
  text: string;
  tone: "good" | "warn";
}

export interface ScoredCall {
  status: "scored" | "not_scored";
  reason: string | null;
  items: ItemScore[];
  total: number | null;
  compliance: { key: ComplianceKey; pass: boolean; evidence: Evidence[] }[];
  compliancePass: boolean;
  keepDoing: string[];
  tryNext: { text: string; example: string; t: number }[];
  keyMoments: { t: number; kind: "objection" | "commitment" | "question"; text: string }[];
  /** Tags under transcript lines, by line index. */
  tags: Record<number, LineTag[]>;
  /** The line to highlight (a missed step). */
  flaggedLine: number | null;
}

export interface TranscriptionProvider {
  transcribe(meta: CallMeta): Promise<TranscriptLine[]>;
}

export interface CoachProvider {
  score(meta: CallMeta, lines: TranscriptLine[]): Promise<{ result: ScoredCall; model: string; costMinor: number }>;
}

// ---------------------------------------------------------------- scoring maths

/** Weighted 0–100 over applicable items (discovery counts double). */
export const weightedTotal = (items: Pick<ItemScore, "key" | "score">[]) => {
  let sum = 0;
  let w = 0;
  for (const it of items) {
    if (it.score === null) continue;
    const weight = CALL_RUBRIC.items.find((r) => r.key === it.key)?.weight ?? 1;
    sum += it.score * weight;
    w += weight;
  }
  return w ? Math.round(sum / w) : null;
};

export const notScoredReason = (meta: Pick<CallMeta, "durationS" | "disposition">) => {
  if (meta.durationS < COACHING.minScoredSeconds) return `Under ${COACHING.minScoredSeconds} seconds`;
  if (/wrong number/i.test(meta.disposition ?? "")) return "Wrong number";
  if (/gatekeeper/i.test(meta.disposition ?? "")) return "Gatekeeper call";
  if (/no answer|voicemail/i.test(meta.disposition ?? "")) return "No conversation";
  return null;
};

/** Human check: a gap above 15 points flags the rubric (or the prompt) for review. */
export const humanGap = (ai: number, human: number) => ({ gap: Math.abs(ai - human), flagged: Math.abs(ai - human) > COACHING.humanGapPoints });

// ---------------------------------------------------------------- fake transcription

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const timestamp = fmt;

const OBJECTIONS = [
  { key: "robotic", line: "Maybe ten. But these AI things sound robotic.", good: "Fair. Don't take my word for it: call this number now and try to trip it up. It also tells callers it's an AI.", weak: "No, ours is really good, I promise." },
  { key: "price", line: "How much is it? We're a small shop.", good: "Setup is a one-off and the monthly is less than one missed job. Want to try the demo line first?", weak: "It's not that expensive." },
  { key: "receptionist", line: "We already have someone on the phones.", good: "Makes sense. This covers evenings and when she's on another line, so nothing goes to voicemail.", weak: "Oh, okay." },
  { key: "send_info", line: "Just send me some info.", good: "Sure. Faster: call this number, it's the AI answering as a sample HVAC company, and it tells callers it's an AI. Then we talk Thursday?", weak: "Okay, I'll email you something." },
];

/** Deterministic fake transcript from the call's metadata (demo and tests). */
export const createFakeTranscription = (): TranscriptionProvider => ({
  async transcribe(m) {
    const h = (k: string) => hash01(`${m.activityId}:${k}`);
    const rep = m.repName.split(" ")[0];
    const first = m.prospectName.split(" ")[0] || "there";
    const openerSec = Math.round(8 + h("opener") * 26);
    const notice = h("notice") > 0.08;
    const lines: TranscriptLine[] = [];
    lines.push({ t: 0, speaker: "rep", text: `Hi, is this ${first}? It's ${rep} with Gllarix.${notice ? " This call is recorded." : ""}${openerSec > 20 ? " We help trades businesses with their phones, we've been working with a lot of companies in your area and I wanted to tell you a bit about what we do." : ""} Quick one: when your techs are out on a job, who answers the phone?` });
    let t = openerSec + 2;
    lines.push({ t, speaker: "prospect", text: h("p1") > 0.5 ? "Honestly, mostly nobody. My wife when she can." : "The office, when someone's there." });
    const askMissed = h("missed") > 0.3;
    const askValue = h("value") > 0.55;
    const askAfter = h("after") > 0.6;
    const span = Math.max(30, m.durationS - t - 20);
    const step = () => (t += Math.max(6, Math.round(span / 9)));
    if (askMissed) {
      lines.push({ t: step(), speaker: "rep", text: "How many calls would you say go to voicemail in a normal week?" });
      lines.push({ t: step(), speaker: "prospect", text: h("p2") > 0.5 ? "Maybe ten." : "A few. Five, six?" });
    }
    if (askValue) {
      lines.push({ t: step(), speaker: "rep", text: "And what's a typical job worth to you?" });
      lines.push({ t: step(), speaker: "prospect", text: "A repair is a few hundred. An install is thousands." });
    }
    if (askAfter) {
      lines.push({ t: step(), speaker: "rep", text: "What happens to calls after 6 in the evening?" });
      lines.push({ t: step(), speaker: "prospect", text: "They go to voicemail." });
    }
    const disp = m.disposition ?? "";
    const objection = /send info/i.test(disp) ? OBJECTIONS[3] : h("obj") < 0.62 ? OBJECTIONS[Math.floor(h("objKind") * 3)] : null;
    let handled = false;
    if (objection) {
      lines.push({ t: step(), speaker: "prospect", text: objection.line });
      handled = h("handled") > 0.3;
      lines.push({ t: step(), speaker: "rep", text: handled ? objection.good : objection.weak });
    }
    if (h("claim") < 0.04) lines.push({ t: step(), speaker: "rep", text: "Our clients see 95% less human error on the phones." });
    if (/meeting booked/i.test(disp)) {
      lines.push({ t: step(), speaker: "rep", text: "Great. Can we do 20 minutes Thursday at 11?" });
      lines.push({ t: step(), speaker: "prospect", text: "Thursday works." });
    } else if (/call back/i.test(disp)) {
      lines.push({ t: step(), speaker: "prospect", text: "Call me back next week, I'm on a job." });
      lines.push({ t: step(), speaker: "rep", text: h("cbTime") > 0.4 ? "Will do. Tuesday at 8 your time?" : "Sure, I'll try you next week." });
    } else if (/send info/i.test(disp)) {
      lines.push({ t: step(), speaker: "rep", text: h("siDate") > 0.5 ? "I'll send it now and call you Wednesday to hear what you think." : "Okay, I'll send it over." });
    } else {
      lines.push({ t: step(), speaker: "prospect", text: "We're fine for now, thanks." });
      lines.push({ t: step(), speaker: "rep", text: "No problem. Thanks for your time." });
    }
    return lines.map((l) => ({ ...l, t: Math.min(l.t, Math.max(0, m.durationS - 2)) }));
  },
});

// ---------------------------------------------------------------- fake coach (rule-based; the real one is the model)

const has = (lines: TranscriptLine[], re: RegExp, speaker?: TranscriptLine["speaker"]) => lines.findIndex((l) => (!speaker || l.speaker === speaker) && re.test(l.text));

export const scoreTranscript = (meta: CallMeta, lines: TranscriptLine[]): ScoredCall => {
  const reason = notScoredReason(meta);
  const tags: Record<number, LineTag[]> = {};
  const tag = (i: number, text: string, tone: LineTag["tone"]) => {
    if (i < 0) return;
    (tags[i] ??= []).push({ text, tone });
  };
  const ev = (i: number): Evidence[] => (i >= 0 ? [{ t: lines[i].t, text: lines[i].text }] : []);
  if (reason) return { status: "not_scored", reason, items: [], total: null, compliance: [], compliancePass: true, keepDoing: [], tryNext: [], keyMoments: [], tags, flaggedLine: null };

  // Opener: time to the first question.
  const firstProspect = lines.findIndex((l) => l.speaker === "prospect");
  const openerSec = firstProspect > 0 ? lines[firstProspect].t : 0;
  const opener = openerSec <= 20 ? Math.max(70, 100 - Math.max(0, openerSec - 8)) : Math.max(35, 75 - (openerSec - 20) * 3);
  const notice = has(lines, /this call is recorded/i, "rep");
  tag(0, `OPENER ${openerSec} S${notice === 0 ? " · RECORDING NOTICE GIVEN" : ""}`, openerSec <= 20 ? "good" : "warn");

  // Discovery: missed calls, job value, after-hours.
  const qMissed = has(lines, /voicemail in a normal week|who answers the phone/i, "rep");
  const qMissedReal = has(lines, /voicemail in a normal week/i, "rep");
  const qValue = has(lines, /typical job worth/i, "rep");
  const qAfter = has(lines, /after 6|after hours/i, "rep");
  const asked = [qMissedReal, qValue, qAfter].filter((i) => i >= 0);
  const discovery = Math.min(100, 25 + asked.length * 25 + (qMissed >= 0 ? 5 : 0));
  if (qMissedReal >= 0) tag(qMissedReal, "DISCOVERY · MISSED CALLS", "good");
  if (qValue >= 0) tag(qValue, "DISCOVERY · JOB VALUE", "good");
  if (qAfter >= 0) tag(qAfter, "DISCOVERY · AFTER-HOURS", "good");

  // Objections.
  const objIdx = has(lines, /robotic|how much is it|already have someone|send me some info/i, "prospect");
  let objections: number | null = null;
  let handledWithDemo = false;
  if (objIdx >= 0) {
    const answer = lines[objIdx + 1];
    handledWithDemo = !!answer && /call this number|demo line|covers evenings|less than one missed job/i.test(answer.text);
    objections = handledWithDemo ? 85 : 50;
    const kind = /robotic/i.test(lines[objIdx].text) ? "SOUNDS ROBOTIC" : /how much/i.test(lines[objIdx].text) ? "PRICE" : /already have/i.test(lines[objIdx].text) ? "HAS A RECEPTIONIST" : "SEND ME INFO";
    tag(objIdx, `OBJECTION · ${kind}`, "warn");
    if (answer) tag(objIdx + 1, handledWithDemo ? (/call this number/i.test(answer.text) ? "HANDLED WITH THE LIVE DEMO LINE" : "HANDLED") : "WEAK ANSWER", handledWithDemo ? "good" : "warn");
  }

  // Next step.
  const booked = has(lines, /can we do 20 minutes/i, "rep");
  const callbackTime = has(lines, /tuesday at 8|wednesday to hear/i, "rep");
  const vagueEnd = has(lines, /i'll try you next week|i'll send it over|thanks for your time/i, "rep");
  const nextIdx = booked >= 0 ? booked + 1 : callbackTime >= 0 ? callbackTime : vagueEnd;
  const nextStep = booked >= 0 ? 90 : callbackTime >= 0 ? 75 : 40;
  if (booked >= 0) tag(booked + 1 < lines.length ? booked + 1 : booked, "NEXT STEP BOOKED", "good");
  else if (callbackTime >= 0) tag(callbackTime, "NEXT STEP SET", "good");
  else if (vagueEnd >= 0) tag(vagueEnd, "NO DATED NEXT STEP", "warn");

  let flaggedLine: number | null = null;
  if (booked >= 0 && qValue < 0) {
    tag(booked, "MISSED: JOB VALUE NOT ASKED BEFORE BOOKING", "warn");
    flaggedLine = booked;
  }

  // Compliance (strict, pass/fail).
  const demoMention = has(lines, /call this number|demo line/i, "rep");
  const aiSaid = has(lines, /it's an ai|it tells callers it's an ai/i, "rep");
  const claim = lines.findIndex((l) => l.speaker === "rep" && BANNED_CLAIMS.some((re) => re.test(l.text)));
  if (claim >= 0) tag(claim, "UNAPPROVED CLAIM", "warn");
  const compliance = [
    { key: "recording_notice" as const, pass: notice >= 0, evidence: notice >= 0 ? ev(notice) : ev(0) },
    { key: "ai_disclosure" as const, pass: demoMention < 0 || aiSaid >= 0, evidence: demoMention >= 0 ? ev(aiSaid >= 0 ? aiSaid : demoMention) : ev(0) },
    { key: "honest_claims" as const, pass: claim < 0, evidence: claim >= 0 ? ev(claim) : ev(0) },
  ];

  const items: ItemScore[] = [
    { key: "opener", score: opener, evidence: ev(0) },
    { key: "discovery", score: discovery, evidence: asked.length ? asked.map((i) => ev(i)[0]) : ev(nextIdx >= 0 ? nextIdx : 0) },
    { key: "objections", score: objections, evidence: objIdx >= 0 ? [...ev(objIdx), ...ev(objIdx + 1)] : [] },
    { key: "next_step", score: nextStep, evidence: ev(nextIdx >= 0 ? nextIdx : lines.length - 1) },
  ];

  const keepDoing: string[] = [];
  if (openerSec <= 20) keepDoing.push("The opener gets to the question fast.");
  if (handledWithDemo && /call this number/i.test(lines[objIdx + 1]?.text ?? "")) keepDoing.push("Using the live demo line to answer the objection.");
  if (booked >= 0) keepDoing.push("Asking for a specific time to book.");
  const tryNext: ScoredCall["tryNext"] = [];
  if (booked >= 0 && qValue < 0) tryNext.push({ text: "Ask the job-value question before booking: it makes the price talk easier.", example: "Before we book: what's a typical job worth to you?", t: lines[booked].t });
  if (openerSec > 20) tryNext.push({ text: "Get to the first question within 20 seconds.", example: "It's [name] with Gllarix, this call is recorded. Quick one: who answers when you're on a job?", t: 0 });
  if (objIdx >= 0 && !handledWithDemo && tryNext.length < 2) tryNext.push({ text: "Answer the objection with the live demo line.", example: "Don't take my word for it: call this number now. It tells callers it's an AI.", t: lines[objIdx].t });
  if (booked < 0 && callbackTime < 0 && tryNext.length < 2) tryNext.push({ text: "End with a dated next step.", example: "Can I call you Tuesday at 8 to hear what you think?", t: lines[Math.max(0, nextIdx)].t });

  const keyMoments: ScoredCall["keyMoments"] = [];
  if (objIdx >= 0) keyMoments.push({ t: lines[objIdx].t, kind: "objection", text: lines[objIdx].text });
  if (booked >= 0) keyMoments.push({ t: lines[booked].t, kind: "commitment", text: lines[booked + 1]?.text ?? lines[booked].text });
  const q = lines.findIndex((l) => l.speaker === "prospect" && /\?$/.test(l.text));
  if (q >= 0) keyMoments.push({ t: lines[q].t, kind: "question", text: lines[q].text });

  return { status: "scored", reason: null, items, total: weightedTotal(items), compliance, compliancePass: compliance.every((c) => c.pass), keepDoing: keepDoing.slice(0, 2), tryNext: tryNext.slice(0, 2), keyMoments, tags, flaggedLine };
};

export const createFakeCoach = (): CoachProvider => ({
  async score(meta, lines) {
    return { result: scoreTranscript(meta, lines), model: "claude-sonnet-5-5 (fake)", costMinor: 0.4 };
  },
});

// ---------------------------------------------------------------- insights ("what's working")

export interface InsightInput {
  scored: { meta: CallMeta; result: ScoredCall }[];
  /** All call attempts (for the connect-rate pattern). */
  attempts: { connected: boolean; localHour: number | null }[];
}

export interface Insight {
  key: string;
  pattern: string;
  effect: string;
  metric: string;
  calls: number;
}

const booked = (c: { meta: CallMeta }) => /meeting booked/i.test(c.meta.disposition ?? "");
const reachedNext = (c: { result: ScoredCall }) => (c.result.items.find((i) => i.key === "next_step")?.score ?? 0) >= 75;
const rate = <T,>(xs: T[], f: (x: T) => boolean) => (xs.length ? xs.filter(f).length / xs.length : 0);
const ratioText = (a: number, b: number) => (b > 0 ? (a / b >= 1.5 ? `${(a / b).toFixed(1)}× more` : `${a >= b ? "+" : ""}${Math.round((a / b - 1) * 100)}%`) : a > 0 ? "only here" : "—");

/** Patterns over scored calls, shown only when at least 30 calls are behind them (and 5+ on each side). */
export const insights = (input: InsightInput, minCalls = COACHING.insightMinCalls): Insight[] => {
  const out: Insight[] = [];
  const calls = input.scored.filter((c) => c.result.status === "scored");
  const split = (key: string, pattern: string, metric: string, has: (c: (typeof calls)[number]) => boolean, f: (c: (typeof calls)[number]) => boolean) => {
    const a = calls.filter(has);
    const b = calls.filter((c) => !has(c));
    if (a.length + b.length < minCalls || a.length < 5 || b.length < 5) return;
    out.push({ key, pattern, effect: ratioText(rate(a, f), rate(b, f)), metric, calls: a.length + b.length });
  };
  const openerSec = (c: (typeof calls)[number]) => Number(/OPENER (\d+) S/.exec(c.result.tags[0]?.[0]?.text ?? "")?.[1] ?? 99);
  split("opener", "Openers under 20 seconds", "meetings booked", (c) => openerSec(c) <= 20, booked);
  split("missed_calls_q", 'Asking "who answers when you are on a job?" and how many calls go to voicemail', "conversations reaching a next step", (c) => c.result.items.find((i) => i.key === "discovery")!.evidence.some((e) => /voicemail in a normal week/i.test(e.text)), reachedNext);
  const early = input.attempts.filter((a) => a.localHour !== null && a.localHour >= 7 && a.localHour < 9);
  const later = input.attempts.filter((a) => a.localHour !== null && a.localHour >= 9);
  if (early.length + later.length >= minCalls && early.length >= 5 && later.length >= 5) {
    out.push({ key: "window", pattern: "Calling 07:00–09:00 local vs later", effect: ratioText(rate(early, (a) => a.connected), rate(later, (a) => a.connected)), metric: "connect rate", calls: early.length + later.length });
  }
  const sendInfo = calls.filter((c) => Object.values(c.result.tags).flat().some((t) => t.text === "OBJECTION · SEND ME INFO"));
  if (sendInfo.length >= minCalls) {
    const withDemo = (c: (typeof calls)[number]) => Object.values(c.result.tags).flat().some((t) => t.text === "HANDLED WITH THE LIVE DEMO LINE");
    const a = sendInfo.filter(withDemo);
    const b = sendInfo.filter((c) => !withDemo(c));
    if (a.length >= 5 && b.length >= 5) out.push({ key: "send_info_demo", pattern: '"Send me info" answered with the demo line', effect: ratioText(rate(a, reachedNext), rate(b, reachedNext)), metric: "end with a dated next step", calls: sendInfo.length });
  }
  return out;
};

// ---------------------------------------------------------------- weekly 1:1 agenda (summary mode)

export interface AgendaPoint {
  kind: "strength" | "focus" | "fix";
  text: string;
  /** Example calls (review ids) for the focus point. */
  reviewIds: string[];
}

/** One strength, one focus with two example calls, one practical suggestion; under 70 words. */
export const weeklyAgenda = (input: {
  kpis: { label: string; value: number | null; status: string | null; unit: string }[];
  reviews: { id: string; result: ScoredCall }[];
}): AgendaPoint[] => {
  const fmt = (k: (typeof input.kpis)[number]) => (k.value === null ? "—" : k.unit === "pct" ? `${Math.round(k.value * 100)}%` : k.unit === "rate" ? k.value.toFixed(1) : String(Math.round(k.value)));
  const met = input.kpis.filter((k) => k.status === "on_track" && k.value !== null);
  const watch = input.kpis.filter((k) => k.status && k.status !== "on_track" && k.value !== null);
  const scored = input.reviews.filter((r) => r.result.status === "scored");
  const avg = (key: RubricItemKey) => {
    const xs = scored.map((r) => r.result.items.find((i) => i.key === key)?.score).filter((x): x is number => typeof x === "number");
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const weakest = CALL_RUBRIC.items.map((i) => ({ i, v: avg(i.key) })).filter((x) => x.v !== null).sort((a, b) => a.v! - b.v!)[0];
  const examples = weakest
    ? scored
        .filter((r) => r.result.items.some((i) => i.key === weakest.i.key && i.score !== null))
        .sort((a, b) => a.result.items.find((i) => i.key === weakest.i.key)!.score! - b.result.items.find((i) => i.key === weakest.i.key)!.score!)
        .slice(0, 2)
        .map((r) => r.id)
    : [];
  const strength = met.length ? `Good: ${met.slice(0, 2).map((k) => `${k.label.toLowerCase()} ${fmt(k)}`).join(" and ")}.` : scored.length ? "Good: steady call volume this week." : "Good: a full week on the queue.";
  const focus = weakest ? `Practice: ${weakest.i.short.toLowerCase()} (${Math.round(weakest.v!)} / 100). Two example calls attached.` : "Practice: no scored calls this week.";
  const fixKpi = watch[0];
  const FIX: Record<string, string> = {
    "Dials per day": "agree a power hour before 09:00 local",
    "Conversations per day": "call the 07:00–09:00 window first",
    "CRM updated same day": "log the disposition before the next dial",
    "Show rate": "send the reminder text the day before",
    "Follow-up within 24 h of a meeting": "block 15 minutes after each meeting",
    "Meetings booked": "ask for the meeting on every good conversation",
  };
  const fix = fixKpi ? `${fixKpi.label} at ${fmt(fixKpi)}: ${FIX[fixKpi.label] ?? "agree one small change for next week"}.` : "Keep the same routine next week.";
  return [
    { kind: "strength", text: strength, reviewIds: [] },
    { kind: "focus", text: focus, reviewIds: examples },
    { kind: "fix", text: fix, reviewIds: [] },
  ];
};
