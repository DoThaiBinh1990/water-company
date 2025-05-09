// frontend/src/components/Header.js
import React, { useState } from 'react';
import { FaBell, FaCheckCircle, FaTimesCircle, FaUserCircle } from 'react-icons/fa';
import Modal from 'react-modal';

Modal.setAppElement('#root');

function Header({
  user,
  notifications,
  showNotificationsModal,
  setShowNotificationsModal,
  fetchNotificationsByStatus,
  currentNotificationTab,
  setCurrentNotificationTab,
  isNotificationsLoading,
  approveEditAction,
  rejectEditAction,
  approveDeleteAction,
  rejectDeleteAction,
  isProcessingNotificationAction,
  setIsProcessingNotificationAction
}) {

  const handleAction = async (actionCallback, projectId) => {
    if (isProcessingNotificationAction) return;
    setIsProcessingNotificationAction(true);
    try {
      await actionCallback(projectId);
    } catch (error) {
      console.error("Lỗi khi thực hiện hành động thông báo từ Header:", error);
    } finally {
      setIsProcessingNotificationAction(false);
    }
  };

  const unreadNotificationsCount = notifications.filter(n => n.status === 'pending').length;

  return (
    <header className="bg-white shadow-md h-16 px-4 md:px-6 flex justify-between items-center sticky top-0 z-30 w-full">
      <div className="flex-1">
      </div>

      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center">
            <FaUserCircle className="text-xl text-gray-500 mr-2" />
            <span className="text-gray-700 font-medium text-sm md:text-base">{user.username}</span>
          </div>
        )}
        {user?.permissions?.approve && (
          <button
            onClick={() => {
              setShowNotificationsModal(true);
              fetchNotificationsByStatus(currentNotificationTab === 'processed' ? 'processed' : 'pending');
              if (currentNotificationTab !== 'pending') {
                setCurrentNotificationTab('pending');
              }
            }}
            className="relative text-gray-500 hover:text-blue-600 focus:outline-none p-2"
            aria-label="Thông báo"
            disabled={isNotificationsLoading || isProcessingNotificationAction}
          >
            <FaBell size={20} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center transform translate-x-1/4 -translate-y-1/4">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        )}
      </div>

      <Modal
        isOpen={showNotificationsModal}
        onRequestClose={() => { if (!isProcessingNotificationAction) setShowNotificationsModal(false); }}
        className="bg-white rounded-lg p-5 md:p-6 max-w-md w-[90%] md:w-full mx-auto mt-16 shadow-xl animate-fadeIn focus:outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-40 flex items-start justify-center z-[1000] p-4 overflow-y-auto"
        shouldCloseOnOverlayClick={!isProcessingNotificationAction}
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Trung tâm Thông báo</h2>
        <div className="flex border-b mb-3">
          <button
            onClick={() => { setCurrentNotificationTab('pending'); fetchNotificationsByStatus('pending'); }}
            className={`py-2 px-4 text-sm font-medium transition-colors duration-150 ${currentNotificationTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`}
            disabled={isNotificationsLoading || isProcessingNotificationAction}
          >
            Chưa xử lý ({notifications.filter(n => n.status === 'pending').length})
          </button>
          <button
            onClick={() => { setCurrentNotificationTab('processed'); fetchNotificationsByStatus('processed'); }}
            className={`py-2 px-4 text-sm font-medium transition-colors duration-150 ${currentNotificationTab === 'processed' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-blue-600'}`}
            disabled={isNotificationsLoading || isProcessingNotificationAction}
          >
            Đã xử lý
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1">
          {isNotificationsLoading && currentNotificationTab === 'pending' && (
            <div className="text-center py-4 text-gray-500">Đang tải thông báo...</div>
          )}
          {!isNotificationsLoading && notifications.filter(n => n.status === currentNotificationTab).length === 0 && (
            <p className="text-gray-500 text-center py-4">Không có thông báo nào.</p>
          )}
          {!isNotificationsLoading && notifications
            .filter(n => n.status === currentNotificationTab)
            .map(notification => (
              <div key={notification._id} className="border-b border-gray-200 py-2.5 last:border-b-0">
                <p className="text-gray-700 text-sm leading-relaxed">{notification.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {notification.projectId?.name ? `CT: ${notification.projectId.name} (${notification.projectModel === 'CategoryProject' ? 'DM' : 'SCN'})` : 'Thông báo chung'}
                  {' - '}
                  {new Date(notification.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                {currentNotificationTab === 'pending' && user?.permissions?.approve && notification.projectId?._id && (
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => handleAction(notification.type === 'edit' ? approveEditAction : approveDeleteAction, notification.projectId._id)}
                      className={`bg-green-500 text-white px-2.5 py-1 text-xs rounded-md hover:bg-green-600 disabled:opacity-60 flex items-center ${isProcessingNotificationAction ? 'cursor-not-allowed' : ''}`}
                      disabled={isProcessingNotificationAction}
                    >
                      <FaCheckCircle className="mr-1" /> {isProcessingNotificationAction ? "Đang..." : "Duyệt"}
                    </button>
                    <button
                      onClick={() => handleAction(notification.type === 'edit' ? rejectEditAction : rejectDeleteAction, notification.projectId._id)}
                      className={`bg-red-500 text-white px-2.5 py-1 text-xs rounded-md hover:bg-red-600 disabled:opacity-60 flex items-center ${isProcessingNotificationAction ? 'cursor-not-allowed' : ''}`}
                      disabled={isProcessingNotificationAction}
                    >
                      <FaTimesCircle className="mr-1" /> {isProcessingNotificationAction ? "Đang..." : "Từ chối"}
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
        <button
          onClick={() => { if (!isProcessingNotificationAction) setShowNotificationsModal(false); }}
          className={`mt-4 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 w-full text-sm ${isProcessingNotificationAction ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isProcessingNotificationAction}
        >
          Đóng
        </button>
      </Modal>
    </header>
  );
}

export default Header;