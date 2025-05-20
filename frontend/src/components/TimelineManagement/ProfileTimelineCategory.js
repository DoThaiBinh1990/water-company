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
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
    <div className="bg-white p-6 rounded-xl shadow-xl mb-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-blue-700 mb-1">Timeline Hồ sơ - Công trình Danh mục</h2>
        <p className="text-sm text-gray-500 mb-6">Quản lý và theo dõi tiến độ lập hồ sơ dự toán cho các công trình danh mục.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label htmlFor="financialYear" className="block text-sm font-medium text-gray-700 mb-1">Năm tài chính</label>
            <select
              id="financialYear"
              value={financialYear}
              onChange={(e) => setFinancialYear(parseInt(e.target.value))}
              className="form-select w-full rounded-lg shadow-md border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150"
              disabled={isLoading || isUpdatingTimelineTask}
            >
              {financialYearOptions.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="estimatorFilter" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <FaUserTie className="mr-2 text-gray-500"/> Người lập dự toán
            </label>
            <select
              id="estimatorFilter"
              value={selectedEstimator}
              onChange={(e) => setSelectedEstimator(e.target.value)}
              className="form-select w-full rounded-lg shadow-md border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150"
              disabled={isLoading || isUpdatingTimelineTask || estimators.length === 0}
            >
              <option value="">-- Tất cả người lập DT --</option>
              {estimators.map(est => <option key={est._id} value={est._id}>{est.fullName || est.username}</option>)}
            </select>
          </div>
          {user?.permissions?.assignProfileTimeline && (
            <button
              onClick={handleOpenAssignmentModal}
          className="btn btn-primary md:col-span-1 flex items-center justify-center gap-2 text-sm h-10 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              disabled={isLoading || isUpdatingTimelineTask || isLoadingProjectsToAssign || !selectedEstimator}
            >
              <FaCalendarPlus /> Phân công Timeline
            </button>
          )}
        </div>
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

      {isLoading && <div className="text-center py-10 text-gray-600">Đang tải dữ liệu timeline...</div>}
      {!isLoading && (
    <div className="bg-white p-1 rounded-xl shadow-xl border border-gray-200">
          <TimelineGanttChart
            key={`${financialYear}-${selectedEstimator}`} // Key nên bao gồm cả filter để re-render khi filter thay đổi
            tasks={timelineTasks}
            viewMode="Week"
            onTaskClick={handleTaskClick}
            onDateChange={handleDateChange}
            onProgressChange={handleProgressChange}
            timelineType="profile" // Truyền timelineType xuống
          />
        </div>
      )}
    </div>
  );
};

export default ProfileTimelineCategory;
