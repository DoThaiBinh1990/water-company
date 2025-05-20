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
        projectsToAssign.map((p, index) => ({
          projectId: p._id,
          projectName: p.name,
          currentEstimator: p.profileTimeline?.estimator?.fullName || p.profileTimeline?.estimator?.username, // Ví dụ cho profile
          currentConstructionUnit: p.constructionTimeline?.constructionUnit, // Ví dụ cho construction
          assignmentType: p.profileTimeline?.assignmentType || p.constructionTimeline?.assignmentType || 'auto',
          startDate: p.profileTimeline?.startDate || p.constructionTimeline?.startDate ? new Date(p.profileTimeline?.startDate || p.constructionTimeline?.startDate).toISOString().split('T')[0] : '',
          durationDays: p.profileTimeline?.durationDays || p.constructionTimeline?.durationDays || '',
          endDate: p.profileTimeline?.endDate || p.constructionTimeline?.endDate ? new Date(p.profileTimeline?.endDate || p.constructionTimeline?.endDate).toISOString().split('T')[0] : '',
          excludeHolidays: p.profileTimeline?.excludeHolidays !== undefined ? p.profileTimeline.excludeHolidays : (p.constructionTimeline?.excludeHolidays !== undefined ? p.constructionTimeline.excludeHolidays : true),
          order: index, // Giữ thứ tự ban đầu
        }))
      );
    } else {
      setAssignments([]);
    }
    setCommonStartDate(''); // Reset common start date when projects change
  }, [projectsToAssign]);

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
        overlay: { zIndex: 1001, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        content: { position: 'relative', margin: 'auto', width: '95%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0', border:'1px solid #ccc', borderRadius: '8px' }
      }}
      contentLabel="Phân công Timeline"
    >
      <div className="p-5 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        <button onClick={onRequestClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors" disabled={isSaving}><FaTimes size={16} /></button>
      </div>

      <div className="p-5 overflow-y-auto flex-grow">
        {projectsToAssign.length === 0 ? (
          <p className="text-center text-gray-500">Không có công trình nào cần phân công cho đối tượng này trong năm {financialYear}.</p>
        ) : (
          <>
            <div className="mb-4 flex items-end gap-2">
              <div className="flex-grow">
                <label htmlFor="commonStartDate" className="block text-sm font-medium text-gray-700 mb-1">Ngày BĐ chung (cho Tự động)</label>
                <input
                  type="date"
                  id="commonStartDate"
                  value={commonStartDate}
                  onChange={(e) => setCommonStartDate(e.target.value)}
                  className="form-input rounded-md shadow-sm text-sm"
                />
              </div>
              <button onClick={handleApplyCommonStartDate} className="btn btn-secondary text-sm" disabled={isSaving}>Áp dụng</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead className="bg-gray-50">
                  <tr>
                    {/* Thêm cột cho handle kéo thả */}
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '30px' }}></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tên Công trình</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ngày BĐ</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Số ngày</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ngày KT</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loại trừ nghỉ</th>
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
                                <td className="px-3 py-2 text-center text-gray-400 cursor-grab">⠿</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{assign.projectName}</td>
                                <td className="px-3 py-2">
                                  <select value={assign.assignmentType} onChange={(e) => handleAssignmentChange(index, 'assignmentType', e.target.value)} className="form-select text-xs rounded-md">
                                    <option value="auto">Tự động</option>
                                    <option value="manual">Thủ công</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2"><input type="date" value={assign.startDate} onChange={(e) => handleAssignmentChange(index, 'startDate', e.target.value)} className="form-input text-xs rounded-md w-32" /></td>
                                <td className="px-3 py-2"><input type="number" placeholder="Số ngày" value={assign.durationDays} onChange={(e) => handleAssignmentChange(index, 'durationDays', e.target.value)} className="form-input text-xs rounded-md w-20" /></td>
                                <td className="px-3 py-2"><input type="date" value={assign.endDate} onChange={(e) => handleAssignmentChange(index, 'endDate', e.target.value)} className="form-input text-xs rounded-md w-32" disabled={assign.assignmentType === 'auto' && !!assign.durationDays && !!assign.startDate} /></td>
                                <td className="px-3 py-2 text-center">
                                  <input type="checkbox" checked={assign.excludeHolidays} onChange={(e) => handleAssignmentChange(index, 'excludeHolidays', e.target.checked)} className="form-checkbox h-4 w-4 rounded" />
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

      <div className="p-5 bg-gray-100 border-t border-gray-300 flex justify-end gap-3">
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
          disabled={isSaving || assignments.length === 0}
          className="btn btn-primary flex items-center gap-2"
        >
          <FaSave /> {isSaving ? 'Đang lưu...' : 'Lưu Phân công'}
        </button>
      </div>
    </Modal>
  );
};

export default TimelineAssignmentModal;
