import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../UserContext';

export default function ProtectedRoute({ children, role }) {
  const { user, profile, loading } = useUser();
  const userRole = profile?.role;

  if (loading) return <div className="loading">Loading...</div>;

  if (!user) return <Navigate to="/" replace />;

  if (role && userRole !== role && userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
