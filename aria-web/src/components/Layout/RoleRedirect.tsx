import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface RoleRedirectProps {
  allowedRoles: string[];
  children: React.ReactNode;
  redirectTo?: string;
}

export const RoleRedirect: React.FC<RoleRedirectProps> = ({
  allowedRoles,
  children,
  redirectTo = '/login',
}) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    // Rediriger vers le dashboard approprié selon le rôle
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user?.role === 'radiologist') {
      return <Navigate to="/radiologist/dashboard" replace />;
    } else {
      return <Navigate to="/doctor/dashboard" replace />;
    }
  }

  return <>{children}</>;
};