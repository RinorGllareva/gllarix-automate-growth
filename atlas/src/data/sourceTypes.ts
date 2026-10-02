import type { ConnectorId } from "@/config/leadSources";
import type { ScoringReport } from "@/services/scoringReport";

export type JobType = "list_build" | "enrichment";

export interface JobRun {
  id: string;
  type: JobType;
  status: "running" | "succeeded" | "failed" | "capped";
  /** Who or what started it. */
  trigger: "shortfall" | "manual" | "retry" | "schedule";
  startedBy: string | null;
  ownerId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  items: number;
  costMinor: number;
  log: string[];
  error: string | null;
  /** Parameters to retry with. */
  params: { ownerId?: string | null; target?: number };
  retryOf: string | null;
}

export interface CostEntry {
  id: string;
  connector: ConnectorId;
  at: string;
  costMinor: number;
  note: string;
}

export interface ConnectorStatus {
  id: ConnectorId;
  label: string;
  connected: boolean;
  needsKey: boolean;
  countries: string[];
  capMinor: number;
  spentMinor: number;
  requests: number;
  cacheHits: number;
  cachedPages: number;
  costPerRequestMinor: number;
  terms: string;
}

export interface JobStatus {
  type: JobType;
  label: string;
  paused: boolean;
  pausedReason: string | null;
  lastRun: JobRun | null;
  consecutiveFailures: number;
}

export interface ListBuildResult {
  run: JobRun;
  owners: { ownerId: string; name: string; shortfall: number; added: number; queueReady: number }[];
}

export interface SourcesOverview {
  connectors: ConnectorStatus[];
  jobs: JobStatus[];
  runs: JobRun[];
  shortfalls: { ownerId: string; name: string; listType: string; shortfall: number }[];
}

export interface LeadSourcesApi {
  sourcesOverview(): Promise<SourcesOverview>;
  setConnector(id: ConnectorId, patch: { connected?: boolean; capMinor?: number }): Promise<void>;
  /** Tops up each owner's pool (or one owner's) by their queue shortfall from the search plans. */
  runListBuild(opts?: { ownerId?: string; target?: number; trigger?: JobRun["trigger"] }): Promise<ListBuildResult>;
  /** Website audits for new and stale leads; writes signals and rescores. */
  runEnrichment(): Promise<JobRun>;
  /** Audit one lead's website now (lead detail › Re-enrich). */
  enrichLead(leadId: string): Promise<{ summary: string; signals: number }>;
  setJobPaused(type: JobType, paused: boolean): Promise<void>;
  retryJobRun(runId: string): Promise<JobRun>;
  scoringReport(month: string): Promise<ScoringReport>;
}
