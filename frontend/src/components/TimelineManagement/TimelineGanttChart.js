// d:\CODE\water-company\frontend\src\components\TimelineManagement\TimelineGanttChart.js
import React, { useState, useMemo, useEffect } from 'react';
import { Gantt, ViewMode } from 'gantt-task-react'; // Task, EventOption, StylingOption, DisplayOption không cần import trực tiếp nếu không dùng
import "gantt-task-react/dist/index.css";
import { formatDateToLocale, calculateEndDateClientSide } from '../../utils/dateUtils'; // Thêm calculateEndDateClientSide
import { useMediaQuery } from '../../hooks/useMediaQuery'; // Import hook
import ActualProgressModal from './ActualProgressModal'; // Import modal mới
import logger from '../../utils/logger'; // Import logger

const TimelineGanttChart = ({ 
  tasks: inputTasks = [], // Đổi tên để tránh nhầm lẫn và đặt giá trị mặc định
  initialViewMode = ViewMode.Week, // Đổi tên prop để rõ ràng hơn
  onTaskClick, 
  onDateChange, 
  onProgressChange, 
  timelineType, 
  holidays = [], // Danh sách ngày nghỉ cho tính toán endDate
  isUpdatingTimelineTask = false, // Thêm prop này với giá trị mặc định
  onSaveActualProgress, // Hàm callback để lưu thông tin thực tế
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  // Sử dụng trực tiếp initialViewMode, không cần state 'view' nội bộ nữa
  // useEffect để đồng bộ view không còn cần thiết nếu dùng key prop hiệu quả
  const [showActualProgressModal, setShowActualProgressModal] = useState(false);
  const [selectedTaskForActualProgress, setSelectedTaskForActualProgress] = useState(null);

  const currentViewMode = isMobile ? ViewMode.Day : initialViewMode; 
  
  // Điều chỉnh columnWidth và listCellWidth cho phù hợp hơn với các viewMode
  // listCellWidthValue là tổng chiều rộng của phần danh sách task bên trái (Tên CT, Bắt đầu, Kết thúc)
  let columnWidthValue;
  let listCellWidthValue = isMobile ? "200px" : "380px"; // Tăng chiều rộng để chứa 3 cột và tên dài hơn

  if (currentViewMode === ViewMode.Month) {
    columnWidthValue = 150; 
    listCellWidthValue = isMobile ? "180px" : "350px"; 
  } else if (currentViewMode === ViewMode.Week) {
    columnWidthValue = 120; // Tăng một chút cho view tuần
  } else { // Day, QuarterDay, HalfDay
    columnWidthValue = 80;  // Rộng hơn một chút cho view ngày để dễ đọc hơn
  }

  const formattedTasks = useMemo(() => {
    logger.debug('[TimelineGanttChart] useMemo formattedTasks triggered. Input tasks:', JSON.stringify(inputTasks, null, 2));
    const sourceTasks = Array.isArray(inputTasks) ? inputTasks : [];

    if (sourceTasks.length === 0) {
      logger.info('[TimelineGanttChart] Input tasks prop is empty.');
      return [];
    }

    // Lọc các task có id, name, và start hợp lệ ban đầu
    const validSourceTasks = sourceTasks.filter(task =>
        task &&
        typeof task.id !== 'undefined' &&
        typeof task.name === 'string' && task.name.trim() !== '' &&
        typeof task.start === 'string' && task.start.match(/^\d{4}-\d{2}-\d{2}$/) // Only require valid start here
    );

    // Tính toán overallMaxEndDate từ các task có end date hợp lệ
    let overallMaxEndDate = new Date(0);
    validSourceTasks.forEach(task => {
      if (task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const endDate = new Date(task.end);
        if (endDate > overallMaxEndDate) {
          overallMaxEndDate = endDate;
        }
      }
    });

    // Nếu không có end date hợp lệ nào, đặt mặc định là 3 tháng tới
    if (overallMaxEndDate.getTime() === new Date(0).getTime() && validSourceTasks.length > 0) {
      overallMaxEndDate = new Date();
      overallMaxEndDate.setMonth(overallMaxEndDate.getMonth() + 3);
    } else if (validSourceTasks.length === 0) {
      overallMaxEndDate = new Date();
      overallMaxEndDate.setMonth(overallMaxEndDate.getMonth() + 3);
    }

    const finalOverallMaxEndDateString = overallMaxEndDate.toISOString().split('T')[0];

    return validSourceTasks
      .map(task => {
        // task ở đây là một item từ inputTasks (dữ liệu gốc)
        // Gán _originalTask bằng chính task này để getTooltipContent có thể truy cập
        const originalTaskDataForThisFormattedTask = task; // Đây chính là dữ liệu gốc
        // Khai báo lại originalProjectData ở đây để sử dụng trong scope này
        const originalProjectData = task; 
        const timelineDetails = timelineType === 'profile' ? originalProjectData.profileTimeline : originalProjectData.constructionTimeline;
        const assignmentType = timelineDetails?.assignmentType || 'auto';

        let taskEndDateStr = task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/) ? task.end : null;

        if (!taskEndDateStr) {
          if (task.start && timelineDetails?.durationDays > 0) {
            // Sử dụng calculateEndDateClientSide
            const excludeCriteria = timelineDetails?.excludeHolidays !== undefined ? timelineDetails.excludeHolidays : true;
            const calculatedEnd = calculateEndDateClientSide(
              task.start, // task.start đã là 'YYYY-MM-DD'
              parseInt(timelineDetails.durationDays, 10),
              excludeCriteria,
              holidays // Truyền danh sách ngày nghỉ
            );
            if (calculatedEnd) {
              taskEndDateStr = calculatedEnd.toISOString().split('T')[0];
            } else {
              logger.warn(`[TimelineGanttChart] Could not calculate end date for task "${task.name}" (ID: ${task.id}) with duration.`);
            }
          } else if (assignmentType === 'manual' && task.start) {
            taskEndDateStr = finalOverallMaxEndDateString;
          } else if (task.start) {
            taskEndDateStr = task.start;
          }
        }
        
        if (!task.start || !taskEndDateStr || !taskEndDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            logger.error(`[TimelineGanttChart] Task "${task.name}" (ID: ${task.id}) has invalid start or end date. Start: ${task.start}, End: ${taskEndDateStr}. Skipping.`);
            return null; // Skip this task
        }

        if (new Date(taskEndDateStr) < new Date(task.start)) {
            taskEndDateStr = task.start;
        }

        // Xác định màu sắc cho task
        let progressColor = '#16A34A'; // Tailwind green-600 (đậm hơn)
        let barColor = '#86EFAC';      // Tailwind green-300 (đậm hơn)

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskEndDateObj = new Date(taskEndDateStr + "T00:00:00.000Z");

        if (task.progress === 100) {
            progressColor = '#4B5563'; // Tailwind gray-600
            barColor = '#D1D5DB';      // Tailwind gray-300
        } else if (taskEndDateObj < today) {
            progressColor = '#DC2626'; // Tailwind red-600
            barColor = '#FCA5A5';      // Tailwind red-300
        } else if (assignmentType === 'manual') {
            progressColor = '#7C3AED'; // Tailwind violet-600
            barColor = '#C4B5FD';      // Tailwind violet-300
        }

        return {
          id: String(task.id || task._id), // Đảm bảo ID là string
          name: task.name,
          start: new Date(task.start), // Chuyển sang Date object
          end: new Date(taskEndDateStr), // Chuyển sang Date object
          progress: task.progress || 0,
          type: 'task', // Mặc định là 'task'
          isDisabled: isUpdatingTimelineTask, // Ví dụ: disable task khi đang cập nhật
          styles: { 
            progressColor: progressColor, 
            progressSelectedColor: progressColor, 
            backgroundColor: barColor, 
            backgroundSelectedColor: barColor, 
          },
          // Giữ lại task gốc để truy cập thông tin chi tiết khi click hoặc hover
          _originalTask: originalTaskDataForThisFormattedTask 
        };
      })
      .filter(ft => ft !== null && ft.start && ft.end && ft.start.getTime() <= ft.end.getTime());
  }, [inputTasks, timelineType, holidays, isUpdatingTimelineTask]); // Thêm isUpdatingTimelineTask vào dependencies

  const handleTaskChange = (task) => {
    logger.debug("Task change event (drag/resize):", task);
    // Truyền toàn bộ object task đã được cập nhật từ gantt-task-react
    if (onDateChange && task._originalTask) { 
      onDateChange(task); 
    }
  };

  const handleProgressTask = (task) => {
    logger.debug("Progress change event:", task);
    // Truyền toàn bộ object task đã được cập nhật
    if (onProgressChange && task._originalTask) { 
      onProgressChange(task);
    }
  };

  const handleDblClick = (task) => {
    logger.debug("Task double clicked:", task);
    // Mở modal cập nhật tiến độ thực tế khi double click
    if (task._originalTask?.project && onSaveActualProgress) { // Đảm bảo có project và hàm lưu
      setSelectedTaskForActualProgress(task._originalTask.project); // task._originalTask.project là project gốc
      setShowActualProgressModal(true);
    }
  };

  const handleClick = (task) => {
    logger.debug("Task clicked:", task);
    if (onTaskClick && task._originalTask) {
      onTaskClick(task._originalTask);
    } else if (task._originalTask?.project && onSaveActualProgress && isMobile) {
      // Trên mobile, mở modal khi click (vì double click có thể khó)
      setSelectedTaskForActualProgress(task._originalTask.project);
      setShowActualProgressModal(true);
    }

  };

  // Tooltip content
  const getTooltipContent = (ganttEventData) => {
    // ganttEventData là object lớn hơn, task thực sự nằm trong ganttEventData.task
    const task = ganttEventData.task; 

    if (!task) {
      return <div style={{ padding: '5px', fontSize: '12px' }}>Lỗi: Không có dữ liệu task.</div>;
    }

    // _originalTask là project gốc mà chúng ta đã gán khi format task
    // Dữ liệu công trình thực sự nằm trong task._originalTask.project
    const actualProjectData = task._originalTask?.project;

    if (typeof actualProjectData !== 'object' || actualProjectData === null) {
      const taskName = task.name || 'Không xác định';
      // Log cả ganttEventData để xem toàn bộ cấu trúc nếu cần
      logger.warn(`[TooltipContent] Missing _originalTask for task: ${taskName} (ID: ${task.id}). Gantt Event Data:`, JSON.stringify(ganttEventData, null, 2));
      return <div style={{ padding: '5px', fontSize: '12px', maxWidth: '250px', wordBreak: 'break-word' }}>Task: {taskName}<br/>Lỗi: Dữ liệu dự án gốc không hợp lệ.</div>;
    }

    const currentTimelineInfo = timelineType === 'profile' ? actualProjectData.profileTimeline : actualProjectData.constructionTimeline;
    
    const getFieldValue = (obj, path, defaultValue = 'N/A') => {
        if (!obj || typeof obj !== 'object') return defaultValue;
        const value = path.split('.').reduce((o, k) => (o && typeof o === 'object' && o[k] !== undefined && o[k] !== null) ? o[k] : undefined, obj);
        // Xử lý trường hợp giá trị là object (ví dụ: user object)
        if (typeof value === 'object' && value !== null) {
            return String(value.fullName || value.username || value.name || defaultValue);
        }
        return (value !== undefined && value !== null && String(value).trim() !== '') ? String(value) : defaultValue;
    };
    
    const assignedByName = getFieldValue(currentTimelineInfo, 'assignedBy.fullName') !== 'N/A' 
                           ? getFieldValue(currentTimelineInfo, 'assignedBy.fullName') 
                           : getFieldValue(currentTimelineInfo, 'assignedBy.username', 'N/A');


    let detailsHtml = `
      <div style="padding: 10px; font-size: 12px; background-color: #fff; border: 1px solid #e0e0e0; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); max-width: 360px; line-height: 1.5;">
        <h5 style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #1d4ed8; word-break: break-word;">${task.name || 'N/A'}</h5>
        
        <div style="display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; color: #374151; margin-bottom: 6px;">
          <p><strong>Mã CT:</strong></p><span style="word-break: break-all;">${getFieldValue(actualProjectData, 'projectCode')}</span>
          <p><strong>Năm TC:</strong></p><span>${getFieldValue(actualProjectData, 'financialYear')}</span>
          <p><strong>Quy mô:</strong></p><span style="word-break: break-word;">${getFieldValue(actualProjectData, 'scale')}</span>
          <p><strong>Đơn vị PB:</strong></p><span style="word-break: break-word;">${getFieldValue(actualProjectData, 'allocatedUnit')}</span>
          <p><strong>Loại PC:</strong></p><span style="font-weight: 600; color: ${getFieldValue(currentTimelineInfo, 'assignmentType') === 'manual' ? '#7c3aed' : '#15803d'};">${getFieldValue(currentTimelineInfo, 'assignmentType') === 'manual' ? 'Thủ công' : 'Tự động'}</span>
          ${getFieldValue(actualProjectData, 'allocationWave') !== 'N/A' 
            ? `<p><strong>Đợt PB:</strong></p><span style="word-break: break-word;">${getFieldValue(actualProjectData, 'allocationWave')}</span>` 
            : ''}
        </div>

        <hr style="margin: 8px 0; border-color: #e0e0e0;">
        <h6 style="font-size: 11px; font-weight: 600; color: #4b5563; margin-bottom: 5px;">KẾ HOẠCH:</h6>
        <div style="display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; color: #374151; margin-bottom: 6px;">
          <p><strong>Bắt đầu:</strong></p><span>${formatDateToLocale(task.start)}</span>
          <p><strong>Kết thúc:</strong></p><span>${formatDateToLocale(task.end)}</span>          
          <p><strong>Số ngày:</strong></p><span>${getFieldValue(currentTimelineInfo, 'durationDays', '')}</span>
    `;
    // Luôn hiển thị Người lập dự toán và Người theo dõi
    const estimatorName = getFieldValue(actualProjectData, 'profileTimeline.estimator.fullName') !== 'N/A'
                            ? getFieldValue(actualProjectData, 'profileTimeline.estimator.fullName')
                            : getFieldValue(actualProjectData, 'profileTimeline.estimator.username', 'N/A');

    const supervisorName = getFieldValue(actualProjectData, 'supervisor.fullName') !== 'N/A'
                            ? getFieldValue(actualProjectData, 'supervisor.fullName') // Lấy từ supervisor chính của công trình
                            : getFieldValue(actualProjectData, 'supervisor.username', 'N/A'); // Lấy từ supervisor chính của công trình

    detailsHtml += `<p><strong>Người lập DT:</strong></p><span>${estimatorName}</span>`;
    detailsHtml += `<p><strong>Người theo dõi:</strong></p><span>${supervisorName}</span>`;
    
    // Chỉ hiển thị ĐVTC nếu là timeline thi công và có dữ liệu
    if (timelineType === 'construction') {
      const constructionUnitValue = getFieldValue(currentTimelineInfo, 'constructionUnit'); // currentTimelineInfo là actualProjectData.constructionTimeline ở đây
      if (constructionUnitValue !== 'N/A') { 
        detailsHtml += `<p><strong>ĐVTC:</strong></p><span style="word-break: break-word;">${constructionUnitValue}</span>`;
      }
    }

    detailsHtml += `
        </div>
        <hr style="margin: 8px 0; border-color: #e0e0e0;">
        <h6 style="font-size: 11px; font-weight: 600; color: #4b5563; margin-bottom: 5px;">THỰC TẾ:</h6>
        <div style="display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; color: #374151; margin-bottom: 6px;">
          <p><strong>Tiến độ:</strong></p><span style="font-weight: 600; color: #1d4ed8;">${task.progress || 0}%</span>          
          <p><strong>BĐ (TT):</strong></p><span>${formatDateToLocale(getFieldValue(currentTimelineInfo, 'actualStartDate', null))}</span>
          <p><strong>KT (TT):</strong></p><span>${formatDateToLocale(getFieldValue(currentTimelineInfo, 'actualEndDate', null))}</span>
        </div>
        <p style="color: #374151; margin-top: 4px; word-break: break-word; font-size: 11px;"><strong>Ghi chú TT:</strong> ${getFieldValue(currentTimelineInfo, 'statusNotes', '')}</p>
        <p style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e0e0e0; color: #4b5563; font-size: 11px;"><strong>Người PC:</strong> ${assignedByName}</p>
      </div>
    `;
    // Trả về một React element có thể render chuỗi HTML
    return <div dangerouslySetInnerHTML={{ __html: detailsHtml }} />;
  };

  // Tùy chỉnh header cho danh sách task
  const TaskListHeader = ({ headerHeight, fontFamily, fontSize, rowWidth }) => {
    return (
      <div
        className="gantt-table-header bg-gray-100 border-b border-gray-300 flex items-center" // Giữ flex items-center để căn giữa theo chiều dọc
        style={{ height: headerHeight -1, fontFamily: fontFamily, fontSize: fontSize }} // -1 để border dưới không bị cắt
      >
        {/* Chiều rộng của cột Tên công trình sẽ là rowWidth (listCellWidthValue) trừ đi chiều rộng của 2 cột ngày */}
        <div className="gantt-table-header-item text-sm font-semibold text-gray-700 text-left p-2 border-r border-gray-300" style={{ width: `calc(${rowWidth} - 170px)`, boxSizing: 'border-box', paddingLeft: '0.75rem' }}>Tên công trình</div>
        <div className="gantt-table-header-item text-sm font-semibold text-gray-700 text-center p-2 border-r border-gray-300" style={{ width: '85px', boxSizing: 'border-box' }}>Bắt đầu</div>
        <div className="gantt-table-header-item text-sm font-semibold text-gray-700 text-center p-2" style={{ width: '85px', boxSizing: 'border-box' }}>Kết thúc</div>
      </div>
    );
  };

  const TaskListTable = ({ tasks: ganttTasks, fontFamily, fontSize, rowWidth, rowHeight, locale, onExpanderClick }) => {
    // rowWidth ở đây là tổng chiều rộng của listCellWidthValue
    return (
      ganttTasks.map(t => (
        <div
          className="gantt-table-row border-b border-gray-200 hover:bg-gray-50 flex items-center" // Giữ flex items-center
          style={{ height: rowHeight, fontFamily: fontFamily, fontSize: fontSize }}
          key={t.id}
          // title={t.name} // Bỏ title ở đây vì ô tên đã có title riêng
        >
          <div 
            className="gantt-table-row-item text-sm text-gray-800 pl-2 pr-1 py-1 border-r border-gray-200" 
            style={{ 
              width: `calc(${rowWidth} - 170px)`, // Chiều rộng cột tên
              boxSizing: 'border-box', 
              lineHeight: '1.4', 
              display: '-webkit-box',
              WebkitLineClamp: isMobile ? 2 : 3, // Giới hạn 2 dòng trên mobile, 3 dòng trên desktop
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
            }}
            title={t.name} // Tooltip cho tên công trình khi bị cắt ngắn
          >
            {t.name}
          </div>
          <div className="gantt-table-row-item text-sm text-gray-700 text-center px-1 py-1 border-r border-gray-200" style={{ width: '85px', boxSizing: 'border-box' }}>
            {formatDateToLocale(t.start)}
          </div>
          <div className="gantt-table-row-item text-sm text-gray-700 text-center px-1 py-1" style={{ width: '85px', boxSizing: 'border-box' }}>
            {formatDateToLocale(t.end)}
          </div>
        </div>
      ))
    );
  };

  return (
    <div className="gantt-container relative w-full h-[600px] overflow-auto border border-gray-300 rounded-md shadow-sm bg-white custom-scrollbar">
      {formattedTasks.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 p-4">
          Không có dữ liệu timeline để hiển thị hoặc dữ liệu không hợp lệ.
        </div>
      ) : (
        <>
          <Gantt
            tasks={formattedTasks}
            key={currentViewMode} // Thêm key để buộc re-render khi viewMode thay đổi
            viewMode={currentViewMode}
            onDateChange={handleTaskChange}
            onProgressChange={handleProgressTask} // Sử dụng onProgressChange để cập nhật tiến độ
            onClick={handleClick}
            onDoubleClick={handleDblClick}
            listCellWidth={listCellWidthValue} 
            rowHeight={isMobile ? 60 : 55} 
            ganttHeight={580} 
            columnWidth={columnWidthValue} 
            locale="vi" 
            TooltipContent={getTooltipContent} 
            TaskListHeader={TaskListHeader} 
            TaskListTable={TaskListTable}   
            headerHeight={48} 
            barCornerRadius={3}
          />
          {selectedTaskForActualProgress && (
            <ActualProgressModal
              isOpen={showActualProgressModal}
              onRequestClose={() => {
                setShowActualProgressModal(false);
                setSelectedTaskForActualProgress(null);
              }}
              taskProjectData={selectedTaskForActualProgress}
              onSave={(actualData) => {
                onSaveActualProgress({
                  projectId: selectedTaskForActualProgress._id,
                  actualData,
                  callbacks: {
                    onSuccess: () => {
                      setShowActualProgressModal(false);
                      setSelectedTaskForActualProgress(null);
                      // Toast success đã được xử lý trong mutation của TimelineLogic
                    },
                    onError: () => { /* Modal sẽ không tự đóng khi có lỗi */ }
                  }
                });
              }}
              isSaving={isUpdatingTimelineTask} // Sử dụng lại state này cho modal
              timelineType={timelineType}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TimelineGanttChart;

// TODO:
// 1. Truyền isUpdatingTimelineTask từ component cha xuống để disable task khi đang cập nhật.
// 2. Xem xét việc cho phép người dùng thay đổi viewMode (Day, Week, Month) từ UI và cập nhật state `view`.
// 3. Kiểm tra kỹ logic `onDateChange` và `onProgressChange` trong `TimelineLogic.js` để đảm bảo chúng
//    nhận đúng tham số từ `gantt-task-react` và gọi API cập nhật chính xác.