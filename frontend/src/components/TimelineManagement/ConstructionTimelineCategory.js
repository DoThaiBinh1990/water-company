// d:\CODE\water-company\frontend\src\components\TimelineManagement\ConstructionTimelineCategory.js
import React, { useState, useMemo } from 'react';
import { useTimelineData } from './TimelineLogic';
import TimelineGanttChart from './TimelineGanttChart';
import TimelineAssignmentModal from './TimelineAssignmentModal';
import { FaHardHat, FaCalendarPlus } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { ViewMode } from 'gantt-task-react'; // Import ViewMode
import { getConstructionUnits, getHolidaysForYearAPI } from '../../apiService';
import { toast } from 'react-toastify';

const ConstructionTimelineCategory = ({ user, addMessage }) => {
  const currentYear = new Date().getFullYear();
  const [selectedConstructionUnit, setSelectedConstructionUnit] = useState('');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [currentGanttViewMode, setCurrentGanttViewMode] = useState(ViewMode.Week); // State cho viewMode

  const { data: constructionUnitsList = [] } = useQuery({
    queryKey: ['constructionUnits'],
    queryFn: getConstructionUnits,
    enabled: !!user,
  });

  const {
    timelineTasks,
    isLoading,
    financialYear,
    setFinancialYear,
    handleDateChange,
    handleProgressChange,
    projectsToAssign,
    isLoadingProjectsToAssign,
    saveTimelineAssignments,
    isUpdatingTimelineTask,
    handleSaveActualProgress, // Lấy hàm này từ hook
  } = useTimelineData({
    user,
    timelineType: 'construction',
    objectType: 'category',
    initialYear: currentYear,
    filterParams: { constructionUnitName: selectedConstructionUnit },
  });

  const { data: holidaysData } = useQuery({
    queryKey: ['holidays', financialYear],
    queryFn: () => getHolidaysForYearAPI(financialYear),
    enabled: !!user && typeof financialYear === 'number' && showAssignmentModal,
    staleTime: 1000 * 60 * 60, // Cache 1 giờ
  });

  const holidaysForModal = useMemo(() => holidaysData?.holidays?.map(h => h.date.split('T')[0]) || [], [holidaysData]);
  const financialYearOptions = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const handleTaskClick = (project) => {
    // addMessage(`Đã click vào công trình: ${project.name}`, 'info'); // Bỏ thông báo này
  };

  const handleOpenAssignmentModal = () => {
    if (!selectedConstructionUnit) {
      toast.warn('Vui lòng chọn một Đơn vị thi công để phân công.', { position: "top-center" });
      return;
    }
    setShowAssignmentModal(true);
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="bg-white p-6 rounded-xl shadow-xl mb-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-blue-700 mb-1">Timeline Thi công - Công trình Danh mục</h2>
        <p className="text-sm text-gray-500 mb-6">Quản lý và theo dõi tiến độ thi công cho các công trình danh mục.</p>

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
            <label htmlFor="constructionUnitFilter" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <FaHardHat className="mr-1 text-gray-600"/> Đơn vị thi công
            </label>
            <select
              id="constructionUnitFilter"
              value={selectedConstructionUnit}
              onChange={(e) => setSelectedConstructionUnit(e.target.value)}
              className="form-select w-full rounded-lg shadow-md border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150"
              disabled={isLoading || isUpdatingTimelineTask || constructionUnitsList.length === 0}
            >
              <option value="">Tất cả đơn vị TC</option>
              {constructionUnitsList.map(unit => <option key={unit._id || unit.name} value={unit.name}>{unit.name}</option>)}
            </select>
          </div>
          {user?.permissions?.assignConstructionTimeline && (
            <button
              onClick={handleOpenAssignmentModal}
              className="btn btn-primary md:col-span-1 flex items-center justify-center gap-2 text-sm h-10 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              disabled={isLoading || isUpdatingTimelineTask || isLoadingProjectsToAssign || !selectedConstructionUnit}
            >
              <FaCalendarPlus /> Phân công Timeline
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700 self-center">Chế độ xem:</span>
          {[ViewMode.Day, ViewMode.Week, ViewMode.Month].map(mode => (
            <button key={mode} onClick={() => setCurrentGanttViewMode(mode)} className={`btn btn-xs ${currentGanttViewMode === mode ? 'btn-primary-focus' : 'btn-secondary'}`}>
              {mode === ViewMode.Day ? 'Ngày' : mode === ViewMode.Week ? 'Tuần' : 'Tháng'}
            </button>
          ))}
        </div>
      </div>

      {showAssignmentModal && selectedConstructionUnit && (
        <TimelineAssignmentModal
          isOpen={showAssignmentModal}
          onRequestClose={() => setShowAssignmentModal(false)}
          title={`Phân công Timeline Thi công (DM) cho: ${selectedConstructionUnit} - Năm ${financialYear}`}
          projectsToAssign={projectsToAssign}
          assignToObject={{ constructionUnitName: selectedConstructionUnit }}
          financialYear={financialYear}
          onSaveAssignments={saveTimelineAssignments}
          isSaving={isUpdatingTimelineTask}
          timelineType="construction"
          objectType="category"
          holidays={holidaysForModal}
        />
      )}

      {isLoading && <div className="text-center py-10 text-gray-600">Đang tải dữ liệu timeline...</div>}
      {!isLoading && (
        <div className="bg-white p-1 rounded-xl shadow-xl border border-gray-200">
          <TimelineGanttChart
            // key={`${financialYear}-${selectedConstructionUnit}`} // Đã xóa key ở đây
            tasks={timelineTasks}
            initialViewMode={currentGanttViewMode} // Truyền viewMode động
            onTaskClick={handleTaskClick}
            onDateChange={handleDateChange}
            onProgressChange={handleProgressChange}
            timelineType="construction"
            holidays={holidaysForModal} // Pass holidays
            isUpdatingTimelineTask={isUpdatingTimelineTask}
            onSaveActualProgress={handleSaveActualProgress} // Truyền prop xuống GanttChart
          />
        </div>
      )}

    </div>
  );
};

export default ConstructionTimelineCategory;
