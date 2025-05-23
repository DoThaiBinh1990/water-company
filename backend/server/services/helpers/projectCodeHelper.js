// d:\CODE\water-company\backend\server\services\helpers\projectCodeHelper.js
const { ProjectCodeCounter, AllocatedUnit } = require('../../models');
const logger = require('../../config/logger');

/**
 * Generates a unique project code.
 * @param {string} projectType - 'category' or 'minor_repair'.
 * @param {number} financialYear - The financial year.
 * @param {string} allocatedUnitName - The name of the allocated unit.
 * @returns {Promise<string>} The generated project code.
 */
async function generateProjectCode(projectType, financialYear, allocatedUnitName) {
  const typePrefix = projectType === 'category' ? 'DM' : 'SC';
  const yearSuffix = String(financialYear).slice(-2);

  let unitShortCode = 'XXX'; // Default short code
  if (allocatedUnitName) {
    const unit = await AllocatedUnit.findOne({ name: allocatedUnitName }).select('shortCode');
    if (unit && unit.shortCode) {
      unitShortCode = unit.shortCode.toUpperCase();
    } else {
      logger.warn(`Không tìm thấy mã viết tắt (shortCode) cho đơn vị "${allocatedUnitName}". Sử dụng mã mặc định "XXX" cho projectCode.`);
    }
  } else {
     logger.warn(`Tên đơn vị phân bổ (allocatedUnitName) không được cung cấp. Sử dụng mã mặc định "XXX" cho projectCode.`);
  }
  
  if (unitShortCode.length !== 3) {
      logger.warn(`Mã viết tắt đơn vị "${unitShortCode}" không hợp lệ (cần 3 ký tự). Sử dụng mã mặc định "XXX" cho projectCode.`);
      unitShortCode = 'XXX';
  }


  const counter = await ProjectCodeCounter.findOneAndUpdate(
    { year: financialYear, type: projectType, unitShortCode: unitShortCode },
    { $inc: { currentSerial: 1 } },
    { new: true, upsert: true }
  );

  const serialString = String(counter.currentSerial).padStart(3, '0');

  return `${typePrefix}${yearSuffix}${unitShortCode}${serialString}`;
}

module.exports = { generateProjectCode };
