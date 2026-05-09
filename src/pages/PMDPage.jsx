import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Filter,
  Download,
  Calendar,
  Zap,
  Target,
  ArrowUpRight
} from 'lucide-react';
import { account, databases, db, Query } from '../lib/appwrite';
import { format, subMonths, isAfter, parseISO, differenceInDays } from 'date-fns';

export default function PMDPage({ role }) {
  const [data, setData] = useState({
    contracts: [],
    suppliers: [],
    stats: {
      onTimeRate: 0,
      avgDeliveryDays: 0,
      totalValue: 0,
      activeProjects: 0
    },
    charts: {
      deliveryTrend: [],
      supplierShare: [],
      performanceStatus: []
    }
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6months');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const user = await account.get();
      
      // 1. Resolve User Identity
      let targetSupplierId = null;
      if (role === 'supplier') {
        const { documents: profiles } = await databases.listDocuments(
          db.id, db.collections.profiles, [Query.equal('userId', user.$id)]
        );
        if (profiles.length > 0) {
          const { documents: sDocs } = await databases.listDocuments(
            db.id, db.collections.suppliers, [Query.equal('email', profiles[0].email)]
          );
          if (sDocs.length > 0) targetSupplierId = sDocs[0].$id;
        }
      }

      // 2. Fetch Data with Filter
      const queries = targetSupplierId ? [Query.equal('supplier_id', targetSupplierId)] : [];
      const [contractsRes, suppliersRes] = await Promise.all([
        databases.listDocuments(db.id, db.collections.contracts, [...queries, Query.limit(100)]),
        databases.listDocuments(db.id, db.collections.suppliers, [Query.limit(100)])
      ]);

      const contracts = contractsRes.documents;
      const suppliers = suppliersRes.documents;

      // 1. Process Stats
      const completed = contracts.filter(c => c.status === 'completed');
      const onTime = completed.filter(c => {
        if (!c.actual_delivery_date || !c.delivery_deadline) return true;
        return isAfter(parseISO(c.delivery_deadline), parseISO(c.actual_delivery_date));
      }).length;

      const onTimeRate = completed.length > 0 ? Math.round((onTime / completed.length) * 100) : 0;
      
      const totalDays = completed.reduce((acc, c) => {
        if (!c.actual_delivery_date) return acc;
        return acc + Math.max(0, differenceInDays(parseISO(c.actual_delivery_date), parseISO(c.$createdAt)));
      }, 0);
      const avgDays = completed.length > 0 ? Math.round(totalDays / completed.length) : 0;

      // 2. Performance Status Data
      const statusData = [
        { name: 'Completed', value: completed.length, color: '#22c55e' },
        { name: 'In Transit', value: contracts.filter(c => c.status === 'in-transit').length, color: '#3b82f6' },
        { name: 'Pending', value: contracts.filter(c => c.status === 'pending').length, color: '#f59e0b' },
        { name: 'Overdue', value: contracts.filter(c => c.status === 'overdue').length, color: '#ef4444' },
      ];

      // 3. Delivery Trend (Last 6 Months)
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months.push({
          month: format(d, 'MMM'),
          total: 0,
          delivered: 0
        });
      }

      contracts.forEach(c => {
        const cDate = parseISO(c.$createdAt);
        const mIndex = months.findIndex(m => m.month === format(cDate, 'MMM'));
        if (mIndex > -1) {
          months[mIndex].total++;
          if (c.status === 'completed' || c.status === 'delivered') months[mIndex].delivered++;
        }
      });

      // 4. Supplier Share
      const supplierCounts = {};
      contracts.forEach(c => {
        const sName = suppliers.find(s => s.$id === c.supplier_id)?.name || 'Unknown';
        supplierCounts[sName] = (supplierCounts[sName] || 0) + 1;
      });
      const shareData = Object.keys(supplierCounts).map(name => ({
        name,
        value: supplierCounts[name]
      })).sort((a,b) => b.value - a.value).slice(0, 5);

      setData({
        contracts,
        suppliers,
        stats: {
          onTimeRate,
          avgDeliveryDays: avgDays,
          totalProjects: contracts.length,
          activeProjects: contracts.filter(c => c.status !== 'completed').length
        },
        charts: {
          deliveryTrend: months,
          supplierShare: shareData,
          performanceStatus: statusData
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role={role}>
      <div className="pmd-container fade-in">
        <header className="pmd-header">
          <div className="title-section">
            <div className="pmd-badge">
              <Zap size={14} />
              <span>Real-time KPI Analysis</span>
            </div>
            <h1>Performance Monitoring Dashboard</h1>
            <p>Strategic data insights and logistics efficiency metrics.</p>
          </div>
          
          <div className="pmd-actions">
            <div className="time-selector">
              <Filter size={16} />
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                <option value="30days">Last 30 Days</option>
                <option value="6months">Last 6 Months</option>
                <option value="year">Full Year</option>
              </select>
            </div>
            <button className="export-btn" onClick={() => window.print()}>
              <Download size={18} />
              <span>Export PDF</span>
            </button>
          </div>
        </header>

        <section className="kpi-grid">
          <KPICard 
            title="On-Time Delivery" 
            value={`${data.stats.onTimeRate}%`} 
            trend="+5.2%" 
            icon={CheckCircle2} 
            color="#22c55e"
            desc="Projects hit on deadline"
          />
          <KPICard 
            title="Avg. Cycle Time" 
            value={`${data.stats.avgDeliveryDays} Days`} 
            trend="-2 Days" 
            icon={Clock} 
            color="#3b82f6"
            desc="From issuance to arrival"
          />
          <KPICard 
            title="Active Workload" 
            value={data.stats.activeProjects} 
            trend="Stable" 
            icon={Target} 
            color="#f59e0b"
            desc="Currently in pipeline"
          />
          <KPICard 
            title="Total Projects" 
            value={data.stats.totalProjects} 
            trend="+12" 
            icon={TrendingUp} 
            color="#8b5cf6"
            desc="Lifetime record count"
          />
        </section>

        <div className="analysis-grid">
          <div className="chart-card main-trend">
            <div className="chart-header">
              <h3>Monthly Delivery Performance</h3>
              <p>Volume vs Success Rate</p>
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.charts.deliveryTrend}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} />
                  <Area type="monotone" dataKey="delivered" stroke="#22c55e" fill="transparent" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="side-charts">
            <div className="chart-card">
              <h3>Project Status Distribution</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.charts.performanceStatus}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.charts.performanceStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend-custom">
                {data.charts.performanceStatus.map(s => (
                  <div key={s.name} className="legend-item">
                    <span className="dot" style={{ background: s.color }}></span>
                    <span className="label">{s.name}</span>
                    <span className="val">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .pmd-container { padding: 2rem; max-width: 1600px; margin: 0 auto; }
        .pmd-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem; }
        
        .pmd-badge { 
          display: inline-flex; align-items: center; gap: 0.5rem; 
          background: #f0f9ff; color: #0369a1; padding: 0.4rem 0.8rem; 
          border-radius: 20px; font-size: 0.7rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;
        }
        .pmd-header h1 { font-size: 2.2rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
        .pmd-header p { color: #64748b; font-size: 1.1rem; margin-top: 0.5rem; }

        .pmd-actions { display: flex; gap: 1rem; align-items: center; }
        .time-selector { 
          display: flex; align-items: center; gap: 0.75rem; 
          background: white; border: 1px solid #e2e8f0; 
          padding: 0.5rem 1rem; border-radius: 12px;
        }
        .time-selector select { border: none; font-weight: 700; color: #0f172a; outline: none; }
        
        .export-btn { 
          display: flex; align-items: center; gap: 0.5rem; 
          background: #0f172a; color: white; padding: 0.75rem 1.25rem; 
          border-radius: 12px; font-weight: 700; transition: all 0.2s;
        }
        .export-btn:hover { background: #1e293b; transform: translateY(-1px); }

        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
        
        @media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .kpi-grid { grid-template-columns: 1fr; } .pmd-header { flex-direction: column; align-items: flex-start; gap: 1.5rem; } }

        .analysis-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; }
        @media (max-width: 1024px) { .analysis-grid { grid-template-columns: 1fr; } }

        .chart-card { background: white; border-radius: 24px; padding: 2rem; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .chart-card h3 { font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-bottom: 1.5rem; }
        
        .legend-custom { margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; }
        .legend-item .dot { width: 8px; height: 8px; border-radius: 50%; }
        .legend-item .label { font-size: 0.8rem; color: #64748b; flex: 1; font-weight: 600; }
        .legend-item .val { font-weight: 800; color: #0f172a; font-size: 0.9rem; }
      `}</style>
    </DashboardLayout>
  );
}

function KPICard({ title, value, trend, icon: Icon, color, desc }) {
  return (
    <div className="kpi-card card">
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: `${color}15`, color }}>
          <Icon size={24} />
        </div>
        <div className="kpi-trend">
          <ArrowUpRight size={14} />
          <span>{trend}</span>
        </div>
      </div>
      <div className="kpi-info">
        <h3 className="kpi-value">{value}</h3>
        <span className="kpi-title">{title}</span>
        <p className="kpi-desc">{desc}</p>
      </div>
      <style jsx>{`
        .kpi-card { border: 1px solid #f1f5f9; padding: 1.5rem; transition: all 0.3s ease; position: relative; overflow: hidden; }
        .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-color: #3b82f640; }
        
        .kpi-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .kpi-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        .kpi-trend { 
          display: flex; align-items: center; gap: 0.25rem; background: #f0fdf4; color: #16a34a; 
          padding: 0.25rem 0.5rem; border-radius: 8px; font-size: 0.75rem; font-weight: 800;
        }

        .kpi-value { font-size: 1.75rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
        .kpi-title { display: block; font-size: 0.9rem; font-weight: 700; color: #64748b; margin-top: 0.25rem; }
        .kpi-desc { font-size: 0.75rem; color: #94a3b8; margin-top: 1rem; border-top: 1px solid #f8fafc; padding-top: 0.75rem; }
      `}</style>
    </div>
  );
}
