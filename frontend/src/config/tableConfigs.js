// d:\CODE\water-company\frontend\src\config\tableConfigs.js
import { FaUser } from 'react-icons/fa';
import { getStatusDisplay, getBaseStatusInfo } from '../utils/helpers';
import { formatDateToLocale } from '../utils/dateUtils';
import React from 'react'; // Import React để sử dụng JSX trong render functions

// Utility function for displaying user
const getUserDisplay = (value) => {
  if (value && typeof value === 'object') {
    return value.fullName || value.username || 'N/A';
  }
  return typeof value === 'string' && value ? value : 'N/A';
};

const commonFields = {
  name: {
    header: 'Tên công trình',
    field: 'name',
    width: '300px',
    minWidth: '250px',
    sticky: '2',
    align: 'left',
    tooltipRender: (project) => `Tên: ${project.name}\nLoại: ${project.projectType || 'N/A'}`,
  },
  projectCode: { header: 'Mã CT', field: 'projectCode', width: '130px', minWidth: '110px', align: 'center', sticky: '3' },
  allocatedUnit: { header: 'Đơn vị PB', field: 'allocatedUnit', width: '160px', minWidth: '130px', align: 'center' },
  location: { header: 'Địa điểm', field: 'location', width: '220px', minWidth: '180px', align: 'left' },
  scale: { header: 'Quy mô', field: 'scale', width: '300px', minWidth: '250px', align: 'left', className: 'align-left break-words' },
  supervisor: {
    header: 'Người theo dõi',
    field: 'supervisor',
    width: '160px',
    minWidth: '120px',
    align: 'center',
    render: (project, cellData) => {
      const currentDisplay = getUserDisplay(cellData.displayValue);
      const isCurrentNA = currentDisplay === 'N/A';

      if (cellData.isChanged) {
        const originalDisplay = getUserDisplay(cellData.originalValue);
        const isOriginalNA = originalDisplay === 'N/A';
        return (
          <>
            {isCurrentNA ? (
              <span className="text-gray-400 italic text-xs">{currentDisplay}</span>
            ) : (
              <span className="cell-changed-value font-semibold">{currentDisplay}</span>
            )}
            {cellData.originalValue !== undefined && (
               isOriginalNA ? (
                <span className="cell-changed-original-value block text-xs text-gray-400 mt-0.5 italic">(Cũ: {originalDisplay})</span>
               ) : (
                <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">(Cũ: {originalDisplay})</span>
               )
            )}
          </>
        );
      }
      if (isCurrentNA) {
        return <span className="text-gray-400 italic text-xs">{currentDisplay}</span>;
      }
      return currentDisplay;
    }
  },
  leadershipApproval: { header: 'Bút phê LĐ', field: 'leadershipApproval', width: '250px', minWidth: '200px', align: 'left', className: 'align-left break-words' },
  notes: { header: 'Ghi chú', field: 'notes', width: '280px', minWidth: '220px', align: 'left', className: 'align-left break-words' },
  status: {
    header: 'Trạng thái',
    field: 'status',
    width: '180px',
    minWidth: '150px',
    align: 'center',
    render: (project, cellData, isPendingTab) => {
      const overallStatusInfo = getStatusDisplay(project, isPendingTab);
      const assignedTo = project.assignedTo;
      let assignedToDisplay = 'N/A';
      if (assignedTo) {
        if (typeof assignedTo === 'object' && (assignedTo.fullName || assignedTo.username)) {
          assignedToDisplay = assignedTo.fullName || assignedTo.username;
        } else if (typeof assignedTo === 'string') {
          assignedToDisplay = assignedTo;
        }
      }

      let specificStatusChangeDisplay = null;
      if (cellData.isChanged) {
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
    width: '200px',
    minWidth: '180px',
    align: 'left',
    tooltipRender: (project) => {
      const currentApproverDisplay = project.approvedBy ? getUserDisplay(project.approvedBy) : 'Chưa có';
      let tooltipLines = [`Người duyệt được chỉ định/gốc: ${currentApproverDisplay}`];
      project.history?.filter(h => ['approved', 'edit_approved', 'delete_approved', 'rejected', 'edit_rejected', 'delete_rejected'].includes(h.action))
        .forEach(h => {
          const userName = getUserDisplay(h.user);
          let actionText = h.action;
          if (h.action === 'approved') actionText = 'Duyệt mới';
          else if (h.action === 'edit_approved') actionText = 'Duyệt sửa';
          else if (h.action === 'delete_approved') actionText = 'Duyệt xóa';
          else if (h.action === 'rejected') actionText = 'Từ chối mới';
          else if (h.action === 'edit_rejected') actionText = 'Từ chối sửa';
          else if (h.action === 'delete_rejected') actionText = 'Từ chối xóa';
          tooltipLines.push(`${actionText} bởi ${userName} (${formatDateToLocale(h.timestamp)})`);
        });
      return tooltipLines.join('\n');
    },
    render: (project) => {
      if (!project) return 'N/A';

      let latestApproverName = 'N/A';
      let latestApprovalDate = null;
      let latestApprovalActionText = '';

      let originalApproverName = null;
      let originalApprovalDate = null;

      if (project.status === 'Chờ duyệt' && project.approvedBy) {
        latestApproverName = getUserDisplay(project.approvedBy);
        latestApprovalActionText = '(Chờ duyệt mới)';
      } else if (project.pendingEdit && project.approvedBy) {
        latestApproverName = getUserDisplay(project.approvedBy);
        latestApprovalActionText = '(Chờ duyệt sửa)';
      } else if (project.pendingDelete && project.approvedBy) {
        latestApproverName = getUserDisplay(project.approvedBy);
        latestApprovalActionText = '(Chờ duyệt xóa)';
      } else if (project.status === 'Đã duyệt' && project.history && project.history.length > 0) {
        const approvalActions = project.history.filter(h => ['approved', 'edit_approved', 'delete_approved'].includes(h.action));
        const latestAction = approvalActions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        if (latestAction && latestAction.user) {
          latestApproverName = getUserDisplay(latestAction.user);
          latestApprovalDate = latestAction.timestamp;
          if (latestAction.action === 'approved') latestApprovalActionText = '(Duyệt mới)';
          else if (latestAction.action === 'edit_approved') latestApprovalActionText = '(Duyệt sửa)';
          else if (latestAction.action === 'delete_approved') latestApprovalActionText = '(Duyệt xóa)';
        } else if (project.approvedBy) {
            latestApproverName = getUserDisplay(project.approvedBy);
            latestApprovalActionText = '(Đã duyệt)';
        }
      } else if (project.approvedBy) {
        latestApproverName = getUserDisplay(project.approvedBy);
        latestApprovalActionText = '(Đã duyệt)';
      }

      const firstApprovalAction = project.history?.find(h => h.action === 'approved');
      if (firstApprovalAction && firstApprovalAction.user) {
        const firstApprover = getUserDisplay(firstApprovalAction.user);
        if (latestApproverName !== firstApprover || (latestApprovalDate && firstApprovalAction.timestamp && new Date(latestApprovalDate).getTime() !== new Date(firstApprovalAction.timestamp).getTime())) {
          originalApproverName = firstApprover;
          originalApprovalDate = firstApprovalAction.timestamp;
        }
      }

      let dateDisplay = latestApprovalDate ? ` (${formatDateToLocale(latestApprovalDate)})` : '';
      if (latestApprovalActionText.includes('Chờ duyệt')) dateDisplay = '';

      const mainDisplay = `${latestApproverName} ${latestApprovalActionText}${dateDisplay}`;

      if (originalApproverName) {
        const originalDateDisplay = originalApprovalDate ? ` (${formatDateToLocale(originalApprovalDate)})` : '';
        return (
          <>
            <span>{mainDisplay}</span>
            <span className="block text-xs italic text-gray-500 mt-0.5">
              (Duyệt lần đầu: {originalApproverName}{originalDateDisplay})
            </span>
          </>
        );
      }
      return mainDisplay;
    }
  },
  createdBy: {
    header: 'Người tạo/YC',
    field: 'createdBy',
    width: '200px',
    minWidth: '180px',
    align: 'left',
    tooltipRender: (project) => {
      let tooltipLines = [];
      const creationAction = project.history?.find(h => h.action === 'created');
      if (creationAction && creationAction.user) {
        tooltipLines.push(`Tạo bởi: ${getUserDisplay(creationAction.user)} (${formatDateToLocale(creationAction.timestamp)})`);
      } else if (project.createdBy) {
        tooltipLines.push(`Tạo bởi: ${getUserDisplay(project.createdBy)} (${formatDateToLocale(project.createdAt)})`);
      }

      project.history?.filter(h => ['edit_requested', 'delete_requested'].includes(h.action))
        .forEach(h => {
          const actionText = h.action === 'edit_requested' ? 'YC sửa' : 'YC xóa';
          tooltipLines.push(`${actionText} bởi ${getUserDisplay(h.user)} (${formatDateToLocale(h.timestamp)})`);
        });
      return tooltipLines.join('\n');
    },
    render: (project) => {
      if (!project) return 'N/A';

      let currentActionUserName = 'N/A';
      let currentActionDate = null;
      let currentActionText = '';

      const originalCreatorName = getUserDisplay(project.createdBy);
      const creationActionFromHistory = project.history?.find(h => h.action === 'created');
      const originalCreationDate = creationActionFromHistory?.timestamp || project.createdAt;

      if (project.pendingEdit && project.pendingEdit.requestedBy) {
        currentActionUserName = getUserDisplay(project.pendingEdit.requestedBy);
        currentActionDate = project.pendingEdit.requestedAt;
        currentActionText = '(YC sửa)';
      } else if (project.pendingDelete) {
        const deleteRequestAction = project.history?.filter(h => h.action === 'delete_requested').pop();
        if (deleteRequestAction && deleteRequestAction.user) {
          currentActionUserName = getUserDisplay(deleteRequestAction.user);
          currentActionDate = deleteRequestAction.timestamp;
          currentActionText = '(YC xóa)';
        } else {
            currentActionUserName = originalCreatorName;
            currentActionText = '(YC xóa)';
        }
      } else {
        currentActionUserName = originalCreatorName;
        currentActionDate = originalCreationDate;
        currentActionText = '(Tạo)';
      }

      const mainDateDisplay = currentActionDate ? ` (${formatDateToLocale(currentActionDate)})` : '';
      const mainDisplay = `${currentActionUserName} ${currentActionText}${mainDateDisplay}`;

      if (currentActionText !== '(Tạo)' && currentActionUserName !== originalCreatorName) {
        const originalDateDisplay = originalCreationDate ? ` (${formatDateToLocale(originalCreationDate)})` : '';
        return (
          <div className="flex flex-col">
            <span>{mainDisplay}</span>
            <span className="text-xs italic text-gray-500 mt-0.5">
              (Tạo bởi: {originalCreatorName}{originalDateDisplay})
            </span>
          </div>
        );
      }
      return mainDisplay;
    }
  },
  projectType: { header: 'Loại CT', field: 'projectType', width: '150px', minWidth: '120px', align: 'center' },
  estimator: {
    header: 'Người lập DT',
    field: 'estimator',
    width: '160px',
    minWidth: '120px',
    align: 'center',
    render: (project, cellData) => {
      const currentDisplay = getUserDisplay(cellData.displayValue);
      const isCurrentNA = currentDisplay === 'N/A';

      if (cellData.isChanged) {
        const originalDisplay = getUserDisplay(cellData.originalValue);
        const isOriginalNA = originalDisplay === 'N/A';
        return (
          <>
            {isCurrentNA ? (
              <span className="text-gray-400 italic text-xs">{currentDisplay}</span>
            ) : (
              <span className="cell-changed-value font-semibold">{currentDisplay}</span>
            )}
            {cellData.originalValue !== undefined && (
               isOriginalNA ? (
                <span className="cell-changed-original-value block text-xs text-gray-400 mt-0.5 italic">(Cũ: {originalDisplay})</span>
               ) : (
                <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">(Cũ: {originalDisplay})</span>
               )
            )}
          </>
        );
      }
      if (isCurrentNA) {
        return <span className="text-gray-400 italic text-xs">{currentDisplay}</span>;
      }
      return currentDisplay;
    }
  },
  startDate: { header: 'Ngày BĐ', field: 'startDate', width: '120px', minWidth: '100px', format: 'date', align: 'center' },
  completionDate: { header: 'Ngày HT', field: 'completionDate', width: '120px', minWidth: '100px', format: 'date', align: 'center' },
  initialValue: { header: 'Giá trị PB', field: 'initialValue', width: '160px', minWidth: '130px', format: 'currency', align: 'right' },
  estimatedValue: { header: 'Giá trị DT', field: 'estimatedValue', width: '160px', minWidth: '130px', format: 'currency', align: 'right' },
  contractValue: { header: 'Giá trị GK', field: 'contractValue', width: '160px', minWidth: '130px', format: 'currency', align: 'right' },
  constructionUnit: { header: 'Đơn vị TC', field: 'constructionUnit', width: '160px', minWidth: '130px', align: 'center' },
  progress: { header: 'Tiến độ TC', field: 'progress', width: '180px', minWidth: '150px', align: 'left' },
  feasibility: { header: 'Khả năng TH', field: 'feasibility', width: '180px', minWidth: '150px', align: 'left' },
  durationDays: { header: 'Số ngày TH', field: 'durationDays', width: '120px', minWidth: '100px', align: 'center' },
  allocationWave: { header: 'Phân bổ đợt', field: 'allocationWave', width: '160px', minWidth: '130px', align: 'center' },
  reportDate: { header: 'Ngày xảy ra SC', field: 'reportDate', width: '160px', minWidth: '130px', format: 'date', align: 'center' },
  inspectionDate: { header: 'Ngày kiểm tra', field: 'inspectionDate', width: '160px', minWidth: '130px', format: 'date', align: 'center' },
  paymentDate: { header: 'Ngày thanh toán', field: 'paymentDate', width: '160px', minWidth: '130px', format: 'date', align: 'center' },
  paymentValue: { header: 'Giá trị TT', field: 'paymentValue', width: '160px', minWidth: '130px', format: 'currency', align: 'right' },
};

export const categoryProjectColumns = [
  commonFields.name,
  commonFields.projectCode,
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
  commonFields.projectCode,
  commonFields.allocatedUnit,
  commonFields.location,
  commonFields.scale,
  commonFields.reportDate,
  commonFields.supervisor,
  commonFields.inspectionDate,
  commonFields.paymentDate,
  commonFields.paymentValue,
  commonFields.leadershipApproval,
  commonFields.notes,
  commonFields.status,
  commonFields.approvedBy,
  commonFields.createdBy,
];
