import { createClient } from "@supabase/supabase-js";
import type { AuditEntry, DataSource, LeadsApi, Notification, DealsApi, ClientsApi, LeadSourcesApi, TasksApi, CapacityApi, PlannerApi, AutomationsApi, TeamApi, TimeApi, AdvisorApi, CalendarApi, PeopleApi, GrowthApi, InboundApi, OpsApi, RecordsApi, SupportApi, ContractsApi, DocsApi, AgentApi, EmailApi, QueueApi, SalesApi, SignInResult, User } from "./types";

/** Lead methods in Supabase mode land once the M1 migration is applied to the project (see docs/SCREENS_STATUS.md). */
const notWiredYet = (): Promise<never> =>
  Promise.reject(new Error("Leads aren't connected to Supabase yet. Use demo mode (VITE_ATLAS_DATA=demo) for now."));

const LEADS_NOT_WIRED: LeadsApi = {
  listLeads: notWiredYet,
  getLead: notWiredYet,
  updateLead: notWiredYet,
  addNote: notWiredYet,
  setPrimaryContact: notWiredYet,
  markContact: notWiredYet,
  bulkAssign: notWiredYet,
  rescore: notWiredYet,
  exportLeads: notWiredYet,
  leadFacets: notWiredYet,
  listSuppression: notWiredYet,
  addSuppression: notWiredYet,
  removeSuppression: notWiredYet,
  dedupContext: notWiredYet,
  commitImport: notWiredYet,
  listImports: notWiredYet,
  undoImport: notWiredYet,
  setCadence: notWiredYet,
  runNightlyJobs: notWiredYet,
  complianceOverview: notWiredYet,
  setRetentionMonths: notWiredYet,
  exportPersonalData: notWiredYet,
  erasePersonalData: notWiredYet,
};

const QUEUE_NOT_WIRED: QueueApi = {
  getQueue: notWiredYet,
  buildQueue: notWiredYet,
  todayStats: notWiredYet,
  teamToday: notWiredYet,
  callContext: notWiredYet,
  saveCallNotes: notWiredYet,
  logOutcome: notWiredYet,
  skipLead: notWiredYet,
};

const SALES_NOT_WIRED: SalesApi = {
  listMeetings: notWiredYet,
  getMeeting: notWiredYet,
  searchMeetings: notWiredYet,
  saveMeetingNotes: notWiredYet,
  markMeeting: notWiredYet,
  createMeeting: notWiredYet,
  approveMeeting: notWiredYet,
  rejectMeeting: notWiredYet,
  closeMonth: notWiredYet,
  pipeline: notWiredYet,
  moveDeal: notWiredYet,
  report: notWiredYet,
  dailyReport: notWiredYet,
  listCommissions: notWiredYet,
};

const EMAIL_NOT_WIRED: EmailApi = {
  listTemplates: notWiredYet,
  saveTemplate: notWiredYet,
  previewTemplate: notWiredYet,
  composeEmail: notWiredYet,
  outbox: notWiredYet,
  inboxes: notWiredYet,
  runSender: notWiredYet,
  lastSenderRun: notWiredYet,
  simulateReply: notWiredYet,
  getBranding: notWiredYet,
  saveBranding: notWiredYet,
  bookingPath: notWiredYet,
  bookingPage: notWiredYet,
  book: notWiredYet,
  unsubscribe: notWiredYet,
};

const DEALS_NOT_WIRED: DealsApi = {
  listDeals: notWiredYet,
  getDeal: notWiredYet,
  createDeal: notWiredYet,
  updateDraft: notWiredYet,
  requestDiscount: notWiredYet,
  decideDiscount: notWiredYet,
  pendingDiscounts: notWiredYet,
  saveQuote: notWiredYet,
  sendQuote: notWiredYet,
  publicQuote: notWiredYet,
  acceptQuote: notWiredYet,
  startCheckout: notWiredYet,
  checkoutSession: notWiredYet,
  completeTestCheckout: notWiredYet,
  stripeWebhook: notWiredYet,
  listPayments: notWiredYet,
  listClients: notWiredYet,
  parityCheck: notWiredYet,
};

