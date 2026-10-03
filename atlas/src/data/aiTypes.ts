/**
 * AI BDR calling agent. It calls back people who asked us to (inbound requests) within minutes, qualifies them with
 * a short script, and books a meeting with a human. It never cold-calls: in the US an AI voice is an "artificial
 * voice" under the TCPA (FCC, Feb 2024) and needs prior express consent, and the EU/UK/CH rules are stricter still.
 */
export type AgentMode = "off" | "shadow" | "live";

export interface AgentSettings {
  mode: AgentMode;
  /** Local calling window for the person called, "HH:MM". */
  hoursFrom: string;
  hoursTo: string;
  /** Call back within this many minutes of the request. */
  withinMinutes: number;
  maxAttempts: number;
  /** Who the meeting is booked with. */
  handoffTo: string | null;
  /** Said first, word for word: it's an AI, why we call, and that the call is recorded. */
  disclosure: string;
  questions: string[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AgentPlanItem {
  requestId: string;
  name: string;
  company: string;
  phone: string;
  country: string | null;
  receivedAt: string;
  allowed: boolean;
  /** Why it can or can't call now. */
  reason: string;
  /** What it would say first (disclosure + opener). */
  opener: string;
}

export interface AgentRun {
  id: string;
  at: string;
  mode: AgentMode;
  considered: number;
  wouldCall: number;
  blocked: number;
  by: string | null;
}

export interface AgentHome {
  settings: AgentSettings;
  plan: AgentPlanItem[];
  runs: AgentRun[];
  people: { id: string; name: string }[];
  /** Live calling needs Twilio with an AI voice behind it. */
  liveAvailable: boolean;
  canEdit: boolean;
}

export interface AgentApi {
  agentHome(): Promise<AgentHome>;
  saveAgent(patch: Partial<Omit<AgentSettings, "updatedAt" | "updatedBy">>): Promise<void>;
  /** Shadow mode: works out who it would call right now and logs it. Nobody is called. */
  runAgentShadow(): Promise<AgentRun>;
}
