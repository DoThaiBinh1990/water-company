import { FaCheckCircle, FaClock, FaEdit, FaExclamationTriangle, FaHourglassHalf, FaTimesCircle, FaTrash, FaWrench, FaUser } from 'react-icons/fa'; // Đảm bảo các icons này được dùng trong file này hoặc các hàm nó export
import React from 'react'; // Import React để sử dụng JSX trong icon

export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  // Sử dụng toLocaleString để định dạng số và thêm " Tr.đ"
  return `${Number(value).toLocaleString('vi-VN')} Tr.đ`;
};

export const getNestedProperty = (obj, path) => {
  if (!path || !obj) return undefined;
  const properties = path.split('.');
  return properties.reduce((acc, prop) => (acc && acc[prop] !== undefined ? acc[prop] : undefined), obj);
};

// Hàm mới để lấy thông tin hiển thị cơ bản cho một chuỗi trạng thái
export const getBaseStatusInfo = (statusString) => {
  let text = statusString, color = 'text-gray-700 bg-gray-100', icon = <FaExclamationTriangle size={12} className="mr-1" />;
  switch (String(statusString).toLowerCase()) { // Chuyển sang lowercase để so sánh dễ hơn
    case 'đã duyệt': text = 'Đã duyệt'; icon = <FaCheckCircle size={12} className="mr-1" />; color = 'text-green-700 bg-green-100'; break;
    case 'chờ duyệt': text = 'Chờ duyệt'; icon = <FaClock size={12} className="mr-1" />; color = 'text-yellow-600 bg-yellow-100'; break;
    case 'đã phân bổ': case 'allocated': text = 'Đã phân bổ'; icon = <FaWrench size={12} className="mr-1" />; color = 'text-purple-700 bg-purple-100'; break;
    case 'đang thực hiện': text = 'Đang thực hiện'; icon = <FaWrench size={12} className="mr-1" />; color = 'text-indigo-700 bg-indigo-100'; break;
    case 'hoàn thành': text = 'Hoàn thành'; icon = <FaCheckCircle size={12} className="mr-1 text-teal-500" />; color = 'text-teal-700 bg-teal-100'; break;
    case 'đã từ chối': text = 'Đã từ chối'; icon = <FaTimesCircle size={12} className="mr-1" />; color = 'text-red-500 bg-red-100'; break;
    default: text = statusString || 'Không rõ';
  }
  return { text, colorClass: color, icon };
};

export const getStatusDisplay = (project, isPendingTab) => {
  let statusText = project.status;
  let statusColorClass = 'text-gray-700 bg-gray-100'; // Default
  let statusIcon = <FaExclamationTriangle className="mr-1.5" />; // Default icon

  if (isPendingTab) {
    if (project.pendingEdit) {
      statusText = 'Chờ duyệt sửa';
      statusIcon = <FaEdit className="mr-1.5" />;
      statusColorClass = 'text-yellow-700 bg-yellow-100';
    } else if (project.pendingDelete) {
      statusText = 'Chờ duyệt xóa';
      statusIcon = <FaTrash className="mr-1.5" />;
      statusColorClass = 'text-red-700 bg-red-100';
    } else if (project.status === 'Chờ duyệt') { // Yêu cầu tạo mới đang chờ duyệt
      statusText = 'Chờ duyệt mới';
      statusIcon = <FaHourglassHalf className="mr-1.5" />;
      statusColorClass = 'text-blue-700 bg-blue-100';
    }
  } else { // Tab Projects
     if (project.pendingEdit) {
      statusText = 'Đang YC sửa';
      statusIcon = <FaEdit className="mr-1.5" />;
      statusColorClass = 'text-yellow-700 bg-yellow-100';
    } else if (project.pendingDelete) {
      statusText = 'Đang YC xóa';
      statusIcon = <FaTrash className="mr-1.5" />;
      statusColorClass = 'text-red-700 bg-red-100';
    } else if (project.status === 'Đã duyệt') {
      statusText = 'Đã duyệt';
      statusIcon = <FaCheckCircle className="mr-1.5" />;
      statusColorClass = 'text-green-700 bg-green-100';
    } else if (project.status === 'Chờ duyệt') {
       statusText = 'Chờ duyệt'; // Trạng thái chờ duyệt trên tab Projects
       statusIcon = <FaClock className="mr-1.5" />;
       statusColorClass = 'text-yellow-600 bg-yellow-100';
    } else if (project.status === 'allocated') {
       statusText = 'Đã phân bổ';
       statusIcon = <FaWrench className="mr-1.5" />; // Sử dụng icon khác cho trạng thái phân bổ
       statusColorClass = 'text-purple-700 bg-purple-100';
    } else if (project.status === 'Đã từ chối') {
       statusText = 'Đã từ chối';
       statusIcon = <FaTimesCircle className="mr-1.5" />;
       statusColorClass = 'text-red-500 bg-red-100';
    }
    // Thêm các trạng thái khác nếu có
  }

  return {
    text: <span className="flex items-center justify-center">{statusIcon}{statusText}</span>, // Kết hợp icon và text
    colorClass: statusColorClass,
    // icon: statusIcon, // Không cần trả về icon riêng nữa nếu đã kết hợp vào text
  };
};
