import Modal from 'react-modal';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { toast } from 'react-toastify';

Modal.setAppElement('#root');

function CategoryProjectForm({
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
  allocationWavesList,
  constructionUnitsList,
  usersList,
  initialNewProjectState,
  setNewProject,
}) {
  const [activeTab, setActiveTab] = useState('basic');
  const [approvers, setApprovers] = useState([]); // Danh sách người duyệt
  const [projectTypes, setProjectTypes] = useState([]); // Danh sách loại công trình

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

    const fetchProjectTypes = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/project-types`);
        setProjectTypes(response.data.map(type => type.name));
      } catch (error) {
        console.error("Lỗi tải danh sách loại công trình:", error);
        toast.error("Không thể tải danh sách loại công trình!", { position: "top-center" });
        setProjectTypes([]);
      }
    };

    if (showModal) {
      fetchApprovers();
      fetchProjectTypes();
    }
  }, [showModal]);

  const handleSaveClick = () => {
    console.log("Nút Lưu được nhấn, gọi hàm saveProject...");
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
          {editProject ? 'Sửa công trình danh mục' : 'Thêm công trình danh mục'}
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
                  Tên danh mục <span className="text-red-500">*</span>
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
                <label className="form-label" style={{ color: '#ef4444', fontWeight: '500' }}>
                  Loại công trình <span className="text-red-500">*</span>
                </label>
                <select
                  name="projectType"
                  value={newProject.projectType}
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
                  <option value="">Chọn loại công trình</option>
                  {projectTypes.map((type, index) => (
                    <option key={index} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#ef4444', fontWeight: '500' }}>
                  Quy mô <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="scale"
                  value={newProject.scale}
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
                  Địa điểm XD <span className="text-red-500">*</span>
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
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Người phê duyệt
                </label>
                <select
                  name="approvedBy"
                  value={newProject.approvedBy || ''}
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
                  Phân bổ đợt
                </label>
                <select
                  name="allocationWave"
                  value={newProject.allocationWave}
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
                  <option value="">Chọn đợt</option>
                  {allocationWavesList.map((wave, index) => (
                    <option key={index} value={wave}>
                      {wave}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Người lập hồ sơ dự toán
                </label>
                <select
                  name="estimator"
                  value={newProject.estimator}
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
                  <option value="">Chọn nhân viên</option>
                  {usersList.map((user, index) => (
                    <option key={index} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Người theo dõi
                </label>
                <select
                  name="supervisor"
                  value={newProject.supervisor}
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
                  {usersList.map((user, index) => (
                    <option key={index} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Số ngày thực hiện
                </label>
                <input
                  type="text"
                  name="durationDays"
                  value={newProject.durationDays}
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

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Ngày bắt đầu lập hs dự toán
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={newProject.startDate}
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
                  Ngày hoàn thành hs dự toán
                </label>
                <input
                  type="date"
                  name="completionDate"
                  value={newProject.completionDate}
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
                  Bút phê lãnh đạo
                </label>
                <input
                  type="text"
                  name="leadershipApproval"
                  value={newProject.leadershipApproval}
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
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Giá trị phân bổ (Triệu đồng)
                </label>
                <input
                  type="text"
                  name="initialValue"
                  value={newProject.initialValue}
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

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Giá trị dự toán (Triệu đồng)
                </label>
                <input
                  type="text"
                  name="estimatedValue"
                  value={newProject.estimatedValue}
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

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Giá trị giao khoán (Triệu đồng)
                </label>
                <input
                  type="text"
                  name="contractValue"
                  value={newProject.contractValue}
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

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Đơn vị thi công
                </label>
                <select
                  name="constructionUnit"
                  value={newProject.constructionUnit}
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
                  <option value="">Chọn đơn vị</option>
                  {constructionUnitsList.map((unit, index) => (
                    <option key={index} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>
                  Tiến độ thi công
                </label>
                <input
                  type="text"
                  name="progress"
                  value={newProject.progress}
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
                  Khả năng thực hiện
                </label>
                <input
                  type="text"
                  name="feasibility"
                  value={newProject.feasibility}
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
            console.log("Nút Hủy được nhấn...");
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
          disabled={isSubmitting || !newProject.name || !newProject.allocatedUnit || !newProject.projectType || !newProject.scale || !newProject.location}
        >
          {isSubmitting ? 'Đang lưu...' : editProject ? 'Cập nhật' : 'Lưu'}
        </button>
      </div>
    </Modal>
  );
}

export default CategoryProjectForm;