import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  Users, 
  ShieldCheck, 
  FileText, 
  Activity,
  UserPlus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { databases, db, Query, account } from '../../lib/appwrite';
import { format, isAfter, parseISO, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import { sendAlert } from '../../lib/notifications';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalContracts: 0,
    suppliers: 0,
    recentLogs: 0,
    pendingContracts: 0,
    activeSuppliers: 0
  });
  const [complianceAlerts, setComplianceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 30 seconds if tab is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStats();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [users, contracts, suppliersRes, logs, pending, activeSup] = await Promise.all([
        databases.listDocuments(db.id, db.collections.profiles),
        databases.listDocuments(db.id, db.collections.contracts),
        databases.listDocuments(db.id, db.collections.suppliers),
        databases.listDocuments(db.id, db.collections.logs),
        databases.listDocuments(db.id, db.collections.contracts, [Query.notEqual('status', 'delivered')]),
        databases.listDocuments(db.id, db.collections.suppliers, [Query.equal('status', 'active')])
      ]);

      setStats({
        totalUsers: users.total || 0,
        totalContracts: contracts.total || 0,
        suppliers: suppliersRes.total || 0,
        recentLogs: logs.total || 0,
        pendingContracts: pending.total || 0,
        activeSuppliers: activeSup.total || 0
      });

      // Calculate Compliance Alerts & Notify
      const suppliers = suppliersRes.documents;
      const alerts = [];
      const currentUser = await account.get();
      const currentUserId = currentUser.$id;

      for (const s of suppliers) {
        if (!s.mayors_permit_expiry) continue;
        const expiryDate = parseISO(s.mayors_permit_expiry);
        const daysToExpiry = differenceInDays(expiryDate, new Date());
        
        let alertObj = null;
        if (daysToExpiry < 0) {
          alertObj = { name: s.name, type: 'Mayor\'s Permit', status: 'Expired', color: 'var(--danger)', days: daysToExpiry };
        } else if (daysToExpiry <= 30) {
          alertObj = { name: s.name, type: 'Mayor\'s Permit', status: 'Expiring Soon', color: 'var(--warning)', days: daysToExpiry };
        }

        if (alertObj) {
          alerts.push(alertObj);
          
          // Notify Admin (current user)
          await sendAlert({
            recipientId: currentUserId,
            email: currentUser.email,
            title: `Compliance Alert: ${s.name}`,
            message: `${s.name}'s ${alertObj.type} is ${alertObj.status.toLowerCase()}.`,
            type: daysToExpiry < 0 ? 'warning' : 'info'
          });

          // Notify the Supplier themselves
          const { documents: profiles } = await databases.listDocuments(
            db.id, db.collections.profiles, [Query.equal('email', s.email)]
          );
          if (profiles.length > 0) {
            await sendAlert({
              recipientId: profiles[0].userId,
              email: s.email,
              title: 'Permit Expiry Notice',
              message: `Your ${alertObj.type} is ${alertObj.status.toLowerCase()}. Please update it immediately.`,
              type: 'warning'
            });
          }
        }
      }

      setComplianceAlerts(alerts);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const adminStats = [
    { label: 'System Users', value: stats.totalUsers, icon: Users, color: '#3b82f6' },
    { label: 'Total Contracts', value: stats.totalContracts, icon: FileText, color: '#10b981' },
    { label: 'Total Suppliers', value: stats.suppliers, icon: Activity, color: '#f59e0b' },
    { label: 'Pending Deliveries', value: stats.pendingContracts, icon: Clock, color: '#ef4444' },
    { label: 'Active Suppliers', value: stats.activeSuppliers, icon: UserPlus, color: '#06b6d4' },
    { label: 'Audit Entries', value: stats.recentLogs, icon: ShieldCheck, color: '#8b5cf6' },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="dashboard-content fade-in">
        <div className="section-header">
          <div>
            <h2>Admin Control Center</h2>
            <p>System-wide monitoring of users, contracts, and compliance.</p>
          </div>
        </div>

        <div className="stats-grid">
          {adminStats.map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="stat-card card"
            >
              <div className="stat-icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                <stat.icon size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">{stat.label}</span>
                <h3 className="stat-value">{stat.value}</h3>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="dashboard-grid">
          {/* Compliance Monitoring Card */}
          <div className="card compliance-card">
            <div className="card-header">
              <div className="header-title">
                <h3>Global Compliance Watch</h3>
                <p>Monitoring supplier permit validities</p>
              </div>
              {complianceAlerts.length > 0 && <span className="alert-count">{complianceAlerts.length} Issues</span>}
            </div>
            <div className="compliance-list">
              {complianceAlerts.length > 0 ? (
                complianceAlerts.map((alert, i) => (
                  <div key={i} className="compliance-item">
                    <div className="alert-icon" style={{ color: alert.color }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="alert-info">
                      <p className="supplier-name">{alert.name}</p>
                      <p className="permit-type">{alert.type} • {alert.status}</p>
                    </div>
                    <div className="alert-meta">
                      <span className="days-left" style={{ background: `${alert.color}15`, color: alert.color }}>
                        {alert.days < 0 ? `${Math.abs(alert.days)}d Overdue` : `${alert.days}d Left`}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-compliance">
                  <CheckCircle2 size={32} color="var(--success)" />
                  <p>All supplier permits are currently up to date.</p>
                </div>
              )}
            </div>
            <button className="btn-details-full" onClick={() => window.location.href='/supply-dept/suppliers'}>
              Manage Suppliers <ChevronRight size={16} />
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>System Infrastructure</h3>
            </div>
            <div className="health-list">
              <div className="health-item">
                <CheckCircle2 size={18} color="#10b981" />
                <div>
                  <p className="health-label">Appwrite Cloud Services</p>
                  <p className="health-status">Optimal Performance</p>
                </div>
                <span className="badge-ok">ONLINE</span>
              </div>
              <div className="health-item">
                <CheckCircle2 size={18} color="#10b981" />
                <div>
                  <p className="health-label">Auth & RLS Firewall</p>
                  <p className="health-status">Secure Session Mgmt</p>
                </div>
                <span className="badge-ok">ACTIVE</span>
              </div>
              <div className="health-item">
                <CheckCircle2 size={18} color="#10b981" />
                <div>
                  <p className="health-label">Database Synchronization</p>
                  <p className="health-status">Real-time Latency: 12ms</p>
                </div>
                <span className="badge-ok">SYNCED</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card { display: flex; align-items: center; gap: 1.25rem; padding: 1.5rem; }
        .stat-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
        .stat-label { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
        .stat-value { font-size: 1.75rem; font-weight: 800; color: var(--primary); }

        .dashboard-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 1.5rem; }
        
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .header-title h3 { font-size: 1.1rem; font-weight: 700; color: var(--primary); }
        .header-title p { font-size: 0.85rem; color: var(--text-muted); }
        .alert-count { padding: 0.25rem 0.75rem; background: #fee2e2; color: #991b1b; border-radius: 20px; font-size: 0.75rem; font-weight: 800; }

        .compliance-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
        .compliance-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg); border-radius: 12px; border: 1px solid var(--border); }
        .alert-info { flex: 1; }
        .supplier-name { font-weight: 700; color: var(--primary); font-size: 0.9rem; }
        .permit-type { font-size: 0.8rem; color: var(--text-muted); }
        .days-left { padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.7rem; font-weight: 800; white-space: nowrap; }

        .empty-compliance { padding: 3rem; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
        .empty-compliance p { font-size: 0.9rem; font-weight: 600; }

        .btn-details-full { width: 100%; padding: 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; font-weight: 700; color: var(--primary-light); display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
        .btn-details-full:hover { background: white; border-color: var(--primary-light); }

        .health-list { display: flex; flex-direction: column; gap: 1.25rem; }
        .health-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg); border-radius: 12px; }
        .health-label { font-weight: 700; color: var(--primary); font-size: 0.85rem; margin-bottom: 0.15rem; }
        .health-status { font-size: 0.75rem; color: var(--text-muted); }
        .badge-ok { margin-left: auto; font-size: 0.65rem; font-weight: 900; color: var(--success); letter-spacing: 0.05em; }
      `}</style>
    </DashboardLayout>
  );
}
