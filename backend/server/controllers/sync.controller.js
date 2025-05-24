// d:\CODE\water-company\backend\server\controllers\sync.controller.js
const syncService = require('../services/sync.service');
const logger = require('../config/logger');
const { categoryFormConfig, minorRepairFormConfig } = require('../config/formConfigs'); // Đường dẫn đúng

exports.prepareSyncController = async (req, res, next) => {
  try {
    const { financialYear, projectType } = req.query; // Lấy financialYear và projectType từ query params
    // req.user được truyền từ middleware 'authenticate'
    // Truyền form configs vào service
    // Sửa ở đây: không cần truyền formConfigs vào service nữa vì service sẽ tự import
    const preparedData = await syncService.prepareProjectsForSyncService(financialYear, projectType, req.user);
    res.json(preparedData);
  } catch (error) {
    logger.error("Lỗi Controller chuẩn bị đồng bộ:", {
      path: req.path,
      method: req.method,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode
    });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

exports.deleteOriginalProjectController = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID công trình không hợp lệ.' });
    }
    // req.user được truyền từ middleware 'authenticate'
    const result = await syncService.deleteOriginalProjectByIdService(id, type, req.user);
    res.json(result);
  } catch (error) {
    logger.error("Lỗi Controller xóa công trình gốc từ sync review:", { path: req.path, method: req.method, params: req.params, message: error.message, stack: error.stack, statusCode: error.statusCode });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};