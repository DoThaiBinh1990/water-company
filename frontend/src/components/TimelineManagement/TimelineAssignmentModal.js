// d:\CODE\water-company\frontend\src\components\TimelineManagement\TimelineAssignmentModal.js
import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-modal';
import { FaSave, FaTimes, FaCalendarAlt, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; // Import DND components
import { calculateEndDateClientSide } from '../../utils/dateUtils'; // Import hàm mới
import { toast } from 'react-toastify';

Modal.setAppElement('#root');

const TimelineAssignmentModal = ({
  isOpen,
  onRequestClose,
  title,
  projectsToAssign = [], // Danh sách công trình đủ điều kiện phân công
  assignToObject, // { estimatorId } hoặc { constructionUnitName }
  financialYear,
  onSaveAssignments, // Hàm để gọi API lưu
  isSaving,
  timelineType, // 'profile' or 'construction'
  objectType, // 'category' or 'minor_repair' (for construction)
  holidays = [], // Nhận danh sách ngày nghỉ
}) => {
  const [assignments, setAssignments] = useState([]);
  const [commonStartDate, setCommonStartDate] = useState('');

  useEffect(() => {
    if (projectsToAssign && projectsToAssign.length > 0) {
      setAssignments(
        projectsToAssign.map((p, index) => {
          let initialAssignmentType = 'auto';
          let initialStartDate = '';
          let initialDurationDays = '';
          let initialEndDate = '';

          // Ưu tiên lấy từ profileTimeline nếu có và là manual, sau đó mới đến trường gốc của project
          if (timelineType === 'profile' && p.profileTimeline?.assignmentType === 'manual') {
            initialAssignmentType = 'manual';
            initialStartDate = p.profileTimeline.startDate ? new Date(p.profileTimeline.startDate).toISOString().split('T')[0] : '';
            initialDurationDays = p.profileTimeline.durationDays || '';
            initialEndDate = p.profileTimeline.endDate ? new Date(p.profileTimeline.endDate).toISOString().split('T')[0] : '';
          } else if (timelineType === 'profile' && p.startDate && p.durationDays) { // Lấy từ trường gốc của CategoryProject cho profile timeline
            initialAssignmentType = 'manual'; // Nếu có ngày ở gốc, coi như manual
            initialStartDate = p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '';
            initialDurationDays = p.durationDays || '';
            initialEndDate = p.completionDate ? new Date(p.completionDate).toISOString().split('T')[0] : '';
          }
          // (Không áp dụng logic này cho constructionTimeline từ trường gốc)

          return {
            projectId: p._id,
            projectName: p.name,
            assignmentType: initialAssignmentType,
            startDate: initialStartDate,
            durationDays: initialDurationDays,
            endDate: initialEndDate,
            excludeHolidays: p.profileTimeline?.excludeHolidays !== undefined ? p.profileTimeline.excludeHolidays : (p.constructionTimeline?.excludeHolidays !== undefined ? p.constructionTimeline.excludeHolidays : true),
            order: index,
          };
        })
      );
    } else {
      setAssignments([]);
    }
    setCommonStartDate(''); // Reset common start date when projects change
  }, [projectsToAssign, timelineType]); // Thêm timelineType vào dependency

  // useEffect để tự động tính toán lại ngày khi assignments, commonStartDate, hoặc holidays thay đổi
  useEffect(() => {
    if (assignments.length === 0) return;

    let previousAutoTaskEndDate = null;
    const updatedAssignments = assignments.map(assign => {
      let newAssign = { ...assign };
      if (newAssign.assignmentType === 'auto') {
        let currentTaskStartDate = newAssign.startDate ? new Date(newAssign.startDate) : null;

        if (!currentTaskStartDate && previousAutoTaskEndDate) {
          // Nối tiếp từ task auto trước đó
          currentTaskStartDate = new Date(previousAutoTaskEndDate);
          currentTaskStartDate.setDate(currentTaskStartDate.getDate() + 1); // Bắt đầu ngày tiếp theo
          // Cần bỏ qua cuối tuần/ngày nghỉ cho startDate nối tiếp
          while (currentTaskStartDate.getDay() === 0 || currentTaskStartDate.getDay() === 6 || holidays.includes(currentTaskStartDate.toISOString().split('T')[0])) {
            currentTaskStartDate.setDate(currentTaskStartDate.getDate() + 1);
          }
          newAssign.startDate = currentTaskStartDate.toISOString().split('T')[0];
        }

        if (newAssign.startDate && newAssign.durationDays) {
          const calculatedEnd = calculateEndDateClientSide(newAssign.startDate, parseInt(newAssign.durationDays, 10), holidays);
          if (calculatedEnd) {
            newAssign.endDate = calculatedEnd.toISOString().split('T')[0];
            previousAutoTaskEndDate = new Date(newAssign.endDate);
          } else {
            newAssign.endDate = ''; // Clear if calculation fails
          }
        } else if (newAssign.endDate) {
          previousAutoTaskEndDate = new Date(newAssign.endDate);
        } else { // Nếu không có startDate, duration, endDate, reset để task auto tiếp theo không bị ảnh hưởng sai
            previousAutoTaskEndDate = null;
        }
      } else { // Manual task
        previousAutoTaskEndDate = null; // Reset for manual tasks
      }
      return newAssign;
    });

    // Chỉ cập nhật state nếu có sự thay đổi thực sự để tránh vòng lặp vô hạn,
    // hoặc nếu commonStartDate vừa được áp dụng (để trigger tính toán lại ngay cả khi assignments không đổi)
    if (JSON.stringify(updatedAssignments) !== JSON.stringify(assignments)) {
      setAssignments(updatedAssignments);
    }
  }, [assignments, holidays, commonStartDate]); // Thêm commonStartDate vào dependencies


  const handleAssignmentChange = (index, field, value) => {
    const newAssignments = [...assignments];
    newAssignments[index][field] = value;
    setAssignments(newAssignments);
  };

  const handleApplyCommonStartDate = () => {
    if (!commonStartDate) {
      toast.warn('Vui lòng chọn ngày bắt đầu chung.', { position: "top-center" });
      return;
    }
    // Áp dụng cho tất cả các task 'auto'
    const newAssignments = assignments.map(assign => {
      if (assign.assignmentType === 'auto') {
        return { ...assign, startDate: commonStartDate };
      }
      return assign;
    });
    setAssignments(newAssignments);
    toast.success('Đã áp dụng ngày bắt đầu chung cho các công trình "Tự động".', { position: "top-center" });
  };

  const handleSave = () => {
    const payloadAssignments = assignments.map(a => ({
      projectId: a.projectId,
      assignmentType: a.assignmentType,
      startDate: a.startDate,
      durationDays: a.durationDays ? parseInt(a.durationDays, 10) : null,
      endDate: a.endDate,
      excludeHolidays: a.excludeHolidays,
      order: a.assignmentType === 'auto' ? a.order : undefined, // Chỉ gửi order cho auto
    }));

    const payload = {
      financialYear: parseInt(financialYear, 10),
      assignments: payloadAssignments,
    };

    if (timelineType === 'profile') {
      payload.estimatorId = assignToObject.estimatorId;
    } else if (timelineType === 'construction') {
      payload.type = objectType;
      payload.constructionUnitName = assignToObject.constructionUnitName;
    }
    onSaveAssignments(payload);
  };

  const onDragEnd = (result) => {
    if (!result.destination) {
      return;
    }

    const reorderedAssignments = Array.from(assignments);
    const [removed] = reorderedAssignments.splice(result.source.index, 1);
    reorderedAssignments.splice(result.destination.index, 0, removed);

    // Cập nhật lại 'order' sau khi sắp xếp và trigger tính toán lại
    const updatedAssignmentsWithOrder = reorderedAssignments.map((assign, index) => ({
      ...assign,
      order: index, // Cập nhật order dựa trên vị trí mới
    }));

    setAssignments(updatedAssignmentsWithOrder);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={{
        overlay: {
          zIndex: 1050, // Cao hơn sidebar và header
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        content: {
          position: 'relative', margin: 'auto', width: '95%', maxWidth: '1100px', // Tăng kích thước
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          padding: '0', border: 'none', borderRadius: '12px', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', // Shadow lớn hơn
          background: '#f9fafb' // Nền xám nhẹ
        }
      }}
      contentLabel="Phân công Timeline"
    >
      <div className="p-6 bg-white border-b border-gray-200 flex justify-between items-center rounded-t-lg">
        <h2 className="text-xl font-bold text-blue-700">{title}</h2> {/* Làm nổi bật tiêu đề modal */}
        <button onClick={onRequestClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors" disabled={isSaving}><FaTimes size={16} /></button>
      </div>

      <div className="p-5 overflow-y-auto flex-grow">
        {projectsToAssign.length === 0 ? (
          <p className="text-center text-gray-500">Không có công trình nào cần phân công cho đối tượng này trong năm {financialYear}.</p>
        ) : (
          <>
            <div className="mb-6 p-4 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-wrap items-end gap-3"> {/* Thêm flex-wrap */}
              <div className="flex-grow">
                <label htmlFor="commonStartDate" className="block text-sm font-medium text-gray-700 mb-1">Ngày BĐ chung (cho Tự động)</label>
                <input
                  type="date"
                  id="commonStartDate"
                  value={commonStartDate}
                  onChange={(e) => setCommonStartDate(e.target.value)}
                  className="form-input w-full rounded-lg shadow-md text-sm border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150"
                />
              </div>
              <button onClick={handleApplyCommonStartDate} className="btn btn-secondary text-sm rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 active:scale-100 transition-all duration-200" disabled={isSaving}>Áp dụng</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-lg">
                  <tr>
                    {/* Thêm cột cho handle kéo thả */}
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ width: '40px' }}></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Tên Công trình</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{minWidth: '100px'}}>Loại</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{minWidth: '130px'}}>Ngày BĐ</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{minWidth: '90px'}}>Số ngày</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{minWidth: '130px'}}>Ngày KT</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider">Loại trừ nghỉ</th>
                  </tr>
                </thead>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="assignment-table-body">
                    {(provided) => (
                      <tbody
                        className="bg-white divide-y divide-gray-200"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {assignments.map((assign, index) => (
                          <Draggable key={assign.projectId} draggableId={assign.projectId} index={index}>
                            {(provided, snapshot) => (
                              <tr
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`table-row-custom ${snapshot.isDragging ? 'bg-blue-100 shadow-lg' : 'hover:bg-gray-50'}`}
                              >
                                {/* Cột handle kéo thả */}
                                <td className="px-3 py-2 text-center text-gray-500 cursor-grab hover:text-blue-600 transition-colors">⠿</td>
                                <td className="px-3 py-2 whitespace-normal text-sm text-gray-800 font-medium">{assign.projectName}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <select value={assign.assignmentType} onChange={(e) => handleAssignmentChange(index, 'assignmentType', e.target.value)} className="form-select text-sm rounded-lg shadow-sm border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 w-full transition-all duration-150">
                                    <option value="auto">Tự động</option>
                                    <option value="manual">Thủ công</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2"><input type="date" value={assign.startDate} onChange={(e) => handleAssignmentChange(index, 'startDate', e.target.value)} className="form-input text-sm rounded-lg shadow-sm w-full border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150" /></td>
                                <td className="px-3 py-2"><input type="number" placeholder="Số ngày" value={assign.durationDays} onChange={(e) => handleAssignmentChange(index, 'durationDays', e.target.value)} className="form-input text-sm rounded-lg shadow-sm w-full border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150" /></td>
                                <td className="px-3 py-2"><input type="date" value={assign.endDate} onChange={(e) => handleAssignmentChange(index, 'endDate', e.target.value)} className="form-input text-sm rounded-lg shadow-sm w-full border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150" disabled={assign.assignmentType === 'auto' && !!assign.durationDays && !!assign.startDate} /></td>
                                <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={assign.excludeHolidays} onChange={(e) => handleAssignmentChange(index, 'excludeHolidays', e.target.checked)} className="form-checkbox h-5 w-5 rounded text-blue-600 border-gray-400 shadow-sm focus:ring-offset-0 focus:ring-2 focus:ring-blue-400 transition-all duration-150 cursor-pointer" />
                                </td>
                              </tr>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </DragDropContext>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="p-6 bg-white border-t border-gray-200 flex justify-end gap-4 rounded-b-lg shadow-inner-top">
        <button
          type="button"
          onClick={onRequestClose}
          disabled={isSaving}
          className="btn btn-secondary flex items-center gap-2 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
        >
          <FaTimes /> Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || assignments.length === 0}
          className="btn btn-primary flex items-center gap-2 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          <FaSave /> {isSaving ? 'Đang lưu...' : 'Lưu Phân công'}
        </button>
      </div>
    </Modal>
  );
};

export default TimelineAssignmentModal;
