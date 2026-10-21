import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Wraps admin-only routes.
 * If the user is authenticated but not an admin, redirects to /dashboard.
 */
export default function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
