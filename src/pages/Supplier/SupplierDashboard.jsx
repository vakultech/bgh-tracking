import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Plane, 
  Ship, 
  TrendingUp, 
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Truck,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { account, databases, db, Query } from '../../lib/appwrite';
import { format, isAfter, parseISO, differenceInDays } from 'date-fns';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  AreaChart, Area
} from 'recharts';
import { motion } from 'framer-motion';

export default function SupplierDashboard() {
  const [stats, setStats] = useState({ total: 0, inTransit: 0, completed: 0, overdue: 0, onTimeRate: 0, compliance: 'Good' });
  const [complianceInfo, setComplianceInfo] = useState(null);
  const [chartData, setChartData] = useState({ status: [], logistics: [], performance: [] });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [logPage, setLogPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const LOGS_PER_PAGE = 10;

  const fetchLogs = async () => {
    try {
      const user = await account.get();
      const logsRes = await databases.listDocuments(db.id, db.collections.logs, [
        Query.equal('userId', user.$id),
        Query.orderDesc('timestamp'),
        Query.limit(LOGS_PER_PAGE),
        Query.offset((logPage - 1) * LOGS_PER_PAGE)
      ]);
      setRecentLogs(logsRes.documents);
      setTotalLogs(logsRes.total);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSupplierData = async () => {
    try {
      setLoading(true);
      const user = await account.get();
      
      // 1. Get user profile first (most reliable)
      const { documents: profiles } = await databases.listDocuments(
        db.id, db.collections.profiles, [Query.equal('userId', user.$id)]
      );
      
      if (profiles.length === 0) return;
      const userProfile = profiles[0];

      // 2. Find matching supplier document by profile email
      const { documents: supplierDocs } = await databases.listDocuments(
        db.id, db.collections.suppliers, [Query.equal('email', userProfile.email)]
      );
      
      if (supplierDocs.length === 0) return;
      const supplier = supplierDocs[0];

      // 3. Fetch contracts and logs
      const [contractsRes] = await Promise.all([
        databases.listDocuments(db.id, db.collections.contracts, [
          Query.equal('supplier_id', supplier.$id), 
          Query.limit(100)
        ])
      ]);
      
      await fetchLogs();
      
      const contracts = contractsRes.documents;

      // 3. Calculate KPIs
      const completed = contracts.filter(c => c.status === 'delivered');
      const inTransit = contracts.filter(c => c.status === 'in-transit');
      const overdue = contracts.filter(c => {
        if (c.status === 'delivered') return false;
        return isAfter(new Date(), parseISO(c.delivery_deadline));
      });

      const onTimeDeliveries = completed.filter(c => {
        if (!c.actual_delivery_date) return true;
        return !isAfter(parseISO(c.actual_delivery_date), parseISO(c.delivery_deadline));
      }).length;

      const onTimeRate = completed.length > 0 ? Math.round((onTimeDeliveries / completed.length) * 100) : 100;

      // Compliance Calculation
      let compliance = 'Good';
      let cInfo = null;
      if (supplier.mayors_permit_expiry) {
        const days = differenceInDays(parseISO(supplier.mayors_permit_expiry), new Date());
        if (days < 0) compliance = 'Expired';
        else if (days < 30) compliance = 'Warning';
        cInfo = { days, expiry: supplier.mayors_permit_expiry };
      }
      setComplianceInfo(cInfo);

      setStats({
        total: contracts.length,
        inTransit: inTransit.length,
        completed: completed.length,
        overdue: overdue.length,
        onTimeRate: onTimeRate,
        compliance
      });

      // 4. Prepare Charts
      setChartData({
        status: [
          { name: 'On Schedule', value: contracts.length - overdue.length, color: '#10b981' },
          { name: 'Overdue', value: overdue.length, color: '#e11d48' }
        ],
        logistics: [
          { name: 'Sea', value: contracts.filter(c => c.delivery_mode === 'sea').length, color: '#3b82f6' },
          { name: 'Air', value: contracts.filter(c => c.delivery_mode === 'air').length, color: '#06b6d4' },
          { name: 'Land', value: contracts.filter(c => c.delivery_mode === 'land').length, color: '#8b5cf6' }
        ],
        performance: [
          { month: 'Jan', volume: 4 },
          { month: 'Feb', volume: 6 },
          { month: 'Mar', volume: 8 },
          { month: 'Apr', volume: stats.total || contracts.length }
        ]
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchSupplierData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSupplierData();
        fetchLogs();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [logPage]);

  const statCards = [
    { label: 'Total Contracts', value: stats.total, icon: FileText, color: 'var(--primary)', detail: 'Lifecycle Projects' },
    { label: 'Active Shipments', value: stats.inTransit, icon: Truck, color: 'var(--accent)', detail: 'Items in Transit' },
    { 
      label: 'Compliance Health', 
      value: stats.compliance, 
      icon: ShieldCheck, 
      color: stats.compliance === 'Good' ? 'var(--success)' : stats.compliance === 'Warning' ? 'var(--warning)' : 'var(--danger)',
      detail: complianceInfo ? `${complianceInfo.days < 0 ? 'Renew Immediately' : `${complianceInfo.days} days remaining`}` : 'Verified'
    },
    { label: 'Critical Tasks', value: stats.overdue, icon: AlertTriangle, color: 'var(--danger)', detail: 'Overdue Delivery' },
  ];

  return (
    <DashboardLayout role="supplier">
      <div className="dashboard-content fade-in">
        <div className="section-header">
          <div>
            <h2>Supplier Logistics Hub</h2>
            <p>Monitor your fulfillment performance and project distribution.</p>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={() => window.location.href='/supplier/contracts'}>
              <Package size={18} />
              <span>Update Shipments</span>
            </button>
          </div>
        </div>

        <div className="stats-grid">
          {statCards.map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="stat-card card"
            >
              <div className="stat-icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                <stat.icon size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">{stat.label}</span>
                <h3 className="stat-value">{stat.value}</h3>
                <p className="stat-detail">{stat.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="dashboard-grid">
          {/* Main Performance Chart */}
          <div className="card analytics-card full-width">
            <div className="card-header">
              <h3>Delivery Volume Trend</h3>
              <p>Fulfillment history over the last 4 months</p>
            </div>
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.performance}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="volume" stroke="var(--primary)" fillOpacity={1} fill="url(#colorVolume)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="card analytics-card">
            <div className="card-header">
              <h3>Fulfillment Status</h3>
            </div>
            <div style={{ height: '250px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.status}
                    innerRadius={60}
                    outerRadius={80}
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
          </div>

          <div className="card analytics-card">
            <div className="card-header">
              <h3>Shipping Mode Distribution</h3>
            </div>
            <div style={{ height: '250px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.logistics}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.logistics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card transaction-card full-width">
            <div className="card-header">
              <h3>Recent Fulfillment Activity</h3>
            </div>
            <div className="transaction-list">
              {recentLogs.map((log) => (
                <div key={log.$id} className="transaction-item">
                  <div className="tx-icon">
                    <Clock size={16} />
                  </div>
                  <div className="tx-info">
                    <p className="tx-action">{log.activity}</p>
                    <p className="tx-details">{log.details}</p>
                  </div>
                  <div className="tx-meta">
                    <p className="tx-date">{format(new Date(log.timestamp), 'MMM dd, hh:mm a')}</p>
                  </div>
                  <ChevronRight size={16} className="tx-arrow" />
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

      <style jsx>{`
        .dashboard-content { padding-bottom: 2rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card { display: flex; align-items: center; gap: 1.25rem; padding: 1.5rem; }
        .stat-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-label { font-size: 0.85rem; color: var(--text-muted); font-weight: 500; }
        .stat-value { font-size: 1.75rem; font-weight: 800; color: var(--primary); margin: 0.25rem 0; }
        .stat-detail { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; }

        .dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
        .full-width { grid-column: 1 / -1; }
        
        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr; }
        }

        .analytics-card { min-height: 350px; }
        .card-header { margin-bottom: 1.5rem; }
        .card-header h3 { font-size: 1.1rem; font-weight: 700; color: var(--primary); }
        .card-header p { font-size: 0.85rem; color: var(--text-muted); }

        .transaction-list { 
          max-height: 400px; overflow-y: auto; padding-right: 0.4rem;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
          display: flex; flex-direction: column; gap: 0.5rem; 
        }
        .transaction-item { 
          display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; 
          background: var(--bg); border-radius: 12px; transition: all 0.2s;
          border: 1px solid var(--border);
        }

        @media (max-width: 640px) {
          .transaction-item { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
          .tx-meta { width: 100%; display: flex; justify-content: space-between; align-items: center; }
          .tx-arrow { display: none; }
        }

        .transaction-item:hover { transform: translateX(3px); background: white; box-shadow: var(--shadow-sm); }
        .tx-icon { width: 32px; height: 32px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0; }
        .tx-info { flex: 1; }
        .tx-action { font-size: 0.85rem; font-weight: 700; color: var(--primary); }
        .tx-details { font-size: 0.75rem; color: var(--text-muted); }
        .tx-meta { text-align: right; }
        .tx-date { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); }
        .tx-arrow { color: var(--border); }

        .pagination-footer { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: 1rem 0.5rem 0.5rem; border-top: 1px solid var(--border);
          margin-top: 0.5rem; position: sticky; bottom: 0; background: white;
          z-index: 10;
        }

        @media (max-width: 640px) {
          .pagination-footer { flex-direction: column; gap: 1rem; }
          .page-indicator { order: -1; }
          .pagination-btn { width: 100%; justify-content: center; }
        }

        .pagination-btn { 
          display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
          border-radius: 10px; border: 1px solid var(--border); background: white;
          font-weight: 700; font-size: 0.8rem; color: var(--primary); cursor: pointer;
          transition: all 0.2s;
        }
        .pagination-btn:hover:not(:disabled) { background: var(--bg); border-color: var(--primary-light); box-shadow: var(--shadow-sm); }
        .pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-indicator { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); }
      `}</style>
    </DashboardLayout>
  );
}
