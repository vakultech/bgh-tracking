import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  Settings, 
  Megaphone, 
  Save, 
  ShieldCheck, 
  Database,
  BellRing
} from 'lucide-react';
import { databases, db } from '../../lib/appwrite';
import { motion } from 'framer-motion';
import { logActivity } from '../../lib/logger';

export default function SettingsPage() {
  const [announcement, setAnnouncement] = useState('Welcome to BGH Tracking System - Management Portal');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch announcement from a local storage or database if available
    const saved = localStorage.getItem('system_announcement');
    if (saved) setAnnouncement(saved);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate save or use Appwrite if collection exists
      localStorage.setItem('system_announcement', announcement);
      window.dispatchEvent(new Event('announcement_updated'));
      
      // LOG ACTIVITY
      await logActivity('Update System Announcement', `New text: ${announcement.substring(0, 50)}...`);
      
      alert("System settings updated successfully!");
    } catch (err) {
      alert("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="fade-in">
        <div className="section-header">
          <div>
            <h2>System Settings</h2>
            <p>Institutional maintenance and global system controls.</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={18} />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </motion.button>
        </div>

        <div className="settings-grid">
          <div className="card settings-card">
            <div className="card-header-icon">
              <Megaphone size={24} className="text-primary" />
              <div>
                <h3>Global Announcement</h3>
                <p>Set the scrolling text displayed in the system header.</p>
              </div>
            </div>
            
            <div className="input-group" style={{ marginTop: '1.5rem' }}>
              <label className="static-label">Announcement Text</label>
              <textarea 
                placeholder="Enter announcement here..." 
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                style={{ minHeight: '100px', width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                This text will scroll continuously at the top of every dashboard page.
              </p>
            </div>
          </div>

          <div className="card settings-card">
            <div className="card-header-icon">
              <ShieldCheck size={24} className="text-success" />
              <div>
                <h3>System Status</h3>
                <p>Institutional database and authentication health.</p>
              </div>
            </div>
            
            <div className="status-indicator-list" style={{ marginTop: '1.5rem' }}>
              <div className="status-pill active">
                <Database size={16} />
                <span>Database Connectivity: Stable</span>
              </div>
              <div className="status-pill active">
                <BellRing size={16} />
                <span>Notification Engine: Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem; }
        .settings-card { padding: 2rem; }
        .card-header-icon { display: flex; gap: 1.25rem; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
        .card-header-icon h3 { font-size: 1.1rem; font-weight: 700; color: var(--primary); }
        .card-header-icon p { font-size: 0.85rem; color: var(--text-muted); }

        .status-pill { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 12px; background: var(--bg); font-size: 0.85rem; font-weight: 600; margin-bottom: 0.75rem; }
        .status-pill.active { border-left: 4px solid var(--success); color: var(--success); }
      `}</style>
    </DashboardLayout>
  );
}
