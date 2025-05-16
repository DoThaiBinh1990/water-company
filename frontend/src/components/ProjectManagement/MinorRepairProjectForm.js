import Modal from 'react-modal';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from 'config';
import { toast } from 'react-toastify';

Modal.setAppElement('#root');

function MinorRepairProjectForm({
  showModal,
  setShowModal,
  isSubmitting,
  editProject,
  newProject,
  handleInputChange,
  handleNumericInputChange,
  saveProject,
  user,
  allocatedUnits,
  initialNewProjectState,
  setNewProject,
  usersList,
}) {
  const [activeTab, setActiveTab] = useState('basic');
  const [approvers, setApprovers] = useState([]); // Danh sách người duyệt

  useEffect(() => {
    const fetchApprovers = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users`);
        // Lọc những người có quyền approve
        const approversList = response.data.filter(user => user.permissions.approve);
        setApprovers(approversList);
      } catch (error) {
        console.error("Lỗi tải danh sách người duyệt:", error);
        toast.error("Không thể tải danh sách người duyệt!", { position: "top-center" });
        setApprovers([]);
      }
    };

    if (showModal) {
      fetchApprovers();
    }
  }, [showModal]);

  const handleSaveClick = () => {
    saveProject();
  };

  return (
    <Modal
      isOpen={showModal}
      onRequestClose={() => setShowModal(false)}
      style={{
        overlay: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          backgroundColor: '#f9fafb',
          borderRadius: '16px',
          boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
          border: 'none',
          padding: '24px',
          zIndex: 1000001,
          inset: 'auto',
        },
      }}
    >
      <div className="modal-header">
        <h2 className="text-2xl font-semibold text-gray-800">
          {editProject ? 'Sửa công trình sửa chữa nhỏ' : 'Thêm công trình sửa chữa nhỏ'}
        </h2>
      </div>

      <div className="modal-body">
        {/* Tab navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
          <button
            onClick={() => setActiveTab('basic')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'basic' ? '#60a5fa' : '#f3f4f6',
              color: activeTab === 'basic' ? 'white' : '#374151',
              border: 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              cursor: 'pointer',
              marginRight: '4px',
              fontWeight: '500',
              transition: 'all 0.3s ease',
            }}
          >
            Cơ bản
          </button>
          <button
            onClick={() => setActiveTab('assignment')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'assignment' ? '#60a5fa' : '#f3f4f6',
              color: activeTab === 'assignment' ? 'white' : '#374151',
              border: 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              cursor: 'pointer',
              marginRight: '4px',
              fontWeight: '500',
              transition: 'all 0.3s ease',
            }}
          >
            Phân công
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'progress' ? '#60a5fa' : '#f3f4f6',
              color: activeTab === 'progress' ? 'white' : '#374151',
              border: 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.3s ease',
            }}
          >
            Cập nhật tiến độ
          </button>
        </div>

        {/* Tab content */}
        <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)', backgroundColor: 'white' }}>
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#ef4444', fontWeight: '500' }}>
                  Tên công trình <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={newProject.name}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #fee2e2',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f87171';
                    e.target.style.boxShadow = '0 0 0 3px rgba(248, 113, 113, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#fee2e2';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#ef4444', fontWeight: '500' }}>
                  Đơn vị phân bổ <span className="text-red-500">*</span>
                </label>
                <select
                  name="allocatedUnit"
                  value={newProject.allocatedUnit}
                  onChange={handleInputChange}
                  className="form-select"
                  required
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #fee2e2',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f87171';
                    e.target.style.boxShadow = '0 0 0 3px rgba(248, 113, 113, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#fee2e2';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Chọn đơn vị</option>
                  {allocatedUnits.map((unit, index) => (
                    <option key={index} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Địa điểm <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={newProject.location}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Quy mô <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="scale"
                  value={newProject.scale}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Ngày xảy ra sự cố <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="reportDate"
                  value={newProject.reportDate}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Người phê duyệt <span className="text-red-500">*</span>
                </label>
                <select
                  name="approvedBy"
                  value={newProject.approvedBy || ''}
                  onChange={handleInputChange}
                  className="form-select"
                  required
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Chọn người phê duyệt</option>
                  {approvers.map((approver) => (
                    <option key={approver._id} value={approver._id}>
                      {approver.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'assignment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Người theo dõi
                </label>
                <select
                  name="supervisor"
                  value={newProject.supervisor || ''}
                  onChange={handleInputChange}
                  className="form-select"
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Chọn người theo dõi</option>
                  {(Array.isArray(usersList) ? usersList : []).map((user, index) => (
                    <option key={index} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px', gridColumn: 'span 2' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Bút phê lãnh đạo
                </label>
                <textarea
                  name="leadershipApproval"
                  value={newProject.leadershipApproval}
                  onChange={handleInputChange}
                  className="form-textarea"
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    minHeight: '80px',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Ngày kiểm tra
                </label>
                <input
                  type="date"
                  name="inspectionDate"
                  value={newProject.inspectionDate}
                  onChange={handleInputChange}
                  className="form-input"
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Ngày thanh toán
                </label>
                <input
                  type="date"
                  name="paymentDate"
                  value={newProject.paymentDate}
                  onChange={handleInputChange}
                  className="form-input"
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Giá trị thanh toán (VND)
                </label>
                <input
                  type="text"
                  name="paymentValue"
                  value={newProject.paymentValue}
                  onChange={handleNumericInputChange}
                  className="form-input"
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px', gridColumn: 'span 2' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Ghi chú
                </label>
                <textarea
                  name="notes"
                  value={newProject.notes}
                  onChange={handleInputChange}
                  className="form-textarea"
                  disabled={isSubmitting}
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    width: '100%',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    minHeight: '80px',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#60a5fa';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer flex justify-end gap-6">
        <button
          onClick={() => {
            setShowModal(false);
            setNewProject(initialNewProjectState());
          }}
          className="bg-red-400 text-white text-lg font-semibold py-3 px-8 rounded-lg border border-red-500 shadow-md hover:bg-red-500 hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          Hủy
        </button>
        <button
          onClick={handleSaveClick}
          className="bg-blue-500 text-white text-lg font-semibold py-3 px-8 rounded-lg border border-blue-600 shadow-md hover:bg-blue-600 hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting || !newProject.name || !newProject.allocatedUnit || !newProject.location || !newProject.scale || !newProject.reportDate || !newProject.approvedBy}
        >
          {isSubmitting ? 'Đang lưu...' : editProject ? 'Cập nhật' : 'Lưu'}
        </button>
      </div>
    </Modal>
  );
}

export default MinorRepairProjectForm;