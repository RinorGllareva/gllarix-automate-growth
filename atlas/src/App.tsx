import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import AppShell from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/overlay";
import { canAccess, homePathFor, NAV_ITEMS, type PageId } from "@/lib/nav";
import Admin from "@/pages/Admin";
import Login from "@/pages/Login";
import { ComingSoon, Forbidden, NotFound } from "@/pages/StatusPages";
import StyleGuide from "@/pages/StyleGuide";
import { SkeletonRows } from "@/components/ui/primitives";

// Modules load on first visit (leads pulls in phone-number metadata and the CSV parser).
const LeadsModule = lazy(() => import("@/pages/leads"));
const CallModule = lazy(() => import("@/pages/call"));
const Today = lazy(() => import("@/pages/today/Today"));
const Meetings = lazy(() => import("@/pages/meetings"));
const SupportPage = lazy(() => import("@/pages/support"));
const DocsPage = lazy(() => import("@/pages/docs"));
const AgentPage = lazy(() => import("@/pages/ai/Agent"));
const TrackerPage = lazy(() => import("@/pages/ai/Tracker"));
const Pipeline = lazy(() => import("@/pages/pipeline/Pipeline"));
const Reports = lazy(() => import("@/pages/reports/Reports"));
const Book = lazy(() => import("@/pages/public/Book"));
const Unsubscribe = lazy(() => import("@/pages/public/Unsubscribe"));
const QuotePage = lazy(() => import("@/pages/public/QuotePage"));
const SignContract = lazy(() => import("@/pages/public/SignContract"));
const FakeCheckout = lazy(() => import("@/pages/public/FakeCheckout"));
const DealsModule = lazy(() => import("@/pages/deals"));
const ClientsModule = lazy(() => import("@/pages/clients/Clients"));
const TasksModule = lazy(() => import("@/pages/tasks"));
const TeamModule = lazy(() => import("@/pages/team"));
const TimeModule = lazy(() => import("@/pages/time"));
const AdvisorModule = lazy(() => import("@/pages/advisor"));
const ClientReportPage = lazy(() => import("@/pages/public/ClientReportPage"));
const Finance = lazy(() => import("@/pages/money/Finance"));
const Prices = lazy(() => import("@/pages/money/Prices"));
const Payments = lazy(() => import("@/pages/money/Payments"));
const FinancialPlan = lazy(() => import("@/pages/money/FinancialPlan"));
const Roi = lazy(() => import("@/pages/money/Roi"));
const Commissions = lazy(() => import("@/pages/people/Commissions"));
const Hiring = lazy(() => import("@/pages/people/Hiring"));
const Training = lazy(() => import("@/pages/people/Training"));
const RoleKpis = lazy(() => import("@/pages/people/RoleKpis"));
const Marketing = lazy(() => import("@/pages/growth/Marketing"));
const Markets = lazy(() => import("@/pages/growth/Markets"));
const InboundPage = lazy(() => import("@/pages/inbound/Inbound"));
const GrowthAutomations = lazy(() => import("@/pages/growth/Automations"));
const GrowthCadences = lazy(() => import("@/pages/growth/Cadences"));
const OperationsPlan = lazy(() => import("@/pages/work/OperationsPlan"));

