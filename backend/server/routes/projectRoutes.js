// d:\CODE\water-company\backend\server\routes\projectRoutes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware');
const { CategoryProject, MinorRepairProject, Notification, RejectedProject, User } = require('../models');
const { updateSerialNumbers, populateProjectFields } = require('../utils');
const logger = require('../config/logger'); // Import logger

// Route GET /projects đã được chuyển sang projects.core.routes.js
/*
router.get('/projects', authenticate, async (req, res) => {
  // ... (logic đã được comment out)
});
*/

router.get('/projects/:id/status', authenticate, async (req, res, next) => { // Thêm next
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
    next(error); // Chuyển lỗi cho global error handler
  }
});

// Route POST /projects đã được chuyển sang projects.core.routes.js
/*
router.post('/projects', authenticate, async (req, res, next) => { // Thêm next
  // ... (logic đã được comment out)
});
*/

// Route PATCH /projects/:id đã được chuyển sang projects.core.routes.js
/*
router.patch('/projects/:id', authenticate, async (req, res, next) => { // Thêm next
  // ... (logic đã được comment out)
});
*/

// Route DELETE /projects/:id đã được chuyển sang projects.core.routes.js
/*
router.delete('/projects/:id', authenticate, async (req, res, next) => { // Thêm next
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    const isUserAdmin = req.user.role === 'admin';
    const hasDeletePermission = req.user.permissions.delete;
    const isApprover = req.user.permissions.approve;

    if (isUserAdmin && project.status !== 'Đã duyệt') {
      const projectId = project._id;
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);

      const anyPendingNotification = await Notification.findOne({ projectId: projectId, status: 'pending', type: 'delete', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
      if (anyPendingNotification) {
        anyPendingNotification.status = 'processed';
        await anyPendingNotification.save();
        if (req.io) {
          req.io.emit('notification_processed', anyPendingNotification._id);
          const deletedNotification = new Notification({
            message: `Công trình "${project.name}" đã được xóa bởi admin`,
            type: 'delete',
            projectId: project._id, // Use original project._id for notification context
            projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
            status: 'processed',
            userId: project.createdBy, // Notify the original creator
          });
          await deletedNotification.save();
          req.io.emit('notification', deletedNotification);
        }
      }
      if (req.io) {
        req.io.emit('project_deleted', { projectId: project._id, projectType: type });
      }
      return res.json({ message: 'Admin đã xóa công trình thành công.' });
    }
    else if (isApprover && project.pendingDelete) {
      const projectId = project._id;
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);

      const deleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
      if (deleteNotification) {
        deleteNotification.status = 'processed';
        await deleteNotification.save();
        if (req.io) {
          req.io.emit('notification_processed', deleteNotification._id);
          const deletedNotification = new Notification({
            message: `Yêu cầu xóa công trình "${project.name}" đã được duyệt`,
            type: 'delete',
            projectId: project._id,
            projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
            status: 'processed',
            userId: project.createdBy,
          });
          await deletedNotification.save();
          req.io.emit('notification', deletedNotification);
        }
      }
      if (req.io) {
        req.io.emit('project_deleted', { projectId: project._id, projectType: type });
      }
      return res.json({ message: 'Đã xóa công trình (sau khi duyệt yêu cầu).' });
    }
    else if (hasDeletePermission && (project.enteredBy === req.user.username || req.user.role === 'admin') && project.status === 'Đã duyệt') {
      project.pendingDelete = true;
      await project.save();
      // No need to populate project here as we are just sending a message and limited project info
      const populatedProjectForNotification = { _id: project._id, name: project.name, type };
      const notification = new Notification({
        message: `Yêu cầu xóa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'delete',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'pending',
        userId: req.user.id,
      });
      await notification.save();
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      }
      // Return only necessary info
      return res.json({ message: 'Yêu cầu xóa đã được gửi để chờ duyệt.', project: { _id: project._id, name: project.name, pendingDelete: project.pendingDelete, type } });
    }
    else if (hasDeletePermission && project.status !== 'Đã duyệt') {
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);
      if (req.io) {
        req.io.emit('project_deleted', { projectId: project._id, projectType: type });
      }
      return res.json({ message: 'Đã xóa công trình.' });
    }
    else {
      return res.status(403).json({ message: 'Không có quyền xóa công trình này hoặc gửi yêu cầu xóa.' });
    }
  } catch (error) {
    logger.error("Lỗi API xóa công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});
*/

