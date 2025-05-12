// frontend/src/App.js
import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProjectManagement from './pages/ProjectManagement';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { API_URL } from './config';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Hàm debounce
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false); // Thêm state Dark Mode
  const [searchQuery, setSearchQuery] = useState(''); // Thêm state cho tìm kiếm
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [currentNotificationTab, setCurrentNotificationTab] = useState('pending');
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isProcessingNotificationAction, setIsProcessingNotificationAction] = useState(false);
  const [showHeader, setShowHeader] = useState(true); // Quản lý ẩn/hiện header

  const fetchNotificationsByStatus = useCallback(async (status) => {
    if (!user?.permissions?.approve) {
      setNotifications([]);
      return;
    }
    setIsNotificationsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/notifications?status=${status}`);
      setNotifications(res.data);
    } catch (error) {
      console.error("Lỗi tải thông báo:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi tải thông báo!', { position: "top-center" });
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [user?.permissions?.approve]);

  // Debounce fetchNotificationsByStatus
  const debouncedFetchNotifications = useCallback(
    debounce((status) => fetchNotificationsByStatus(status), 300),
    [fetchNotificationsByStatus]
  );

  const initializeAuth = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const response = await axios.get(`${API_URL}/api/auth/me`);
        const freshUser = response.data.user;
        if (freshUser && typeof freshUser === 'object') {
          setUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser));
          if (freshUser.permissions?.approve) {
            debouncedFetchNotifications('pending');
          }
        } else {
          throw new Error("Dữ liệu người dùng không hợp lệ từ server");
        }
      } catch (error) {
        console.error('Lỗi xác thực token hoặc lấy thông tin người dùng:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        navigate('/login');
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [debouncedFetchNotifications, navigate]);

    useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (user) {
      socket.connect();
      if (user.permissions?.approve) {
        if (showNotificationsModal) {
          debouncedFetchNotifications(currentNotificationTab);
        } else if (!notifications.length) {
          debouncedFetchNotifications('pending');
        }
      }
    } else {
      socket.disconnect();
      setNotifications([]);
    }

    const handleNewNotification = (notification) => {
      if (user?.permissions?.approve && notification.status === 'pending') {
        setNotifications(prev => [notification, ...prev.filter(n => n._id !== notification._id)]);
      }
      toast.info(`${notification.message}${notification.projectId?.name ? ` cho CT "${notification.projectId.name}"` : ''}`, { position: "bottom-right", autoClose: 7000 });
      if (user?.permissions?.approve && showNotificationsModal && currentNotificationTab === 'pending') {
        debouncedFetchNotifications('pending');
      }
    };

    const handleNotificationProcessed = (notificationId) => {
      if (user?.permissions?.approve) {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        if (showNotificationsModal) {
          debouncedFetchNotifications(currentNotificationTab);
        }
      }
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification_processed', handleNotificationProcessed);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification_processed', handleNotificationProcessed);
    };
  }, [user, showNotificationsModal, currentNotificationTab, debouncedFetchNotifications]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setNotifications([]);
    setShowNotificationsModal(false);
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const response = await axios.get(`${API_URL}/api/projects/search?q=${searchQuery}`);
      navigate('/category', { state: { searchResults: response.data } });
    } catch (error) {
      toast.error('Lỗi tìm kiếm: ' + (error.response?.data?.message || error.message), { position: "top-center" });
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`${API_URL}/api/notifications/mark-all-read`);
      setNotifications([]);
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc!', { position: "top-center" });
    } catch (error) {
      toast.error('Lỗi: ' + (error.response?.data?.message || error.message), { position: "top-center" });
    }
  };

  const handleNotificationAction = async (actionPromise, successMessage) => {
    if (isProcessingNotificationAction) return;
    setIsProcessingNotificationAction(true);
    try {
      const response = await actionPromise();
      toast.success(successMessage || response?.data?.message || "Thao tác thành công!", { position: "top-center" });
      debouncedFetchNotifications(currentNotificationTab);
    } catch (error) {
      console.error("Lỗi hành động thông báo:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
    } finally {
      setIsProcessingNotificationAction(false);
    }
  };

  const approveEditAction = (projectId) => handleNotificationAction(
    () => {
      const notification = notifications.find(n => n.projectId._id === projectId && n.type === 'edit' && n.status === 'pending');
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      return axios.patch(`${API_URL}/api/projects/${projectId}/approve-edit?type=${type}`);
    },
    'Đã duyệt yêu cầu sửa công trình!'
  );

  const rejectEditAction = (projectId) => handleNotificationAction(
    () => {
      const notification = notifications.find(n => n.projectId._id === projectId && n.type === 'edit' && n.status === 'pending');
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      return axios.patch(`${API_URL}/api/projects/${projectId}/reject-edit?type=${type}`);
    },
    'Đã từ chối yêu cầu sửa công trình!'
  );

  const approveDeleteAction = (projectId) => handleNotificationAction(
    () => {
      const notification = notifications.find(n => n.projectId._id === projectId && n.type === 'delete' && n.status === 'pending');
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      return axios.patch(`${API_URL}/api/projects/${projectId}/approve-delete?type=${type}`);
    },
    'Đã duyệt yêu cầu xóa và xóa công trình!'
  );

  const rejectDeleteAction = (projectId) => handleNotificationAction(
    () => {
      const notification = notifications.find(n => n.projectId._id === projectId && n.type === 'delete' && n.status === 'pending');
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      return axios.patch(`${API_URL}/api/projects/${projectId}/reject-delete?type=${type}`);
    },
    'Đã từ chối yêu cầu xóa công trình!'
  );

    if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-xl bg-gray-100">Đang tải ứng dụng...</div>;
  }

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={darkMode ? "dark" : "light"}
      />
      <div className={`flex h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'} ${user ? '' : 'justify-center items-center'}`}>
        {user ? (
          <>
            <Sidebar user={user} onLogout={handleLogout} toggleDarkMode={toggleDarkMode} darkMode={darkMode} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header
                className="header"
                user={user}
                notifications={notifications}
                setNotifications={setNotifications}
                showNotificationsModal={showNotificationsModal}
                setShowNotificationsModal={setShowNotificationsModal}
                fetchNotificationsByStatus={fetchNotificationsByStatus}
                currentNotificationTab={currentNotificationTab}
                setCurrentNotificationTab={setCurrentNotificationTab}
                isNotificationsLoading={isNotificationsLoading}
                approveEditAction={approveEditAction}
                rejectEditAction={rejectEditAction}
                approveDeleteAction={approveDeleteAction}
                rejectDeleteAction={rejectDeleteAction}
                isProcessingNotificationAction={isProcessingNotificationAction}
                setIsProcessingNotificationAction={setIsProcessingNotificationAction}
                showHeader={showHeader}
                toggleHeader={() => setShowHeader(!showHeader)}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={handleSearch}
                markAllAsRead={markAllAsRead}
              />
              <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-800 p-4 md:p-6 lg:p-8 md:ml-64">
                <Routes>
                  <Route path="/category" element={<ProjectManagement user={user} type="category" showHeader={showHeader} />} />
                  <Route path="/minor-repair" element={<ProjectManagement user={user} type="minor_repair" showHeader={showHeader} />} />
                  <Route path="/settings" element={<Settings user={user} />} />
                  <Route path="/" element={<Navigate to="/category" replace />} />
                  <Route path="*" element={<Navigate to="/category" replace />} />
                </Routes>
              </main>
            </div>
          </>
        ) : (
          <div className="w-full max-w-md">
            <Routes>
              <Route path="/login" element={<Login setUser={setUser} initializeAuth={initializeAuth} />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        )}
      </div>
    </>
  );
}

export default App;