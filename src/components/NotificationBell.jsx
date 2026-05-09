import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { databases, db, Query, account } from '../lib/appwrite';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    initNotifications();
  }, []);

  const initNotifications = async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
      fetchNotifications(currentUser.$id);
      
      // Subscribe to real-time updates (Optional enhancement)
    } catch (err) {
      console.error("Notif Error:", err);
    }
  };

  const fetchNotifications = async (userId) => {
    try {
      const { documents } = await databases.listDocuments(
        db.id, db.collections.notifications,
        [Query.equal('recipient_id', userId), Query.orderDesc('$createdAt'), Query.limit(10)]
      );
      setNotifications(documents);
      setUnreadCount(documents.filter(n => !n.is_read).length);
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await databases.updateDocument(db.id, db.collections.notifications, id, { is_read: true });
      setNotifications(prev => prev.map(n => n.$id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="notification-wrapper">
      <button className="bell-btn" onClick={() => setShowDropdown(!showDropdown)}>
        <Bell size={20} />
        {unreadCount > 0 && <span className="unread-dot">{unreadCount}</span>}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <>
            <div className="dropdown-overlay" onClick={() => setShowDropdown(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="notif-dropdown card"
            >
              <div className="notif-header">
                <h4>Notifications</h4>
                {unreadCount > 0 && <span className="count-badge">{unreadCount} New</span>}
              </div>

              <div className="notif-list">
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <div 
                      key={notif.$id} 
                      className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                      onClick={() => markAsRead(notif.$id)}
                    >
                      <div className={`notif-icon ${notif.type || 'info'}`}>
                        {notif.type === 'success' ? <CheckCircle2 size={16} /> : 
                         notif.type === 'warning' ? <AlertCircle size={16} /> : <Info size={16} />}
                      </div>
                      <div className="notif-content">
                        <h5>{notif.title}</h5>
                        <p>{notif.message}</p>
                        <span className="notif-time">{new Date(notif.$createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {!notif.is_read && <div className="unread-indicator" />}
                    </div>
                  ))
                ) : (
                  <div className="empty-notif">
                    <Bell size={32} />
                    <p>No notifications yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx>{`
        .notification-wrapper { position: relative; }
        .bell-btn { 
          background: white; border: 1px solid var(--border); border-radius: 12px; width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center; color: var(--text-muted); cursor: pointer;
          transition: all 0.2s; position: relative;
        }
        .bell-btn:hover { background: var(--bg); border-color: var(--primary-light); color: var(--primary); }
        .unread-dot {
          position: absolute; top: -5px; right: -5px; background: var(--danger); color: white;
          font-size: 0.6rem; font-weight: 800; width: 18px; height: 18px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; border: 2px solid white;
        }

        .dropdown-overlay { position: fixed; inset: 0; z-index: 999; }
        .notif-dropdown {
          position: absolute; top: 50px; right: 0; width: 320px; z-index: 1000;
          padding: 0; overflow: hidden; border: 1px solid var(--border);
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        @media (max-width: 640px) {
          .notif-dropdown { position: fixed; top: 80px; left: 1rem; right: 1rem; width: auto; max-width: none; }
        }

        .notif-header { padding: 1.25rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .notif-header h4 { font-weight: 800; color: var(--primary); font-size: 0.95rem; }
        .count-badge { background: var(--primary); color: white; padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700; }

        .notif-list { max-height: 400px; overflow-y: auto; }
        
        @media (max-width: 640px) {
          .notif-list { max-height: 60vh; }
        }

        .notif-item { 
          padding: 1rem; display: flex; gap: 1rem; border-bottom: 1px solid var(--border);
          cursor: pointer; transition: all 0.2s; position: relative;
        }
        .notif-item:hover { background: var(--bg); }
        .notif-item.unread { background: rgba(14, 165, 233, 0.03); }
        .unread-indicator { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; background: var(--primary); border-radius: 50%; }

        .notif-icon { 
          width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .notif-icon.info { background: #eff6ff; color: #1e40af; }
        .notif-icon.success { background: #ecfdf5; color: #065f46; }
        .notif-icon.warning { background: #fff7ed; color: #c2410c; }

        .notif-content h5 { font-size: 0.85rem; font-weight: 700; color: var(--primary); margin-bottom: 0.2rem; }
        .notif-content p { font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 0.4rem; }
        .notif-time { font-size: 0.65rem; color: var(--text-muted); font-weight: 600; }

        .empty-notif { padding: 3rem; text-align: center; color: var(--text-muted); }
        .empty-notif p { margin-top: 1rem; font-weight: 600; font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
