// d:\CODE\water-company\frontend\src\App.js
import React, { useState, useEffect, useCallback, Suspense } from 'react'; // Thêm Suspense
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'; // Thêm useLocation vào đây
import { useQuery, useMutation, useQueryClient as useReactQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Sidebar from './components/Sidebar'; // useLocation is used here, but we need it in App.js too
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
  approveProject as approveNewProjectAPI, // Thêm API cho approve new
  rejectProject as rejectNewProjectAPI,   // Thêm API cho reject new
  approveDeleteProject as approveDeleteAPI,
  rejectDeleteProject as rejectDeleteAPI,
  // apiClient as apiClientInstance // Đã có ở dưới
  apiClient as apiClientInstance // Đổi tên để tránh trùng với apiClient từ apiService
} from './apiService';
import io from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css'; // Import App.css
import './toastify-custom.css'; // Import file CSS tùy chỉnh

const ProjectManagement = React.lazy(() => import('./components/ProjectManagement/ProjectManagement'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Login = React.lazy(() => import('./pages/Login'));
const TimelineManagement = React.lazy(() => import('./components/TimelineManagement/TimelineManagement')); // Thêm Timeline Module


const socket = io(apiClientInstance.defaults.baseURL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false,
});

function App() {
  // console.log("App component mounted. Token from localStorage:", localStorage.getItem('token')); // Nên xóa khi production
  const location = useLocation(); // Lấy đối tượng location hiện tại

  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClientHook = useReactQueryClient();

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  // const [currentNotificationTab, setCurrentNotificationTab] = useState('pending'); // Bỏ tab
  const [showHeader, ] = useState(true); // setShowHeader was unused
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // State để giới hạn toast
  const [lastToastTime, setLastToastTime] = useState(0);
  const MIN_TOAST_INTERVAL = 5000; // 5 giây
  const {
    data: currentUserDataResult,
    isLoading: isLoadingUser,
    isError: isErrorUser,
    error: userErrorObject,
    // refetch: refetchUser, // Hiện không dùng
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getMe,
    enabled: (() => {
      const token = localStorage.getItem('token');
      // Chỉ enabled query nếu token tồn tại và không phải là chuỗi "null" hoặc "undefined"
      return !!(token && token !== 'null' && token !== 'undefined');
    })(),
    retry: 1,
    onSuccess: (userData) => {
      // Logic setUser sẽ được xử lý trong useEffect bên dưới
      // để đảm bảo xử lý nhất quán cả khi query thành công hoặc có dữ liệu từ cache.
      // console.log("!!!!!! [App.js useQuery currentUser] onSuccess CALLED. UserData:", userData ? typeof userData : String(userData));
    },
    onError: (error) => {
      // Logic logout cũng sẽ được xử lý trong useEffect
      // console.error('!!!!!! [App.js useQuery currentUser] onError CALLED. Error:', error.response?.data || error.message || error);
    },
    onSettled: (data, error) => {
      // console.log(
      //   "!!!!!! [App.js useQuery currentUser] onSettled CALLED. Data:", data ? "Exists" : String(data),
      //   "Error:", error ? "Exists" : String(error)
      // );
    }
  });

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    delete apiClientInstance.defaults.headers.common['Authorization'];
    setUser(null);
    setShowNotificationsModal(false);
    queryClientHook.clear();
    navigate('/login');
  }, [navigate, queryClientHook]);

  const {
    data: notifications = [],
    isLoading: isNotificationsLoading,
    refetch: refetchNotifications // Giữ lại refetchNotifications nếu cần gọi thủ công ở đâu đó
  } = useQuery({
    queryKey: ['notificationsForAllRelevantToUser'],
    queryFn: () => fetchNotificationsAPI(),
    enabled: !!user, // Query sẽ chạy ngầm khi user đăng nhập để cập nhật chuông thông báo
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
      } else if (!currentUserDataResult && localStorage.getItem('token') && (localStorage.getItem('token') !== 'null' && localStorage.getItem('token') !== 'undefined')) {
        // console.error("!!!!!! [App.js useEffect for currentUserDataResult] No error, but no user data (getMe likely returned null or invalid) while token exists. Logging out.");
        handleLogout();
      }
    }
  }, [isLoadingUser, isErrorUser, currentUserDataResult, userErrorObject, handleLogout]);

  // Effect for socket connection management based on user state
  useEffect(() => {
    if (user) {
      if (!socket.connected) {
        socket.connect();
      }
    } else {
      if (socket.connected) {
        socket.disconnect();
      }
    }
  }, [user]); // Dependency là user

  // Effect for socket event listeners
  useEffect(() => {
    if (!user) { // Không thiết lập listeners nếu không có user
      socket.off('notification');
      socket.off('notification_processed');
      return;
    }

    const handleNewNotification = (notification) => {
      // Luôn invalidate query để cập nhật số đếm trên chuông và danh sách
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });

      // Logic hiển thị toast
      let shouldToast = false;
      let toastMessage = notification.message; // Mặc định lấy message từ backend
      
      if (user) { // Đảm bảo user object tồn tại
        if (notification.status === 'pending' && notification.projectId && ['new', 'edit', 'delete'].includes(notification.type)) {
          // Case 1: User hiện tại là người gửi yêu cầu này
          if (notification.userId?._id === user.id) {
            // Và yêu cầu này không phải là tự gửi cho chính mình để duyệt (trừ khi user không có quyền duyệt)
            if (notification.recipientId !== user.id || (notification.recipientId === user.id && !user.permissions?.approve)) {
              shouldToast = true;
              if (notification.type === 'new') toastMessage = `Yêu cầu tạo công trình "${notification.projectId?.name || 'mới'}" của bạn đang chờ duyệt.`;
              else if (notification.type === 'edit') toastMessage = `Yêu cầu sửa công trình "${notification.projectId?.name || ''}" của bạn đang chờ duyệt.`;
              else if (notification.type === 'delete') toastMessage = `Yêu cầu xóa công trình "${notification.projectId?.name || ''}" của bạn đang chờ duyệt.`;
            } else if (user.permissions?.approve && (notification.recipientId === user.id || !notification.recipientId)) {
              // Sender cũng là approver và thông báo này là cho họ duyệt (hoặc chung) -> dùng message gốc
              shouldToast = true;
            }
          }
          // Case 2: User hiện tại là người duyệt (và không phải người gửi)
          else if (user.permissions?.approve && (notification.recipientId === user.id || !notification.recipientId)) {
            shouldToast = true; // Dùng message gốc từ backend
          }
        } 
        // Case 3: User hiện tại là người gửi và yêu cầu của họ đã được xử lý
        else if (notification.userId?._id === user.id && notification.status === 'processed') {
          shouldToast = true; // Dùng message gốc từ backend
        }
      }

      if (shouldToast) {
        const now = Date.now();
        if (now - lastToastTime > MIN_TOAST_INTERVAL) {
          toast.info(toastMessage, { position: "top-right" });
          setLastToastTime(now);
        }
      }
    };
    
    const handleNotificationProcessed = (notificationId) => {
      // Invalidate query khi một thông báo được xử lý
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification_processed', handleNotificationProcessed);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification_processed', handleNotificationProcessed);
    };
  }, [user, queryClientHook, lastToastTime, MIN_TOAST_INTERVAL]);

  // Effect để cập nhật tiêu đề tab trình duyệt dựa trên route
  useEffect(() => {
    const baseTitle = "Lawasuco"; // Tiêu đề gốc
    let pageTitle = "";

    // Ánh xạ đường dẫn tới tiêu đề trang
    if (location.pathname === '/' || location.pathname.startsWith('/category')) {
        pageTitle = "Công trình Danh mục";
    } else if (location.pathname.startsWith('/minor-repair')) {
        pageTitle = "Sửa chữa nhỏ";
    } else if (location.pathname.startsWith('/timeline')) {
        pageTitle = "Quản lý Timeline";
    } else if (location.pathname.startsWith('/settings')) {
        pageTitle = "Thiết lập";
    } else if (location.pathname.startsWith('/login')) {
        pageTitle = "Đăng nhập";
    }
    // Thêm các đường dẫn khác nếu có

    // Cập nhật tiêu đề document
    document.title = pageTitle ? `${pageTitle} - ${baseTitle}` : baseTitle;

  }, [location.pathname]); // Chạy lại effect mỗi khi đường dẫn thay đổi


  const useProjectActionMutation = (mutationFn, successMessageKey) => {
    return useMutation({
      mutationFn,
      onSuccess: (data) => {
        toast.success(data?.message || successMessageKey || "Thao tác thành công!", { position: "top-right" });
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        queryClientHook.invalidateQueries({ queryKey: ['projects'] });
        queryClientHook.invalidateQueries({ queryKey: ['pendingProjects'] });
        queryClientHook.invalidateQueries({ queryKey: ['rejectedProjects'] }); // Thêm invalidate cho rejected projects
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Thao tác thất bại!';
        console.error("Lỗi hành động thông báo:", errorMessage);
        // Kiểm tra xem lỗi có phải do thông báo/công trình đã được xử lý không
        if (errorMessage.includes("không tồn tại hoặc đã được xử lý") || errorMessage.includes("không có yêu cầu")) {
          toast.info("Thông báo này có thể đã được xử lý. Đang làm mới danh sách...", { position: "top-right" });
        } else {
          toast.error(errorMessage, { position: "top-right" });
        }
        // Luôn invalidate notifications để cập nhật UI
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        queryClientHook.invalidateQueries({ queryKey: ['projects'] });
        queryClientHook.invalidateQueries({ queryKey: ['pendingProjects'] });
        queryClientHook.invalidateQueries({ queryKey: ['rejectedProjects'] });
      },
    });
  };

  const showAppNotification = (message, type = 'info') => { // Đổi tên hàm để tránh trùng
    if (toast[type]) {
      toast[type](message, { position: "top-right" });
    } else {
      toast.info(message, { position: "top-right" });
    }
  };

  const approveEditMutation = useProjectActionMutation(
    async (projectId) => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'edit' && n.status === 'pending');
      if (!notification) {
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusData = await getProjectStatus({ projectId, type });
      if (!statusData.pendingEdit) {
        await queryClientHook.refetchQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
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
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusData = await getProjectStatus({ projectId, type });
      if (!statusData.pendingEdit) {
        await queryClientHook.refetchQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        throw new Error("Công trình không có yêu cầu sửa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return rejectEditAPI({ projectId, type, reason }); // Truyền reason
    },
    'Đã từ chối yêu cầu sửa công trình!'
  );

  const approveNewProjectMutation = useProjectActionMutation(
    async (projectId) => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'new' && n.status === 'pending');
      if (!notification) {
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      // Không cần kiểm tra statusData cho 'new' vì nó luôn là 'Chờ duyệt' nếu thông báo tồn tại
      return approveNewProjectAPI({ projectId, type });
    },
    'Đã duyệt công trình mới!'
  );

  const rejectNewProjectMutation = useProjectActionMutation(
    async (projectId) => {
      const reason = prompt("Vui lòng nhập lý do từ chối công trình mới:");
      if (reason === null) throw new Error("Hủy bỏ thao tác.");
      if (!reason || reason.trim() === "") {
        toast.error("Lý do từ chối không được để trống.", { position: "top-right" });
        throw new Error("Lý do từ chối không được để trống.");
      }
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'new' && n.status === 'pending');
      if (!notification) {
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      return rejectNewProjectAPI({ projectId, type, reason });
    },
    'Đã từ chối công trình mới!'
  );

  const approveDeleteMutation = useProjectActionMutation(
    async (projectId) => {
      const notification = notifications.find(n => n.projectId?._id === projectId && n.type === 'delete' && n.status === 'pending');
      if (!notification) {
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusData = await getProjectStatus({ projectId, type });
      if (!statusData.pendingDelete) {
        await queryClientHook.refetchQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
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
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        throw new Error("Thông báo không tồn tại hoặc đã được xử lý. Danh sách thông báo đã được làm mới.");
      }
      const type = notification.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      const statusData = await getProjectStatus({ projectId, type });
      if (!statusData.pendingDelete) {
        await queryClientHook.refetchQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        throw new Error("Công trình không có yêu cầu xóa đang chờ duyệt. Danh sách thông báo đã được làm mới.");
      }
      return rejectDeleteAPI({ projectId, type, reason }); // Truyền reason
    },
    'Đã từ chối yêu cầu xóa công trình!'
  );

  const approveNewProjectAction = (projectId) => approveNewProjectMutation.mutate(projectId);
  const rejectNewProjectAction = (projectId) => rejectNewProjectMutation.mutate(projectId);
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
                       rejectDeleteMutation.isLoading ||
                       approveNewProjectMutation.isLoading ||
                       rejectNewProjectMutation.isLoading;
    setIsProcessingNotificationAction(processing);
  }, [
    approveNewProjectMutation.isLoading, rejectNewProjectMutation.isLoading,
    approveEditMutation.isLoading,
    rejectEditMutation.isLoading,
    approveDeleteMutation.isLoading,
    rejectDeleteMutation.isLoading,
  ]);

  const markNotificationAsProcessedMutation = useMutation({
    mutationFn: (notificationId) => apiClientInstance.patch(`/api/notifications/${notificationId}/read`), // Sử dụng endpoint đã có
    onSuccess: (data) => {
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Lỗi khi đánh dấu thông báo!', { position: "top-right" });
    }
  });

  const handleMarkNotificationAsProcessed = (notificationId) => {
    markNotificationAsProcessedMutation.mutate(notificationId);
  };

  const markAllNotificationsAsProcessedMutation = useMutation({
    mutationFn: () => apiClientInstance.patch('/api/notifications/mark-all-as-processed'),
    onSuccess: (data) => {
      toast.success(data.message || 'Đã đánh dấu các thông báo cũ là đã xử lý.', { position: "top-right" });
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Lỗi khi đánh dấu tất cả thông báo!', { position: "top-right" });
    }
  });

  const handleMarkAllAsProcessed = () => {
    markAllNotificationsAsProcessedMutation.mutate();
  };

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
        autoClose={5000}    // Đặt thời gian mặc định là 5 giây
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"       // Hoặc "colored"
        className="custom-toast-z-index" // Sử dụng class CSS tùy chỉnh
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
                  // currentNotificationTab={currentNotificationTab} // Bỏ
                  // setCurrentNotificationTab={setCurrentNotificationTab} // Bỏ
                  isNotificationsLoading={isNotificationsLoading}
                  approveEditAction={approveEditAction}
                  approveNewProjectAction={approveNewProjectAction} // Truyền action mới
                  rejectNewProjectAction={rejectNewProjectAction}   // Truyền action mới
                  rejectEditAction={rejectEditAction}
                  approveDeleteAction={approveDeleteAction}
                  rejectDeleteAction={rejectDeleteAction}
                  isProcessingNotificationAction={isProcessingNotificationAction}
                  handleMarkNotificationAsProcessed={handleMarkNotificationAsProcessed} // Truyền hàm này
                  handleMarkAllAsProcessed={handleMarkAllAsProcessed} // Truyền hàm mới
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
