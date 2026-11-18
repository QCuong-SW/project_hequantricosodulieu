import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginPage from './features/auth/LoginPage';
import LogisticsDashboard from './features/dashboard/LogisticsDashboard';
import DispatcherDashboard from './features/dispatch/DispatcherDashboard';
import StationOperatorView from './features/station/StationOperatorView';
import CreateOrderPage from './features/orders/CreateOrderPage';
import OrderListPage from './features/orders/OrderListPage';
import LiveDroneMapView from './features/station/LiveDroneMapView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang đăng nhập */}
        <Route path="/login" element={<LoginPage />} />

        {/* Các trang chính được bọc trong MainLayout */}
        <Route
          path="/*"
          element={
            <MainLayout>
              <Routes>
                <Route path="dashboard" element={<LogisticsDashboard />} />
                <Route path="orders/create" element={<CreateOrderPage />} />
                <Route path="orders" element={<OrderListPage />} />
                <Route path="dispatch/drones" element={<DispatcherDashboard />} />
                <Route path="stations" element={<StationOperatorView />} />
                <Route path="tracking" element={<LiveDroneMapView />} />
                {/* Mặc định chuyển hướng về dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </MainLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}