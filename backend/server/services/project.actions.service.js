// d:\CODE\water-company\backend\server\services\project.actions.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, User, Notification, RejectedProject, SerialCounter } = require('../models');
const { userFieldToQuery } = require('./helpers/serviceHelpers'); // Import helper
const { populateProjectFields, updateSerialNumbers } = require('../utils');
const logger = require('../config/logger');

/**
 * Retrieves a list of rejected projects based on query parameters.
 * @param {object} queryParams - Query parameters for filtering, pagination.
 * @param {object} user - The authenticated user object.
 * @returns {Promise<object>} An object containing the list of rejected projects, total count, page, and total pages.
 */
const getRejectedProjectsList = async (queryParams) => {
  const { user, type, page = 1, limit = 10, search, allocatedUnit, requestedBy, rejectedBy, financialYear } = queryParams;
  const query = {};
  if (type) query.projectType = type;
  if (search) query.name = { $regex: search, $options: 'i' };
  if (allocatedUnit) query.allocatedUnit = allocatedUnit; // Filter by allocatedUnit string
  if (financialYear) query.financialYear = parseInt(financialYear, 10);

  if (requestedBy && mongoose.Types.ObjectId.isValid(requestedBy)) {
    query.createdBy = requestedBy; // Filter by createdBy ObjectId
  }

  if (rejectedBy && mongoose.Types.ObjectId.isValid(rejectedBy)) {
    query.rejectedBy = rejectedBy;
  }

  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      query.allocatedUnit = user.unit;
    }
  }

  const count = await RejectedProject.countDocuments(query);
  const rejectedProjectsFromDB = await RejectedProject.find(query)
    .populate('rejectedBy', 'username fullName')
    .populate('createdBy', 'username fullName')
    .sort({ rejectedAt: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  const rejectedProjects = await Promise.all(
    rejectedProjectsFromDB.map(p => populateProjectFields(p, true))
  );

  return {
    rejectedProjects,
    total: count,
    page: parseInt(page),
    pages: Math.ceil(count / parseInt(limit)),
  };
};

/**
 * Approves a project or a pending action (edit/delete) on a project.
 * @param {string} projectId - The ID of the project.
 * @param {string} projectType - The type of project ('category' or 'minor_repair').
 * @param {object} user - The authenticated user performing the action.
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The updated project or result of the action.
 */
const approveProject = async (projectId, projectType, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  let project = await Model.findById(projectId);

  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình' };
  }

  if (!user.permissions.approve) {
      throw { statusCode: 403, message: 'Bạn không có quyền duyệt công trình.' };
  }

  let notificationTypeToProcess = null;
  let successMessage = '';
  let eventToEmit = '';
  let notificationForUserType = '';
  let userToNotify = null;

  if (project.pendingEdit) {
    notificationTypeToProcess = 'edit';
    successMessage = 'Yêu cầu sửa đã được duyệt.';
    eventToEmit = 'project_updated';
    notificationForUserType = 'edit_approved';
    userToNotify = project.pendingEdit.requestedBy;

    const { changes } = project.pendingEdit;
    changes.forEach(change => {
      project[change.field] = change.newValue;
    });
    project.pendingEdit = null;
    project.status = 'Đã duyệt';
    project.approvedBy = user.id;
    project.history.push({ action: 'edit_approved', user: user.id, timestamp: new Date() });

  } else if (project.status === 'Chờ duyệt') {
    notificationTypeToProcess = 'new';
    successMessage = 'Công trình đã được duyệt.';
    eventToEmit = 'project_approved';
    notificationForUserType = 'new_approved';
    userToNotify = project.createdBy;

    project.status = 'Đã duyệt';
    project.approvedBy = user.id;
    project.history.push({ action: 'approved', user: user.id, timestamp: new Date() });

  } else if (project.pendingDelete) {
    notificationTypeToProcess = 'delete';
    successMessage = 'Yêu cầu xóa đã được duyệt và công trình đã được xóa.';
    eventToEmit = 'project_deleted';
    notificationForUserType = 'delete_approved';
    const deleteRequestAction = project.history.find(h => h.action === 'delete_requested');
    userToNotify = deleteRequestAction ? deleteRequestAction.user : project.createdBy;

    const projectIdToDelete = project._id;
    const originalCreator = project.createdBy;
    const projectName = project.name;

    await Model.deleteOne({ _id: projectIdToDelete });
    await updateSerialNumbers(projectType);

    const pendingNotification = await Notification.findOne({ projectId: projectIdToDelete, type: 'delete', status: 'pending' });
    if (pendingNotification) {
        pendingNotification.status = 'processed';
        await pendingNotification.save();
        if (io) io.emit('notification_processed', pendingNotification._id);
    }

    const deletedConfirmationNotification = new Notification({
      message: `Yêu cầu xóa công trình "${projectName}" đã được duyệt và công trình đã được xóa bởi quản trị viên ${user.username}.`,
      type: notificationForUserType,
      projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      status: 'processed',
      userId: userToNotify,
      originalProjectId: projectIdToDelete,
    });
    await deletedConfirmationNotification.save();

    if (io) {
      io.emit('notification', deletedConfirmationNotification.toObject());
      io.emit(eventToEmit, { projectId: projectIdToDelete, projectType: projectType, projectName: projectName });
    }
    return { message: successMessage };

  } else {
    throw { statusCode: 400, message: 'Không có yêu cầu nào đang chờ xử lý cho công trình này.' };
  }

  await project.save({ validateModifiedOnly: true });
  const populatedProject = await populateProjectFields(project);
  const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type: projectType };

  // START: Thêm logic cập nhật tất cả thông báo pending liên quan đến project này
  const relatedPendingNotifications = await Notification.find({
    projectId: project._id,
    status: 'pending'
  });
  for (const notif of relatedPendingNotifications) {
    notif.status = 'processed';
    await notif.save();
    if (io) io.emit('notification_processed', notif._id);
  }
  // END: Thêm logic cập nhật

  if (notificationTypeToProcess && notificationTypeToProcess !== 'delete') {
    const pendingNotification = await Notification.findOne({
      projectId: project._id,
      type: notificationTypeToProcess,
      status: 'pending'
    });
    if (pendingNotification) {
      pendingNotification.status = 'processed';
      await pendingNotification.save();
      if (io) {
        io.emit('notification_processed', pendingNotification._id);
      }
    }
  }

  if (userToNotify) {
      const newProcessedNotification = new Notification({
        message: `Yêu cầu của bạn cho công trình "${populatedProject.name}" đã được duyệt bởi ${user.username}`,
        type: notificationForUserType,
        projectId: populatedProject._id,
        projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: userToNotify,
      });
      await newProcessedNotification.save();
      if (io) {
        io.emit('notification', { ...newProcessedNotification.toObject(), projectId: populatedProjectForNotification });
      }
  }

  if (io && eventToEmit) {
     io.emit(eventToEmit, populatedProject.toObject());
  }

  return { message: successMessage, project: populatedProject.toObject() };
};

