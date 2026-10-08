import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute — Enterprise Gate
 * 
 * Security contract:
 * - If user is NOT authenticated → redirect to /login immediately
 * - Preserves the originally requested path via `location.state.from`
 *   so user is returned there after successful login
 * - Optional `requiredRole` enforcement for role-gated routes (e.g., /admin)
 * - Shows a minimal, branded loading spinner while auth state resolves
 */
export const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, loading, userRole } = useAuth();
  const location = useLocation();

  // While auth state is loading, show a minimal branded spinner
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#18181c] text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-blue-500/30 rounded-full" />
            <div className="absolute inset-0 w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-xs text-slate-400 font-medium tracking-wide">Verifying session...</span>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect to login, passing current path as state
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a specific role is required (e.g., 'manager' for /admin), enforce it
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/**
 * PublicRoute — Auth Page Gate
 * 
 * Security contract:
 * - Wraps auth pages (/login, /signup)
 * - If user IS already authenticated, redirect them AWAY to the dashboard
 * - Prevents authenticated users from seeing login/signup forms (which could
 *   cause confusion or session state issues)
 * - If `location.state.from` exists, redirect to the original destination
 */
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // While auth state is loading, show a minimal branded spinner
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#18181c] text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-blue-500/30 rounded-full" />
            <div className="absolute inset-0 w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-xs text-slate-400 font-medium tracking-wide">Checking authentication...</span>
        </div>
      </div>
    );
  }

  // Already logged in → redirect to the originally requested path or dashboard
  if (isAuthenticated) {
    const redirectTo = location.state?.from?.pathname || '/';
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};
