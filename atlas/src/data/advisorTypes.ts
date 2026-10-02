/** AI co-founder types (A19, screen 26). */

/** Exactly the tool list in `prompts/AI_COFOUNDER_SYSTEM_PROMPT.md`. */
export const ADVISOR_TOOLS = [
  "search_knowledge", "get_decisions", "get_kpis", "get_pipeline", "get_mrr_history", "get_finance", "get_expenses", "run_price_quote", "run_scenario",
  "get_capacity", "get_tasks", "get_time_report", "get_clients", "get_team_performance", "get_market_notes", "web_research",
  "propose_tasks", "propose_decision", "draft_document",
] as const;
export type ToolName = (typeof ADVISOR_TOOLS)[number];
/** The only tools that create anything: drafts a person must accept. */
export const DRAFT_TOOLS: ToolName[] = ["propose_tasks", "propose_decision", "draft_document"];

export const ADVISOR_ROLES = ["CEO", "CFO", "COO", "CTO", "CRO/CMO", "Risk", "People"] as const;
export type AdvisorRole = (typeof ADVISOR_ROLES)[number];

export interface Expense {
  id: string;
  date: string;
  vendor: string;
  category: "people" | "tools" | "data" | "usage" | "freelance" | "marketing" | "admin" | "fees";
  amountMinor: number;
  currency: "USD" | "EUR";
  recurring: boolean;
  source: "manual" | "bank_export" | "stripe";
  note: string | null;
}

export interface CashSnapshot {
  id: string;
  date: string;
  balanceMinor: number;
  currency: "EUR";
  source: "manual" | "bank_export";
  createdBy: string | null;
}

/** Mirrors the `context/07` decision log. */
export interface Decision {
  id: string;
  title: string;
  date: string;
  owner: string;
  status: string;
  reason: string;
  expectedImpact: string;
  reviewDate: string;
  links: string[];
  source: "context/07" | "advisor";
  createdBy: string | null;
}

export interface ToolCall {
  name: ToolName;
  args: Record<string, unknown>;
  ok: boolean;
  /** One line for the "data it used" panel. */
  summary: string;
  error?: string;
  /** Files the result came from (search_knowledge, get_market_notes). */
  sources?: string[];
  /** Raw result (numbers in answers must trace back to here). */
  data?: unknown;
}

export interface MemoOption {
  name: string;
  cost: string;
  effect: string;
  risk: string;
  pick: "YES" | "NO" | "WITH A" | "WITH B" | "WITH C" | "MAYBE";
}

export interface Assumption {
  text: string;
  source: string;
}

export interface ProposedTask {
  title: string;
  ownerId: string | null;
  ownerName: string;
  hours: number;
  due: string;
}

export interface ProposedAction {
  id: string;
  messageId: string;
  kind: "tasks" | "decision" | "document";
  status: "draft" | "accepted" | "dismissed";
  tasks?: ProposedTask[];
  decision?: { title: string; reason: string; expectedImpact: string; reviewDate: string; owner: string };
  document?: { kind: string; title: string; content: string };
  acceptedBy: string | null;
  acceptedAt: string | null;
  /** What Accept created. */
  createdIds: string[];
}

export interface AdvisorAnswer {
  kind: "memo" | "short" | "refusal";
  hats: string[];
  confidence: "low" | "medium" | "high";
  short: string;
  /** Short answers: a few lines (markdown-ish plain text). */
  body?: string;
  options?: MemoOption[];
  fastest?: string;
  profitable?: string;
  risks?: string[];
  measure?: string[];
  assumptions: Assumption[];
  /** Ends legal, tax and contract answers. */
  professional?: string;
  /** Figures without a tool, file or assumption behind them (checked on every answer). */
  unsourced: string[];
}

export interface AdvisorMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  userId: string | null;
  content: string;
  roleHint: AdvisorRole | null;
  answer: AdvisorAnswer | null;
  toolCalls: ToolCall[];
  sources: string[];
  actionIds: string[];
  model: string | null;
  costMinor: number;
  knowledgeVersion: string | null;
  createdAt: string;
}

export interface AdvisorThread {
  id: string;
  /** null for team threads from the scheduled jobs (admins see them). */
  userId: string | null;
  title: string;
  kind: "question" | "briefing" | "month_end" | "alert";
  topic: string;
  /** Dedup key for scheduled threads ("briefing:2026-W40"). */
  key: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryFact {
  id: string;
  fact: string;
  status: "draft" | "approved" | "rejected";
  proposedBy: string | null;
  approvedBy: string | null;
  sourceMessageId: string | null;
  createdAt: string;
}

export interface AdvisorDocument {
  id: string;
  kind: string;
  title: string;
  content: string;
  acceptedBy: string;
  acceptedAt: string;
  messageId: string;
}

export interface AdvisorSettings {
  /** Which roles may use the advisor (admins always). */
  roles: { bdr: boolean; closer: boolean; implementer: boolean; viewer: boolean };
  /** Tools switched off per user. */
  disabledTools: Record<string, ToolName[]>;
  /** Monthly AI cap across AI jobs (planner + advisor), EUR cents. */
  monthlyCapMinor: number;
}

export interface ThreadListItem {
  id: string;
  title: string;
  meta: string;
  kind: AdvisorThread["kind"];
  updatedAt: string;
  mine: boolean;
}

export interface AdvisorHome {
  threads: ThreadListItem[];
  knowledgeVersion: string;
  spendMinor: number;
  capMinor: number;
  blocked: boolean;
  memory: MemoryFact[];
  can: { admin: boolean; roles: AdvisorRole[] };
}

export interface AdvisorThreadView {
  thread: AdvisorThread;
  messages: AdvisorMessage[];
  actions: ProposedAction[];
}

export interface AdvisorJobRun {
  briefings: number;
  closes: number;
  alerts: number;
}

export interface AdvisorApi {
  advisorHome(): Promise<AdvisorHome>;
  getAdvisorThread(id: string): Promise<AdvisorThreadView>;
  /** Ask in a thread (or start one). Tools run as the asking user. */
  askAdvisor(input: { threadId?: string; text: string; roleHint?: AdvisorRole | null }): Promise<{ threadId: string; message: AdvisorMessage }>;
  /** Accept a proposed action: the only path that creates tasks, decisions or documents. */
  acceptAdvisorAction(actionId: string): Promise<{ createdIds: string[] }>;
  dismissAdvisorAction(actionId: string): Promise<void>;
  /** "Log as proposed decision" on a memo: a decision row with status proposed. */
  logMemoAsDecision(messageId: string): Promise<Decision>;
  /** "Remember this": a draft fact an admin approves. */
  rememberFromMessage(messageId: string, fact: string): Promise<MemoryFact>;
  reviewMemory(id: string, approve: boolean): Promise<void>;
  searchKnowledge(q: string): Promise<{ path: string; heading: string; text: string }[]>;
  listDecisions(status?: string): Promise<Decision[]>;
  runAdvisorJobs(): Promise<AdvisorJobRun>;
  advisorSettings(): Promise<AdvisorSettings>;
  setAdvisorSettings(patch: Partial<AdvisorSettings>): Promise<void>;
  /** Finance data entry (admin): expenses and cash snapshots. */
  listFinanceData(): Promise<{ expenses: Expense[]; cash: CashSnapshot[] }>;
  addExpense(input: Omit<Expense, "id" | "source"> & { source?: Expense["source"] }): Promise<void>;
  addCashSnapshot(input: { date: string; balanceMinor: number }): Promise<void>;
}
