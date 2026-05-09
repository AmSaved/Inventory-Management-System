import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Context
import { AuthProvider } from './context/AuthContext';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import RequestsPage from './pages/RequestsPage';
import InventoryPage from './pages/InventoryPage';
import AssetsPage from './pages/AssetsPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import ItemManagementPage from './pages/ItemManagementPage';
import SplitPage from './pages/SplitPage';
import MergePage from './pages/MergePage';

import StorePage from './pages/StorePage';
import DischargePage from './pages/DischargePage';
import DischargeApprovePage from './pages/discharge/DischargeApprovePage';
import ReturnsPage from './pages/ReturnsPage';
import TransfersPage from './pages/TransfersPage';
import IssuesPage from './pages/IssuesPage';
import SetupWizardPage from './pages/SetupWizardPage';
import RolesPage from './pages/RolesPage';
import UsersPage from './pages/UsersPage';
import PermissionsPage from './pages/PermissionsPage';
import ProductManagement from './components/admin/ProductManagement';

import RequestProductPage from './pages/RequestProductPage';
import TransferAssetPage from './pages/TransferAssetPage';
import ReturnAssetPage from './pages/ReturnAssetPage';
import ReportProblemPage from './pages/ReportProblemPage';
import WorkflowPage from './pages/WorkflowPage';
import ApprovalLedgerPage from './pages/ApprovalLedgerPage';
import BranchMergePage from './pages/BranchMergePage';
import ReturnInventoryPage from './pages/ReturnInventoryPage';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Protected Routes (MainLayout) */}
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/requests/:type" element={<ApprovalLedgerPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/manage" element={<ItemManagementPage />} />
              <Route path="/inventory/split" element={<SplitPage />} />
              <Route path="/inventory/merge" element={<MergePage />} />
              <Route path="/inventory/return" element={<ReturnInventoryPage />} />
              <Route path="/assets" element={<AssetsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
              <Route path="/profile" element={<ProfilePage />} />
              
              {/* Modules */}
              <Route path="/store" element={<StorePage />} />
              <Route path="/discharge" element={<DischargePage />} />
              <Route path="/discharge/approve" element={<DischargeApprovePage />} />
              <Route path="/returns" element={<ReturnsPage />} />
              <Route path="/transfers" element={<TransfersPage />} />
              <Route path="/issues" element={<IssuesPage />} />
              <Route path="/setup" element={<SetupWizardPage />} />
              <Route path="/admin/roles" element={<RolesPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/permissions" element={<PermissionsPage />} />
              <Route path="/admin/workflows" element={<WorkflowPage />} />
              <Route path="/admin/products" element={<ProductManagement />} />
              <Route path="/admin/merge-branches" element={<BranchMergePage />} />

              {/* User Workflow Routes */}
              <Route path="/requests/new" element={<RequestProductPage />} />
              <Route path="/requests/transfer" element={<TransferAssetPage />} />
              <Route path="/requests/return" element={<ReturnAssetPage />} />
              <Route path="/requests/report" element={<ReportProblemPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
