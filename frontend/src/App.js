import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } // Thêm useNavigate nếu cần trong handleLogout
  from 'react-router-dom';
import axios from 'axios';
import Sidebar from './components/Sidebar'; // Kiểm tra đường dẫn này
import ProjectManagement from './pages/ProjectManagement'; // Kiểm tra đường dẫn này
import Settings from './pages/Settings'; // Kiểm tra đường dẫn này
import Login from './pages/Login'; // Kiểm tra đường dẫn này
import { API_URL } from './config'; // Kiểm tra đường dẫn này
// import './App.css'; // Xóa dòng này nếu App.css không có style quan trọng

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Hook của react-router-dom v6

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && typeof parsedUser === 'object') {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Thay vì gọi /api/users, bạn có thể tạo một endpoint riêng để xác thực token, ví dụ /api/auth/verify
            // Hoặc, nếu /api/users yêu cầu quyền admin, nó sẽ thất bại nếu user không phải admin.
            // Để đơn giản, tạm thời có thể bỏ qua bước verify token ở đây nếu nó phức tạp,
            // hoặc đảm bảo endpoint bạn gọi phù hợp với mọi user đã đăng nhập.
            // Ví dụ:
            // await axios.get(`${API_URL}/api/auth/me`); // Giả sử có endpoint này
            setUser(parsedUser);
          } else {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
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
    navigate('/login'); // Dùng navigate của v6
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-xl">Đang tải ứng dụng...</div>;
  }

  return (
    <div className="flex">
      {user ? (
        <>
          <Sidebar user={user} onLogout={handleLogout} />
          <div className="flex-1 ml-0 md:ml-64 p-4 md:p-8 bg-gray-100 min-h-screen"> {/* Thêm padding và bg */}
            <Routes>
              <Route path="/category" element={<ProjectManagement user={user} type="category" />} />
              <Route path="/minor-repair" element={<ProjectManagement user={user} type="minor_repair" />} />
              <Route path="/settings" element={<Settings user={user} />} />
              {/* Điều hướng mặc định nếu đã đăng nhập */}
              <Route path="/" element={<Navigate to="/category" replace />} />
              <Route path="*" element={<Navigate to="/category" replace />} />
            </Routes>
          </div>
        </>
      ) : (
        <Routes>
          <Route path="/login" element={<Login setUser={setUser} />} />
          {/* Điều hướng tất cả về login nếu chưa đăng nhập */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </div>
  );
}

export default App;