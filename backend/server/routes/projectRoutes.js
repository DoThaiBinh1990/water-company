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
    let query = {};

    if (status) {
      query.status = status;
    }

    if (req.user.permissions.approve) {
      // They see all based on status filter.
    } else {
      const userSpecificOrConditions = [
        { userId: req.user.id },
        { recipientId: req.user.id }
      ];
      
      if (query.$or) {
        query.$and = [ { $or: query.$or }, { $or: userSpecificOrConditions } ];
        delete query.$or;
      } else {
        query.$or = userSpecificOrConditions;
      }
    }
    
    const notifications = await Notification.find(query)
      .populate('userId', 'username fullName')
      .populate('recipientId', 'username fullName')
      .populate({
        path: 'projectId',
        select: 'name projectType', 
      })
      .sort({ createdAt: -1 })
      .limit(100); 

    const processedNotifications = notifications.map(notif => {
      const notifObj = notif.toObject();
      if (notifObj.projectId && !notifObj.projectId.type && notifObj.projectModel) {
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
