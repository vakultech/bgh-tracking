import React, { useState, useEffect } from 'react';
import { account, databases, db, Query } from '../lib/appwrite';
import { useNavigate } from 'react-router-dom';
import { LogIn, KeyRound, Mail, AlertCircle } from 'lucide-react';
import loginBg from '../assets/login-bg.png';
import { logActivity } from '../lib/logger';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const user = await account.get();
      if (user) {
        // Fetch user role
        const { documents } = await databases.listDocuments(
          db.id,
          db.collections.profiles,
          [Query.equal("userId", user.$id)]
        );

        if (documents.length > 0) {
          const profile = documents[0];
          if (profile.role === 'admin') navigate('/admin');
          else if (profile.role === 'supply_dept') navigate('/supply-dept');
          else navigate('/supplier');
        }
      }
    } catch (err) {
      // No session, stay on login page
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Check if session exists and delete it if we want to force a new login
      try {
        await account.deleteSession('current');
      } catch (e) {
        // No session to delete
      }

      // Appwrite Login
      await account.createEmailPasswordSession(email, password);
      const user = await account.get();

      // Fetch user role
      const { documents } = await databases.listDocuments(
        db.id,
        db.collections.profiles,
        [Query.equal("userId", user.$id)]
      );

      if (documents.length === 0) throw new Error("Profile not found");
      const profile = documents[0];

      // LOG ACTIVITY
      await logActivity('Login', `User logged in successfully`);

      // Navigate based on role
      if (profile.role === 'admin') navigate('/admin');
      else if (profile.role === 'supply_dept') navigate('/supply-dept');
      else navigate('/supplier');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-visual" style={{ backgroundImage: `url(${loginBg})` }}>
        <div className="overlay"></div>
        <div className="visual-content">
          <h1>BGH Tracking System</h1>
          <p>Batanes General Hospital Supplier Monitoring System</p>
        </div>
      </div>
      
      <div className="login-form-side">
        <div className="login-card fade-in">
          <div className="login-header">
            <img src="/assets/logo.jpg" alt="BGH Logo" className="login-logo" />
            <h2>Welcome Back</h2>
            <p>Access the official BGH Logistics Portal</p>
          </div>

          <form onSubmit={handleLogin}>
            {error && (
              <div className="error-alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="input-group">
              <label>Email Address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={20} />
                <input
                  type="email"
                  placeholder="name@bgh.gov.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <KeyRound className="input-icon" size={20} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <a href="#" className="forgot-password">Forgot password?</a>
            </div>

            <button type="submit" className="btn-primary login-btn" disabled={loading}>
              {loading ? 'Authenticating...' : (
                <>
                  <LogIn size={20} />
                  <span>Login to Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>&copy; {new Date().getFullYear()} Batanes General Hospital. All rights reserved.</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Styles remain identical to previous implementation */
        .login-container { display: flex; min-height: 100vh; width: 100%; background: #fff; }
        .login-visual { flex: 1.2; background-size: cover; background-position: center; position: relative; display: flex; align-items: center; justify-content: center; padding: 4rem; color: white; }
        @media (max-width: 1024px) { .login-visual { display: none; } }
        .overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(59, 130, 246, 0.4) 100%); }
        .visual-content { position: relative; z-index: 1; max-width: 500px; }
        .visual-content h1 { font-size: 3.5rem; font-weight: 700; margin-bottom: 1rem; letter-spacing: -0.02em; }
        .visual-content p { font-size: 1.25rem; opacity: 0.9; font-weight: 300; }
        .login-form-side { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; background: var(--bg); }
        .login-card { width: 100%; max-width: 440px; padding: 2.5rem; background: white; border-radius: 24px; box-shadow: var(--shadow-lg); }
        .login-header { text-align: center; margin-bottom: 2.5rem; }
        .login-logo { width: 220px; height: 220px; object-fit: contain; margin: 0 auto 1rem; display: block; border-radius: 24px; background: white; padding: 15px; }
        .login-header h2 { font-size: 1.75rem; color: var(--primary); margin-bottom: 0.5rem; }
        .login-header p { color: var(--text-muted); }
        .error-alert { background: #fef2f2; color: var(--danger); padding: 1rem; border-radius: var(--radius); display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; font-size: 0.9rem; border: 1px solid #fee2e2; }
        .input-group { margin-bottom: 1.5rem; }
        .input-group label { display: block; font-size: 0.9rem; font-weight: 500; margin-bottom: 0.5rem; color: var(--primary-light); }
        .input-wrapper { position: relative; }
        .input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .input-wrapper input { padding-left: 3rem; }
        .form-actions { display: flex; justify-content: flex-end; margin-bottom: 2rem; }
        .forgot-password { font-size: 0.9rem; color: var(--accent); text-decoration: none; font-weight: 500; }
        .login-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.75rem; font-size: 1rem; height: 3.5rem; }
        .login-footer { margin-top: 3rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; }
      `}</style>
    </div>
  );
}