const TEAM_NOT_WIRED: TeamApi = {
  teamOverview: notWiredYet,
  scorecard: notWiredYet,
  getCallReview: notWiredYet,
  humanCheck: notWiredYet,
  disputeReview: notWiredYet,
  addScorecardComment: notWiredYet,
  updateAgenda: notWiredYet,
  prepareOneOnOnes: notWiredYet,
  setAiScoring: notWiredYet,
  runCoachingJobs: notWiredYet,
  coachingSettings: notWiredYet,
};

const TIME_NOT_WIRED: TimeApi = {
  myWeek: notWiredYet,
  setTimeCell: notWiredYet,
  addManualEntry: notWiredYet,
  listWeekEntries: notWiredYet,
  deleteManualEntry: notWiredYet,
  startTimerOn: notWiredYet,
  runningTimer: notWiredYet,
  stopRunningTimer: notWiredYet,
  submitWeek: notWiredYet,
  approveWeek: notWiredYet,
  reopenWeek: notWiredYet,
  pendingTimesheets: notWiredYet,
  timeReport: notWiredYet,
  exportTimeCsv: notWiredYet,
  listTimeProjects: notWiredYet,
  timeTargets: notWiredYet,
  listInvoiceItems: notWiredYet,
};

// The AI co-founder runs in the "advisor" Edge Function (prompt + API key server-side, tools as the asking user).
const ADVISOR_NOT_WIRED: AdvisorApi = {
  advisorHome: notWiredYet,
  getAdvisorThread: notWiredYet,
  askAdvisor: notWiredYet,
  acceptAdvisorAction: notWiredYet,
  dismissAdvisorAction: notWiredYet,
  logMemoAsDecision: notWiredYet,
  rememberFromMessage: notWiredYet,
  reviewMemory: notWiredYet,
  searchKnowledge: notWiredYet,
  listDecisions: notWiredYet,
  logSpendDecision: notWiredYet,
  runAdvisorJobs: notWiredYet,
  advisorSettings: notWiredYet,
  setAdvisorSettings: notWiredYet,
  listFinanceData: notWiredYet,
  addExpense: notWiredYet,
  addCashSnapshot: notWiredYet,
};

// Google Calendar runs in the "google-calendar" Edge Function (OAuth, refresh tokens server-side); alerts on pg_cron.
const CALENDAR_NOT_WIRED: CalendarApi = {
  calendarEvents: notWiredYet,
  calendarConnection: notWiredYet,
  connectGoogleCalendar: notWiredYet,
  disconnectGoogleCalendar: notWiredYet,
  syncCalendar: notWiredYet,
  notificationPrefs: notWiredYet,
  setNotificationPrefs: notWiredYet,
  runAlertJobs: notWiredYet,
  myAlertEmails: notWiredYet,
};

// Hiring and training tables (openings, candidates, trainees) come with the People migration.
const PEOPLE_NOT_WIRED: PeopleApi = {
  hiringBoard: notWiredYet,
  saveOpening: notWiredYet,
  addCandidate: notWiredYet,
  updateCandidate: notWiredYet,
  startTraining: notWiredYet,
  trainingView: notWiredYet,
  addBlockScore: notWiredYet,
  setBlockPassed: notWiredYet,
  setTrainingAsset: notWiredYet,
};

// Marketing channels, tests and the competitor map come with the Growth migration.
const GROWTH_NOT_WIRED: GrowthApi = {
  marketingHome: notWiredYet,
  updateChannel: notWiredYet,
  saveExperiment: notWiredYet,
  marketsHome: notWiredYet,
  saveCompetitor: notWiredYet,
  markCompetitorChecked: notWiredYet,
};

// Inbound arrives through an Edge Function (website forms, demo line); SOPs and rhythm ticks need the Ops migration.
const INBOUND_OPS_NOT_WIRED: InboundApi & OpsApi = {
  inboundHome: notWiredYet,
  receiveInbound: notWiredYet,
  claimInbound: notWiredYet,
  respondInbound: notWiredYet,
  convertInbound: notWiredYet,
  dismissInbound: notWiredYet,
  opsHome: notWiredYet,
  automationLedger: notWiredYet,
  updateSop: notWiredYet,
  setOpsCheck: notWiredYet,
};

// Files go to Supabase Storage; contacts and tags need the lead write policies.
const RECORDS_NOT_WIRED: RecordsApi = {
  listFiles: notWiredYet,
  uploadFile: notWiredYet,
  deleteFile: notWiredYet,
  saveContact: notWiredYet,
  setLeadTags: notWiredYet,
};

