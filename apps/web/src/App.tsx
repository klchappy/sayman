import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './lib/auth';
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
  useEffect(() => {
    init();
  }, [init]);

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

        <Route path="/security" element={<SecurityPage />} />

        <Route path="/orgs" element={<HomePage />} />
        <Route path="/orgs/:slug" element={<OrganizationDetailPage />} />
      </Route>
    </Routes>
  );
}
