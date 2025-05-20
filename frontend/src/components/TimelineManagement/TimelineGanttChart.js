// d:\CODE\water-company\frontend\src\components\TimelineManagement\TimelineGanttChart.js
import React, { useEffect, useRef, useState } from 'react';
import Gantt from 'frappe-gantt';

const TimelineGanttChart = ({ tasks, viewMode = 'Week', onTaskClick, onDateChange, onProgressChange }) => {
  const ganttRef = useRef(null);
  const ganttInstance = useRef(null);
  const [isTimespanDefaulted, setIsTimespanDefaulted] = useState(false);
  const [renderableTasksCount, setRenderableTasksCount] = useState(0);

  useEffect(() => {
    // Determine if timespan is defaulted
    const validApiTasks = Array.isArray(tasks)
      ? tasks.filter(task =>
          task &&
          typeof task.id !== 'undefined' &&
          typeof task.name === 'string' && task.name.trim() !== '' &&
          typeof task.start === 'string' && task.start.match(/^\d{4}-\d{2}-\d{2}$/)
        )
      : [];

    if (validApiTasks.length > 0) {
      const hadAnyExplicitEndDates = validApiTasks.some(
        task => task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/)
      );
      setIsTimespanDefaulted(!hadAnyExplicitEndDates);
    } else {
      setIsTimespanDefaulted(false); 
    }

    // Gantt rendering logic
    if (ganttRef.current) {
      if (ganttInstance.current) {
        ganttInstance.current.destroy ? ganttInstance.current.destroy() : ganttInstance.current.clear();
        ganttInstance.current = null; 
      }

      let overallMaxEndDate = null;
      if (validApiTasks.length > 0) {
        const validEndDatesFromTasks = validApiTasks
          .map(task => task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(task.end) : null)
          .filter(date => date && !isNaN(date.getTime()));

        if (validEndDatesFromTasks.length > 0) {
          overallMaxEndDate = new Date(Math.max.apply(null, validEndDatesFromTasks));
        }
      }

      if (!overallMaxEndDate) {
        if (validApiTasks.length > 0) {
          const startDates = validApiTasks.map(task => new Date(task.start));
          const minStartDate = new Date(Math.min.apply(null, startDates));
          overallMaxEndDate = new Date(minStartDate);
          overallMaxEndDate.setMonth(overallMaxEndDate.getMonth() + 3);
        } else {
          overallMaxEndDate = new Date();
          overallMaxEndDate.setMonth(overallMaxEndDate.getMonth() + 3);
        }
      }
      const finalOverallMaxEndDateString = overallMaxEndDate.toISOString().split('T')[0];

      const formattedTasksForGantt = validApiTasks
        .map(task => {
          const assignmentType = task.project?.profileTimeline?.assignmentType || task.project?.constructionTimeline?.assignmentType || 'auto';
          let taskEndDate = task.end && task.end.match(/^\d{4}-\d{2}-\d{2}$/) ? task.end : null;

          if (assignmentType === 'manual' && !taskEndDate) {
            taskEndDate = finalOverallMaxEndDateString;
          }
          
          if (!taskEndDate) { // Fallback for any task that still doesn't have an end date
            taskEndDate = finalOverallMaxEndDateString;
          }

          return {
            id: String(task.id || task._id),
            name: task.name,
            start: task.start,
            end: taskEndDate, // Use the determined taskEndDate
            progress: task.progress || 0,
            dependencies: task.dependencies || '',
            custom_class: task.custom_class || (assignmentType === 'manual' ? 'manual-task' : 'auto-task'),
            _originalTask: task 
          };
        }).filter(ft => ft.start && ft.end); // Ensure tasks have valid start and end after processing

      setRenderableTasksCount(formattedTasksForGantt.length);

      if (formattedTasksForGantt.length > 0) {
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
          custom_popup_html: null,
          on_click: (task) => {
            const clickedFormattedTask = formattedTasksForGantt.find(ft => ft.id === task.id);
            // Truyền project gốc khi click
            if (onTaskClick && clickedFormattedTask && clickedFormattedTask._originalTask) {
              onTaskClick(clickedFormattedTask._originalTask.project || clickedFormattedTask._originalTask);
            } else if (onTaskClick && task) {
              onTaskClick(task);
            }
          },
          // Hook up on_date_change event
          on_date_change: (task, start, end) => {
            // task.id là projectId
            // start và end là Date objects
            if (onDateChange) {
              onDateChange(task.id, start, end);
            }
          },
          on_progress_change: (task, progress) => {
            if (onProgressChange) {
              onProgressChange(task.id, progress);
            }
          },
        });
      }
    }
    // Cleanup function
    return () => {
        if (ganttInstance.current) {
            ganttInstance.current.destroy ? ganttInstance.current.destroy() : ganttInstance.current.clear();
            ganttInstance.current = null;
        }
    };
  }, [tasks, viewMode, onTaskClick, onDateChange, onProgressChange]);

  return (
    <div className="gantt-container my-4 border rounded-md shadow-sm bg-white">
      {renderableTasksCount > 0 ? (
        <>
          <svg ref={ganttRef}></svg>
          {isTimespanDefaulted && (
            <p className="p-2 text-sm text-orange-600 bg-orange-50 border-t border-orange-200 text-center">
              Lưu ý: Khoảng thời gian hiển thị của timeline được đặt mặc định do không có công trình nào được phân công với ngày kết thúc cụ thể.
            </p>
          )}
        </>
      ) : (
        <div className="p-10 text-center text-gray-500">
          Không có dữ liệu timeline để hiển thị. Vui lòng chọn bộ lọc hoặc phân công.
        </div>
      )}
    </div>
  );
};

export default TimelineGanttChart;
