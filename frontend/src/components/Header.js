// d:\CODE\water-company\frontend\src\components\Header.js
import React, { useState, useEffect } from 'react';
import { FaBell, FaCheckCircle, FaTimesCircle, FaUserCircle, FaBars, FaTimes, FaSpinner } from 'react-icons/fa'; // Thêm FaSpinner
import Modal from 'react-modal';

Modal.setAppElement('#root');

function Header({
  user,
  notifications,
  showNotificationsModal,
  setShowNotificationsModal,
  fetchNotificationsByStatus, // Đây là hàm refetch từ useQuery
  currentNotificationTab,
  setCurrentNotificationTab,
  isNotificationsLoading, // Trạng thái loading từ useQuery
  approveEditAction,
  rejectEditAction,
  approveDeleteAction,
  rejectDeleteAction,
  isProcessingNotificationAction, // State từ App.js
  setIsProcessingNotificationAction, // Setter từ App.js
  isSidebarOpen,
  setIsSidebarOpen,
}) {

  const handleActionWrapper = async (actionCallback, projectId) => {
    if (isProcessingNotificationAction) return;
    // setIsProcessingNotificationAction(true); // App.js sẽ tự quản lý state này dựa trên các mutation
    try {
      await actionCallback(projectId);
      // Không cần gọi fetchNotificationsByStatus ở đây nữa vì App.js sẽ invalidate query
    } catch (error) {
      console.error("Lỗi khi thực hiện hành động thông báo từ Header:", error);
      // Toast lỗi đã được xử lý trong mutation của App.js
    } finally {
      // setIsProcessingNotificationAction(false); // App.js sẽ tự quản lý
    }
  };

  const [tabFade, setTabFade] = useState(false);

  useEffect(() => {
    if (showNotificationsModal) {
        setTabFade(false); // Reset fade
        setTimeout(() => setTabFade(true), 50); // Kích hoạt fade sau một chút
    }
  }, [currentNotificationTab, showNotificationsModal]);

  const unreadNotificationsCount = notifications.filter(n => n.status === 'pending').length;

  const handleTabChange = (tab) => {
    if (isProcessingNotificationAction || isNotificationsLoading) return;
    setCurrentNotificationTab(tab);
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
              // Nếu muốn đảm bảo tab 'pending' được chọn khi mở:
              if (currentNotificationTab !== 'pending') {
                handleTabChange('pending');
              }
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
        <div className="border-b border-gray-200 px-2 pt-2 bg-gray-50">
          <button
            onClick={() => handleTabChange('pending')}
            className={`py-2 px-4 text-sm font-medium rounded-t-md
                        ${currentNotificationTab === 'pending' ? 'border-b-2 border-blue-500 text-blue-600 bg-white' : 'text-gray-500 hover:text-blue-500 hover:bg-gray-100'}
                        ${isProcessingNotificationAction || isNotificationsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isProcessingNotificationAction || isNotificationsLoading}
          >
            Chưa xử lý ({unreadNotificationsCount})
          </button>
          <button
            onClick={() => handleTabChange('processed')}
            className={`py-2 px-4 text-sm font-medium rounded-t-md
                        ${currentNotificationTab === 'processed' ? 'border-b-2 border-blue-500 text-blue-600 bg-white' : 'text-gray-500 hover:text-blue-500 hover:bg-gray-100'}
                        ${isProcessingNotificationAction || isNotificationsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isProcessingNotificationAction || isNotificationsLoading}
          >
            Đã xử lý
          </button>
        </div>

        <div className={`flex-grow overflow-y-auto p-4 bg-white transition-opacity duration-300 ease-in-out ${tabFade ? 'opacity-100' : 'opacity-0'}`}>
          {isNotificationsLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <FaSpinner className="animate-spin text-2xl mb-2" />
              Đang tải thông báo...
            </div>
          )}
          {!isNotificationsLoading && notifications.filter(n => n.status === currentNotificationTab).length === 0 && (
            <p className="text-gray-500 text-center py-10">
              Không có thông báo nào.
            </p>
          )}
          {!isNotificationsLoading && notifications
            .filter(n => n.status === currentNotificationTab)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(notification => (
              <div
                key={notification._id}
                className="p-3 mb-2 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
              >
                <p className="text-sm font-medium text-gray-800">
                  {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {notification.projectId?.name ? `CT: ${notification.projectId.name} (${notification.projectModel === 'CategoryProject' ? 'DM' : 'SCN'})` : 'Thông báo chung'}
                  {' - '}
                  {new Date(notification.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                {currentNotificationTab === 'pending' && user?.permissions?.approve && notification.projectId?._id && (
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={() => handleActionWrapper(notification.type === 'edit' ? approveEditAction : approveDeleteAction, notification.projectId._id)}
                      className={`btn-sm btn-success flex items-center gap-1 ${isProcessingNotificationAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isProcessingNotificationAction}
                    >
                      <FaCheckCircle size={14} /> {isProcessingNotificationAction ? "Đang..." : "Duyệt"}
                    </button>
                    <button
                      onClick={() => handleActionWrapper(notification.type === 'edit' ? rejectEditAction : rejectDeleteAction, notification.projectId._id)}
                      className={`btn-sm btn-warning flex items-center gap-1 ${isProcessingNotificationAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isProcessingNotificationAction}
                    >
                      <FaTimesCircle size={14} /> {isProcessingNotificationAction ? "Đang..." : "Từ chối"}
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <button
            onClick={() => { if (!isProcessingNotificationAction) setShowNotificationsModal(false); }}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 transition-colors ${isProcessingNotificationAction ? 'opacity-50 cursor-not-allowed' : ''}`}
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
