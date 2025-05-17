export const categoryFilterConfig = [
  { name: 'name', label: 'Tên công trình', type: 'search', placeholder: 'Nhập tên công trình...' },
  { name: 'allocatedUnit', label: 'Đơn vị phân bổ', type: 'select', optionsSource: 'allocatedUnits' },
  { name: 'constructionUnit', label: 'Đơn vị thi công', type: 'select', optionsSource: 'constructionUnitsList' },
  { name: 'allocationWave', label: 'Đợt phân bổ', type: 'select', optionsSource: 'allocationWavesList' },
  { name: 'supervisor', label: 'Người theo dõi', type: 'select', optionsSource: 'usersList' },
  { name: 'estimator', label: 'Người lập dự toán', type: 'select', optionsSource: 'usersList' },
  // Có thể thêm các filter khác nếu cần, ví dụ:
  // { name: 'status', label: 'Trạng thái', type: 'select', options: [{value: 'Đã duyệt', label: 'Đã duyệt'}, ...] },
  // { name: 'minInitialValue', label: 'GT Phân bổ (Từ)', type: 'text', numeric: true },
  // { name: 'maxInitialValue', label: 'GT Phân bổ (Đến)', type: 'text', numeric: true },
];

export const minorRepairFilterConfig = [
  { name: 'name', label: 'Tên công trình', type: 'search', placeholder: 'Nhập tên công trình...' },
  { name: 'allocatedUnit', label: 'Đơn vị phân bổ', type: 'select', optionsSource: 'allocatedUnits' },
  { name: 'supervisor', label: 'Người theo dõi', type: 'select', optionsSource: 'usersList' },
  { name: 'reportDate', label: 'Ngày xảy ra sự cố', type: 'date' },
  // Có thể thêm các filter khác nếu cần
];
