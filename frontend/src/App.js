// d:/CODE/water-company/frontend/src/App.js
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
      markViewedNotificationsAsProcessedAPI, // API mới
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
// Khởi tạo socket ở ngoài component để nó là một instance duy nhất
const socket = io(apiClientInstance.defaults.baseURL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  autoConnect: false, // QUAN TRỌNG: Để false, sẽ connect thủ công khi có user
});

// Thêm listeners cho các sự kiện cơ bản của socket để debug
socket.on('connect', () => {
  console.log('[APP_SOCKET_IO] Socket connected:', socket.id);
});
socket.on('disconnect', (reason) => {
  console.log('[APP_SOCKET_IO] Socket disconnected:', reason);
});
socket.on('connect_error', (error) => {
  console.error('[APP_SOCKET_IO] Socket connection error:', error.message);
});

function App() {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClientHook = useReactQueryClient();

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showHeader, ] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [markViewedErrorShownThisSession, setMarkViewedErrorShownThisSession] = useState(false);
  const [modalJustOpened, setModalJustOpened] = useState(false); // State mới để kiểm soát việc mở modal
  const [hasAttemptedMarkViewedInModalSession, setHasAttemptedMarkViewedInModalSession] = useState(false);
  const [lastToastTime, setLastToastTime] = useState(0);
  const MIN_TOAST_INTERVAL = 5000; // 5 giây
  const {
    data: currentUserDataResult,
    isLoading: isLoadingUser,
    isError: isErrorUser,
    error: userErrorObject,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getMe,
    enabled: (() => {
      const token = localStorage.getItem('token');
      return !!(token && token !== 'null' && token !== 'undefined');
    })(),
    retry: 1,
    onSuccess: (userData) => {
      // Logic setUser sẽ được xử lý trong useEffect bên dưới
    },
    onError: (error) => {
      // Logic logout cũng sẽ được xử lý trong useEffect
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
    refetch: refetchNotifications
  } = useQuery({
    queryKey: ['notificationsForAllRelevantToUser'],
    queryFn: () => fetchNotificationsAPI(),
    enabled: !!user,
    onError: (error) => {
      console.error("Lỗi tải thông báo (useQuery):", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Lỗi tải thông báo!', { position: "top-center" });
    }
  });

  useEffect(() => {
    if (!isLoadingUser) {
      if (isErrorUser) {
        handleLogout();
      } else if (currentUserDataResult) {
        if (typeof currentUserDataResult === 'object' && (currentUserDataResult._id || currentUserDataResult.id || currentUserDataResult.username)) {
          setUser(currentUserDataResult);
          // Ensure user object in state has _id, even if API returned 'id' (from JWT payload)
          if (currentUserDataResult.id && !currentUserDataResult._id) {
              setUser({ ...currentUserDataResult, _id: currentUserDataResult.id });
          } else {
              setUser(currentUserDataResult);
          }
        } else {
          handleLogout();
        }
      } else if (!currentUserDataResult && localStorage.getItem('token') && (localStorage.getItem('token') !== 'null' && localStorage.getItem('token') !== 'undefined')) {
        handleLogout();
      }
    }
  }, [isLoadingUser, isErrorUser, currentUserDataResult, userErrorObject, handleLogout]);

  // Refs cho các handlers của socket
  const notificationHandlerRef = React.useRef(null);
  const processedNotificationIds = React.useRef(new Set()); // Set để theo dõi ID thông báo đã hiển thị toast
  const notificationProcessedHandlerRef = React.useRef(null);

  // Effect để cập nhật các refs cho handlers khi dependencies của chúng thay đổi
  useEffect(() => {
    // console.log('[APP_DEBUG] Updating notificationHandlerRef. Current user state:', user ? user._id : 'null', 'LastToastTime:', lastToastTime);
    const handleNewNotificationInternal = (notification) => {
      console.log('[APP_NOTIFICATION_DEBUG] Received new notification event. Invalidating queries.');

      // Kiểm tra xem toast cho notification này đã được hiển thị chưa
      if (notification._id && processedNotificationIds.current.has(notification._id)) {
        console.log(`[APP_NOTIFICATION_DEBUG] Toast for notification ID ${notification._id} already shown. Skipping.`);
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] }); // Vẫn invalidate để cập nhật số đếm
        return;
      }
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });

      // Lấy user state hiện tại của App component.
      // `user` ở đây là user từ closure của useEffect này, được cập nhật khi `user` state của App thay đổi.
      const currentUserToUse = user;

      console.log('[APP_NOTIFICATION_DEBUG] Received notification object:', JSON.stringify(notification, null, 2));
      console.log(`[APP_NOTIFICATION_DEBUG] Current User ID (user._id from App state): ${currentUserToUse?._id}`);
      
      if (!currentUserToUse) {
        console.log('[APP_NOTIFICATION_DEBUG] CRITICAL: currentUserToUse is falsy inside handler. Skipping toast logic.');
        // Log thêm thông tin để debug
        const userFromCacheForLog = queryClientHook.getQueryData(['currentUser']);
        console.log(`[APP_NOTIFICATION_DEBUG] user from React Query cache at this moment: ${JSON.stringify(userFromCacheForLog)}`);
        return; // Không xử lý toast nếu không có user
      }
      
      // Vẫn kiểm tra lại cho chắc chắn, mặc dù guard ở useEffect nên đảm bảo
      if (currentUserToUse) { 
        console.log(`[APP_NOTIFICATION_DEBUG] Notification Creator ID (notification.userId?._id): ${notification.userId?._id}`);
        console.log(`[APP_NOTIFICATION_DEBUG] Notification Recipient ID (notification.recipientId?._id): ${notification.recipientId?._id}`);
        console.log(`[APP_NOTIFICATION_DEBUG] Current user permissions.approve: ${currentUserToUse?.permissions?.approve}`);
      } else {
        // Trường hợp này không nên xảy ra nếu guard của useEffect hoạt động đúng
        console.error('[APP_NOTIFICATION_DEBUG] UNEXPECTED: currentUserToUse is falsy after initial check!');
        return;
      }

      let shouldToast = false;
      let toastMessage = notification.message;

      const currentUserId = currentUserToUse._id;
      // Sửa cách lấy ID: notification.userId và notification.recipientId từ backend là string ID, không phải object
      const notificationCreatorId = typeof notification.userId === 'string' ? notification.userId : notification.userId?._id;
      const notificationRecipientId = typeof notification.recipientId === 'string' ? notification.recipientId : notification.recipientId?._id;

      console.log(`[APP_NOTIFICATION_DEBUG] Corrected Notification Creator ID: ${notificationCreatorId}`);
      console.log(`[APP_NOTIFICATION_DEBUG] Corrected Notification Recipient ID: ${notificationRecipientId}`);
  
      if (notification.status === 'pending' && notification.projectId && ['new', 'edit', 'delete'].includes(notification.type)) {
        const projectName = notification.projectId?.name || (notification.type === 'new' ? 'mới' : (notification.type === 'edit' || notification.type === 'delete' ? 'hiện tại' : ''));
        const creatorName = notification.userId?.fullName || notification.userId?.username || 'Một người dùng';

        // Case 1: Người dùng hiện tại là người tạo yêu cầu
        // và thông báo này là YÊU CẦU ĐANG CHỜ DUYỆT (type: new, edit, delete) do CHÍNH HỌ tạo,
        // và thông báo này CHƯA PHẢI là kết quả (không chứa _approved, _rejected)
        if (notificationCreatorId === currentUserId && ['new', 'edit', 'delete'].includes(notification.type)) {
          shouldToast = true; // Người tạo YC sẽ nhận toast
          if (notification.type === 'new') toastMessage = `Yêu cầu tạo công trình "${projectName}" của bạn đang chờ duyệt.`;
          else if (notification.type === 'edit') toastMessage = `Yêu cầu sửa công trình "${projectName}" của bạn đang chờ duyệt.`;
          else if (notification.type === 'delete') toastMessage = `Yêu cầu xóa công trình "${projectName}" của bạn đang chờ duyệt.`;
          console.log(`[APP_TOAST_DEBUG] Case 1: User (${currentUserId}) is creator of PENDING request. Toast: ${shouldToast}, Msg: "${toastMessage}"`);

        }
        // Case 2: Người dùng hiện tại là người duyệt (và không phải người tạo)
        // Và thông báo này được gửi trực tiếp cho họ (recipientId)
        else if (currentUserToUse.permissions?.approve && 
                 notificationCreatorId !== currentUserId && 
                 notificationRecipientId && 
                 notificationRecipientId === currentUserId) {
          // Người duyệt được chỉ định sẽ nhận toast
          shouldToast = true;
          let actionText = notification.type === 'new' ? 'tạo' : (notification.type === 'edit' ? 'sửa' : (notification.type === 'delete' ? 'xóa' : 'xử lý'));
          toastMessage = `${creatorName} đã gửi yêu cầu ${actionText} công trình "${projectName}" cần bạn duyệt.`;
          console.log(`[APP_TOAST_DEBUG] Case 2: User (${currentUserId}) is designated approver for PENDING request (Recipient: ${notificationRecipientId}). Toast: ${shouldToast}, Msg: "${toastMessage}"`);

        }
        // Case 3: Thông báo chung cho người có quyền duyệt (không có recipientId cụ thể)
        // và người dùng hiện tại không phải người tạo, và có quyền duyệt
        else if (currentUserToUse.permissions?.approve && notificationCreatorId !== currentUserId && !notificationRecipientId) {
            // Đây là trường hợp thông báo chung cho tất cả approvers.
            // Nếu bạn muốn người duyệt cũ (không phải là recipientId của YC sửa mới) không nhận toast này,
            // thì backend cần đảm bảo không gửi thông báo "chung" kiểu này khi đã có recipientId cụ thể cho YC sửa.
            // Hoặc, bạn có thể thêm điều kiện ở đây để kiểm tra xem có YC sửa nào đang chờ user này duyệt không.
            // Hiện tại, để tránh người duyệt cũ nhận toast, chúng ta có thể tạm thời không toast cho trường hợp này nếu đã có recipientId.
            // Tuy nhiên, nếu backend gửi thông báo yêu cầu sửa mà không có recipientId (ví dụ, gửi cho tất cả admin),
            // thì người duyệt cũ (nếu là admin) vẫn có thể nhận được.
            // Để giải quyết triệt để, backend khi tạo YC sửa với người duyệt mới X,
            // thì notification yêu cầu duyệt đó PHẢI có recipientId = X.
            // Nếu backend đã làm vậy, thì người duyệt cũ sẽ không khớp với điều kiện ở Case 2.
            // Và nếu không có thông báo chung nào được gửi cho YC sửa đó, thì người duyệt cũ sẽ không nhận toast.
            // Giả sử backend đã gửi đúng recipientId cho YC sửa, thì không cần thêm logic phức tạp ở đây.
        }
      }
      // Case 4: Thông báo KẾT QUẢ (processed) cho người tạo yêu cầu
      else if (notificationCreatorId === currentUserId && notification.status === 'processed') {
        const relevantProcessedTypes = ['new_approved', 'edit_approved', 'delete_approved', 'new_rejected', 'edit_rejected', 'delete_rejected'];
        
        if (relevantProcessedTypes.includes(notification.type)) {
          // Kiểm tra xem người dùng hiện tại có phải là người thực hiện hành động duyệt/từ chối không
          // Ví dụ: "Yêu cầu của bạn đã được duyệt bởi UserA."
          // Nếu message chứa "bởi UserA" và UserA là currentUserToUse, thì không toast.
          // Sử dụng cả username và fullName để kiểm tra, vì message từ backend có thể dùng một trong hai
          const performingUserIdentifier = currentUserToUse.username || currentUserToUse.fullName;
          let processedByCurrentUser = false;
          if (performingUserIdentifier && typeof notification.message === 'string') {
              const processedByPattern = ` bởi ${performingUserIdentifier}`; // Kiểm tra " bởi username" hoặc " bởi fullname"
              // Thêm kiểm tra cho trường hợp tên người dùng/fullName có thể nằm trong message mà không có " bởi "
              // Ví dụ: "testadmin đã duyệt yêu cầu của bạn." (ít khả năng hơn với cấu trúc hiện tại)
              // Để đơn giản, ta chỉ kiểm tra " bởi UserX"
              if (notification.message.includes(processedByPattern) || notification.message.startsWith(performingUserIdentifier + " đã")) {
                  processedByCurrentUser = true;
              }
          }
          console.log(`[APP_TOAST_DEBUG] Case 4: Processed notification for creator. Type: ${notification.type}, Processed by current user: ${processedByCurrentUser}, Message: "${notification.message}"`);

          if (!processedByCurrentUser) {
            shouldToast = true; // Người tạo YC sẽ nhận toast khi YC của họ được người khác xử lý
            // toastMessage đã được set từ notification.message (từ backend)
            toastMessage = notification.message; // Đảm bảo toastMessage được cập nhật từ notification.message
            // toastMessage đã được set từ notification.message (từ backend) và thường là đủ thông tin
            // toastMessage đã được set từ notification.message (từ backend)
          }
        }
      }

      console.log(`[APP_NOTIFICATION_DEBUG] Toast decision: shouldToast=${shouldToast}, toastMessage="${toastMessage}"`);
      
      if (shouldToast) {
        const now = Date.now();
        const toastId = notification._id || `toast-${Date.now()}`; // Tạo toastId trước

        if (now - lastToastTime > MIN_TOAST_INTERVAL) {
          let toastTypeToUse = 'info'; // Mặc định là info (xanh dương)

          // Khôi phục logic: Nếu là người duyệt nhận yêu cầu (Case 2) -> màu cam (warn)
          // Case 2: Người dùng hiện tại là người duyệt (và không phải người tạo)
          // Và thông báo này được gửi trực tiếp cho họ (recipientId)
          if (currentUserToUse.permissions?.approve &&
              notificationCreatorId !== currentUserId &&
              notificationRecipientId &&
              notificationRecipientId === currentUserId &&
              notification.status === 'pending' && // Chỉ warn cho yêu cầu đang chờ
              ['new', 'edit', 'delete'].includes(notification.type)
          ) {
            toastTypeToUse = 'warning'; 
          }
          
          console.log(`[APP_NOTIFICATION_DEBUG] Displaying toast. Type: ${toastTypeToUse}, ID: ${toastId}, Message: "${toastMessage}"`);
          
          if (toastTypeToUse === 'warning') {
            toast.warning(toastMessage, { position: "top-right", toastId: toastId });
          } else { // Bao gồm Case 1 (người tạo YC pending) và Case 4 (người tạo YC nhận kết quả processed)
            toast.info(toastMessage, { position: "top-right", toastId: toastId });
          }

          if (notification._id) processedNotificationIds.current.add(notification._id); // Thêm ID vào set đã xử lý
          setLastToastTime(now);
        } else {
          console.log(`[APP_NOTIFICATION_DEBUG] Toast throttled. Last toast time: ${lastToastTime}, Now: ${now}`);
        }
      }
    };

    // Cập nhật ref với handler mới nhất (có closure đúng với `user` hiện tại)
    notificationHandlerRef.current = handleNewNotificationInternal; // Gán vào ref

    const handleNotificationProcessedInternal = (notificationId) => { // Đổi tên để tránh nhầm lẫn
      console.log(`[APP_SOCKET_DEBUG] Received 'notification_processed' for ID: ${notificationId}. Invalidating queries.`);
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
      // Có thể xóa ID khỏi processedNotificationIds.current nếu cần hiển thị lại toast (ít dùng)
    };
    notificationProcessedHandlerRef.current = handleNotificationProcessedInternal; // Gán vào ref

  }, [user, queryClientHook, lastToastTime, MIN_TOAST_INTERVAL, setLastToastTime]); // Dependencies cho các giá trị mà handler sử dụng
  
  // Effect chính cho Socket.IO: quản lý kết nối và gán/gỡ listeners
  useEffect(() => {
    console.log('[APP_SOCKET_DEBUG] Socket useEffect triggered. User:', user ? user._id : 'null', 'Socket connected:', socket.connected);
    
    // Chỉ thực hiện các thao tác socket nếu có user hợp lệ (có _id)
    if (user && user._id) {
      if (!socket.connected) { 
        console.log('[APP_SOCKET_DEBUG] User exists and socket not connected. Attempting to connect...');
        socket.connect();
      }

      const onNotification = (notification) => {
        if (notificationHandlerRef.current) {
          notificationHandlerRef.current(notification);
        }
      };
      const onNotificationProcessed = (notificationId) => {
        if (notificationProcessedHandlerRef.current) {
          notificationProcessedHandlerRef.current(notificationId);
        }
      };
      
      socket.on('notification', onNotification);
      socket.on('notification_processed', onNotificationProcessed);

      // Cleanup function cho useEffect này
      return () => {
        console.log('[APP_SOCKET_DEBUG] Cleanup: Removing socket listeners for "notification" and "notification_processed".');
        socket.off('notification', onNotification);
        socket.off('notification_processed', onNotificationProcessed);
      };
    } else { // Không có user hoặc user không hợp lệ
      console.log('[APP_SOCKET_DEBUG] No valid user. Ensuring socket is disconnected and listeners are off.');
      socket.disconnect(); // Ngắt kết nối nếu không có user
      socket.off('notification'); // Gỡ bỏ tất cả listeners nếu socket bị ngắt
      socket.off('notification_processed');
    }
  }, [user]); // Chỉ phụ thuộc vào `user`. `socket` instance là stable.
  
  // Effect để cập nhật tiêu đề tab trình duyệt dựa trên route
  useEffect(() => {
    const baseTitle = "Lawasuco";
    let pageTitle = "";
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
    document.title = pageTitle ? `${pageTitle} - ${baseTitle}` : baseTitle;
  }, [location.pathname]);

  const useProjectActionMutation = (mutationFn, successMessageKey) => {
    return useMutation({
      mutationFn,
      onSuccess: (data) => {
        toast.success(data?.message || successMessageKey || "Thao tác thành công!", { position: "top-right" });
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        queryClientHook.invalidateQueries({ queryKey: ['projects'] });
        queryClientHook.invalidateQueries({ queryKey: ['pendingProjects'] });
        queryClientHook.invalidateQueries({ queryKey: ['rejectedProjects'] });
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Thao tác thất bại!';
        console.error("Lỗi hành động thông báo:", errorMessage);
        if (errorMessage.includes("không tồn tại hoặc đã được xử lý") || errorMessage.includes("không có yêu cầu")) {
          toast.info("Thông báo này có thể đã được xử lý. Đang làm mới danh sách...", { position: "top-right" });
        } else {
          toast.error(errorMessage, { position: "top-right" });
        }
        queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
        queryClientHook.invalidateQueries({ queryKey: ['projects'] });
        queryClientHook.invalidateQueries({ queryKey: ['pendingProjects'] });
        queryClientHook.invalidateQueries({ queryKey: ['rejectedProjects'] });
      },
    });
  };

  const showAppNotification = (message, type = 'info') => {
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
      if (reason === null) throw new Error("Hủy bỏ thao tác.");
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
      return rejectEditAPI({ projectId, type, reason });
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
      return rejectDeleteAPI({ projectId, type, reason });
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
    mutationFn: (notificationId) => apiClientInstance.patch(`/api/notifications/${notificationId}/read`),
    onSuccess: (data) => {
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
    },
    onError: (error) => {
      // Không hiển thị toast lỗi cho thao tác này nữa
      console.error("Lỗi khi đánh dấu thông báo đã đọc (tự động):", error.response?.data?.message || error.message);
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] }); // Vẫn thử làm mới
    }
  });

  const handleMarkNotificationAsProcessed = (notificationId) => {
    markNotificationAsProcessedMutation.mutate(notificationId);
  };

  const markViewedAsProcessedMutation = useMutation({
    mutationFn: markViewedNotificationsAsProcessedAPI,
    onSuccess: (data) => {
      // Không cần toast ở đây, việc invalidate query sẽ cập nhật UI
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
      // Nếu thành công, đảm bảo cờ lỗi được reset (mặc dù nó nên được reset khi mở modal)
      // setMarkViewedErrorShownThisSession(false); // Có thể không cần thiết nếu reset khi mở modal
    },
    onError: (error) => { // Bỏ toast lỗi ở đây
      // if (!markViewedErrorShownThisSession) {
      //   // toast.error(error.response?.data?.message || 'Lỗi khi đánh dấu thông báo đã xem!', { position: "top-right", toastId: "markViewedErrorToast" });
      //   // setMarkViewedErrorShownThisSession(true);
      // }
      console.error("Lỗi khi đánh dấu thông báo đã xem (khi mở modal):", error.response?.data?.message || error.message);
      queryClientHook.invalidateQueries({ queryKey: ['notificationsForAllRelevantToUser'] });
    },
  });
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

  // Effect để theo dõi việc mở/đóng modal và reset các cờ liên quan
 useEffect(() => {
    if (showNotificationsModal) {
      setModalJustOpened(true); // Đánh dấu modal vừa được mở
    } else {
      // Khi modal đóng, reset tất cả các cờ
      setModalJustOpened(false);
      if (hasAttemptedMarkViewedInModalSession) {
        // console.log("[APP_DEBUG] Notifications modal closed, resetting hasAttemptedMarkViewedInModalSession.");
        setHasAttemptedMarkViewedInModalSession(false);
      }
      if (markViewedErrorShownThisSession) {
        // console.log("[APP_DEBUG] Notifications modal closed, resetting markViewedErrorShownThisSession.");
        setMarkViewedErrorShownThisSession(false);
      }
    }
  }, [showNotificationsModal]); // Chỉ phụ thuộc vào showNotificationsModal

  // Effect để gọi API đánh dấu đã xem, chỉ khi modal vừa được mở
  useEffect(() => {
    if (modalJustOpened && user && !hasAttemptedMarkViewedInModalSession && !markViewedAsProcessedMutation.isLoading) {
      setMarkViewedErrorShownThisSession(false); // Reset cờ lỗi cho phiên mở modal mới
      markViewedAsProcessedMutation.mutate(undefined, {
        onSettled: () => {
          setHasAttemptedMarkViewedInModalSession(true); // Đánh dấu đã thử trong phiên này
          setModalJustOpened(false); // Reset cờ modalJustOpened để không gọi lại cho đến khi modal mở lại
        }
      });
    }
  }, [user, modalJustOpened, hasAttemptedMarkViewedInModalSession, markViewedAsProcessedMutation]);

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
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        className="custom-toast-z-index"
        limit={3}
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
                  notifications={notifications}
                  showNotificationsModal={showNotificationsModal}
                  setShowNotificationsModal={setShowNotificationsModal}
                  fetchNotificationsByStatus={refetchNotifications}
                  isNotificationsLoading={isNotificationsLoading} // Vẫn cần
                  // approveEditAction={approveEditAction} // Bỏ
                  // approveNewProjectAction={approveNewProjectAction} // Bỏ
                  // rejectNewProjectAction={rejectNewProjectAction} // Bỏ
                  // rejectEditAction={rejectEditAction} // Bỏ
                  // approveDeleteAction={approveDeleteAction} // Bỏ
                  // rejectDeleteAction={rejectDeleteAction} // Bỏ
                  isProcessingNotificationAction={isProcessingNotificationAction}
                  // handleMarkNotificationAsProcessed={handleMarkNotificationAsProcessed} // Bỏ prop này
                  handleMarkAllAsProcessed={handleMarkAllAsProcessed}
                  // setIsProcessingNotificationAction={setIsProcessingNotificationAction} // Bỏ
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
                          addMessage={showAppNotification}
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
                          addMessage={showAppNotification}
                        />
                      }
                    />
                    <Route path="/settings" element={<Settings user={user} />} />
                    <Route path="/timeline/*" element={<TimelineManagement user={user} addMessage={showAppNotification} />} />
                    <Route path="/" element={<Navigate to="/category" replace />} />
                    <Route path="*" element={<Navigate to="/category" replace />} />
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
