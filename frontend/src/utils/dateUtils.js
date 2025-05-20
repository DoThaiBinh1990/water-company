// d:\CODE\water-company\frontend\src\utils\dateUtils.js

/**
 * Calculates the end date based on a start date, duration in days,
 * and an array of holiday date strings (YYYY-MM-DD).
 * Weekends (Saturday, Sunday) are also excluded.
 * @param {Date|string} startDate - The start date.
 * @param {number} durationDays - The duration in days.
 * @param {string[]} holidays - Array of holiday date strings in 'YYYY-MM-DD' format.
 * @returns {Date|null} The calculated end date, or null if inputs are invalid.
 */
export const calculateEndDateClientSide = (startDate, durationDays, holidays = []) => {
  if (!startDate || !durationDays || durationDays <= 0) {
    return null;
  }

  let currentDate = new Date(startDate);
  if (isNaN(currentDate.getTime())) return null; // Invalid start date

  let daysAdded = 0;

  while (daysAdded < durationDays) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateString = currentDate.toISOString().split('T')[0];

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateString)) {
      daysAdded++;
    }
    if (daysAdded < durationDays) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  return currentDate;
};

/**
 * Formats a date string or Date object into 'DD/MM/YYYY' format for Vietnamese locale.
 * Handles YYYY-MM-DD strings specifically if new Date() fails.
 * @param {Date|string} dateString - The date to format.
 * @returns {string} The formatted date string or 'N/A' if invalid or input is falsy.
 */
export const formatDateToLocale = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      // Nếu new Date() không parse được, thử kiểm tra xem có phải dạng 'YYYY-MM-DD' không
      if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
      }
      // Nếu không phải dạng YYYY-MM-DD và cũng không parse được, trả về 'N/A'
      return 'N/A'; // Hoặc trả về dateString gốc nếu muốn: return String(dateString);
    }
    return date.toLocaleDateString('vi-VN');
  } catch (error) {
    return 'N/A'; // Hoặc trả về dateString gốc: return String(dateString);
  }
};