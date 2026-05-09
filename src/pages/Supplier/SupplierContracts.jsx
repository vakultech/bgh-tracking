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
  Truck,
  Box
} from 'lucide-react';
import { account, databases, db, ID, Query, storage } from '../../lib/appwrite';
import { format, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { logActivity } from '../../lib/logger';
import { sendAlert, notifyStakeholders } from '../../lib/notifications';

const ContractCard = ({ contract, onUpdate }) => {
  const safeFormat = (dateStr, fmt = 'MMM dd, yyyy') => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isValid(d) ? format(d, fmt) : 'Invalid Date';
  };

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
           contract.status === 'in-transit' ? <Truck size={14} /> : <Clock size={14} />}
          {contract.status === 'delivered' ? 'Arrived (Pending)' : contract.status}
        </span>
        <div className="contract-date">
          <Calendar size={14} />
          <span>{safeFormat(contract.$createdAt)}</span>
        </div>
      </div>

      <div className="contract-body">
        <div className="project-tag">Project ID: {contract.$id.substring(0, 8)}</div>
        <h3>{contract.project_name}</h3>
        
        <div className="delivery-info">
          <div className="info-item">
            <label>Target Deadline</label>
            <p>{safeFormat(contract.delivery_deadline)}</p>
          </div>
        </div>

        <div className="shipping-status-box">
          <div className="status-item">
            <Truck size={16} />
            <div>
              <label>Shipping Line</label>
              <p>{contract.shipping_line || 'Not specified'}</p>
            </div>
          </div>
          {contract.tentative_departure && (
            <div className="status-item">
              <Calendar size={16} />
              <div>
                <label>Tentative Departure</label>
                <p>{safeFormat(contract.tentative_departure, 'MMM dd, yyyy - hh:mm a')}</p>
              </div>
            </div>
          )}
          {contract.tentative_arrival && (
            <div className="status-item">
              <Calendar size={16} />
              <div>
                <label>Tentative Arrival at BGH</label>
                <p>{safeFormat(contract.tentative_arrival, 'MMM dd, yyyy - hh:mm a')}</p>
              </div>
            </div>
          )}
          {contract.actual_delivery_date && (
            <div className="status-item highlight-arrival">
              <CheckCircle2 size={16} color="var(--success)" />
              <div>
                <label>Actual Date of Arrival</label>
                <p className="text-success">{safeFormat(contract.actual_delivery_date, 'MMM dd, yyyy')}</p>
              </div>
            </div>
          )}
          <div className="status-item">
            <Ship size={16} />
            <div>
              <label>Vessel / Vehicle</label>
              <p>{contract.vessel_name || 'TBA'}</p>
            </div>
          </div>
          {contract.waybill_file_id && (
            <div className="status-item">
              <Paperclip size={16} />
              <div>
                <label>Shipping Documents</label>
                <a 
                  href={storage.getFileView(import.meta.env.VITE_APPWRITE_BUCKET_PERMITS, contract.waybill_file_id)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="view-link"
                >
                  View Waybill / Receipt
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="contract-footer">
        <button className="btn-update" onClick={() => onUpdate(contract)}>
          {contract.status === 'completed' ? 'View Project Details' : 'Update Delivery Details'} <ChevronRight size={16} />
        </button>
      </div>
    </motion.div>
  );
};

export default function SupplierContracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [supplierProfile, setSupplierProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pages, setPages] = useState({ new: 1, ongoing: 1, completed: 1 });
  const ITEMS_PER_PAGE = 5;
  
  const [formData, setFormData] = useState({
    status: 'pending',
    shipping_line: '',
    vessel_name: '',
    actual_delivery_date: '',
    delivery_mode: 'sea',
    tentative_departure: '',
    tentative_arrival: '',
    waybill_file_id: ''
  });

  const fetchSupplierData = async () => {
    try {
      setLoading(true);
      const user = await account.get();
      
      // 1. Get profile to get email
      const { documents: profiles } = await databases.listDocuments(
        db.id, db.collections.profiles, [Query.equal('userId', user.$id)]
      );
      
      if (profiles.length === 0) {
        setLoading(false);
        return;
      }
      
      const userEmail = profiles[0].email;

      // 2. Find matching supplier document by email
      const { documents: suppliers } = await databases.listDocuments(
        db.id, db.collections.suppliers, [Query.equal('email', userEmail)]
      );

      if (suppliers.length === 0) {
        setContracts([]);
        setLoading(false);
        return;
      }
      
      const supplierDoc = suppliers[0];
      setSupplierProfile(supplierDoc);

      // 3. Fetch contracts for this supplier
      const { documents: contractsList } = await databases.listDocuments(
        db.id, db.collections.contracts, [
          Query.equal('supplier_id', supplierDoc.$id),
          Query.orderDesc('$createdAt')
        ]
      );
      setContracts(contractsList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter(c => 
    c.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.$id.toLowerCase().includes(searchQuery.toLowerCase())
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

  useEffect(() => {
    fetchSupplierData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSupplierData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateClick = (contract) => {
    setSelectedContract(contract);
    setFormData({
      status: contract.status || 'pending',
      shipping_line: contract.shipping_line || '',
      vessel_name: contract.vessel_name || '',
      actual_delivery_date: contract.actual_delivery_date || '',
      delivery_mode: contract.delivery_mode || 'sea',
      tentative_departure: contract.tentative_departure || '',
      tentative_arrival: contract.tentative_arrival || '',
      waybill_file_id: contract.waybill_file_id || ''
    });
    setShowModal(true);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Validation for In-Transit status
    if (formData.status === 'in-transit') {
      const missingFields = [];
      if (!formData.shipping_line) missingFields.push("Shipping Line");
      if (!formData.tentative_departure) missingFields.push("Departure Date/Time");
      if (!formData.tentative_arrival) missingFields.push("Arrival Date/Time");
      if (!formData.delivery_mode) missingFields.push("Shipping Mode");

      if (missingFields.length > 0) {
        alert(`⚠️ Please provide the following for In-Transit shipments:\n- ${missingFields.join('\n- ')}`);
        setSubmitting(false);
        return;
      }
    }

    // Validation for Delivered status
    if (formData.status === 'delivered' && !formData.actual_delivery_date) {
      alert("⚠️ Please provide the Actual Delivery Date to notify BGH of arrival.");
      setSubmitting(false);
      return;
    }

    try {
      await databases.updateDocument(
        db.id, db.collections.contracts, selectedContract.$id, formData
      );
      
      // Determine what changed for a detailed notification
      let changeDetail = `Status changed to ${formData.status.toUpperCase()}.`;
      if (formData.waybill_file_id !== selectedContract.waybill_file_id) {
        changeDetail = "New Waybill/Receipt has been uploaded.";
      } else if (formData.tentative_arrival !== selectedContract.tentative_arrival) {
        changeDetail = `Delivery schedule updated (Arrival: ${format(new Date(formData.tentative_arrival), 'MMM dd, hh:mm a')}).`;
      }

      // Notify ALL Stakeholders
      await notifyStakeholders(
        selectedContract,
        'Logistics Update',
        `${supplierProfile.name} updated "${selectedContract.project_name}": ${changeDetail}`,
        'info'
      );

      await logActivity('Update Delivery', `Project: ${selectedContract.project_name} status updated to ${formData.status}`);
      
      setShowModal(false);
      fetchSupplierData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const safeFormat = (dateStr, fmt = 'MMM dd, yyyy') => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isValid(d) ? format(d, fmt) : 'Invalid Date';
  };

  return (
    <DashboardLayout role="supplier">
      <div className="fade-in">
        <div className="section-header">
          <div>
            <h2>My Project Folder</h2>
            <p>Manage your assigned procurement projects and update delivery tracking.</p>
          </div>
        </div>

        <div className="card filter-card search-container">
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input 
              placeholder="Search projects by name or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="contracts-sections">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Fetching your projects...</p>
            </div>
          ) : filteredContracts.length > 0 ? (
            <>
              {/* SECTION 1: NEW PROJECTS */}
              <div className="project-section">
                <div className="section-title-bar">
                  <div className="title-icon new"><Plus size={18} /></div>
                  <h3>New Projects from BGH</h3>
                  <span className="count-badge">{filteredContracts.filter(c => c.status === 'pending').length}</span>
                </div>
                <div className="contracts-grid">
                  {getPaginatedData(filteredContracts.filter(c => c.status === 'pending'), pages.new).map(contract => (
                    <ContractCard key={contract.$id} contract={contract} onUpdate={handleUpdateClick} />
                  ))}
                  {filteredContracts.filter(c => c.status === 'pending').length === 0 && <div className="empty-mini">No new projects matching search.</div>}
                </div>
                <Pagination 
                  total={filteredContracts.filter(c => c.status === 'pending').length} 
                  current={pages.new} 
                  section="new" 
                />
              </div>

              {/* SECTION 2: ONGOING TRACKING */}
              <div className="project-section">
                <div className="section-title-bar">
                  <div className="title-icon ongoing"><Truck size={18} /></div>
                  <h3>Ongoing Tracking & Deliveries</h3>
                  <span className="count-badge">{filteredContracts.filter(c => ['processed', 'in-transit', 'delivered'].includes(c.status)).length}</span>
                </div>
                <div className="contracts-grid">
                  {getPaginatedData(filteredContracts.filter(c => ['processed', 'in-transit', 'delivered'].includes(c.status)), pages.ongoing).map(contract => (
                    <ContractCard key={contract.$id} contract={contract} onUpdate={handleUpdateClick} />
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
                  <h3>Completed Projects</h3>
                  <span className="count-badge">{filteredContracts.filter(c => c.status === 'completed').length}</span>
                </div>
                <div className="contracts-grid">
                  {getPaginatedData(filteredContracts.filter(c => c.status === 'completed'), pages.completed).map(contract => (
                    <ContractCard key={contract.$id} contract={contract} onUpdate={handleUpdateClick} />
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
              <Box size={48} />
              <h3>No Projects Found</h3>
              <p>No projects match your current search or assignment.</p>
            </div>
          )}
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
                <h3>{formData.status === 'completed' ? 'Project Archive: ' : 'Update Tracking: '}{selectedContract?.project_name}</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="scrollable-form">
                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">1</div>
                    <h4>Delivery Status</h4>
                  </div>
                  <div className="form-row">
                    <div className="input-group">
                      <label className="static-label">Current Phase</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="pending">Pending Preparation</option>
                        <option value="in-transit">In Transit / Shipped</option>
                        <option value="delivered">Delivered to BGH (Confirming)</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="static-label">Actual Delivery Date {formData.status === 'delivered' && <span className="req-star">*</span>}</label>
                      <input 
                        type="date" 
                        value={formData.actual_delivery_date} 
                        onChange={e => setFormData({...formData, actual_delivery_date: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">2</div>
                    <h4>Logistics Details</h4>
                  </div>
                  <div className="form-row">
                    <div className="input-group">
                      <label className="static-label">Shipping Mode {formData.status === 'in-transit' && <span className="req-star">*</span>}</label>
                      <select value={formData.delivery_mode} onChange={e => setFormData({...formData, delivery_mode: e.target.value})}>
                        <option value="sea">Sea Freight</option>
                        <option value="air">Air Freight</option>
                        <option value="land">Land Transport</option>
                      </select>
                    </div>
                    <div className="input-group floating">
                      <input placeholder=" " value={formData.shipping_line} onChange={e => setFormData({...formData, shipping_line: e.target.value})} />
                      <label>Shipping Line / Courier {formData.status === 'in-transit' && <span className="req-star">*</span>}</label>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="input-group">
                      <label className="static-label">Tentative Departure {formData.status === 'in-transit' && <span className="req-star">*</span>}</label>
                      <input type="datetime-local" value={formData.tentative_departure} onChange={e => setFormData({...formData, tentative_departure: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label className="static-label">Tentative Arrival at BGH {formData.status === 'in-transit' && <span className="req-star">*</span>}</label>
                      <input type="datetime-local" value={formData.tentative_arrival} onChange={e => setFormData({...formData, tentative_arrival: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="input-group floating">
                      <input placeholder=" " value={formData.vessel_name} onChange={e => setFormData({...formData, vessel_name: e.target.value})} />
                      <label>Vessel Name / Plate No.</label>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">3</div>
                    <h4>Supporting Documents</h4>
                  </div>
                  <div className="input-group">
                    <label className="static-label">Upload Waybill / Delivery Receipt</label>
                    <div className="file-upload-zone">
                      <UploadCloud size={24} />
                      <input 
                        type="file" 
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              setSubmitting(true);
                              const res = await storage.createFile(import.meta.env.VITE_APPWRITE_BUCKET_PERMITS, ID.unique(), file);
                              setFormData({...formData, waybill_file_id: res.$id});
                              alert("Waybill uploaded successfully!");
                            } catch (err) {
                              alert("Upload failed: " + err.message);
                            } finally {
                              setSubmitting(false);
                            }
                          }
                        }}
                      />
                      <p>{formData.waybill_file_id ? "✅ Document Attached" : "Click or drag to upload Waybill (PDF/JPG)"}</p>
                    </div>
                  </div>
                </div>


                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  {formData.status === 'completed' ? (
                    <button type="button" className="btn-primary" onClick={() => setShowModal(false)}>Close View</button>
                  ) : (
                    <button type="submit" className="btn-primary" disabled={submitting}>
                      {submitting ? 'Updating...' : 'Save Tracking Info'}
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .contracts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 2rem; margin-top: 2rem; }
        .contract-card { display: flex; flex-direction: column; height: 100%; border: 1px solid rgba(0,0,0,0.05); }
        
        .contract-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .status-badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .status-badge.pending { background: #fff7ed; color: #c2410c; }
        .status-badge.delivered { background: #ecfdf5; color: #065f46; }
        .status-badge.in-transit { background: #eff6ff; color: #1e40af; }
        
        .project-tag { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.05em; }
        .contract-body h3 { font-size: 1.25rem; font-weight: 700; color: var(--primary); margin-bottom: 1.5rem; line-height: 1.3; }
        
        .delivery-info { background: var(--bg); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; }
        .info-item label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; }
        .info-item p { font-weight: 700; font-size: 1rem; color: var(--primary); }

        .shipping-status-box { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; background: #f8fafc; border-radius: 12px; border: 1px solid var(--border); }
        .status-item { display: flex; align-items: center; gap: 1rem; }
        .status-item div { display: flex; flex-direction: column; }
        .status-item label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; }
        .status-item p, .view-link { font-size: 0.85rem; font-weight: 600; color: var(--primary); text-decoration: none; }
        .view-link { color: var(--primary-light); text-decoration: underline; }
        .view-link:hover { color: var(--primary); }
        .highlight-arrival { background: #f0fdf4; padding: 0.75rem; border-radius: 10px; border: 1px solid rgba(22, 163, 74, 0.2); }
        .text-success { color: #16a34a !important; font-weight: 800; }

        .search-container { padding: 1rem; margin-top: 1rem; border: 1px solid var(--border); background: white; border-radius: 16px; }
        .search-wrapper { display: flex; align-items: center; gap: 1rem; background: var(--bg); padding: 0.75rem 1.25rem; border-radius: 12px; border: 1px solid var(--border); transition: all 0.2s; }
        .search-wrapper:focus-within { border-color: var(--primary-light); box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1); background: white; }
        .search-wrapper input { border: none; background: transparent; padding: 0.25rem; font-size: 0.95rem; width: 100%; color: var(--primary); font-weight: 600; }
        .search-wrapper input:focus { outline: none; }
        .search-icon { color: var(--text-muted); }

        .pagination-controls { display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-top: 2rem; padding: 1rem; background: var(--bg); border-radius: 12px; border: 1px solid var(--border); }
        .page-btn { padding: 0.5rem 1.25rem; background: white; border: 1px solid var(--border); border-radius: 8px; font-size: 0.8rem; font-weight: 700; color: var(--primary); cursor: pointer; transition: all 0.2s; }
        .page-btn:hover:not(:disabled) { border-color: var(--primary-light); color: var(--primary-light); transform: translateY(-1px); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { font-size: 0.85rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em; }

        .contracts-sections { display: flex; flex-direction: column; gap: 4rem; margin-top: 2rem; }
        .project-section { display: flex; flex-direction: column; gap: 1.5rem; }
        .section-title-bar { display: flex; align-items: center; gap: 1rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border); }
        .title-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; }
        .title-icon.new { background: var(--primary); }
        .title-icon.ongoing { background: var(--warning); }
        .title-icon.completed { background: var(--success); }
        .section-title-bar h3 { font-size: 1.1rem; font-weight: 800; color: var(--primary); margin: 0; }
        .count-badge { background: var(--bg); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); border: 1px solid var(--border); }
        .empty-mini { grid-column: 1 / -1; padding: 2rem; background: var(--bg); border-radius: 12px; border: 1px dashed var(--border); text-align: center; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; }

        .file-upload-zone { 
          margin-top: 0.5rem; border: 2px dashed var(--border); border-radius: 12px; padding: 1.5rem; 
          text-align: center; color: var(--text-muted); position: relative; transition: all 0.2s;
          background: white; cursor: pointer;
        }
        .file-upload-zone:hover { border-color: var(--primary-light); background: var(--bg); }
        .file-upload-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
        .file-upload-zone p { font-size: 0.8rem; margin-top: 0.5rem; font-weight: 600; }

        .contract-footer { margin-top: auto; padding-top: 1.5rem; }
        .btn-update { 
          width: 100%; padding: 1rem; 
          background: linear-gradient(135deg, var(--primary), var(--primary-light)); 
          color: white; border-radius: 12px; font-weight: 700; 
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          box-shadow: 0 4px 12px rgba(30, 58, 138, 0.2); transition: all 0.2s;
          border: none; cursor: pointer;
        }
        .btn-update:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(30, 58, 138, 0.3); }

        .loading-state, .empty-state { grid-column: 1 / -1; padding: 5rem; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        
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
        .req-star { color: var(--danger); font-weight: bold; margin-left: 0.25rem; }
        .input-group select { height: 48px; border-radius: 12px; border: 1px solid var(--border); padding: 0 1rem; font-weight: 600; background: white; width: 100%; }

        .modal-footer { padding: 1.5rem 2rem; background: var(--bg); border-top: 1px solid var(--border); display: flex; gap: 1rem; justify-content: flex-end; }
        .btn-ghost { padding: 0.75rem 1.5rem; font-weight: 700; color: var(--text-muted); border: none; background: transparent; cursor: pointer; }
        .btn-primary { padding: 0.75rem 2rem; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2); border: none; cursor: pointer; background: var(--primary); color: white; }
      `}</style>
    </DashboardLayout>
  );
}
