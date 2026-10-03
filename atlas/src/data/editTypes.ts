/**
 * The "finish what's half-done" operations (docs/pages P0): edit and delete for records that could only be created,
 * and the actions pages showed but couldn't do. Deletes go to the Trash and return its id, so the page can offer Undo.
 */
import type { Expense } from "./advisorTypes";
import type { ListType } from "@/config/leads";
import type { Brand } from "./leadTypes";
import type { Meeting } from "./queueTypes";
import type { Commission } from "./salesTypes";

export interface NewLeadInput {
  company: string;
  phone: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  industry: string | null;
  listType: ListType;
  brand: Brand;
  contact?: { firstName: string; lastName: string; title: string | null; email: string | null; phone: string | null } | null;
  ownerId?: string | null;
}

export interface CompanyPatch {
  name?: string;
  industry?: string | null;
  phone?: string | null;
  domain?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  listType?: ListType;
  brandInterest?: Brand[];
}

export type DecisionVerdict = "agreed" | "rejected" | "kept" | "stopped";

export interface EditsApi {
  // Money › Finance
  updateExpense(id: string, patch: Partial<Pick<Expense, "date" | "vendor" | "category" | "amountMinor" | "currency" | "recurring" | "note">>): Promise<void>;
  deleteExpense(id: string): Promise<string>;
  updateCashSnapshot(id: string, patch: { date?: string; balanceMinor?: number }): Promise<void>;
  deleteCashSnapshot(id: string): Promise<string>;
  // Money › ROI: two founders decide a spend; running ones are kept or stopped.
  decideSpend(id: string, verdict: DecisionVerdict, note: string): Promise<void>;
  // People › Commissions
  setCommissionStatus(ids: string[], status: Extract<Commission["status"], "earned" | "paid" | "void" | "clawed_back">, reason: string): Promise<number>;
  // Money › Payments
  /** Emails the client a reminder for an open invoice (founders approve by clicking). */
  sendInvoiceReminder(invoiceId: string): Promise<void>;
  /** A bank transfer arrived: records the payment (and the commission it triggers) with the reference. */
  markInvoicePaid(invoiceId: string, input: { paidAt: string; reference: string }): Promise<void>;
  // Sell › Leads
  createLead(input: NewLeadInput): Promise<{ leadId: string; duplicateOf?: string }>;
  updateCompany(leadId: string, patch: CompanyPatch): Promise<void>;
  archiveLead(leadId: string): Promise<string>;
  deleteContact(contactId: string): Promise<string>;
  updateNote(activityId: string, text: string): Promise<void>;
  deleteNote(activityId: string): Promise<string>;
  // Sell › Meetings
  rescheduleMeeting(id: string, input: { at: string; type?: Meeting["type"]; withWhom?: string; ownerId?: string | null }): Promise<void>;
  cancelMeeting(id: string, reason: string): Promise<string>;
  // Sell › Deals
  updateDeal(id: string, patch: { ownerId?: string | null; brand?: Brand; expectedCloseAt?: string | null }): Promise<void>;
  deleteDeal(id: string): Promise<string>;
  // Growth
  deleteCompetitor(id: string): Promise<string>;
  addChannel(input: { name: string; build: string; owner: string; kpi: string }): Promise<void>;
  deleteChannel(id: string): Promise<string>;
  deleteExperiment(id: string): Promise<string>;
  // Work › Ops
  addSop(input: { title: string; owner: string; due: string }): Promise<void>;
  deleteSop(id: string): Promise<string>;
  // People › Hiring and Training
  deleteCandidate(id: string): Promise<string>;
  deleteOpening(id: string): Promise<string>;
  updateProgram(id: string, patch: { name?: string; role?: string; startDate?: string }): Promise<void>;
  cancelProgram(id: string, reason: string): Promise<string>;
  removeBlockScore(traineeId: string, block: string, index: number): Promise<void>;
  // Work › Docs
  listArchivedDocs(): Promise<{ id: string; title: string; updatedAt: string }[]>;
  restoreDoc(id: string): Promise<void>;
  searchDocs(q: string): Promise<{ id: string; title: string; snippet: string }[]>;
  moveDoc(id: string, direction: "up" | "down"): Promise<void>;
}
