// d:\CODE\water-company\backend\server\services\helpers\serviceHelpers.js
const mongoose = require('mongoose');
const { User } = require('../../models'); // Import User model

/**
 * Resolves a user identifier (ID string, username, or fullName) to a User ObjectId.
 * @param {string} userIdentifier - The identifier for the user.
 * @returns {Promise<mongoose.Types.ObjectId|null>} The user's ObjectId or null if not found.
 */
const userFieldToQuery = async (userIdentifier) => {
  if (!userIdentifier) return null;
  if (mongoose.Types.ObjectId.isValid(userIdentifier)) {
      const userById = await User.findById(userIdentifier).select('_id');
      return userById ? userById._id : null;
  }
  const userByName = await User.findOne({ $or: [{ username: userIdentifier }, { fullName: userIdentifier }] }).select('_id');
  return userByName ? userByName._id : null;
};

module.exports = {
    userFieldToQuery,
};