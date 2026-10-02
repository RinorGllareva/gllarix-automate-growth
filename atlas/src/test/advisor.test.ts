import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADVISOR_EVAL } from "@/config/advisorEval";
import { createDemoSource } from "@/data/demo/demoSource";
import { ADVISOR_TOOLS, DRAFT_TOOLS, type AdvisorMessage, type DataSource } from "@/data/types";
import { classify, NOT_FOR_ROLE, TOOL_ACCESS, unsourcedFigures } from "@/services/advisor";

const NOW = Date.UTC(2026, 9, 1, 12, 30); // Thu 1 Oct 2026
const PW = "pw";

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}
const switchTo = async (src: DataSource, email: string) => {
  await src.signOut();
  const r = await src.signInWithPassword(email, PW);
  if (!r.ok) throw new Error("sign-in failed");
};
const source = async (email = "rinor@atlas.test", now: () => number = () => NOW) => {
  const src = createDemoSource({ password: PW, persistLeads: false, now, storage: new MemoryStorage() });
  await switchTo(src, email);
  return src;
};
const files = (m: AdvisorMessage) => [...m.sources, ...m.toolCalls.flatMap((c) => c.sources ?? [])].join(" ");
/** What a person can see of the business data (everything a tool could change). */
const businessState = async (src: DataSource) => {
  const [deals, payments, decisions, clients, tasks] = await Promise.all([src.listDeals(), src.listPayments(), src.listDecisions(), src.clientsOverview(), src.listTasks({ includeClosed: true })]);
  return JSON.stringify({ deals: deals.map((d) => [d.deal.id, d.deal.stage, d.deal.updatedAt]), payments: payments.length, decisions: decisions.map((d) => [d.id, d.status]), clients: clients.cards.map((c) => [c.id, c.status]), tasks: tasks.map((t) => [t.task.id, t.task.status, t.task.updatedAt]) });
};

describe("AI co-founder evaluation set (M14 done-when)", () => {
  it("all 20 questions use the expected tools and files, with every figure sourced", async () => {
    const src = await source();
    const failures: string[] = [];
    for (const c of ADVISOR_EVAL) {
      const { message: m } = await src.askAdvisor({ text: c.question });
      const used = m.toolCalls.filter((t) => t.ok).map((t) => t.name);
      for (const t of c.tools) if (!used.includes(t)) failures.push(`#${c.n} ${c.question}: no ${t} (used ${used.join(", ") || "nothing"}${m.toolCalls.filter((t) => !t.ok).map((t) => ` · ${t.name} failed: ${t.error}`).join("")})`);
      for (const f of c.files ?? []) if (!files(m).includes(f)) failures.push(`#${c.n} ${c.question}: doesn't cite ${f} (cites ${files(m) || "nothing"})`);
      if (c.says && !c.says.test(m.answer!.short)) failures.push(`#${c.n} ${c.question}: answer "${m.answer!.short}" doesn't match ${c.says}`);
      if (m.answer!.unsourced.length) failures.push(`#${c.n} ${c.question}: unsourced figures ${m.answer!.unsourced.join(", ")}`);
      if (m.answer!.kind === "refusal") failures.push(`#${c.n}: refused for the admin`);
    }
    expect(failures).toEqual([]);
  }, 60_000);

  it("legal and rules questions end with 'confirm with a professional'", async () => {
    const src = await source();
    for (const q of ["Can we cold-email Swiss developers?", "Can the AI BDR cold-call US mobiles?"]) {
      const { message } = await src.askAdvisor({ text: q });
      expect(message.answer!.professional).toMatch(/Confirm with a professional/);
    }
  });

  it("the hire memo matches the mockup's shape: options, routes, risks, assumptions with sources", async () => {
    const src = await source();
    const { message } = await src.askAdvisor({ text: "We have 2 paying clients and about €3,000 in reserve. Should we hire setter #1 now or wait for Gate 1?" });
    const a = message.answer!;
    expect(a.kind).toBe("memo");
    expect(a.hats).toEqual(["CEO", "CFO", "OPERATIONS", "RISK"]);
    expect(a.options!.map((o) => o.pick)).toEqual(["NO", "YES", "WITH B"]);
    expect(a.fastest && a.profitable).toBeTruthy();
    expect(a.risks!.length).toBeGreaterThan(0);
    expect(a.assumptions.every((x) => x.source)).toBe(true);
    expect(message.model).toContain("claude-opus-5-5");
    expect(message.costMinor).toBeGreaterThan(0);
    expect(message.knowledgeVersion).toMatch(/^context \d{4}-\d{2}-\d{2} · [0-9a-f]{8}$/);
  });
});

