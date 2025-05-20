// d:\CODE\water-company\backend\server\utils\dateUtils.js

/**
 * Helper function to compare dates (handles strings YYYY-MM-DD and Date objects).
 * Compares only the date part, ignoring time.
 * @param {Date|string|null|undefined} date1 - The first date.
 * @param {Date|string|null|undefined} date2 - The second date.
 * @returns {boolean} True if the dates are the same day, false otherwise.
 */
const areDatesEqual = (date1, date2) => {
  if (date1 === null && date2 === null) return true;
  if (date1 === undefined && date2 === undefined) return true;
  if (!date1 || !date2) return false;
  const d1 = new Date(date1).toISOString().split('T')[0];
  const d2 = new Date(date2).toISOString().split('T')[0];
  return d1 === d2;
};

module.exports = {
    areDatesEqual,
};