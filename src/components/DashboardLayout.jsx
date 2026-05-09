import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ShieldCheck, 
  LogOut, 
  Menu,
  ClipboardList,
  Settings,
  Megaphone,
  UserCircle,
  FolderOpen
} from 'lucide-react';
import { account, databases, db, Query } from '../lib/appwrite';
import NotificationBell from './NotificationBell';
import { motion, AnimatePresence } from 'framer-motion';
import { logActivity } from '../lib/logger';

export default function DashboardLayout({ children, role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [profile, setProfile] = useState(null);
  const [announcement, setAnnouncement] = useState('Welcome to BGH Tracking System - Modern Clinical Management Portal');

  useEffect(() => {
    fetchProfile();
    const saved = localStorage.getItem('system_announcement');
    if (saved) setAnnouncement(saved);

    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };

    const handleUpdate = () => {
      const updated = localStorage.getItem('system_announcement');
      if (updated) setAnnouncement(updated);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('announcement_updated', handleUpdate);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('announcement_updated', handleUpdate);
    };
  }, []);

  const fetchProfile = async () => {
    try {
      const user = await account.get();
      if (user) {
        const { documents } = await databases.listDocuments(
          db.id,
          db.collections.profiles,
          [Query.equal("userId", user.$id)]
        );
        if (documents.length > 0) {
          setProfile(documents[0]);
        }
      }
    } catch (err) {
      console.log('Error fetching profile');
    }
  };

  const handleLogout = async () => {
    try {
      await logActivity('Logout', `User logged out successfully`);
      await account.deleteSession('current');
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  const menuItems = {
    admin: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
      { 
        name: 'Project', 
        icon: FileText, 
        path: '/supply-dept/suppliers',
        sub: [
          { name: 'Suppliers', path: '/supply-dept/suppliers' },
          { name: 'Contracts', path: '/supply-dept/contracts' },
        ]
      },
      { 
        name: 'Settings', 
        icon: Settings, 
        path: '/admin/settings',
        sub: [
          { name: 'Account Management', path: '/admin/accounts' },
          { name: 'Audit Logs', path: '/admin/logs' },
          { name: 'System Settings', path: '/admin/settings' },
        ]
      },
      { name: 'Account', icon: UserCircle, path: '/admin/profile' },
    ],
    supply_dept: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/supply-dept' },
      { 
        name: 'Project', 
        icon: FileText, 
        path: '/supply-dept/suppliers',
        sub: [
          { name: 'Suppliers', path: '/supply-dept/suppliers' },
          { name: 'Contracts', path: '/supply-dept/contracts' },
        ]
      },
      { name: 'Account', icon: UserCircle, path: '/supply-dept/profile' },
    ],
    supplier: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/supplier' },
      { name: 'My Projects', icon: FolderOpen, path: '/supplier/contracts' },
      { name: 'Account', icon: UserCircle, path: '/supplier/profile' },
    ]
  };

  const currentRole = role || profile?.role || 'supplier';
  const currentMenu = menuItems[currentRole] || [];

  return (
    <div className="dashboard-root">
      {isMobile && isSidebarOpen && (
        <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className={`sidebar ${isSidebarOpen ? 'open' : 'collapsed'} ${isMobile ? 'mobile' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            {isSidebarOpen ? (
              <>
                <img src="/assets/logo.jpg" alt="BGH Logo" className="system-logo" />
                <span className="logo-text">BGH Tracking System</span>
              </>
            ) : (
              <img src="/favicon.png" alt="BGH Seal" className="system-logo seal-only" />
            )}
          </div>
        </div>

        <div className="sidebar-nav">
          {currentMenu.map((item) => (
            <div key={item.path} className="nav-group">
              <button 
                className={`nav-item ${location.pathname === item.path || (item.sub && item.sub.some(s => location.pathname === s.path)) ? 'active' : ''}`}
                onClick={() => {
                  if (item.sub) return;
                  navigate(item.path);
                  if (isMobile) setIsSidebarOpen(false);
                }}
              >
                <item.icon size={22} />
                {(isSidebarOpen || isMobile) && <span>{item.name}</span>}
              </button>
              {(isSidebarOpen || isMobile) && item.sub && (
                <div className="nav-sub">
                  {item.sub.map((sub) => (
                    <button 
                      key={sub.path} 
                      className={`nav-sub-item ${location.pathname === sub.path ? 'active' : ''}`} 
                      onClick={() => {
                        navigate(sub.path);
                        if (isMobile) setIsSidebarOpen(false);
                      }}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            {(isSidebarOpen || isMobile) && <span>Logout</span>}
          </button>
        </div>
      </div>

      <div className="main-content">
        <header className="content-header">
          <div className="header-left">
            <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={20} />
            </button>
            {!isMobile && (
              <div className="announcement-ticker">
                <Megaphone size={18} className="ticker-icon" />
                <div className="ticker-wrap">
                  <div className="ticker-text">{announcement}</div>
                </div>
              </div>
            )}
          </div>

          <div className="header-right">
            <NotificationBell />
            <div className="user-avatar-group">
              <div className="user-avatar">
                {profile?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="user-meta desktop-only">
                <span className="user-name">{profile?.fullName || 'User'}</span>
                <span className="user-role">{currentRole.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="scroll-area">
          {children}
        </main>
      </div>

      <style jsx>{`
        .dashboard-root { display: flex; height: 100vh; background: #f8fafc; overflow: hidden; position: relative; }
        
        .sidebar { background: #1e3a8a; color: white; display: flex; flex-direction: column; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 4px 0 20px rgba(0,0,0,0.1); z-index: 1000; }
        .sidebar.open { width: 280px; }
        .sidebar.collapsed { width: 80px; }

        .mobile-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); z-index: 999; }

        @media (max-width: 1024px) {
          .sidebar { position: fixed; height: 100vh; left: -280px; width: 280px !important; }
          .sidebar.open { left: 0; }
          .sidebar.collapsed { left: -280px; }
          .desktop-only { display: none !important; }
        }

        .sidebar-header { height: 100px; padding: 0 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-container { display: flex; align-items: center; gap: 0.75rem; width: 100%; transition: all 0.3s; }
        .system-logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; flex-shrink: 0; transition: all 0.3s; }
        .system-logo.seal-only { width: 44px; height: 44px; margin: 0 auto; }
        .logo-text { font-weight: 800; font-size: 1rem; line-height: 1.2; color: white; white-space: normal; flex: 1; }

        .sidebar-nav { flex: 1; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; }
        .nav-item { width: 100%; display: flex; align-items: center; gap: 1rem; padding: 0.85rem; color: rgba(255, 255, 255, 0.7); border-radius: 12px; background: transparent; border: none; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .nav-item:hover { color: white; background: rgba(255, 255, 255, 0.1); }
        .nav-item.active { color: white; background: var(--accent); box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3); }
        .nav-item span { font-weight: 500; font-size: 0.95rem; }

        .sidebar.collapsed:not(.mobile) .nav-item { justify-content: center; padding: 0.85rem 0; }
        .sidebar.collapsed:not(.mobile) .nav-sub { display: none !important; }

        .nav-sub { padding-left: 2.5rem; display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.25rem; }
        .nav-sub-item { padding: 0.5rem; color: rgba(255,255,255,0.6); font-size: 0.85rem; background: none; border: none; cursor: pointer; text-align: left; }
        .nav-sub-item.active { color: white; font-weight: bold; }

        .sidebar-footer { padding: 1.25rem; border-top: 1px solid rgba(255,255,255,0.05); }
        .logout-btn { width: 100%; display: flex; align-items: center; gap: 1rem; padding: 0.85rem; color: rgba(255,255,255,0.7); border-radius: 12px; transition: all 0.2s; background: transparent; border: none; cursor: pointer; }
        .logout-btn:hover { color: #f87171; background: rgba(248, 113, 113, 0.15); }

        .main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .content-header { height: 80px; display: flex; justify-content: space-between; align-items: center; padding: 0 2rem; border-bottom: 1px solid var(--border); background: white; }
        
        @media (max-width: 640px) {
          .content-header { padding: 0 1rem; }
          .header-right { gap: 1rem; }
          .user-avatar-group { padding-left: 1rem; }
          .scroll-area { padding: 1rem; }
        }

        .header-left { display: flex; align-items: center; gap: 1rem; flex: 1; }
        .menu-toggle { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; transition: all 0.2s; cursor: pointer; color: var(--primary); }
        .menu-toggle:hover { background: white; border-color: var(--primary-light); color: var(--primary-light); }

        .announcement-ticker { flex: 1; height: 44px; background: #f1f5f9; border-radius: 22px; display: flex; align-items: center; padding: 0 1.25rem; gap: 1rem; overflow: hidden; border: 1px solid var(--border); margin-right: 2rem; }
        .ticker-icon { color: var(--primary-light); flex-shrink: 0; }
        .ticker-wrap { flex: 1; overflow: hidden; position: relative; }
        .ticker-text { white-space: nowrap; display: inline-block; padding-left: 100%; animation: marquee 25s linear infinite; font-weight: 800; color: var(--primary); font-size: 1.15rem; letter-spacing: 0.02em; }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }

        .header-right { display: flex; align-items: center; gap: 2rem; }
        .user-avatar-group { display: flex; align-items: center; gap: 0.75rem; padding-left: 2rem; border-left: 1px solid var(--border); }
        .user-avatar { width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .user-meta { display: flex; flex-direction: column; }
        .user-name { font-weight: 700; font-size: 0.9rem; color: var(--primary); line-height: 1.2; }
        .user-role { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }

        .scroll-area { flex: 1; overflow-y: auto; padding: 2rem; -webkit-overflow-scrolling: touch; }
      `}</style>
    </div>
  );
}
