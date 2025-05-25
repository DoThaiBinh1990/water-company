// d:\CODE\water-company\frontend\src\components\Header.js
import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Thêm useMemo
import { FaBell, FaCheckCircle, FaTimesCircle, FaUserCircle, FaBars, FaTimes, FaSpinner } from 'react-icons/fa'; // Thêm FaSpinner
import Modal from 'react-modal';

Modal.setAppElement('#root');

function Header({
  user,
  notifications,
  showNotificationsModal,
  setShowNotificationsModal,
  fetchNotificationsByStatus, // Đây là hàm refetch từ useQuery
  // currentNotificationTab, // Bỏ
  isNotificationsLoading, // Trạng thái loading từ useQuery
  // approveNewProjectAction, // Bỏ - Action mới
  // rejectNewProjectAction,  // Bỏ - Action mới
  // approveEditAction, // Bỏ
  // rejectEditAction,  // Bỏ
  // approveDeleteAction, // Bỏ
  // rejectDeleteAction,  // Bỏ
  isProcessingNotificationAction, // State từ App.js
  // setIsProcessingNotificationAction, // Bỏ - Setter từ App.js
  // handleMarkNotificationAsProcessed, // Bỏ - Hàm mới từ App.js
  handleMarkAllAsProcessed, // Hàm mới để đánh dấu tất cả đã xử lý
  isSidebarOpen,
  setIsSidebarOpen,
}) {

  // const handleActionWrapper = async (actionCallback, projectId) => {
  //   if (isProcessingNotificationAction) return;
  //   // setIsProcessingNotificationAction(true); // App.js sẽ tự quản lý state này dựa trên các mutation
  //   try {
  //     await actionCallback(projectId);
  //     // Không cần gọi fetchNotificationsByStatus ở đây nữa vì App.js sẽ invalidate query
  //   } catch (error) {
  //     console.error("Lỗi khi thực hiện hành động thông báo từ Header:", error);
  //     // Toast lỗi đã được xử lý trong mutation của App.js
  //   } finally {
  //     // setIsProcessingNotificationAction(false); // App.js sẽ tự quản lý
  //   }
  // };

  // Tính unreadNotificationsCount dựa trên các thông báo pending mà user có thể action
  const unreadNotificationsCount = useMemo(() => {
    if (!user || !Array.isArray(notifications)) return 0;
    
    let count = 0;
    const currentUserId = user._id;
    const relevantProcessedTypesForSender = ['new_approved', 'edit_approved', 'delete_approved', 'new_rejected', 'edit_rejected', 'delete_rejected'];

    notifications.forEach(n => {      
      // Điều kiện để một thông báo PENDING được tính là "chưa đọc" cho người DUYỆT:
      // 1. User có quyền duyệt.
      // 2. Thông báo có status là 'pending'.
      // 3. Thông báo thuộc loại 'new', 'edit', hoặc 'delete'.
      // 4. Nếu là 'edit' hoặc 'delete', phải có projectId._id. Nếu là 'new', projectId có thể chưa có.
      // 5. User hiện tại KHÔNG PHẢI là người tạo ra thông báo này.
      // 6. User hiện tại là người nhận trực tiếp HOẶC thông báo này là chung (không có recipientId).
      const isActionableNewRequest = n.type === 'new';
      const hasProjectIdForEditOrDelete = (n.type === 'edit' || n.type === 'delete') && n.projectId?._id;

      // Điều kiện 1: Thông báo PENDING mà user hiện tại cần DUYỆT
      if (user.permissions?.approve &&
          n.status === 'pending' &&
          (isActionableNewRequest || hasProjectIdForEditOrDelete) && // Điều kiện projectId linh hoạt
          ['new', 'edit', 'delete'].includes(n.type) &&
          n.userId?._id !== currentUserId && 
          (!n.recipientId?._id || n.recipientId?._id === currentUserId)) { 
        count++;
      }
      // Điều kiện 2: Thông báo PROCESSED (kết quả yêu cầu) cho người GỬI
      // và chúng vẫn đang là 'pending' (cho đến khi người gửi mở modal xem thông báo,
      // lúc đó markViewedAsProcessedAPI sẽ chuyển chúng thành 'processed').
      else if (n.userId?._id === currentUserId &&
               n.status === 'pending' && // Đếm khi còn là pending
               relevantProcessedTypesForSender.includes(n.type) 
               // && !n.markedAsReadBySender // Bỏ comment nếu có trường này
               ) { 
        count++; 
      }
    });
    return count;
  }, [notifications, user]);
  
  const handleTabChange = (tab) => {
    if (isProcessingNotificationAction || isNotificationsLoading) return;
    // setCurrentNotificationTab(tab); // Bỏ
    // fetchNotificationsByStatus sẽ tự động được gọi do queryKey thay đổi trong App.js
    // Hoặc nếu bạn muốn fetch ngay lập tức:
    // queryClientHook.refetchQueries(['notifications', tab]); // Nếu bạn có queryClientHook ở đây
    // Hoặc truyền hàm refetch cụ thể cho từng tab nếu queryKey không thay đổi
  };


  return (
    <>
      <header className={`bg-gradient-to-r from-blue-800 to-blue-600 shadow-lg h-12 px-4 flex justify-between items-center fixed top-0 z-[1000] transition-all duration-300 left-0 right-0 ${isSidebarOpen ? 'md:left-64' : 'md:left-16'}`}>
        <div className="flex items-center gap-2">
          <button
            className="md:hidden p-3 rounded-full bg-blue-700 text-white hover:bg-blue-800 transition-all duration-200 transform hover:scale-105"
            onClick={() => {
              if (typeof setIsSidebarOpen === 'function') {
                setIsSidebarOpen(!isSidebarOpen);
              } else {
                console.error("Header Error: setIsSidebarOpen prop is not a function or is undefined.");
              }
            }}
            aria-label={isSidebarOpen ? "Đóng menu" : "Mở menu"}
          >
            {isSidebarOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
          </button>
          <h1 className="text-base md:text-lg font-bold text-white">Phần mềm quản lý công việc</h1>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2">
              <FaUserCircle className="text-xl text-white opacity-80" />
              <span className="header-username text-white font-semibold text-sm md:text-base">{user.username}</span>
            </div>
          )}
          <button
            onClick={() => {
              setShowNotificationsModal(true);
              // Không cần gọi fetchNotificationsByStatus ở đây nữa,
              // vì `enabled: !!user && showNotificationsModal` trong useQuery của App.js sẽ tự động kích hoạt fetch
              // hoặc khi tab thay đổi, queryKey thay đổi cũng sẽ fetch.
              // // Nếu muốn đảm bảo tab 'pending' được chọn khi mở: // Không cần nữa
              // if (currentNotificationTab !== 'pending') {
              //   handleTabChange('pending');
              // }
            }}
            className={`relative bell-icon p-2 rounded-full bg-blue-600 hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 ${unreadNotificationsCount > 0 ? 'has-notifications' : ''}`}
            aria-label="Thông báo"
            disabled={isProcessingNotificationAction} // Chỉ disable khi đang xử lý action, không phải khi loading list
          >
            <FaBell size={18} className="text-white" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center transform translate-x-1/2 -translate-y-1/2">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <Modal
        isOpen={showNotificationsModal}
        onRequestClose={() => { if (!isProcessingNotificationAction) setShowNotificationsModal(false); }}
        style={{
          overlay: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)',
            zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
          content: {
            position: 'relative', maxWidth: '600px', width: '90%', maxHeight: '85vh',
            overflowY: 'hidden', backgroundColor: 'white', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: 'none',
            padding: '0', zIndex: 1000001, inset: 'auto', display: 'flex', flexDirection: 'column'
          }
        }}
        shouldCloseOnOverlayClick={!isProcessingNotificationAction}
      >
        <div className="p-5 flex justify-between items-center border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-semibold text-gray-700">
            Trung tâm Thông báo
          </h2>
          <button
            onClick={() => { if (!isProcessingNotificationAction) setShowNotificationsModal(false); }}
            className={`p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors ${isProcessingNotificationAction ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isProcessingNotificationAction}
            aria-label="Đóng"
          >
            <FaTimes size={16} />
          </button>
        </div>
        <div className="border-b border-gray-200 px-4 py-2 bg-gray-50 flex justify-end">
          {/* Nút "Đánh dấu đã đọc" nên nằm cùng hàng với các tab, và chỉ hiển thị khi tab "Chưa xử lý" active */}
          {/* Chỉ hiển thị nút này nếu có bất kỳ thông báo pending nào */}
          {notifications.filter(n => n.status === 'pending').length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(`Bạn có chắc muốn đánh dấu tất cả ${notifications.filter(n => n.status === 'pending').length} thông báo đang chờ là đã đọc (trừ các yêu cầu duyệt còn hiệu lực)?`)) {
                  handleMarkAllAsProcessed();
                }
              }}
              className={`ml-auto py-1 px-2 text-xs font-medium rounded-md text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50`}
              disabled={isProcessingNotificationAction || isNotificationsLoading || notifications.filter(n => n.status === 'pending').length === 0}
            >
              Đánh dấu tất cả đã đọc ({notifications.filter(n => n.status === 'pending').length})
            </button>
          )}
        </div>

        <div className={`flex-grow overflow-y-auto p-4 bg-white`}>
          {isNotificationsLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <FaSpinner className="animate-spin text-2xl mb-2" />
              Đang tải thông báo...
            </div>
          )}
          {!isNotificationsLoading && notifications.length === 0 && (
            <p className="text-gray-500 text-center py-10">
              Không có thông báo nào.
            </p>
          )}
          {!isNotificationsLoading && notifications
            // .filter(n => n.status === currentNotificationTab) // Không cần filter nữa
            .sort((a, b) => {
              const isAPendingForCurrentUser = user?.permissions?.approve && a.status === 'pending' && ['new', 'edit', 'delete'].includes(a.type) && a.userId?._id !== user._id && (!a.recipientId?._id || a.recipientId?._id === user._id);
              const isBPendingForCurrentUser = user?.permissions?.approve && b.status === 'pending' && ['new', 'edit', 'delete'].includes(b.type) && b.userId?._id !== user._id && (!b.recipientId?._id || b.recipientId?._id === user._id);

              const isAPendingResultForSender = a.userId?._id === user._id && a.status === 'pending' && ['new_approved', 'edit_approved', 'delete_approved', 'new_rejected', 'edit_rejected', 'delete_rejected'].includes(a.type);
              const isBPendingResultForSender = b.userId?._id === user._id && b.status === 'pending' && ['new_approved', 'edit_approved', 'delete_approved', 'new_rejected', 'edit_rejected', 'delete_rejected'].includes(b.type);

              const aIsImportant = isAPendingForCurrentUser || isAPendingResultForSender;
              const bIsImportant = isBPendingForCurrentUser || isBPendingResultForSender;

              if (aIsImportant && !bIsImportant) return -1; // a lên trước
              if (!aIsImportant && bIsImportant) return 1;  // b lên trước

              // Nếu cả hai cùng quan trọng hoặc không quan trọng, sắp xếp theo thời gian
              return new Date(b.createdAt) - new Date(a.createdAt);
            })
            .map(notification => (
              <div
                key={notification._id}
                className={`p-3 mb-2 rounded-lg shadow-sm hover:shadow-md transition-shadow border 
                  ${notification.status === 'pending' && user?.permissions?.approve && ['new', 'edit', 'delete'].includes(notification.type) && notification.userId?._id !== user._id && (!notification.recipientId?._id || notification.recipientId?._id === user._id)
                    ? 'bg-sky-100 border-sky-300' // Cần duyệt (Đổi sang xanh da trời nhạt - sky)
                    : (notification.status === 'pending' && notification.userId?._id === user._id && ['new_approved', 'edit_approved', 'delete_approved', 'new_rejected', 'edit_rejected', 'delete_rejected'].includes(notification.type)
                      ? 'bg-blue-100 border-blue-300' // Kết quả YC của mình
                      : 'bg-gray-50 border-gray-200') // Mặc định
                  }
                  ${notification.status === 'processed' ? 'opacity-80' : ''}
                `}
                // onClick={() => { // Bỏ logic onClick này
                //   if (notification.status === 'pending' &&
                //       !(user?.permissions?.approve && notification.projectId?._id && ['edit', 'delete', 'new'].includes(notification.type)) &&
                //       typeof handleMarkNotificationAsProcessed === 'function' &&
                //       !isProcessingNotificationAction // Chỉ cho phép nếu không có action nào đang chạy
                //   ) {
                //     handleMarkNotificationAsProcessed(notification._id);
                //   }
                // }}
              >
                <p className="text-sm font-medium text-gray-800">
                  {(() => {
                    let displayMessage = notification.message;
                    if (user && notification.status === 'pending' && notification.projectId && ['new', 'edit', 'delete'].includes(notification.type)) {
                      if (notification.userId?._id === user.id && notification.recipientId !== user.id) {
                        // User là người gửi, và không phải tự gửi cho mình duyệt
                        if (notification.type === 'new') displayMessage = `Yêu cầu tạo công trình "${notification.projectId?.name || 'mới'}" của bạn đang chờ duyệt.`;
                        else if (notification.type === 'edit') displayMessage = `Yêu cầu sửa công trình "${notification.projectId?.name || ''}" của bạn đang chờ duyệt.`;
                        else if (notification.type === 'delete') displayMessage = `Yêu cầu xóa công trình "${notification.projectId?.name || ''}" của bạn đang chờ duyệt.`;
                      } else if (user.permissions?.approve && (notification.recipientId === user.id || !notification.recipientId)) {
                        // User là người duyệt, message từ backend đã đúng
                        // Hoặc user tự gửi cho mình duyệt và có quyền duyệt
                        displayMessage = notification.message;
                      }
                    }
                    // Trường hợp thông báo processed, message từ backend đã đúng (ví dụ: "Yêu cầu của bạn đã được duyệt/từ chối")
                    // Hoặc thông báo pending mà user không phải người gửi và cũng không phải người duyệt (ví dụ: thông báo chung cho người khác)
                    return displayMessage;
                  })()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {notification.projectId?.name ? `CT: ${notification.projectId.name} (${notification.projectModel === 'CategoryProject' ? 'DM' : 'SCN'})` : 'Thông báo chung'}
                  {' - '}
                  {new Date(notification.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })},
                  Người tạo YC: {notification.userId?.fullName || notification.userId?.username || 'N/A'}
                </p>
                {/* Điều kiện hiển thị nút Duyệt/Từ chối: User có quyền, thông báo là pending, có projectId, loại new/edit/delete VÀ thông báo đó là chung hoặc gửi cho chính user này */}
                {/* Bỏ các nút hành động Duyệt/Từ chối */}
                {/* Hiển thị trạng thái nếu là processed hoặc user không có quyền action */}
                {notification.status === 'processed' && (
                  <p className="text-xs text-green-600 mt-1 italic">Đã xử lý</p>
                )}
                {/* Điều kiện hiển thị "Đang chờ xử lý...": Thông báo pending VÀ (user không có quyền duyệt HOẶC thông báo không phải loại new/edit/delete có projectId HOẶC thông báo là new/edit/delete nhưng gửi cho người khác) */}
                {notification.status === 'pending' &&
                 !(user?.permissions?.approve && notification.projectId?._id && ['new', 'edit', 'delete'].includes(notification.type) && (!notification.recipientId || notification.recipientId?._id === user.id)) && (
                  <p className="text-xs text-yellow-600 mt-1 italic">Đang chờ xử lý...</p>
                )}
              </div>
            ))}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <button
            onClick={() => { if (!isProcessingNotificationAction) setShowNotificationsModal(false); }}
            className={`w-full py-2 px-4 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 transition-colors ${isProcessingNotificationAction ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isProcessingNotificationAction}
          >
            Đóng
          </button>
        </div>
      </Modal>
    </>
  );
}

export default Header;
