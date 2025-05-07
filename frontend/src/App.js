import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CategoryManagement from './pages/CategoryManagement';
import MinorRepairManagement from './pages/MinorRepairManagement';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <Router>
      {user ? (
        <div className="flex">
          <Sidebar />
          <div className="flex-1">
            <div className="bg-blue-800 text-white p-4 flex justify-between items-center">
              <span>Đang sử dụng: {user.username} ({user.role})</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white p-2 rounded hover:bg-red-700"
              >
                Đăng xuất
              </button>
            </div>
            <Routes>
              <Route path="/category" element={<CategoryManagement user={user} />} />
              <Route path="/minor-repair" element={<MinorRepairManagement user={user} />} />
              <Route path="/settings" element={<Settings user={user} />} />
              <Route path="/" element={<Navigate to="/category" />} />
              <Route path="/login" element={<Navigate to="/category" />} />
            </Routes>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </Router>
  );
}

export default App;