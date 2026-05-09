import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  Plus, 
  Search, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Edit2, 
  Trash2,
  X,
  UploadCloud,
  FileText,
  ChevronRight
} from 'lucide-react';
import { databases, db, ID, storage } from '../../lib/appwrite';
import { format, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { logActivity } from '../../lib/logger';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    email: '',
    contact: '',
    mayors_permit_expiry: '',
    dti_permit: '',
    philgeps_number: '',
    other_permits: '',
    status: 'active',
    mayors_permit_file_id: '',
    dti_permit_file_id: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { documents } = await databases.listDocuments(db.id, db.collections.suppliers);
      setSuppliers(documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      // Absolute minimum payload to ensure it saves
      const payload = {
        name: formData.name,
        address: formData.address,
        email: formData.email,
        contact: formData.contact,
        status: formData.status
      };

      if (formData.$id) {
        await databases.updateDocument(db.id, db.collections.suppliers, formData.$id, payload);
        await logActivity('Update Supplier', `Company: ${formData.name}`);
      } else {
        await databases.createDocument(db.id, db.collections.suppliers, ID.unique(), payload);
        await logActivity('Register Supplier', `Company: ${formData.name}`);
      }
      
      setShowModal(false);
      resetForm();
      fetchSuppliers();
      alert(formData.$id ? "Supplier Updated Successfully!" : "Supplier Registered Successfully!");
    } catch (err) {
      alert("Database Error: " + err.message + ". Please ensure your Supplier collection has the required fields.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      email: '',
      contact: '',
      mayors_permit_expiry: '',
      dti_permit: '',
      philgeps_number: '',
      other_permits: '',
      status: 'active',
      mayors_permit_file_id: '',
      dti_permit_file_id: '',
    });
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="fade-in">
        <div className="section-header">
          <div>
            <h2>Supplier Directory</h2>
            <p>Manage and verify hospital partners and credentials.</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary" 
            onClick={() => { resetForm(); setShowModal(true); }}
          >
            <Plus size={18} />
            <span>Add New Supplier</span>
          </motion.button>
        </div>

        <div className="card filter-card search-container">
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input 
              placeholder="Search suppliers by name, email, or address..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="suppliers-grid">
          {loading ? (
            <div className="loading-state card">
              <div className="spinner"></div>
              <p>Syncing supplier records...</p>
            </div>
          ) : filteredSuppliers.length > 0 ? (
            filteredSuppliers.map((supplier) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={supplier.$id} 
                className="supplier-card card"
              >
                <div className="supplier-card-header">
                  <div className="supplier-main">
                    <div className="supplier-avatar">
                      {supplier.name.charAt(0)}
                    </div>
                    <div>
                      <h3>{supplier.name}</h3>
                      <span className={`status-pill ${supplier.status}`}>{supplier.status}</span>
                    </div>
                  </div>
                  <div className="supplier-actions">
                    <button className="icon-btn" onClick={() => { setFormData(supplier); setShowModal(true); }}><Edit2 size={16} /></button>
                  </div>
                </div>

                <div className="supplier-details">
                  <div className="detail-item">
                    <Mail size={14} />
                    <span>{supplier.email}</span>
                  </div>
                  <div className="detail-item">
                    <Phone size={14} />
                    <span>{supplier.contact}</span>
                  </div>
                  <div className="detail-item">
                    <MapPin size={14} />
                    <span>{supplier.address}</span>
                  </div>
                </div>

                <div className="permit-status-box">
                  <div className="permit-row">
                    <label>Mayor's Permit</label>
                    <span className={new Date(supplier.mayors_permit_expiry) < new Date() ? 'expired' : 'valid'}>
                      {safeFormat(supplier.mayors_permit_expiry, 'MM/dd/yy')}
                    </span>
                  </div>
                  <div className="permit-row">
                    <label>PhilGEPS No.</label>
                    <span>{supplier.philgeps_number || 'Pending'}</span>
                  </div>
                </div>

                <div className="card-footer">
                  <button className="btn-details">View Credentials <ChevronRight size={14} /></button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="empty-state card">
              <FileText size={48} />
              <h3>No records found</h3>
              <p>No suppliers match your current search criteria.</p>
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
                <h3>{formData.$id ? 'Update Supplier Profile' : 'Register New Supplier'}</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="scrollable-form">
                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">1</div>
                    <h4>Company Information</h4>
                  </div>
                  <div className="input-group floating">
                    <input required placeholder=" " value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    <label>Official Business Name</label>
                  </div>
                  <div className="form-row">
                    <div className="input-group floating">
                      <input type="email" required placeholder=" " value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                      <label>Business Email</label>
                    </div>
                    <div className="input-group floating">
                      <input required placeholder=" " value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
                      <label>Contact Number</label>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">2</div>
                    <h4>Location & Logistics</h4>
                  </div>
                  <div className="input-group floating">
                    <textarea required placeholder=" " value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                    <label>Complete Business Address</label>
                  </div>
                  <div className="input-group">
                    <label className="static-label">Account Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="active">Active (Vetted)</option>
                      <option value="pending">Pending Verification</option>
                      <option value="inactive">Suspended / Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Processing...' : formData.$id ? 'Update Supplier' : 'Register Supplier'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .search-container { padding: 1rem; margin-bottom: 2rem; border: 1px solid var(--border); }
        .search-wrapper { display: flex; align-items: center; gap: 1rem; background: var(--bg); padding: 0.5rem 1rem; border-radius: 12px; }
        .search-wrapper input { border: none; background: transparent; padding: 0.5rem; font-size: 1rem; width: 100%; color: var(--primary); }
        .search-wrapper input:focus { box-shadow: none; outline: none; }

        .suppliers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 2rem; }
        .supplier-card { border: 1px solid rgba(0,0,0,0.05); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .supplier-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--primary-light); }
        
        .supplier-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .supplier-main { display: flex; gap: 1rem; align-items: center; }
        .supplier-avatar { width: 50px; height: 50px; background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; }
        .supplier-main h3 { font-size: 1.1rem; font-weight: 700; color: var(--primary); }
        
        .supplier-details { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
        .detail-item { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); }
        
        .permit-status-box { background: var(--bg); padding: 1rem; border-radius: 12px; margin-bottom: 1rem; }
        .permit-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 0.5rem; }
        .permit-row label { font-weight: 700; color: var(--text-muted); }
        .permit-row span { font-weight: 600; color: var(--primary); }
        .permit-row span.expired { color: var(--danger); }
        .permit-row span.valid { color: var(--success); }

        .card-footer { border-top: 1px solid var(--border); padding-top: 1rem; margin-top: auto; }
        .btn-details { width: 100%; background: transparent; color: var(--primary-light); font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

        /* Modern Modal Layout */
        .modal-overlay { 
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); 
          backdrop-filter: blur(8px); display: flex; align-items: center; 
          justify-content: center; z-index: 1000; padding: 2rem;
        }
        .modal-content.modern-form { 
          width: 100%; max-width: 600px; 
          background: white; border-radius: 24px; 
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          overflow: hidden; display: flex; flex-direction: column;
        }
        .modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { font-size: 1.25rem; font-weight: 800; color: var(--primary); }
        .close-btn { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .close-btn:hover { background: white; color: var(--danger); border-color: var(--danger); }

        .scrollable-form { max-height: 80vh; overflow-y: auto; padding: 2rem; }
        .form-section { background: var(--bg); padding: 1.5rem; border-radius: 16px; margin-bottom: 1.5rem; border: 1px solid var(--border); }
        .section-title { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .step-num { width: 32px; height: 32px; background: var(--primary); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; }
        .section-title h4 { font-weight: 700; color: var(--primary); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }

        .input-group.floating { position: relative; margin-bottom: 1.25rem; }
        .input-group.floating input, .input-group.floating textarea { height: 56px; padding: 22px 15px 6px; width: 100%; border: 1px solid var(--border); border-radius: 12px; font-weight: 600; font-size: 0.95rem; }
        .input-group.floating textarea { height: 100px; padding-top: 25px; }
        .input-group.floating label { position: absolute; left: 15px; top: 18px; transition: all 0.2s; pointer-events: none; color: var(--text-muted); font-size: 0.9rem; font-weight: 500; }
        .input-group.floating input:focus + label,
        .input-group.floating input:not(:placeholder-shown) + label,
        .input-group.floating textarea:focus + label,
        .input-group.floating textarea:not(:placeholder-shown) + label { top: 8px; font-size: 0.7rem; font-weight: 800; color: var(--primary-light); }
        
        .static-label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .upload-box { flex: 1; }
        .file-input-wrapper { position: relative; }
        .file-input-wrapper input { position: absolute; width: 0; height: 0; opacity: 0; }
        .file-input-wrapper label { height: 48px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: 2px dashed var(--border); border-radius: 12px; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; font-weight: 700; background: white; }
        .file-input-wrapper label.uploaded { border-color: var(--success); color: var(--success); background: #f0fdf4; }
        
        .modal-footer { padding: 1.5rem 2rem; background: var(--bg); border-top: 1px solid var(--border); display: flex; gap: 1rem; justify-content: flex-end; }
        .btn-ghost { padding: 0.75rem 1.5rem; font-weight: 700; color: var(--text-muted); }
        .btn-primary { padding: 0.75rem 2rem; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2); }
      `}</style>
    </DashboardLayout>
  );
}
