import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Login({ setUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/login', { username, password });
      setUser(response.data.user);
      localStorage.setUser('user', JSON.stringify(response.data.user));
      toast.success('Đăng nhập thành công!');
      navigate('/category');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi đăng nhập!');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-blue-50">
      <div className="bg-white p-6 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold text-blue-800 mb-4">Đăng nhập</h2>
        <input
          type="text"
          placeholder="Tên người dùng"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-blue-300 p-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-blue-300 p-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white p-2 rounded w-full hover:bg-blue-700"
        >
          Đăng nhập
        </button>
        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </div>
  );
}

export default Login;