/**
 * Rejects a pending action (edit/delete) on a project.
 * @param {string} projectId - The ID of the project.
 * @param {string} projectType - The type of project ('category' or 'minor_repair').
 * @param {string} reason - The reason for rejection.
 * @param {object} user - The authenticated user performing the action.
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The updated project or result of the action.
 */
const rejectProject = async (projectId, projectType, reason, user, io) => {
    const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(projectId);

    if (!project) {
      throw { statusCode: 404, message: 'Không tìm thấy công trình' };
    }

    if (!user.permissions.approve) {
        throw { statusCode: 403, message: 'Bạn không có quyền từ chối công trình.' };
    }

    if (!reason || reason.trim() === "") {
        throw { statusCode: 400, message: 'Lý do từ chối là bắt buộc.' };
    }

    let notificationTypeToProcess = null;
    let successMessage = '';
    let eventToEmit = 'project_updated';
    let notificationForUserType = '';
    let userToNotify = project.createdBy;

    if (project.pendingEdit) {
      notificationTypeToProcess = 'edit';
      successMessage = 'Yêu cầu sửa đã bị từ chối.';
      notificationForUserType = 'edit_rejected';
      userToNotify = project.pendingEdit.requestedBy;

      project.pendingEdit = null;
      project.history.push({ action: 'edit_rejected', user: user.id, timestamp: new Date(), details: { reason } });

    } else if (project.status === 'Chờ duyệt') {
      notificationTypeToProcess = 'new';
      successMessage = 'Công trình đã bị từ chối và chuyển vào danh sách từ chối.';
      eventToEmit = 'project_rejected_and_removed';
      notificationForUserType = 'new_rejected';

      const originalProjectData = project.toObject();
      const rejectedData = {
        ...originalProjectData,
        rejectionReason: reason,
        rejectedBy: user.id,
        rejectedAt: new Date(),
        originalProjectId: project._id,
        projectType: projectType,
        actionType: 'new',
        details: originalProjectData
      };
      rejectedData.history = project.history || [];
      rejectedData.history.push({ action: 'rejected', user: user.id, timestamp: new Date(), details: { reason } });
      delete rejectedData._id;
      delete rejectedData.__v;

      const rejectedProject = new RejectedProject(rejectedData);
      await rejectedProject.save();
      await Model.deleteOne({ _id: project._id });
      await updateSerialNumbers(projectType);

      if (notificationTypeToProcess) {
        const pendingNotification = await Notification.findOne({ projectId: project._id, type: notificationTypeToProcess, status: 'pending' });
        if (pendingNotification) {
          pendingNotification.status = 'processed';
          await pendingNotification.save();
          if (io) io.emit('notification_processed', pendingNotification._id);
        }
      }
  // START: Thêm logic cập nhật tất cả thông báo pending liên quan đến project này
  // (Đặc biệt quan trọng khi từ chối yêu cầu mới, vì project sẽ bị xóa khỏi collection chính)
  const relatedPendingNotificationsAfterReject = await Notification.find({
    originalProjectId: project._id, // Tìm theo originalProjectId nếu project đã bị xóa
    status: 'pending'
  });
  for (const notif of relatedPendingNotificationsAfterReject) {
    notif.status = 'processed';
    await notif.save();
    if (io) io.emit('notification_processed', notif._id);
  }
  // END: Thêm logic cập nhật
      const newProcessedNotification = new Notification({
        message: `Yêu cầu của bạn cho công trình "${project.name}" đã bị từ chối bởi ${user.username}. Lý do: ${reason}`,
        type: notificationForUserType,
        originalProjectId: project._id,
        projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: userToNotify,
      });
      await newProcessedNotification.save();
      if (io) {
        io.emit('notification', newProcessedNotification.toObject());
        io.emit(eventToEmit, { projectId: project._id, projectType: projectType, rejectedProject: rejectedProject.toObject() });
      }
      return { message: successMessage, rejectedProject: rejectedProject.toObject() };

    } else if (project.pendingDelete) {
      notificationTypeToProcess = 'delete';
      successMessage = 'Yêu cầu xóa đã bị từ chối.';
      notificationForUserType = 'delete_rejected';
      const deleteRequestAction = project.history.find(h => h.action === 'delete_requested');
      userToNotify = deleteRequestAction ? deleteRequestAction.user : project.createdBy;

      project.pendingDelete = false;
      project.history.push({ action: 'delete_rejected', user: user.id, timestamp: new Date(), details: { reason } });
    } else {
      throw { statusCode: 400, message: 'Không có yêu cầu nào đang chờ xử lý để từ chối cho công trình này.' };
    }

    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);
    const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type: projectType };

  // START: Thêm logic cập nhật tất cả thông báo pending liên quan đến project này
  const relatedPendingNotificationsAfterRejectAction = await Notification.find({
    projectId: project._id,
    status: 'pending'
  });
  for (const notif of relatedPendingNotificationsAfterRejectAction) {
    notif.status = 'processed';
    await notif.save();
    if (io) io.emit('notification_processed', notif._id);
  }
  // END: Thêm logic cập nhật

    if (notificationTypeToProcess) {
      const pendingNotification = await Notification.findOne({
        projectId: project._id,
        type: notificationTypeToProcess,
        status: 'pending'
      });
      if (pendingNotification) {
        pendingNotification.status = 'processed';
        await pendingNotification.save();
        if (io) {
          io.emit('notification_processed', pendingNotification._id);
        }
      }
    }

    const newProcessedNotification = new Notification({
      message: `Yêu cầu của bạn cho công trình "${populatedProject.name}" đã bị từ chối bởi ${user.username}. Lý do: ${reason}`,
      type: notificationForUserType,
      projectId: populatedProject._id,
      projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      status: 'processed',
      userId: userToNotify,
    });
    await newProcessedNotification.save();

    if (io) {
      io.emit('notification', { ...newProcessedNotification.toObject(), projectId: populatedProjectForNotification });
      io.emit(eventToEmit, populatedProject.toObject());
    }
    return { message: successMessage, project: populatedProject.toObject() };
};

