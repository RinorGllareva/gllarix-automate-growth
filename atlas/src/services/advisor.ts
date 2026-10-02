/**
 * The AI co-founder (A19). In Supabase mode an Edge Function sends `prompts/AI_COFOUNDER_SYSTEM_PROMPT.md` plus the
 * core context (prompt-cached) to the model and executes its tool calls as the asking user. The prompt and the API key
 * never reach the browser. Demo mode uses `createFakeAdvisorProvider`: deterministic rules that call the same tools and
 * write the same answer shapes, so the evaluation set, role limits and "drafts only" can be tested.
 */
import type { AdvisorAnswer, AdvisorRole, Assumption, MemoOption, ToolCall, ToolName } from "@/data/advisorTypes";
import type { Role } from "@/data/types";

// ---------------------------------------------------------------- models and cost

export const ADVISOR_MODELS = {
  memo: { model: "claude-opus-5-5", inputPerMTokMinor: 1500, cachedPerMTokMinor: 150, outputPerMTokMinor: 7500 },
  quick: { model: "claude-sonnet-5-5", inputPerMTokMinor: 300, cachedPerMTokMinor: 30, outputPerMTokMinor: 1500 },
} as const;

/** USD cents for one answer (prices are estimates: check current prices before relying on the cost log). */
export const answerCostMinor = (kind: keyof typeof ADVISOR_MODELS, t: { input: number; cached: number; output: number }) => {
  const m = ADVISOR_MODELS[kind];
  return Math.round(((t.input * m.inputPerMTokMinor + t.cached * m.cachedPerMTokMinor + t.output * m.outputPerMTokMinor) / 1_000_000) * 100) / 100;
};

// ---------------------------------------------------------------- role limits

/** Tools each role may call (the server enforces the same through RLS; the advisor can't widen access). */
export const TOOL_ACCESS: Record<ToolName, Role[]> = {
  search_knowledge: ["admin", "bdr", "closer", "implementer", "viewer"],
  get_decisions: ["admin", "bdr", "closer", "implementer", "viewer"],
  get_kpis: ["admin", "bdr", "closer", "viewer"],
  get_pipeline: ["admin", "bdr", "closer", "viewer"],
  get_mrr_history: ["admin", "viewer"],
  get_finance: ["admin", "viewer"],
  get_expenses: ["admin", "viewer"],
  run_price_quote: ["admin", "bdr", "closer"],
  run_scenario: ["admin", "viewer"],
  get_capacity: ["admin", "bdr", "closer", "implementer"],
  get_tasks: ["admin", "bdr", "closer", "implementer"],
  get_time_report: ["admin", "implementer"],
  get_clients: ["admin", "bdr", "closer", "implementer"],
  get_team_performance: ["admin"],
  get_market_notes: ["admin", "bdr", "closer", "viewer"],
  web_research: ["admin"],
  propose_tasks: ["admin", "bdr", "closer", "implementer"],
  propose_decision: ["admin"],
  draft_document: ["admin", "bdr", "closer"],
};

/** Finance documents are kept out of knowledge search for roles without finance access. */
export const FINANCE_DOCS = ["context/05_", "backbone/03_", "backbone/09_", "plans/scenarios_12_months", "plans/mrr_10k_strategy", "models/"];
/** The advisor's own spec holds the evaluation answers; it isn't part of the searchable knowledge. */
export const EXCLUDED_DOCS = ["backbone/08_AI_COFOUNDER.md"];
export const FINANCE_ROLES: Role[] = ["admin", "viewer"];

export const NOT_FOR_ROLE = "That information isn't available for your role.";
export const PROFESSIONAL = "Confirm with a professional (lawyer, accountant or tax adviser) before acting on this.";

// ---------------------------------------------------------------- figures must have a source

const FIGURE = /([€$£]\s?)?(\d[\d,]*(?:\.\d+)?)\s?(k\b|%|×|x\b|h\b)?/gi;

const numbersIn = (text: string) => {
  const out = new Set<number>();
  for (const m of text.matchAll(FIGURE)) {
    const n = Number(m[2].replace(/,/g, ""));
    if (Number.isNaN(n)) continue;
    const v = m[3]?.toLowerCase() === "k" ? n * 1000 : n;
    out.add(v);
    out.add(Math.round(v));
    out.add(Math.round(v * 10) / 10);
    if (v > 0 && v < 1) out.add(Math.round(v * 100));
  }
  return out;
};

