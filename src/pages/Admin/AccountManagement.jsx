import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  Users, 
  UserPlus, 
  Search, 
  Shield, 
  Edit2, 
  Trash2, 
  Mail, 
  ShieldAlert,
  ChevronRight,
  UserCheck,
  UserMinus,
  X,
  Lock,
  Building2,
  Key
} from 'lucide-react';
import { databases, db, ID, Query } from '../../lib/appwrite';
import { motion, AnimatePresence } from 'framer-motion';
import { logActivity } from '../../lib/logger';

export default function AccountManagement() {
  const [users, setUsers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'supply_dept',
    supplierId: '',
    status: 'ACTIVE'
  });

  useEffect(() => {
    fetchUsers();
    fetchSuppliers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { documents } = await databases.listDocuments(db.id, db.collections.profiles);
      setUsers(documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { documents } = await databases.listDocuments(db.id, db.collections.suppliers);
      setSuppliers(documents || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      const profileData = {
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        supplierId: formData.role === 'supplier' ? formData.supplierId : null
      };

      if (editingUser) {
        await databases.updateDocument(db.id, db.collections.profiles, editingUser.$id, profileData);
        await logActivity('Update Account', `User: ${formData.fullName} (${formData.role})`);
      } else {
        const profileDataNew = {
          ...profileData,
          userId: ID.unique()
        };
        await databases.createDocument(db.id, db.collections.profiles, ID.unique(), profileDataNew);
        await logActivity('Create Account', `User: ${formData.fullName} (${formData.role}) - Status: ${formData.status}`);
      }
      
      setShowModal(false);
      resetForm();
      fetchUsers();
      alert(editingUser ? "Account Updated Successfully!" : "Account Created Successfully!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      password: '',
      role: user.role || 'supply_dept',
      supplierId: user.supplierId || '',
      status: user.status || 'ACTIVE'
    });
    setShowModal(true);
  };

  const handleSupplierSelect = (id) => {
    const supplier = suppliers.find(s => s.$id === id);
    if (supplier) {
      setFormData(prev => ({
        ...prev,
        supplierId: id,
        fullName: supplier.name,
        email: supplier.email
      }));
    } else {
      setFormData(prev => ({ ...prev, supplierId: id }));
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      fullName: '',
      email: '',
      password: '',
      role: 'supply_dept',
      supplierId: '',
      status: 'ACTIVE'
    });
  };

  const filteredUsers = users.filter(u => 
    u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield size={14} />;
      case 'supply_dept': return <ShieldAlert size={14} />;
      default: return <Users size={14} />;
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="fade-in">
        <div className="section-header">
          <div>
            <h2>User Directory</h2>
            <p>Monitor and manage institutional access and permissions.</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary"
            onClick={() => { resetForm(); setShowModal(true); }}
          >
            <UserPlus size={18} />
            <span>Create New Account</span>
          </motion.button>
        </div>

        <div className="card filter-card search-container">
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input 
              placeholder="Search by name, email, or role..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="users-grid">
          {loading ? (
            <div className="loading-state card">
              <div className="spinner"></div>
              <p>Syncing user records...</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={user.$id} 
                className="user-card card"
              >
                <div className="user-card-header">
                  <div className="user-main">
                    <div className={`user-avatar-lg ${user.role}`}>
                      {user.fullName?.charAt(0) || 'U'}
                    </div>
                    <div className="user-info">
                      <h3>{user.fullName || 'New User'}</h3>
                      <div className={`role-badge ${user.role}`}>
                        {getRoleIcon(user.role)}
                        <span>{user.role?.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="user-actions">
                    <button className="icon-btn-sm" onClick={() => handleEdit(user)}><Edit2 size={16} /></button>
                  </div>
                </div>

                <div className="user-body">
                  <div className="user-detail-row">
                    <Mail size={14} />
                    <span>{user.email || 'No email provided'}</span>
                  </div>
                  {user.supplierId && (
                    <div className="user-detail-row">
                      <Building2 size={14} className="text-primary" />
                      <span className="text-primary fw-bold">Linked Supplier Account</span>
                    </div>
                  )}
                  <div className="user-detail-row">
                    {user.status === 'ACTIVE' ? <UserCheck size={14} className="text-success" /> : <UserMinus size={14} className="text-danger" />}
                    <span className={user.status === 'ACTIVE' ? 'text-success fw-bold' : 'text-danger'}>
                      {user.status || 'PENDING'}
                    </span>
                  </div>
                </div>

                <div className="user-card-footer">
                  <button className="btn-details-sm" onClick={() => handleEdit(user)}>View Profile <ChevronRight size={14} /></button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="empty-state card">
              <Users size={48} />
              <h3>No users found</h3>
              <p>Try adjusting your search criteria.</p>
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
                <h3>{editingUser ? 'Account Details' : 'Create Account'}</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleSaveAccount} className="scrollable-form">
                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">1</div>
                    <h4>Account Type & Permissions</h4>
                  </div>
                  <div className="form-row">
                    <div className="input-group">
                      <label className="static-label">User Role</label>
                      <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value, supplierId: ''})}>
                        <option value="supply_dept">Supply Department</option>
                        <option value="supplier">Supplier Account</option>
                        <option value="admin">System Administrator</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="static-label">Status</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <AnimatePresence>
                    {formData.role === 'supplier' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="input-group"
                        style={{ marginTop: '1rem' }}
                      >
                        <label className="static-label">Link to Supplier Profile</label>
                        <select required value={formData.supplierId} onChange={e => handleSupplierSelect(e.target.value)}>
                          <option value="">-- Select Company (Auto-fills Info) --</option>
                          {suppliers.map(s => (
                            <option key={s.$id} value={s.$id}>{s.name}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="form-section">
                  <div className="section-title">
                    <div className="step-num">2</div>
                    <h4>Basic Information</h4>
                  </div>
                  <div className="input-group floating">
                    <input required placeholder=" " value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    <label>Full Name</label>
                  </div>
                  <div className="input-group floating">
                    <input type="email" required placeholder=" " value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    <label>Login Email</label>
                  </div>
                  {!editingUser && (
                    <div className="input-group floating">
                      <input type="password" required minLength="8" placeholder=" " value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                      <label>Initial Password (Min 8 characters)</label>
                      <Key size={14} className="input-icon-right" />
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : editingUser ? 'Update Account' : 'Create Account'}
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

        .users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
        .user-card { border: 1px solid rgba(0,0,0,0.05); transition: all 0.3s ease; display: flex; flex-direction: column; }
        .user-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--primary-light); }
        
        .user-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .user-main { display: flex; gap: 1rem; align-items: center; }
        
        .user-avatar-lg { 
          width: 56px; height: 56px; 
          border-radius: 16px; 
          display: flex; align-items: center; justify-content: center; 
          font-size: 1.5rem; font-weight: 800; color: white;
          background: linear-gradient(135deg, #64748b, #94a3b8);
        }
        .user-avatar-lg.admin { background: linear-gradient(135deg, #0f172a, #334155); }
        .user-avatar-lg.supply_dept { background: linear-gradient(135deg, #0d9488, #2dd4bf); }
        .user-avatar-lg.supplier { background: linear-gradient(135deg, #7c3aed, #a78bfa); }

        .user-info h3 { font-size: 1.1rem; font-weight: 700; color: var(--primary); margin-bottom: 0.25rem; }
        .role-badge { 
          display: inline-flex; align-items: center; gap: 0.35rem; 
          padding: 0.2rem 0.6rem; border-radius: 6px; 
          font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
          background: #f1f5f9; color: #64748b;
        }
        .role-badge.admin { background: #fee2e2; color: #991b1b; }
        .role-badge.supply_dept { background: #ccfbf1; color: #0f766e; }
        .role-badge.supplier { background: #ede9fe; color: #5b21b6; }

        .user-body { flex: 1; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
        .user-detail-row { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); }

        .user-card-footer { border-top: 1px solid var(--border); padding-top: 1rem; }
        .btn-details-sm { width: 100%; background: transparent; color: var(--primary-light); font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

        /* Modern Modal Layout */
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
        .close-btn { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .close-btn:hover { background: white; color: var(--danger); border-color: var(--danger); }

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
        .input-group select { height: 48px; border-radius: 12px; border: 1px solid var(--border); padding: 0 1rem; font-weight: 600; background: white; }
        
        .modal-footer { padding: 1.5rem 2rem; background: var(--bg); border-top: 1px solid var(--border); display: flex; gap: 1rem; justify-content: flex-end; }
        .btn-ghost { padding: 0.75rem 1.5rem; font-weight: 700; color: var(--text-muted); }
        .btn-primary { padding: 0.75rem 2rem; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2); }
      `}</style>
    </DashboardLayout>
  );
}
