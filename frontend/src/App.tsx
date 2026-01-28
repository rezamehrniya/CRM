import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Companies from './pages/Companies';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/t/demo/app" replace />} />
      <Route path="/t/:tenantSlug/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="companies" element={<Companies />} />
      </Route>
      <Route path="*" element={<div className="p-8 text-center">صفحه یافت نشد</div>} />
    </Routes>
  );
}
