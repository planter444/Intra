import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import EmployeesPage from './pages/EmployeesPage';
import LeavesPage from './pages/LeavesPage';
import LeaveApplyPage from './pages/LeaveApplyPage';
import LeaveRequestDetailPage from './pages/LeaveRequestDetailPage';
import DocumentsPage from './pages/DocumentsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SettingsPage from './pages/SettingsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import NotFoundPage from './pages/NotFoundPage';

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function LandingRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user?.role === 'employee' ? '/profile' : '/dashboard'} replace />;
}

export default function App() {
  const { loading, isAuthenticated } = useAuth();

  if (loading && isAuthenticated) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo']}><DashboardPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo']}><ProfilePage /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute allowedRoles={['supervisor', 'admin', 'ceo']}><EmployeesPage /></ProtectedRoute>} />
      <Route path="/leaves" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo']}><LeavesPage /></ProtectedRoute>} />
      <Route path="/leaves/new" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin']}><LeaveApplyPage /></ProtectedRoute>} />
      <Route path="/leaves/:id" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo']}><LeaveRequestDetailPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo']}><DocumentsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'ceo']}><SettingsPage /></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogsPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
