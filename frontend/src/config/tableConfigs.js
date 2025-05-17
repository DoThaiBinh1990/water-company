import { FaUser, FaCalendarAlt, FaWrench } from 'react-icons/fa';
import { formatDate, formatCurrency, getStatusDisplay } from '../utils/helpers';
import React from 'react'; // Import React để sử dụng JSX trong render functions

const commonFields = {
  name: {
    header: 'Tên công trình',
    field: 'name',
    width: '250px',
    minWidth: '200px',
    sticky: true,
    left: '50px',
    headerClassName: 'sticky-col-2-header',
    className: 'sticky-col-2-data align-left',
    tooltipRender: (project) => `Tên: ${project.name}\nLoại: ${project.projectType || 'N/A'}`
  },
  allocatedUnit: { header: 'Đơn vị PB', field: 'allocatedUnit', width: '150px', minWidth: '120px', className: 'align-left' },
  location: { header: 'Địa điểm', field: 'location', width: '200px', minWidth: '150px', className: 'align-left' },
  scale: { header: 'Quy mô', field: 'scale', width: '180px', minWidth: '150px', className: 'align-left' },
  supervisor: {
    header: 'Người theo dõi',
    field: 'supervisor', // Backend nên trả về object user đã populate (với fullName) hoặc string ID
    width: '150px',
    minWidth: '120px',
    render: (project) => {
      const supervisor = project.supervisor;
      if (supervisor) {
        if (typeof supervisor === 'object' && (supervisor.fullName || supervisor.username)) {
          return supervisor.fullName || supervisor.username; // Ưu tiên fullName
        } else if (typeof supervisor === 'string') {
          // Nếu là string, có thể là ID hoặc tên chưa được populate đầy đủ.
          // Trong trường hợp này, hiển thị string đó.
          // Nếu bạn muốn tra cứu tên từ ID ở client, bạn cần có danh sách users ở client.
          return supervisor;
        }
      }
      return 'N/A';
    }
  },
  leadershipApproval: { header: 'Bút phê LĐ', field: 'leadershipApproval', width: '200px', minWidth: '150px', className: 'align-left' },
  notes: { header: 'Ghi chú', field: 'notes', width: '250px', minWidth: '200px', className: 'align-left' },
  status: {
    header: 'Trạng thái',
    field: 'status', // Field này sẽ được cellData.displayValue và cellData.originalValue sử dụng
    width: '180px',
    minWidth: '150px',
    align: 'center',
    render: (project, cellData, isPendingTab) => {
      // Sử dụng cellData.displayValue (giá trị mới) để lấy thông tin hiển thị status
      const statusInfo = getStatusDisplay(project, isPendingTab, cellData.displayValue);
      const assignedTo = project.assignedTo; // Giả sử assignedTo cũng được populate với fullName nếu là object
      let assignedToDisplay = 'N/A';
      if (assignedTo) {
        if (typeof assignedTo === 'object' && (assignedTo.fullName || assignedTo.username)) {
          assignedToDisplay = assignedTo.fullName || assignedTo.username;
        } else if (typeof assignedTo === 'string') {
          assignedToDisplay = assignedTo;
        }
      }

      let originalStatusDisplay = null;
      if (cellData.isChanged && cellData.originalValue !== null && cellData.originalValue !== undefined) {
        // Tạo một project tạm để lấy thông tin hiển thị cho status cũ
        // Hoặc bạn có thể có một hàm helper đơn giản hơn để chỉ lấy text của status cũ
        // Giả sử getStatusDisplay có thể xử lý project object không đầy đủ chỉ với status
        const oldStatusInfo = getStatusDisplay({ status: cellData.originalValue }, false, cellData.originalValue);
        originalStatusDisplay = oldStatusInfo.text; // Giả sử getStatusDisplay trả về text đã có icon
      }

      return (
        <div> {/* Bọc trong div để các span có thể là block */}
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.colorClass} ${cellData.isChanged ? 'cell-changed-value' : ''}`}>
            {statusInfo.text} {/* Hiển thị giá trị mới */}
            {assignedTo && !isPendingTab && ( // Chỉ hiển thị assignedTo ở tab projects
              <span className="ml-2 flex items-center text-purple-600" title={`Phụ trách: ${assignedToDisplay}`}>
                <FaUser size={12} className="mr-0.5" />
                {/* Đảm bảo assignedToDisplay là string trước khi split */}
                {typeof assignedToDisplay === 'string' ? assignedToDisplay.split(' ')[0] : 'N/A'}
              </span>
            )}
          </span>
          {cellData.isChanged && originalStatusDisplay && (
            <span className="cell-changed-original-value block text-xs text-gray-500 mt-0.5 italic">
              (Cũ: {originalStatusDisplay})
            </span>
          )}
        </div>
      );
    }
  },
  approvedBy: {
    header: 'Người duyệt',
    field: 'approvedBy', // Backend nên trả về object user đã populate (với fullName)
    width: '150px',
    minWidth: '120px',
    align: 'center',
    render: (project) => {
      const approvedBy = project.approvedBy;
      if (approvedBy) {
        if (typeof approvedBy === 'object' && (approvedBy.fullName || approvedBy.username)) {
          return approvedBy.fullName || approvedBy.username; // Ưu tiên fullName
        } else if (typeof approvedBy === 'string') {
          return approvedBy;
        }
      }
      return 'N/A';
    }
  },
  createdBy: {
    header: 'Người tạo/YC',
    field: 'createdBy', // Backend nên trả về object user đã populate (với fullName)
    width: '150px',
    minWidth: '120px',
    align: 'center',
    tooltipRender: (project) => {
      let tooltipLines = [];
      const creatorData = project.createdBy;
      const creatorName = (creatorData && typeof creatorData === 'object' && (creatorData.fullName || creatorData.username))
                            ? (creatorData.fullName || creatorData.username)
                            : (typeof creatorData === 'string' ? creatorData : (project.enteredBy || 'N/A'));
      tooltipLines.push(`Người tạo: ${creatorName}`);
      if (project.createdAt) {
        tooltipLines.push(`Ngày tạo: ${formatDate(project.createdAt)}`);
      }
      if (project.pendingEdit && project.status === 'Đã duyệt' && project.pendingEdit.requestedBy) {
        let editorName = 'Không rõ';
        const requestedByData = project.pendingEdit.requestedBy; // Đây là object user đã populate từ backend
        if (requestedByData) {
            if (typeof requestedByData === 'object' && (requestedByData.fullName || requestedByData.username)) {
                editorName = requestedByData.fullName || requestedByData.username;
            } else if (typeof requestedByData === 'string') { // Fallback nếu chỉ là string ID/username
                editorName = requestedByData;
            } else if (typeof requestedByData === 'object' && (requestedByData._id || requestedByData.id) && !requestedByData.username && !requestedByData.fullName) {
                editorName = `User (ID: ...${String(requestedByData._id || requestedByData.id).slice(-4)})`;
            }
        }
        const editTime = project.pendingEdit.requestedAt ? formatDate(project.pendingEdit.requestedAt) : 'N/A';
        tooltipLines.push(`---`);
        tooltipLines.push(`YC sửa gần nhất:`);
        tooltipLines.push(`  Bởi: ${editorName}`);
        tooltipLines.push(`  Lúc: ${editTime}`);
      }
      return tooltipLines.join('\n');
    },
    render: (project) => {
        const creatorData = project.createdBy;
        const creator = (creatorData && typeof creatorData === 'object' && (creatorData.fullName || creatorData.username))
                        ? (creatorData.fullName || creatorData.username)
                        : (typeof creatorData === 'string' ? creatorData : (project.enteredBy || 'N/A'));

        if (project.pendingEdit && project.status === 'Đã duyệt' && project.pendingEdit.requestedBy) {
            let editorDisplay = 'Không rõ';
            const requestedByData = project.pendingEdit.requestedBy; // Đây là object user đã populate từ backend
            if (requestedByData) {
              if (typeof requestedByData === 'object' && (requestedByData.fullName || requestedByData.username)) {
                editorDisplay = requestedByData.fullName || requestedByData.username;
              } else if (typeof requestedByData === 'string') {
                editorDisplay = requestedByData;
              } else if (typeof requestedByData === 'object' && (requestedByData._id || requestedByData.id) && !requestedByData.username && !requestedByData.fullName) {
                editorDisplay = `User (ID: ...${String(requestedByData._id || requestedByData.id).slice(-4)})`;
              }
            }
            const finalEditorDisplay = typeof editorDisplay === 'string' ? editorDisplay : 'Không rõ';
            return <span title={`Tạo bởi: ${creator}\nYC sửa bởi: ${finalEditorDisplay}`}>{finalEditorDisplay} (YC sửa)</span>;
        }
        return creator;
    }
  },
  projectType: { header: 'Loại CT', field: 'projectType', width: '150px', minWidth: '120px', className: 'align-left' },
  estimator: {
    header: 'Người lập DT',
    field: 'estimator', // Backend nên trả về object user đã populate (với fullName)
    width: '150px',
    minWidth: '120px',
    render: (project) => {
      const estimator = project.estimator;
      if (estimator) {
        if (typeof estimator === 'object' && (estimator.fullName || estimator.username)) {
          return estimator.fullName || estimator.username; // Ưu tiên fullName
        } else if (typeof estimator === 'string') {
          return estimator;
        }
      }
      return 'N/A';
    }
  },
  startDate: { header: 'Ngày BĐ', field: 'startDate', width: '120px', minWidth: '100px', format: 'date', align: 'center' },
  completionDate: { header: 'Ngày HT', field: 'completionDate', width: '120px', minWidth: '100px', format: 'date', align: 'center' },
  initialValue: { header: 'Giá trị PB', field: 'initialValue', width: '150px', minWidth: '120px', format: 'currency', align: 'right' },
  estimatedValue: { header: 'Giá trị DT', field: 'estimatedValue', width: '150px', minWidth: '120px', format: 'currency', align: 'right' },
  contractValue: { header: 'Giá trị GK', field: 'contractValue', width: '150px', minWidth: '120px', format: 'currency', align: 'right' },
  constructionUnit: { header: 'Đơn vị TC', field: 'constructionUnit', width: '150px', minWidth: '120px', className: 'align-left' },
  progress: { header: 'Tiến độ TC', field: 'progress', width: '150px', minWidth: '120px', className: 'align-left' },
  feasibility: { header: 'Khả năng TH', field: 'feasibility', width: '150px', minWidth: '120px', className: 'align-left' },
  durationDays: { header: 'Số ngày TH', field: 'durationDays', width: '120px', minWidth: '100px', align: 'right' },
  allocationWave: { header: 'Phân bổ đợt', field: 'allocationWave', width: '150px', minWidth: '120px', className: 'align-left' },
  reportDate: { header: 'Ngày xảy ra SC', field: 'reportDate', width: '150px', minWidth: '120px', format: 'date', align: 'center' },
  inspectionDate: { header: 'Ngày kiểm tra', field: 'inspectionDate', width: '150px', minWidth: '120px', format: 'date', align: 'center' },
  paymentDate: { header: 'Ngày thanh toán', field: 'paymentDate', width: '150px', minWidth: '120px', format: 'date', align: 'center' },
  paymentValue: { header: 'Giá trị TT', field: 'paymentValue', width: '150px', minWidth: '120px', format: 'currency', align: 'right' },
};

export const categoryProjectColumns = [
  commonFields.name,
  commonFields.allocatedUnit,
  commonFields.projectType,
  commonFields.scale,
  commonFields.location,
  commonFields.estimator,
  commonFields.supervisor,
  commonFields.startDate,
  commonFields.completionDate,
  commonFields.initialValue,
  commonFields.estimatedValue,
  commonFields.contractValue,
  commonFields.constructionUnit,
  commonFields.progress,
  commonFields.feasibility,
  commonFields.durationDays,
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
