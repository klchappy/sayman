import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './lib/auth';
import { useTheme } from './lib/theme';

// Route değişince sayfayı en üste kaydır (mobile-friendly UX)
function ScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    // AppShell içeriği overflow-auto bir div ise oraya da scroll-top uygula:
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
  }, [pathname]);
  return null;
}

// Auth flow eager (küçük + onboarding sırasında hep gerekli)
import { LoginPage } from './pages/Login';
import { AcceptInvitePage } from './pages/auth/AcceptInvite';
import { ForgotPasswordPage } from './pages/auth/ForgotPassword';
import { ResetPasswordPage } from './pages/auth/ResetPassword';
import { SignUpOrgPage } from './pages/auth/SignUpOrg';
import { PublicPortalPage } from './pages/CustomerPortal';

// Korumalı sayfalar lazy — bundle initial size'ı düşürür (~2.2MB → ~600KB)
const DashboardPage = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })),
);
const HomePage = lazy(() => import('./pages/Home').then((m) => ({ default: m.HomePage })));
const AuditLogPage = lazy(() =>
  import('./pages/AuditLog').then((m) => ({ default: m.AuditLogPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/Notifications').then((m) => ({ default: m.NotificationsPage })),
);
const OrganizationDetailPage = lazy(() =>
  import('./pages/OrganizationDetail').then((m) => ({ default: m.OrganizationDetailPage })),
);
const SecurityPage = lazy(() =>
  import('./pages/Security').then((m) => ({ default: m.SecurityPage })),
);
const TasksPage = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.TasksPage })));
const AIAssistantPage = lazy(() =>
  import('./pages/AIAssistant').then((m) => ({ default: m.AIAssistantPage })),
);
const BulkCategorizePage = lazy(() =>
  import('./pages/BulkCategorize').then((m) => ({ default: m.BulkCategorizePage })),
);
const CariListPage = lazy(() =>
  import('./pages/Cari').then((m) => ({ default: m.CariListPage })),
);
const CariDetailPage = lazy(() =>
  import('./pages/Cari').then((m) => ({ default: m.CariDetailPage })),
);
const ErpConnectionsPage = lazy(() =>
  import('./pages/ErpConnections').then((m) => ({ default: m.ErpConnectionsPage })),
);
const ForecastPage = lazy(() =>
  import('./pages/Forecast').then((m) => ({ default: m.ForecastPage })),
);
const BudgetsPage = lazy(() =>
  import('./pages/Budgets').then((m) => ({ default: m.BudgetsPage })),
);
const ChecksPage = lazy(() =>
  import('./pages/Checks').then((m) => ({ default: m.ChecksPage })),
);
const CollectionRemindersPage = lazy(() =>
  import('./pages/CollectionReminders').then((m) => ({ default: m.CollectionRemindersPage })),
);
const CariPortalTokensPage = lazy(() =>
  import('./pages/CustomerPortal').then((m) => ({ default: m.CariPortalTokensPage })),
);
const BalanceSheetPage = lazy(() =>
  import('./pages/BalanceSheet').then((m) => ({ default: m.BalanceSheetPage })),
);
const EmployeesPage = lazy(() =>
  import('./pages/Employees').then((m) => ({ default: m.EmployeesPage })),
);
const FixedAssetsPage = lazy(() =>
  import('./pages/FixedAssets').then((m) => ({ default: m.FixedAssetsPage })),
);
const PayrollPage = lazy(() =>
  import('./pages/Payroll').then((m) => ({ default: m.PayrollPage })),
);
const PayrollRunDetailPage = lazy(() =>
  import('./pages/Payroll').then((m) => ({ default: m.PayrollRunDetailPage })),
);
const ProfitLossPage = lazy(() =>
  import('./pages/ProfitLoss').then((m) => ({ default: m.ProfitLossPage })),
);
const ReconciliationPage = lazy(() =>
  import('./pages/Reconciliation').then((m) => ({ default: m.ReconciliationPage })),
);
const SalesInvoicesPage = lazy(() =>
  import('./pages/SalesInvoices').then((m) => ({ default: m.SalesInvoicesPage })),
);
const StockPage = lazy(() => import('./pages/Stock').then((m) => ({ default: m.StockPage })));
const TaxCalendarPage = lazy(() =>
  import('./pages/TaxCalendar').then((m) => ({ default: m.TaxCalendarPage })),
);
const ImportPage = lazy(() =>
  import('./pages/Import').then((m) => ({ default: m.ImportPage })),
);
const ReviewQueuePage = lazy(() =>
  import('./pages/ReviewQueue').then((m) => ({ default: m.ReviewQueuePage })),
);
const SupportPage = lazy(() =>
  import('./pages/Support').then((m) => ({ default: m.SupportPage })),
);
const InboundWebhooksPage = lazy(() =>
  import('./pages/InboundWebhooks').then((m) => ({ default: m.InboundWebhooksPage })),
);
const InboxPage = lazy(() => import('./pages/Inbox').then((m) => ({ default: m.InboxPage })));
const IntegrationsPage = lazy(() =>
  import('./pages/Integrations').then((m) => ({ default: m.IntegrationsPage })),
);
const OCRPage = lazy(() => import('./pages/OCR').then((m) => ({ default: m.OCRPage })));
const OnboardingPage = lazy(() =>
  import('./pages/Onboarding').then((m) => ({ default: m.OnboardingPage })),
);
const PaymentApprovalsPage = lazy(() =>
  import('./pages/PaymentApprovals').then((m) => ({ default: m.PaymentApprovalsPage })),
);
const SupplierScorecardListPage = lazy(() =>
  import('./pages/SupplierScorecard').then((m) => ({ default: m.SupplierScorecardListPage })),
);
const SupplierScorecardDetailPage = lazy(() =>
  import('./pages/SupplierScorecard').then((m) => ({ default: m.SupplierScorecardDetailPage })),
);
const SubsidiariesPage = lazy(() =>
  import('./pages/Subsidiaries').then((m) => ({ default: m.SubsidiariesPage })),
);
const TenantsManagementPage = lazy(() =>
  import('./pages/TenantsManagement').then((m) => ({ default: m.TenantsManagementPage })),
);
const SystemHealthPage = lazy(() =>
  import('./pages/admin/SystemHealth').then((m) => ({ default: m.SystemHealthPage })),
);
const UsersPage = lazy(() => import('./pages/Users').then((m) => ({ default: m.UsersPage })));
const ArchivePage = lazy(() => import('./pages/Archive').then((m) => ({ default: m.ArchivePage })));
const ConsolidatedReportsPage = lazy(() =>
  import('./pages/ConsolidatedReports').then((m) => ({ default: m.ConsolidatedReportsPage })),
);
const ReferencePage = lazy(() => import('./pages/Reference').then((m) => ({ default: m.ReferencePage })));
const BanksPage = lazy(() =>
  import('./pages/master-data/Banks').then((m) => ({ default: m.BanksPage })),
);
const CompaniesPage = lazy(() =>
  import('./pages/master-data/Companies').then((m) => ({ default: m.CompaniesPage })),
);
const InstitutionsPage = lazy(() =>
  import('./pages/master-data/Institutions').then((m) => ({ default: m.InstitutionsPage })),
);
const PersonsPage = lazy(() =>
  import('./pages/master-data/Persons').then((m) => ({ default: m.PersonsPage })),
);
const PropertiesPage = lazy(() =>
  import('./pages/master-data/Properties').then((m) => ({ default: m.PropertiesPage })),
);
const GuaranteesPage = lazy(() =>
  import('./pages/finance/Guarantees').then((m) => ({ default: m.GuaranteesPage })),
);
const OfficialPaymentsPage = lazy(() =>
  import('./pages/finance/OfficialPayments').then((m) => ({ default: m.OfficialPaymentsPage })),
);
const PayableDetailPage = lazy(() =>
  import('./pages/finance/PayableDetail').then((m) => ({ default: m.PayableDetailPage })),
);
const PayablesPage = lazy(() =>
  import('./pages/finance/Payables').then((m) => ({ default: m.PayablesPage })),
);
const RegularPaymentsPage = lazy(() =>
  import('./pages/finance/RegularPayments').then((m) => ({ default: m.RegularPaymentsPage })),
);
const SubscriptionsPage = lazy(() =>
  import('./pages/finance/Subscriptions').then((m) => ({ default: m.SubscriptionsPage })),
);

