import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Navbar from './components/Navbar';

import Sidebar from './components/Sidebar';

export default function App() {
  const [credentials, setCredentials] = useState(() => {
    const saved = localStorage.getItem('admin_credentials');
    return saved ? JSON.parse(saved) : null;
  });

  // Track if the sidebar is open or closed
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const ProtectedLayout = () => {
    if (!credentials) {
      return <Navigate to="/login" replace />;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Navbar
          setCredentials={setCredentials}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar isOpen={isSidebarOpen} />
          <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: '#f9fafb' }}>
            <Outlet />
          </main>
        </div>
      </div>
    );
  };

  // React Router handles rendering different components based on the URL
  return (
    <BrowserRouter>
      <Routes>
        {/* The Login page gets the setter so it can save the credentials once verified */}
        <Route
          path="/login"
          element={
            credentials ? <Navigate to="/dashboard" /> : <Login setCredentials={setCredentials} />
          }
        />

        <Route element={<ProtectedLayout />}>
          <Route
            path="/dashboard"
            element={<Dashboard credentials={credentials} setCredentials={setCredentials} />}
          />
          <Route
            path="/settings"
            element={<Settings credentials={credentials} />}
          />
        </Route>

        {/* If the user types any other URL, redirect them to the dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
