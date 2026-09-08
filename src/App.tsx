import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';

// Dealer
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
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
import CustomerListPage from './pages/admin/CustomerListPage';
import CustomerFormPage from './pages/admin/CustomerFormPage';
import InventoryPage from './pages/admin/InventoryPage';

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
      <Routes>
        {/* Dealer routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/products/:spuCode" element={<ProductDetailPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="categories" element={<CategoryPage />} />
            <Route path="customers" element={<CustomerListPage />} />
            <Route path="customers/new" element={<CustomerFormPage />} />
            <Route path="customers/:id/edit" element={<CustomerFormPage />} />
            <Route path="inventory" element={<InventoryPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
