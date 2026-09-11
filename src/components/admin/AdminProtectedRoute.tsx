import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuthStore } from '../../store/adminAuthStore';

export default function AdminProtectedRoute() {
  const token = useAdminAuthStore((s) => s.token);
  const admin = useAdminAuthStore((s) => s.admin);
  const location = useLocation();

  if (!token) return <Navigate to="/admin/login" replace />;

  /**
   * The API would refuse anyway — the token held at this point reaches only the
   * change-password endpoint — but bouncing off a 403 would look like a broken back
   * office rather than a step nobody has finished.
   */
  if (admin?.mustChangePassword && location.pathname !== '/admin/change-password') {
    return <Navigate to="/admin/change-password" replace />;
  }

  return <Outlet />;
}
