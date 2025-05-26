// d:\CODE\water-company\frontend\src\utils\dateUtils.js

/**
 * Calculates the end date based on a start date, duration in days,
 * and an array of holiday date strings (YYYY-MM-DD).
 * Weekends (Saturday, Sunday) are also excluded.
 * @param {Date|string} startDate - The start date.
 * @param {number} durationDays - The duration in days.
 * @param {string[]} holidays - Array of holiday date strings in 'YYYY-MM-DD' format.
 * @param {boolean} excludeCriteria - Whether to exclude weekends and holidays.
 * @returns {Date|null} The calculated end date, or null if inputs are invalid.
 */
export const calculateEndDateClientSide = (startDateInput, durationDays, excludeCriteria, holidaysList = []) => {
  if (!startDateInput || !durationDays || durationDays <= 0) {
    return null;
  }

  // startDateInput là string 'YYYY-MM-DD'
  // Chuyển startDateInput thành Date object UTC để tính toán
  const parts = startDateInput.split('-').map(part => parseInt(part, 10));
  let currentDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

  if (isNaN(currentDate.getTime())) return null; // Invalid start date

  let workingDaysCount = 0;
  let iterationCount = 0; // Safety counter

  while (workingDaysCount < durationDays) {
    if (iterationCount > 0) { // Chỉ tăng ngày cho các ngày tiếp theo, không phải ngày đầu tiên của vòng lặp
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    let isWorkingDay = true;
    if (excludeCriteria) {
      const dayOfWeek = currentDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
      // Lấy YYYY-MM-DD từ currentDate (đang là UTC)
      const dateString = currentDate.toISOString().split('T')[0];

      if (dayOfWeek === 0 || dayOfWeek === 6 || holidaysList.includes(dateString)) {
        isWorkingDay = false;
      }
    }

    if (isWorkingDay) {
      workingDaysCount++;
    }
    
    iterationCount++;
    // Safety break
    if (iterationCount > durationDays * 7 + 30 && durationDays > 5) { // Cho phép tối đa 7 ngày/tuần + 1 tháng nghỉ
        console.warn("calculateEndDateClientSide: Safety break triggered. Check duration/holidays.");
        return null;
    }
    if (iterationCount > 1000 && durationDays <=5) { // Safety break cho duration ngắn
        console.warn("calculateEndDateClientSide: Safety break for short duration triggered.");
        return null;
    }
  }
  return currentDate; // Trả về Date object (UTC)
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

/**
 * Helper function to compare dates (handles strings YYYY-MM-DD and Date objects).
 * Compares only the date part, ignoring time.
 * @param {Date|string|null|undefined} date1 - The first date.
 * @param {Date|string|null|undefined} date2 - The second date.
 * @returns {boolean} True if the dates are the same day, false otherwise.
 */
export const areDatesEqualClientSide = (date1, date2) => {
  if (date1 === null && date2 === null) return true;
  if (date1 === undefined && date2 === undefined) return true;
  if (!date1 || !date2) return false; // If one is null/undefined and other is not

  const normalizeDate = (d) => {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().split('T')[0];
    if (typeof d === 'string') {
      const parsed = new Date(d); // Handles full ISO strings or YYYY-MM-DD
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    }
    return String(d).split('T')[0]; // Fallback for YYYY-MM-DD string
  };
  return normalizeDate(date1) === normalizeDate(date2);
};