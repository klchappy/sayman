import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './lib/auth';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { OrganizationDetailPage } from './pages/OrganizationDetail';

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orgs/:slug"
        element={
          <ProtectedRoute>
            <OrganizationDetailPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
