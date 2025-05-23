// d:\CODE\water-company\backend\server\controllers\sync.controller.js
const syncService = require('../services/sync.service');
const logger = require('../config/logger');

exports.prepareSyncController = async (req, res, next) => {
  try {
    const { financialYear, projectType } = req.query; // Lấy financialYear và projectType từ query params
    // req.user được truyền từ middleware 'authenticate'
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