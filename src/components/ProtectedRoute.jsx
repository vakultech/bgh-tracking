
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { account, databases, db, Query } from '../lib/appwrite';

import { useUser } from '../UserContext';

export default function ProtectedRoute({ children, role }) {
  const { user, profile, loading } = useUser();
  const userRole = profile?.role;

  if (loading) return <div className="loading">Loading...</div>;

  if (!session) return <Navigate to="/" replace />;

  if (role && userRole !== role && userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
