import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CategoryManagement from './pages/CategoryManagement';
import MinorRepairManagement from './pages/MinorRepairManagement';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && typeof parsedUser === 'object') {
          setUser(parsedUser);
        }
      }
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex">
      {user ? (
        <>
          <Sidebar user={user} onLogout={handleLogout} />
          <div className="flex-1">
            <Routes>
              <Route path="/category" element={<CategoryManagement user={user} />} />
              <Route path="/minor-repair" element={<MinorRepairManagement user={user} />} />
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