// İlk navigation'da kısa süre görünür. Prefetch (lib/route-prefetch) ile
// sonraki gezilerde anında render olur. Ağır spinner yerine üst tarafta hafif progress bar.
function PageFallback() {
  return (
    <div className="min-h-[20vh] relative">
      <div className="absolute top-0 inset-x-0 h-0.5 bg-brand-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full w-1/3 bg-brand-500 dark:bg-brand-300 animate-route-loading" />
      </div>
    </div>
  );
}

export default function App() {
  const init = useAuth((s) => s.init);
  const initTheme = useTheme((s) => s.init);
  useEffect(() => {
    initTheme();
    init();
  }, [init, initTheme]);

  return (
    <>
    <ScrollToTopOnNavigate />
    <Routes>
      {/* Public — auth gerektirmez */}
      <Route path="/portal/:token" element={<PublicPortalPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/sign-up" element={<SignUpOrgPage />} />
      <Route path="/auth/sign-up-org" element={<SignUpOrgPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/accept-invite" element={<AcceptInvitePage />} />

      {/* Protected */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<PageFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />

        <Route
          path="/payables"
          element={
            <Suspense fallback={<PageFallback />}>
              <PayablesPage />
            </Suspense>
          }
        />
        <Route
          path="/payables/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <PayableDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/subscriptions"
          element={
            <Suspense fallback={<PageFallback />}>
              <SubscriptionsPage />
            </Suspense>
          }
        />
        <Route
          path="/regular-payments"
          element={
            <Suspense fallback={<PageFallback />}>
              <RegularPaymentsPage />
            </Suspense>
          }
        />
        <Route
          path="/official-payments"
          element={
            <Suspense fallback={<PageFallback />}>
              <OfficialPaymentsPage />
            </Suspense>
          }
        />
        <Route
          path="/guarantees"
          element={
            <Suspense fallback={<PageFallback />}>
              <GuaranteesPage />
            </Suspense>
          }
        />

        <Route
          path="/master-data/persons"
          element={
            <Suspense fallback={<PageFallback />}>
              <PersonsPage />
            </Suspense>
          }
        />
        <Route
          path="/master-data/companies"
          element={
            <Suspense fallback={<PageFallback />}>
              <CompaniesPage />
            </Suspense>
          }
        />
        <Route
          path="/master-data/properties"
          element={
            <Suspense fallback={<PageFallback />}>
              <PropertiesPage />
            </Suspense>
          }
        />
        <Route
          path="/master-data/banks"
          element={
            <Suspense fallback={<PageFallback />}>
              <BanksPage />
            </Suspense>
          }
        />
        <Route
          path="/master-data/institutions"
          element={
            <Suspense fallback={<PageFallback />}>
              <InstitutionsPage />
            </Suspense>
          }
        />

        <Route
          path="/tasks"
          element={
            <Suspense fallback={<PageFallback />}>
              <TasksPage />
            </Suspense>
          }
        />
        <Route
          path="/notifications"
          element={
            <Suspense fallback={<PageFallback />}>
              <NotificationsPage />
            </Suspense>
          }
        />
        <Route
          path="/audit"
          element={
            <Suspense fallback={<PageFallback />}>
              <AuditLogPage />
            </Suspense>
          }
        />
        <Route
          path="/users"
          element={
            <Suspense fallback={<PageFallback />}>
              <UsersPage />
            </Suspense>
          }
        />
        <Route
          path="/import"
          element={
            <Suspense fallback={<PageFallback />}>
              <ImportPage />
            </Suspense>
          }
        />
        <Route
          path="/review-queue"
          element={
            <Suspense fallback={<PageFallback />}>
              <ReviewQueuePage />
            </Suspense>
          }
        />
        <Route
          path="/destek"
          element={
            <Suspense fallback={<PageFallback />}>
              <SupportPage />
            </Suspense>
          }
        />
        <Route
          path="/arsiv"
          element={
            <Suspense fallback={<PageFallback />}>
              <ArchivePage />
            </Suspense>
          }
        />
        <Route
          path="/raporlar/konsolide"
          element={
            <Suspense fallback={<PageFallback />}>
              <ConsolidatedReportsPage />
            </Suspense>
          }
        />
        <Route
          path="/referans"
          element={
            <Suspense fallback={<PageFallback />}>
              <ReferencePage />
            </Suspense>
          }
        />
        <Route
          path="/ocr"
          element={
            <Suspense fallback={<PageFallback />}>
              <OCRPage />
            </Suspense>
          }
        />
        <Route
          path="/ai"
          element={
            <Suspense fallback={<PageFallback />}>
              <AIAssistantPage />
            </Suspense>
          }
        />
        <Route
          path="/subsidiaries"
          element={
            <Suspense fallback={<PageFallback />}>
              <SubsidiariesPage />
            </Suspense>
          }
        />
        <Route
          path="/sirketler"
          element={
            <Suspense fallback={<PageFallback />}>
              <TenantsManagementPage />
            </Suspense>
          }
        />

        <Route
          path="/admin/health"
          element={
            <Suspense fallback={<PageFallback />}>
              <SystemHealthPage />
            </Suspense>
          }
        />
        <Route
          path="/security"
          element={
            <Suspense fallback={<PageFallback />}>
              <SecurityPage />
            </Suspense>
          }
        />
        <Route
          path="/integrations"
          element={
            <Suspense fallback={<PageFallback />}>
              <IntegrationsPage />
            </Suspense>
          }
        />
        <Route
          path="/integrations/inbound-webhooks"
          element={
            <Suspense fallback={<PageFallback />}>
              <InboundWebhooksPage />
            </Suspense>
          }
        />
        <Route
          path="/forecast"
          element={
            <Suspense fallback={<PageFallback />}>
              <ForecastPage />
            </Suspense>
          }
        />
        <Route
          path="/inbox"
          element={
            <Suspense fallback={<PageFallback />}>
              <InboxPage />
            </Suspense>
          }
        />
        <Route
          path="/suppliers"
          element={
            <Suspense fallback={<PageFallback />}>
              <SupplierScorecardListPage />
            </Suspense>
          }
        />
        <Route
          path="/suppliers/:name"
          element={
            <Suspense fallback={<PageFallback />}>
              <SupplierScorecardDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/tools/bulk-categorize"
          element={
            <Suspense fallback={<PageFallback />}>
              <BulkCategorizePage />
            </Suspense>
          }
        />
        <Route
          path="/onboarding"
          element={
            <Suspense fallback={<PageFallback />}>
              <OnboardingPage />
            </Suspense>
          }
        />
        <Route
          path="/payment-approvals"
          element={
            <Suspense fallback={<PageFallback />}>
              <PaymentApprovalsPage />
            </Suspense>
          }
        />
        <Route
          path="/erp"
          element={
            <Suspense fallback={<PageFallback />}>
              <ErpConnectionsPage />
            </Suspense>
          }
        />
        <Route
          path="/cari"
          element={
            <Suspense fallback={<PageFallback />}>
              <CariListPage />
            </Suspense>
          }
        />
        <Route
          path="/cari/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <CariDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/sales-invoices"
          element={
            <Suspense fallback={<PageFallback />}>
              <SalesInvoicesPage />
            </Suspense>
          }
        />
        <Route
          path="/stock"
          element={
            <Suspense fallback={<PageFallback />}>
              <StockPage />
            </Suspense>
          }
        />
        <Route
          path="/tax-calendar"
          element={
            <Suspense fallback={<PageFallback />}>
              <TaxCalendarPage />
            </Suspense>
          }
        />
        <Route
          path="/budgets"
          element={
            <Suspense fallback={<PageFallback />}>
              <BudgetsPage />
            </Suspense>
          }
        />
        <Route
          path="/checks"
          element={
            <Suspense fallback={<PageFallback />}>
              <ChecksPage />
            </Suspense>
          }
        />
        <Route
          path="/collection-reminders"
          element={
            <Suspense fallback={<PageFallback />}>
              <CollectionRemindersPage />
            </Suspense>
          }
        />
        <Route
          path="/fixed-assets"
          element={
            <Suspense fallback={<PageFallback />}>
              <FixedAssetsPage />
            </Suspense>
          }
        />
        <Route
          path="/reports/profit-loss"
          element={
            <Suspense fallback={<PageFallback />}>
              <ProfitLossPage />
            </Suspense>
          }
        />
        <Route
          path="/reports/balance-sheet"
          element={
            <Suspense fallback={<PageFallback />}>
              <BalanceSheetPage />
            </Suspense>
          }
        />
        <Route
          path="/employees"
          element={
            <Suspense fallback={<PageFallback />}>
              <EmployeesPage />
            </Suspense>
          }
        />
        <Route
          path="/payroll"
          element={
            <Suspense fallback={<PageFallback />}>
              <PayrollPage />
            </Suspense>
          }
        />
        <Route
          path="/payroll/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <PayrollRunDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/cari/:id/reconciliation"
          element={
            <Suspense fallback={<PageFallback />}>
              <ReconciliationPage />
            </Suspense>
          }
        />
        <Route
          path="/cari/:id/portal-tokens"
          element={
            <Suspense fallback={<PageFallback />}>
              <CariPortalTokensPage />
            </Suspense>
          }
        />

        <Route
          path="/orgs"
          element={
            <Suspense fallback={<PageFallback />}>
              <HomePage />
            </Suspense>
          }
        />
        <Route
          path="/orgs/:slug"
          element={
            <Suspense fallback={<PageFallback />}>
              <OrganizationDetailPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
    </>
  );
}
