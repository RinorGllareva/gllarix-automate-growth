import { AI_JOBS, type AiJob, type OwnerKey } from "@/config/ai";
import type { PlanChangeJson, PlanJson, PlanTaskJson, PlannerRequest } from "./planner";

/**
 * AIProvider (CRM_BUILD_PROMPT A16). The real provider calls the Anthropic API from a Supabase Edge Function, which holds
 * the system prompt (prompts/TASK_PLANNER_SYSTEM_PROMPT.md) and the API key; the browser never sees either.
 * The fake provider below is deterministic and is used in demo mode and tests.
 */
export interface AiResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMinor: number;
}

export interface AIProvider {
  complete(job: AiJob, req: PlannerRequest, retryErrors?: string[]): Promise<AiResponse>;
}

export const costOf = (job: AiJob, inputTokens: number, outputTokens: number) =>
  Math.round(((inputTokens * AI_JOBS[job].inputPerMTokMinor + outputTokens * AI_JOBS[job].outputPerMTokMinor) / 1_000_000) * 100) / 100;

const t = (key: string, title: string, owner: OwnerKey, hours: number, deps: string[], category: PlanTaskJson["category"], extra: Partial<PlanTaskJson> = {}): PlanTaskJson => ({
  key, title, description: extra.description ?? `${title}.`, acceptance: extra.acceptance ?? [`${title} is done and linked on the task`], owner, category,
  priority: extra.priority ?? "High", estimate_hours: hours, confidence: extra.confidence ?? "medium", depends_on: deps, ...extra,
});

/** The 3D showcase plan from the Planner mockup (screen 20 acceptance). */
const showcasePlan = (req: PlannerRequest): PlanJson => {
  const rules = req.existingWork.find((w) => /country rules/i.test(w.title));
  return {
    outcome: "3 meetings booked with Dubai developers by 31 Oct",
    tasks: [
      t("1", "Choose a sample building and write the scope", "cofounder", 2, [], "Research", { description: "Pick one realistic off-plan building (about 30 units) and write what the showcase must show: exterior, 3 unit types, availability.", acceptance: ["Building chosen", "One-page scope approved by Rinor"] }),
      t("2", "Brief a freelance 3D artist and get a quote", "cofounder", 1, ["1"], "Operations", { description: "Send the scope to two freelance 3D artists and ask for a fixed quote and dates. Budget: [€ quote].", acceptance: ["Two quotes received", "One artist booked"] }),
      t("3", "Model the building in 3D", "freelancer", 16, ["2"], "Delivery", { description: "Exterior and 3 unit interiors, web-ready (glTF), from the scope.", acceptance: ["Model loads in the browser under 10 MB", "Unit names match the scope"], confidence: "low" }),
      t("4", "List 40 Dubai developers from public sources", "cofounder", 3, [], "Lead gen", { description: "DLD project list and developer websites; name, website, sales contact. Licensed or public data only.", acceptance: ["40 developers in a CSV with source noted"] }),
      t("5", "Build the showcase landing page", "rinor", 4, ["1"], "Development", { description: "One page with the 3D viewer slot, the offer and a booking link.", acceptance: ["Page live on a preview URL", "Booking link works"] }),
      t("6", "Build the unit picker with live availability", "codex", 2, ["3"], "Development", { description: "Unit picker over the 3D model with available/sold states from a JSON file. Clear spec in the task; Rinor reviews.", acceptance: ["Picker shows availability from JSON", "Review passed"], reviewer: "rinor" }),
      t("7", "Record a 90-second walkthrough video", "cofounder", 1, ["6"], "Sales", { description: "Screen recording of the showcase for the outreach email.", acceptance: ["Video under 90 seconds", "Uploaded and linked"] }),
      t("8", "Write the outreach sequence (UAE rules checked)", "cofounder", 2, rules ? ["4", rules.id] : ["4"], "Sales", { description: "Three-step email and call sequence for developers. Only after the UAE outreach rules are confirmed.", acceptance: ["Sequence approved", "Country rules confirmed for AE"] }),
      t("9", "Contact 20 developers and book 3 meetings", "cofounder", 5, ["7", "8"], "Sales", { description: "Send the sequence to 20 developers from the list and follow up by phone.", acceptance: ["20 contacted", "3 meetings booked"] }),
    ],
    risks: [
      `UAE outreach rules aren't verified yet. Task 8 waits on "${rules?.title ?? "Confirm country rules"}".`,
      "Freelancer cost isn't in the budget yet: add a quote, [€ amount].",
    ],
    open_questions: ["What is the freelancer budget? [€ amount]", "Which building do we model?"],
  };
};

