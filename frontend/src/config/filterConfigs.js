// d:\CODE\water-company\frontend\src\config\filterConfigs.js
const currentYear = new Date().getFullYear();
const financialYearOptions = Array.from({ length: 10 }, (_, i) => ({
  value: currentYear - 5 + i,
  label: (currentYear - 5 + i).toString(),
}));

export const categoryFilterConfig = [
  { name: 'financialYear', label: 'Năm tài chính', type: 'select', options: financialYearOptions },
  { name: 'isCompleted', label: 'Trạng thái HT', type: 'select', options: [
      { value: 'false', label: 'Chưa hoàn thành' },
      { value: 'true', label: 'Đã hoàn thành' },
  ]},
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
  { name: 'financialYear', label: 'Năm tài chính', type: 'select', options: financialYearOptions },
  { name: 'isCompleted', label: 'Trạng thái HT', type: 'select', options: [
    { value: 'false', label: 'Chưa hoàn thành' },
    { value: 'true', label: 'Đã hoàn thành' },
  ]},
  { name: 'name', label: 'Tên công trình', type: 'search', placeholder: 'Nhập tên công trình...' },
  { name: 'allocatedUnit', label: 'Đơn vị phân bổ', type: 'select', optionsSource: 'allocatedUnits' },
  { name: 'supervisor', label: 'Người theo dõi', type: 'select', optionsSource: 'usersList' },
  { name: 'reportDate', label: 'Ngày xảy ra sự cố', type: 'date' },
  // { name: 'assignedTo', label: 'Người phụ trách', type: 'select', optionsSource: 'usersList' }, // Bỏ trường này
];

export const rejectedProjectFilterConfig = [
  { name: 'financialYear', label: 'Năm tài chính (YC)', type: 'select', options: financialYearOptions },
  // Không cần isCompleted cho rejected projects
  { name: 'name', label: 'Tên công trình', type: 'search', placeholder: 'Nhập tên công trình...' },
  { name: 'allocatedUnit', label: 'Đơn vị phân bổ', type: 'select', optionsSource: 'allocatedUnits' },
  {
    name: 'requestedBy',
    label: 'Người YC/Tạo',
    type: 'select',
    optionsSource: 'usersList', // Sử dụng danh sách người dùng
    placeholder: 'Chọn người yêu cầu/tạo',
  },
  {
    name: 'rejectedBy',
    label: 'Người từ chối',
    type: 'select',
    optionsSource: 'usersList', // Sử dụng danh sách người dùng
    placeholder: 'Chọn người từ chối',
  },
];
