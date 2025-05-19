// d:\CODE\water-company\frontend\src\config\filterConfigs.js
export const categoryFilterConfig = [
  { name: 'name', label: 'Tên công trình', type: 'search', placeholder: 'Nhập tên công trình...' },
  { name: 'allocatedUnit', label: 'Đơn vị phân bổ', type: 'select', optionsSource: 'allocatedUnits' },
  { name: 'constructionUnit', label: 'Đơn vị thi công', type: 'select', optionsSource: 'constructionUnitsList' },
  { name: 'allocationWave', label: 'Đợt phân bổ', type: 'select', optionsSource: 'allocationWavesList' },
  { name: 'supervisor', label: 'Người theo dõi', type: 'select', optionsSource: 'usersList' },
  { name: 'estimator', label: 'Người lập dự toán', type: 'select', optionsSource: 'usersList' },
  { name: 'projectType', label: 'Loại công trình', type: 'select', optionsSource: 'projectTypesList' }, // Thay thế assignedTo
  // { name: 'status', label: 'Trạng thái', type: 'select', options: [{value: 'Đã duyệt', label: 'Đã duyệt'}, ...] },
  // { name: 'minInitialValue', label: 'GT Phân bổ (Từ)', type: 'text', numeric: true },
  // { name: 'maxInitialValue', label: 'GT Phân bổ (Đến)', type: 'text', numeric: true },
];

export const minorRepairFilterConfig = [
  { name: 'name', label: 'Tên công trình', type: 'search', placeholder: 'Nhập tên công trình...' },
  { name: 'allocatedUnit', label: 'Đơn vị phân bổ', type: 'select', optionsSource: 'allocatedUnits' },
  { name: 'supervisor', label: 'Người theo dõi', type: 'select', optionsSource: 'usersList' },
  { name: 'reportDate', label: 'Ngày xảy ra sự cố', type: 'date' },
  // { name: 'assignedTo', label: 'Người phụ trách', type: 'select', optionsSource: 'usersList' }, // Bỏ trường này
];

export const rejectedProjectFilterConfig = [
  { name: 'name', label: 'Tên công trình', type: 'search', placeholder: 'Nhập tên công trình...' },
  { name: 'allocatedUnit', label: 'Đơn vị phân bổ', type: 'select', optionsSource: 'allocatedUnits' },
  { name: 'rejectionReason', label: 'Lý do từ chối', type: 'search', placeholder: 'Nhập lý do từ chối...' },
];
