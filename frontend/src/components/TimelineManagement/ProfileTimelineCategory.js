// d:\CODE\water-company\frontend\src\components\TimelineManagement\ProfileTimelineCategory.js
import React, { useState, useMemo } from 'react';
import { useTimelineData } from './TimelineLogic';
import TimelineGanttChart from './TimelineGanttChart';
import TimelineAssignmentModal from './TimelineAssignmentModal'; // Import modal
import { FaUserTie, FaCalendarPlus } from 'react-icons/fa'; // Thêm icon
import { toast } from 'react-toastify'; // Thêm import toast
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Thêm useQueryClient
import { getUsers, getHolidaysForYearAPI } from '../../apiService';

const ProfileTimelineCategory = ({ user, addMessage }) => {
  const currentYear = new Date().getFullYear();
  const [selectedEstimator, setSelectedEstimator] = useState(''); // ID của người lập dự toán
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  const { data: usersList = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: !!user,
  });
  const {
    timelineTasks,
    isLoading,
    financialYear,
    setFinancialYear,
    projectsToAssign, // Lấy danh sách công trình cần phân công
    isLoadingProjectsToAssign,
    saveTimelineAssignments, // Hàm lưu
    isSavingAssignments,
    handleDateChange, // Nhận handler onDateChange từ useTimelineData
    handleProgressChange, // Nhận handler onProgressChange
    isUpdatingTimelineTask, // Nhận trạng thái loading
  } = useTimelineData({
    user,
    timelineType: 'profile',
    objectType: 'category',
    initialYear: currentYear,
    // Chỉ truyền estimatorId nếu nó có giá trị, để useTimelineData có thể fetch all khi rỗng
    filterParams: selectedEstimator ? { estimatorId: selectedEstimator } : {},
  });

  // financialYear được lấy từ useTimelineData ở trên
  const { data: holidaysData } = useQuery({
    // Query key phụ thuộc vào financialYear, đảm bảo nó chỉ chạy khi financialYear có giá trị
    queryKey: ['holidays', financialYear], 
    queryFn: () => getHolidaysForYearAPI(financialYear),
    // enabled: !!user && !!financialYear && showAssignmentModal, // Đảm bảo financialYear có giá trị
    // Sửa enabled: chỉ fetch khi financialYear đã được định nghĩa và modal được hiển thị
    enabled: !!user && typeof financialYear === 'number' && showAssignmentModal,
    staleTime: 1000 * 60 * 60, // Cache 1 giờ
  });

  const holidaysForModal = useMemo(() => holidaysData?.holidays?.map(h => h.date.split('T')[0]) || [], [holidaysData]);
  const estimators = useMemo(() => usersList.filter(u => u.role && (u.role.includes('staff') || u.role.includes('manager'))), [usersList]);
  const financialYearOptions = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const handleTaskClick = (project) => {
    // console.log('Task clicked:', project);
    // Hiển thị modal chi tiết công việc hoặc điều hướng
    addMessage(`Đã click vào công trình: ${project.name}`, 'info');
  };

  const handleOpenAssignmentModal = () => {
    if (!selectedEstimator) {
      toast.warn('Vui lòng chọn một Người lập dự toán để phân công.', { position: "top-center" });
      return;
    }
    setShowAssignmentModal(true);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Timeline Hồ sơ - Công trình Danh mục</h2>
      <div className="mb-4 p-4 bg-gray-50 rounded-lg shadow border flex flex-wrap items-end gap-4">
        <div className="flex-shrink-0">
          <label htmlFor="financialYear" className="block text-sm font-medium text-gray-700 mb-1">Năm tài chính</label>
          <select
            id="financialYear"
            value={financialYear}
            onChange={(e) => setFinancialYear(parseInt(e.target.value))}
            className="form-select rounded-md shadow-sm"
            disabled={isLoading}
          >
            {financialYearOptions.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div className="flex-grow">
          <label htmlFor="estimatorFilter" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <FaUserTie className="mr-1 text-gray-600"/> Người lập dự toán
          </label>
          <select
            id="estimatorFilter"
            value={selectedEstimator}
            onChange={(e) => setSelectedEstimator(e.target.value)}
            className="form-select rounded-md shadow-sm w-full"
            disabled={isLoading || estimators.length === 0}
          >
            <option value="">Tất cả người lập DT</option>
            {estimators.map(est => <option key={est._id} value={est._id}>{est.fullName || est.username}</option>)}
          </select>
        </div>
        {user?.permissions?.assignProfileTimeline && (
          <button
            onClick={handleOpenAssignmentModal}
            className="btn btn-primary flex items-center gap-2 self-end"
            disabled={isLoading || isLoadingProjectsToAssign || !selectedEstimator}
          >
            <FaCalendarPlus /> Phân công Timeline
          </button>
        )}
      </div>

      {showAssignmentModal && selectedEstimator && (
        <TimelineAssignmentModal
          isOpen={showAssignmentModal}
          onRequestClose={() => setShowAssignmentModal(false)}
          title={`Phân công Timeline Hồ sơ cho: ${estimators.find(e=>e._id === selectedEstimator)?.fullName || 'N/A'} - Năm ${financialYear}`}
          projectsToAssign={projectsToAssign}
          assignToObject={{ estimatorId: selectedEstimator }}
          financialYear={financialYear}
          onSaveAssignments={saveTimelineAssignments}
          isSaving={isSavingAssignments}
          timelineType="profile"
          objectType="category"
          holidays={holidaysForModal} // Truyền ngày nghỉ vào modal
        />
      )}

      {isLoading && <div className="text-center py-10">Đang tải dữ liệu timeline...</div>}
      {!isLoading && (
        <TimelineGanttChart
          key={financialYear} // Thêm key để buộc render lại khi năm thay đổi
          tasks={timelineTasks}
          viewMode="Week" // Hoặc 'Day', 'Month'
          onTaskClick={handleTaskClick}
          onDateChange={handleDateChange} // Truyền xuống Gantt
          onProgressChange={handleProgressChange} // Truyền xuống Gantt
        />
      )}
    </div>
  );
};

export default ProfileTimelineCategory;
