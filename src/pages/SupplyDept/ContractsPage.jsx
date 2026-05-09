import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  Search,
  Plus, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Paperclip, 
  X, 
  ChevronRight,
  UploadCloud,
  Ship,
  Plane,
  Truck
} from 'lucide-react';
import { databases, db, ID, Query, storage } from '../../lib/appwrite';
import { format, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { logActivity } from '../../lib/logger';
import { sendAlert, notifyStakeholders } from '../../lib/notifications';

const ContractCard = ({ contract, suppliers, storage, safeFormat, onDetails, onConfirm, submitting }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      key={contract.$id} 
      className="contract-card card"
    >
      <div className="contract-header">
        <span className={`status-badge ${contract.status}`}>
          {contract.status === 'delivered' ? <CheckCircle2 size={14} /> : 
           contract.status === 'completed' ? <CheckCircle2 size={14} /> :
           contract.status === 'overdue' ? <AlertCircle size={14} /> : <Clock size={14} />}
          {contract.status === 'delivered' ? 'DELIVERED (PENDING)' : contract.status}
        </span>
        <div className="contract-date">
          <Calendar size={14} />
          <span>{safeFormat(contract.$createdAt)}</span>
        </div>
      </div>

      <div className="contract-body">
        <h3>{contract.project_name}</h3>
        <div className="supplier-link">
          <div className="avatar-xs">
            {suppliers.find(s => s.$id === contract.supplier_id)?.name.charAt(0) || 'S'}
          </div>
          <span>{suppliers.find(s => s.$id === contract.supplier_id)?.name || 'Unknown Supplier'}</span>
        </div>

        <div className="delivery-info">
          <div className="info-item">
            <label>Deadline</label>
            <p>{safeFormat(contract.delivery_deadline)}</p>
          </div>
          {contract.actual_delivery_date && (
            <div className="info-item highlight">
              <label>Actual Arrival</label>
              <p className="text-success">{safeFormat(contract.actual_delivery_date)}</p>
            </div>
          )}
        </div>

        {contract.shipping_line && (
          <div className="shipping-info-mini">
            <div className="shipping-row">
              <span className="shipping-label">{contract.delivery_mode === 'sea' ? <Ship size={12} /> : <Plane size={12} />} Logistics:</span>
              <span>{contract.shipping_line}</span>
            </div>
          </div>
        )}
      </div>

      <div className="contract-footer">
        <button 
          className="view-details-btn"
          onClick={() => onDetails(contract)}
        >
          Details <ChevronRight size={14} />
        </button>
        {contract.status === 'delivered' && (
          <button 
            className="confirm-btn-mini"
            onClick={() => onConfirm(contract.$id)}
            disabled={submitting}
          >
            Confirm
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pages, setPages] = useState({ new: 1, ongoing: 1, completed: 1 });
  const ITEMS_PER_PAGE = 5;
  
  const [formData, setFormData] = useState({
    project_name: '',
    supplier_id: '',
    delivery_deadline: '',
    status: 'pending',
    po_file_id: '',
    ntp_file_id: '',
    noa_file_id: '',
    delivery_mode: 'sea',
    shipping_line: '',
    vessel_name: '',
    actual_delivery_date: ''
  });


  const [fetchError, setFetchError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      // Safety check for collection IDs
      if (!db.id) throw new Error("Database ID (VITE_APPWRITE_DATABASE_ID) is not set.");
      if (!db.collections.contracts) throw new Error("Collection ID for 'contracts' is not set.");
      if (!db.collections.suppliers) throw new Error("Collection ID for 'suppliers' is not set.");

      console.log("Attempting fetch from DB:", db.id);
      
      const [contractsRes, suppliersRes] = await Promise.all([
        databases.listDocuments(db.id, db.collections.contracts, [Query.orderDesc('$createdAt')]),
        databases.listDocuments(db.id, db.collections.suppliers, [Query.equal('status', 'active')])
      ]);
      
      setContracts(contractsRes.documents || []);
      setSuppliers(suppliersRes.documents || []);
    } catch (err) {
      console.error("Fetch error:", err);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter(c => 
    c.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.$id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    suppliers.find(s => s.$id === c.supplier_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPaginatedData = (data, page) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  };

  const Pagination = ({ total, current, section }) => {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;
    return (
      <div className="pagination-controls">
        <button disabled={current === 1} onClick={() => setPages(prev => ({ ...prev, [section]: current - 1 }))} className="page-btn">Prev</button>
        <span className="page-info">Page {current} of {totalPages}</span>
        <button disabled={current === totalPages} onClick={() => setPages(prev => ({ ...prev, [section]: current + 1 }))} className="page-btn">Next</button>
      </div>
    );
  };

  const safeFormat = (dateStr, fmt = 'MMM dd, yyyy') => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isValid(d) ? format(d, fmt) : 'Invalid Date';
  };

  const handleFileUpload = async (file, field) => {
    if (!file) return;
    try {
      setUploading(true);
      const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_PERMITS || 'permits';
      const response = await storage.createFile(bucketId, ID.unique(), file);
      setFormData(prev => ({ ...prev, [field]: response.$id }));
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelivery = async (contractId) => {
    if (!window.confirm("Confirm that this project has been fully delivered and inspected?")) return;
    
    try {
      setSubmitting(true);
      const contract = contracts.find(c => c.$id === contractId);
      await databases.updateDocument(db.id, db.collections.contracts, contractId, {
        status: 'completed'
      });
      
      await notifyStakeholders(
        { ...contract, status: 'completed' },
        'Delivery Confirmed',
        `The delivery for "${contract.project_name}" has been officially confirmed by BGH. Project is now COMPLETED.`,
        'success'
      );

      setShowViewModal(false);
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await databases.createDocument(db.id, db.collections.contracts, ID.unique(), formData);
      
      // Notify ALL Stakeholders
      await notifyStakeholders(
        res,
        'New Contract Issued',
        `A new project "${formData.project_name}" has been officially issued.`,
        'success'
      );

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_name: '',
      supplier_id: '',
      delivery_deadline: '',
      status: 'pending',
      po_file_id: '',
      ntp_file_id: '',
      noa_file_id: '',
      delivery_mode: 'sea',
      shipping_line: '',
      vessel_name: '',
      actual_delivery_date: ''
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DashboardLayout>
      <div className="fade-in">
        <div className="section-header">
          <div>
            <h2>Contract Hub</h2>
            <p>Issue and track project lifecycle and logistics.</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary" 
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} />
            <span>Issue New Contract</span>
          </motion.button>
        </div>

        <div className="card filter-card search-container">
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input 
              placeholder="Search projects by name, ID, or supplier..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="contracts-sections">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Syncing contracts...</p>
            </div>
          ) : fetchError ? (
            <div className="error-state card">
              <AlertCircle size={48} color="var(--danger)" />
              <h3>Database Connection Issue</h3>
              <p>{fetchError}</p>
              <button className="btn-primary" onClick={fetchData} style={{ marginTop: '1rem' }}>Retry Sync</button>
            </div>
          ) : filteredContracts.length > 0 ? (
            <>
              {/* SECTION 1: NEW PROJECT */}
              <div className="project-section">
                <div className="section-title-bar">
                  <div className="title-icon new"><FileText size={18} /></div>
                  <h3>New Issued Contracts</h3>
                  <span className="count-badge">{filteredContracts.filter(c => c.status === 'pending').length}</span>
                </div>
                <div className="contracts-grid">
                  {getPaginatedData(filteredContracts.filter(c => c.status === 'pending'), pages.new).map(contract => (
                    <ContractCard 
                      key={contract.$id} 
                      contract={contract} 
                      suppliers={suppliers} 
                      storage={storage} 
                      safeFormat={safeFormat} 
                      onDetails={(c) => { setSelectedContract(c); setShowViewModal(true); }}
                      onConfirm={handleConfirmDelivery}
                      submitting={submitting}
                    />
                  ))}
                  {filteredContracts.filter(c => c.status === 'pending').length === 0 && <div className="empty-mini">No newly issued contracts matching search.</div>}
                </div>
                <Pagination 
                  total={filteredContracts.filter(c => c.status === 'pending').length} 
                  current={pages.new} 
                  section="new" 
                />
              </div>

              {/* SECTION 2: ACTIVE LOGISTICS */}
              <div className="project-section">
                <div className="section-title-bar">
                  <div className="title-icon ongoing"><Truck size={18} /></div>
                  <h3>Active Shipments & Logistics</h3>
                  <span className="count-badge">{filteredContracts.filter(c => ['processed', 'in-transit', 'delivered'].includes(c.status)).length}</span>
                </div>
                <div className="contracts-grid">
                  {getPaginatedData(filteredContracts.filter(c => ['processed', 'in-transit', 'delivered'].includes(c.status)), pages.ongoing).map(contract => (
                    <ContractCard 
                      key={contract.$id} 
                      contract={contract} 
                      suppliers={suppliers} 
                      storage={storage} 
                      safeFormat={safeFormat} 
                      onDetails={(c) => { setSelectedContract(c); setShowViewModal(true); }}
                      onConfirm={handleConfirmDelivery}
                      submitting={submitting}
                    />
                  ))}
                  {filteredContracts.filter(c => ['processed', 'in-transit', 'delivered'].includes(c.status)).length === 0 && <div className="empty-mini">No active shipments matching search.</div>}
                </div>
                <Pagination 
                  total={filteredContracts.filter(c => ['processed', 'in-transit', 'delivered'].includes(c.status)).length} 
                  current={pages.ongoing} 
                  section="ongoing" 
                />
              </div>

              {/* SECTION 3: COMPLETED */}
              <div className="project-section">
                <div className="section-title-bar">
                  <div className="title-icon completed"><CheckCircle2 size={18} /></div>
                  <h3>Finalized Deliveries</h3>
                  <span className="count-badge">{filteredContracts.filter(c => c.status === 'completed').length}</span>
                </div>
                <div className="contracts-grid">
                  {getPaginatedData(filteredContracts.filter(c => c.status === 'completed'), pages.completed).map(contract => (
                    <ContractCard 
                      key={contract.$id} 
                      contract={contract} 
                      suppliers={suppliers} 
                      storage={storage} 
                      safeFormat={safeFormat} 
                      onDetails={(c) => { setSelectedContract(c); setShowViewModal(true); }}
                      onConfirm={handleConfirmDelivery}
                      submitting={submitting}
                    />
                  ))}
                  {filteredContracts.filter(c => c.status === 'completed').length === 0 && <div className="empty-mini">No completed projects matching search.</div>}
                </div>
                <Pagination 
                  total={filteredContracts.filter(c => c.status === 'completed').length} 
                  current={pages.completed} 
                  section="completed" 
                />
              </div>
            </>
          ) : (
            <div className="empty-state card">
              <FileText size={48} />
              <h3>No Projects Found</h3>
              <p>No projects match your current search or assignment.</p>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {showViewModal && selectedContract && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-content glass modern-form"
            >
              <div className="modal-header">
                <h3>Project Details: {selectedContract.project_name}</h3>
                <button className="close-btn" onClick={() => setShowViewModal(false)}><X size={20} /></button>
              </div>

              <div className="scrollable-form">
                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">1</div>
                    <h4>Supplier Information</h4>
                  </div>
                  <div className="info-grid">
                    <div className="info-block">
                      <label>Assigned Supplier</label>
                      <p>{suppliers.find(s => s.$id === selectedContract.supplier_id)?.name || 'N/A'}</p>
                    </div>
                    <div className="info-block">
                      <label>Current Project Status</label>
                      <p className={`status-text ${selectedContract.status}`}>{selectedContract.status.toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                <div className="form-section highlight-section">
                  <div className="section-title">
                    <div className="step-num">2</div>
                    <h4>Logistics & Tracking (Supplier Data)</h4>
                  </div>
                  <div className="form-row">
                    <div className="input-group">
                      <label className="static-label">Shipping Mode</label>
                      <input disabled value={selectedContract.delivery_mode?.toUpperCase() || 'NOT SET'} />
                    </div>
                    <div className="input-group">
                      <label className="static-label">Shipping Line / Courier</label>
                      <input disabled value={selectedContract.shipping_line || 'TBA'} />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginTop: '1rem' }}>
                    <div className="input-group">
                      <label className="static-label">Tentative Departure</label>
                      <input disabled value={safeFormat(selectedContract.tentative_departure, 'MMM dd, yyyy - hh:mm a')} />
                    </div>
                    <div className="input-group">
                      <label className="static-label">Tentative Arrival at BGH</label>
                      <input disabled value={safeFormat(selectedContract.tentative_arrival, 'MMM dd, yyyy - hh:mm a')} />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginTop: '1rem' }}>
                    <div className="input-group">
                      <label className="static-label">Vessel / Plate No.</label>
                      <input disabled value={selectedContract.vessel_name || 'TBA'} />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">3</div>
                    <h4>Proof of Shipment</h4>
                  </div>
                  {selectedContract.waybill_file_id ? (
                    <div className="file-preview-card">
                      <Paperclip size={24} />
                      <div>
                        <p>Waybill / Delivery Receipt</p>
                        <a 
                          href={storage.getFileView(import.meta.env.VITE_APPWRITE_BUCKET_PERMITS || '69feb6050031cba304e7', selectedContract.waybill_file_id)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn-download"
                        >
                          View Document
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-file-state">
                      <AlertCircle size={20} />
                      <p>No waybill has been uploaded by the supplier yet.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                {selectedContract.status === 'delivered' && (
                  <button 
                    className="btn-primary" 
                    style={{ background: 'var(--success)' }}
                    onClick={() => handleConfirmDelivery(selectedContract.$id)}
                    disabled={submitting}
                  >
                    {submitting ? 'Confirming...' : 'Confirm Delivery'}
                  </button>
                )}
                <button className="btn-ghost" onClick={() => setShowViewModal(false)}>Close View</button>
              </div>
            </motion.div>
          </div>
        )}
        {showModal && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-content glass modern-form"
            >
              <div className="modal-header">
                <h3>Issue New Contract</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="scrollable-form">
                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">1</div>
                    <h4>Project Details</h4>
                  </div>
                  <div className="input-group floating">
                    <input required placeholder=" " value={formData.project_name} onChange={e => setFormData({...formData, project_name: e.target.value})} />
                    <label>Project Title</label>
                  </div>
                  
                  <div className="form-row">
                    <div className="input-group">
                      <label className="static-label">Assign Winning Supplier</label>
                      <select required value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}>
                        <option value="">-- Choose Supplier --</option>
                        {suppliers.map(s => <option key={s.$id} value={s.$id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">2</div>
                    <h4>Deadlines & Delivery</h4>
                  </div>
                  <div className="form-row">
                    <div className="input-group">
                      <label className="static-label">Contract Deadline</label>
                      <input type="date" required value={formData.delivery_deadline} onChange={e => setFormData({...formData, delivery_deadline: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label className="static-label">Initial Project Status</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="pending">Pending Issuance</option>
                        <option value="in-transit">Ready for Shipping</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Discard</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Finalizing...' : 'Issue Contract'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .contracts-sections { display: flex; flex-direction: column; gap: 4rem; margin-top: 3rem; }
        
        @media (max-width: 768px) {
          .contracts-sections { gap: 2rem; margin-top: 1.5rem; }
        }

        .project-section { display: flex; flex-direction: column; gap: 1.5rem; }
        .section-title-bar { display: flex; align-items: center; gap: 1rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border); }
        .title-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .title-icon.new { background: var(--primary); }
        .title-icon.ongoing { background: var(--warning); }
        .title-icon.completed { background: var(--success); }
        .section-title-bar h3 { font-size: 1.1rem; font-weight: 800; color: var(--primary); margin: 0; }
        .count-badge { background: var(--bg); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); border: 1px solid var(--border); }
        .empty-mini { grid-column: 1 / -1; padding: 2rem; background: var(--bg); border-radius: 12px; border: 1px dashed var(--border); text-align: center; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; }

        .confirm-btn-mini { background: var(--success); color: white; border: none; padding: 0.4rem 1rem; border-radius: 8px; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .confirm-btn-mini:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(22, 163, 74, 0.2); }
        .confirm-btn-mini:disabled { opacity: 0.5; cursor: not-allowed; }

        .search-container { padding: 1rem; margin-top: 1rem; border: 1px solid var(--border); background: white; border-radius: 16px; }
        .search-wrapper { display: flex; align-items: center; gap: 1rem; background: var(--bg); padding: 0.75rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); transition: all 0.2s; }
        .search-wrapper:focus-within { border-color: var(--primary-light); box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1); background: white; }
        .search-wrapper input { border: none; background: transparent; padding: 0.25rem; font-size: 0.95rem; width: 100%; color: var(--primary); font-weight: 600; }
        .search-wrapper input:focus { outline: none; }
        .search-icon { color: var(--text-muted); }

        .pagination-controls { display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-top: 2rem; padding: 1rem; background: var(--bg); border-radius: 12px; border: 1px solid var(--border); }
        
        @media (max-width: 640px) {
          .pagination-controls { flex-direction: column; gap: 1rem; padding: 1.25rem; }
          .page-info { order: -1; }
          .page-btn { width: 100%; }
        }

        .page-btn { padding: 0.5rem 1.25rem; background: white; border: 1px solid var(--border); border-radius: 8px; font-size: 0.8rem; font-weight: 700; color: var(--primary); cursor: pointer; transition: all 0.2s; }
        .page-btn:hover:not(:disabled) { border-color: var(--primary-light); color: var(--primary-light); transform: translateY(-1px); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { font-size: 0.85rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em; }

        .section-header { margin-bottom: 2rem; }
        .contracts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem; }
        
        @media (max-width: 768px) {
          .contracts-grid { grid-template-columns: 1fr; gap: 1rem; }
        }

        .contract-card { border: 1px solid rgba(0,0,0,0.05); transition: all 0.3s ease; height: 100%; display: flex; flex-direction: column; }
        .contract-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--primary-light); }
        
        .contract-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .status-badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .status-badge.pending { background: #fff7ed; color: #c2410c; }
        .status-badge.delivered { background: #fff1f2; color: #9f1239; }
        .status-badge.completed { background: #f0fdf4; color: #166534; }
        .status-badge.in-transit { background: #eff6ff; color: #1e40af; }
        
        .contract-body { flex: 1; }
        .contract-body h3 { font-size: 1.25rem; font-weight: 700; color: var(--primary); margin-bottom: 0.5rem; line-height: 1.3; }
        .supplier-link { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-muted); }
        .avatar-xs { width: 28px; height: 28px; background: var(--primary-light); color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        
        .delivery-info { display: flex; gap: 1rem; background: var(--bg); padding: 1rem; border-radius: 12px; margin-bottom: 1rem; }
        
        @media (max-width: 480px) {
          .delivery-info { flex-direction: column; gap: 0.75rem; }
        }

        .info-item { flex: 1; }
        .info-item label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; }
        .info-item p { font-weight: 600; font-size: 0.9rem; }
        .info-item.highlight { border-left: 2px solid var(--success); padding-left: 0.75rem; }
        
        @media (max-width: 480px) {
          .info-item.highlight { border-left: none; border-top: 2px solid var(--success); padding-left: 0; padding-top: 0.5rem; }
        }

        .shipping-mini-track { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--accent); font-weight: 600; }
        
        .contract-footer { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .attach-pill { display: flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.5rem; background: white; border: 1px solid var(--border); border-radius: 6px; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); }
        .view-details-btn { background: transparent; color: var(--primary-light); font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem; }

        .empty-state { grid-column: 1 / -1; padding: 5rem; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        
        @media (max-width: 640px) {
          .empty-state { padding: 3rem 1rem; }
        }

        /* Modern Modal Layout */
        .modal-overlay { 
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); 
          backdrop-filter: blur(8px); display: flex; align-items: center; 
          justify-content: center; z-index: 1000; padding: 2rem;
        }

        @media (max-width: 640px) {
          .modal-overlay { padding: 0; }
        }

        .modal-content.modern-form { 
          width: 100%; max-width: 650px; 
          background: white; border-radius: 24px; 
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          overflow: hidden; display: flex; flex-direction: column;
        }

        @media (max-width: 640px) {
          .modal-content.modern-form { height: 100vh; max-height: 100vh; border-radius: 0; }
        }

        .modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
        .close-btn { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .close-btn:hover { background: white; color: var(--danger); border-color: var(--danger); }

        .scrollable-form { max-height: 80vh; overflow-y: auto; padding: 2rem; }

        @media (max-width: 640px) {
          .scrollable-form { max-height: calc(100vh - 140px); padding: 1.25rem; }
        }

        .form-section { background: var(--bg); padding: 1.5rem; border-radius: 16px; margin-bottom: 1.5rem; border: 1px solid var(--border); }
        .section-title { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .step-num { width: 32px; height: 32px; background: var(--primary); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; }
        .section-title h4 { font-weight: 700; color: var(--primary); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }

        @media (max-width: 640px) {
          .form-row { grid-template-columns: 1fr; gap: 0; }
        }

        .input-group.floating { position: relative; margin-bottom: 1.25rem; }
        .input-group.floating input { height: 56px; padding: 22px 15px 6px; width: 100%; border: 1px solid var(--border); border-radius: 12px; font-weight: 600; font-size: 0.95rem; }
        .input-group.floating label { position: absolute; left: 15px; top: 18px; transition: all 0.2s; pointer-events: none; color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }
        .input-group.floating input:focus + label,
        .input-group.floating input:not(:placeholder-shown) + label { top: 8px; font-size: 0.7rem; font-weight: 800; color: var(--primary-light); }
        
        .static-label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-group select { height: 48px; border-radius: 12px; border: 1px solid var(--border); padding: 0 1rem; font-weight: 600; background: white; width: 100%; }
        
        .upload-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .file-input-wrapper label { height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed var(--border); border-radius: 12px; cursor: pointer; transition: all 0.2s; font-size: 0.7rem; font-weight: 700; background: white; }
        .file-input-wrapper label.uploaded { border-color: var(--success); background: #f0fdf4; color: var(--success); }

        .modal-footer { padding: 1.5rem 2rem; background: var(--bg); border-top: 1px solid var(--border); display: flex; gap: 1rem; justify-content: flex-end; }
        
        @media (max-width: 640px) {
          .modal-footer { padding: 1rem 1.25rem; flex-direction: column-reverse; }
          .modal-footer button { width: 100%; height: 48px; }
        }

        .btn-ghost { padding: 0.75rem 1.5rem; font-weight: 700; color: var(--text-muted); }
        .btn-primary { padding: 0.75rem 2rem; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2); }
        .shipping-info-mini { margin-top: 1rem; padding: 0.85rem; background: var(--bg); border-radius: 12px; font-size: 0.75rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.65rem; border: 1px solid var(--border); }
        .shipping-row { display: flex; justify-content: space-between; align-items: center; }
        .shipping-label { font-weight: 700; color: var(--text-muted); text-transform: uppercase; font-size: 0.65rem; display: flex; align-items: center; gap: 0.4rem; }
        .view-link-small { color: var(--primary-light); font-weight: 700; text-decoration: underline; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; margin-top: 0.25rem; }
        .view-link-small:hover { color: var(--primary); }
        .highlight-section { border-left: 4px solid var(--primary); background: rgba(14, 165, 233, 0.03); }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        
        @media (max-width: 480px) {
          .info-grid { grid-template-columns: 1fr; }
        }

        .info-block label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 0.25rem; }
        .info-block p { font-weight: 700; color: var(--primary); font-size: 1rem; }
        .status-text.pending { color: #c2410c; }
        .status-text.delivered { color: #065f46; }
        .status-text.in-transit { color: #1e40af; }

        .file-preview-card { 
          display: flex; align-items: center; gap: 1rem; padding: 1.25rem; 
          background: white; border: 1px solid var(--border); border-radius: 12px;
          box-shadow: var(--shadow-sm);
        }
        .file-preview-card p { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.25rem; }
        .btn-download { 
          color: var(--primary-light); font-weight: 800; font-size: 0.8rem; 
          text-decoration: underline; cursor: pointer;
        }

        .empty-file-state { 
          display: flex; align-items: center; gap: 0.75rem; padding: 1rem; 
          background: #fff1f2; color: #9f1239; border-radius: 12px; font-size: 0.85rem; font-weight: 600;
        }
        input:disabled { background: white; border-color: rgba(0,0,0,0.05); color: var(--primary); opacity: 1; cursor: not-allowed; }
      `}</style>
    </DashboardLayout>
  );
}
