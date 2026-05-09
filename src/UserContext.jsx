import React, { createContext, useContext, useState, useEffect } from 'react';
import { account, databases, db, Query } from './lib/appwrite';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // Safety check for missing project ID
      if (!import.meta.env.VITE_APPWRITE_PROJECT_ID) {
        console.error("Missing Appwrite Project ID in Environment Variables!");
        setLoading(false);
        return;
      }

      const session = await account.get();
      setUser(session);
      
      // Safety check for missing collection ID
      const profileCollection = db.collections.profiles;
      if (!profileCollection) {
        console.error("Missing Profile Collection ID!");
        setLoading(false);
        return;
      }

      const { documents } = await databases.listDocuments(
        db.id,
        profileCollection,
        [Query.equal("userId", session.$id)]
      );

      if (documents.length > 0) {
        setProfile(documents[0]);
      }
    } catch (err) {
      console.log('Session check failed or no active session');
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    
    // Initial online status
    updateOnlineStatus(true);

    // Heartbeat every 2 minutes
    const interval = setInterval(() => {
      updateOnlineStatus(true);
    }, 120000);

    return () => clearInterval(interval);
  }, [profile]);

  const updateOnlineStatus = async (isOnline) => {
    if (!profile) return;
    try {
      await databases.updateDocument(db.id, db.collections.profiles, profile.$id, {
        isOnline: isOnline,
        lastActive: new Date().toISOString()
      });
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const logout = async () => {
    try {
      await updateOnlineStatus(false);
      await account.deleteSession('current');
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const { documents } = await databases.listDocuments(
        db.id,
        db.collections.profiles,
        [Query.equal("userId", user.$id)]
      );
      if (documents.length > 0) setProfile(documents[0]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <UserContext.Provider value={{ user, profile, loading, logout, refreshProfile, checkSession }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
