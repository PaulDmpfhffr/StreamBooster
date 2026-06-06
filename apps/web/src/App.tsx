import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Keys from './pages/Keys';
import Billing from './pages/Billing';
import Usage from './pages/Usage';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<AuthLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/keys" element={<Keys />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/usage" element={<Usage />} />
        <Route path="/admin" element={<Admin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
