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