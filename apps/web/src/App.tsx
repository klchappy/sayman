import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './lib/auth';
import { useTheme } from './lib/theme';
import { DashboardPage } from './pages/Dashboard';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { AuditLogPage } from './pages/AuditLog';
import { NotificationsPage } from './pages/Notifications';
import { OrganizationDetailPage } from './pages/OrganizationDetail';
import { SecurityPage } from './pages/Security';
import { TasksPage } from './pages/Tasks';
import { AcceptInvitePage } from './pages/auth/AcceptInvite';
import { ForgotPasswordPage } from './pages/auth/ForgotPassword';
import { ResetPasswordPage } from './pages/auth/ResetPassword';
import { SignUpOrgPage } from './pages/auth/SignUpOrg';
import { AIAssistantPage } from './pages/AIAssistant';
import { BulkCategorizePage } from './pages/BulkCategorize';
import { CariDetailPage, CariListPage } from './pages/Cari';
import { ErpConnectionsPage } from './pages/ErpConnections';
import { ForecastPage } from './pages/Forecast';
import { ImportPage } from './pages/Import';
import { InboundWebhooksPage } from './pages/InboundWebhooks';
import { InboxPage } from './pages/Inbox';
import { IntegrationsPage } from './pages/Integrations';
import { OCRPage } from './pages/OCR';
import { OnboardingPage } from './pages/Onboarding';
import { PaymentApprovalsPage } from './pages/PaymentApprovals';
import {
  SupplierScorecardDetailPage,
  SupplierScorecardListPage,
} from './pages/SupplierScorecard';
import { SubsidiariesPage } from './pages/Subsidiaries';
import { UsersPage } from './pages/Users';
import { BanksPage } from './pages/master-data/Banks';
import { CompaniesPage } from './pages/master-data/Companies';
import { InstitutionsPage } from './pages/master-data/Institutions';
import { PersonsPage } from './pages/master-data/Persons';
import { PropertiesPage } from './pages/master-data/Properties';
import { GuaranteesPage } from './pages/finance/Guarantees';
import { OfficialPaymentsPage } from './pages/finance/OfficialPayments';
import { PayableDetailPage } from './pages/finance/PayableDetail';
import { PayablesPage } from './pages/finance/Payables';
import { RegularPaymentsPage } from './pages/finance/RegularPayments';
import { SubscriptionsPage } from './pages/finance/Subscriptions';

export default function App() {
  const init = useAuth((s) => s.init);
  const initTheme = useTheme((s) => s.init);
  useEffect(() => {
    initTheme();
    init();
  }, [init, initTheme]);

  return (
    <Routes>
      {/* Public */}
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
        <Route index element={<DashboardPage />} />

        <Route path="/payables" element={<PayablesPage />} />
        <Route path="/payables/:id" element={<PayableDetailPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/regular-payments" element={<RegularPaymentsPage />} />
        <Route path="/official-payments" element={<OfficialPaymentsPage />} />
        <Route path="/guarantees" element={<GuaranteesPage />} />

        <Route path="/master-data/persons" element={<PersonsPage />} />
        <Route path="/master-data/companies" element={<CompaniesPage />} />
        <Route path="/master-data/properties" element={<PropertiesPage />} />
        <Route path="/master-data/banks" element={<BanksPage />} />
        <Route path="/master-data/institutions" element={<InstitutionsPage />} />

        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/ocr" element={<OCRPage />} />
        <Route path="/ai" element={<AIAssistantPage />} />
        <Route path="/subsidiaries" element={<SubsidiariesPage />} />

        <Route path="/security" element={<SecurityPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/integrations/inbound-webhooks" element={<InboundWebhooksPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/suppliers" element={<SupplierScorecardListPage />} />
        <Route path="/suppliers/:name" element={<SupplierScorecardDetailPage />} />
        <Route path="/tools/bulk-categorize" element={<BulkCategorizePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/payment-approvals" element={<PaymentApprovalsPage />} />
        <Route path="/erp" element={<ErpConnectionsPage />} />
        <Route path="/cari" element={<CariListPage />} />
        <Route path="/cari/:id" element={<CariDetailPage />} />

        <Route path="/orgs" element={<HomePage />} />
        <Route path="/orgs/:slug" element={<OrganizationDetailPage />} />
      </Route>
    </Routes>
  );
}
