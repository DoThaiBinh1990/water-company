// d:\CODE\water-company\backend\server\routes\projectRoutes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware');
const { CategoryProject, MinorRepairProject, Notification, RejectedProject, User } = require('../models');
// const { updateSerialNumbers, populateProjectFields } = require('../utils'); // These are likely used within services now
const projectService = require('../services/project.service'); // Import service (aggregator)
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

// Removed allocate and assign routes

// Notifications route - Keep as is, it fetches data
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query; // 'pending' or 'processed'
    const user = req.user;
    const MAX_PROCESSED_NOTIFICATIONS_TO_SHOW = 15; // Số lượng thông báo 'processed' tối đa hiển thị
    let queryConditions = [];

    if (status) {
      // Client yêu cầu một status cụ thể
      if (user.permissions?.approve) {
        // Approver thấy các thông báo có status đó mà họ là recipient hoặc là thông báo chung
        queryConditions.push({ recipientId: user.id, status: status });
        if (status === 'pending') { // Chỉ lấy thông báo chung nếu là pending
            queryConditions.push({ recipientId: { $exists: false }, status: 'pending' });
        }
      }
      // Mọi user đều thấy thông báo có status đó mà họ là người tạo/liên quan (userId)
      queryConditions.push({ userId: user.id, status: status });

      const query = queryConditions.length > 0 ? { $or: queryConditions } : { _id: null }; // Tránh lấy tất cả nếu không có điều kiện
      const notifications = await Notification.find(query)
        .populate('userId', 'username fullName')
        .populate('recipientId', 'username fullName')
    .populate({ path: 'projectId', select: 'name projectType status pendingEdit pendingDelete' })
        .sort({ createdAt: -1 })
        .limit(status === 'processed' ? MAX_PROCESSED_NOTIFICATIONS_TO_SHOW : 100); // Giới hạn nếu là processed

      const processedNotifications = notifications.map(notif => { /* ... (như cũ) ... */ });
      return res.json(processedNotifications);

    } else {
      // Client không yêu cầu status cụ thể (App.js gọi để lấy tất cả thông báo liên quan)
      let allNotifications = [];

      // 1. Lấy tất cả thông báo PENDING liên quan
      const pendingQueryConditions = [];
      pendingQueryConditions.push({ userId: user.id, status: 'pending' });
      pendingQueryConditions.push({ recipientId: user.id, status: 'pending' });
      if (user.permissions?.approve) {
        pendingQueryConditions.push({ recipientId: { $exists: false }, status: 'pending' });
      }
      if (pendingQueryConditions.length > 0) {
        const pendingNotifs = await Notification.find({ $or: pendingQueryConditions })
            .populate('userId', 'username fullName')
            .populate('recipientId', 'username fullName')
        .populate({ path: 'projectId', select: 'name projectType status pendingEdit pendingDelete' })
            .sort({ createdAt: -1 }).limit(100); // Giới hạn pending nếu quá nhiều
        allNotifications = allNotifications.concat(pendingNotifs);
      }

      // 2. Lấy một số thông báo PROCESSED mới nhất liên quan
      const processedQueryConditions = [];
      processedQueryConditions.push({ userId: user.id, status: 'processed' });
      processedQueryConditions.push({ recipientId: user.id, status: 'processed' });
      // Không lấy thông báo processed chung cho approver
      if (processedQueryConditions.length > 0) {
        const processedNotifs = await Notification.find({ $or: processedQueryConditions })
            .populate('userId', 'username fullName')
            .populate('recipientId', 'username fullName')
        .populate({ path: 'projectId', select: 'name projectType status pendingEdit pendingDelete' })
            .sort({ createdAt: -1 }).limit(MAX_PROCESSED_NOTIFICATIONS_TO_SHOW);
        allNotifications = allNotifications.concat(processedNotifs);
      }

      // Loại bỏ trùng lặp nếu có (mặc dù logic query nên tránh điều này)
      const uniqueNotifications = Array.from(new Set(allNotifications.map(a => a._id)))
                                    .map(id => allNotifications.find(a => a._id === id));
      // Sắp xếp lại lần cuối theo ngày tạo
      uniqueNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const finalProcessedNotifications = uniqueNotifications.map(notif => {
        const notifObj = notif.toObject();
        if (notifObj.projectId && !notifObj.projectId.type && notifObj.projectModel) {
          notifObj.projectId.type = notifObj.projectModel === 'CategoryProject' ? 'category' : 'minor_repair';
        }
        return notifObj;
      });
      return res.json(finalProcessedNotifications);
    }
  } catch (error) {
    logger.error("Lỗi API lấy thông báo:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Không tìm thấy thông báo' });

    const canMarkAsRead = req.user.role === 'admin' ||
                          (notification.recipientId && notification.recipientId.toString() === req.user.id.toString()) || // User là người nhận cụ thể
                          (!notification.recipientId && notification.userId && notification.userId.toString() === req.user.id.toString()); // Thông báo không có người nhận cụ thể VÀ user là người tạo


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

router.patch('/notifications/mark-all-as-processed', authenticate, async (req, res, next) => {
  try {
    // Service sẽ xử lý logic để chỉ giữ lại các thông báo "pending" thực sự cần action
    const result = await projectService.markAllUserNotificationsAsProcessed(req.user, req.io); // Truyền cả object req.user
    res.json(result);
  } catch (error) {
    logger.error("Lỗi API đánh dấu tất cả thông báo đã xử lý:", { userId: req.user.id, message: error.message, stack: error.stack });
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
});

// Route mới để đánh dấu các thông báo "chỉ xem" của user là đã xử lý
router.patch('/notifications/mark-viewed-as-processed', authenticate, async (req, res, next) => {
  try {
    const result = await projectService.markViewedNotificationsAsProcessed(req.user, req.io);
    res.json(result);
  } catch (error) {
    logger.error("Lỗi API đánh dấu thông báo đã xem là đã xử lý:", { userId: req.user.id, message: error.message, stack: error.stack });
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
});

// Rejected Projects route - Keep as is, it fetches data
router.get('/rejected-projects', authenticate, async (req, res, next) => {
  try { 
    const result = await projectService.getRejectedProjectsList({ ...req.query, user: req.user });
    res.json(result);
  } catch (error) {
    logger.error("Lỗi API lấy danh sách công trình bị từ chối:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

// Restore Rejected Project route - Move logic to service
router.post('/rejected-projects/:id/restore', authenticate, async (req, res, next) => {
  if (!req.user.permissions.approve) { 
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
  if (req.user.role !== 'admin') { 
    return res.status(403).json({ message: 'Không có quyền xóa vĩnh viễn công trình bị từ chối.' });
  } 
  try { 
    const result = await projectService.permanentlyDeleteRejectedProject(req.params.id, req.io); 
    res.json(result); 
  } catch (error) {
    logger.error("Lỗi API xóa vĩnh viễn công trình bị từ chối:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;
