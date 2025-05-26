// d:\CODE\water-company\frontend\src\components\TimelineManagement\TimelineAssignmentModal.js
import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-modal';
import { FaSave, FaTimes, FaCalendarAlt, FaSortAmountDown, FaSortAmountUp, FaExclamationTriangle } from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'; // Import DND components
import { calculateEndDateClientSide } from '../../utils/dateUtils'; // Import hàm mới
import { useMediaQuery } from '../../hooks/useMediaQuery'; // Import hook
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
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    if (projectsToAssign && projectsToAssign.length > 0) {
      const initialAssignments = projectsToAssign.map((p, index) => {
        const timelineDetails = timelineType === 'profile' ? p.profileTimeline : p.constructionTimeline;

        let initialAssignmentType = timelineDetails?.assignmentType || 'auto';
        let initialStartDate = timelineDetails?.startDate ? new Date(timelineDetails.startDate).toISOString().split('T')[0] : '';
        let initialDurationDays = timelineDetails?.durationDays || '';
        let initialEndDate = timelineDetails?.endDate ? new Date(timelineDetails.endDate).toISOString().split('T')[0] : '';
        let initialExcludeHolidays = timelineDetails?.excludeHolidays !== undefined ? timelineDetails.excludeHolidays : true;
        // Ưu tiên order từ timelineDetails, nếu không có thì dùng index làm order ban đầu
        let initialOrder = (timelineDetails?.order !== undefined && timelineDetails?.order !== null) ? timelineDetails.order : index;

        // Nếu là manual và không có ngày từ timelineDetails, thử lấy từ gốc (chỉ cho profile category)
        if (initialAssignmentType === 'manual' && timelineType === 'profile' && objectType === 'category') {
          if (!initialStartDate && p.startDate) {
            initialStartDate = new Date(p.startDate).toISOString().split('T')[0];
          }
          if (!initialDurationDays && p.durationDays) {
            initialDurationDays = String(p.durationDays); // Ensure string for input
          }
          if (!initialEndDate && p.completionDate) {
            initialEndDate = new Date(p.completionDate).toISOString().split('T')[0];
          }
        }

        return {
          projectId: p._id,
          projectName: p.name,
          projectCode: p.projectCode, // Đã thêm projectCode
          allocatedUnit: p.allocatedUnit || 'N/A',
          // Lấy số thứ tự gốc của công trình
          originalSerialNumber: p.categorySerialNumber || p.minorRepairSerialNumber || null,
          assignmentType: initialAssignmentType,
          startDate: initialStartDate,
          durationDays: initialDurationDays,
          endDate: initialEndDate,
          excludeHolidays: initialExcludeHolidays,
          order: initialOrder, // Gán order đã xác định
        };
      }).sort((a, b) => (a.order || 0) - (b.order || 0)); // Sắp xếp theo order

      setAssignments(initialAssignments);
    } else {
      setAssignments([]);
    }
    // Không reset commonStartDate ở đây để giữ giá trị người dùng đã nhập nếu modal mở lại với cùng projectsToAssign
  }, [projectsToAssign, timelineType, objectType]); // Bỏ commonStartDate khỏi đây

  // useEffect để tự động tính toán lại ngày khi assignments, commonStartDate, hoặc holidays thay đổi
  useEffect(() => {
    if (assignments.length === 0) return;

    let lastValidAutoTaskEndDate = null; // Chỉ theo dõi ngày kết thúc của task TỰ ĐỘNG hợp lệ gần nhất

    const updatedAssignments = assignments.map((assign, index) => {
      let newAssign = { ...assign };

      if (newAssign.assignmentType === 'auto') {
        let currentTaskStartDate = null;

        // Xác định startDate cho task 'auto'
        if (lastValidAutoTaskEndDate) { // Nếu có task 'auto' hợp lệ trước đó
            currentTaskStartDate = new Date(lastValidAutoTaskEndDate);
            currentTaskStartDate.setDate(currentTaskStartDate.getDate() + 1); // Bắt đầu vào ngày kế tiếp
        } else { // Đây là task 'auto' đầu tiên trong chuỗi 'auto' hợp lệ, hoặc không có task 'auto' hợp lệ nào trước đó
            // Nếu là task đầu tiên trong danh sách tổng thể VÀ commonStartDate có giá trị
            if (index === 0 && commonStartDate && commonStartDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                currentTaskStartDate = new Date(commonStartDate);
            } else if (newAssign.startDate && newAssign.startDate.match(/^\d{4}-\d{2}-\d{2}$/)) { // Có startDate hợp lệ từ trước
                currentTaskStartDate = new Date(newAssign.startDate);
            }
            // Nếu không, currentTaskStartDate sẽ là null
        }

        if (currentTaskStartDate) {
          let tempStartDate = new Date(currentTaskStartDate); // Tạo bản sao để không thay đổi currentTaskStartDate gốc
          if (newAssign.excludeHolidays) {
            while (tempStartDate.getDay() === 0 || tempStartDate.getDay() === 6 || holidays.includes(tempStartDate.toISOString().split('T')[0])) {
                tempStartDate.setDate(tempStartDate.getDate() + 1);
            }
          }
          newAssign.startDate = tempStartDate.toISOString().split('T')[0];
        } else {
          newAssign.startDate = ''; // Không xác định được ngày bắt đầu
        }

        // Tính toán endDate dựa trên startDate và durationDays mới
        if (newAssign.startDate && newAssign.durationDays && parseInt(newAssign.durationDays, 10) > 0) {
          const calculatedEnd = calculateEndDateClientSide(
            newAssign.startDate,
            parseInt(newAssign.durationDays, 10),
            newAssign.excludeHolidays, // Cờ này sẽ quyết định có bỏ qua cuối tuần và holidays không
            holidays // Danh sách ngày nghỉ lễ
          );
          if (calculatedEnd) {
            newAssign.endDate = calculatedEnd.toISOString().split('T')[0];
            lastValidAutoTaskEndDate = new Date(newAssign.endDate); // Cập nhật cho task 'auto' hợp lệ tiếp theo
          } else {
            newAssign.endDate = ''; // Clear if calculation fails
            lastValidAutoTaskEndDate = null; // Reset vì task 'auto' này không hợp lệ
          }
        } else { // Nếu không có startDate hoặc durationDays hợp lệ
          newAssign.endDate = '';
          lastValidAutoTaskEndDate = null; // Reset vì task 'auto' này không hợp lệ
        }
      } else { // Manual task
        // Ngày của manual task được giữ nguyên như người dùng nhập,
        // NGOẠI TRỪ trường hợp startDate và durationDays được cung cấp, thì tính endDate
        if (newAssign.startDate && newAssign.startDate.match(/^\d{4}-\d{2}-\d{2}$/) &&
            newAssign.durationDays && parseInt(newAssign.durationDays, 10) > 0) {
          
          const calculatedEnd = calculateEndDateClientSide(
            newAssign.startDate,
            parseInt(newAssign.durationDays, 10),
            newAssign.excludeHolidays, // Sử dụng cờ excludeHolidays của chính task manual
            holidays
          );
          if (calculatedEnd) {
            newAssign.endDate = calculatedEnd.toISOString().split('T')[0];
          } else {
            newAssign.endDate = ''; // Nếu không tính được endDate, xóa đi
          }
        }
        // Quan trọng: KHÔNG cập nhật lastValidAutoTaskEndDate cho manual task
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
    const assignmentAtIndex = newAssignments[index];
    const oldAssignmentType = assignmentAtIndex.assignmentType;

    // Gán giá trị mới cho trường đang thay đổi
    assignmentAtIndex[field] = value;

    // Xử lý logic chuyển đổi assignmentType và reset ngày
    if (field === 'assignmentType') {
      if (oldAssignmentType === 'manual' && value === 'auto') {
        // Chuyển từ manual sang auto: reset ngày để useEffect tính lại
        assignmentAtIndex.startDate = '';
        assignmentAtIndex.endDate = '';
        // durationDays có thể giữ lại hoặc xóa tùy yêu cầu. Hiện tại giữ lại.
      }
      // Nếu người dùng chủ động chuyển từ auto sang manual,
      // người dùng sẽ tự nhập ngày.
    } else if (['startDate', 'durationDays', 'endDate', 'excludeHolidays'].includes(field)) {
      // Khi người dùng thay đổi các trường ngày tháng, không tự động đổi assignmentType nữa.
      // useEffect sẽ tự tính toán lại ngày dựa trên assignmentType hiện tại.
      // Nếu assignmentType là 'manual' và người dùng sửa startDate/durationDays, useEffect sẽ tính lại endDate.
    }
    setAssignments(newAssignments);
  };

  const handleApplyCommonStartDate = () => {
    if (!commonStartDate || !commonStartDate.match(/^\d{4}-\d{2}-\d{2}$/)) { // Thêm kiểm tra định dạng
      toast.warn('Vui lòng chọn ngày bắt đầu chung hợp lệ.', { position: "top-center" });
      return;
    }
    // Tìm task auto đầu tiên trong danh sách hiện tại
    let firstAutoTaskIndex = -1;
    for(let i=0; i < assignments.length; i++) {
        if (assignments[i].assignmentType === 'auto') {
            firstAutoTaskIndex = i;
            break;
        }
    }

    if (firstAutoTaskIndex !== -1) {
        const newAssignments = assignments.map((assign, index) => {
          if (index === firstAutoTaskIndex) { // Chỉ áp dụng cho task auto đầu tiên tìm thấy
            return { ...assign, startDate: commonStartDate, endDate: '' }; // Reset endDate để tính lại
          }
          return assign;
        });
        setAssignments(newAssignments); // Điều này sẽ trigger useEffect ở trên để tính toán lại
        toast.success('Đã áp dụng ngày bắt đầu chung cho công trình "Tự động" đầu tiên.', { position: "top-center" });
    } else {
        toast.info('Không có công trình "Tự động" nào trong danh sách để áp dụng ngày bắt đầu chung.', { position: "top-center" });
      }
  };

  const handleSave = async () => {
    const payloadAssignments = assignments.map((a, idx) => ({ // Thêm idx để lấy order nếu cần
      projectId: a.projectId,
      assignmentType: a.assignmentType,
      startDate: a.startDate,
      durationDays: a.durationDays ? parseInt(a.durationDays, 10) : null,
      endDate: a.endDate,
      excludeHolidays: a.excludeHolidays,
      order: a.order, // Luôn gửi order đã được cập nhật sau drag-drop
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
    try {
      await onSaveAssignments(payload); // Giả sử onSaveAssignments là một hàm async (mutateAsync)
      // Toast success đã được xử lý trong TimelineLogic
      onRequestClose(); // Đóng modal nếu lưu thành công
    } catch (error) {
      // Toast error đã được xử lý trong TimelineLogic
      // Không cần làm gì thêm ở đây, modal sẽ không đóng
    }
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
          position: 'relative', // Để inset: 'auto' hoạt động đúng
          inset: 'auto',        // Ngăn react-modal áp dụng top/left/right/bottom mặc định
          maxWidth: '1250px',   // Giới hạn chiều rộng tối đa chung
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          border: 'none',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          background: '#f9fafb',
          boxSizing: 'border-box', // Đảm bảo padding và border được tính vào width/height
          ...(isMobile ? {
            width: 'auto',      // Để width được xác định bởi margins và nội dung
            marginLeft: '10px', // Đặt margin trái 10px
            marginRight: '10px',// Đặt margin phải 10px
            // Vertical centering được xử lý bởi alignItems: 'center' của overlay
            // Horizontal centering được xử lý bởi justifyContent: 'center' của overlay
          } : {
            width: '95%',       // Width cho desktop
            margin: 'auto',     // Căn giữa cho desktop
          }),
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
                <label htmlFor="commonStartDate" className="block text-sm font-medium text-gray-700 mb-1">Ngày BĐ chung (cho công trình "Tự động" đầu tiên)</label>
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
            {isMobile ? (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="assignment-cards-list">
                  {(provided) => (
                    <div
                      className="space-y-4"
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {assignments.map((assign, index) => (
                        <Draggable key={assign.projectId} draggableId={assign.projectId} index={index}>
                          {(providedDraggable, snapshot) => (
                            <div
                              ref={providedDraggable.innerRef}
                              {...providedDraggable.draggableProps}
                              className={`bg-white p-4 rounded-lg shadow-md border ${snapshot.isDragging ? 'border-blue-500 shadow-xl' : 'border-gray-200'}`}
                            >
                              <div className="flex justify-between items-start mb-1"> {/* items-start để icon kéo thẳng hàng với text */}
                                <div>
                                  <p className="text-xs text-gray-600">
                                    Thứ tự: <span className="font-semibold">{index + 1}</span>
                                  </p>
                                  <h3 className="text-base font-semibold text-blue-700 truncate pr-2 mt-0.5" title={`${assign.projectName}${assign.projectCode ? ` (${assign.projectCode})` : ''}`}>
                                    {assign.projectName} {assign.projectCode && <span className="text-sm text-gray-500 font-normal">({assign.projectCode})</span>}
                                  </h3>
                                </div>
                                <div {...providedDraggable.dragHandleProps} className="p-2 cursor-grab text-gray-500 hover:text-blue-600">
                                  ⠿
                                </div>
                              </div>

                              <p className="text-xs text-gray-600 mb-2">ĐV Phân bổ: {assign.allocatedUnit}</p>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Loại PC</label>
                                  <select value={assign.assignmentType} onChange={(e) => handleAssignmentChange(index, 'assignmentType', e.target.value)} className="form-select p-2 text-xs rounded-md shadow-sm border-gray-300 w-full">
                                    <option value="auto">Tự động</option>
                                    <option value="manual">Thủ công</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Số ngày</label>
                                  <input type="number" placeholder="Số ngày" value={assign.durationDays} onChange={(e) => handleAssignmentChange(index, 'durationDays', e.target.value)} className="form-input p-2 text-xs rounded-md shadow-sm w-full border-gray-300" />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Ngày BĐ</label>
                                  <input type="date" value={assign.startDate} onChange={(e) => handleAssignmentChange(index, 'startDate', e.target.value)} className="form-input p-2 text-xs rounded-md shadow-sm w-full border-gray-300" 
                                    disabled={assign.assignmentType === 'auto' && !!assign.startDate && index > 0 && assignments[index-1].assignmentType === 'auto'}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Ngày KT</label>
                                  <input type="date" value={assign.endDate} onChange={(e) => handleAssignmentChange(index, 'endDate', e.target.value)} className="form-input p-2 text-xs rounded-md shadow-sm w-full border-gray-300" 
                                    disabled={assign.assignmentType === 'auto' && !!assign.durationDays && !!assign.startDate}
                                    readOnly={assign.assignmentType === 'auto'}
                                  />
                                </div>
                                <div className="col-span-2 flex items-center mt-1">
                                  <input type="checkbox" id={`excludeHolidays-${assign.projectId}`} checked={assign.excludeHolidays} onChange={(e) => handleAssignmentChange(index, 'excludeHolidays', e.target.checked)} className="form-checkbox h-4 w-4 rounded text-blue-600 border-gray-400 shadow-sm focus:ring-offset-0 focus:ring-2 focus:ring-blue-400" />
                                  <label htmlFor={`excludeHolidays-${assign.projectId}`} className="ml-2 text-xs text-gray-700">Loại trừ ngày nghỉ/cuối tuần</label>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              // Desktop table view (original)
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                  <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-lg">
                    <tr>
                      <th className="px-2 md:px-3 py-2 md:py-3 text-center text-xs font-semibold uppercase tracking-wider border-r border-blue-400" style={{ width: '30px' }}></th>
                      <th className="px-2 md:px-3 py-2 md:py-3 text-center text-xs font-semibold uppercase tracking-wider border-r border-blue-400" style={{ width: '50px' }}>STT PC</th>
                      <th className="px-2 md:px-3 py-2 md:py-3 text-left text-xs font-semibold uppercase tracking-wider border-r border-blue-400" style={{minWidth: '180px'}}>Tên CT</th>
                      <th className="px-2 md:px-3 py-2 md:py-3 text-left text-xs font-semibold uppercase tracking-wider border-r border-blue-400" style={{minWidth: '120px'}}>ĐV PB</th> 
                      <th className="px-2 md:px-3 py-2 md:py-3 text-center text-xs font-semibold uppercase tracking-wider border-r border-blue-400" style={{minWidth: '120px'}}>Loại</th>
                      <th className="px-2 md:px-3 py-2 md:py-3 text-center text-xs font-semibold uppercase tracking-wider border-r border-blue-400" style={{minWidth: '120px'}}>Ngày BĐ</th>
                      <th className="px-2 md:px-3 py-2 md:py-3 text-center text-xs font-semibold uppercase tracking-wider border-r border-blue-400" style={{minWidth: '80px'}}>Số ngày</th>
                      <th className="px-2 md:px-3 py-2 md:py-3 text-center text-xs font-semibold uppercase tracking-wider border-r border-blue-400" style={{minWidth: '120px'}}>Ngày KT</th>
                      <th className="px-2 md:px-3 py-2 md:py-3 text-center text-xs font-semibold uppercase tracking-wider">Loại trừ nghỉ</th>
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
                              {(providedDraggable, snapshot) => (
                                <tr
                                  ref={providedDraggable.innerRef}
                                  {...providedDraggable.draggableProps}
                                  {...providedDraggable.dragHandleProps}
                                  className={`table-row-custom ${snapshot.isDragging ? 'bg-blue-100 shadow-lg' : 'hover:bg-gray-50'}`}
                                >
                                  <td className="px-1 md:px-3 py-1 md:py-2 text-center text-gray-500 cursor-grab hover:text-blue-600 transition-colors border-r border-gray-300 align-middle">⠿</td>
                                  <td className="px-1 md:px-3 py-1 md:py-2 text-center text-xs md:text-sm text-gray-700 border-r border-gray-300 align-middle">{index + 1}</td>
                                  <td className="px-1.5 md:px-3 py-1 md:py-2 whitespace-normal text-xs md:text-sm text-gray-800 font-medium border-r border-gray-300 align-middle">
                                    {assign.projectName}
                                    {assign.projectCode && (
                                      <span className="ml-1 text-gray-500 text-xs" title={`Mã công trình: ${assign.projectCode}`}>
                                        ({assign.projectCode})
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-1.5 md:px-3 py-1 md:py-2 whitespace-nowrap text-xs md:text-sm text-gray-700 border-r border-gray-300 align-middle">{assign.allocatedUnit}</td>
                                  <td className="px-1.5 md:px-3 py-1 md:py-2 border-r border-gray-300 align-middle">
                                    <select value={assign.assignmentType} onChange={(e) => handleAssignmentChange(index, 'assignmentType', e.target.value)} className="form-select pl-1.5 md:pl-2 pr-6 md:pr-8 text-xs md:text-sm rounded-md md:rounded-lg shadow-sm border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 w-full transition-all duration-150">
                                      <option value="auto">Tự động</option>
                                      <option value="manual">Thủ công</option>
                                    </select>
                                  </td>
                                  <td className="px-1.5 md:px-3 py-1 md:py-2 border-r border-gray-300 align-middle">
                                    <input type="date" value={assign.startDate} onChange={(e) => handleAssignmentChange(index, 'startDate', e.target.value)} className="form-input text-xs md:text-sm rounded-md md:rounded-lg shadow-sm w-full border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150"
                                      disabled={assign.assignmentType === 'auto' && !!assign.startDate && index > 0 && assignments[index-1].assignmentType === 'auto'}
                                    />
                                  </td>
                                  <td className="px-1.5 md:px-3 py-1 md:py-2 border-r border-gray-300 align-middle">
                                    <input type="number" placeholder="Số ngày" value={assign.durationDays} onChange={(e) => handleAssignmentChange(index, 'durationDays', e.target.value)} className="form-input text-xs md:text-sm rounded-md md:rounded-lg shadow-sm w-full border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150" />
                                  </td>
                                  <td className="px-1.5 md:px-3 py-1 md:py-2 border-r border-gray-300 align-middle">
                                    <input type="date" value={assign.endDate} onChange={(e) => handleAssignmentChange(index, 'endDate', e.target.value)} className="form-input text-xs md:text-sm rounded-md md:rounded-lg shadow-sm w-full border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-300 focus:ring-opacity-50 transition-all duration-150" 
                                      disabled={assign.assignmentType === 'auto' && !!assign.durationDays && !!assign.startDate}
                                      readOnly={assign.assignmentType === 'auto'}
                                    />
                                  </td>
                                  <td className="px-1.5 md:px-3 py-1 md:py-2 text-center align-middle">
                                    <input type="checkbox" checked={assign.excludeHolidays} onChange={(e) => handleAssignmentChange(index, 'excludeHolidays', e.target.checked)} className="form-checkbox h-5 w-5 rounded text-blue-600 border-gray-400 shadow-sm focus:ring-offset-0 focus:ring-2 focus:ring-blue-400 transition-all duration-150 cursor-pointer align-middle" />
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
            )}
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