const ownerFor = (text: string, people: OwnerKey[]): OwnerKey => {
  const pick = (o: OwnerKey) => (people.length === 0 || people.includes(o) ? o : people[0]);
  if (/@rinor|\b(build|code|develop|deploy|fix|api|page)\b/i.test(text)) return pick("rinor");
  if (/@(diego|bdr)|\b(call|dial)\b/i.test(text)) return pick("bdr");
  return pick("cofounder");
};
const categoryFor = (text: string): PlanTaskJson["category"] =>
  /\b(build|code|develop|deploy|fix|page)\b/i.test(text) ? "Development" : /\b(call|email|outreach|meeting|sell)\b/i.test(text) ? "Sales" : /\b(list|leads)\b/i.test(text) ? "Lead gen" : /\b(price|invoice|budget)\b/i.test(text) ? "Finance" : /\b(research|compare|check)\b/i.test(text) ? "Research" : "Operations";
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const genericPlan = (req: PlannerRequest): PlanJson => {
  const parts = req.idea
    .replace(/\bdone by\b.*$/i, "")
    .split(/[,;.]|\band then\b|\bthen\b/i)
    .map((s) => s.trim().replace(/^(and|to)\s+/i, ""))
    .filter((s) => s.length > 3)
    .slice(0, 6);
  return {
    outcome: titleCase(parts[0] ?? req.idea.slice(0, 80)),
    tasks: parts.map((p, i) => t(String(i + 1), titleCase(p).slice(0, 90), ownerFor(p, req.settings.people), 2, i ? [String(i)] : [], categoryFor(p), { priority: "Normal" })),
    risks: [],
    open_questions: [],
  };
};

/** Tasks from notes: bullet lines, "TODO" and "Action:" lines; @name picks the owner. */
const notesPlan = (req: PlannerRequest): PlanJson => {
  const lines = req.idea
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|todo\b|action:|\[ \])/i.test(l))
    .map((l) => l.replace(/^([-*•]|todo:?|action:|\[ \])\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 20);
  return {
    outcome: "Follow-ups from the notes are done",
    tasks: lines.map((l, i) => t(String(i + 1), titleCase(l.replace(/@\w+/g, "").trim()).slice(0, 90), ownerFor(l, req.settings.people), 1, [], categoryFor(l), { priority: "Normal", description: `From the notes: "${l.slice(0, 200)}"` })),
    risks: lines.length ? [] : ["No action items found. Start lines with -, TODO or Action:."],
    open_questions: [],
  };
};

