import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { API_URL } from '../config';

function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tên người dùng và mật khẩu');
      toast.error('Vui lòng nhập đầy đủ thông tin!', { position: "top-center" });
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    try {
      setError('');
      const response = await axios.post(`${API_URL}/api/login`, { username, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Đăng nhập thành công!', { position: "top-center" });
      setTimeout(() => navigate('/category'), 1000);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Đăng nhập thất bại! Vui lòng kiểm tra lại thông tin.';
      setError(errorMessage);
      toast.error(errorMessage, { position: "top-center" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="animate-fadeIn bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-3xl font-bold">WC</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Water Company</h1>
        <p className="text-gray-600 mb-8 text-center">Hệ thống quản lý công trình</p>
        <ToastContainer position="top-center" autoClose={3000} />
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
            {error}
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
            disabled={isLoading}
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
            disabled={isLoading}
          />
        </div>
        <button
          onClick={handleLogin}
          className={`w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </div>
    </div>
  );
}

export default Login;