router.patch('/projects/:id/approve', authenticate, async (req, res, next) => { // Thêm next
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền duyệt' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    let project = await Model.findById(req.params.id); // Use let as project might be reassigned after populate
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    if (project.pendingEdit) {
      const { changes, requestedBy } = project.pendingEdit;
      changes.forEach(change => {
        project[change.field] = change.newValue;
      });
      project.pendingEdit = null;
      project.status = 'Đã duyệt'; // Ensure status is updated if it was pending due to edit
      project.approvedBy = req.user.id; // Set the approver
      project.history.push({
        action: 'edit_approved',
        user: req.user.id,
        timestamp: new Date()
      });
      await project.save({ validateModifiedOnly: true });
      const populatedProject = await populateProjectFields(project); // Sử dụng hàm populateProjectFields đã import

      const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type };
      const notification = new Notification({
        message: `Yêu cầu sửa công trình "${populatedProject.name}" đã được duyệt bởi ${req.user.username}`,
        type: 'edit_approved',
        projectId: populatedProject._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: requestedBy, // Notify the user who requested the edit
      });
      await notification.save();
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
        req.io.emit('project_updated', populatedProject);
      }
      return res.json({ message: 'Yêu cầu sửa đã được duyệt.', project: populatedProject });
    } else if (project.status === 'Chờ duyệt') {
      project.status = 'Đã duyệt';
      project.approvedBy = req.user.id; // Set the approver
      project.history.push({
        action: 'approved',
        user: req.user.id,
        timestamp: new Date()
      });
      await project.save({ validateModifiedOnly: true });
      const populatedProject = await populateProjectFields(project); // Sử dụng hàm populateProjectFields đã import

      const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type };
      const notification = new Notification({
        message: `Công trình "${populatedProject.name}" đã được duyệt bởi ${req.user.username}`,
        type: 'new_approved',
        projectId: populatedProject._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: populatedProject.createdBy._id, // Notify the creator
      });
      await notification.save();
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
        req.io.emit('project_approved', populatedProject);
      }
      return res.json({ message: 'Công trình đã được duyệt.', project: populatedProject });
    } else if (project.pendingDelete) {
      // This logic is now more complex due to the deleteProjectById changes.
      // Approving a delete request means actually deleting the project.
      const projectId = project._id;
      const originalCreator = project.createdBy;
      const projectName = project.name;

      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);
      // Ghi log cho hành động xóa đã được duyệt
      // Không ghi vào history của project vì nó đã bị xóa
      // Notification sẽ là nơi ghi nhận chính
      // logger.info(`Project ${projectId} (type: ${type}) delete approved and deleted by ${req.user.username}`);



      const deleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
      if (deleteNotification) {
        deleteNotification.status = 'processed';
        await deleteNotification.save();
        if (req.io) {
          req.io.emit('notification_processed', deleteNotification._id);
        }
      }
      // Create a new notification for the processed deletion
      const deletedConfirmationNotification = new Notification({
        message: `Yêu cầu xóa công trình "${projectName}" đã được duyệt và công trình đã được xóa.`,
        type: 'delete_approved',
        // projectId: projectId, // projectId might no longer exist, or use a placeholder
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: originalCreator, // Notify the original creator or requester
      });
      await deletedConfirmationNotification.save();

      if (req.io) {
        req.io.emit('notification', deletedConfirmationNotification);
        req.io.emit('project_deleted', { projectId: projectId, projectType: type });
      }
      return res.json({ message: 'Yêu cầu xóa đã được duyệt và công trình đã được xóa.' });
    }
    else {
      return res.status(400).json({ message: 'Không có yêu cầu nào đang chờ duyệt cho công trình này.' });
    }
  } catch (error) {
    logger.error("Lỗi API duyệt công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.patch('/projects/:id/reject', authenticate, async (req, res, next) => { // Thêm next
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền từ chối' });
  try {
    const { type } = req.query;
    const { reason } = req.body;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    if (!reason) return res.status(400).json({ message: 'Lý do từ chối là bắt buộc.' });

    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    const originalProjectId = project._id;
    const originalProjectName = project.name;
    const originalProjectData = project.toObject(); // Get a plain object copy
    const originalCreator = project.createdBy;
    const originalPendingEditRequestedBy = project.pendingEdit ? project.pendingEdit.requestedBy : null;

    if (project.pendingEdit) {
      const requestedBy = project.pendingEdit.requestedBy;
      project.pendingEdit = null; // Clear pending edit
      // Project status remains 'Đã duyệt' or its previous approved state
      project.history.push({
        action: 'edit_rejected',
        user: req.user.id,
        timestamp: new Date()
      });
      await project.save({ validateModifiedOnly: true });
      const populatedProject = await populateProjectFields(project); // Sử dụng hàm populateProjectFields đã import

      const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type };
      const notification = new Notification({
        message: `Yêu cầu sửa công trình "${populatedProject.name}" đã bị từ chối bởi ${req.user.username}. Lý do: ${reason}`,
        type: 'edit_rejected',
        projectId: populatedProject._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: requestedBy, // Notify the user who requested the edit
      });
      await notification.save();
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
        req.io.emit('project_updated', populatedProject); // Emit update as pendingEdit is cleared
      }
      return res.json({ message: 'Yêu cầu sửa đã bị từ chối.', project: populatedProject });
    } else if (project.status === 'Chờ duyệt') {
      // Move to RejectedProject collection and delete from original
      const rejectedData = {
        ...originalProjectData,
        rejectionReason: reason,
        rejectedBy: req.user.id,
        rejectedAt: new Date(),
        originalProjectId: originalProjectId,
        projectType: type
      };
      rejectedData.history = project.history || []; // Chuyển lịch sử cũ
      rejectedData.history.push({
        action: 'rejected', // Hoặc 'new_rejected'
        user: req.user.id,
        timestamp: new Date()
      });
      delete rejectedData._id; // Remove _id to let MongoDB generate a new one for RejectedProject
      delete rejectedData.__v;

      const rejectedProject = new RejectedProject(rejectedData);
      await rejectedProject.save();
      await Model.deleteOne({ _id: originalProjectId });
      await updateSerialNumbers(type); // Update serial numbers as a project is effectively removed

      const notification = new Notification({
        message: `Công trình "${originalProjectName}" đã bị từ chối bởi ${req.user.username}. Lý do: ${reason}`,
        type: 'new_rejected',
        // projectId: originalProjectId, // Project no longer exists in main collection
        originalProjectId: originalProjectId, // Store original ID for reference
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: originalCreator, // Notify the creator
      });
      await notification.save();
      if (req.io) {
        req.io.emit('notification', notification);
        req.io.emit('project_rejected_and_removed', { projectId: originalProjectId, projectType: type, rejectedProject });
      }
      return res.json({ message: 'Công trình đã bị từ chối và chuyển vào danh sách từ chối.', rejectedProject });
    } else if (project.pendingDelete) {
      project.pendingDelete = false; // Clear pending delete
      project.history.push({
        action: 'delete_rejected',
        user: req.user.id,
        timestamp: new Date()
      });
      await project.save({ validateModifiedOnly: true });
      const populatedProject = await populateProjectFields(project); // Sử dụng hàm populateProjectFields đã import

      const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type };
      const notification = new Notification({
        message: `Yêu cầu xóa công trình "${populatedProject.name}" đã bị từ chối bởi ${req.user.username}. Lý do: ${reason}`,
        type: 'delete_rejected',
        projectId: populatedProject._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: originalPendingEditRequestedBy || originalCreator, // Notify the requester or creator
      });
      await notification.save();
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
        req.io.emit('project_updated', populatedProject); // Emit update as pendingDelete is cleared
      }
      return res.json({ message: 'Yêu cầu xóa đã bị từ chối.', project: populatedProject });
    }
    else {
      return res.status(400).json({ message: 'Không có yêu cầu nào đang chờ duyệt để từ chối cho công trình này.' });
    }
  } catch (error) {
    logger.error("Lỗi API từ chối công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.patch('/projects/:id/allocate', authenticate, async (req, res, next) => { // Thêm next
  if (!req.user.permissions.allocate) return res.status(403).json({ message: 'Không có quyền phân bổ' });
  try {
    const { type } = req.query;
    const { constructionUnit, allocationWave } = req.body;
    if (!type || type !== 'category') { // Only category projects can be allocated
      return res.status(400).json({ message: 'Chỉ công trình danh mục mới có thể được phân bổ.' });
    }
    if (!constructionUnit || !allocationWave) {
      return res.status(400).json({ message: 'Đơn vị thi công và Đợt phân bổ là bắt buộc.' });
    }

    const project = await CategoryProject.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status !== 'Đã duyệt') {
      return res.status(400).json({ message: 'Chỉ công trình đã duyệt mới có thể được phân bổ.' });
    }

    project.constructionUnit = constructionUnit;
    project.allocationWave = allocationWave;
    project.status = 'Đã phân bổ'; // Update status
    project.history.push({
      action: 'allocated',
      user: req.user.id,
      timestamp: new Date()
    });
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project); // Sử dụng hàm populateProjectFields đã import

    // Create notification for allocation
    const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type };
    const notification = new Notification({
      message: `Công trình "${populatedProject.name}" đã được phân bổ cho ${constructionUnit} (Đợt: ${allocationWave}) bởi ${req.user.username}.`,
      type: 'allocated',
      projectId: populatedProject._id,
      projectModel: 'CategoryProject',
      status: 'processed',
      userId: populatedProject.createdBy._id, // Notify creator or relevant users
    });
    await notification.save();

    if (req.io) {
      req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      req.io.emit('project_allocated', populatedProject);
    }

    res.json({ message: 'Công trình đã được phân bổ.', project: populatedProject });
  } catch (error) {
    logger.error("Lỗi API phân bổ công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.patch('/projects/:id/assign', authenticate, async (req, res, next) => { // Thêm next
  if (!req.user.permissions.assign) return res.status(403).json({ message: 'Không có quyền giao việc' });
  try {
    const { type } = req.query;
    const { supervisor, estimator } = req.body; // Estimator only for category
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    if (!supervisor) {
      return res.status(400).json({ message: 'Người giám sát là bắt buộc.' });
    }
    if (type === 'category' && !estimator) {
      return res.status(400).json({ message: 'Người dự toán là bắt buộc cho công trình danh mục.' });
    }

    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    // Check if project status allows assignment (e.g., 'Đã duyệt' or 'Đã phân bổ')
    if (!['Đã duyệt', 'Đã phân bổ'].includes(project.status)) {
        return res.status(400).json({ message: `Công trình với trạng thái "${project.status}" không thể giao việc.` });
    }

    project.supervisor = supervisor;
    if (type === 'category') {
      project.estimator = estimator;
    }
    project.history.push({
      action: 'assigned',
      user: req.user.id,
      timestamp: new Date()
    });
    // Optionally update status if needed, e.g., to 'Đang thực hiện'
    // project.status = 'Đang thực hiện'; 
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project); // Sử dụng hàm populateProjectFields đã import

    // Create notification for assignment
    const supervisorUser = await User.findById(supervisor).select('fullName');
    const estimatorUser = type === 'category' && estimator ? await User.findById(estimator).select('fullName') : null;
    let assignMessage = `Công trình "${populatedProject.name}" đã được giao cho Giám sát: ${supervisorUser.fullName}`;
    if (estimatorUser) {
      assignMessage += ` và Dự toán: ${estimatorUser.fullName}`;
    }
    assignMessage += ` bởi ${req.user.username}.`;

    const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type };
    const notification = new Notification({
      message: assignMessage,
      type: 'assigned',
      projectId: populatedProject._id,
      projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      status: 'processed',
      userId: populatedProject.createdBy._id, // Notify creator or relevant users
    });
    await notification.save();

    if (req.io) {
      req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      req.io.emit('project_assigned', populatedProject);
    }

    res.json({ message: 'Công trình đã được giao việc.', project: populatedProject });
  } catch (error) {
    logger.error("Lỗi API giao việc công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

// Get all notifications for the logged-in user
router.get('/notifications', authenticate, async (req, res, next) => { // Thêm next
  try {
    // Fetch notifications where the current user is either the creator of the project
    // or the user who initiated the action (for 'new', 'edit', 'delete' types)
    // or if the user has 'approve' permission (to see all pending requests)

    const userProjects = await Promise.all([
      CategoryProject.find({ createdBy: req.user.id }).select('_id'),
      MinorRepairProject.find({ createdBy: req.user.id }).select('_id')
    ]).then(([catProjects, minorProjects]) => {
      return [...catProjects.map(p => p._id), ...minorProjects.map(p => p._id)];
    });

    let query = {
      $or: [
        { userId: req.user.id }, // Notifications for actions taken by the user
        { projectId: { $in: userProjects } } // Notifications related to projects created by the user
      ]
    };

    // If user is an approver, they should see all pending 'new', 'edit', 'delete' notifications
    if (req.user.permissions.approve) {
      query = {
        $or: [
          ...query.$or,
          { status: 'pending', type: { $in: ['new', 'edit', 'delete'] } }
        ]
      };
    }

    const notifications = await Notification.find(query)
      .populate('userId', 'username fullName')
      .populate({
        path: 'projectId',
        select: 'name type', // Select fields you need from the project
        // Populate 'type' based on projectModel if you store it directly on project
        // For now, we assume 'type' is available or can be inferred
      })
      .sort({ createdAt: -1 })
      .limit(50); // Limit notifications for performance

    // Manually add projectType to projectId if not directly available
    const processedNotifications = notifications.map(notif => {
      const notifObj = notif.toObject();
      if (notifObj.projectId && !notifObj.projectId.type) {
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

// Mark notification as read/processed
router.patch('/notifications/:id/read', authenticate, async (req, res, next) => { // Thêm next
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Không tìm thấy thông báo' });

    // Only allow marking as read if it's not a 'pending' approval type notification
    // or if the user is the one who should act on it (e.g., the approver for pending)
    // For simplicity now, any user involved or admin can mark as read if not 'pending'
    if (notification.status === 'pending' && !req.user.permissions.approve) {
        // A non-approver should not mark pending approval notifications as read
        // unless it's a notification directed at them that isn't an approval task
        if (notification.userId.toString() !== req.user.id.toString()) {
             return res.status(403).json({ message: 'Không có quyền cập nhật thông báo này.' });
        }
    }

    // For 'pending' notifications, 'approve' or 'reject' actions will change status to 'processed'.
    // This route is more for general notifications being marked as 'read' (which we can treat as 'processed' if no 'read' status exists)
    if (notification.status !== 'processed') {
        notification.status = 'processed'; // Or introduce a 'read' status
        await notification.save();
    }

    if (req.io) {
      req.io.emit('notification_processed', notification._id); // Notify clients to remove/update it
    }
    res.json({ message: 'Thông báo đã được đánh dấu là đã xử lý.', notification });
  } catch (error) {
    logger.error("Lỗi API cập nhật thông báo:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});


// Get rejected projects
router.get('/rejected-projects', authenticate, async (req, res, next) => { // Thêm next
  // Tất cả user đều có thể gọi API này, backend sẽ lọc dựa trên quyền và unit
  // if (!req.user.permissions.viewRejected) {
  //   return res.status(403).json({ message: 'Không có quyền xem công trình bị từ chối.' });
  // }
  try {
    const { type, page = 1, limit = 10 } = req.query;
    const query = {};
    if (type) query.projectType = type;

    // Lọc theo unit cho user chi nhánh nếu không có quyền xem chi nhánh khác
    if ((req.user.role === 'staff-branch' || req.user.role === 'manager-branch') && req.user.unit && !req.user.permissions.viewOtherBranchProjects) {
      query.allocatedUnit = req.user.unit;
    }

    const count = await RejectedProject.countDocuments(query);
    const rejectedProjects = await RejectedProject.find(query)
      .populate('rejectedBy', 'username fullName')
      .populate('createdBy', 'username fullName') // Populate original creator
      .sort({ rejectedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.json({
      rejectedProjects,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    logger.error("Lỗi API lấy danh sách công trình bị từ chối:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

// Route để xóa vĩnh viễn một công trình đã bị từ chối
router.delete('/rejected-projects/:id', authenticate, async (req, res, next) => {
  // Chỉ admin mới có quyền xóa vĩnh viễn
  if (!req.user.permissions.delete || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền xóa vĩnh viễn công trình bị từ chối.' });
  }
  try {
    const rejectedProject = await RejectedProject.findByIdAndDelete(req.params.id);
    if (!rejectedProject) {
      return res.status(404).json({ message: 'Không tìm thấy công trình bị từ chối.' });
    }
    res.json({ message: 'Công trình bị từ chối đã được xóa vĩnh viễn.' });
  } catch (error) {
    logger.error("Lỗi API xóa vĩnh viễn công trình bị từ chối:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});


module.exports = router;
