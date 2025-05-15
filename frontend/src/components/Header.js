import React, { useState, useEffect } from 'react';
import { FaBell, FaCheckCircle, FaTimesCircle, FaUserCircle, FaBars, FaTimes } from 'react-icons/fa';
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
  setIsProcessingNotificationAction,
  isSidebarOpen,
  setIsSidebarOpen,
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

  const [tabFade, setTabFade] = useState(false);

  useEffect(() => {
    setTabFade(true);
  }, [currentNotificationTab]);

  const unreadNotificationsCount = notifications.filter(n => n.status === 'pending').length;

  return (
    <>
      <header className={`bg-gradient-to-r from-blue-800 to-blue-600 shadow-lg h-12 px-4 flex justify-between items-center fixed top-0 z-[1000] transition-all duration-300 left-0 right-0 ${isSidebarOpen ? 'md:left-64' : 'md:left-16'}`}>
        <div className="flex items-center gap-2">
          <button
            className="md:hidden p-2 rounded-full bg-blue-700 text-white hover:bg-blue-800 transition-all duration-200 transform hover:scale-105"
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
              if (currentNotificationTab !== 'pending') {
                setCurrentNotificationTab('pending');
                fetchNotificationsByStatus('pending');
              } else {
                fetchNotificationsByStatus('pending');
              }
            }}
            className={`relative bell-icon p-2 rounded-full bg-blue-600 hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 ${unreadNotificationsCount > 0 ? 'has-notifications' : ''}`}
            aria-label="Thông báo"
            disabled={isNotificationsLoading || isProcessingNotificationAction}
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
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 1000000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          content: {
            position: 'relative',
            maxWidth: '672px',
            width: '91.666667%',
            maxHeight: '80vh',
            overflowY: 'auto',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
            border: '1px solid #E5E7EB',
            padding: '16px',
            zIndex: 1000001,
            inset: 'auto',
          }
        }}
        shouldCloseOnOverlayClick={!isProcessingNotificationAction}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937' }}>
            Trung tâm Thông báo
          </h2>
          <button
            onClick={() => { if (!isProcessingNotificationAction) setShowNotificationsModal(false); }}
            style={{
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: '#F3F4F6',
              color: '#6B7280',
              transition: 'all 0.2s',
              cursor: isProcessingNotificationAction ? 'not-allowed' : 'pointer',
              opacity: isProcessingNotificationAction ? 0.5 : 1,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E5E7EB'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
            disabled={isProcessingNotificationAction}
            aria-label="Đóng"
          >
            <FaTimes size={16} />
          </button>
        </div>
        <div style={{ borderBottom: '1px solid #E5E7EB', marginBottom: '16px' }}>
          <button
            onClick={() => { setCurrentNotificationTab('pending'); fetchNotificationsByStatus('pending'); }}
            style={{
              padding: '8px 16px',
              fontWeight: '500',
              fontSize: '14px',
              borderBottom: currentNotificationTab === 'pending' ? '2px solid #3B82F6' : '2px solid transparent',
              color: currentNotificationTab === 'pending' ? '#3B82F6' : '#6B7280',
              backgroundColor: currentNotificationTab === 'pending' ? '#EFF6FF' : 'transparent',
              marginRight: '0',
              transition: 'all 0.2s',
              cursor: isNotificationsLoading || isProcessingNotificationAction ? 'not-allowed' : 'pointer',
              opacity: isNotificationsLoading || isProcessingNotificationAction ? 0.5 : 1,
            }}
            disabled={isNotificationsLoading || isProcessingNotificationAction}
          >
            Chưa xử lý ({unreadNotificationsCount})
          </button>
          <button
            onClick={() => { setCurrentNotificationTab('processed'); fetchNotificationsByStatus('processed'); }}
            style={{
              padding: '8px 16px',
              fontWeight: '500',
              fontSize: '14px',
              borderBottom: currentNotificationTab === 'processed' ? '2px solid #3B82F6' : '2px solid transparent',
              color: currentNotificationTab === 'processed' ? '#3B82F6' : '#6B7280',
              backgroundColor: currentNotificationTab === 'processed' ? '#EFF6FF' : 'transparent',
              transition: 'all 0.2s',
              cursor: isNotificationsLoading || isProcessingNotificationAction ? 'not-allowed' : 'pointer',
              opacity: isNotificationsLoading || isProcessingNotificationAction ? 0.5 : 1,
            }}
            disabled={isNotificationsLoading || isProcessingNotificationAction}
          >
            Đã xử lý
          </button>
        </div>

        <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '8px', opacity: tabFade ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}>
          {isNotificationsLoading && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#6B7280' }}>
              Đang tải thông báo...
            </div>
          )}
          {!isNotificationsLoading && notifications.filter(n => n.status === currentNotificationTab).length === 0 && (
            <p style={{ color: '#6B7280', textAlign: 'center', padding: '24px 0' }}>
              Không có thông báo nào.
            </p>
          )}
          {!isNotificationsLoading && notifications
            .filter(n => n.status === currentNotificationTab)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(notification => (
              <div
                key={notification._id}
                style={{
                  borderBottom: '1px solid #E5E7EB',
                  padding: '12px 16px',
                  backgroundColor: '#F9FAFB',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'}
              >
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#1F2937' }}>
                  {notification.message}
                </p>
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                  {notification.projectId?.name ? `CT: ${notification.projectId.name} (${notification.projectModel === 'CategoryProject' ? 'DM' : 'SCN'})` : 'Thông báo chung'}
                  {' - '}
                  {new Date(notification.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                {currentNotificationTab === 'pending' && user?.permissions?.approve && notification.projectId?._id && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button
                      onClick={() => handleAction(notification.type === 'edit' ? approveEditAction : approveDeleteAction, notification.projectId._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px',
                        borderRadius: '9999px',
                        color: '#10B981',
                        backgroundColor: '#DCFCE7',
                        transition: 'all 0.2s',
                        cursor: isProcessingNotificationAction ? 'not-allowed' : 'pointer',
                        opacity: isProcessingNotificationAction ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BBF7D0'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DCFCE7'}
                      disabled={isProcessingNotificationAction}
                    >
                      <FaCheckCircle size={16} /> {isProcessingNotificationAction ? "Đang..." : "Duyệt"}
                    </button>
                    <button
                      onClick={() => handleAction(notification.type === 'edit' ? rejectEditAction : rejectDeleteAction, notification.projectId._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px',
                        borderRadius: '9999px',
                        color: '#F59E0B',
                        backgroundColor: '#FEF3C7',
                        transition: 'all 0.2s',
                        cursor: isProcessingNotificationAction ? 'not-allowed' : 'pointer',
                        opacity: isProcessingNotificationAction ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FDE68A'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEF3C7'}
                      disabled={isProcessingNotificationAction}
                    >
                      <FaTimesCircle size={16} /> {isProcessingNotificationAction ? "Đang..." : "Từ chối"}
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
        <button
          onClick={() => { if (!isProcessingNotificationAction) setShowNotificationsModal(false); }}
          style={{
            width: '100%',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            backgroundColor: '#6B7280',
            color: 'white',
            marginTop: '24px',
            transition: 'all 0.3s',
            cursor: isProcessingNotificationAction ? 'not-allowed' : 'pointer',
            opacity: isProcessingNotificationAction ? 0.5 : 1,
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4B5563'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6B7280'}
          disabled={isProcessingNotificationAction}
        >
          Đóng
        </button>
      </Modal>
    </>
  );
}

export default Header;