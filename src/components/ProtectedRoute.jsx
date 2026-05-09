
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { account, databases, db, Query } from '../lib/appwrite';

export default function ProtectedRoute({ children, role }) {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await account.get();
      setSession(user);
      
      // Fetch role from profiles collection
      const { documents } = await databases.listDocuments(
        db.id,
        db.collections.profiles,
        [Query.equal("userId", user.$id)]
      );

      if (documents.length > 0) {
        setUserRole(documents[0].role);
      }
    } catch (err) {
      console.log('No active session');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!session) return <Navigate to="/" replace />;

  if (role && userRole !== role && userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