const splitPlan = (req: PlannerRequest): PlanJson => {
  const parent = JSON.parse(req.context.parent ?? "{}") as { title?: string; hours?: number; owner?: OwnerKey; description?: string; category?: PlanTaskJson["category"] };
  const hours = Math.max(1, parent.hours ?? 4);
  const sentences = (parent.description ?? "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 12).slice(0, 6);
  const phases = sentences.length >= 2 ? sentences.map((s) => s.replace(/\.$/, "")) : ["Plan and scope", "Build the first version", "Test and fix", "Review and hand over"];
  const weights = phases.map((_, i) => (sentences.length >= 2 ? 1 : [0.15, 0.45, 0.25, 0.15][i] ?? 0.25));
  const total = weights.reduce((a, b) => a + b, 0);
  let left = hours;
  return {
    outcome: parent.title ?? "Split",
    tasks: phases.map((p, i) => {
      const h = i === phases.length - 1 ? Math.max(0.5, Math.round(left * 2) / 2) : Math.max(0.5, Math.round(((hours * weights[i]) / total) * 2) / 2);
      left -= h;
      return t(String(i + 1), titleCase(p).slice(0, 90), parent.owner ?? "rinor", h, [], parent.category ?? "Development", { priority: "Normal" });
    }),
    risks: [],
    open_questions: [],
  };
};

const replanPlan = (req: PlannerRequest): PlanJson => {
  const conflicts = JSON.parse(req.context.conflicts ?? "[]") as { type: string; taskId?: string; personId?: string; week?: string; due?: string; finish?: string; suggestion?: { taskId: string; days?: number; to?: string } }[];
  const changes: PlanChangeJson[] = [];
  for (const c of conflicts) {
    if (c.type === "late" && c.taskId && c.finish) changes.push({ task_id: c.taskId, action: "move_deadline", value: c.finish, reason: `It can't be done by ${c.due}; the earliest finish is ${c.finish}.` });
    if (c.type === "over_capacity" && c.suggestion?.days && c.suggestion.taskId) changes.push({ task_id: c.suggestion.taskId, action: "move", value: String(c.suggestion.days), reason: `Over capacity in ${c.week}; a week later there is room.` });
    if (c.type === "over_capacity" && c.suggestion?.to && c.suggestion.taskId) changes.push({ task_id: c.suggestion.taskId, action: "reassign", value: c.suggestion.to, reason: `Over capacity in ${c.week}; the other person has the skill and free hours.` });
  }
  return { outcome: "Smallest set of changes to fit capacity and deadlines", tasks: [], risks: changes.length ? [] : ["Nothing to change: the plan fits."], open_questions: [], changes };
};

const weeklyPlan = (req: PlannerRequest): PlanJson => {
  const free = new Map(req.team.map((m) => [m.name, Object.values(m.freeByWeek)[0] ?? 0]));
  const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const picks: PlanTaskJson[] = [];
  for (const w of [...req.existingWork].sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || (a.due ?? "9").localeCompare(b.due ?? "9"))) {
    if (!w.owner || w.hours <= 0) continue;
    const left = free.get(w.owner) ?? 0;
    if (left < w.hours) continue;
    free.set(w.owner, left - w.hours);
    const member = req.team.find((m) => m.name === w.owner);
    picks.push(t(`w${picks.length + 1}`, w.title.slice(0, 90), member?.key ?? "cofounder", Math.min(40, Math.max(0.5, w.hours)), [], "Operations", {
      reuses_task_id: w.id, priority: titleCase(w.priority) as PlanTaskJson["priority"],
      description: w.due ? `Due ${w.due}; ${w.priority} priority, fits ${w.owner}'s free hours.` : `${titleCase(w.priority)} priority, fits ${w.owner}'s free hours.`,
    }));
    if (picks.length >= 12) break;
  }
  return { outcome: "This week's picks that fit everyone's free hours", tasks: picks, risks: [], open_questions: [] };
};

/** Deterministic fake: no network. `failFirst` returns invalid JSON once, to exercise the retry. */
export const createFakeAIProvider = (opts: { failFirst?: boolean } = {}): AIProvider => {
  let calls = 0;
  return {
    async complete(job, req) {
      calls++;
      let plan: PlanJson;
      if (req.mode === "split") plan = splitPlan(req);
      else if (req.mode === "replan") plan = replanPlan(req);
      else if (req.mode === "weekly") plan = weeklyPlan(req);
      else if (req.settings.source === "notes") plan = notesPlan(req);
      else if (/3d showcase/i.test(req.idea)) plan = showcasePlan(req);
      else plan = genericPlan(req);
      const text = opts.failFirst && calls === 1 ? "Sure! Here is the plan you asked for:" : JSON.stringify(plan);
      const inputTokens = Math.ceil(JSON.stringify(req).length / 4) + 1200; // + system prompt
      const outputTokens = Math.ceil(text.length / 4);
      return { text, model: `${AI_JOBS[job].model} (fake)`, inputTokens, outputTokens, costMinor: costOf(job, inputTokens, outputTokens) };
    },
  };
};
