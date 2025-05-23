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

  // Sửa counterQuery để khớp với unique index hiện tại (không bao gồm allocationWaveShortCode)
  // Điều này có nghĩa là tất cả các đợt trong cùng năm, loại, đơn vị sẽ dùng chung một bộ đếm.
  const counterQuery = {
    year: financialYear,
    type: projectType,
    unitShortCode: unitShortCode
  };
  let nextSerial;
  // const Model = projectType === 'category' ? CategoryProject : MinorRepairProject; // Không cần nữa nếu dùng $inc

  if (previewMode) {
    // Logic preview vẫn dựa trên counter hiện tại + 1
    const existingCounter = await ProjectCodeCounter.findOne(counterQuery);
    nextSerial = existingCounter ? existingCounter.currentSerial + 1 : 1;
  } else {
    // Implement retry logic for findOneAndUpdate with upsert
    const MAX_RETRIES = 5;
    let retries = 0;
    let counter = null;

    while (retries < MAX_RETRIES) {
      try {
        counter = await ProjectCodeCounter.findOneAndUpdate(
          counterQuery,
          // Sử dụng $inc để đảm bảo số serial tăng dần và duy nhất cho counterQuery này
          { $inc: { currentSerial: 1 } }, 
          { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true } // Thêm runValidators
        );
        break; // Success, exit loop
      } catch (error) {
        // Kiểm tra lỗi duplicate key một cách chặt chẽ hơn
        const isDuplicateKeyError = error.code === 11000 || (error.name === 'MongoError' && error.message.includes('E11000'));
        if (isDuplicateKeyError) {
          retries++;
          if (retries >= MAX_RETRIES) {
            logger.error(
              `HẾT LƯỢT THỬ LẠI (${MAX_RETRIES}) cho ProjectCodeCounter ${JSON.stringify(counterQuery)} ` +
              `khi cố gắng $inc do lỗi E11000. Lỗi: ${error.message}`
            );
            throw error; // Ném lại lỗi E11000 nếu đã hết lượt thử
          }
          const delay = Math.pow(2, retries) * 100 + Math.random() * 100; // Tăng nhẹ base delay và jitter
          logger.warn(`Duplicate key error for counter ${JSON.stringify(counterQuery)}. Retry ${retries}/${MAX_RETRIES}. Retrying in ${delay}ms.`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Other error, re-throw
          logger.error(
            `Lỗi không phải E11000 khi cập nhật ProjectCodeCounter cho ${JSON.stringify(counterQuery)} ` +
            `khi cố gắng $inc: ${error.message}`, { stack: error.stack }
          );
          throw error;
        }
      }
    }

    if (!counter) {
        // Trường hợp này không nên xảy ra nếu lỗi E11000 sau khi hết retry đã được throw ở trên.
        // Nếu đến đây mà counter vẫn null, có thể là do MAX_RETRIES = 0 hoặc một lỗi logic khác.
        logger.error(`Không thể lấy/cập nhật ProjectCodeCounter cho ${JSON.stringify(counterQuery)} sau khi thử lại và không có lỗi E11000 được ném ra. Trả về null.`);
        return null; // Không thể tạo mã nếu không lấy được số serial
    }
    // Lấy số serial sau khi đã $inc thành công
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
