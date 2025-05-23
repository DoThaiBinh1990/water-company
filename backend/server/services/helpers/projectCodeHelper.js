// d:\CODE\water-company\backend\server\services\helpers\projectCodeHelper.js
const mongoose = require('mongoose');
const { ProjectCodeCounter, AllocatedUnit, AllocationWave } = require('../../models');
const logger = require('../../config/logger');

/**
 * Generates a unique project code.
 * @param {string} projectType - 'category' or 'minor_repair'.
 * @param {number} financialYear - The financial year.
 * @param {string} allocatedUnitName - The name of the allocated unit.
 * @param {string|mongoose.Types.ObjectId} [allocationWaveNameOrId] - Optional. The name or ID of the allocation wave (for category projects).
 * @param {boolean} [previewMode=false] - If true, only calculates the next serial without updating the counter.
 * @returns {Promise<string|null>} The generated project code, or null if essential info (like unit shortCode) is missing.
 */
async function generateProjectCode(projectType, financialYear, allocatedUnitName, allocationWaveNameOrId = null, previewMode = false) {
  const typePrefix = projectType === 'category' ? 'DM' : 'SC';
  const yearSuffix = String(financialYear).slice(-2);

  let unitShortCode = 'XXX'; // Default short code
  if (allocatedUnitName) { // allocatedUnitName ở đây có thể là ID hoặc tên
    let unit;
    // Kiểm tra xem allocatedUnitName có phải là ObjectId hợp lệ không
    if (typeof allocatedUnitName === 'string' && mongoose.Types.ObjectId.isValid(allocatedUnitName)) {
        unit = await AllocatedUnit.findById(allocatedUnitName).select('shortCode');
    }
    if (!unit && typeof allocatedUnitName === 'string') { // Nếu không phải ID hoặc không tìm thấy bằng ID, thử tìm bằng tên
        unit = await AllocatedUnit.findOne({ name: allocatedUnitName }).select('shortCode');
    }
    if (unit && unit.shortCode) {
      unitShortCode = unit.shortCode.toUpperCase();
    } else {
      logger.warn(`Không tìm thấy mã viết tắt (shortCode) cho đơn vị "${allocatedUnitName}". Sử dụng mã mặc định "XXX" cho projectCode.`);
    }
  } else {
     logger.warn(`Tên đơn vị phân bổ (allocatedUnitName) không được cung cấp. Sử dụng mã mặc định "XXX" cho projectCode.`);
     // Nếu không có allocatedUnitName, không thể tạo mã hợp lệ
  }
  
  if (unitShortCode.length !== 3) {
      logger.warn(`Mã viết tắt đơn vị "${unitShortCode}" không hợp lệ (cần 3 ký tự). Sử dụng mã mặc định "XXX" cho projectCode.`);
      unitShortCode = 'XXX';
  }

  if (unitShortCode === 'XXX' && allocatedUnitName) { // Nếu vẫn là XXX sau khi cố gắng tìm, nghĩa là không tìm thấy đơn vị
    logger.error(`Không thể tạo projectCode: Không tìm thấy đơn vị hoặc mã đơn vị cho "${allocatedUnitName}".`);
    return null; // Không thể tạo mã nếu không có unitShortCode hợp lệ
  }

  let waveShortCode = '00'; // Default SS part
  if (projectType === 'category' && allocationWaveNameOrId) {
    let wave;
    if (mongoose.Types.ObjectId.isValid(allocationWaveNameOrId)) {
      wave = await AllocationWave.findById(allocationWaveNameOrId).select('shortCode name'); // Giữ nguyên nếu là ID
    } else {
      wave = await AllocationWave.findOne({ name: allocationWaveNameOrId }).select('shortCode name');
    }

    if (wave && wave.shortCode) {
      waveShortCode = wave.shortCode.toUpperCase();
    } else if (wave && !wave.shortCode) {
      logger.warn(`Đợt phân bổ "${wave.name}" không có mã viết tắt (shortCode). Sử dụng "00" cho projectCode.`);
    } else {
      logger.warn(`Không tìm thấy đợt phân bổ "${allocationWaveNameOrId}". Sử dụng "00" cho projectCode.`);
    }
  }
  if (waveShortCode.length !== 2) {
    logger.warn(`Mã viết tắt đợt phân bổ "${waveShortCode}" không hợp lệ (cần 2 ký tự). Sử dụng "00" cho projectCode.`);
    waveShortCode = '00';
  }

  const counterQuery = { year: financialYear, type: projectType, allocationWaveShortCode: waveShortCode, unitShortCode: unitShortCode };
  let nextSerial;

  if (previewMode) {
    const existingCounter = await ProjectCodeCounter.findOne(counterQuery);
    nextSerial = existingCounter ? existingCounter.currentSerial + 1 : 1;
  } else {
    const counter = await ProjectCodeCounter.findOneAndUpdate(
      counterQuery,
      { $inc: { currentSerial: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    nextSerial = counter.currentSerial;
  }

  let serialString = String(nextSerial);
  if (nextSerial < 1000) { 
    serialString = serialString.padStart(3, '0');
  }
  // Nếu >= 1000, giữ nguyên số đó (ví dụ: "1000", "1001")

  if (projectType === 'minor_repair') {
    return `${typePrefix}${yearSuffix}${unitShortCode}${serialString}`; // Không bao gồm waveShortCode cho SCN
  } else { // Cho 'category'
    return `${typePrefix}${waveShortCode}${yearSuffix}${unitShortCode}${serialString}`;
  }
}

module.exports = { generateProjectCode };