/**
 * Restores a rejected project.
 * @param {string} rejectedProjectId - The ID of the rejected project document.
 * @param {object} user - The authenticated user performing the action.
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The newly created project.
 */
const restoreRejectedProject = async (rejectedProjectId, user, io) => {
    const rejectedProject = await RejectedProject.findById(rejectedProjectId);
    if (!rejectedProject) {
      throw { statusCode: 404, message: 'Không tìm thấy công trình bị từ chối.' };
    }

    if (!user.permissions.approve) {
        throw { statusCode: 403, message: 'Bạn không có quyền khôi phục công trình bị từ chối.' };
    }

    const Model = rejectedProject.projectType === 'category' ? CategoryProject : MinorRepairProject;

    const projectDataToRestore = {
      ...(rejectedProject.details || {}),
      name: rejectedProject.name || rejectedProject.details?.name,
      allocatedUnit: rejectedProject.allocatedUnit || rejectedProject.details?.allocatedUnit,
      location: rejectedProject.location || rejectedProject.details?.location,
      scale: rejectedProject.scale || rejectedProject.details?.scale,
      constructionUnit: rejectedProject.constructionUnit || rejectedProject.details?.constructionUnit,
      allocationWave: rejectedProject.allocationWave || rejectedProject.details?.allocationWave,
      initialValue: rejectedProject.initialValue ?? rejectedProject.details?.initialValue ?? 0,
      taskDescription: rejectedProject.taskDescription || rejectedProject.details?.taskDescription,
      notes: rejectedProject.notes || rejectedProject.details?.notes,
      leadershipApproval: rejectedProject.leadershipApproval || rejectedProject.details?.leadershipApproval,
      reportDate: rejectedProject.reportDate || rejectedProject.details?.reportDate,
      inspectionDate: rejectedProject.inspectionDate || rejectedProject.details?.inspectionDate,
      paymentDate: rejectedProject.paymentDate || rejectedProject.details?.paymentDate,
      paymentValue: rejectedProject.paymentValue ?? rejectedProject.details?.paymentValue ?? 0,
      financialYear: rejectedProject.financialYear ?? rejectedProject.details?.financialYear ?? new Date().getFullYear(), // Restore financialYear
      isCompleted: false, // Reset completion status on restore
      // Restore timeline data if it exists in details (from when it was rejected)
      profileTimeline: rejectedProject.details?.profileTimeline || null,
    };

    delete projectDataToRestore._id;
    delete projectDataToRestore.__v;
    delete projectDataToRestore.createdAt;
    delete projectDataToRestore.updatedAt;
    delete projectDataToRestore.history;
    delete projectDataToRestore.status;
    delete projectDataToRestore.pendingEdit;
    delete projectDataToRestore.pendingDelete;
    delete projectDataToRestore.categorySerialNumber;
    delete projectDataToRestore.minorRepairSerialNumber;

    // Ensure projectType is copied for category projects
    if (rejectedProject.projectType === 'category') {
      projectDataToRestore.projectType = projectDataToRestore.projectType || rejectedProject.details?.projectType || '';
      projectDataToRestore.constructionUnit = rejectedProject.constructionUnit || rejectedProject.details?.constructionUnit || ''; // Also copy constructionUnit for category
    }
    projectDataToRestore.estimator = rejectedProject.estimator || rejectedProject.details?.estimator;
    projectDataToRestore.supervisor = rejectedProject.supervisor || rejectedProject.details?.supervisor;

    projectDataToRestore.status = 'Đã duyệt';
    projectDataToRestore.approvedBy = user.id;
    projectDataToRestore.createdBy = rejectedProject.createdBy;
    projectDataToRestore.enteredBy = rejectedProject.enteredBy;

    projectDataToRestore.history = [{
      action: 'created',
      user: rejectedProject.createdBy,
      timestamp: rejectedProject.originalCreatedAt || rejectedProject.createdAt,
      details: { note: "Khôi phục từ trạng thái bị từ chối." }
    }, {
      action: 'approved',
      user: user.id,
      timestamp: new Date(),
      details: { note: `Khôi phục và duyệt bởi ${user.username}. Lý do từ chối trước đó: ${rejectedProject.rejectionReason}` }
    }];

    const newProject = new Model(projectDataToRestore);
    await newProject.save();

    await RejectedProject.findByIdAndDelete(rejectedProjectId);

    const populatedRestoredProject = await populateProjectFields(newProject);

    const notification = new Notification({
      message: `Công trình "${newProject.name}" đã được khôi phục và duyệt bởi ${user.username}.`,
      type: 'new_approved',
      projectId: newProject._id,
      projectModel: rejectedProject.projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      status: 'processed',
      userId: newProject.createdBy,
    });
    await notification.save();

    if (io) {
      io.emit('notification', notification.toObject());
      io.emit('project_approved', populatedRestoredProject.toObject());
      io.emit('project_rejected_restored', { rejectedId: rejectedProjectId, projectType: rejectedProject.projectType });
    }

    return { message: 'Công trình đã được khôi phục và duyệt thành công.', project: populatedRestoredProject.toObject() };
};

