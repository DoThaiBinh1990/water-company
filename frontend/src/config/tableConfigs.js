// d:\CODE\water-company\frontend\src\config\tableConfigs.js
import { FaUser } from 'react-icons/fa'; // Loại bỏ các icon không dùng trực tiếp ở đây
import { formatDate, getStatusDisplay, getBaseStatusInfo } from '../utils/helpers'; // Import getBaseStatusInfo
import React from 'react'; // Import React để sử dụng JSX trong render functions

const commonFields = {
  name: {
    header: 'Tên công trình',
    field: 'name',
    width: '300px', // Tăng độ rộng
    minWidth: '250px', // Tăng độ rộng tối thiểu
    sticky: true,
    left: '50px',
    headerClassName: 'sticky-col-2-header',
    className: 'sticky-col-2-data align-left', // Ensure class sets text-align: left
    align: 'left', // Explicit align for style prop
    tooltipRender: (project) => `Tên: ${project.name}\nLoại: ${project.projectType || 'N/A'}`
  },
  allocatedUnit: { header: 'Đơn vị PB', field: 'allocatedUnit', width: '160px', minWidth: '130px', align: 'center' },
  location: { header: 'Địa điểm', field: 'location', width: '220px', minWidth: '180px', align: 'left' },
  scale: { header: 'Quy mô', field: 'scale', width: '300px', minWidth: '250px', align: 'left', className: 'align-left break-words' }, // Increased width, align left
  supervisor: {
    header: 'Người theo dõi',
    field: 'supervisor', // Backend nên trả về object user đã populate (với fullName) hoặc string ID
    width: '160px',
    minWidth: '120px',
    render: (project, cellData) => { // cellData chứa isChanged, displayValue, originalValue
      const getUserDisplay = (value) => {
        if (value && typeof value === 'object') {
          return value.fullName || value.username || 'N/A';
        }
        return typeof value === 'string' && value ? value : 'N/A'; // Hiển thị ID nếu không resolve được
      };

      const currentDisplay = getUserDisplay(cellData.displayValue);

      if (cellData.isChanged) {
        const originalDisplay = getUserDisplay(cellData.originalValue);
        return (
          <>
            <span className="cell-changed-value font-semibold">{currentDisplay}</span>
            {cellData.originalValue !== undefined && (
              <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">
                (Cũ: {originalDisplay})
              </span>
            )}
          </>
        );
      }
      return currentDisplay;
    }
  },
  leadershipApproval: { header: 'Bút phê LĐ', field: 'leadershipApproval', width: '250px', minWidth: '200px', align: 'left', className: 'align-left break-words' },
  notes: { header: 'Ghi chú', field: 'notes', width: '280px', minWidth: '220px', align: 'left', className: 'align-left break-words' },
  status: {
    header: 'Trạng thái',
    field: 'status', // Field này sẽ được cellData.displayValue và cellData.originalValue sử dụng
    width: '180px',
    minWidth: '150px',
    align: 'center',
    render: (project, cellData, isPendingTab) => {
      // 1. Lấy thông tin hiển thị trạng thái tổng thể của dự án (ví dụ: "Đang YC sửa", "Chờ duyệt mới")
      const overallStatusInfo = getStatusDisplay(project, isPendingTab);

      const assignedTo = project.assignedTo;
      let assignedToDisplay = 'N/A';
      if (assignedTo) {
        if (typeof assignedTo === 'object' && (assignedTo.fullName || assignedTo.username)) {
          assignedToDisplay = assignedTo.fullName || assignedTo.username;
        } else if (typeof assignedTo === 'string') {
          // GenericTable sẽ cố gắng resolve nếu usersList được truyền vào và assignedTo là ID
          // Nếu không, nó sẽ là một chuỗi tên.
          assignedToDisplay = assignedTo; 
        }
      }

      // 2. Nếu trường 'status' cụ thể đang được sửa đổi trong pendingEdit
      let specificStatusChangeDisplay = null;
      if (cellData.isChanged) {
        // cellData.displayValue là giá trị status mới được đề xuất (ví dụ: "Hoàn thành")
        // cellData.originalValue là giá trị status cũ (ví dụ: "Đang thực hiện")
        const newStatusInfo = getBaseStatusInfo(cellData.displayValue);
        const oldStatusInfo = getBaseStatusInfo(cellData.originalValue);

        specificStatusChangeDisplay = (
          <div className="mt-1 text-center">
            <span className="cell-changed-value font-semibold block text-xs">
              Mới: <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-xs ${newStatusInfo.colorClass}`}>{newStatusInfo.icon}{newStatusInfo.text}</span>
            </span>
            {cellData.originalValue !== undefined && (
              <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">
                (Cũ: <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-xs ${oldStatusInfo.colorClass}`}>{oldStatusInfo.icon}{oldStatusInfo.text}</span>)
              </span>
            )}
          </div>
        );
      }

      return (
        <div>
          {/* Hiển thị trạng thái tổng thể của dự án */}
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${overallStatusInfo.colorClass} flex items-center justify-center`}>
            {overallStatusInfo.text}
            {assignedTo && !isPendingTab && project.status !== 'Chờ duyệt' && !project.pendingEdit && !project.pendingDelete && (
              <span className="ml-2 flex items-center text-purple-600" title={`Phụ trách: ${assignedToDisplay}`}>
                <FaUser size={12} className="mr-0.5" />
                {typeof assignedToDisplay === 'string' ? assignedToDisplay.split(' ')[0] : 'N/A'}
              </span>
            )}
          </span>
          {specificStatusChangeDisplay}
        </div>
      );
    }
  },
  approvedBy: {
    header: 'Người duyệt',
    field: 'approvedBy',
    width: '160px',
    minWidth: '130px',
    align: 'center',
    tooltipRender: (project) => {
      if (!project.history || project.history.length === 0) {
        const currentApproverData = project.approvedBy;
        const currentApproverName = (currentApproverData && typeof currentApproverData === 'object' && (currentApproverData.fullName || currentApproverData.username))
                                    ? (currentApproverData.fullName || currentApproverData.username)
                                    : (typeof currentApproverData === 'string' ? currentApproverData : 'N/A');
        return `Người duyệt: ${currentApproverName}`;
      }
      const approvalActions = project.history.filter(h => ['approved', 'edit_approved', 'rejected', 'edit_rejected', 'delete_approved', 'delete_rejected'].includes(h.action));
      if (approvalActions.length === 0) {
        const currentApprover = project.approvedBy ? (project.approvedBy.fullName || project.approvedBy.username) : 'Chưa duyệt';
        return `Người duyệt hiện tại: ${currentApprover}`;
      }

      const tooltipLines = approvalActions.map(h => {
        const userName = (h.user && typeof h.user === 'object') ? (h.user.fullName || h.user.username) : 'N/A';
        let actionText = h.action;
        if (h.action === 'approved') actionText = 'Duyệt mới';
        else if (h.action === 'edit_approved') actionText = 'Duyệt sửa';
        else if (h.action === 'rejected') actionText = 'Từ chối mới';
        else if (h.action === 'edit_rejected') actionText = 'Từ chối sửa';
        else if (h.action === 'delete_approved') actionText = 'Duyệt xóa';
        else if (h.action === 'delete_rejected') actionText = 'Từ chối xóa';
        return `${actionText} bởi ${userName} (${formatDate(h.timestamp)})`;
      });
      
      const currentApprover = project.approvedBy ? (project.approvedBy.fullName || project.approvedBy.username) : 'Chưa có người duyệt';
      tooltipLines.unshift(`Người duyệt hiện tại: ${currentApprover}`);
      return tooltipLines.join('\n');
    },
    render: (project, cellData) => { // cellData chứa isChanged, displayValue, originalValue
      const getUserDisplay = (value) => {
        if (value && typeof value === 'object') {
          return value.fullName || value.username || 'N/A';
        }
        return typeof value === 'string' && value ? value : 'N/A';
      };

      let currentDisplayValue = cellData.displayValue;
      // Ưu tiên hiển thị người duyệt từ history nếu không có thay đổi đang chờ duyệt cho trường này
      if (!cellData.isChanged) {
        const lastApprovalAction = project.history?.filter(h => h.action === 'approved' || h.action === 'edit_approved').pop();
        if (lastApprovalAction && lastApprovalAction.user) {
          currentDisplayValue = lastApprovalAction.user; // Đây là object user đã populate
        }
      }
      // Nếu cellData.isChanged, currentDisplayValue đã là giá trị mới (ID hoặc object đã resolve)

      const currentDisplay = getUserDisplay(currentDisplayValue);

      if (cellData.isChanged) {
        const originalDisplay = getUserDisplay(cellData.originalValue);
        return (
          <>
            <span className="cell-changed-value font-semibold">{currentDisplay}</span>
            {cellData.originalValue !== undefined && (
              <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">
                (Cũ: {originalDisplay})
              </span>
            )}
          </>
        );
      }
      if (currentDisplay === 'N/A' && project.approvedBy) { // Fallback nếu history không có và cellData không đổi
        return getUserDisplay(project.approvedBy);
        }
      return currentDisplay;
    }
  },
  createdBy: {
    header: 'Người tạo/YC',
    field: 'createdBy',
    width: '160px',
    minWidth: '130px',
    align: 'center',
    tooltipRender: (project) => {
      let tooltipLines = [];
      const creationAction = project.history?.find(h => h.action === 'created');
      if (creationAction && creationAction.user) {
        const creator = creationAction.user;
        tooltipLines.push(`Tạo bởi: ${creator.fullName || creator.username} (${formatDate(creationAction.timestamp)})`);
      } else if (project.createdBy) { 
        const creator = project.createdBy;
        tooltipLines.push(`Tạo bởi: ${creator.fullName || creator.username} (${formatDate(project.createdAt)})`);
      } else {
        tooltipLines.push(`Người tạo: ${project.enteredBy || 'N/A'} (${formatDate(project.createdAt)})`);
      }

      const editRequestActions = project.history?.filter(h => h.action === 'edit_requested');
      if (editRequestActions && editRequestActions.length > 0) {
        tooltipLines.push("--- Yêu cầu sửa ---");
        editRequestActions.forEach(h => {
          const requester = h.user;
          tooltipLines.push(`  Bởi: ${requester.fullName || requester.username} (${formatDate(h.timestamp)})`);
        });
      }

      const deleteRequestActions = project.history?.filter(h => h.action === 'delete_requested');
      if (deleteRequestActions && deleteRequestActions.length > 0) {
        tooltipLines.push("--- Yêu cầu xóa ---");
        deleteRequestActions.forEach(h => {
          const requester = h.user;
          tooltipLines.push(`  Bởi: ${requester.fullName || requester.username} (${formatDate(h.timestamp)})`);
        });
      }
      return tooltipLines.join('\n');
    },
    render: (project) => {
        let displayUser = 'N/A';
        let actionText = '';
        let originalCreatorName = project.enteredBy || 'N/A'; // Lấy người tạo gốc từ enteredBy

        if (project.createdBy && typeof project.createdBy === 'object') {
            originalCreatorName = project.createdBy.fullName || project.createdBy.username || project.enteredBy || 'N/A';
        }


        // Ưu tiên hiển thị người yêu cầu gần nhất nếu có và project đang trong trạng thái pending
        const lastEditRequest = project.history?.filter(h => h.action === 'edit_requested').pop();
        const lastDeleteRequest = project.history?.filter(h => h.action === 'delete_requested').pop();

        if (project.pendingEdit && lastEditRequest && lastEditRequest.user) {
            const requester = lastEditRequest.user;
            displayUser = requester.fullName || requester.username;
            actionText = '(YC sửa)';
        } else if (project.pendingDelete && lastDeleteRequest && lastDeleteRequest.user) {
            const requester = lastDeleteRequest.user;
            displayUser = requester.fullName || requester.username;
            actionText = '(YC xóa)';
        } else {
            // Hiển thị người tạo gốc từ history hoặc project.createdBy
            const creationAction = project.history?.find(h => h.action === 'created');
            if (creationAction && creationAction.user) {
                const creator = creationAction.user;
                displayUser = creator.fullName || creator.username;
            } else if (project.createdBy && typeof project.createdBy === 'object') {
                const creator = project.createdBy;
                displayUser = creator.fullName || creator.username;
            } else if (project.enteredBy) {
                displayUser = project.enteredBy;
            }
        }
        
        if (actionText) {
            return <span title={`Người tạo gốc: ${originalCreatorName}`}>{displayUser} {actionText}</span>;
        }
        return displayUser;
    }
  },
  projectType: { header: 'Loại CT', field: 'projectType', width: '150px', minWidth: '120px', align: 'center' },
  estimator: {
    header: 'Người lập DT',
    field: 'estimator',
    width: '160px',
    minWidth: '120px',
    align: 'center', // Giữ align center
    render: (project, cellData) => { // cellData chứa isChanged, displayValue, originalValue
      const getUserDisplay = (value) => {
        if (value && typeof value === 'object') {
          return value.fullName || value.username || 'N/A';
        }
        return typeof value === 'string' && value ? value : 'N/A'; // Hiển thị ID nếu không resolve được
      };

      const currentDisplay = getUserDisplay(cellData.displayValue);

      if (cellData.isChanged) {
        const originalDisplay = getUserDisplay(cellData.originalValue);
        return (
          <>
            <span className="cell-changed-value font-semibold">{currentDisplay}</span>
            {cellData.originalValue !== undefined && (
              <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">
                (Cũ: {originalDisplay})
              </span>
            )}
          </>
        );
      }
      return currentDisplay;
    }
  },
  startDate: { header: 'Ngày BĐ', field: 'startDate', width: '120px', minWidth: '100px', format: 'date', align: 'center' },
  completionDate: { header: 'Ngày HT', field: 'completionDate', width: '120px', minWidth: '100px', format: 'date', align: 'center' },
  initialValue: { header: 'Giá trị PB', field: 'initialValue', width: '160px', minWidth: '130px', format: 'currency', align: 'right' },
  estimatedValue: { header: 'Giá trị DT', field: 'estimatedValue', width: '160px', minWidth: '130px', format: 'currency', align: 'right' },
  contractValue: { header: 'Giá trị GK', field: 'contractValue', width: '160px', minWidth: '130px', format: 'currency', align: 'right' },
  constructionUnit: { header: 'Đơn vị TC', field: 'constructionUnit', width: '160px', minWidth: '130px', align: 'center' }, // Changed to center
  progress: { header: 'Tiến độ TC', field: 'progress', width: '180px', minWidth: '150px', align: 'left' },
  feasibility: { header: 'Khả năng TH', field: 'feasibility', width: '180px', minWidth: '150px', align: 'left' },
  durationDays: { header: 'Số ngày TH', field: 'durationDays', width: '120px', minWidth: '100px', align: 'center' }, // Changed to center
  allocationWave: { header: 'Phân bổ đợt', field: 'allocationWave', width: '160px', minWidth: '130px', align: 'center' }, // Changed to center
  reportDate: { header: 'Ngày xảy ra SC', field: 'reportDate', width: '160px', minWidth: '130px', format: 'date', align: 'center' },
  inspectionDate: { header: 'Ngày kiểm tra', field: 'inspectionDate', width: '160px', minWidth: '130px', format: 'date', align: 'center' },
  paymentDate: { header: 'Ngày thanh toán', field: 'paymentDate', width: '160px', minWidth: '130px', format: 'date', align: 'center' },
  paymentValue: { header: 'Giá trị TT', field: 'paymentValue', width: '160px', minWidth: '130px', format: 'currency', align: 'right' },
};

export const categoryProjectColumns = [
  commonFields.name,
  commonFields.allocatedUnit,
  commonFields.projectType,
  commonFields.scale,
  commonFields.location,
  commonFields.estimator,
  commonFields.supervisor,
  commonFields.durationDays,
  commonFields.startDate,
  commonFields.completionDate,
  commonFields.initialValue,
  commonFields.estimatedValue,
  commonFields.contractValue,
  commonFields.constructionUnit,
  commonFields.progress,
  commonFields.feasibility,
  commonFields.allocationWave,
  commonFields.leadershipApproval,
  commonFields.notes,
  commonFields.status,
  commonFields.approvedBy,
  commonFields.createdBy,
];

export const minorRepairProjectColumns = [
  commonFields.name,
  commonFields.allocatedUnit,
  commonFields.location,
  commonFields.scale,
  commonFields.reportDate,
  commonFields.supervisor, // Đã được cập nhật ở commonFields
  commonFields.inspectionDate,
  commonFields.paymentDate,
  commonFields.paymentValue,
  commonFields.leadershipApproval,
  commonFields.notes,
  commonFields.status,
  commonFields.approvedBy,
  commonFields.createdBy,
];
