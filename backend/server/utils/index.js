// d:\CODE\water-company\backend\server\utils\index.js
const { updateSerialNumbers } = require('./serialNumber.util.js');
const { populateProjectFields } = require('./population.util.js');
const { syncOldProjects } = require('./sync.util.js');

module.exports = {
  updateSerialNumbers,
  populateProjectFields,
  syncOldProjects,
};
