// d:\CODE\water-company\frontend\src\components\TimelineManagement\ConstructionTimelineMinorRepair.js
import React, { useState, useMemo } from 'react';
import { useTimelineData } from './TimelineLogic';
import TimelineGanttChart from './TimelineGanttChart';
import TimelineAssignmentModal from './TimelineAssignmentModal';
import { FaHardHat, FaCalendarPlus } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { getConstructionUnits, getHolidaysForYearAPI } from '../../apiService';
import { toast } from 'react-toastify';

const ConstructionTimelineMinorRepair = ({ user, addMessage }) => {
  const currentYear = new Date().getFullYear();
  const [selectedConstructionUnit, setSelectedConstructionUnit] = useState('');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

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
  } = useTimelineData({
    user,
    timelineType: 'construction',
    objectType: 'minor_repair',
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
    addMessage(`Đã click vào công trình: ${project.name}`, 'info');
  };

  const handleOpenAssignmentModal = () => {
    if (!selectedConstructionUnit) {
      toast.warn('Vui lòng chọn một Đơn vị thi công để phân công.', { position: "top-center" });
      return;
    }
    setShowAssignmentModal(true);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Timeline Thi công - Công trình Sửa chữa nhỏ</h2>
      <div className="mb-4 p-4 bg-gray-50 rounded-lg shadow border flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="financialYear" className="block text-sm font-medium text-gray-700 mb-1">Năm tài chính</label>
          <select
            id="financialYear"
            value={financialYear}
            onChange={(e) => setFinancialYear(parseInt(e.target.value))}
            className="form-select rounded-md shadow-sm"
            disabled={isLoading || isUpdatingTimelineTask}
          >
            {financialYearOptions.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="constructionUnitFilter" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <FaHardHat className="mr-1 text-gray-600"/> Đơn vị thi công
          </label>
          <select
            id="constructionUnitFilter"
            value={selectedConstructionUnit}
            onChange={(e) => setSelectedConstructionUnit(e.target.value)}
            className="form-select rounded-md shadow-sm"
            disabled={isLoading || isUpdatingTimelineTask || constructionUnitsList.length === 0}
          >
            <option value="">Tất cả đơn vị TC</option>
            {constructionUnitsList.map(unit => <option key={unit._id || unit.name} value={unit.name}>{unit.name}</option>)}
          </select>
        </div>
        {user?.permissions?.assignConstructionTimeline && (
          <button
            onClick={handleOpenAssignmentModal}
            className="btn btn-primary flex items-center gap-2 self-end"
            disabled={isLoading || isUpdatingTimelineTask || isLoadingProjectsToAssign || !selectedConstructionUnit}
          >
            <FaCalendarPlus /> Phân công Timeline
          </button>
        )}
      </div>

      {showAssignmentModal && selectedConstructionUnit && (
        <TimelineAssignmentModal
          isOpen={showAssignmentModal}
          onRequestClose={() => setShowAssignmentModal(false)}
          title={`Phân công Timeline Thi công (SCN) cho: ${selectedConstructionUnit} - Năm ${financialYear}`}
          projectsToAssign={projectsToAssign}
          assignToObject={{ constructionUnitName: selectedConstructionUnit }}
          financialYear={financialYear}
          onSaveAssignments={saveTimelineAssignments}
          isSaving={isUpdatingTimelineTask} // Hoặc isSavingAssignments nếu có state riêng
          timelineType="construction"
          objectType="minor_repair"
          holidays={holidaysForModal}
        />
      )}

      {isLoading && <div className="text-center py-10">Đang tải dữ liệu timeline...</div>}
      {!isLoading && (
        <TimelineGanttChart
          key={financialYear}
          tasks={timelineTasks}
          viewMode="Week"
          onTaskClick={handleTaskClick}
          onDateChange={handleDateChange}
          onProgressChange={handleProgressChange}
        />
      )}
    </div>
  );
};

export default ConstructionTimelineMinorRepair;
