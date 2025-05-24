// d:\CODE\water-company\frontend\src\components\TimelineManagement\ActualProgressModal.js
import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { FaSave, FaTimes, FaCalendarAlt, FaStickyNote, FaPercentage } from 'react-icons/fa';
import { toast } from 'react-toastify';

Modal.setAppElement('#root'); // Hoặc phần tử gốc của ứng dụng bạn

const ActualProgressModal = ({
  isOpen,
  onRequestClose,
  taskProjectData, // Dữ liệu gốc của project (task._originalTask.project)
  onSave,
  isSaving,
  timelineType, // 'profile' or 'construction'
}) => {
  const [actualStartDate, setActualStartDate] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    if (isOpen && taskProjectData) {
      const timeline = timelineType === 'profile'
        ? taskProjectData.profileTimeline
        : taskProjectData.constructionTimeline;

      setActualStartDate(timeline?.actualStartDate ? new Date(timeline.actualStartDate).toISOString().split('T')[0] : '');
      setActualEndDate(timeline?.actualEndDate ? new Date(timeline.actualEndDate).toISOString().split('T')[0] : '');
      setProgress(timeline?.progress || 0);
      setStatusNotes(timeline?.statusNotes || '');
    } else if (!isOpen) {
      // Reset form khi modal đóng
      setActualStartDate('');
      setActualEndDate('');
      setProgress(0);
      setStatusNotes('');
    }
  }, [isOpen, taskProjectData, timelineType]);

  const handleSave = () => {
    if (actualStartDate && actualEndDate && new Date(actualEndDate) < new Date(actualStartDate)) {
      toast.error("Ngày kết thúc thực tế không thể trước ngày bắt đầu thực tế.");
      return;
    }
    if (progress < 0 || progress > 100) {
      toast.error("Tiến độ phải từ 0 đến 100.");
      return;
    }
    onSave({
      actualStartDate: actualStartDate || null,
      actualEndDate: actualEndDate || null,
      progress: parseInt(progress, 10) || 0,
      statusNotes: statusNotes.trim(),
    });
  };

  const projectDisplayName = taskProjectData?.name || 'Công trình không xác định';

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{
        overlay: {
          zIndex: 1051, // Cao hơn TimelineAssignmentModal
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
        content: {
          position: 'relative', inset: 'auto',
          maxWidth: '550px', width: '90%', maxHeight: '90vh',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
          padding: '0', border: 'none', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', background: '#fff',
        }
      }}
      contentLabel={`Cập nhật Tiến độ Thực tế cho: ${projectDisplayName}`}
      shouldCloseOnOverlayClick={!isSaving}
    >
      <div className="p-6 bg-gray-800 text-white border-b border-gray-700 flex justify-between items-center rounded-t-lg">
        <h2 className="text-lg font-semibold">Cập nhật Tiến độ Thực tế</h2>
        <button onClick={onRequestClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors" disabled={isSaving}>
          <FaTimes size={16} />
        </button>
      </div>

      <div className="p-6 space-y-4 flex-grow">
        <p className="text-sm text-gray-700 mb-1">Công trình: <strong className="text-blue-600">{projectDisplayName}</strong></p>
        <hr/>
        <div>
          <label htmlFor="actualStartDate" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <FaCalendarAlt className="mr-2 text-gray-500" /> Ngày Bắt đầu Thực tế
          </label>
          <input
            type="date"
            id="actualStartDate"
            value={actualStartDate}
            onChange={(e) => setActualStartDate(e.target.value)}
            className="form-input w-full rounded-lg shadow-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            disabled={isSaving}
          />
        </div>
        <div>
          <label htmlFor="actualEndDate" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <FaCalendarAlt className="mr-2 text-gray-500" /> Ngày Hoàn thành Thực tế
          </label>
          <input
            type="date"
            id="actualEndDate"
            value={actualEndDate}
            onChange={(e) => setActualEndDate(e.target.value)}
            className="form-input w-full rounded-lg shadow-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            disabled={isSaving}
          />
        </div>
        <div>
          <label htmlFor="progress" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <FaPercentage className="mr-2 text-gray-500" /> Tiến độ (%)
          </label>
          <input
            type="number"
            id="progress"
            value={progress}
            onChange={(e) => setProgress(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
            min="0"
            max="100"
            className="form-input w-full rounded-lg shadow-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            disabled={isSaving}
          />
        </div>
        <div>
          <label htmlFor="statusNotes" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <FaStickyNote className="mr-2 text-gray-500" /> Ghi chú Thực tế
          </label>
          <textarea
            id="statusNotes"
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            rows="3"
            className="form-textarea w-full rounded-lg shadow-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            placeholder="Nhập ghi chú về tình hình thực tế..."
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="p-4 bg-gray-100 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
        <button
          type="button"
          onClick={onRequestClose}
          disabled={isSaving}
          className="btn btn-secondary flex items-center gap-2"
        >
          <FaTimes /> Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-primary flex items-center gap-2"
        >
          <FaSave /> {isSaving ? 'Đang lưu...' : 'Lưu Thay đổi'}
        </button>
      </div>
    </Modal>
  );
};

export default ActualProgressModal;
