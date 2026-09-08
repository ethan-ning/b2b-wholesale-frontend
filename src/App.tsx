import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import ProductDetailPage from './pages/ProductDetailPage';

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/products/:spuCode" element={<ProductDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}