// Tickets need the support migration and an inbound email address per client.
const SUPPORT_NOT_WIRED: SupportApi = {
  listTickets: notWiredYet,
  getTicket: notWiredYet,
  createTicket: notWiredYet,
  replyTicket: notWiredYet,
  updateTicket: notWiredYet,
};

// Contracts need Storage for the signed PDF and an Edge Function for the public signing link.
const CONTRACTS_NOT_WIRED: ContractsApi = {
  listContracts: notWiredYet,
  createContract: notWiredYet,
  saveContractDraft: notWiredYet,
  sendContract: notWiredYet,
  voidContract: notWiredYet,
  publicContract: notWiredYet,
  signContract: notWiredYet,
};

// Docs need the docs table; the Notion import runs the same parser server-side.
const DOCS_NOT_WIRED: DocsApi = {
  listDocs: notWiredYet,
  getDoc: notWiredYet,
  saveDoc: notWiredYet,
  archiveDoc: notWiredYet,
  importNotionDocs: notWiredYet,
  setNotionReadOnly: notWiredYet,
};

// The agent needs Twilio, an AI voice and its prompt server-side (never in the browser).
const AGENT_NOT_WIRED: AgentApi = {
  agentHome: notWiredYet,
  saveAgent: notWiredYet,
  runAgentShadow: notWiredYet,
};

const PLANNER_NOT_WIRED: PlannerApi = {
  createPlan: notWiredYet,
  getPlan: notWiredYet,
  updatePlanRow: notWiredYet,
  addPlanRow: notWiredYet,
  updatePlanSettings: notWiredYet,
  acceptPlan: notWiredYet,
  rejectPlan: notWiredYet,
  planLog: notWiredYet,
  splitTask: notWiredYet,
  replan: notWiredYet,
  applyPlanChange: notWiredYet,
  weeklyPicks: notWiredYet,
  taskFit: notWiredYet,
};

const AUTOMATIONS_NOT_WIRED: AutomationsApi = {
  listAutomations: notWiredYet,
  saveAutomation: notWiredYet,
  setAutomationActive: notWiredYet,
  deleteAutomation: notWiredYet,
  saveTaskTemplate: notWiredYet,
  deleteTaskTemplate: notWiredYet,
  listGoals: notWiredYet,
  saveGoal: notWiredYet,
  deleteGoal: notWiredYet,
};

const CAPACITY_NOT_WIRED: CapacityApi = {
  capacityPlan: notWiredYet,
  applySuggestion: notWiredYet,
  dismissSuggestion: notWiredYet,
  updateAvailability: notWiredYet,
  addTimeOff: notWiredYet,
  removeTimeOff: notWiredYet,
  setCapacitySettings: notWiredYet,
};

const TASKS_NOT_WIRED: TasksApi = {
  tasksHome: notWiredYet,
  listTasks: notWiredYet,
  getTask: notWiredYet,
  createTask: notWiredYet,
  updateTask: notWiredYet,
  bulkUpdateTasks: notWiredYet,
  deleteTask: notWiredYet,
  restoreTask: notWiredYet,
  addChecklistItem: notWiredYet,
  updateChecklistItem: notWiredYet,
  deleteChecklistItem: notWiredYet,
  addComment: notWiredYet,
  editComment: notWiredYet,
  deleteComment: notWiredYet,
  addAttachment: notWiredYet,
  removeAttachment: notWiredYet,
  addDependency: notWiredYet,
  removeDependency: notWiredYet,
  startTimer: notWiredYet,
  stopTimer: notWiredYet,
  addTimeEntry: notWiredYet,
  deleteTimeEntry: notWiredYet,
  taskInbox: notWiredYet,
  markInboxRead: notWiredYet,
  listSavedViews: notWiredYet,
  saveView: notWiredYet,
  deleteSavedView: notWiredYet,
  createList: notWiredYet,
  renameList: notWiredYet,
  archiveList: notWiredYet,
  searchTasks: notWiredYet,
  tasksFor: notWiredYet,
  importNotionTasks: notWiredYet,
};

const SOURCES_NOT_WIRED: LeadSourcesApi = {
  sourcesOverview: notWiredYet,
  setConnector: notWiredYet,
  runListBuild: notWiredYet,
  runEnrichment: notWiredYet,
  enrichLead: notWiredYet,
  setJobPaused: notWiredYet,
  retryJobRun: notWiredYet,
  scoringReport: notWiredYet,
};

