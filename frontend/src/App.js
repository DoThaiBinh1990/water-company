import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient as useReactQueryClient } from '@tanstack/react-query'; // Đổi tên useQueryClient để tránh xung đột
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProjectManagement from './components/ProjectManagement/ProjectManagement';
import Settings from './pages/Settings';
import Login from './pages/Login';
import {
  apiClient, // Sử dụng apiClient đã cấu hình interceptor
  getMe,
  getNotificationsByStatus as fetchNotificationsAPI,
  getProjectStatus, // API để kiểm tra trạng thái trước khi action
  approveEditProject as approveEditAPI, // Đổi tên để rõ ràng là API call
  rejectEditProject as rejectEditAPI,
  approveDeleteProject as approveDeleteAPI,
  rejectDeleteProject as rejectDeleteAPI,
} from './apiService';
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

const socket = io(apiClient.defaults.baseURL, { // Sử dụng baseURL từ apiClient
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClientHook = useReactQueryClient(); // Sử dụng tên đã đổi

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [currentNotificationTab, setCurrentNotificationTab] = useState('pending');
  const [showHeader, setShowHeader] = useState(true); // Trạng thái ẩn/hiện Header (chỉ trên mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Trạng thái ẩn/hiện Sidebar

  const { data: currentUserData, isLoading: isLoadingUser, refetch: refetchUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getMe,
    enabled: !!localStorage.getItem('token'), // Chỉ fetch khi có token
    retry: false, // Không retry nếu lỗi (thường là token invalid)
    onSuccess: (data) => {
      if (data && typeof data === 'object') {
        setUser(data);
      } else {
        // Dữ liệu user không hợp lệ, có thể token đã hết hạn ở backend nhưng vẫn hợp lệ ở client
        console.error("Dữ liệu người dùng không hợp lệ từ server", data);
        handleLogout(); // Xử lý logout
      }
    },
    onError: (error) => {
      console.error('Lỗi xác thực token (useQuery):', error);
      handleLogout(); // Xử lý logout nếu có lỗi
    }
  });

  const {
    data: notifications = [], // Mặc định là mảng rỗng
    isLoading: isNotificationsLoading,
    refetch: refetchNotifications // Hàm để fetch lại notifications
  } = useQuery({
    queryKey: ['notifications', currentNotificationTab],
    queryFn: () => fetchNotificationsAPI(currentNotificationTab),
    enabled: !!user && showNotificationsModal, // Chỉ fetch khi user đã login và modal hiển thị
    onError: (error) => {
      console.error("Lỗi tải thông báo (useQuery):", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi tải thông báo!', { position: "top-center" });
    }
  });

  const initializeAuth = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (token) {
      // Interceptor trong apiService sẽ tự động thêm token.
      // Đảm bảo apiClient có header nếu token vừa được set bởi Login.js
      if (!apiClient.defaults.headers.common['Authorization']) {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      await refetchUser(); // Gọi refetch để useQuery currentUser chạy
    } else {
      setUser(null); // Nếu không có token, set user là null
    }
  }, [refetchUser, navigate]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (user) {
      if (!socket.connected) {
        socket.connect();
      }
      if (showNotificationsModal) {
        refetchNotifications(); // Fetch lại khi modal mở hoặc tab thay đổi
      } else if (notifications.length === 0 && user.permissions?.approve) {
        // Có thể fetch 'pending' notifications ở đây nếu muốn hiển thị badge sớm
        // queryClientHook.prefetchQuery(['notifications', 'pending'], () => fetchNotificationsAPI('pending'));
      }
    } else {
      if (socket.connected) {
        socket.disconnect();
      }
    }

    const handleNewNotification = (notification) => {
      if (showNotificationsModal) {
        queryClientHook.invalidateQueries(['notifications', currentNotificationTab]);
      }
      // Luôn invalidate tab 'pending' nếu user có quyền approve và có notif mới dạng pending
      if (user?.permissions?.approve && notification.status === 'pending') {
        queryClientHook.invalidateQueries(['notifications', 'pending']);
        toast.info(`Có yêu cầu mới: ${notification.message}`, { position: "top-center" });
      }
    };

    const handleNotificationProcessed = () => {
      if (showNotificationsModal) {
        queryClientHook.invalidateQueries(['notifications', currentNotificationTab]);
      }
      queryClientHook.invalidateQueries(['notifications', 'pending']); // Invalidate tab pending
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification_processed', handleNotificationProcessed);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification_processed', handleNotificationProcessed);
    };
  }, [user, showNotificationsModal, currentNotificationTab, refetchNotifications, queryClientHook, notifications.length]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
    setShowNotificationsModal(false);
    queryClientHook.clear(); // Xóa cache của React Query khi logout
    navigate('/login');
  };

  // Hook chung cho các mutation liên quan đến project actions từ notification
  const useProjectActionMutation = (mutationFn, successMessageKey) => {
    return useMutation({
      mutationFn,
      onSuccess: (data) => {
        toast.success(data?.message || successMessageKey || "Thao tác thành công!", { position: "top-center" });
        queryClientHook.invalidateQueries(['notifications', currentNotificationTab]);
        queryClientHook.invalidateQueries(['notifications', 'pending']); // Luôn làm mới tab pending
        // Invalidate project list as well
        queryClientHook.invalidateQueries(['projects']);
        queryClientHook.invalidateQueries(['pendingProjects']);
      },
      onError: (error) => {
        console.error("Lỗi hành động thông báo:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Thao tác thất bại!', { position: "top-center" });
        queryClientHook.invalidateQueries(['notifications', currentNotificationTab]); // Làm mới để user thấy trạng thái hiện tại
        queryClientHook.invalidateQueries(['notifications', 'pending']);
      },
    });
  };

  const showNotification = (message, type = 'info') => {
    if (toast[type]) {
      toast[type](message, { position: "top-center" });
    } else {
      toast.info(message, { position: "top-center" }); // Default to info
    }
  };

  const approveEditMutation = useProjectActionMutation(
    async (projectId) => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'edit' && n.status === 'pending');
      if (!notification) {
        await queryClientHook.refetchQueries(['notifications', 'pending']); // Refetch để đảm bảo
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusData = await getProjectStatus({ projectId, type }); // Sử dụng API service
      if (!statusData.pendingEdit) {
        await queryClientHook.refetchQueries(['notifications', 'pending']);
        throw new Error("Công trình không có yêu cầu sửa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return approveEditAPI({ projectId, type }); // Sử dụng API service
    },
    'Đã duyệt yêu cầu sửa công trình!'
  );

  const rejectEditMutation = useProjectActionMutation(
    async (projectId) => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'edit' && n.status === 'pending');
      if (!notification) {
        await queryClientHook.refetchQueries(['notifications', 'pending']);
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusData = await getProjectStatus({ projectId, type });
      if (!statusData.pendingEdit) {
        await queryClientHook.refetchQueries(['notifications', 'pending']);
        throw new Error("Công trình không có yêu cầu sửa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return rejectEditAPI({ projectId, type });
    },
    'Đã từ chối yêu cầu sửa công trình!'
  );

  const approveDeleteMutation = useProjectActionMutation(
    async (projectId) => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'delete' && n.status === 'pending');
      if (!notification) {
        await queryClientHook.refetchQueries(['notifications', 'pending']);
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusData = await getProjectStatus({ projectId, type });
      if (!statusData.pendingDelete) {
        await queryClientHook.refetchQueries(['notifications', 'pending']);
        throw new Error("Công trình không có yêu cầu xóa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return approveDeleteAPI({ projectId, type });
    },
    'Đã duyệt yêu cầu xóa và xóa công trình!'
  );

  const rejectDeleteMutation = useProjectActionMutation(
    async (projectId) => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'delete' && n.status === 'pending');
      if (!notification) {
        await queryClientHook.refetchQueries(['notifications', 'pending']);
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusData = await getProjectStatus({ projectId, type });
      if (!statusData.pendingDelete) {
        await queryClientHook.refetchQueries(['notifications', 'pending']);
        throw new Error("Công trình không có yêu cầu xóa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return rejectDeleteAPI({ projectId, type });
    },
    'Đã từ chối yêu cầu xóa công trình!'
  );

  // Các hàm action gọi mutate
  const approveEditAction = (projectId) => approveEditMutation.mutate(projectId);
  const rejectEditAction = (projectId) => rejectEditMutation.mutate(projectId);
  const approveDeleteAction = (projectId) => approveDeleteMutation.mutate(projectId);
  const rejectDeleteAction = (projectId) => rejectDeleteMutation.mutate(projectId);

  // Trạng thái loading chung cho các action từ notification
  const isProcessingNotificationAction =
    approveEditMutation.isLoading ||
    rejectEditMutation.isLoading ||
    approveDeleteMutation.isLoading ||
    rejectDeleteMutation.isLoading;

  // Hiển thị loading khi đang xác thực token và có token trong localStorage
  if (isLoadingUser && localStorage.getItem('token')) {
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
            <Sidebar
              user={user}
              onLogout={handleLogout}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header
                user={user}
                notifications={notifications}
                showNotificationsModal={showNotificationsModal}
                setShowNotificationsModal={setShowNotificationsModal}
                fetchNotificationsByStatus={refetchNotifications} // Truyền hàm refetch
                currentNotificationTab={currentNotificationTab}
                setCurrentNotificationTab={setCurrentNotificationTab}
                isNotificationsLoading={isNotificationsLoading}
                approveEditAction={approveEditAction}
                rejectEditAction={rejectEditAction}
                approveDeleteAction={approveDeleteAction}
                rejectDeleteAction={rejectDeleteAction}
                isProcessingNotificationAction={isProcessingNotificationAction}
                setIsProcessingNotificationAction={() => {}} // No longer directly setting this state from Header
                showHeader={showHeader}
                // toggleHeader={() => setShowHeader(!showHeader)} // This was removed from Header props
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
              />
              <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-[var(--background)] p-6 md:p-8 lg:p-10 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-16'} ${showHeader ? 'pt-16 md:pt-12' : 'pt-0 md:pt-12'}`}>
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
                  {/* Cho phép tất cả user truy cập /settings. 
                      Logic hiển thị nội dung trong Settings.js sẽ dựa vào vai trò của user.
                  */}
                  <Route path="/settings" element={<Settings user={user} />} />
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
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}

export default App;
