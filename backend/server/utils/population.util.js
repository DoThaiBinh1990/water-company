// d:\CODE\water-company\backend\server\utils\population.util.js
const logger = require('../config/logger'); // Import logger

// Helper function to populate project fields consistently for Project and RejectedProject documents
const populateProjectFields = async (projectDoc, isRejected = false) => {
  if (!projectDoc || typeof projectDoc.populate !== 'function') {
      // If it's not a Mongoose document instance, return it as is.
      // This might happen if it's already a plain object.
      return projectDoc;
  }
  try {
    let populatedDoc = projectDoc;

    // Define an array to hold population paths
    let pathsToPopulate = [];

    if (isRejected) {
        // For RejectedProject documents
        pathsToPopulate = [
            { path: 'createdBy', select: 'username fullName' },
            { path: 'rejectedBy', select: 'username fullName' }, // rejectedBy exists on RejectedProject
        ];
        // Explicitly check if 'approvedBy' path exists for RejectedProject schema
        if (projectDoc.schema.path('approvedBy')) {
            pathsToPopulate.push({ path: 'approvedBy', select: 'username fullName' });
        }
    } else {
        // For CategoryProject and MinorRepairProject documents
        pathsToPopulate = [
            { path: 'createdBy', select: 'username fullName' },
            { path: 'approvedBy', select: 'username fullName' },
        ];

        // Add supervisor population if the path exists in the schema
        if (projectDoc.schema && projectDoc.schema.path('supervisor')) {
          pathsToPopulate.push({ path: 'supervisor', select: 'username fullName' });
        }

        // Add estimator population only if it's a CategoryProject and the path exists
        if (projectDoc.constructor.modelName === 'CategoryProject' && projectDoc.schema && projectDoc.schema.path('estimator')) {
          pathsToPopulate.push({ path: 'estimator', select: 'username fullName' });
        }
    }

    // Conditionally populate history.user if history exists and has items
    // This applies to both rejected and non-rejected projects as both schemas have 'history'
    if (populatedDoc.schema && populatedDoc.schema.path('history.user') && populatedDoc.history && populatedDoc.history.length > 0) {
        pathsToPopulate.push({ path: 'history.user', select: 'username fullName' });
    }

    // Populate pendingEdit.requestedBy only if it's NOT a rejected project and pendingEdit exists
    // pendingEdit only exists on CategoryProject and MinorRepairProject, NOT RejectedProject
    if (!isRejected && populatedDoc.schema && populatedDoc.schema.path('pendingEdit.requestedBy') && populatedDoc.pendingEdit && populatedDoc.pendingEdit.requestedBy) {
       pathsToPopulate.push({ path: 'pendingEdit.requestedBy', select: 'username fullName' });
    }

    // Execute all populations if there are paths to populate
    if (pathsToPopulate.length > 0) {
        populatedDoc = await populatedDoc.populate(pathsToPopulate);
    }

    return populatedDoc; // Return the populated document
  } catch (error) {
    logger.error("Error in populateProjectFields:", { message: error.message, stack: error.stack });
    // Return original document if population fails, to prevent request crash
    return projectDoc;
  }
};

module.exports = { populateProjectFields };
