// d:\CODE\water-company\backend\server\utils\population.util.js
const logger = require('../config/logger'); // Import logger

// Helper function to populate project fields consistently
const populateProjectFields = async (projectDoc) => {
  if (!projectDoc) return null;
  try {
    // For Mongoose >= 6, projectDoc.populate() returns a promise
    // For Mongoose < 6, you might need .execPopulate() for single instances
    await projectDoc.populate([
      { path: 'createdBy', select: 'username fullName' },
      { path: 'approvedBy', select: 'username fullName' },
      { path: 'supervisor', select: 'username fullName' },
      { path: 'estimator', select: 'username fullName' },
      { path: 'pendingEdit.requestedBy', select: 'username fullName' },
      // Add other user fields if necessary, e.g.:
      // { path: 'assignedTo', select: 'username fullName' },
    ]);
    return projectDoc;
  } catch (error) {
    logger.error("Error in populateProjectFields:", { message: error.message, stack: error.stack });
    // Return original document if population fails, to prevent request crash
    return projectDoc;
  }
};

module.exports = { populateProjectFields };
