// d:\CODE\water-company\frontend\src\components\TimelineManagement\TimelineGanttChart.js
import React, { useEffect, useRef, useState } from 'react';
import Gantt from 'frappe-gantt';
import { formatDateToLocale } from '../../utils/dateUtils';
import logger from '../../utils/logger'; // Import logger

const TimelineGanttChart = ({ tasks, viewMode = 'Week', onTaskClick, onDateChange, onProgressChange, timelineType }) => {
  const ganttRef = useRef(null);
  const ganttInstance = useRef(null);
  const [renderableTasksCount, setRenderableTasksCount] = useState(0);

  useEffect(() => {
    logger.debug('[TimelineGanttChart] useEffect triggered. Input tasks prop:', JSON.stringify(tasks, null, 2));
    logger.debug('[TimelineGanttChart] viewMode:', viewMode);

    if (!ganttRef.current) {
      logger.error('[TimelineGanttChart] Gantt ref is not available.');
      return;
    }

    const sourceTasks = Array.isArray(tasks) ? tasks : [];
    logger.debug('[TimelineGanttChart] Using sourceTasks:', JSON.stringify(sourceTasks, null, 2));

    const validSourceTasks = sourceTasks.filter(task =>
        task &&
        typeof task.id !== 'undefined' &&
        typeof task.name === 'string' && task.name.trim() !== '' &&
        typeof task.start === 'string' && task.start.match(/^\d{4}-\d{2}-\d{2}$/)
    );
    logger.debug('[TimelineGanttChart] Filtered validSourceTasks (tasks with id, name, start):', JSON.stringify(validSourceTasks, null, 2));

    let overallMaxEndDate = new Date(0);
    validSourceTasks.forEach(task => {
      const originalProjectData = task._originalTask?.project || task.project || task; // Lấy dữ liệu project gốc
      const timelineDetails = timelineType === 'profile' ? originalProjectData.profileTimeline : originalProjectData.constructionTimeline;
      const assignmentType = timelineDetails?.assignmentType || 'auto';
      let endDate;

      if (task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/)) {
        endDate = new Date(task.end);
      } else if (assignmentType === 'auto' && task.start && timelineDetails?.durationDays > 0) {
        const tempEndDate = new Date(task.start);
        tempEndDate.setDate(tempEndDate.getDate() + parseInt(timelineDetails.durationDays, 10)); // Cần logic chuẩn hơn tính cả ngày nghỉ
        endDate = tempEndDate;
      }

      if (endDate && endDate > overallMaxEndDate) {
        overallMaxEndDate = endDate;
      }
    });

    if (overallMaxEndDate.getTime() === new Date(0).getTime()) {
      overallMaxEndDate = new Date();
      overallMaxEndDate.setMonth(overallMaxEndDate.getMonth() + 3);
      logger.debug('[TimelineGanttChart] No tasks with end dates, defaulting overallMaxEndDate to 3 months from now:', overallMaxEndDate);
    }

    const finalOverallMaxEndDateString = overallMaxEndDate.toISOString().split('T')[0];
    logger.debug('[TimelineGanttChart] finalOverallMaxEndDateString for manual tasks without end:', finalOverallMaxEndDateString);

    const formattedTasksForGantt = validSourceTasks
      .map(task => {
        const originalProjectData = task._originalTask?.project || task.project || task; // Lấy dữ liệu project gốc
        const timelineDetails = timelineType === 'profile' ? originalProjectData.profileTimeline : originalProjectData.constructionTimeline;
        const assignmentType = timelineDetails?.assignmentType || 'auto';
        
        let taskEndDate = task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/) ? task.end : null;

        if (assignmentType === 'manual' && !taskEndDate) {
          taskEndDate = finalOverallMaxEndDateString;
        } else if (!taskEndDate && task.start && timelineDetails?.durationDays > 0) {
           // Tạm thời, nếu là auto và không có end, sẽ dựa vào overall max. Cần logic chuẩn hơn.
           const tempEndDate = new Date(task.start);
           tempEndDate.setDate(tempEndDate.getDate() + parseInt(timelineDetails.durationDays, 10));
           taskEndDate = tempEndDate.toISOString().split('T')[0]; // Cần logic chuẩn hơn
           if (new Date(taskEndDate) > overallMaxEndDate && assignmentType === 'auto') {
             // Nếu ngày kết thúc tính toán của task auto vượt quá max chung, có thể cần xem lại logic
           }
        } else if (!taskEndDate) {
           taskEndDate = finalOverallMaxEndDateString; // Fallback cuối cùng
        }
        
        // Đảm bảo end date không trước start date
        if (new Date(taskEndDate) < new Date(task.start)) {
            logger.warn(`[TimelineGanttChart] Task "${task.name}" (ID: ${task.id}) has end date (${taskEndDate}) before start date (${task.start}). Adjusting end date.`);
            taskEndDate = task.start; // Hoặc một logic khác phù hợp
        }

        return {
          id: String(task.id || task._id), // Đảm bảo ID là string
          name: task.name,
          start: task.start,
          end: taskEndDate,
          progress: task.progress || 0,
          dependencies: task.dependencies || '',
          custom_class: task.custom_class || (assignmentType === 'manual' ? 'gantt-manual-task' : 'gantt-auto-task'),
          _originalTask: task._originalTask || task // Đảm bảo _originalTask luôn có
        }; // Thêm projectType vào _originalTask nếu có
      })
      .filter(ft => ft.start && ft.end && new Date(ft.start) <= new Date(ft.end));

    logger.debug('[TimelineGanttChart] formattedTasksForGantt (final for Gantt lib):', JSON.stringify(formattedTasksForGantt, null, 2));
    setRenderableTasksCount(formattedTasksForGantt.length);

    if (ganttRef.current && formattedTasksForGantt.length > 0) {
      // Nếu có task hợp lệ để render, đảm bảo ref trống trước khi khởi tạo
      if (ganttInstance.current) {
        ganttInstance.current.destroy ? ganttInstance.current.destroy() : ganttInstance.current.clear();
        ganttInstance.current = null; // Quan trọng: reset instance
      }
      ganttRef.current.innerHTML = ''; // Xóa nội dung cũ của SVG
      
      logger.debug('[TimelineGanttChart] Initializing Gantt with tasks.');
      try {
        ganttInstance.current = new Gantt(ganttRef.current, formattedTasksForGantt, {
          header_height: 50,
          column_width: 30,
          step: 24,
          view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
          bar_height: 20,
          bar_corner_radius: 3,
          arrow_curve: 5,
          padding: 18,
          view_mode: viewMode,
          date_format: 'YYYY-MM-DD',
          language: 'vi',
          custom_popup_html: (taskGantt) => {
            const originalTaskData = taskGantt._originalTask?.project || taskGantt._originalTask; // Sửa ở đây
            if (!originalTaskData) return `<div>${taskGantt.name}</div>`; // Fallback nếu không có originalTaskData
  
            const currentTimelineInfo = timelineType === 'profile' ? originalTaskData.profileTimeline : originalTaskData.constructionTimeline;
            const assignedBy = currentTimelineInfo?.assignedBy?.fullName || currentTimelineInfo?.assignedBy?.username || 'N/A';
            const estimator = originalTaskData.profileTimeline?.estimator?.fullName || originalTaskData.profileTimeline?.estimator?.username || 'N/A';
            const supervisor = originalTaskData.constructionTimeline?.supervisor?.fullName || originalTaskData.constructionTimeline?.supervisor?.username || 'N/A';
            const constructionUnit = originalTaskData.constructionTimeline?.constructionUnit || 'N/A';
  
            let detailsHtml = `
              <div class="gantt-custom-popup p-3 text-xs bg-white shadow-xl rounded-md border border-gray-300 max-w-sm leading-normal">
                <h5 class="text-base font-semibold mb-2 text-blue-700">${taskGantt.name || 'N/A'}</h5>
                <p class="mb-1"><strong>Mã CT:</strong> ${originalTaskData.projectCode || 'N/A'}</p>
                <p class="mb-1"><strong>Năm TC:</strong> ${originalTaskData.financialYear || 'N/A'}</p>
                <p class="mb-1"><strong>Đơn vị PB:</strong> ${originalTaskData.allocatedUnit?.name || originalTaskData.allocatedUnit || 'N/A'}</p>
                <p class="mb-1"><strong>Loại phân công:</strong> <span class="font-medium ${currentTimelineInfo?.assignmentType === 'manual' ? 'text-purple-600' : 'text-green-600'}">${currentTimelineInfo?.assignmentType === 'manual' ? 'Thủ công' : 'Tự động'}</span></p>
                <hr class="my-2">
                <p class="mb-1"><strong>Ngày BĐ (KH):</strong> ${formatDateToLocale(taskGantt.start)}</p>
                <p class="mb-1"><strong>Ngày KT (KH):</strong> ${formatDateToLocale(taskGantt.end)}</p>
                <p class="mb-1"><strong>Số ngày (KH):</strong> ${currentTimelineInfo?.durationDays || 'N/A'}</p>
            `;
  
            if (timelineType === 'profile') {
              detailsHtml += `<p class="mb-1"><strong>Người lập DT:</strong> ${estimator}</p>`;
            }
            if (timelineType === 'construction') {
              detailsHtml += `<p class="mb-1"><strong>Đơn vị TC:</strong> ${constructionUnit}</p>`;
              detailsHtml += `<p class="mb-1"><strong>Người theo dõi:</strong> ${supervisor}</p>`;
            }
  
            detailsHtml += `
                <hr class="my-2">
                <p class="mb-1"><strong>Tiến độ:</strong> <span class="font-semibold text-blue-600">${taskGantt.progress}%</span></p>
                <p class="mb-1"><strong>Ngày BĐ (TT):</strong> ${formatDateToLocale(currentTimelineInfo?.actualStartDate)}</p>
                <p class="mb-1"><strong>Ngày KT (TT):</strong> ${formatDateToLocale(currentTimelineInfo?.actualEndDate)}</p>
                <p class="mb-1"><strong>Ghi chú TT:</strong> ${currentTimelineInfo?.statusNotes || 'N/A'}</p>
                <p class="mt-2 pt-2 border-t border-gray-200"><strong>Người phân công:</strong> ${assignedBy}</p>
              </div>
            `;
            return detailsHtml;
          },
          on_click: (taskGantt) => {
            logger.debug('[TimelineGanttChart] Task clicked:', taskGantt);
            if (onTaskClick && taskGantt?._originalTask) {
              onTaskClick(taskGantt._originalTask);
            }
          },
          on_date_change: (taskGantt, start, end) => {
            logger.debug('[TimelineGanttChart] Date changed:', taskGantt, start, end);
            if (onDateChange && taskGantt?._originalTask) {
              const startDateString = start.toISOString().split('T')[0];
              const endDateString = end.toISOString().split('T')[0];
              onDateChange(taskGantt._originalTask, startDateString, endDateString);
            }
          },
          on_progress_change: (taskGantt, progress) => {
            logger.debug('[TimelineGanttChart] Progress changed:', taskGantt, progress);
            if (onProgressChange && taskGantt?._originalTask) {
              onProgressChange(taskGantt._originalTask, progress);
            }
          },
        });
        logger.debug('[TimelineGanttChart] Gantt instance created:', ganttInstance.current);
      } catch (error) {
        logger.error('[TimelineGanttChart] Error initializing Gantt:', error);
        if (ganttRef.current) {
            ganttRef.current.innerHTML = `<div class="p-4 text-red-600 bg-red-100 border border-red-400 rounded">Lỗi khởi tạo biểu đồ Gantt: ${error.message}</div>`;
        }
      }
    } else { // Bao gồm cả validSourceTasks.length === 0 và formattedTasksForGantt.length === 0
      logger.warn('[TimelineGanttChart] No tasks to render. Clearing Gantt and ref.');
      if (ganttInstance.current) {
        ganttInstance.current.destroy ? ganttInstance.current.destroy() : ganttInstance.current.clear();
        ganttInstance.current = null;
      }
      if (ganttRef.current) {
        ganttRef.current.innerHTML = ''; // Đảm bảo SVG trống nếu không có task
      }
    }

    return () => {
      if (ganttInstance.current) {
        logger.debug('[TimelineGanttChart] Cleaning up Gantt instance.');
        ganttInstance.current.destroy ? ganttInstance.current.destroy() : ganttInstance.current.clear();
        ganttInstance.current = null;
      }
    };
  }, [tasks, viewMode, timelineType]); // Removed useTestData from dependencies

  return (
    <div className="gantt-container relative w-full h-[600px] overflow-x-auto overflow-y-hidden border border-gray-300 rounded-md shadow-sm bg-white custom-scrollbar">
      {renderableTasksCount === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 p-4">
          Không có dữ liệu timeline để hiển thị hoặc dữ liệu không hợp lệ.
        </div>
      ) : (
        <svg ref={ganttRef} className="w-full h-full"></svg>
      )}
      {/* CSS cho custom popup của Gantt */}
      <style jsx global>{`
        .gantt-custom-popup {
          /* Các style Tailwind đã được áp dụng qua class, bạn có thể thêm style bổ sung ở đây nếu cần */
        }
        .gantt-manual-task .bar-progress {
          fill: #8b5cf6 !important; /* Purple for manual tasks */
        }
        .gantt-auto-task .bar-progress {
          fill: #22c55e !important; /* Green for auto tasks */
        }
        .gantt-manual-task .bar {
            fill: #c4b5fd !important; /* Light purple for manual task bar */
        }
        .gantt-auto-task .bar {
            fill: #bbf7d0 !important; /* Light green for auto task bar */
        }
      `}</style>
    </div>
  );
};

export default TimelineGanttChart;
