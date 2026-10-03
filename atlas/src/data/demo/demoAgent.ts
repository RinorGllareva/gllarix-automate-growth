import { agentPlan, DEFAULT_AGENT } from "@/services/aiAgent";
import type { AgentApi, AgentRun, AgentSettings } from "../aiTypes";
import type { InboundRequest } from "../opsTypes";
import { AccessError, type User } from "../types";

export interface AgentStore {
  agent?: AgentSettings;
  agentRuns?: AgentRun[];
}

interface Ctx<S extends AgentStore> {
  load: () => Promise<S>;
  save: () => Promise<void>;
  viewer: () => Promise<User>;
  now: () => number;
  users: User[];
  uid: (p: string) => string;
  audit: (userId: string | null, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) => void;
  inbound: (s: S) => InboundRequest[];
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createDemoAgent = <S extends AgentStore>(ctx: Ctx<S>) => {
  const { load, save, viewer, now, users, uid, audit, inbound } = ctx;
  const iso = () => new Date(now()).toISOString();
  const settingsOf = (s: S) => (s.agent ??= { ...DEFAULT_AGENT, handoffTo: users.find((u) => u.role === "bdr" && u.active)?.id ?? null });
  const requireAdmin = async () => {
    const u = await viewer();
    if (u.role !== "admin") throw new AccessError(403, "The AI agent is set up by the founders.");
    return u;
  };

  const api: AgentApi = {
    async agentHome() {
      const user = await requireAdmin();
      const s = await load();
      const settings = settingsOf(s);
      return {
        settings,
        plan: agentPlan(inbound(s), settings, now()),
        runs: (s.agentRuns ?? []).slice(0, 10),
        people: users.filter((u) => u.active && ["admin", "bdr", "closer"].includes(u.role)).map((u) => ({ id: u.id, name: u.name })),
        liveAvailable: false,
        canEdit: user.role === "admin",
      };
    },

    async saveAgent(patch) {
      const user = await requireAdmin();
      const s = await load();
      const cur = settingsOf(s);
      const next = { ...cur, ...patch };
      if (next.mode === "live") throw new Error("Live calling needs Twilio and an AI voice connected. Use shadow mode until then.");
      if (!HHMM.test(next.hoursFrom) || !HHMM.test(next.hoursTo) || next.hoursFrom >= next.hoursTo) throw new Error("Set a calling window like 09:00 to 18:00.");
      if (!/\bAI\b/.test(next.disclosure) || !/record/i.test(next.disclosure)) throw new Error("The opening line must say it's an AI and that the call is recorded.");
      if (next.withinMinutes < 1 || next.withinMinutes > 60) throw new Error("Call back within 1 to 60 minutes.");
      if (next.maxAttempts < 1 || next.maxAttempts > 3) throw new Error("1 to 3 attempts: more is pestering.");
      next.questions = next.questions.map((q) => q.trim()).filter(Boolean).slice(0, 5);
      s.agent = { ...next, updatedAt: iso(), updatedBy: user.id };
      audit(user.id, "agent.settings", "agent", null, cur, s.agent);
      await save();
    },

    async runAgentShadow() {
      const user = await requireAdmin();
      const s = await load();
      const settings = settingsOf(s);
      if (settings.mode === "off") throw new Error("Turn on shadow mode first.");
      const plan = agentPlan(inbound(s), settings, now());
      const run: AgentRun = { id: uid("ar"), at: iso(), mode: settings.mode, considered: plan.length, wouldCall: plan.filter((p) => p.allowed).length, blocked: plan.filter((p) => !p.allowed).length, by: user.id };
      s.agentRuns = [run, ...(s.agentRuns ?? [])].slice(0, 50);
      await save();
      return run;
    },
  };
  return { api };
};
