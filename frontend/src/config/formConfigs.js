// d:\CODE\water-company\frontend\src\config\formConfigs.js
export const categoryFormConfig = {
  addTitle: 'Thêm mới Công trình Danh mục',
  editTitle: 'Chỉnh sửa Công trình Danh mục',
  tabs: [
    {
      name: 'basic',
      label: 'Thông tin Cơ bản',
      fields: [
        { name: 'name', label: 'Tên danh mục công trình', type: 'textarea', rows: 2, required: true, placeholder: 'Nhập tên công trình', fullWidth: true },
        { name: 'projectCode', label: 'Mã công trình', type: 'text', placeholder: 'Sẽ được tạo tự động', disabled: true }, // Thêm trường projectCode, admin có thể sửa khi edit
        { name: 'financialYear', label: 'Năm tài chính', type: 'text', numeric: true, required: true, placeholder: 'VD: 2024' },
        { name: 'scale', label: 'Quy mô', type: 'textarea', rows: 2, required: true, placeholder: 'VD: Tuyến ống D100, Nâng cấp TBA...', fullWidth: true },
        { name: 'location', label: 'Địa điểm Xây dựng', type: 'text', required: true, placeholder: 'Nhập địa điểm cụ thể' },
        { name: 'allocatedUnit', label: 'Đơn vị phân bổ', type: 'select', required: true, optionsSource: 'allocatedUnits' },
        { name: 'projectType', label: 'Loại công trình', type: 'select', required: true, optionsSource: 'projectTypes' },
        { name: 'approvedBy', label: 'Người phê duyệt', type: 'select', required: true, optionsSource: 'approvers' },
      ],
    },
    {
      name: 'assignment',
      label: 'Phân công & Tiến độ',
      fields: [
        { name: 'allocationWave', label: 'Phân bổ theo đợt', type: 'select', optionsSource: 'allocationWaves' },
        { name: 'estimator', label: 'Người lập hồ sơ dự toán', type: 'select', optionsSource: 'users' },
        { name: 'supervisor', label: 'Cán bộ theo dõi', type: 'select', optionsSource: 'users' },
        { name: 'durationDays', label: 'Số ngày thực hiện (dự kiến)', type: 'text', numeric: true, placeholder: 'Chỉ nhập số' },
        { name: 'startDate', label: 'Ngày bắt đầu lập HS dự toán', type: 'date' },
        { name: 'completionDate', label: 'Ngày hoàn thành HS dự toán', type: 'date' },
        { name: 'leadershipApproval', label: 'Bút phê của Lãnh đạo', type: 'textarea', rows: 2, fullWidth: true, placeholder: 'Nội dung bút phê (nếu có)' },
      ],
    },
    {
      name: 'progressUpdate',
      label: 'Cập nhật Giá trị & Thi công',
      fields: [
        { name: 'initialValue', label: 'Giá trị phân bổ (Triệu đồng)', type: 'text', numeric: true, placeholder: 'Chỉ nhập số, VD: 150.5' },
        { name: 'estimatedValue', label: 'Giá trị dự toán (Triệu đồng)', type: 'text', numeric: true, placeholder: 'Chỉ nhập số' },
        { name: 'contractValue', label: 'Giá trị giao khoán (Triệu đồng)', type: 'text', numeric: true, placeholder: 'Chỉ nhập số' },
        { name: 'constructionUnit', label: 'Đơn vị thi công', type: 'select', optionsSource: 'constructionUnits' }, // Sửa optionsSource
        { name: 'progress', label: 'Tiến độ thi công', type: 'text', placeholder: 'VD: Hoàn thành 50%, Đang mời thầu...' },
        { name: 'feasibility', label: 'Khả năng thực hiện', type: 'text', placeholder: 'VD: Tốt, Cần xem xét thêm...' },
        { name: 'notes', label: 'Ghi chú chung', type: 'textarea', rows: 3, fullWidth: true, placeholder: 'Các thông tin khác cần lưu ý' },
      ],
    },
  ],
};

const initialMinorRepairFormConfig = { // Đổi tên biến tạm thời
  addTitle: 'Thêm mới Công trình Sửa chữa nhỏ',
  editTitle: 'Chỉnh sửa Công trình Sửa chữa nhỏ',
  tabs: [
    {
      name: 'basic',
      label: 'Thông tin Cơ bản',
      fields: [
        { name: 'name', label: 'Tên công trình/Sự cố', type: 'textarea', rows: 2, required: true, placeholder: 'Nhập tên hoặc mô tả sự cố', fullWidth: true },
        { name: 'projectCode', label: 'Mã công trình', type: 'text', placeholder: 'Sẽ được tạo tự động', disabled: true }, // Thêm trường projectCode
        { name: 'financialYear', label: 'Năm tài chính', type: 'text', numeric: true, required: true, placeholder: 'VD: 2024' },
        { name: 'scale', label: 'Quy mô/Hiện trạng', type: 'textarea', rows: 2, required: true, placeholder: 'Mô tả quy mô hoặc hiện trạng sự cố', fullWidth: true },
        { name: 'location', label: 'Địa điểm xảy ra sự cố', type: 'text', required: true, placeholder: 'Nhập địa điểm cụ thể' },
        { name: 'allocatedUnit', label: 'Đơn vị quản lý/phân bổ', type: 'select', required: true, optionsSource: 'allocatedUnits' },
        { name: 'reportDate', label: 'Ngày nhận thông tin/xảy ra sự cố', type: 'date', required: true },
        { name: 'approvedBy', label: 'Người phê duyệt', type: 'select', required: true, optionsSource: 'approvers' },
      ],
      // Thêm createdBy vào tab basic hoặc một tab khác nếu cần cho MinorRepair
    },
    {
      name: 'assignment',
      label: 'Phân công & Chỉ đạo',
      fields: [
        { name: 'supervisor', label: 'Cán bộ theo dõi/xử lý', type: 'select', optionsSource: 'users' },
        { name: 'leadershipApproval', label: 'Bút phê/Chỉ đạo của Lãnh đạo', type: 'textarea', rows: 3, fullWidth: true, placeholder: 'Nội dung bút phê hoặc chỉ đạo (nếu có)' },
      ],
    },
    {
      name: 'progressUpdate',
      label: 'Cập nhật Thực hiện & Thanh toán',
      fields: [
        { name: 'inspectionDate', label: 'Ngày kiểm tra/khảo sát', type: 'date' },
        { name: 'paymentDate', label: 'Ngày thanh toán chi phí', type: 'date' },
        { name: 'paymentValue', label: 'Giá trị thanh toán (VNĐ)', type: 'text', numeric: true, placeholder: 'Chỉ nhập số, VD: 1500000' },
        { name: 'notes', label: 'Ghi chú chung', type: 'textarea', rows: 3, fullWidth: true, placeholder: 'Các thông tin khác cần lưu ý về quá trình xử lý, thanh toán' },
      ],
    },
  ],
};

// Thêm trường createdBy vào tab 'basic' sau khi initialMinorRepairFormConfig đã được định nghĩa
const updatedMinorRepairTabs = initialMinorRepairFormConfig.tabs.map(tab => {
    if (tab.name === 'basic') {
      // Không thêm createdBy ở đây nữa vì đã xóa khỏi form
      return { ...tab };
    }
    return tab;
});

export const minorRepairFormConfig = {
  ...initialMinorRepairFormConfig,
  tabs: updatedMinorRepairTabs,
};
