/** Settings › Users, Company profile and Commission rules (docs/pages/settings/settings.md, P0). */
import type { Role, User } from "./types";

export interface LegalEntity {
  /** Registered name, e.g. "Gllarix LLC". */
  legalName: string;
  /** Registered address, one line per row. */
  address: string;
  /** Company or trade register number. */
  registration: string;
  vatId: string;
}

export interface CompanyProfile {
  entities: Record<"gllarix" | "arcadian", LegalEntity>;
  /** Governing-law clause for contracts; empty keeps the "to confirm with counsel" placeholder. */
  governingLaw: string;
  /** Who signs for us on contracts. */
  signatory: string;
}

/** Commission rules. Changes apply to new commission lines; existing lines keep the rule they were made with. */
export interface CommissionRules {
  /** Share of setup and of each monthly fee, 0–1 (0.10 = 10%). */
  pct: number;
  /** Minimum setup commission, in major units of the deal currency. */
  setupMin: number;
  /** How many monthly payments earn the recurring commission. */
  months: number;
  /** Bonus per approved meeting, minor units (USD). */
  meetingBonusMinor: number;
}

export interface NewUserInput {
  name: string;
  email: string;
  role: Role;
  timezone: string;
  /** Daily call queue size; null for roles without a queue. */
  dailyCapacity: number | null;
}

/** Money › Financial plan: one saved set of what-if assumptions. */
export interface PlanSettings {
  scenario: "worst" | "realistic" | "best";
  /** First month of the 12-month plan, "YYYY-MM". */
  start: string;
  useCash: boolean;
  /** Overrides; null keeps the scenario's value. */
  churnPct: number | null;
  feeUsd: number | null;
  pace: number;
  hires: { label: string; fromMonth: number; monthlyUsd: number }[];
}

export interface PlanScenario {
  id: string;
  name: string;
  settings: PlanSettings;
  savedBy: string;
  savedAt: string;
}

export interface SettingsApi {
  /** Founders. Demo mode adds the user straight away (they sign in with the demo password); Supabase sends an invite email. */
  inviteUser(input: NewUserInput): Promise<User>;
  updateUser(id: string, patch: Partial<Omit<NewUserInput, "email">>): Promise<void>;
  /** Pause an account and hand their open leads, deals, tasks and inbound requests to someone else. */
  deactivateUser(id: string, handOverTo: string | null): Promise<{ moved: number }>;
  reactivateUser(id: string): Promise<void>;
  getCompanyProfile(): Promise<CompanyProfile>;
  saveCompanyProfile(p: CompanyProfile): Promise<void>;
  getCommissionRules(): Promise<CommissionRules>;
  saveCommissionRules(r: CommissionRules): Promise<void>;
  /** Founders: saved financial-plan scenarios, newest first. */
  listPlanScenarios(): Promise<PlanScenario[]>;
  /** Same name replaces it. */
  savePlanScenario(name: string, settings: PlanSettings): Promise<PlanScenario>;
  deletePlanScenario(id: string): Promise<void>;
}