const CLIENTS_NOT_WIRED: ClientsApi = {
  runBillingJobs: notWiredYet,
  clientsOverview: notWiredYet,
  listInvoices: notWiredYet,
  getClient: notWiredYet,
  setOnboardingStep: notWiredYet,
  setClientStatus: notWiredYet,
  sendClientReport: notWiredYet,
  publicClientReport: notWiredYet,
  completeClientTask: notWiredYet,
  exportClientUsage: notWiredYet,
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  timezone: string;
  daily_capacity: number | null;
  active: boolean;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  timezone: r.timezone,
  dailyCapacity: r.daily_capacity,
  active: r.active,
});

/** Supabase-backed source. Tables come from supabase/migrations; RLS is the second line of defence. */
export const createSupabaseSource = (url: string, publishableKey: string): DataSource => {
  const sb = createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } });

  const profile = async (authId: string) => {
    const { data } = await sb.from("users").select("*").eq("auth_id", authId).maybeSingle<UserRow>();
    return data ? toUser(data) : null;
  };

  const audit = async (action: string, after: unknown = null) => {
    await sb.rpc("log_audit", { p_action: action, p_entity: "session", p_after: after });
  };

  return {
    ...LEADS_NOT_WIRED,
    ...RECORDS_NOT_WIRED,
    ...SUPPORT_NOT_WIRED,
    ...CONTRACTS_NOT_WIRED,
    ...DOCS_NOT_WIRED,
    ...AGENT_NOT_WIRED,
    ...QUEUE_NOT_WIRED,
    ...SALES_NOT_WIRED,
    ...EMAIL_NOT_WIRED,
    ...DEALS_NOT_WIRED,
    ...CLIENTS_NOT_WIRED,
    ...SOURCES_NOT_WIRED,
    ...TASKS_NOT_WIRED,
    ...CAPACITY_NOT_WIRED,
    ...PLANNER_NOT_WIRED,
    ...TEAM_NOT_WIRED,
    ...TIME_NOT_WIRED,
    ...ADVISOR_NOT_WIRED,
    ...CALENDAR_NOT_WIRED,
    ...PEOPLE_NOT_WIRED,
    ...GROWTH_NOT_WIRED,
    ...INBOUND_OPS_NOT_WIRED,
    ...AUTOMATIONS_NOT_WIRED,
    kind: "supabase",

    async signInWithPassword(email, password): Promise<SignInResult> {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) return { ok: false, error: error.status === 429 ? "rate_limited" : "invalid" };
      const user = await profile(data.user.id);
      if (!user) {
        await sb.auth.signOut();
        return { ok: false, error: "invalid" };
      }
      if (!user.active) {
        await sb.auth.signOut();
        return { ok: false, error: "paused" };
      }
      await audit("auth.sign_in");
      return { ok: true, user };
    },

    async sendMagicLink(email) {
      // shouldCreateUser: false keeps access invite-only.
      await sb.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/today` },
      });
    },

    async signOut() {
      await audit("auth.sign_out");
      await sb.auth.signOut();
    },

    async currentUser() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const user = await profile(data.user.id);
      return user?.active ? user : null;
    },

    async listUsers() {
      const { data } = await sb.from("users").select("*").order("name");
      return ((data ?? []) as UserRow[]).map(toUser);
    },

    async listNotifications(userId) {
      const { data } = await sb
        .from("notifications")
        .select("id, user_id, type, text, href, created_at, read_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []).map(
        (n): Notification => ({
          id: n.id,
          userId: n.user_id,
          type: n.type,
          text: n.text,
          href: n.href,
          createdAt: n.created_at,
          readAt: n.read_at,
        }),
      );
    },

    async markNotificationRead(id) {
      await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
    },

    async markAllNotificationsRead(userId) {
      await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    },

    async listAudit(limit = 50) {
      const { data } = await sb.from("audit_log").select("*").order("at", { ascending: false }).limit(limit);
      return (data ?? []).map(
        (a): AuditEntry => ({
          id: a.id,
          userId: a.user_id,
          action: a.action,
          entity: a.entity,
          entityId: a.entity_id,
          before: a.before,
          after: a.after,
          at: a.at,
        }),
      );
    },
  };
};
