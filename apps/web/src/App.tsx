import { Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { OrganizationDetailPage } from './pages/OrganizationDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/orgs/:slug" element={<OrganizationDetailPage />} />
    </Routes>
  );
}
