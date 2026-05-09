import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { User, Mail, Lock, Save, ShieldCheck, Key } from 'lucide-react';
import { account, databases, db, Query } from '../lib/appwrite';
import { logActivity } from '../lib/logger';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const authUser = await account.get();
      setUser(authUser);

      const { documents } = await databases.listDocuments(
        db.id,
        db.collections.profiles,
        [Query.equal("userId", authUser.$id)]
      );

      if (documents.length > 0) {
        const p = documents[0];
        setProfile(p);
        setFormData(prev => ({
          ...prev,
          fullName: p.fullName || '',
          email: authUser.email || ''
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setUpdating(true);
      
      // 1. Update Profile in Database
      if (profile) {
        await databases.updateDocument(db.id, db.collections.profiles, profile.$id, {
          fullName: formData.fullName
        });
      }

      // 2. Update Email if changed
      if (formData.email !== user.email) {
        await account.updateEmail(formData.email, formData.currentPassword);
      }

      await logActivity('Update Profile', `User updated their personal details`);
      alert("Profile updated successfully!");
      fetchUserData();
    } catch (err) {
      alert("Update Failed: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      return alert("Passwords do not match!");
    }

    try {
      setUpdating(true);
      await account.updatePassword(formData.newPassword, formData.currentPassword);
      await logActivity('Change Password', `User updated their security credentials`);
      alert("Password changed successfully!");
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      alert("Password Change Failed: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <DashboardLayout><div>Loading profile...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="fade-in profile-page">
        <div className="section-header">
          <div>
            <h2>My Account</h2>
            <p>Manage your personal information and security settings.</p>
          </div>
        </div>

        <div className="profile-grid">
          {/* Personal Info Card */}
          <div className="card glass modern-form">
            <div className="card-header">
              <div className="header-icon"><User size={20} /></div>
              <h3>Personal Information</h3>
            </div>
            <form onSubmit={handleUpdateProfile} className="profile-form">
              <div className="input-group floating">
                <input required placeholder=" " value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                <label>Full Name</label>
              </div>
              <div className="input-group floating">
                <input type="email" required placeholder=" " value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <label>Email Address</label>
                <Mail size={16} className="input-icon-right" />
              </div>
              
              <div className="password-gate">
                <p className="helper-text">Enter current password to save changes:</p>
                <div className="input-group floating">
                  <input type="password" required placeholder=" " value={formData.currentPassword} onChange={e => setFormData({...formData, currentPassword: e.target.value})} />
                  <label>Current Password</label>
                  <Lock size={16} className="input-icon-right" />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={updating}>
                <Save size={18} />
                {updating ? 'Saving...' : 'Update Details'}
              </button>
            </form>
          </div>

          {/* Security Card */}
          <div className="card glass modern-form">
            <div className="card-header">
              <div className="header-icon danger"><Key size={20} /></div>
              <h3>Security & Password</h3>
            </div>
            <form onSubmit={handleChangePassword} className="profile-form">
              <div className="input-group floating">
                <input type="password" required minLength="8" placeholder=" " value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} />
                <label>New Password</label>
              </div>
              <div className="input-group floating">
                <input type="password" required minLength="8" placeholder=" " value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                <label>Confirm New Password</label>
              </div>
              
              <button type="submit" className="btn-ghost" style={{ border: '1px solid var(--border)', width: '100%' }} disabled={updating}>
                <ShieldCheck size={18} />
                {updating ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        .profile-page { max-width: 1100px; margin: 0 auto; }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; align-items: start; }
        
        .card-header { 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          text-align: center;
          gap: 1rem; 
          margin-bottom: 2.5rem; 
          border-bottom: none;
        }
        
        .header-icon { 
          width: 56px; height: 56px; 
          border-radius: 16px; 
          background: #eff6ff; color: #3b82f6; 
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 16px -4px rgba(59, 130, 246, 0.15);
        }
        .header-icon.danger { background: #fff1f2; color: #e11d48; box-shadow: 0 8px 16px -4px rgba(225, 29, 72, 0.15); }
        
        .profile-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .password-gate { background: var(--bg); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border); }
        .helper-text { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 1rem; }
        
        @media (max-width: 900px) {
          .profile-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </DashboardLayout>
  );
}