/**
 * Permanently deletes a rejected project document.
 * @param {string} rejectedProjectId - The ID of the rejected project document.
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} A success message.
 */
const permanentlyDeleteRejectedProject = async (rejectedProjectId, io) => {
    const rejectedProject = await RejectedProject.findById(rejectedProjectId);
    if (!rejectedProject) {
      throw { statusCode: 404, message: 'Không tìm thấy công trình bị từ chối.' };
    }

    await RejectedProject.findByIdAndDelete(rejectedProjectId);

    if (io) {
        io.emit('project_rejected_permanently_deleted', { rejectedId: rejectedProjectId, projectType: rejectedProject.projectType });
    }

    return { message: 'Công trình bị từ chối đã được xóa vĩnh viễn.' };
};

/**
 * Marks a project as completed.
 * @param {string} projectId - The ID of the project.
 * @param {string} projectType - The type of project ('category' or 'minor_repair').
 * @param {object} user - The authenticated user performing the action.
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The updated project.
 */
const markProjectAsCompleted = async (projectId, projectType, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình.' };
  }

  if (user.role !== 'admin' && !user.role.includes('manager') && !user.role.includes('director')) {
    throw { statusCode: 403, message: 'Bạn không có quyền đánh dấu hoàn thành công trình này.' };
  }

  if (project.isCompleted) {
    return { message: 'Công trình đã được đánh dấu hoàn thành trước đó.', project: (await populateProjectFields(project)).toObject(), alreadyCompleted: true };
  }

  project.isCompleted = true;
  project.completionMarkedBy = user.id;
  project.completionMarkedAt = new Date();
  project.history.push({
    action: 'completed_marked',
    user: user.id,
    timestamp: new Date(),
    details: { note: `Đánh dấu hoàn thành bởi ${user.username}` }
  });

  await project.save({ validateModifiedOnly: true });
  const populatedProject = await populateProjectFields(project);

  if (io) {
    io.emit('project_updated', { ...populatedProject.toObject(), projectType });
  }

  return { message: 'Công trình đã được đánh dấu hoàn thành.', project: populatedProject.toObject() };
};

