// d:\CODE\water-company\backend\server\services\helpers\dateCalculation.js
const { Holiday } = require('../../models'); // Import Holiday model

/**
 * Calculates the end date based on a start date, duration in days,
 * and an array of holiday date strings (YYYY-MM-DD).
 * Weekends (Saturday, Sunday) are also excluded if excludeHolidays is true.
 * @param {Date} startDate - The start date (Date object).
 * @param {number} durationDays - The duration in days.
 * @param {boolean} excludeHolidays - Whether to exclude weekends and holidays.
 * @param {number} financialYear - The financial year to fetch holidays for.
 * @returns {Date|null} The calculated end date, or null if inputs are invalid.
 */
const calculateEndDate = async (startDate, durationDays, excludeHolidays, financialYear) => {
  if (!startDate || !durationDays || durationDays <= 0) {
    return startDate; // Or null, or throw error
  }
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  let holidays = [];

  if (excludeHolidays && financialYear) {
    const holidayDoc = await Holiday.findOne({ year: financialYear });
    if (holidayDoc && holidayDoc.holidays) {
      holidays = holidayDoc.holidays.map(h => new Date(h.date).toISOString().split('T')[0]);
    }
  }

  while (daysAdded < durationDays) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateString = currentDate.toISOString().split('T')[0];

    if (excludeHolidays && (dayOfWeek === 0 || dayOfWeek === 6 || holidays.includes(dateString))) {
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
 * @param {boolean} excludeHolidays - Whether to exclude weekends and holidays.
 * @param {number} financialYear - The financial year to fetch holidays for.
 * @returns {number|null} The number of working days, or null if inputs are invalid.
 */
const calculateDurationDays = async (startDate, endDate, excludeHolidays, financialYear) => {
  if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
    return null; // Invalid dates
  }
  // Re-use calculateEndDate logic to count days
  // This is a simplified approach; a more robust one might iterate and count.
  // For now, let's implement the iteration approach directly.
  let currentDate = new Date(startDate);
  let count = 0;
  let holidays = [];

  if (excludeHolidays && financialYear) {
    const holidayDoc = await Holiday.findOne({ year: financialYear });
    if (holidayDoc && holidayDoc.holidays) {
      holidays = holidayDoc.holidays.map(h => new Date(h.date).toISOString().split('T')[0]);
    }
  }

  while (currentDate <= new Date(endDate)) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateString = currentDate.toISOString().split('T')[0];

    if (excludeHolidays && (dayOfWeek === 0 || dayOfWeek === 6 || holidays.includes(dateString))) {
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