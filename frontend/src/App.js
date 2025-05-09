import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import ProjectManagement from './pages/ProjectManagement';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { API_URL } from './config';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && typeof parsedUser === 'object') {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Kiểm tra token hợp lệ
            await axios.get(`${API_URL}/api/users`);
            setUser(parsedUser);
          } else {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Đang tải...</div>;
  }

  return (
    <div className="flex">
      {user ? (
        <>
          <Sidebar user={user} onLogout={handleLogout} />
          <div className="flex-1 ml-0 md:ml-64">
            <Routes>
              <Route path="/category" element={<ProjectManagement user={user} type="category" />} />
              <Route path="/minor-repair" element={<ProjectManagement user={user} type="minor_repair" />} />
              <Route path="/settings" element={<Settings user={user} />} />
              <Route path="*" element={<Navigate to="/category" replace />} />
            </Routes>
          </div>
        </>
      ) : (
        <Routes>
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </div>
  );
}

export default App;