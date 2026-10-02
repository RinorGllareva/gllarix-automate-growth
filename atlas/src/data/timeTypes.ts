/** Time tracking types (A18, screens 24–25). */

export type TimeLinkType = "task" | "client" | "project" | "lead" | "deal";

export interface TimeLink {
  type: TimeLinkType;
  id: string;
}

/** A client, project or internal bucket that time is logged against (rows in the grid and the reports). */
export interface TimeProject {
  id: string;
  name: string;
  /** What it is and the price basis, e.g. "3D building · fixed €3,250 · freelancer extra". */
  sub: string;
  kind: "arcadian" | "gllarix" | "presale" | "internal";
  /** Fixed price (minor units) for fixed-price projects; recurring clients use their invoices in the period. */
  fixedPriceMinor: number | null;
  currency: "USD" | "EUR";
  clientId: string | null;
  /** Direct costs (freelancer, usage) for the margin, minor units. */
  directCostMinor: number;
  archived: boolean;
}

export interface Timesheet {
  id: string;
  userId: string;
  /** ISO week ("2026-W40"), Monday–Sunday in the person's timezone. */
  week: string;
  status: "draft" | "submitted" | "approved";
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  /** Admin's comment when reopening. */
  comment: string | null;
}

export interface CostRate {
  userId: string;
  hourlyMinor: number;
  currency: "USD" | "EUR";
  validFrom: string;
}

/** Billable time turned into Stripe invoice items when the week is approved (the M7 hook). */
export interface TimeInvoiceItem {
  id: string;
  clientId: string;
  timesheetId: string;
  userId: string;
  description: string;
  minutes: number;
  rateMinor: number;
  amountMinor: number;
  currency: "USD" | "EUR";
  stripeItemId: string;
  status: "pending" | "invoiced";
  invoiceId: string | null;
  createdAt: string;
}

export interface GridRow {
  /** Stable key: link + category + billable. */
  key: string;
  label: string;
  sub: string;
  category: string;
  billable: boolean;
  rateMinor: number | null;
  currency: "USD" | "EUR" | null;
  link: TimeLink | null;
  /** Hours per day (Mon–Sun). */
  cells: number[];
  total: number;
}

export interface MyWeek {
  userId: string;
  name: string;
  week: string;
  weekLabel: string;
  days: { date: string; label: string }[];
  rows: GridRow[];
  dayTotals: number[];
  total: number;
  capacityHours: number | null;
  split: { key: string; label: string; hours: number; target: number }[];
  estimates: { tasks: number; estimatedHours: number; actualHours: number; ratio: number | null };
  timesheet: Timesheet;
  timer: { label: string; sub: string; startedAt: string; link: TimeLink | null; taskId: string | null } | null;
  canEdit: boolean;
  people: { id: string; name: string }[] | null;
}

export interface TimeEntryView {
  id: string;
  date: string;
  minutes: number;
  source: "timer" | "manual";
  label: string;
  category: string;
  billable: boolean;
  note: string | null;
  locked: boolean;
}

export type ReportGroup = "client" | "person" | "category";

export interface TimeReportRow {
  key: string;
  label: string;
  sub: string;
  type: string;
  hours: number;
  /** Money columns: null for roles without money (the implementer). */
  revenueMinor: number | null;
  perHourMinor: number | null;
  marginMinor: number | null;
  currency: "USD" | "EUR" | null;
  status: "HEALTHY" | "OK" | "SALES" | "INTERNAL" | null;
}

export interface TimeReport {
  month: string;
  group: ReportGroup;
  money: boolean;
  kpis: { key: string; label: string; value: string; note: string }[];
  totalHours: number;
  rows: TimeReportRow[];
  weekend: { week: string; label: string; hours: number }[];
  weekendTarget: number;
  accuracy: { category: string; ratio: number | null; tasks: number }[];
  byPerson: { userId: string; name: string; hours: number }[];
}

export interface TimeApi {
  myWeek(q?: { week?: string; userId?: string }): Promise<MyWeek>;
  /** Typing in a cell: sets the day's manual hours for that row (rounded to 0.25 h). */
  setTimeCell(q: { week: string; rowKey: string; day: number; hours: number; userId?: string }): Promise<void>;
  addManualEntry(input: { date: string; minutes: number; link: TimeLink | null; category: string; billable: boolean; note?: string; userId?: string }): Promise<void>;
  listWeekEntries(q: { week: string; userId?: string }): Promise<TimeEntryView[]>;
  deleteManualEntry(id: string): Promise<void>;
  /** Start a timer on a task, client, project, lead or deal (stops any running one). */
  startTimerOn(link: TimeLink, category?: string): Promise<void>;
  runningTimer(): Promise<MyWeek["timer"]>;
  /** Stop and log; `endAt` lets a forgotten timer stop earlier than now. */
  stopRunningTimer(endAt?: string): Promise<void>;
  submitWeek(week: string): Promise<void>;
  approveWeek(userId: string, week: string): Promise<{ invoiceItems: number }>;
  reopenWeek(userId: string, week: string, comment: string): Promise<void>;
  pendingTimesheets(): Promise<(Timesheet & { name: string; hours: number })[]>;
  timeReport(q: { month: string; group: ReportGroup }): Promise<TimeReport>;
  exportTimeCsv(q: { month: string; group: ReportGroup }): Promise<string>;
  listTimeProjects(): Promise<TimeProject[]>;
  timeTargets(): Promise<{ projects: TimeProject[]; tasks: { id: string; title: string; category: string | null }[]; clients: { id: string; name: string }[] }>;
  listInvoiceItems(clientId?: string): Promise<TimeInvoiceItem[]>;
}