const walkNumbers = (v: unknown, out: Set<number>) => {
  if (typeof v === "number" && Number.isFinite(v)) {
    out.add(v);
    out.add(Math.round(v));
    out.add(Math.round(v * 10) / 10);
    out.add(Math.round(v / 100)); // minor units → major
    if (v > 0 && v < 1) out.add(Math.round(v * 100));
  } else if (typeof v === "string") numbersIn(v).forEach((n) => out.add(n));
  else if (Array.isArray(v)) v.forEach((x) => walkNumbers(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => walkNumbers(x, out));
};

/** The figures in an answer: money, percentages, multipliers, hours, and any number of 10 or more. */
export const figuresIn = (text: string) =>
  [...text.matchAll(FIGURE)]
    .filter((m) => m[1] || m[3] || Number(m[2].replace(/,/g, "")) >= 10)
    .map((m) => ({ raw: m[0].trim(), value: Number(m[2].replace(/,/g, "")) * (m[3]?.toLowerCase() === "k" ? 1000 : 1) }));

const answerText = (a: Omit<AdvisorAnswer, "unsourced">) =>
  [a.short, a.body ?? "", a.fastest ?? "", a.profitable ?? "", ...(a.risks ?? []), ...(a.measure ?? []), ...(a.options ?? []).flatMap((o) => [o.name, o.cost, o.effect, o.risk])].join("\n");

/** Figures in the answer that no tool result, cited passage, assumption or the question itself contains. */
export const unsourcedFigures = (a: Omit<AdvisorAnswer, "unsourced">, calls: ToolCall[], question: string) => {
  const evidence = new Set<number>();
  for (const c of calls) {
    walkNumbers(c.data, evidence);
    walkNumbers(c.summary, evidence);
    walkNumbers(c.args, evidence);
  }
  walkNumbers(a.assumptions.map((x) => x.text), evidence);
  walkNumbers(question, evidence);
  return figuresIn(answerText(a))
    .filter((f) => !evidence.has(f.value) && !evidence.has(Math.round(f.value)))
    .map((f) => f.raw);
};

// ---------------------------------------------------------------- provider interface

export type ToolRun = (name: ToolName, args?: Record<string, unknown>) => Promise<ToolCall>;

export interface AdvisorContext {
  mode: "question" | "briefing" | "month_end" | "alert";
  question: string;
  roleHint: AdvisorRole | null;
  user: { id: string; name: string; role: Role };
  memory: string[];
  now: number;
  /** Alerts: what fired. */
  alert?: { kind: string; detail: string };
}

export interface ProviderResult {
  answer: Omit<AdvisorAnswer, "unsourced">;
  kind: keyof typeof ADVISOR_MODELS;
  tokens: { input: number; cached: number; output: number };
}

export interface AdvisorProvider {
  name: string;
  answer(ctx: AdvisorContext, run: ToolRun): Promise<ProviderResult>;
}

// ---------------------------------------------------------------- tool data shapes (shared with demoAdvisor)

export interface PassageData { passages: { path: string; heading: string; text: string }[] }
export interface QuoteData { market: string; currency: "USD" | "EUR"; symbol: string; items: string[]; itemNames: string[]; pilot: boolean; setup: number; monthly: number; firstYear: number; note: string | null }
export interface FinanceData { month: string; revenueEur: number; costsEur: number; byCategory: { category: string; eur: number }[]; recurringCostsEur: number; cash: { date: string; balanceEur: number } | null; reserveEur: number; reserveSource: string; mrrEur: number; payingClients: number }
export interface KpiData { period: string; kpis: { label: string; value: number | null; target: string; status: string | null; unit: string }[]; gates: { label: string; value: string; met: boolean; note: string }[]; bySource?: { source: string; contacted: number; meetings: number; rate: number | null }[] }
export interface MrrData { months: { month: string; planEur: number; actualEur: number | null }[]; status: string }
export interface ScenarioData { runs: { label: string; lowPoint: { month: string; cash: number }; mrrEnd: number; totals: { revenue: number; costs: number; net: number }; months: { month: string; mrr: number; cash: number }[] }[]; method: string }
export interface CapacityData { weeks: { key: string; label: string }[]; people: { id: string; name: string; rows: { week: string; cap: number; used: number; free: number }[] }[] }
export interface ClientsData { clients: { id: string; name: string; status: string; plan: string; health: { score: number; risk: string; reason: string } | null; currency: string | null; monthlyMinor: number | null; usageCostMinor: number | null; marginPct: number | null }[] }
export interface TimeData { month: string; rows: { label: string; type: string; hours: number; revenueMinor: number | null; perHourMinor: number | null; marginMinor: number | null; currency: string | null; status: string | null }[]; totalHours: number }
export interface TeamData { name: string; kpis: { label: string; latest: string | null; target: string; status: string | null }[]; agenda: string[] }
export interface TasksData { tasks: { id: string; title: string; ownerName: string | null; due: string | null; estimateHours: number | null; priority: string; status: string }[] }
export interface DecisionsData { decisions: { title: string; date: string; status: string; owner: string; reason: string; reviewDate: string; source: string }[] }
export interface DraftData { actionId: string; tasks?: { title: string; ownerName: string; hours: number; due: string }[]; title?: string }

// ---------------------------------------------------------------- the fake provider

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const money = (n: number, symbol: string) => `${symbol}${Math.round(n).toLocaleString("en-US")}`;
const fileOf = (path: string) => path.replace(/\.md$/, "");
const has = (q: string, re: RegExp) => re.test(q);

const ROLE_HATS: Record<AdvisorRole, string> = { CEO: "CEO", CFO: "CFO", COO: "OPERATIONS", CTO: "CTO", "CRO/CMO": "CRO/CMO", Risk: "RISK", People: "PEOPLE" };

type Intent =
  | "price" | "hire" | "cash" | "break_even" | "lead_source" | "capacity" | "plan" | "country_rules" | "bdr_focus" | "churn" | "roi"
  | "build_buy" | "decisions" | "margin" | "mrr_track" | "competitors" | "draft" | "commission" | "ai_calling" | "general";

/** First match wins; ordered so specific questions beat general words ("quote", "cost"). */
export const classify = (question: string): Intent => {
  const q = question.toLowerCase();
  if (has(q, /\bdraft\b|job post|write (an?|the) (sop|email|post)/)) return "draft";
  if (has(q, /\bai (bdr|agent|caller)|cold-?call.*\bai\b|\bai\b.*cold-?call|robocall/)) return "ai_calling";
  if (has(q, /can we (cold[- ]?)?(e-?mail|call|text)|allowed to (e-?mail|call)|cold[- ]?e-?mail/)) return "country_rules";
  if (has(q, /commission|clawback|claw back/)) return "commission";
  if (has(q, /\broi\b|worth (it|paying)|pay (for )?itself/)) return "roi";
  if (has(q, /build (our|my) own|build vs\.? buy|build or buy/)) return "build_buy";
  if (has(q, /\bmargin\b/)) return "margin";
  if (has(q, /break[- ]?even/)) return "break_even";
  if (has(q, /lead source|source converts|converts best|best source/)) return "lead_source";
  if (has(q, /churn|at risk/)) return "churn";
  if (has(q, /competitor|per minute|charge per/)) return "competitors";
  if (has(q, /\bdecid|decision/)) return "decisions";
  if (has(q, /on track|mrr .*\bby\b|10k|€10,000/)) return "mrr_track";
  if (has(q, /\bhire\b|\bhiring\b|setter #?\d/)) return "hire";
  if (has(q, /focus on|what should .*(bdr|diego|setter).*(do|work)|coach/)) return "bdr_focus";
  if (has(q, /^plan |\bplan the\b|plan (a|our)\b/)) return "plan";
  if (has(q, /capacity|over (his|her|their)? ?hours|free hours|weekend/)) return "capacity";
  if (has(q, /cash|reserve|runway|bank balance/)) return "cash";
  if (has(q, /price|quote|how much (is|for)/)) return "price";
  return "general";
};

const ITEM_WORDS: [RegExp, string][] = [
  [/\bstarter\b/, "rec_s"], [/\bstandard\b/, "rec_m"], [/\bpro\b/, "rec_p"], [/review/, "rev"], [/speed[- ]to[- ]lead/, "stl"], [/\bchat\b/, "chat"],
  [/3d (sales )?platform|sales platform/, "d3_p"], [/3d building/, "d3_b"], [/conversion page|landing page/, "lp_2"], [/lead site/, "lp_3"],
];
const marketOf = (q: string): { market: string; gulf: boolean } => {
  if (/switzerland|swiss|zurich|geneva/.test(q)) return { market: "ch", gulf: false };
  if (/kosovo|albania|prishtina|tirana/.test(q)) return { market: "xk", gulf: false };
  if (/\buk\b|germany|europe|london|austria|netherlands/.test(q)) return { market: "we", gulf: false };
  if (/dubai|uae|gulf|abu dhabi|saudi|qatar/.test(q)) return { market: "us", gulf: true };
  return { market: "us", gulf: false };
};

const firstPassage = (c: ToolCall) => (c.ok ? (c.data as PassageData).passages[0] : undefined);
const cites = (c: ToolCall) => (c.ok ? [...new Set((c.data as PassageData).passages.map((p) => fileOf(p.path)))].slice(0, 2).join(", ") : "—");
const refused = (...calls: ToolCall[]) => calls.some((c) => !c.ok && /403|role/.test(c.error ?? ""));

const refusal = (hats: string[]): Omit<AdvisorAnswer, "unsourced"> => ({
  kind: "refusal", hats, confidence: "high", short: NOT_FOR_ROLE, body: "Ask an admin if you need this for your work.", assumptions: [],
});

const short = (hats: string[], text: string, body: string, assumptions: Assumption[] = [], extra: Partial<AdvisorAnswer> = {}): Omit<AdvisorAnswer, "unsourced"> => ({
  kind: "short", hats, confidence: "high", short: text, body, assumptions, ...extra,
});

const nextSaturday = (now: number) => {
  const d = new Date(now);
  const day = d.getUTCDay();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ((6 - day + 7) % 7)));
};
const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);

