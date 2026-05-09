import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AccountManagement from './pages/Admin/AccountManagement';
import AdminLogs from './pages/Admin/AdminLogs';
import SettingsPage from './pages/Admin/SettingsPage';
import SupplyDashboard from './pages/SupplyDept/SupplyDashboard';
import SuppliersPage from './pages/SupplyDept/SuppliersPage';
import ContractsPage from './pages/SupplyDept/ContractsPage';
import SupplierDashboard from './pages/Supplier/SupplierDashboard';
import SupplierContracts from './pages/Supplier/SupplierContracts';

import ProfilePage from './pages/ProfilePage';
import PMDPage from './pages/PMDPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute role="admin">
            <Routes>
              <Route index element={<AdminDashboard />} />
              <Route path="pmd" element={<PMDPage role="admin" />} />
              <Route path="accounts" element={<AccountManagement />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Routes>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/supply-dept/*" 
        element={
          <ProtectedRoute role="supply_dept">
            <Routes>
              <Route index element={<SupplyDashboard />} />
              <Route path="pmd" element={<PMDPage role="supply_dept" />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="contracts" element={<ContractsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Routes>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/supplier/*" 
        element={
          <ProtectedRoute role="supplier">
            <Routes>
              <Route index element={<SupplierDashboard />} />
              <Route path="contracts" element={<SupplierContracts />} />
              <Route path="profile" element={<ProfilePage />} />
            </Routes>
          </ProtectedRoute>
        } 
      />
      
      <Route path="*" element={<div>404 - Not Found</div>} />
    </Routes>
  );
}

export default App;