/**
 * Moves a project to the next financial year.
 * @param {string} projectId - The ID of the project.
 * @param {string} projectType - The type of project ('category' or 'minor_repair').
 * @param {object} user - The authenticated user performing the action.
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The updated project.
 */
const moveProjectToNextFinancialYear = async (projectId, projectType, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình.' };
  }

  if (user.role !== 'admin' && !user.role.includes('manager') && !user.role.includes('director')) {
    throw { statusCode: 403, message: 'Bạn không có quyền chuyển năm tài chính cho công trình này.' };
  }

  if (project.isCompleted) {
    throw { statusCode: 400, message: 'Không thể chuyển năm cho công trình đã hoàn thành.' };
  }

  const currentYear = project.financialYear;
  project.financialYear = currentYear + 1;
  project.history.push({
    action: 'year_moved',
    user: user.id,
    timestamp: new Date(),
    details: { note: `Chuyển từ năm ${currentYear} sang năm ${project.financialYear} bởi ${user.username}` }
  });

  await project.save({ validateModifiedOnly: true });
  const populatedProject = await populateProjectFields(project);

  if (io) {
    io.emit('project_updated', { ...populatedProject.toObject(), projectType });
  }
  return { message: `Công trình đã được chuyển sang năm tài chính ${project.financialYear}.`, project: populatedProject.toObject() };
};

