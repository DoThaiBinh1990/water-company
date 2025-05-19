// src/utils/projectUtils.js

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    // Check if dateString is already in YYYY-MM-DD format from <input type="date">
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return 'N/A';
  }
};

export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `${Number(value).toLocaleString('vi-VN')} Tr.đ`;
};

export const getNestedProperty = (obj, path) => {
  if (!path) return obj;
  const properties = path.split('.');
  return properties.reduce((acc, prop) => (acc && acc[prop] !== undefined && acc[prop] !== null ? acc[prop] : undefined), obj);
};

export const getStatusBadgeInfo = (status) => {
    switch (status) {
      case 'Chờ duyệt':
        return { className: 'status-badge-yellow', icon: '🟡', text: 'Chờ duyệt' };
      case 'Đã duyệt':
        return { className: 'status-badge-green', icon: '🟢', text: 'Đã duyệt' };
      default:
        return { className: 'status-badge-gray', icon: '⚪', text: status || 'Không xác định' };
    }
  };