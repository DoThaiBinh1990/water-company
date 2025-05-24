// d:\CODE\water-company\backend\server\routes\syncRoutes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware');
const { syncOldProjects } = require('../utils'); // Vẫn giữ lại hàm đồng bộ trực tiếp
const syncController = require('../controllers/sync.controller'); // Import controller mới
const logger = require('../config/logger'); // Import logger

// Route để chuẩn bị dữ liệu đồng bộ (cho frontend review)
router.get('/sync-projects/prepare', authenticate, syncController.prepareSyncController);

// Route để thực thi đồng bộ (có thể dùng lại hàm syncOldProjects với payload từ frontend)
router.post('/sync-projects/execute', authenticate, async (req, res, next) => { // Đổi tên route để rõ ràng hơn
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền đồng bộ dữ liệu công trình' });
  try {
    // Lấy targetFinancialYear và projectsToSyncFromFrontend từ req.body
    const { targetFinancialYear, projectsToSyncFromFrontend } = req.body;
    // Truyền các tham số này vào hàm syncOldProjects
    const result = await syncOldProjects(targetFinancialYear, projectsToSyncFromFrontend, req.user);
    res.json(result);
  } catch (error) {
    logger.error("Lỗi API đồng bộ công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

// Route để xóa một công trình gốc (duplicate) từ modal review
router.delete('/sync-projects/delete-original/:type/:id', authenticate, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền xóa công trình này.' });
  syncController.deleteOriginalProjectController(req, res, next);
});

module.exports = router;