describe("AI co-founder role limits", () => {
  it("the BDR asking about cash gets 'not available for your role'", async () => {
    const src = await source("diego@atlas.test");
    const { message } = await src.askAdvisor({ text: "How much cash do we have vs the reserve?" });
    expect(message.answer!.kind).toBe("refusal");
    expect(message.answer!.short).toBe(NOT_FOR_ROLE);
    expect(message.toolCalls.find((c) => c.name === "get_finance")).toMatchObject({ ok: false });
    expect(JSON.stringify(message)).not.toMatch(/3,?420|balanceEur/);
  });

  it("the BDR can't retrieve finance data through any tool or document", async () => {
    const src = await source("diego@atlas.test");
    for (const q of ["Should we hire setter #1 now?", "Are we on track for €10k MRR by June?", "What's our break-even number of clients?", "ROI of a $150/month list builder", "What should the BDR focus on this week?"]) {
      const { message } = await src.askAdvisor({ text: q });
      for (const c of message.toolCalls.filter((t) => ["get_finance", "get_mrr_history", "get_expenses", "run_scenario", "get_team_performance"].includes(t.name))) expect(c.ok, `${q}: ${c.name}`).toBe(false);
      expect(message.answer!.short).toBe(NOT_FOR_ROLE);
    }
    const hits = await src.searchKnowledge("cash reserve break-even budget runway scenario");
    expect(hits.map((h) => h.path).filter((p) => /context\/05|backbone\/03|backbone\/09|scenarios_12_months|mrr_10k/.test(p))).toEqual([]);
    // He still gets prices and the rules he works with.
    const { message } = await src.askAdvisor({ text: "Price for Standard + reviews in Switzerland, pilot" });
    expect(message.answer!.kind).not.toBe("refusal");
  });

  it("tools follow the role table; admins can switch tools off per user; the viewer is off by default", async () => {
    expect(TOOL_ACCESS.get_finance).not.toContain("bdr");
    expect(TOOL_ACCESS.get_team_performance).toEqual(["admin"]);
    expect(Object.keys(TOOL_ACCESS).sort()).toEqual([...ADVISOR_TOOLS].sort());
    const admin = await source();
    await admin.setAdvisorSettings({ disabledTools: { "u-rinor": ["run_price_quote"] } });
    const { message } = await admin.askAdvisor({ text: "Price for Standard in the US" });
    expect(message.toolCalls[0]).toMatchObject({ name: "run_price_quote", ok: false });
    const viewer = await source("books@atlas.test");
    await expect(viewer.advisorHome()).rejects.toMatchObject({ status: 403 });
  });
});

describe("AI co-founder: no action without a person", () => {
  it("no tool changes a record; only Accept creates tasks, decisions or documents", async () => {
    const src = await source();
    const before = await businessState(src);
    const asked: AdvisorMessage[] = [];
    for (const c of ADVISOR_EVAL) asked.push((await src.askAdvisor({ text: c.question })).message);
    expect(await businessState(src)).toBe(before);
    // Draft tools only made drafts.
    const plan = asked.find((m) => m.toolCalls.some((t) => t.name === "propose_tasks"))!;
    const view = await src.getAdvisorThread(plan.threadId);
    const action = view.actions.find((a) => a.kind === "tasks")!;
    expect(action.status).toBe("draft");
    expect(action.tasks).toHaveLength(3);
    expect(action.tasks!.every((t) => t.due <= "2026-10-31")).toBe(true);
    const tasksBefore = (await src.listTasks({ includeClosed: true })).length;
    const { createdIds } = await src.acceptAdvisorAction(action.id);
    expect(createdIds).toHaveLength(3);
    expect((await src.listTasks({ includeClosed: true })).length).toBe(tasksBefore + 3);
    await expect(src.acceptAdvisorAction(action.id)).rejects.toThrow(/Already accepted/);
    // A document draft is saved on Accept; nothing is sent.
    const doc = asked.find((m) => m.toolCalls.some((t) => t.name === "draft_document"))!;
    const docAction = (await src.getAdvisorThread(doc.threadId)).actions.find((a) => a.kind === "document")!;
    expect(docAction.document!.content).toMatch(/Appointment setter/);
    await src.acceptAdvisorAction(docAction.id);
    // Log as proposed decision.
    const memo = asked.find((m) => m.answer?.kind === "memo" && m.answer.options?.some((o) => o.pick === "YES"))!;
    const d = await src.logMemoAsDecision(memo.id);
    expect(d).toMatchObject({ status: "proposed", source: "advisor" });
    expect((await src.listDecisions("proposed")).some((x) => x.id === d.id)).toBe(true);
    expect(DRAFT_TOOLS).toEqual(["propose_tasks", "propose_decision", "draft_document"]);
  }, 60_000);

  it("memory facts need an admin's approval", async () => {
    const src = await source("diego@atlas.test");
    const { message } = await src.askAdvisor({ text: "Can we cold-email Swiss developers?" });
    const f = await src.rememberFromMessage(message.id, "No cold email to Swiss developers");
    expect(f.status).toBe("draft");
    await expect(src.reviewMemory(f.id, true)).rejects.toMatchObject({ status: 403 });
    await switchTo(src, "artin@atlas.test");
    await src.reviewMemory(f.id, true);
    expect((await src.advisorHome()).memory.find((m) => m.id === f.id)?.status).toBe("approved");
  });
});

