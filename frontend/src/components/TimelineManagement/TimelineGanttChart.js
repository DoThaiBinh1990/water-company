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
    logger.debug('[TimelineGanttChart] timelineType:', timelineType);

    const sourceTasks = Array.isArray(tasks) ? tasks : [];
    logger.debug(`[TimelineGanttChart] sourceTasks.length: ${sourceTasks.length}`);

    if (sourceTasks.length === 0) {
        logger.info('[TimelineGanttChart] Input tasks prop is empty. Clearing Gantt if exists.');
        setRenderableTasksCount(0);
        if (ganttInstance.current) {
            ganttInstance.current.destroy ? ganttInstance.current.destroy() : (ganttInstance.current.clear && ganttInstance.current.clear());
            ganttInstance.current = null;
        }
        if (ganttRef.current) {
            ganttRef.current.innerHTML = '';
        }
        return; // Exit early if no source tasks
    }

    const validSourceTasks = sourceTasks.filter(task =>
        task &&
        typeof task.id !== 'undefined' &&
        typeof task.name === 'string' && task.name.trim() !== '' &&
        typeof task.start === 'string' && task.start.match(/^\d{4}-\d{2}-\d{2}$/) // Only require valid start here
    );
    logger.debug(`[TimelineGanttChart] validSourceTasks.length (tasks with id, name, valid start string): ${validSourceTasks.length}`);
    if (sourceTasks.length !== validSourceTasks.length) {
      logger.warn('[TimelineGanttChart] Some tasks were filtered out by validSourceTasks criteria. Initial count:', sourceTasks.length, 'Valid count:', validSourceTasks.length);
    }

    let overallMaxEndDate = new Date(0);
    validSourceTasks.forEach(task => {
      if (task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const endDate = new Date(task.end);
        if (endDate > overallMaxEndDate) {
          overallMaxEndDate = endDate;
        }
      }
    });

    if (overallMaxEndDate.getTime() === new Date(0).getTime() && validSourceTasks.length > 0) {
      overallMaxEndDate = new Date();
      overallMaxEndDate.setMonth(overallMaxEndDate.getMonth() + 3);
      logger.debug('[TimelineGanttChart] No valid end dates in tasks, defaulting overallMaxEndDate to 3 months from now:', overallMaxEndDate);
    } else if (validSourceTasks.length === 0) {
        overallMaxEndDate = new Date(); // Default if no valid tasks
        overallMaxEndDate.setMonth(overallMaxEndDate.getMonth() + 3);
        logger.debug('[TimelineGanttChart] No valid source tasks, defaulting overallMaxEndDate to 3 months from now:', overallMaxEndDate);
    }


    const finalOverallMaxEndDateString = overallMaxEndDate.toISOString().split('T')[0];
    logger.debug('[TimelineGanttChart] finalOverallMaxEndDateString for manual tasks without end:', finalOverallMaxEndDateString);

    const formattedTasksForGantt = validSourceTasks
      .map(task => {
        const originalProjectData = task._originalTask?.project || task.project || task;
        const timelineDetails = timelineType === 'profile' ? originalProjectData.profileTimeline : originalProjectData.constructionTimeline;
        const assignmentType = timelineDetails?.assignmentType || 'auto';

        let taskEndDateStr = task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/) ? task.end : null;

        if (!taskEndDateStr) {
          if (task.start && timelineDetails?.durationDays > 0) {
            const tempEndDate = new Date(task.start);
            // Simple date addition, consider using a robust library or server-side calculation for holidays
            tempEndDate.setDate(tempEndDate.getDate() + parseInt(timelineDetails.durationDays, 10));
            taskEndDateStr = tempEndDate.toISOString().split('T')[0];
            logger.debug(`[TimelineGanttChart] Calculated end date for task "${task.name}" (ID: ${task.id}) based on duration: ${taskEndDateStr}`);
          } else if (assignmentType === 'manual' && task.start) {
            // For manual tasks without end date or duration, use overall max end date
            taskEndDateStr = finalOverallMaxEndDateString;
            logger.warn(`[TimelineGanttChart] Manual task "${task.name}" (ID: ${task.id}) has no end date or duration. Defaulting to overall max: ${taskEndDateStr}`);
          } else if (task.start) {
            // Fallback for auto tasks without end/duration: end date is same as start date (duration 0)
            taskEndDateStr = task.start;
            logger.warn(`[TimelineGanttChart] Task "${task.name}" (ID: ${task.id}) has start date but no end date or duration. Defaulting end date to start date: ${taskEndDateStr}`);
          }
        }
        
        // Ensure taskEndDateStr is not null and is a valid date string before proceeding
        if (!task.start || !taskEndDateStr || !taskEndDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            logger.error(`[TimelineGanttChart] Task "${task.name}" (ID: ${task.id}) has invalid start or end date. Start: ${task.start}, End: ${taskEndDateStr}. Skipping.`);
            return null; // Skip this task
        }

        if (new Date(taskEndDateStr) < new Date(task.start)) {
            logger.warn(`[TimelineGanttChart] Task "${task.name}" (ID: ${task.id}) has end date (${taskEndDateStr}) before start date (${task.start}). Adjusting end date to start date.`);
            taskEndDateStr = task.start;
        }

        let customClassValue = ''; // Sẽ chỉ chứa một class duy nhất
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskEndDateObj = new Date(taskEndDateStr + "T00:00:00.000Z");

        if (task.progress === 100) {
            customClassValue = 'gantt-task-completed';
        } else if (taskEndDateObj < today) {
            customClassValue = 'gantt-task-overdue';
        } else if (assignmentType === 'manual') {
            customClassValue = 'gantt-manual-task';
        } else { // assignmentType === 'auto' (và không overdue/completed)
            customClassValue = 'gantt-auto-task';
        }

        if (assignmentType === 'manual') {
            // classNames.push('gantt-manual-task'); // Logic cũ đã được thay thế
        }

        return {
          id: String(task.id || task._id),
          name: task.name,
          start: task.start,
          end: taskEndDateStr,
          progress: task.progress || 0,
          dependencies: task.dependencies || '',
          custom_class: customClassValue, // Chỉ gán một class duy nhất
          _originalTask: task._originalTask || task
        };
      })
      .filter(ft => ft !== null && ft.start && ft.end && new Date(ft.start) <= new Date(ft.end)); // Ensure ft is not null before accessing properties

    logger.debug(`[TimelineGanttChart] formattedTasksForGantt.length (after mapping and final filter): ${formattedTasksForGantt.length}`);
    
    // Always call setRenderableTasksCount to update the UI about the number of tasks to render
    setRenderableTasksCount(formattedTasksForGantt.length);

    if (formattedTasksForGantt.length > 0) {
      if (!ganttRef.current) {
        logger.warn('[TimelineGanttChart] Gantt ref is not available on this effect run, but tasks exist. Gantt will initialize after re-render.');
        return;
      }

      logger.debug('[TimelineGanttChart] Gantt ref IS available. Proceeding with Gantt initialization/update.');

      if (ganttInstance.current) {
        logger.debug('[TimelineGanttChart] Attempting to destroy/clear existing Gantt instance before re-init.');
        ganttInstance.current.destroy ? ganttInstance.current.destroy() : (ganttInstance.current.clear && ganttInstance.current.clear());
        ganttInstance.current = null;
      }
      
      if (ganttRef.current) {
         ganttRef.current.innerHTML = '';
         logger.debug('[TimelineGanttChart] Cleared ganttRef.current innerHTML.');
      } else {
         logger.error('[TimelineGanttChart] CRITICAL: ganttRef.current became null unexpectedly after the check.');
         return;
      }

      logger.debug('[TimelineGanttChart] Initializing Gantt with tasks. Count:', formattedTasksForGantt.length);
      logger.debug('[TimelineGanttChart] Tasks being passed to Gantt constructor:', JSON.stringify(formattedTasksForGantt, null, 2));
      try {
        ganttInstance.current = new Gantt(ganttRef.current, formattedTasksForGantt, {
          header_height: 50,
          column_width: 35, // Giảm chiều rộng cột ngày để hiển thị nhiều ngày hơn
          step: 24,
          bar_height: 20,
          bar_corner_radius: 2, // Giảm độ bo góc một chút
          arrow_curve: 5,
          padding: 16, // Giảm padding một chút
          view_mode: viewMode,
          date_format: 'YYYY-MM-DD',
          language: 'vi',
          custom_popup_html: (taskGantt) => {
            const projectData = taskGantt._originalTask?.project;
            if (!projectData) {
              logger.error('[TimelineGanttChart] custom_popup_html: projectData is undefined. taskGantt:', taskGantt);
              return `<div class="p-2 text-red-500">Lỗi: Không tìm thấy dữ liệu gốc cho task ${taskGantt.name}</div>`;
            }
            const currentTimelineInfo = timelineType === 'profile' ? projectData.profileTimeline : projectData.constructionTimeline;
            const assignedBy = currentTimelineInfo?.assignedBy?.fullName || currentTimelineInfo?.assignedBy?.username || (typeof currentTimelineInfo?.assignedBy === 'string' ? currentTimelineInfo.assignedBy : 'N/A');
            let detailsHtml = `
              <div class="gantt-custom-popup p-4 text-sm bg-white shadow-xl rounded-lg border border-gray-200 max-w-md leading-relaxed">
                <h5 class="text-lg font-bold mb-3 text-blue-700">${taskGantt.name || 'N/A'}</h5>
                <div class="space-y-1.5">
                  <p><strong>Mã CT:</strong> <span class="text-gray-700">${projectData.projectCode || 'N/A'}</span></p>
                  <p><strong>Năm TC:</strong> <span class="text-gray-700">${projectData.financialYear || 'N/A'}</span></p>
                  <p><strong>Đơn vị PB:</strong> <span class="text-gray-700">${projectData.allocatedUnit?.name || projectData.allocatedUnit || 'N/A'}</span></p>
                  <p><strong>Loại phân công:</strong> <span class="font-semibold ${currentTimelineInfo?.assignmentType === 'manual' ? 'text-purple-600' : 'text-green-600'}">${currentTimelineInfo?.assignmentType === 'manual' ? 'Thủ công' : 'Tự động'}</span></p>
                  <hr class="my-2 border-gray-200">
                  <p><strong>Ngày BĐ (KH):</strong> <span class="text-gray-700">${formatDateToLocale(taskGantt.start)}</span></p>
                  <p><strong>Ngày KT (KH):</strong> <span class="text-gray-700">${formatDateToLocale(taskGantt.end)}</span></p>
                  <p><strong>Số ngày (KH):</strong> <span class="text-gray-700">${currentTimelineInfo?.durationDays || 'N/A'}</span></p>
            `;
            if (timelineType === 'profile') {
              detailsHtml += `<p><strong>Người lập DT:</strong> <span class="text-gray-700">${projectData.profileTimeline?.estimator?.fullName || projectData.profileTimeline?.estimator?.username || 'N/A'}</span></p>`;
            }
            if (timelineType === 'construction') {
              detailsHtml += `<p><strong>Đơn vị TC:</strong> <span class="text-gray-700">${projectData.constructionTimeline?.constructionUnit || 'N/A'}</span></p>`;
              detailsHtml += `<p><strong>Người theo dõi:</strong> <span class="text-gray-700">${projectData.constructionTimeline?.supervisor?.fullName || projectData.constructionTimeline?.supervisor?.username || 'N/A'}</span></p>`;
            }
            detailsHtml += `
                <hr class="my-2">
                <p class="mb-1"><strong>Tiến độ:</strong> <span class="font-semibold text-blue-600">${taskGantt.progress}%</span></p>
                <p class="mb-1"><strong>Ngày BĐ (TT):</strong> ${formatDateToLocale(currentTimelineInfo?.actualStartDate)}</p>
                <p class="mb-1"><strong>Ngày KT (TT):</strong> ${formatDateToLocale(currentTimelineInfo?.actualEndDate)}</p>
                <p class="mb-1"><strong>Ghi chú TT:</strong> <span class="text-gray-700">${currentTimelineInfo?.statusNotes || 'N/A'}</span></p>
                <p class="mt-3 pt-2 border-t border-gray-200 text-gray-600"><strong>Người phân công:</strong> ${assignedBy}</p>
                </div>
              </div>
            `;
            return detailsHtml;
          },
          on_click: (taskGantt) => {
            logger.debug('[TimelineGanttChart] Task clicked:', taskGantt);
            if (onTaskClick && taskGantt?._originalTask) { // Pass original task object
              onTaskClick(taskGantt._originalTask);
            }
          },
          on_date_change: (taskGantt, start, end) => {
            logger.debug('[TimelineGanttChart] Date changed:', taskGantt, start, end);
            if (onDateChange && taskGantt?._originalTask) { // Pass original task object
              onDateChange(taskGantt._originalTask, start, end); // Pass Date objects directly
            }
          },
          on_progress_change: (taskGantt, progress) => {
            logger.debug('[TimelineGanttChart] Progress changed:', taskGantt, progress);
            if (onProgressChange && taskGantt?._originalTask) { // Pass original task object
              onProgressChange(taskGantt._originalTask, progress);
            }
          },
        });
        logger.debug('[TimelineGanttChart] Gantt instance created:', ganttInstance.current);
        logger.info('[TimelineGanttChart] Gantt chart successfully initialized/updated.');
        if (ganttRef.current) {
            logger.debug('[TimelineGanttChart] Inner HTML of ganttRef.current after initialization:', ganttRef.current.innerHTML.substring(0, 200) + "..."); // Log a snippet
        }
      } catch (error) {
        logger.error('[TimelineGanttChart] Error initializing Gantt:', error);
        if (ganttRef.current) {
            ganttRef.current.innerHTML = `<div class="p-4 text-red-600 bg-red-100 border border-red-400 rounded">Lỗi khởi tạo biểu đồ Gantt: ${error.message}</div>`;
        }
      }
    } else {
      logger.info('[TimelineGanttChart] No tasks to render after final processing. Clearing Gantt if exists.');
      if (ganttInstance.current) {
        ganttInstance.current.destroy ? ganttInstance.current.destroy() : (ganttInstance.current.clear && ganttInstance.current.clear());
        ganttInstance.current = null;
      }
      if (ganttRef.current) {
        ganttRef.current.innerHTML = '';
      }
    }

    return () => {
      if (ganttInstance.current) {
        logger.debug('[TimelineGanttChart] Cleaning up Gantt instance in useEffect cleanup.');
        ganttInstance.current.destroy ? ganttInstance.current.destroy() : (ganttInstance.current.clear && ganttInstance.current.clear());
        ganttInstance.current = null;
      }
    };
  }, [tasks, viewMode, timelineType, onTaskClick, onDateChange, onProgressChange]);

  return (
    <div className="gantt-container relative w-full h-[600px] overflow-x-auto overflow-y-hidden border border-gray-300 rounded-md shadow-sm bg-white custom-scrollbar">
      {renderableTasksCount === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 p-4">
          Không có dữ liệu timeline để hiển thị hoặc dữ liệu không hợp lệ.
        </div>
      ) : (
        <svg ref={ganttRef} className="w-full h-full"></svg>
      )}
      <style jsx global>{`
        .gantt-custom-popup {}
        .gantt-manual-task .bar-progress { fill: #7E22CE !important; } /* purple-600 */
        .gantt-auto-task .bar-progress { fill: #16A34A !important; } /* green-600 */
        .gantt-manual-task .bar { fill: #E9D5FF !important; } /* purple-200 */
        .gantt-auto-task .bar { fill: #DCFCE7 !important; } /* green-200 */
        .gantt-task-completed .bar-progress { fill: #6b7280 !important; }
        .gantt-task-completed .bar { fill: #d1d5db !important; }
        .gantt-task-overdue .bar-progress { fill: #DC2626 !important; } /* red-600 */
        .gantt-task-overdue .bar { fill: #FEE2E2 !important; } /* red-200 */
        .gantt-project-type-tuyen-mang .bar { /* fill: #fbbf24 !important; */ }
      `}</style>
    </div>
  );
};

export default TimelineGanttChart;