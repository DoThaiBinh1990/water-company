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
import './toastify-custom.css';

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
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [currentNotificationTab, setCurrentNotificationTab] = useState('pending');
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isProcessingNotificationAction, setIsProcessingNotificationAction] = useState(false);
  const [showHeader, setShowHeader] = useState(true);

  const fetchNotificationsByStatus = useCallback(async (status) => {
    setIsNotificationsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/notifications?status=${status}`);
      setNotifications(res.data || []);
    } catch (error) {
      console.error("Lỗi tải thông báo:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi tải thông báo!', { position: "top-center" });
      setNotifications([]);
    } finally {
      setIsNotificationsLoading(false);
    }
  }, []);

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
          debouncedFetchNotifications('pending');
        } else {
          throw new Error("Dữ liệu người dùng không hợp lệ từ server");
        }
      } catch (error) {
        console.error('Lỗi xác thực token:', error);
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
      if (!socket.connected) {
        socket.connect();
      }
      if (showNotificationsModal) {
        fetchNotificationsByStatus(currentNotificationTab);
      } else if (!notifications.length) {
        // Initial fetch handled by initializeAuth
      }
    } else {
      if (socket.connected) {
        socket.disconnect();
      }
      setNotifications([]);
    }

    const handleNewNotification = (notification) => {
      // Hiển thị thông báo cho cả tài khoản cấp thấp và cấp cao
      if (notification.status === 'pending' && user?.permissions?.approve) {
        setNotifications(prev => [notification, ...prev.filter(n => n._id !== notification._id)]);
      } else if (notification.status === 'processed' && notification.userId?.toString() === user?._id?.toString()) {
        setNotifications(prev => [notification, ...prev.filter(n => n._id !== notification._id)]);
      }
      if (showNotificationsModal) {
        fetchNotificationsByStatus(currentNotificationTab);
      }
    };

    const handleNotificationProcessed = () => {
      if (showNotificationsModal) {
        fetchNotificationsByStatus(currentNotificationTab);
      }
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification_processed', handleNotificationProcessed);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification_processed', handleNotificationProcessed);
    };
  }, [user, showNotificationsModal, currentNotificationTab, fetchNotificationsByStatus]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setNotifications([]);
    setShowNotificationsModal(false);
    navigate('/login');
  };

  const handleNotificationAction = async (actionPromise, successMessage) => {
    if (isProcessingNotificationAction) return;
    setIsProcessingNotificationAction(true);
    try {
      const response = await actionPromise();
      toast.success(successMessage || response?.data?.message || "Thao tác thành công!", { position: "top-center" });
      // Làm mới danh sách thông báo sau khi xử lý
      fetchNotificationsByStatus(currentNotificationTab);
    } catch (error) {
      console.error("Lỗi hành động thông báo:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
      // Làm mới danh sách thông báo để đảm bảo dữ liệu chính xác
      fetchNotificationsByStatus(currentNotificationTab);
    } finally {
      setIsProcessingNotificationAction(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    toast[type](message, {
      position: "top-center",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "light",
    });
  };

  const approveEditAction = (projectId) => handleNotificationAction(
    async () => {
      // Kiểm tra trạng thái công trình trước
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'edit' && n.status === 'pending');
      if (!notification) {
        await fetchNotificationsByStatus('pending');
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusRes = await axios.get(`${API_URL}/api/projects/${projectId}/status?type=${type}`);
      if (!statusRes.data.pendingEdit) {
        await fetchNotificationsByStatus('pending');
        throw new Error("Công trình không có yêu cầu sửa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return axios.patch(`${API_URL}/api/projects/${projectId}/approve-edit?type=${type}`);
    },
    'Đã duyệt yêu cầu sửa công trình!'
  );

  const rejectEditAction = (projectId) => handleNotificationAction(
    async () => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'edit' && n.status === 'pending');
      if (!notification) {
        await fetchNotificationsByStatus('pending');
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusRes = await axios.get(`${API_URL}/api/projects/${projectId}/status?type=${type}`);
      if (!statusRes.data.pendingEdit) {
        await fetchNotificationsByStatus('pending');
        throw new Error("Công trình không có yêu cầu sửa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return axios.patch(`${API_URL}/api/projects/${projectId}/reject-edit?type=${type}`);
    },
    'Đã từ chối yêu cầu sửa công trình!'
  );

  const approveDeleteAction = (projectId) => handleNotificationAction(
    async () => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'delete' && n.status === 'pending');
      if (!notification) {
        await fetchNotificationsByStatus('pending');
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusRes = await axios.get(`${API_URL}/api/projects/${projectId}/status?type=${type}`);
      if (!statusRes.data.pendingDelete) {
        await fetchNotificationsByStatus('pending');
        throw new Error("Công trình không có yêu cầu xóa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return axios.patch(`${API_URL}/api/projects/${projectId}/approve-delete?type=${type}`);
    },
    'Đã duyệt yêu cầu xóa và xóa công trình!'
  );

  const rejectDeleteAction = (projectId) => handleNotificationAction(
    async () => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'delete' && n.status === 'pending');
      if (!notification) {
        await fetchNotificationsByStatus('pending');
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusRes = await axios.get(`${API_URL}/api/projects/${projectId}/status?type=${type}`);
      if (!statusRes.data.pendingDelete) {
        await fetchNotificationsByStatus('pending');
        throw new Error("Công trình không có yêu cầu xóa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return axios.patch(`${API_URL}/api/projects/${projectId}/reject-delete?type=${type}`);
    },
    'Đã từ chối yêu cầu xóa công trình!'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="flex items-center gap-3 p-4 bg-[var(--card-bg)] rounded-lg shadow-md">
          <div className="spinner"></div>
          <span className="text-[var(--text-primary)] text-base">Đang tải ứng dụng...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        limit={5}
      />
      <div className={`flex min-h-screen ${user ? 'bg-[var(--background)]' : 'justify-center items-center bg-[var(--background)]'}`}>
        {user ? (
          <>
            <Sidebar user={user} onLogout={handleLogout} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header
                user={user}
                notifications={notifications}
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
              />
              <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-[var(--background)] p-6 md:p-8 lg:p-10 md:ml-64 transition-all duration-300 ${showHeader ? 'pt-16 md:pt-0' : 'pt-4'}`}>
                <Routes>
                  <Route
                    path="/category"
                    element={
                      <ProjectManagement
                        user={user}
                        type="category"
                        showHeader={showHeader}
                        addMessage={showNotification}
                      />
                    }
                  />
                  <Route
                    path="/minor-repair"
                    element={
                      <ProjectManagement
                        user={user}
                        type="minor_repair"
                        showHeader={showHeader}
                        addMessage={showNotification}
                      />
                    }
                  />
                  <Route path="/settings" element={user.permissions?.approve ? <Settings user={user} /> : <Navigate to="/" replace />} />
                  <Route path="/" element={<Navigate to="/category" replace />} />
                  <Route path="*" element={<Navigate to="/category" replace />} />
                </Routes>
              </main>
            </div>
          </>
        ) : (
          <div className="w-full max-w-md bg-[var(--background)] p-6">
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