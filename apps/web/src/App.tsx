import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './lib/auth';
import { DashboardPage } from './pages/Dashboard';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { OrganizationDetailPage } from './pages/OrganizationDetail';
import { CompaniesPage } from './pages/master-data/Companies';
import { PersonsPage } from './pages/master-data/Persons';
import { PayableDetailPage } from './pages/finance/PayableDetail';
import { PayablesPage } from './pages/finance/Payables';

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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

        <Route path="/master-data/persons" element={<PersonsPage />} />
        <Route path="/master-data/companies" element={<CompaniesPage />} />

        <Route path="/orgs" element={<HomePage />} />
        <Route path="/orgs/:slug" element={<OrganizationDetailPage />} />
      </Route>
    </Routes>
  );
}