/** Signed-out users go to /login?next=<where they were>. */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen bg-bg" />;
  if (!user) {
    const next = location.pathname + location.search;
    return <Navigate to={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
};

/** Role check per page; forbidden routes render a 403 inside the shell. */
const RequirePage = ({ page, children }: { page: PageId; children: ReactNode }) => {
  const { user } = useAuth();
  return user && canAccess(user.role, page) ? <>{children}</> : <Forbidden />;
};

const Home = () => {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
};

// Each module registers its page here as it lands (M1: leads, M3: today and call, …).
const PAGE_ELEMENTS: Partial<Record<PageId, ReactNode>> = {
  today: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Today />
    </Suspense>
  ),
  call: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <CallModule />
    </Suspense>
  ),
  meetings: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Meetings />
    </Suspense>
  ),
  pipeline: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Pipeline />
    </Suspense>
  ),
  reports: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Reports />
    </Suspense>
  ),
  team: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <TeamModule />
    </Suspense>
  ),
  advisor: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <AdvisorModule />
    </Suspense>
  ),
  time: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <TimeModule />
    </Suspense>
  ),
  tasks: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <TasksModule />
    </Suspense>
  ),
  clients: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <ClientsModule />
    </Suspense>
  ),
  deals: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <DealsModule />
    </Suspense>
  ),
  leads: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <LeadsModule />
    </Suspense>
  ),
  finance: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Finance />
    </Suspense>
  ),
  payments: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Payments />
    </Suspense>
  ),
  plan: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <FinancialPlan />
    </Suspense>
  ),
  roi: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Roi />
    </Suspense>
  ),
  prices: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Prices />
    </Suspense>
  ),
  hiring: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Hiring />
    </Suspense>
  ),
  inbound: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <InboundPage />
    </Suspense>
  ),
  ops: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <OperationsPlan />
    </Suspense>
  ),
  marketing: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Marketing />
    </Suspense>
  ),
  markets: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Markets />
    </Suspense>
  ),
  kpis: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <RoleKpis />
    </Suspense>
  ),
  training: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Training />
    </Suspense>
  ),
  commissions: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <Commissions />
    </Suspense>
  ),  support: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <SupportPage />
    </Suspense>
  ),  docs: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <DocsPage />
    </Suspense>
  ),  agent: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <AgentPage />
    </Suspense>
  ),
  tracker: (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <TrackerPage />
    </Suspense>
  ),
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    {/* Public pages: no sign-in (booking links and unsubscribe links in emails). */}
    <Route
      path="/book/:slug"
      element={
        <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
          <Book />
        </Suspense>
      }
    />
    <Route
      path="/q/:token"
      element={
        <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
          <QuotePage />
        </Suspense>
      }
    />
    <Route
      path="/c/:token"
      element={
        <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
          <SignContract />
        </Suspense>
      }
    />
    <Route
      path="/r/:token"
      element={
        <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
          <ClientReportPage />
        </Suspense>
      }
    />
    <Route
      path="/pay/:id"
      element={
        <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
          <FakeCheckout />
        </Suspense>
      }
    />
    <Route
      path="/u/:token"
      element={
        <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
          <Unsubscribe />
        </Suspense>
      }
    />
    <Route
      element={
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      }
    >
      <Route index element={<Home />} />
      {NAV_ITEMS.filter((item) => item.id !== "admin").map((item) => (
        <Route
          key={item.id}
          path={`${item.path}/*`}
          element={<RequirePage page={item.id}>{PAGE_ELEMENTS[item.id] ?? <ComingSoon />}</RequirePage>}
        />
      ))}
      <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
      <Route
        path="/admin/:section"
        element={
          <RequirePage page="admin">
            <Admin />
          </RequirePage>
        }
      />
      <Route path="/planner" element={<Navigate to="/tasks/planner" replace />} />
      {/* Growth pages that reuse Tasks / Settings screens, without those modules' headers. */}
      <Route
        path="/automations"
        element={
          <RequirePage page="admin">
            <Suspense fallback={<SkeletonRows rows={8} />}>
              <GrowthAutomations />
            </Suspense>
          </RequirePage>
        }
      />
      <Route
        path="/cadences"
        element={
          <RequirePage page="admin">
            <Suspense fallback={<SkeletonRows rows={8} />}>
              <GrowthCadences />
            </Suspense>
          </RequirePage>
        }
      />
      <Route path="/planner/:id" element={<PlannerRedirect />} />
      {/* Style guide: admins, and everyone in local development. */}
      <Route
        path="/styleguide"
        element={import.meta.env.DEV ? <StyleGuide /> : <RequirePage page="admin">{<StyleGuide />}</RequirePage>}
      />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);

/** /planner/{plan_id} (screen 20) lives inside Tasks. */
const PlannerRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/tasks/planner/${id ?? ""}`} replace />;
};

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