/**
 * Marks all 'pending' notifications for a user as 'processed',
 * except for those that still require direct action (e.g., pending project approvals
 * AND the current user has permission to act on them).
 * @param {object} user - The authenticated user object (passed from controller, contains ID and permissions).
 * @param {object} io - Socket.IO instance.
 * @returns {Promise<object>} Result of the operation.
 */
const markAllUserNotificationsAsProcessed = async (user, io) => {
  const userId = user.id; // Lấy ID từ object user
  
  const queryConditions = [
    { userId: userId },
    { recipientId: userId }
  ];

  if (user.permissions?.approve) {
    // Nếu user có quyền approve, họ cũng có thể muốn đánh dấu đã đọc các thông báo chung (không có recipientId)
    // hoặc các thông báo mà họ không phải là recipient trực tiếp nhưng vẫn thấy do quyền hạn.
    queryConditions.push({ recipientId: { $exists: false } }); // Thông báo chung
    // Cân nhắc: Có thể cần thêm logic để lấy các thông báo mà user này có quyền xem nhưng không phải là recipientId
  }

  const pendingNotificationsQuery = {
    status: 'pending',
    $or: queryConditions
  };

  const pendingNotifications = await Notification.find(pendingNotificationsQuery)
    .populate('projectId'); // Populate projectId để kiểm tra trạng thái công trình

  let processedCount = 0;
  const notificationsToKeepPending = [];

  for (const notif of pendingNotifications) {
    let keepPending = false;
    // Kiểm tra nếu là thông báo yêu cầu duyệt (new, edit, delete)
    // và công trình liên quan vẫn còn đang ở trạng thái chờ duyệt tương ứng
    // VÀ người dùng hiện tại có quyền duyệt
    if (['new', 'edit', 'delete'].includes(notif.type) && notif.projectId) {
      const project = notif.projectId; // Đã populate
      // Chỉ giữ lại nếu người dùng có quyền duyệt VÀ công trình thực sự đang chờ
      if (user.permissions?.approve) {
        if (notif.type === 'new' && project.status === 'Chờ duyệt') {
          keepPending = true;
        } else if (notif.type === 'edit' && project.pendingEdit) {
          keepPending = true;
        } else if (notif.type === 'delete' && project.pendingDelete) {
          keepPending = true;
        }
      }
    }
    // Nếu không phải là thông báo yêu cầu duyệt, hoặc người dùng không có quyền duyệt,
    // Các loại thông báo khác (ví dụ: 'allocated', 'assigned', hoặc các thông báo thông tin)
    // hoặc các thông báo 'new', 'edit', 'delete' mà user không có quyền duyệt
    // sẽ không được `keepPending = true` ở đây, do đó sẽ được đánh dấu là processed.

    if (!keepPending) {
      notif.status = 'processed';
      // Đảm bảo projectModel tồn tại và đúng nếu có projectId
      if (notif.projectId && !notif.projectModel) {
        logger.warn(`[MarkAllProcessed] Notification ID ${notif._id} for projectId ${notif.projectId} is missing projectModel. Attempting to determine...`);
        const categoryProjectExists = await CategoryProject.exists({ _id: notif.projectId });
        if (categoryProjectExists) {
          notif.projectModel = 'CategoryProject';
          logger.info(`[MarkAllProcessed] Determined projectModel for Notification ID ${notif._id} as CategoryProject.`);
        } else {
          const minorRepairProjectExists = await MinorRepairProject.exists({ _id: notif.projectId });
          if (minorRepairProjectExists) {
            notif.projectModel = 'MinorRepairProject';
            logger.info(`[MarkAllProcessed] Determined projectModel for Notification ID ${notif._id} as MinorRepairProject.`);
          } else {
            logger.error(`[MarkAllProcessed] Could not determine projectModel for Notification ID ${notif._id} with projectId ${notif.projectId}. Project does not exist in either collection. Notification will likely fail to save.`);
            // Nếu không xác định được projectModel và nó là bắt buộc,
            // chúng ta không nên cố gắng save() vì sẽ gây lỗi validation.
            // Bỏ qua việc cập nhật thông báo này.
            notificationsToKeepPending.push(notif._id); // Coi như giữ lại hoặc bỏ qua
            logger.warn(`[MarkAllProcessed] Skipped saving Notification ID ${notif._id} due to missing/invalid projectModel and non-existent project.`);
            continue; // Chuyển sang thông báo tiếp theo
          }
        }
      }
      // Chỉ lưu nếu projectModel hợp lệ (hoặc không có projectId để bắt đầu)
      if (notif.projectId && !notif.projectModel) { /* Đã continue ở trên nếu không xác định được */ }
      else { await notif.save(); }
      if (io) io.emit('notification_processed', notif._id);
      processedCount++;
    } else {
      notificationsToKeepPending.push(notif._id);
    }
  }
  logger.info(`[MarkAllProcessed] User ${userId}: ${processedCount} thông báo đã được đánh dấu xử lý. ${notificationsToKeepPending.length} thông báo được giữ lại.`);
  return { message: `Đã xử lý ${processedCount} thông báo.`, processedCount, keptPendingCount: notificationsToKeepPending.length };
};


module.exports = {
  getRejectedProjectsList,
  approveProject,
  rejectProject,
  restoreRejectedProject,
  permanentlyDeleteRejectedProject,
  markProjectAsCompleted,
  moveProjectToNextFinancialYear,
  markAllUserNotificationsAsProcessed, // Export hàm mới
};