export const createFakeAdvisorProvider = (): AdvisorProvider => ({
  name: "fake-advisor",
  async answer(ctx, run) {
    const q = ctx.question.toLowerCase();
    const hint = ctx.roleHint ? [ROLE_HATS[ctx.roleHint]] : null;
    const tokens = (out: number) => ({ input: 900 + ctx.question.length, cached: 14_000, output: out });
    const memo = (a: Omit<AdvisorAnswer, "unsourced" | "kind">): ProviderResult => ({ answer: { kind: "memo", ...a, hats: hint ?? a.hats }, kind: "memo", tokens: tokens(900) });
    const quick = (a: Omit<AdvisorAnswer, "unsourced">): ProviderResult => ({ answer: { ...a, hats: hint ?? a.hats }, kind: "quick", tokens: tokens(250) });

    if (ctx.mode === "briefing") return briefing(ctx, run, memo);
    if (ctx.mode === "month_end") return monthEnd(ctx, run, memo);
    if (ctx.mode === "alert") return alertAnswer(ctx, run, quick);

    switch (classify(ctx.question)) {
      case "price": {
        const { market, gulf } = marketOf(q);
        const items = ITEM_WORDS.filter(([re]) => re.test(q)).map(([, id]) => id);
        if (!items.length) items.push(/3d|developer|tower|residence|crest/.test(q) ? "d3_p" : "rec_m");
        const quote = await run("run_price_quote", { items, market, options: { pilot: /pilot/.test(q) } });
        if (!quote.ok) return quick(refused(quote) ? refusal(["CFO"]) : short(["CFO"], "I couldn't price that.", quote.error ?? ""));
        const d = quote.data as QuoteData;
        const calls = gulf ? [await run("search_knowledge", { query: "Dubai Gulf pricing open question" })] : [];
        const gulfNote = gulf ? ` Gulf pricing isn't researched yet (open question in ${calls[0].ok ? cites(calls[0]) : "context/07"}), so this uses the US list in USD.` : "";
        return quick(short(["CFO"], `${d.itemNames.join(" + ")}${d.pilot ? " (pilot)" : ""} in ${d.market}: ${money(d.setup, d.symbol)} setup and ${money(d.monthly, d.symbol)} a month.${gulfNote}`,
          `First year ${money(d.firstYear, d.symbol)} (run_price_quote, price book v2, same maths as the calculator).${d.note ? ` ${d.note}` : ""} Atlas proposes the quote; a founder sends it.`,
          gulf ? [{ text: "US list prices in USD for a Gulf client", source: "assumption until Gulf pricing is set" }] : []));
      }

      case "hire": {
        const [kpis, gates, finance] = [await run("get_kpis", { period: "week" }), await run("search_knowledge", { query: "stage gates Gate 1 hire setter" }), await run("get_finance", {})];
        const scen = await run("run_scenario", { scenario: "worst", compare: [{ label: "Wait for Gate 1", hires: [] }, { label: "Hire setter now", hires: [{ label: "Setter #1", fromMonth: 1, monthlyUsd: 350 }] }, { label: "List builder now", hires: [{ label: "List builder", fromMonth: 0, monthlyUsd: 175 }] }] });
        if (refused(scen, finance)) return quick(refusal(["CEO", "CFO"]));
        const k = kpis.data as KpiData | undefined;
        const gate1 = k?.gates.find((g) => /gate 1/i.test(g.label));
        const s = scen.data as ScenarioData;
        const [wait, now, lister] = s.runs;
        const deeper = Math.abs(now.lowPoint.cash - wait.lowPoint.cash);
        const f = finance.data as FinanceData | undefined;
        // Gate 1 = ≥3 paying clients AND 2 months of the new hire's pay in the bank on top of the reserve (context/07, backbone/03).
        const twoMonths = Math.round((2 * 350) / 1.15);
        const spare = f?.cash ? f.cash.balanceEur - f.reserveEur : null;
        const cashOk = spare !== null && spare >= twoMonths;
        const passed = Boolean(gate1?.met) && cashOk;
        const why = gate1?.met
          ? cashOk ? `Gate 1 is passed (${gate1.value} paying clients, cash covers 2 months of pay)` : `Gate 1's client count is met (${gate1.value}), but the cash rule isn't: ${eur(spare ?? 0)} above the reserve against ${eur(twoMonths)} needed`
          : `Gate 1 isn't passed yet${gate1 ? ` (${gate1.value} paying clients)` : ""}`;
        return memo({
          hats: ["CEO", "CFO", "OPERATIONS", "RISK"], confidence: "medium",
          short: passed
            ? `Hire setter #1 now: ${why}. Promote the BDR to closer at the same time.`
            : `Wait for Gate 1 in full: ${why}. Two cheap moves this week: a part-time list builder and start recruiting the setter bench.`,
          options: [
            { name: "A · Hire setter now", cost: "+$350 + bonus", effect: "3–4 weeks", risk: `Cash low point ${eur(now.lowPoint.cash)} in the slow case`, pick: passed ? "YES" : "NO" },
            { name: "B · Wait for Gate 1 in full", cost: "$0", effect: gate1?.met ? "when cash allows" : "~January", risk: "Lose ~2 weeks of setter output", pick: passed ? "NO" : "YES" },
            { name: "C · List builder now + bench", cost: "+$175", effect: "1 week", risk: `Low: low point ${eur(lister.lowPoint.cash)}`, pick: "WITH B" },
          ],
          fastest: "List builder now, setter at Gate 1. A setter books meetings about 3 weeks after starting.",
          profitable: `Same route. Hiring now deepens the cash low point by about ${eur(deeper)} before it pays back (run_scenario, worst case).`,
          risks: [
            "The BDR becomes the closing bottleneck above ~15 held meetings a month: promote him to closer at Gate 1.",
            `Gate rule (${cites(gates)}): recruit at client #1, hire on proof.`,
          ],
          measure: ["Paying clients (Gate 1 at 3)", "Approved meetings per week"],
          assumptions: [
            ...(f?.cash ? [{ text: `Cash ${eur(f.cash.balanceEur)} on ${f.cash.date}`, source: "get_finance · cash snapshot" }] : []),
            { text: `Reserve ${eur(f?.reserveEur ?? 3000)}`, source: f?.reserveSource ?? "backbone/03" },
            { text: "Setter ~$350/month full-time", source: "context/05, not confirmed" },
            { text: "List builder $175/month", source: "backbone/09 ROI example" },
            { text: `Low point ${eur(now.lowPoint.cash)} hiring now vs ${eur(wait.lowPoint.cash)} waiting: ${eur(deeper)} deeper`, source: "run_scenario, calculation" },
            { text: "The BDR can run about 15 held meetings a month next to his calling", source: "judgment" },
            { text: `2 months of setter pay: 2 × $350 ÷ 1.15 = ${eur(twoMonths)}${spare !== null ? ` · cash above reserve: ${eur(f!.cash!.balanceEur)} − ${eur(f!.reserveEur)} = ${eur(spare)}` : ""}`, source: "backbone/03 reserve rule, calculation" },
          ],
        });
      }

      case "cash": {
        const finance = await run("get_finance", {});
        if (!finance.ok) return quick(refused(finance) ? refusal(["CFO"]) : short(["CFO"], "No finance data yet.", finance.error ?? ""));
        const f = finance.data as FinanceData;
        if (!f.cash) return quick(short(["CFO"], "There's no cash snapshot yet. Add one in Admin › Finance data.", `Reserve target ${eur(f.reserveEur)} (${f.reserveSource}).`));
        const gap = f.cash.balanceEur - f.reserveEur;
        return quick(short(["CFO"], `${eur(f.cash.balanceEur)} in the bank on ${f.cash.date}: ${gap >= 0 ? `${eur(gap)} above` : `${eur(-gap)} below`} the ${eur(f.reserveEur)} reserve.`,
          `Recurring costs ${eur(f.recurringCostsEur)} a month (get_finance). The reserve rule: keep it aside, and before each hire add 2 months of that person's pay (${f.reserveSource}).`,
          [{ text: `Reserve ${eur(f.reserveEur)}`, source: f.reserveSource }, { text: `${eur(f.cash.balanceEur)} − ${eur(f.reserveEur)} = ${eur(gap)}`, source: "calculation" }]));
      }

      case "break_even": {
        const [finance, formula] = [await run("get_finance", {}), await run("search_knowledge", { query: "break-even fixed costs contribution per client" })];
        if (refused(finance)) return quick(refusal(["CFO"]));
        const f = finance.data as FinanceData;
        const contribution = 610;
        const clients = Math.ceil(f.recurringCostsEur / contribution);
        return quick(short(["CFO"], `About ${clients} paying Gllarix client${clients === 1 ? "" : "s"} at today's costs.`,
          `Formula (${cites(formula)}): fixed costs ÷ contribution per client. Fixed costs ${eur(f.recurringCostsEur)} a month (get_finance, recurring expenses) ÷ ${eur(contribution)} contribution = ${(f.recurringCostsEur / contribution).toFixed(1)}, so ${clients}. You have ${f.payingClients} paying now.`,
          [{ text: `Contribution ${eur(contribution)} per client a month ($800 − ~$100 usage)`, source: "backbone/03 unit economics, assumption" }, { text: `${eur(f.recurringCostsEur)} ÷ ${eur(contribution)} = ${(f.recurringCostsEur / contribution).toFixed(1)}`, source: "calculation" }]));
      }

      case "lead_source": {
        const kpis = await run("get_kpis", { period: "month", by: "source" });
        if (!kpis.ok) return quick(refusal(["CRO/CMO"]));
        const rows = ((kpis.data as KpiData).bySource ?? []).filter((r) => r.contacted >= 10 && r.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
        if (!rows.length) return quick(short(["CRO/CMO"], "Not enough contacted leads per source yet to compare (10+ each).", "get_kpis by source"));
        const best = rows[0];
        return quick(short(["CRO/CMO"], `${best.source} converts best: ${Math.round((best.rate ?? 0) * 100)}% of contacted leads booked a meeting (${best.meetings} of ${best.contacted}).`,
          rows.slice(0, 4).map((r) => `${r.source}: ${r.meetings}/${r.contacted} · ${Math.round((r.rate ?? 0) * 100)}%`).join("\n")));
      }

      case "capacity": {
        const person = /rinor/.test(q) ? "Rinor" : /diego|bdr/.test(q) ? "Diego" : /lena/.test(q) ? "Lena" : /artin|co-?founder/.test(q) ? "Artin" : ctx.user.name;
        const cap = await run("get_capacity", { weeks: 3 });
        if (!cap.ok) return quick(refusal(["COO"]));
        const d = cap.data as CapacityData;
        const p = d.people.find((x) => x.name.toLowerCase().startsWith(person.toLowerCase()));
        if (!p) return quick(short(["COO"], `I can't see ${person}'s capacity.`, NOT_FOR_ROLE));
        // "Next weekend" is the coming Saturday's week; "next week" the week after this one.
        const sat = nextSaturday(ctx.now);
        const row = (/next week\b/.test(q) ? p.rows[1] : p.rows[0]) ?? p.rows[0];
        const label = d.weeks.find((w) => w.key === row.week)?.label ?? row.week;
        const over = row.used - row.cap;
        return quick(short(["COO"], `${over > 0 ? "Yes" : "No"}: ${p.name} has ${row.used} h booked of ${row.cap} h in ${label}${/weekend/.test(q) ? ` (weekend of ${fmtDay(sat)})` : ""}${over > 0 ? `, ${over} h over` : `, ${row.free} h free`}.`,
          p.rows.slice(1).map((r) => `${d.weeks.find((w) => w.key === r.week)?.label ?? r.week}: ${r.used} / ${r.cap} h`).join("\n")));
      }

      case "plan": {
        const due = ctx.question.match(/by (\d{1,2} \w{3,9})/i)?.[1] ?? null;
        const goal = ctx.question.replace(/^plan (the |a |our )?/i, "").replace(/ by .*$/i, "").trim();
        const cap = await run("get_capacity", { weeks: 6 });
        const draft = await run("propose_tasks", {
          goal, due,
          tasks: [
            { title: `Scope and brief: ${goal}`, owner: "cofounder", hours: 1.5 },
            { title: `Build: ${goal}`, owner: "rinor", hours: 10 },
            { title: `Review and publish: ${goal}`, owner: "cofounder", hours: 2 },
          ],
        });
        const d = (draft.data as DraftData | undefined)?.tasks ?? [];
        const capData = cap.data as CapacityData | undefined;
        const rinor = capData?.people.find((p) => p.name.startsWith("Rinor"));
        const tight = rinor?.rows.filter((r) => r.free < 2).map((r) => capData!.weeks.find((w) => w.key === r.week)?.label ?? r.week) ?? [];
        return memo({
          hats: ["COO", "CTO"], confidence: "medium",
          short: `${d.length} tasks, dated to fit everyone's free hours${due ? ` before ${due}` : ""}: ${d.map((t) => `${t.ownerName.split(" ")[0]} ${t.hours} h by ${t.due}`).join(", ")}. Accept them to create the tasks; nothing is created until you do.`,
          fastest: "Start the brief this week so Rinor's build lands on his next free weekend.",
          profitable: "Same: the showcase unlocks the worldwide 3D outreach that the realistic scenario counts on.",
          risks: tight.length ? [`Rinor is full in ${tight.join(", ")}: the build moves to his next free weekend.`] : ["Delivery slips if files from the developer arrive late."],
          measure: ["Showcase live by the date", "Developer meetings booked from the showcase"],
          assumptions: [{ text: "Hours per task are estimates", source: "judgment; edit them after accepting" }],
        });
      }

      case "country_rules": {
        const rules = await run("search_knowledge", { query: `country channel rules cold email cold calls ${q.match(/switzerland|swiss|germany|austria|uk|canada|us|uae|kosovo|albania/)?.[0] ?? ""}` });
        const p = rules.ok ? (rules.data as PassageData).passages.find((x) => /\| *(Switzerland|Germany|UK|Canada|US|UAE|Kosovo)/i.test(x.text)) ?? firstPassage(rules) : undefined;
        const country = /swiss|switzerland/.test(q) ? "Switzerland" : /german|austria/.test(q) ? "Germany" : /\buk\b|britain/.test(q) ? "UK" : /canada/.test(q) ? "Canada" : /uae|dubai/.test(q) ? "UAE" : /kosovo|albania/.test(q) ? "Kosovo" : "US";
        const row = p?.text.split("\n").find((l) => l.toLowerCase().includes(country.toLowerCase()));
        const cells = row?.split("|").map((x) => x.trim()).filter(Boolean) ?? [];
        const email = /mail/.test(q);
        const verdict = email ? cells[2] : cells[1];
        const no = verdict ? /^no\b|no mass/i.test(verdict) : false;
        return quick(short(["RISK", "CRO/CMO"], `${no ? "No" : verdict ? "Yes, with conditions" : "Not covered"}: ${country} ${email ? "cold email" : "cold calls"} · "${verdict ?? "no rule found"}".`,
          `Country channel rules (${p ? fileOf(p.path) : "not found"}). ${row ? `${country}: calls "${cells[1]}", email "${cells[2]}".` : ""} Atlas enforces these before anything is queued or sent.`, [],
          { professional: PROFESSIONAL }));
      }

      case "bdr_focus": {
        const perf = await run("get_team_performance", { person: "u-bdr" });
        if (!perf.ok) return quick(refusal(["PEOPLE"]));
        const d = perf.data as TeamData;
        const watch = d.kpis.filter((k) => k.status === "watch");
        return quick(short(["PEOPLE", "CRO/CMO"], watch.length ? `${d.name} should focus on ${watch.map((k) => k.label.toLowerCase()).slice(0, 2).join(" and ")} this week.` : `${d.name} is on track: keep the same plan this week.`,
          [...d.kpis.map((k) => `${k.label}: ${k.latest ?? "—"} (target ${k.target})`), ...(d.agenda.length ? ["1:1 agenda:", ...d.agenda.slice(0, 3)] : [])].join("\n")));
      }

      case "churn": {
        const clients = await run("get_clients", { risk: "any" });
        if (!clients.ok) return quick(refusal(["CRO/CMO"]));
        const rows = (clients.data as ClientsData).clients.filter((c) => c.health).sort((a, b) => a.health!.score - b.health!.score);
        const risky = rows.filter((c) => c.health!.risk !== "low");
        if (!rows.length) return quick(short(["CRO/CMO"], "No live clients with a health score yet.", "get_clients"));
        return quick(short(["CRO/CMO"], risky.length ? `${risky[0].name} is most at risk: health ${risky[0].health!.score}, ${risky[0].health!.reason}.` : `No client is at churn risk: the lowest health score is ${rows[0].health!.score} (${rows[0].name}).`,
          rows.slice(0, 4).map((c) => `${c.name}: ${c.health!.score} · ${c.health!.risk} · ${c.health!.reason}`).join("\n")));
      }

      case "roi": {
        const monthly = Number(q.match(/\$(\d+)/)?.[1] ?? 150);
        const what = q.match(/\$\d+\s*(?:\/|a |per )?\s*month(?:ly)?\s+(.+?)\??$/)?.[1] ?? "spend";
        const [test, scen, price] = [await run("search_knowledge", { query: "ROI test for any spend payback hire list builder" }), await run("run_scenario", { scenario: "realistic", compare: [{ label: "Without", hires: [] }, { label: `With ${what}`, hires: [{ label: what, fromMonth: 0, monthlyUsd: monthly }] }] }), await run("run_price_quote", { items: ["rec_m"], market: "us" })];
        if (refused(scen)) return quick(refusal(["CFO"]));
        const s = scen.data as ScenarioData;
        const p = price.data as QuoteData | undefined;
        const sixMonths = monthly * 6;
        const gain = p ? p.setup + 5 * p.monthly : 0;
        const roi = gain ? (gain - sixMonths) / sixMonths : 0;
        const cashDiff = s.runs[1].months[11].cash - s.runs[0].months[11].cash;
        return memo({
          hats: ["CFO"], confidence: "medium",
          short: `Worth it if it adds at least one Standard client in 6 months: ROI ${roi.toFixed(1)}× on $${sixMonths.toLocaleString("en-US")}. Set a stop rule at 8 weeks.`,
          options: [
            { name: `A · Buy the ${what}`, cost: `$${monthly}/mo`, effect: "2–4 weeks", risk: `12-month cash ${eur(cashDiff)} if it adds nothing`, pick: "YES" },
            { name: "B · Keep building lists by hand", cost: "$0", effect: "now", risk: "Founder hours on list work", pick: "NO" },
          ],
          fastest: "Buy it now with a stop rule: cancel if approved meetings don't rise within 8 weeks.",
          profitable: "Same, as long as it adds one client in the payback window.",
          risks: ["List quality: check bounce and wrong-number rates in the first 2 weeks.", `Payback must be under 6 months for hires and 3 months for tools (${cites(test)}).`],
          measure: ["Approved meetings per month from its lists", "Cost per approved meeting"],
          assumptions: [
            { text: `ROI = (extra gross profit − cost) ÷ cost: (${p?.setup ?? 0} + 5 × ${p?.monthly ?? 0} − ${sixMonths}) ÷ ${sixMonths} = ${roi.toFixed(1)}×`, source: "backbone/09 ROI test · run_price_quote" },
            { text: "One extra Standard client within 6 months", source: "assumption" },
            { text: `Cash after 12 months ${eur(s.runs[1].months[11].cash)} with it vs ${eur(s.runs[0].months[11].cash)} without: ${eur(cashDiff)}`, source: "run_scenario, calculation" },
          ],
        });
      }

      case "build_buy": {
        const k = await run("search_knowledge", { query: `build vs buy ${q.match(/email sender|email|dialer|telephony|crm|transcription/)?.[0] ?? ""} never build email server inboxes` });
        const sources = cites(k);
        return quick(short(["CTO"], "Buy it. Email sending is a commodity: Atlas builds the queue, scoring and reports, and buys inboxes (Google Workspace) and email verification.",
          `Build vs buy (${sources}): build the CRM, lead engine, scoring, queues, metering and reports; buy telephony, payments, inboxes, transcription, verification and the voice platform; never build your own phone system or email server.`));
      }

      case "decisions": {
        const topic = q.replace(/what did we decide (about|on)?|decision(s)? (about|on)?|\?/g, "").trim();
        const dec = await run("get_decisions", { query: topic });
        const d = (dec.data as DecisionsData | undefined)?.decisions ?? [];
        if (!d.length) return quick(short(["CEO"], `No decision about "${topic}" in the log.`, "get_decisions"));
        return quick(short(["CEO"], `${d[0].title} (${d[0].status}, ${d[0].date}, ${d[0].owner}).`,
          d.slice(0, 3).map((x) => `${x.title} · ${x.status} · review ${x.reviewDate} · reason: ${x.reason}`).join("\n")));
      }

      case "margin": {
        const name = ctx.question.match(/(?:on|for) ([A-Z][\w&.-]*(?: [A-Z][\w&.-]*)*)/)?.[1] ?? "";
        const month = new Date(ctx.now).toISOString().slice(0, 7);
        const [clients, time] = [await run("get_clients", { name }), await run("get_time_report", { month, group_by: "client" })];
        if (refused(time) && refused(clients)) return quick(refusal(["CFO"]));
        let t = time.data as TimeData | undefined;
        let row = t?.rows.find((r) => r.label.toLowerCase().includes(name.toLowerCase()));
        let note = "";
        if (!row) {
          const prev = new Date(Date.UTC(new Date(ctx.now).getUTCFullYear(), new Date(ctx.now).getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
          const last = await run("get_time_report", { month: prev, group_by: "client" });
          t = last.data as TimeData | undefined;
          row = t?.rows.find((r) => r.label.toLowerCase().includes(name.toLowerCase()));
          note = row ? ` No hours logged on it in ${month} yet, so this is ${prev}.` : "";
        }
        const c = (clients.data as ClientsData | undefined)?.clients.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
        const sym = row?.currency === "EUR" ? "€" : "$";
        if (!row && !c) return quick(short(["CFO"], `I can't find ${name || "that client"} in clients or the time report.`, "get_clients · get_time_report"));
        return quick(short(["CFO"], row ? `${row.label}: ${row.hours} h logged${row.perHourMinor !== null ? ` at ${sym}${Math.round(row.perHourMinor / 100)} per hour` : ""}${row.marginMinor !== null ? `, margin after team cost ${sym}${Math.round(row.marginMinor / 100).toLocaleString("en-US")}` : ""}.${note}` : `${c!.name}: no hours logged yet.`,
          [row ? `Time report (${t?.month}): ${row.hours} h · status ${row.status ?? "—"}` : "", c ? `Client: ${c.plan} · ${c.marginPct !== null ? `${c.marginPct}% margin after usage` : "no usage margin yet"}` : "Not a recurring client in Atlas (project only)."].filter(Boolean).join("\n")));
      }

      case "mrr_track": {
        const [mrr, plan] = [await run("get_mrr_history", { months: 12 }), await run("search_knowledge", { query: "€10k MRR by June checkpoints" })];
        if (refused(mrr)) return quick(refusal(["CFO"]));
        const d = mrr.data as MrrData;
        const actual = d.months.filter((m) => m.actualEur !== null);
        const last = actual[actual.length - 1];
        const june = d.months.find((m) => m.month.endsWith("-06"));
        return quick(short(["CFO", "CEO"], `${d.status === "behind" ? "Behind" : d.status === "ahead" ? "Ahead" : "On plan"}: MRR ${eur(last?.actualEur ?? 0)} in ${last?.month ?? "—"} against ${eur(last?.planEur ?? 0)} planned${june ? `; the plan reaches ${eur(june.planEur)} in ${june.month}` : ""}.`,
          `Checkpoints (${cites(plan)}): ${d.months.filter((m) => /-(12|03|06)$/.test(m.month)).map((m) => `${m.month} ${eur(m.planEur)}`).join(" · ")}.`));
      }

      case "competitors": {
        const notes = await run("get_market_notes", { topic: "AI receptionist per-minute overage pricing competitors" });
        const lines = notes.ok ? (notes.data as PassageData).passages.flatMap((p) => p.text.split("\n").filter((l) => /\/min/.test(l)).map((l) => `${l.replace(/\|/g, " ").replace(/\s+/g, " ").trim()} (${fileOf(p.path)})`)) : [];
        return quick(short(["CRO/CMO"], lines.length ? "Per-minute prices we have on file: overage around $0.25/min, platform costs $0.05–0.31/min." : "No per-minute competitor prices on file.",
          [...new Set(lines)].slice(0, 5).join("\n"), [], { assumptions: [{ text: "Vendor prices checked 2026-09-27; may have changed", source: "context/05 market benchmarks" }] }));
      }

      case "draft": {
        const topic = /setter/.test(q) ? "setter job post hiring profile pay" : ctx.question;
        const ref = await run("search_knowledge", { query: topic });
        const title = /job post/.test(q) ? `${/setter/.test(q) ? "Setter #1" : "Role"} job post` : `Draft: ${ctx.question.slice(0, 60)}`;
        const content = /job post/.test(q)
          ? `# ${title}\n\nAppointment setter (remote, part-time to full-time) for Gllarix, an AI receptionist for US home-service businesses.\n\nWhat you'll do: call trade businesses from a ready queue in Atlas, book qualified meetings for our closer, log every call.\n\nWhat we look for: clear spoken English, resilience, a quiet setup, 4+ hours overlap with US Eastern time.\n\nPay: base plus a bonus per approved meeting (rules in the BDR plan). Commission only on cash collected.\n\nProcess: short form → recorded roleplay → paid trial week.\n\n(Based on ${cites(ref)}.)`
          : `# ${title}\n\n(Outline based on ${cites(ref)}.)`;
        const draft = await run("draft_document", { kind: /job post/.test(q) ? "job_post" : "document", title, content });
        return quick(short(["PEOPLE"], `Drafted "${title}". Accept it to save it; nothing is posted or sent.`, `Built from ${cites(ref)}. Pay figures stay as rules, not numbers, until the founders confirm them.`, [],
          { body: draft.ok ? `Draft ready to review (${cites(ref)}).` : draft.error }));
      }

      case "commission": {
        const rules = await run("search_knowledge", { query: "commission client cancels within 30 days clawed back cash collected" });
        return quick(short(["CFO", "PEOPLE"], "It's clawed back: week 3 is inside the 30-day window, so the commission on that client is reversed.",
          `Rule (${cites(rules)}): commission is paid only on cash collected, and clawed back if the client cancels within 30 days. Meeting bonuses for approved meetings stay.`));
      }

      case "ai_calling": {
        const rules = await run("search_knowledge", { query: "AI BDR cold call US mobile prior express written consent TCPA" });
        return quick(short(["RISK"], "No. AI cold calls to US mobiles need prior express written consent (TCPA: AI voices count as artificial voice). The AI BDR works consented and inbound calls and assists the human BDR.",
          `Rules (${cites(rules)}). Cold calling stays human and dialed by hand.`, [], { professional: PROFESSIONAL }));
      }

      default: {
        const k = await run("search_knowledge", { query: ctx.question });
        const ps = k.ok ? (k.data as PassageData).passages : [];
        if (!ps.length) return quick(short(["CEO"], "I don't have anything on that in the company files or tools.", "Try asking with a client, a number or a file name."));
        const legal = /legal|tax|contract|gdpr|vat|ai act|law/.test(q);
        return quick(short(["CEO"], `From ${fileOf(ps[0].path)} · ${ps[0].heading}:`, ps.slice(0, 2).map((p) => `${p.text.split("\n").slice(0, 4).join(" ")} (${fileOf(p.path)})`).join("\n\n"), [],
          legal ? { professional: PROFESSIONAL } : {}));
      }
    }
  },
});

// ---------------------------------------------------------------- scheduled modes

type MemoFn = (a: Omit<AdvisorAnswer, "unsourced" | "kind">) => ProviderResult;

async function briefing(_ctx: AdvisorContext, run: ToolRun, memo: MemoFn): Promise<ProviderResult> {
  const kpis = await run("get_kpis", { period: "week", last: true });
  const finance = await run("get_finance", {});
  const clients = await run("get_clients", { risk: "any" });
  const tasks = await run("get_tasks", { pick: "this_week", limit: 3 });
  const k = kpis.data as KpiData | undefined;
  const f = finance.data as FinanceData | undefined;
  const risky = ((clients.data as ClientsData | undefined)?.clients ?? []).filter((c) => c.health && c.health.risk !== "low");
  const picks = (tasks.data as TasksData | undefined)?.tasks ?? [];
  const behind = (k?.kpis ?? []).filter((x) => x.status === "behind" || x.status === "watch");
  const risks = [
    ...(f?.cash && f.cash.balanceEur < f.reserveEur ? [`Cash ${eur(f.cash.balanceEur)} is below the ${eur(f.reserveEur)} reserve: no new fixed costs.`] : []),
    ...risky.slice(0, 1).map((c) => `${c.name} at churn risk (health ${c.health!.score}): book a health call.`),
    ...behind.slice(0, 2).map((x) => `${x.label} behind target (${x.value ?? "—"} vs ${x.target}).`),
  ].slice(0, 3);
  return memo({
    hats: ["CEO", "CFO", "OPERATIONS"], confidence: "high",
    short: `${k?.period ?? "Last week"}: ${(k?.kpis ?? []).slice(0, 3).map((x) => `${x.label} ${x.value ?? "—"} (target ${x.target})`).join(" · ")}.`,
    options: (k?.gates ?? []).map((g) => ({ name: g.label, cost: g.value, effect: g.note, risk: g.met ? "Passed" : "Not yet", pick: g.met ? "YES" : "NO" })),
    fastest: picks.length ? `This week's 3 tasks: ${picks.map((t) => `${t.title} (${t.ownerName ?? "—"}${t.estimateHours ? `, ${t.estimateHours} h` : ""})`).join("; ")}.` : "No open tasks fit this week's hours.",
    profitable: f?.cash ? `Cash ${eur(f.cash.balanceEur)} vs reserve ${eur(f.reserveEur)} · MRR ${eur(f.mrrEur)}.` : "No cash snapshot: add one in Admin › Finance data.",
    risks: risks.length ? risks : ["No red flags this week."],
    measure: ["Approved meetings this week", "Paying clients"],
    assumptions: f ? [{ text: `Reserve ${eur(f.reserveEur)}`, source: f.reserveSource }] : [],
  });
}

async function monthEnd(ctx: AdvisorContext, run: ToolRun, memo: MemoFn): Promise<ProviderResult> {
  const month = ctx.question.match(/\d{4}-\d{2}/)?.[0] ?? "";
  const finance = await run("get_finance", { month });
  const time = await run("get_time_report", { month, group_by: "client" });
  const scen = await run("run_scenario", { scenario: "realistic" });
  const acct = await run("search_knowledge", { query: "accountant legal entity VAT invoicing month-end close" });
  const f = finance.data as FinanceData | undefined;
  const t = time.data as TimeData | undefined;
  const s = scen.data as ScenarioData | undefined;
  const idx = (Number(month.slice(0, 4)) - 2026) * 12 + Number(month.slice(5)) - 10;
  const planned = idx >= 0 && idx < 12 ? s?.runs[0].months[idx] : undefined;
  return memo({
    hats: ["CFO"], confidence: "high",
    short: f ? `${month}: revenue ${eur(f.revenueEur)}, costs ${eur(f.costsEur)}, MRR ${eur(f.mrrEur)}${f.cash ? `, cash ${eur(f.cash.balanceEur)}` : ""}.` : `${month}: no finance data.`,
    options: (f?.byCategory ?? []).map((c) => ({ name: c.category, cost: eur(c.eur), effect: "—", risk: "—", pick: "YES" as const })),
    fastest: planned ? `Versus the realistic scenario: MRR plan ${eur(planned.mrr)}, actual ${eur(f?.mrrEur ?? 0)}.` : "The scenario plan starts in Oct 2026: no variance for this month.",
    profitable: (t?.rows ?? []).filter((r) => r.perHourMinor !== null).map((r) => `${r.label} ${r.currency === "EUR" ? "€" : "$"}${Math.round(r.perHourMinor! / 100)}/h`).join(" · ") || "No client hours this month.",
    risks: [`Questions for the accountant (${cites(acct)}): which entity invoices US, UK, CH and UAE clients; VAT and US sales tax on software and services; how to book contractor pay to Venezuela.`],
    measure: ["Gross margin ≥70%", "Cash vs reserve"],
    assumptions: f ? [{ text: `Reserve ${eur(f.reserveEur)}`, source: f.reserveSource }] : [],
    professional: PROFESSIONAL,
  });
}

async function alertAnswer(ctx: AdvisorContext, run: ToolRun, quick: (a: Omit<AdvisorAnswer, "unsourced">) => ProviderResult): Promise<ProviderResult> {
  const kind = ctx.alert?.kind ?? "";
  const tool: ToolName = kind === "cash" ? "get_finance" : kind === "churn" ? "get_clients" : kind === "gate" ? "get_kpis" : kind === "slip" ? "get_tasks" : "get_finance";
  const call = await run(tool, kind === "slip" ? { overdue_days: 7 } : {});
  const action: Record<string, string> = {
    cash: "Freeze new fixed costs and chase open invoices this week.",
    gate: "Review the gate's 'then add' step in context/07 and log the hire as a proposed decision.",
    churn: "Book a health call with the client this week.",
    cap: "AI questions are paused until next month, or an admin raises the cap.",
    slip: "Re-plan the late tasks or move the due date; tell the owner.",
  };
  return quick({ kind: "short", hats: ["RISK"], confidence: "high", short: ctx.alert?.detail ?? "Alert", body: `Recommended action: ${action[kind] ?? "Review it."}${call.ok ? ` (${call.summary})` : ""}`, assumptions: [] });
}

export type { MemoOption };
