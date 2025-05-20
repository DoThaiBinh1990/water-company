// d:\CODE\water-company\backend\server\utils\index.js
const { updateSerialNumbers } = require('./serialNumber.util.js');
const { populateProjectFields } = require('./population.util.js');
const { areDatesEqual } = require('./dateUtils.js'); // Import the new date helper
const { syncOldProjects } = require('./sync.util.js');

module.exports = {
  updateSerialNumbers,
  populateProjectFields,
  areDatesEqual, // Export the new date helper
  syncOldProjects,
};
