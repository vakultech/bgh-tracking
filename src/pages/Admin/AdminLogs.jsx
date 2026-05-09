import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  Filter,
  Download,
  User,
  Activity
} from 'lucide-react';
import { databases, db, Query } from '../../lib/appwrite';
import { format } from 'date-fns';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LOGS_PER_PAGE = 10;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { documents, total: totalLogs } = await databases.listDocuments(
        db.id,
        db.collections.logs,
        [
          Query.orderDesc('timestamp'),
          Query.limit(LOGS_PER_PAGE),
          Query.offset((page - 1) * LOGS_PER_PAGE)
        ]
      );
      setLogs(documents || []);
      setTotal(totalLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / LOGS_PER_PAGE);

  return (
    <DashboardLayout role="admin">
      <div className="fade-in">
        <div className="section-header">
          <div>
            <h2>System Audit Logs</h2>
            <p>Chronological record of all system activities (Appwrite).</p>
          </div>
          <button className="btn-secondary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Download size={18} />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="card filter-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="search-wrapper" style={{ flex: 1 }}>
            <Search className="search-icon" size={20} />
            <input placeholder="Search logs by activity or user..." />
          </div>
          <div className="filter-group" style={{ display: 'flex', gap: '1rem', marginLeft: '2rem' }}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">All Events</option>
              <option value="login">Logins</option>
              <option value="update">Updates</option>
              <option value="delete">Deletions</option>
            </select>
          </div>
        </div>

        <div className="logs-timeline card">
          {loading ? (
            <div className="text-center py-8">Loading logs...</div>
          ) : logs.length > 0 ? (
            <>
              <div className="timeline-items">
                {logs.map((log) => (
                  <div key={log.$id} className="timeline-item">
                    <div className="timeline-marker">
                      <div className="marker-circle"></div>
                      <div className="marker-line"></div>
                    </div>
                    <div className="timeline-content">
                      <div className="log-main">
                        <span className="log-user">{log.userName || 'System'}</span>
                        <span className="log-action">{log.activity}</span>
                      </div>
                      {log.details && (
                        <pre className="log-details">
                          {log.details}
                        </pre>
                      )}
                      <div className="log-meta">
                        <Clock size={12} />
                        {format(new Date(log.timestamp), 'MMM dd, yyyy • hh:mm:ss a')}
                        <span className="separator">•</span>
                        <span className={`log-role-tag ${log.userRole}`}>
                          {log.userRole}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="pagination-bar">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="page-btn">Previous</button>
                  <span className="page-info">Page {page} of {totalPages}</span>
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="page-btn">Next</button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">No audit logs recorded yet.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .pagination-bar { display: flex; align-items: center; justify-content: center; gap: 2rem; padding: 2rem 0; margin-top: 2rem; border-top: 1px solid var(--border); }
        .page-btn { padding: 0.6rem 1.5rem; background: white; border: 1px solid var(--border); border-radius: 10px; font-size: 0.85rem; font-weight: 700; color: var(--primary); cursor: pointer; transition: all 0.2s; }
        .page-btn:hover:not(:disabled) { border-color: var(--primary-light); transform: translateY(-2px); box-shadow: var(--shadow-sm); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { font-size: 0.9rem; font-weight: 800; color: var(--text-muted); }

        .logs-timeline { padding: 2rem; }
        .timeline-items { display: flex; flex-direction: column; }
        .timeline-item { display: flex; gap: 1.5rem; }
        .timeline-marker { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; position: relative; }
        .marker-circle { width: 12px; height: 12px; border-radius: 50%; background: var(--accent); border: 3px solid var(--accent-glow); z-index: 1; margin-top: 0.25rem; }
        .marker-line { width: 2px; flex: 1; background: var(--border); position: absolute; top: 12px; bottom: -20px; }
        .timeline-item:last-child .marker-line { display: none; }
        
        .timeline-content { padding-bottom: 2.5rem; flex: 1; }
        .log-main { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 1rem; }
        .log-user { font-weight: 700; color: var(--primary); }
        .log-action { color: var(--text-muted); }
        .log-details { background: white; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.8rem; color: #475569; margin: 0.75rem 0; border: 1px solid var(--border); overflow-x: auto; }
        .log-meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); font-weight: 600; }
        .log-role-tag { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
        .log-role-tag.ADMIN { background: #fee2e2; color: #ef4444; }
        .log-role-tag.SUPPLIER { background: #dcfce7; color: #16a34a; }
        .log-role-tag.SUPPLY_DEPT { background: #dbeafe; color: #2563eb; }
        .separator { color: var(--border); }
      `}</style>
    </DashboardLayout>
  );
}
