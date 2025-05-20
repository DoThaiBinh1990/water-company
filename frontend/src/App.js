// d:\CODE\water-company\frontend\src\App.js
import React, { useState, useEffect, useCallback, Suspense } from 'react'; // Thêm Suspense
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient as useReactQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
// import ProjectManagement from './components/ProjectManagement/ProjectManagement'; // Lazy load
// import Settings from './pages/Settings'; // Lazy load
// import Login from './pages/Login'; // Lazy load
import {
  apiClient,
  getMe,
  getNotificationsByStatus as fetchNotificationsAPI,
  getProjectStatus,
  approveEditProject as approveEditAPI,
  rejectEditProject as rejectEditAPI,
  approveDeleteProject as approveDeleteAPI,
  rejectDeleteProject as rejectDeleteAPI,
} from './apiService';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css'; // <<<< THÊM DÒNG NÀY ĐỂ IMPORT APP.CSS
import './toastify-custom.css'; // Import file CSS tùy chỉnh

const ProjectManagement = React.lazy(() => import('./components/ProjectManagement/ProjectManagement'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Login = React.lazy(() => import('./pages/Login'));
const TimelineManagement = React.lazy(() => import('./components/TimelineManagement/TimelineManagement')); // Thêm Timeline Module


const socket = io(apiClient.defaults.baseURL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

function App() {
  // console.log("App component mounted. Token from localStorage:", localStorage.getItem('token')); // Nên xóa khi production

  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClientHook = useReactQueryClient();

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [currentNotificationTab, setCurrentNotificationTab] = useState('pending');
  const [showHeader, ] = useState(true); // setShowHeader was unused
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const {
    data: currentUserDataResult,
    isLoading: isLoadingUser,
    isError: isErrorUser,
    error: userErrorObject,
    // refetch: refetchUser, // Hiện không dùng
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getMe,
    enabled: !!localStorage.getItem('token'),
    retry: 1,
    onSuccess: (userData) => {
      // console.log("!!!!!! [App.js useQuery currentUser] onSuccess CALLED. UserData:", userData ? typeof userData : String(userData));
      if (userData && typeof userData === 'object') {
        const userIdField = userData._id || userData.id;
        if (userIdField || userData.username) {
          setUser(userData);
          // console.log("!!!!!! [App.js useQuery currentUser] onSuccess: setUser CALLED with valid data.");
        } else {
          // console.error("!!!!!! [App.js useQuery currentUser] onSuccess: userData is object BUT id/username MISSING. Logging out.", JSON.stringify(userData, null, 2));
          handleLogout();
        }
      } else {
        // console.error("!!!!!! [App.js useQuery currentUser] onSuccess: userData is NOT valid object or is null/undefined. Logging out. Received:", userData);
        handleLogout();
      }
      // console.log("!!!!!! [App.js useQuery currentUser] onSuccess FINISHED.");
    },
    onError: (error) => {
      // console.error('!!!!!! [App.js useQuery currentUser] onError CALLED. Error:', error.response?.data || error.message || error);
      handleLogout();
    },
    onSettled: (data, error) => {
      // console.log(
      //   "!!!!!! [App.js useQuery currentUser] onSettled CALLED. Data:", data ? "Exists" : String(data),
      //   "Error:", error ? "Exists" : String(error)
      // );
    }
  });

  const handleLogout = useCallback(() => {
    // console.trace("handleLogout called from:");
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
    setShowNotificationsModal(false);
    queryClientHook.clear();
    navigate('/login');
  }, [navigate, queryClientHook]);

  const {
    data: notifications = [],
    isLoading: isNotificationsLoading,
    refetch: refetchNotifications
  } = useQuery({
    queryKey: ['notifications', currentNotificationTab], // Query key phụ thuộc vào tab hiện tại
    queryFn: () => fetchNotificationsAPI(currentNotificationTab), // Gọi API với status tương ứng
    enabled: !!user && showNotificationsModal, // Chỉ fetch khi user đăng nhập và modal hiển thị
    onError: (error) => {
      console.error("Lỗi tải thông báo (useQuery):", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi tải thông báo!', { position: "top-center" });
    }
  });

  useEffect(() => {
    // console.log("!!!!!! [App.js useEffect for currentUserDataResult] Triggered. isLoadingUser:", isLoadingUser, "isErrorUser:", isErrorUser, "Data:", currentUserDataResult ? "Exists" : String(currentUserDataResult));
    if (!isLoadingUser) {
      if (isErrorUser) {
        // console.error("!!!!!! [App.js useEffect for currentUserDataResult] Error from query. Logging out. Error:", userErrorObject);
        handleLogout();
      } else if (currentUserDataResult) {
        if (typeof currentUserDataResult === 'object' && (currentUserDataResult._id || currentUserDataResult.id || currentUserDataResult.username)) {
          // console.log("!!!!!! [App.js useEffect for currentUserDataResult] Setting user from useEffect.");
          setUser(currentUserDataResult);
        } else {
          // console.error("!!!!!! [App.js useEffect for currentUserDataResult] Invalid user data structure from query. Logging out.", JSON.stringify(currentUserDataResult, null, 2));
          handleLogout();
        }
      } else if (!currentUserDataResult && localStorage.getItem('token')) {
        // console.error("!!!!!! [App.js useEffect for currentUserDataResult] No error, but no user data (getMe likely returned null) while token exists. Logging out.");
        handleLogout();
      }
    }
  }, [isLoadingUser, isErrorUser, currentUserDataResult, userErrorObject, handleLogout]);

  useEffect(() => {
    if (user) {
      if (!socket.connected) {
        socket.connect();
      }
      if (showNotificationsModal) {
        refetchNotifications();
      }
    } else {
      if (socket.connected) {
        socket.disconnect();
      }
    }

    const handleNewNotification = (notification) => {
      // Invalidate query cho tab hiện tại nếu modal đang mở
      if (showNotificationsModal) {
        queryClientHook.invalidateQueries(['notifications', currentNotificationTab]);
      }
      // Luôn invalidate query cho tab 'pending' nếu user có quyền approve và đó là thông báo pending
      if (user?.permissions?.approve && notification.status === 'pending') {
        queryClientHook.invalidateQueries(['notifications', 'pending']);
        toast.info(`Có yêu cầu mới: ${notification.message}`, { position: "top-right" }); // Chuyển vị trí toast
      }
    };

    const handleNotificationProcessed = (notificationId) => {
      // Invalidate query cho cả hai tab khi một thông báo được xử lý
      // (vì nó có thể chuyển từ pending sang processed)
      queryClientHook.invalidateQueries(['notifications', 'pending']);
      queryClientHook.invalidateQueries(['notifications', 'processed']);
      // Có thể thêm logic để cập nhật cache trực tiếp nếu muốn tối ưu hơn
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification_processed', handleNotificationProcessed);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification_processed', handleNotificationProcessed);
    };
  }, [user, showNotificationsModal, currentNotificationTab, refetchNotifications, queryClientHook]);


  const useProjectActionMutation = (mutationFn, successMessageKey) => {
    return useMutation({
      mutationFn,
      onSuccess: (data) => {
        toast.success(data?.message || successMessageKey || "Thao tác thành công!", { position: "top-right" });
        queryClientHook.invalidateQueries(['notifications', currentNotificationTab]);
        queryClientHook.invalidateQueries(['notifications', 'pending']);
        queryClientHook.invalidateQueries(['projects']);
        queryClientHook.invalidateQueries(['pendingProjects']);
        queryClientHook.invalidateQueries(['rejectedProjects']); // Thêm invalidate cho rejected projects
      },
      onError: (error) => {
        console.error("Lỗi hành động thông báo:", error.response?.data?.message || error.message);
        toast.error(error.response?.data?.message || 'Thao tác thất bại!', { position: "top-right" });
        queryClientHook.invalidateQueries(['notifications', currentNotificationTab]);
        queryClientHook.invalidateQueries(['notifications', 'pending']);
      },
    });
  };

  const showAppNotification = (message, type = 'info') => { // Đổi tên hàm để tránh trùng
    if (toast[type]) {
      toast[type](message, { position: "top-right" }); // Gọi hàm toast với type tương ứng
    } else {
      toast.info(message, { position: "top-right" });
    }
  };

  const approveEditMutation = useProjectActionMutation(
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
      return approveEditAPI({ projectId, type });
    },
    'Đã duyệt yêu cầu sửa công trình!'
  );

  const rejectEditMutation = useProjectActionMutation(
    async (projectId) => {
      const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu sửa:");
      if (reason === null) throw new Error("Hủy bỏ thao tác."); // User cancelled
      if (!reason || reason.trim() === "") {
        toast.error("Lý do từ chối không được để trống.", { position: "top-right" });
        throw new Error("Lý do từ chối không được để trống.");
      }
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
      return rejectEditAPI({ projectId, type, reason }); // Truyền reason
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
      const reason = prompt("Vui lòng nhập lý do từ chối yêu cầu xóa:");
      if (reason === null) throw new Error("Hủy bỏ thao tác.");
      if (!reason || reason.trim() === "") {
        toast.error("Lý do từ chối không được để trống.", { position: "top-right" });
        throw new Error("Lý do từ chối không được để trống.");
      }
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
      return rejectDeleteAPI({ projectId, type, reason }); // Truyền reason
    },
    'Đã từ chối yêu cầu xóa công trình!'
  );

  const approveEditAction = (projectId) => approveEditMutation.mutate(projectId);
  const rejectEditAction = (projectId) => rejectEditMutation.mutate(projectId);
  const approveDeleteAction = (projectId) => approveDeleteMutation.mutate(projectId);
  const rejectDeleteAction = (projectId) => rejectDeleteMutation.mutate(projectId);

  const [isProcessingNotificationAction, setIsProcessingNotificationAction] = useState(false);
  // Cập nhật isProcessingNotificationAction dựa trên trạng thái của các mutation
  useEffect(() => {
    const processing = approveEditMutation.isLoading ||
                       rejectEditMutation.isLoading ||
                       approveDeleteMutation.isLoading ||
                       rejectDeleteMutation.isLoading;
    setIsProcessingNotificationAction(processing);
  }, [
    approveEditMutation.isLoading,
    rejectEditMutation.isLoading,
    approveDeleteMutation.isLoading,
    rejectDeleteMutation.isLoading,
  ]);


  if (isLoadingUser && localStorage.getItem('token') && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="flex items-center gap-3 p-4 bg-[var(--card-bg)] rounded-lg shadow-md">
          <div className="spinner"></div>
          <span className="text-[var(--text-primary)] text-base">Đang xác thực...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer
        position="top-right" // Đổi vị trí
        autoClose={3000}    // Giảm thời gian
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"       // Hoặc "colored"
        limit={3}           // Giảm giới hạn
      />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Đang tải...</div>}>
        {user ? (
          <div className="flex min-h-screen bg-[var(--background)]">
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
                  notifications={notifications} // Truyền notifications đã fetch
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
                  setIsProcessingNotificationAction={setIsProcessingNotificationAction} // Truyền setter
                  showHeader={showHeader}
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
                          addMessage={showAppNotification} // Đổi tên hàm
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
                          addMessage={showAppNotification} // Đổi tên hàm
                        />
                      }
                    />
                    <Route path="/settings" element={<Settings user={user} />} />
                    <Route path="/timeline/*" element={<TimelineManagement user={user} addMessage={showAppNotification} />} /> {/* Thêm Route cho Timeline */}
                    <Route path="/" element={<Navigate to="/category" replace />} />
                    <Route path="*" element={<Navigate to="/category" replace />} /> {/* Hoặc trang 404 */}
                  </Routes>
                </main>
              </div>
            </>
          </div>
        ) : (
          <div className="flex min-h-screen justify-center items-center bg-[var(--background)]">
            <div className="w-full max-w-md p-6">
              <Routes>
                <Route path="/login" element={<Login setUser={setUser} />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </div>
          </div>
        )}
      </Suspense>
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}

export default App;
