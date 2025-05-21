// d:\CODE\water-company\backend\server\utils\index.js
const { updateSerialNumbers } = require('./serialNumber.util.js');
const { populateProjectFields } = require('./population.util.js');
const { areDatesEqual } = require('./dateUtils.js');
const { syncOldProjects } = require('./sync.util.js');
const { userFieldToQuery } = require('../services/helpers/serviceHelpers'); // Import userFieldToQuery

module.exports = {
  updateSerialNumbers,
  populateProjectFields,
  userFieldToQuery, // Export userFieldToQuery
  areDatesEqual, // Export the new date helper
  syncOldProjects,
};
