import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Users as UsersIcon,
  TrendingUp,
  ArrowRight,
  Plus,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { databases, db, Query } from '../../lib/appwrite';
import { format, parseISO, differenceInDays } from 'date-fns';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

export default function SupplyDashboard() {
  const [stats, setStats] = useState({ delivered: 0, totalProjects: 0, pending: 0, overdue: 0, suppliers: 0 });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [chartData, setChartData] = useState({ status: [], suppliers: [] });
  const [complianceAlerts, setComplianceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [logPage, setLogPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const LOGS_PER_PAGE = 10;

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    project_name: '', 
    supplier_id: '', 
    delivery_deadline: '', 
    status: 'pending',
    actual_delivery_date: '' 
  });
  const [submitting, setSubmitting] = useState(false);
  const [suppliersList, setSuppliersList] = useState([]);

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 30 seconds if tab is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
        fetchLogs(); // Also refresh the paginated logs
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [logPage]);

  const fetchLogs = async () => {
    try {
      const logsRes = await databases.listDocuments(db.id, db.collections.logs, [
        Query.orderDesc('timestamp'), 
        Query.limit(LOGS_PER_PAGE),
        Query.offset((logPage - 1) * LOGS_PER_PAGE),
        Query.notEqual('userRole', 'admin')
      ]);
      setRecentTransactions(logsRes.documents);
      setTotalLogs(logsRes.total);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [suppliersRes, contractsRes] = await Promise.all([
        databases.listDocuments(db.id, db.collections.suppliers, [Query.limit(100)]),
        databases.listDocuments(db.id, db.collections.contracts, [Query.limit(100)])
      ]);

      await fetchLogs();

      const contracts = contractsRes.documents;
      const suppliers = suppliersRes.documents;
      setSuppliersList(suppliers);
      
      const completedCount = contracts.filter(c => c.status === 'completed').length;
      const arrivedCount = contracts.filter(c => c.status === 'delivered').length;
      const inTransitCount = contracts.filter(c => c.status === 'in-transit').length;
      const pendingCount = contracts.filter(c => c.status === 'pending').length;
      const overdueCount = contracts.filter(c => c.status === 'overdue').length;

      setStats({
        delivered: completedCount, // This is for Project Completion card
        totalProjects: contracts.length,
        pending: arrivedCount + inTransitCount + pendingCount,
        overdue: overdueCount,
        suppliers: suppliersRes.total
      });

      // Prepare Pie Chart Data
      setChartData({
        status: [
          { name: 'Completed', value: completedCount, color: '#059669' },
          { name: 'Arrived (Pending)', value: arrivedCount, color: '#f43f5e' },
          { name: 'In-Transit', value: inTransitCount, color: '#2563eb' },
          { name: 'Pending', value: pendingCount, color: '#f59e0b' },
          { name: 'Overdue', value: overdueCount, color: '#e11d48' }
        ],
        suppliers: suppliers.slice(0, 5).map(s => ({
          name: s.name.substring(0, 10),
          contracts: contracts.filter(c => c.supplier_id === s.$id).length
        }))
      });

      // Calculate Compliance Alerts
      const alerts = suppliers.map(s => {
        if (!s.mayors_permit_expiry) return null;
        const expiryDate = parseISO(s.mayors_permit_expiry);
        const daysToExpiry = differenceInDays(expiryDate, new Date());
        if (daysToExpiry < 30) {
          return { name: s.name, type: 'Mayor\'s Permit', days: daysToExpiry, color: daysToExpiry < 0 ? '#ef4444' : '#f59e0b' };
        }
        return null;
      }).filter(Boolean);
      setComplianceAlerts(alerts);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcurementSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await databases.createDocument(db.id, db.collections.contracts, 'unique()', formData);
      setShowModal(false);
      setFormData({ project_name: '', supplier_id: '', delivery_deadline: '', status: 'pending', actual_delivery_date: '' });
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statCards = [
    { label: 'Project Completion', value: `${stats.delivered}/${stats.totalProjects}`, icon: CheckCircle2, color: 'var(--success)', trend: 'Annual Overview' },
    { label: 'Pending Deliveries', value: stats.pending, icon: Clock, color: 'var(--warning)', trend: 'Active Monitoring' },
    { label: 'Overdue Deliveries', value: stats.overdue, icon: AlertTriangle, color: 'var(--danger)', trend: 'Urgent Attention' },
    { label: 'Registered Suppliers', value: stats.suppliers, icon: UsersIcon, color: 'var(--accent)', trend: 'Supply Chain' },
  ];

  return (
    <DashboardLayout role="supply_dept">
      <div className="dashboard-content fade-in">
        <div className="section-header">
          <div>
            <h2>Supply Analytics Hub</h2>
            <p>Real-time KPI monitoring and logistics performance tracking.</p>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} />
              <span>New Project</span>
            </button>
          </div>
        </div>

        <div className="stats-grid">
          {statCards.map((stat, i) => (
            <div key={i} className="stat-card card">
              <div className="stat-icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                <stat.icon size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">{stat.label}</span>
                <h3 className="stat-value">{stat.value}</h3>
                <div className="stat-footer">
                  <TrendingUp size={14} />
                  <span>{stat.trend}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <div className="card analytics-card">
            <div className="card-header">
              <h3>Delivery Status Distribution</h3>
            </div>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.status}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="card-header" style={{ marginTop: '2rem' }}>
              <h3>Top Supplier Load</h3>
            </div>
            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.suppliers}>
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="contracts" fill="var(--primary-light)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card transaction-card">
            <div className="card-header">
              <h3>Compliance Watchlist</h3>
            </div>
            <div className="compliance-list">
              {complianceAlerts.length > 0 ? (
                complianceAlerts.map((alert, i) => (
                  <div key={i} className="compliance-item">
                    <div className="alert-dot" style={{ background: alert.color }}></div>
                    <div className="alert-text">
                      <p className="supplier-name">{alert.name}</p>
                      <p className="permit-detail">{alert.type} - {alert.days < 0 ? 'EXPIRED' : 'Expiring Soon'}</p>
                    </div>
                    <span className="days-badge" style={{ color: alert.color }}>
                      {alert.days < 0 ? `${Math.abs(alert.days)}d late` : `${alert.days}d left`}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-compliance">
                  <CheckCircle2 size={32} color="var(--success)" />
                  <p>All active suppliers are compliant.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card transaction-card">
            <div className="card-header">
              <h3>Recent Departmental Logs</h3>
            </div>
            <div className="transaction-list">
              {recentTransactions.map((log) => (
                <div key={log.$id} className="transaction-item">
                  <div className="log-avatar">{log.userName?.charAt(0) || 'S'}</div>
                  <div className="log-content">
                    <p className="log-action"><strong>{log.userName}</strong> {log.activity}</p>
                    <span className="log-time">{format(new Date(log.timestamp), 'MMM dd • hh:mm a')}</span>
                  </div>
                </div>
              ))}
              
              {totalLogs > LOGS_PER_PAGE && (
                <div className="pagination-footer">
                  <button 
                    className="pagination-btn" 
                    disabled={logPage === 1}
                    onClick={() => setLogPage(p => p - 1)}
                  >
                    <ChevronLeft size={16} />
                    <span>Prev</span>
                  </button>
                  <span className="page-indicator">Page {logPage} of {Math.ceil(totalLogs / LOGS_PER_PAGE)}</span>
                  <button 
                    className="pagination-btn" 
                    disabled={logPage * LOGS_PER_PAGE >= totalLogs}
                    onClick={() => setLogPage(p => p + 1)}
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-content glass modern-form"
            >
              <div className="modal-header">
              <h3>New Project</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleProcurementSubmit} className="scrollable-form">
                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">1</div>
                    <h4>Project Description</h4>
                  </div>
                  <div className="input-group floating">
                    <input required placeholder=" " value={formData.project_name} onChange={e => setFormData({...formData, project_name: e.target.value})} />
                    <label>Project Title</label>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">2</div>
                    <h4>Logistics & Vendor</h4>
                  </div>
                  <div className="form-row">
                    <div className="input-group">
                      <label className="static-label">Assigned Supplier</label>
                      <select required value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}>
                        <option value="">-- Select Supplier --</option>
                        {suppliersList.map(s => <option key={s.$id} value={s.$id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="static-label">Target Completion</label>
                      <input type="date" required value={formData.delivery_deadline} onChange={e => setFormData({...formData, delivery_deadline: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Initiating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .modal-overlay { 
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); 
          backdrop-filter: blur(8px); display: flex; align-items: center; 
          justify-content: center; z-index: 1000; padding: 2rem;
        }
        .modal-content.modern-form { 
          width: 100%; max-width: 580px; 
          background: white; border-radius: 24px; 
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          overflow: hidden; display: flex; flex-direction: column;
        }
        .modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
        .close-btn { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        .scrollable-form { max-height: 80vh; overflow-y: auto; padding: 2rem; }
        .form-section { background: var(--bg); padding: 1.5rem; border-radius: 16px; margin-bottom: 1.5rem; border: 1px solid var(--border); }
        .section-title { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .step-num { width: 32px; height: 32px; background: var(--primary); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; }
        .section-title h4 { font-weight: 700; color: var(--primary); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
        .input-group.floating { position: relative; margin-bottom: 1.25rem; }
        .input-group.floating input { height: 56px; padding: 22px 15px 6px; width: 100%; border: 1px solid var(--border); border-radius: 12px; font-weight: 600; font-size: 0.95rem; }
        .input-group.floating label { position: absolute; left: 15px; top: 18px; transition: all 0.2s; pointer-events: none; color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }
        .input-group.floating input:focus + label,
        .input-group.floating input:not(:placeholder-shown) + label { top: 8px; font-size: 0.7rem; font-weight: 800; color: var(--primary-light); }
        
        .static-label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-group select { height: 48px; border-radius: 12px; border: 1px solid var(--border); padding: 0 1rem; font-weight: 600; background: white; width: 100%; }

        .modal-footer { padding: 1.5rem 2rem; background: var(--bg); border-top: 1px solid var(--border); display: flex; gap: 1rem; justify-content: flex-end; }
        .btn-ghost { padding: 0.75rem 1.5rem; font-weight: 700; color: var(--text-muted); border: none; background: transparent; cursor: pointer; }
        .btn-primary { padding: 0.75rem 2rem; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2); border: none; cursor: pointer; background: var(--primary); color: white; }

        .log-avatar { width: 36px; height: 36px; border-radius: 10px; background: var(--bg); display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--primary); }

        .compliance-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .compliance-item { display: flex; align-items: center; gap: 1rem; padding: 0.85rem; background: var(--bg); border-radius: 12px; border: 1px solid var(--border); }
        .alert-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .alert-text { flex: 1; }
        .supplier-name { font-weight: 700; color: var(--primary); font-size: 0.85rem; margin-bottom: 0.1rem; }
        .permit-detail { font-size: 0.75rem; color: var(--text-muted); }
        .days-badge { font-size: 0.7rem; font-weight: 800; background: white; padding: 0.25rem 0.5rem; border-radius: 6px; box-shadow: var(--shadow-sm); }
        .empty-compliance { padding: 2rem; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .empty-compliance p { font-size: 0.85rem; font-weight: 600; }

        .pagination-footer { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: 1rem 0.5rem 0.5rem; border-top: 1px solid var(--border);
          margin-top: 0.5rem; position: sticky; bottom: 0; background: white;
          z-index: 10;
        }
        .transaction-list { 
          max-height: 400px; overflow-y: auto; padding-right: 0.4rem;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .transaction-item { 
          display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem; 
          background: var(--bg); border-radius: 10px; margin-bottom: 0.5rem;
          border: 1px solid var(--border);
        }
        .log-action { font-size: 0.8rem; line-height: 1.4; color: var(--primary); }
        .log-time { font-size: 0.7rem; color: var(--text-muted); }

        .pagination-btn { 
          display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
          border-radius: 10px; border: 1px solid var(--border); background: white;
          font-weight: 700; font-size: 0.8rem; color: var(--primary); cursor: pointer;
          transition: all 0.2s;
        }
        .pagination-btn:hover:not(:disabled) { background: var(--bg); border-color: var(--primary-light); }
        .pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-indicator { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); }
      `}</style>
    </DashboardLayout>
  );
}
