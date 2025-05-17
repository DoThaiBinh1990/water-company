// d:\CODE\water-company\backend\server\routes\syncRoutes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware');
const { syncOldProjects } = require('../utils');
const logger = require('../config/logger'); // Import logger

router.post('/sync-projects', authenticate, async (req, res, next) => { // Thêm next
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền đồng bộ dữ liệu công trình' });
  try {
    const result = await syncOldProjects();
    res.json(result);
  } catch (error) {
    logger.error("Lỗi API đồng bộ công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;
