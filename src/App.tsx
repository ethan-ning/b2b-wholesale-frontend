import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';

// Dealer
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import ProductDetailPage from './pages/ProductDetailPage';

// Admin
import AdminProtectedRoute from './components/admin/AdminProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import ProductListPage from './pages/admin/ProductListPage';
import ProductFormPage from './pages/admin/ProductFormPage';
import CategoryPage from './pages/admin/CategoryPage';
import ImageListPage from './pages/admin/ImageListPage';
import CustomerListPage from './pages/admin/CustomerListPage';
import CustomerFormPage from './pages/admin/CustomerFormPage';
import InventoryPage from './pages/admin/InventoryPage';
import SellfoxPage from './pages/admin/SellfoxPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAccountPage from './pages/admin/AdminAccountPage';
import AdminChangePasswordPage from './pages/admin/AdminChangePasswordPage';

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
      <Routes>
        {/* Dealer routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          {/* Outside the Layout: a dealer who has not finished here has no catalog to
              browse, so the header's search bar would be a dead end. */}
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/products/:spuCode" element={<ProductDetailPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminProtectedRoute />}>
          <Route path="change-password" element={<AdminChangePasswordPage />} />
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="categories" element={<CategoryPage />} />
            <Route path="images" element={<ImageListPage />} />
            <Route path="customers" element={<CustomerListPage />} />
            <Route path="customers/new" element={<CustomerFormPage />} />
            <Route path="customers/:id/edit" element={<CustomerFormPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="sellfox" element={<SellfoxPage />} />
            <Route path="admins" element={<AdminUsersPage />} />
            <Route path="account" element={<AdminAccountPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
