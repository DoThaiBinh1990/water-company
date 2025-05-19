// d:\CODE\water-company\backend\server\routes\projectRoutes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware');
const { CategoryProject, MinorRepairProject, Notification, RejectedProject, User } = require('../models');
const { updateSerialNumbers, populateProjectFields } = require('../utils');
const projectService = require('../services/project.service'); // Import service
const logger = require('../config/logger'); // Import logger

router.get('/projects/:id/status', authenticate, async (req, res, next) => {
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    const status = {
      status: project.status,
      pendingEdit: !!project.pendingEdit,
      pendingDelete: project.pendingDelete
    };
    res.json(status);
  } catch (error) {
    logger.error("Lỗi API lấy trạng thái công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.patch('/projects/:id/approve', authenticate, async (req, res, next) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền duyệt' });
  try {
    const { type } = req.query; // type is required by service
    const result = await projectService.approveProject(req.params.id, type, req.user, req.io);
    res.json(result);

  } catch (error) {
    logger.error("Lỗi API duyệt công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

// Similar changes for reject, allocate, assign routes
router.patch('/projects/:id/reject', authenticate, async (req, res, next) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền từ chối' });
  try {
    const { type } = req.query;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Lý do từ chối là bắt buộc.' });

    const result = await projectService.rejectProject(req.params.id, type, reason, req.user, req.io);
    res.json(result);

  } catch (error) {
    logger.error("Lỗi API từ chối công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

// ... (các route allocate, assign, notifications, rejected-projects giữ nguyên như file bạn cung cấp) ...
// Đảm bảo rằng các route này cũng emit 'notification_processed' nếu chúng xử lý một thông báo đang chờ
// Removed allocate and assign routes
// router.patch('/projects/:id/allocate', authenticate, async (req, res, next) => {
//   if (!req.user.permissions.allocate) return res.status(403).json({ message: 'Không có quyền phân bổ' });
//   try {
//     const { constructionUnit, allocationWave } = req.body;
//     const result = await projectService.allocateProject(req.params.id, constructionUnit, allocationWave, req.user, req.io);
//     // Socket emission should be handled in the service
//     res.json(result);
//   } catch (error) {
//     logger.error("Lỗi API phân bổ công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
//     next(error);
//   }
// });

// router.patch('/projects/:id/assign', authenticate, async (req, res, next) => {
//   if (!req.user.permissions.assign) return res.status(403).json({ message: 'Không có quyền giao việc' });
//   try {
//     const { supervisor, estimator } = req.body;
//     const { type } = req.query; // type is required by service
//     const result = await projectService.assignProject(req.params.id, supervisor, estimator, type, req.user, req.io);
//     // Socket emission should be handled in the service
//     res.json(result);
//   } catch (error) {
//     logger.error("Lỗi API giao việc công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
//     next(error);
//   }
// });

// Notifications route - Keep as is, it fetches data
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query; // 'pending' or 'processed'
    let query = {};

    if (status) {
      query.status = status;
    }

    // Admin và các vai trò quản lý công ty có quyền approve sẽ thấy tất cả thông báo 'pending'
    // hoặc tất cả thông báo 'processed' nếu tab là 'processed'.
    if (req.user.permissions.approve) {
      // Họ đã thấy tất cả theo status filter.
    } else {
      // User thường chỉ thấy thông báo liên quan đến họ (họ tạo yêu cầu, hoặc họ là người nhận)
      // và chỉ những thông báo đã 'processed' nếu họ không phải là người duyệt.
      // Hoặc những thông báo 'pending' mà họ là người tạo ra yêu cầu (userId = req.user.id)
      // và những thông báo 'pending' mà họ là người được gán để duyệt (recipientId = req.user.id)
      const userSpecificOrConditions = [
        { userId: req.user.id }, // Thông báo do user này tạo ra (ví dụ: yêu cầu sửa của họ)
        { recipientId: req.user.id } // Thông báo gửi đến user này (ví dụ: yêu cầu duyệt cho họ)
      ];
      
      if (query.$or) {
        query.$and = [ { $or: query.$or }, { $or: userSpecificOrConditions } ];
        delete query.$or;
      } else {
        query.$or = userSpecificOrConditions;
      }
    }
    
    const notifications = await Notification.find(query)
      .populate('userId', 'username fullName') // User tạo/liên quan đến thông báo
      .populate('recipientId', 'username fullName') // User nhận thông báo (nếu có)
      .populate({
        path: 'projectId',
        select: 'name projectType', // Lấy projectType từ project nếu có
      })
      .sort({ createdAt: -1 })
      .limit(100); // Giới hạn số lượng thông báo

    const processedNotifications = notifications.map(notif => {
      const notifObj = notif.toObject();
      if (notifObj.projectId && !notifObj.projectId.type && notifObj.projectModel) {
        // Gán 'type' cho projectId dựa trên projectModel nếu chưa có
        notifObj.projectId.type = notifObj.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
      }
      return notifObj;
    });

    res.json(processedNotifications);
  } catch (error) {
    logger.error("Lỗi API lấy thông báo:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Không tìm thấy thông báo' });

    // Chỉ cho phép người nhận hoặc admin đánh dấu đã đọc/xử lý
    // Hoặc nếu thông báo không phải là loại cần hành động (ví dụ: thông báo chung)
    const canMarkAsRead = req.user.role === 'admin' ||
                          (notification.recipientId && notification.recipientId.toString() === req.user.id.toString()) ||
                          (!notification.recipientId && notification.userId.toString() === req.user.id.toString());


    if (!canMarkAsRead && notification.status === 'pending' && ['new', 'edit', 'delete'].includes(notification.type)) {
         return res.status(403).json({ message: 'Không có quyền cập nhật thông báo này.' });
    }

    if (notification.status !== 'processed') {
        notification.status = 'processed';
        await notification.save();
    }

    if (req.io) {
      req.io.emit('notification_processed', notification._id);
    }
    res.json({ message: 'Thông báo đã được đánh dấu là đã xử lý.', notification });
  } catch (error) {
    logger.error("Lỗi API cập nhật thông báo:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

// Rejected Projects route - Keep as is, it fetches data
router.get('/rejected-projects', authenticate, async (req, res, next) => {
  try { // Sử dụng service function mới
    const result = await projectService.getRejectedProjectsList({ ...req.query, user: req.user });
    res.json(result);
  } catch (error) {
    logger.error("Lỗi API lấy danh sách công trình bị từ chối:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

// Restore Rejected Project route - Move logic to service
router.post('/rejected-projects/:id/restore', authenticate, async (req, res, next) => {
  if (!req.user.permissions.approve) { // Chỉ người có quyền duyệt mới có thể khôi phục
    return res.status(403).json({ message: 'Không có quyền khôi phục công trình bị từ chối.' });
  }
  try {
    const result = await projectService.restoreRejectedProject(req.params.id, req.user, req.io);
    res.json(result);
  } catch (error) {
    logger.error("Lỗi API khôi phục công trình bị từ chối:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.delete('/rejected-projects/:id', authenticate, async (req, res, next) => {
  if (req.user.role !== 'admin') { // Chỉ admin mới có quyền xóa vĩnh viễn
    return res.status(403).json({ message: 'Không có quyền xóa vĩnh viễn công trình bị từ chối.' });
  } // Move logic to service
  try { const result = await projectService.permanentlyDeleteRejectedProject(req.params.id, req.io); res.json(result); } catch (error) {
    logger.error("Lỗi API xóa vĩnh viễn công trình bị từ chối:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;
