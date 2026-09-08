import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuthStore } from '../../store/adminAuthStore';

export default function AdminProtectedRoute() {
  const token = useAdminAuthStore((s) => s.token);
  return token ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
