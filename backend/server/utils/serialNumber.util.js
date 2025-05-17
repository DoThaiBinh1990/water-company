// d:\CODE\water-company\backend\server\utils\serialNumber.util.js
const { CategoryProject, MinorRepairProject, SerialCounter } = require('../models');
const logger = require('../config/logger'); // Import logger

// Hàm cập nhật số thứ tự cho từng loại công trình
async function updateSerialNumbers(type) {
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;
  const serialField = type === 'category' ? 'categorySerialNumber' : 'minorRepairSerialNumber';
  try {
    const projects = await Model.find().sort({ createdAt: 1 });
    const bulkOps = projects.map((project, index) => ({
      updateOne: {
        filter: { _id: project._id },
        update: { [serialField]: index + 1 },
      },
    }));

    if (bulkOps.length > 0) {
      await Model.bulkWrite(bulkOps, { ordered: false });
    }

    const newMaxSerial = projects.length > 0 ? projects.length : 0;
    await SerialCounter.findOneAndUpdate(
      { type },
      { currentSerial: newMaxSerial },
      { upsert: true }
    );
  } catch (error) {
    logger.error(`Lỗi khi cập nhật số thứ tự cho loại ${type}:`, { message: error.message, stack: error.stack });
    throw new Error(`Lỗi khi cập nhật số thứ tự: ${error.message}`);
  }
}

module.exports = { updateSerialNumbers };
