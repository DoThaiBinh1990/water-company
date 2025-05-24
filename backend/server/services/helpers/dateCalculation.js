// d:\CODE\water-company\backend\server\services\helpers\dateCalculation.js
// const { Holiday } = require('../../models'); // REMOVE THIS

/**
 * Calculates the end date based on a start date, duration in days,
 * and an array of holiday date strings (YYYY-MM-DD).
 * Weekends (Saturday, Sunday) are also excluded if excludeHolidays is true.
 * @param {Date} startDate - The start date (Date object).
 * @param {number} durationDays - The duration in days.
 * @param {boolean} excludeHolidaysFlag - Whether to exclude weekends and holidays.
 * @param {string[]} holidaysList - Array of holiday date strings in 'YYYY-MM-DD' format.
 * @returns {Date|null} The calculated end date, or null if inputs are invalid.
 */
const calculateEndDate = (startDate, durationDays, excludeHolidaysFlag, holidaysList = []) => { // Renamed excludeHolidays to avoid conflict with holidaysList
  if (!startDate || !durationDays || durationDays <= 0) {
    return startDate; // Or null, or throw error
  }
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  // holidaysList is now passed directly

  while (daysAdded < durationDays) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateString = currentDate.toISOString().split('T')[0];

    if (excludeHolidaysFlag && (dayOfWeek === 0 || dayOfWeek === 6 || holidaysList.includes(dateString))) {
      // It's a weekend or holiday, skip
    } else {
      daysAdded++;
    }
    if (daysAdded < durationDays) { // Only add day if we haven't reached duration
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  return currentDate;
};

/**
 * Calculates the number of working days between two dates,
 * excluding weekends and holidays if excludeHolidays is true.
 * @param {Date} startDate - The start date (Date object).
 * @param {Date} endDate - The end date (Date object).
 * @param {boolean} excludeHolidaysFlag - Whether to exclude weekends and holidays.
 * @param {string[]} holidaysList - Array of holiday date strings in 'YYYY-MM-DD' format.
 * @returns {number|null} The number of working days, or null if inputs are invalid.
 */
const calculateDurationDays = (startDate, endDate, excludeHolidaysFlag, holidaysList = []) => {
  if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
    return null; // Invalid dates
  }
  let currentDate = new Date(startDate);
  let count = 0;
  // holidaysList is now passed directly

  while (currentDate <= new Date(endDate)) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateString = currentDate.toISOString().split('T')[0];

    if (excludeHolidaysFlag && (dayOfWeek === 0 || dayOfWeek === 6 || holidaysList.includes(dateString))) {
      // Skip weekends and holidays
    } else {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return count;
};

module.exports = {
    calculateEndDate,
    calculateDurationDays,
};