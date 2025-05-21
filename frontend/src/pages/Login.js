// d:\CODE\water-company\frontend\src\pages\Login.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logo from '../assets/logo.png'; // Import logo
import { loginUser, apiClient } from '../apiService';

function Login({ setUser, initializeAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      const { token, user } = data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user)); // Lưu user vào localStorage để có thể lấy lại nếu cần
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user); // Cập nhật state user trong App.js
      toast.success('Đăng nhập thành công!', { position: "top-center" });
      // Không cần gọi initializeAuth ở đây nữa.
      // App.js sẽ tự động cập nhật user state và các query phụ thuộc khi nó re-render.
      setTimeout(() => navigate('/category'), 1000); // Chuyển hướng sau khi đăng nhập
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || 'Đăng nhập thất bại! Vui lòng kiểm tra lại thông tin.';
      toast.error(errorMessage, { position: "top-center" });
    }
  });

  const handleLogin = () => {
    if (!username || !password) {
      toast.error('Vui lòng nhập đầy đủ thông tin!', { position: "top-center" });
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="animate-fadeIn bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex justify-center mb-6">
          {/* Thay thế div chữ WC bằng logo */}
          <img
            src={logo}
            alt="LAWASUCO Logo"
            className="w-24 h-24 object-contain" // Điều chỉnh kích thước nếu cần
          />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Công ty cổ phần cấp nước tỉnh Lào Cai</h1>
        <p className="text-gray-600 mb-8 text-center">Hệ thống quản lý công trình</p>
        {loginMutation.isError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
            {loginMutation.error.response?.data?.message || 'Đăng nhập thất bại!'}
          </div>
        )}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Tên người dùng</label>
          <input
            type="text"
            placeholder="Nhập tên người dùng"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            disabled={loginMutation.isLoading}
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Mật khẩu</label>
          <input
            type="password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            disabled={loginMutation.isLoading}
          />
        </div>
        <button
          onClick={handleLogin}
          className={`w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg ${loginMutation.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={loginMutation.isLoading}
        >
          {loginMutation.isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </div>
    </div>
  );
}

export default Login;