describe("AI co-founder scheduled jobs", () => {
  it("creates the Monday briefing with KPIs, gates, risks and 3 tasks; month-end close; alerts, once", async () => {
    const src = await source();
    const r = await src.runAdvisorJobs();
    expect(r.briefings).toBe(1);
    expect(r.closes).toBe(1);
    const home = await src.advisorHome();
    const b = home.threads.find((t) => t.kind === "briefing")!;
    expect(b).toMatchObject({ title: "Monday briefing · W40", meta: "AUTO · MON 07:00" });
    const m = (await src.getAdvisorThread(b.id)).messages.find((x) => x.role === "assistant")!;
    expect(m.toolCalls.map((c) => c.name)).toEqual(expect.arrayContaining(["get_kpis", "get_finance", "get_clients", "get_tasks"]));
    expect(m.answer!.short).toMatch(/^Week 39/);
    expect(m.answer!.options!.length).toBeGreaterThan(0); // gates
    expect(m.answer!.risks!.length).toBeGreaterThan(0);
    const tasks = m.toolCalls.find((c) => c.name === "get_tasks")!.data as { tasks: unknown[] };
    expect(tasks.tasks).toHaveLength(3);
    const close = home.threads.find((t) => t.kind === "month_end")!;
    expect(close.title).toBe("Month-end close · September 2026");
    expect(await src.runAdvisorJobs()).toEqual({ briefings: 0, closes: 0, alerts: 0 });
    // Cash below the reserve raises an alert thread and a notification.
    await src.addCashSnapshot({ date: "2026-10-01", balanceMinor: 210_000 });
    expect((await src.runAdvisorJobs()).alerts).toBe(1);
    expect((await src.advisorHome()).threads[0]).toMatchObject({ kind: "alert" });
    expect((await src.listNotifications("u-rinor")).some((n) => /below the €3000 reserve/.test(n.text))).toBe(true);
  });

  it("the monthly AI cap blocks new questions", async () => {
    const src = await source();
    await src.setAdvisorSettings({ monthlyCapMinor: 0 });
    await expect(src.askAdvisor({ text: "Price for Standard in the US" })).rejects.toThrow(/monthly AI cap/);
  });
});

describe("AI co-founder internals", () => {
  it("routes questions and flags figures without a source", () => {
    expect(classify("Should we hire setter #1 now?")).toBe("hire");
    expect(classify("Draft the setter job post")).toBe("draft");
    const answer = { kind: "short" as const, hats: [], confidence: "high" as const, short: "Cash €4,200 vs reserve €3,000", assumptions: [{ text: "Reserve €3,000", source: "x" }] };
    expect(unsourcedFigures(answer, [], "cash?")).toEqual(["€4,200"]);
  });

  it("the system prompt and knowledge files stay out of the browser bundle", () => {
    const plugin = readFileSync(resolve(__dirname, "../../knowledgePlugin.ts"), "utf8");
    expect(plugin).toMatch(/build \|\| !existsSync\(specDir\)\) return "export default \[\];"/);
    expect(plugin).not.toMatch(/"prompts"/);
    const advisor = readFileSync(resolve(__dirname, "../services/advisor.ts"), "utf8");
    expect(advisor).not.toMatch(/AI_COFOUNDER_SYSTEM_PROMPT\.md["'`]\s*\)|import .*prompts\//);
  });
});
