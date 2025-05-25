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

  let canUserApproveThisProject = false;
  if (user.role === 'admin') { // Admin luôn có quyền nếu họ có quyền duyệt chung (mặc định admin có)
    canUserApproveThisProject = user.permissions.approve === true;
  } else { // Người dùng thường
    if (user.permissions.approve) { // User thường phải có quyền duyệt chung trước
      let designatedApproverId = null;
      if (project.pendingEdit && project.pendingEdit.data && project.pendingEdit.data.approvedBy) {
        // Ưu tiên người duyệt được gán cho YC sửa
        designatedApproverId = (project.pendingEdit.data.approvedBy._id || project.pendingEdit.data.approvedBy).toString();
      } else if (project.status === 'Chờ duyệt' && project.approvedBy) {
        // Nếu là duyệt mới, lấy người duyệt của công trình
        designatedApproverId = (project.approvedBy._id || project.approvedBy).toString();
      }
      // Nếu là duyệt yêu cầu xóa, người duyệt là project.approvedBy (người duyệt chính của CT)

      if (designatedApproverId) { // Nếu có người duyệt cụ thể được gán cho công trình
        if (designatedApproverId === user.id.toString()) {
          canUserApproveThisProject = true;
        }
      } else { // Công trình không có người duyệt cụ thể
        canUserApproveThisProject = true; // Ai có quyền approve chung đều được
      }
    }
  }

  if (!canUserApproveThisProject) {
    throw { statusCode: 403, message: 'Bạn không có quyền hoặc không được chỉ định để duyệt yêu cầu này.' };
  }

  let notificationTypeToProcess = null;
  let successMessage = '';
  let eventToEmit = '';
  let notificationForUserType = '';
  let userToNotifyForProcessedResult = null; // Đổi tên biến để rõ ràng hơn

  if (project.pendingEdit) {
    notificationTypeToProcess = 'edit';
    successMessage = 'Yêu cầu sửa đã được duyệt.';
    eventToEmit = 'project_updated';
    notificationForUserType = 'edit_approved';
    userToNotifyForProcessedResult = project.pendingEdit.requestedBy; // Người yêu cầu sửa sẽ nhận thông báo kết quả

    const { changes } = project.pendingEdit;
    // Khi duyệt YC sửa, người duyệt chính của công trình KHÔNG thay đổi,
    // trừ khi YC sửa đó có thay đổi trường 'approvedBy' của công trình.
    let finalProjectApprover = project.approvedBy; 

    changes.forEach(change => {
      project[change.field] = change.newValue;
      if (change.field === 'approvedBy' && change.newValue) {
        // Nếu YC sửa có thay đổi người duyệt chính của công trình
        finalProjectApprover = change.newValue; 
      }
    });
    // Quan trọng: approvedBy trong pendingEdit.data là người duyệt YC SỬA này,
    // không phải là người duyệt chính của công trình sau khi YC sửa được duyệt.
    // Người duyệt chính của công trình chỉ thay đổi nếu YC sửa đó có mục đích thay đổi trường project.approvedBy.
    project.pendingEdit = null;
    project.status = 'Đã duyệt'; // Sau khi duyệt sửa, trạng thái vẫn là Đã duyệt (hoặc trạng thái trước đó nếu khác)
    project.approvedBy = finalProjectApprover; // Cập nhật người duyệt chính của công trình
    project.history.push({ action: 'edit_approved', user: user.id, timestamp: new Date() });

  } else if (project.status === 'Chờ duyệt') {
    notificationTypeToProcess = 'new';
    successMessage = 'Công trình đã được duyệt.';
    eventToEmit = 'project_approved';
    notificationForUserType = 'new_approved';
    userToNotifyForProcessedResult = project.createdBy; // Người tạo công trình sẽ nhận thông báo kết quả

    project.status = 'Đã duyệt';
    project.approvedBy = user.id;
    project.history.push({ action: 'approved', user: user.id, timestamp: new Date() });

  } else if (project.pendingDelete) {
    notificationTypeToProcess = 'delete';
    successMessage = 'Yêu cầu xóa đã được duyệt và công trình đã được xóa.';
    eventToEmit = 'project_deleted';
    notificationForUserType = 'delete_approved';
    const deleteRequestAction = project.history.find(h => h.action === 'delete_requested');
    userToNotifyForProcessedResult = deleteRequestAction ? deleteRequestAction.user : project.createdBy; // Người yêu cầu xóa sẽ nhận thông báo kết quả

    const projectIdToDelete = project._id;
    const originalCreator = project.createdBy;
    const projectName = project.name;

    await Model.deleteOne({ _id: projectIdToDelete });
    await updateSerialNumbers(projectType);

    // Đánh dấu các thông báo pending liên quan đến project này là processed
    const relatedPendingNotifications = await Notification.find({
      projectId: projectIdToDelete, // Hoặc originalProjectId nếu cần
      status: 'pending'
    });
    for (const notif of relatedPendingNotifications) {
      if (notif.status !== 'processed') {
        notif.status = 'processed';
        await notif.save();
        if (io) io.emit('notification_processed', notif._id);
      }
    }

    const deletedConfirmationNotification = new Notification({
      message: `Yêu cầu xóa công trình "${projectName}" đã được duyệt và công trình đã được xóa bởi quản trị viên ${user.username}.`,
      type: notificationForUserType,
      projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      status: 'processed',
      userId: userToNotifyForProcessedResult, 
      originalProjectId: projectIdToDelete, // Lưu ID gốc của project đã xóa
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
  
  // Cập nhật tất cả thông báo pending liên quan đến project này (bao gồm cả cái vừa xử lý ở trên nếu có)
  const allRelatedPendingNotifications = await Notification.find({
    projectId: project._id, // Giữ nguyên projectId
    status: 'pending',      // Chỉ những cái đang pending
    type: notificationTypeToProcess // CHỈ XỬ LÝ NOTIFICATION CÙNG LOẠI VỚI ACTION
  });
  for (const notif of allRelatedPendingNotifications) {
    if (notif.status !== 'processed') {
      notif.status = 'processed';
      await notif.save();
      if (io) io.emit('notification_processed', notif._id);
    }
  }

  if (userToNotifyForProcessedResult) {
      const newProcessedNotification = new Notification({
        message: `Yêu cầu ${notificationTypeToProcess === 'new' ? 'tạo mới' : (notificationTypeToProcess === 'edit' ? 'sửa' : 'xóa')} công trình "${populatedProject.name}" của bạn đã được duyệt bởi ${user.username}.`,
        type: notificationForUserType,
        projectId: populatedProject._id,
        projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        // Đặt status là 'pending' cho thông báo kết quả này
        status: 'pending', // Sẽ được client đánh dấu là 'processed' khi người dùng xem
        userId: userToNotifyForProcessedResult, // Gán đúng userId cho thông báo kết quả
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

  let canUserRejectThisProject = false;
  if (user.role === 'admin') { // Admin luôn có quyền nếu họ có quyền duyệt chung
    canUserRejectThisProject = user.permissions.approve === true;
  } else {
    if (user.permissions.approve) { 
      let designatedApproverId = null;
      if (project.pendingEdit && project.pendingEdit.data && project.pendingEdit.data.approvedBy) {
        designatedApproverId = (project.pendingEdit.data.approvedBy._id || project.pendingEdit.data.approvedBy).toString();
      } else if (project.status === 'Chờ duyệt' && project.approvedBy) {
        designatedApproverId = (project.approvedBy._id || project.approvedBy).toString();
      }
      // Nếu là từ chối yêu cầu xóa, người duyệt là project.approvedBy
      // (Logic này cần đảm bảo project.approvedBy được populate đúng nếu nó là ID)
      // Hoặc, nếu YC xóa có người duyệt riêng thì lấy từ đó. Hiện tại YC xóa không có người duyệt riêng.

      if (designatedApproverId) { // Nếu có người duyệt cụ thể được gán cho công trình
        if (designatedApproverId === user.id.toString()) {
          canUserRejectThisProject = true;
        }
      } else { // Công trình không có người duyệt cụ thể
        canUserRejectThisProject = true;
      }
    }
  }
  if (!canUserRejectThisProject) {
    throw { statusCode: 403, message: 'Bạn không có quyền hoặc không được chỉ định để từ chối yêu cầu này.' };
  }
    if (!reason || reason.trim() === "") {
        throw { statusCode: 400, message: 'Lý do từ chối là bắt buộc.' };
    }

    let notificationTypeToProcess = null;
    let successMessage = '';
    let eventToEmit = 'project_updated';
    let notificationForUserType = '';
    let userToNotifyForProcessedResult = null; // Đổi tên biến

    if (project.pendingEdit) {
      notificationTypeToProcess = 'edit';
      successMessage = 'Yêu cầu sửa đã bị từ chối.';
      notificationForUserType = 'edit_rejected';
      userToNotifyForProcessedResult = project.pendingEdit.requestedBy; // Người yêu cầu sửa

      project.pendingEdit = null;
      project.history.push({ action: 'edit_rejected', user: user.id, timestamp: new Date(), details: { reason } });

    } else if (project.status === 'Chờ duyệt') {
      notificationTypeToProcess = 'new';
      successMessage = 'Công trình đã bị từ chối và chuyển vào danh sách từ chối.';
      eventToEmit = 'project_rejected_and_removed';
      notificationForUserType = 'new_rejected';
      userToNotifyForProcessedResult = project.createdBy; // Người tạo công trình

      const originalProjectData = project.toObject();
      const rejectedData = {
        ...originalProjectData,
        rejectionReason: reason,
        rejectedBy: user.id,
        rejectedAt: new Date(),
        originalProjectId: project._id,
        projectType: projectType,
        actionType: 'new', // Loại hành động gốc bị từ chối
        details: originalProjectData // Lưu lại toàn bộ dữ liệu gốc
      };
      rejectedData.history = project.history || [];
      rejectedData.history.push({ action: 'rejected', user: user.id, timestamp: new Date(), details: { reason } });
      delete rejectedData._id;
      delete rejectedData.__v;

      const rejectedProject = new RejectedProject(rejectedData);
      await rejectedProject.save();
      await Model.deleteOne({ _id: project._id });
      await updateSerialNumbers(projectType);

      // Đánh dấu các thông báo pending liên quan đến project này là processed
      const relatedPendingNotifications = await Notification.find({
        // Tìm theo originalProjectId vì project đã bị xóa khỏi collection chính
        $or: [{ projectId: project._id }, { originalProjectId: project._id }],
        status: 'pending'
      });
      for (const notif of relatedPendingNotifications) {
        if (notif.status !== 'processed') {
          notif.status = 'processed';
          await notif.save();
          if (io) io.emit('notification_processed', notif._id);
        }
      }

      const newProcessedNotification = new Notification({
        message: `Yêu cầu tạo mới công trình "${project.name}" của bạn đã bị từ chối bởi ${user.username}. Lý do: ${reason}`, // Cụ thể hơn cho 'new_rejected'
        type: notificationForUserType,
        originalProjectId: project._id, // Lưu ID gốc
        projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        // Đặt status là 'pending' cho thông báo kết quả này
        status: 'pending', // Sẽ được client đánh dấu là 'processed' khi người dùng xem
        userId: userToNotifyForProcessedResult,
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
      userToNotifyForProcessedResult = deleteRequestAction ? deleteRequestAction.user : project.createdBy; // Người yêu cầu xóa

      project.pendingDelete = false;
      project.history.push({ action: 'delete_rejected', user: user.id, timestamp: new Date(), details: { reason } });
    } else {
      throw { statusCode: 400, message: 'Không có yêu cầu nào đang chờ xử lý để từ chối cho công trình này.' };
    }

    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);
    const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type: projectType };
  
    // Cập nhật tất cả thông báo pending liên quan đến project này
    const allRelatedPendingNotifications = await Notification.find({
      projectId: project._id,
      status: 'pending',
      type: notificationTypeToProcess // CHỈ XỬ LÝ NOTIFICATION CÙNG LOẠI VỚI ACTION
    });
    for (const notif of allRelatedPendingNotifications) {
      if (notif.status !== 'processed') {
        notif.status = 'processed';
        await notif.save();
        if (io) io.emit('notification_processed', notif._id);
      }
    }

    const newProcessedNotification = new Notification({
      message: `Yêu cầu ${notificationTypeToProcess === 'edit' ? 'sửa' : 'xóa'} công trình "${populatedProject.name}" của bạn đã bị từ chối bởi ${user.username}. Lý do: ${reason}`,
      type: notificationForUserType,
      projectId: populatedProject._id,
      projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      // Đặt status là 'pending' cho thông báo kết quả này
      status: 'pending', // Sẽ được client đánh dấu là 'processed' khi người dùng xem
      userId: userToNotifyForProcessedResult, // Gán đúng userId cho thông báo kết quả
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
      constructionTimeline: rejectedProject.details?.constructionTimeline || null, // Thêm constructionTimeline
    };

    delete projectDataToRestore._id;
    delete projectDataToRestore.__v;
    delete projectDataToRestore.createdAt;
    delete projectDataToRestore.updatedAt;
    delete projectDataToRestore.history; // Sẽ tạo history mới
    delete projectDataToRestore.status; // Sẽ đặt status mới
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

    projectDataToRestore.status = 'Đã duyệt'; // Khôi phục và duyệt luôn
    projectDataToRestore.approvedBy = user.id; // Người khôi phục là người duyệt
    projectDataToRestore.createdBy = rejectedProject.createdBy; // Giữ người tạo gốc
    projectDataToRestore.enteredBy = rejectedProject.enteredBy; // Giữ người nhập gốc

    projectDataToRestore.history = [{
      action: 'created',
      user: rejectedProject.createdBy,
      timestamp: rejectedProject.originalCreatedAt || rejectedProject.createdAt, // Ngày tạo gốc
      details: { note: "Khôi phục từ trạng thái bị từ chối." }
    }, {
      action: 'approved',
      user: user.id,
      timestamp: new Date(),
      details: { note: `Khôi phục và duyệt bởi ${user.username}. Lý do từ chối trước đó: ${rejectedProject.rejectionReason}` }
    }];

    const newProject = new Model(projectDataToRestore);
    await newProject.save(); // Điều này sẽ trigger pre-save hook để tạo serialNumber mới

    await RejectedProject.findByIdAndDelete(rejectedProjectId);

    const populatedRestoredProject = await populateProjectFields(newProject);

    const notification = new Notification({
      message: `Công trình "${newProject.name}" đã được khôi phục và duyệt bởi ${user.username}.`,
      type: 'new_approved', // Hoặc một type riêng cho restore nếu cần
      projectId: newProject._id,
      projectModel: rejectedProject.projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      // Đặt status là 'pending' cho thông báo kết quả này
      status: 'pending', // Sẽ được client đánh dấu là 'processed' khi người dùng xem
      userId: newProject.createdBy, // Thông báo cho người tạo gốc
    });
    await notification.save();

    if (io) {
      io.emit('notification', notification.toObject());
      io.emit('project_approved', populatedRestoredProject.toObject()); // Event như duyệt mới
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
  
  let queryConditions = [
    { userId: userId },
    { recipientId: userId }
  ];

  if (user.permissions?.approve) {
    queryConditions.push({ recipientId: { $exists: false } }); // Thông báo chung
  }

  const pendingNotificationsQuery = {
    status: 'pending',
    $or: queryConditions
  };

  const pendingNotifications = await Notification.find(pendingNotificationsQuery)
    .populate({ // Populate project nếu có projectId
        path: 'projectId',
        // select: 'status pendingEdit pendingDelete name projectModel' // Chọn các trường cần thiết
    });

  let processedCount = 0;
  const notificationsToKeepPending = [];

  for (const notif of pendingNotifications) {
    let keepPending = false;
    if (['new', 'edit', 'delete'].includes(notif.type) && notif.projectId) {
      const project = notif.projectId; // Đây là object project đã populate
      if (user.permissions?.approve) {
        // Kiểm tra project có tồn tại không trước khi truy cập thuộc tính
        if (project && project._id) { // Kiểm tra project tồn tại và có _id (đã populate)
            if (notif.type === 'new' && project.status === 'Chờ duyệt') {
            keepPending = true;
            } else if (notif.type === 'edit' && project.pendingEdit) {
            keepPending = true;
            } else if (notif.type === 'delete' && project.pendingDelete) {
            keepPending = true;
            }
        } else {
            // Nếu project không tồn tại (đã bị xóa), thông báo này không còn "actionable"
            // và không nên được giữ lại, trừ khi nó là thông báo 'new' cho project đã bị xóa (trường hợp này không nên xảy ra nhiều)
             logger.warn(`[MarkAllProcessed] Notification ID ${notif._id} (type: ${notif.type}) có projectId nhưng project không tồn tại hoặc không populate được. Sẽ không giữ lại.`);
            // Trong trường hợp này, notification nên được đánh dấu là processed vì không còn project để action.
            // keepPending vẫn sẽ là false.
        }
      }
    }
   
    if (!keepPending) {
      notif.status = 'processed';
      if (notif.projectId && !notif.projectModel) {
        logger.warn(`[MarkAllProcessed] Notification ID ${notif._id} for projectId ${notif.projectId} is missing projectModel. Attempting to determine...`);
        // Kiểm tra xem project có thực sự tồn tại không trước khi cố gắng xác định projectModel
        const projectExistsCategory = await CategoryProject.exists({ _id: notif.projectId });
        const projectExistsMinorRepair = await MinorRepairProject.exists({ _id: notif.projectId });

        const categoryProjectExists = await CategoryProject.exists({ _id: notif.projectId });
        if (categoryProjectExists) {
          notif.projectModel = 'CategoryProject';
          logger.info(`[MarkAllProcessed] Determined projectModel for Notification ID ${notif._id} as CategoryProject.`);
        } else {
          const minorRepairProjectExists = await MinorRepairProject.exists({ _id: notif.projectId });
          if (projectExistsMinorRepair) { // Sửa ở đây
            notif.projectModel = 'MinorRepairProject';
            logger.info(`[MarkAllProcessed] Determined projectModel for Notification ID ${notif._id} as MinorRepairProject.`);
          } else {
            // Nếu project không tồn tại và projectModel bị thiếu, vẫn cố gắng save nếu schema cho phép projectModel là null khi status là 'processed'.
            // Nếu projectModel là bắt buộc, thì không save.
            logger.error(`[MarkAllProcessed] Could not determine projectModel for Notification ID ${notif._id} with projectId ${notif.projectId}. Project does not exist. Status set to processed.`);
            // Nếu schema Notification yêu cầu projectModel, và nó không thể xác định, thì không save.
            // Giả sử schema cho phép projectModel là null nếu status là 'processed' và project không tồn tại.
            // Hoặc, nếu projectModel là bắt buộc, cần đảm bảo nó được giữ lại từ notification gốc khi project bị xóa.
            // Để an toàn, nếu projectModel bắt buộc và không xác định được, không save.
            const isProjectModelRequired = Notification.schema.path('projectModel').isRequired;
            // Với schema mới, projectModel không còn bắt buộc nếu status là 'processed'.
            // Tuy nhiên, nếu project không tồn tại, và chúng ta đang set status = 'processed',
            // thì việc projectModel là null/undefined là chấp nhận được.
            if (isProjectModelRequired && !notif.projectModel && notif.status === 'pending') { // Chỉ kiểm tra nếu vẫn đang cố giữ pending
                logger.warn(`[MarkAllProcessed] Notification ID ${notif._id} is pending, projectModel is required but could not be determined and project does not exist. This should not happen if keepPending is false.`);
                continue; 
            }
          }
        }
      }
      await notif.save(); // Bỏ session vì không có transaction ở đây
      if (io) io.emit('notification_processed', notif._id);
      processedCount++;
    } else {
      notificationsToKeepPending.push(notif._id);
    }
  }
  logger.info(`[MarkAllProcessed] User ${userId}: ${processedCount} thông báo đã được đánh dấu xử lý. ${notificationsToKeepPending.length} thông báo được giữ lại.`);
  return { message: `Đã xử lý ${processedCount} thông báo.`, processedCount, keptPendingCount: notificationsToKeepPending.length };
};

// ... (các hàm khác)

/**
 * Marks view-only notifications for a user as 'processed'.
 * These are typically notifications about the status of their own requests.
 * @param {object} user - The authenticated user object.
 * @param {object} io - Socket.IO instance.
 * @returns {Promise<object>} Result of the operation.
 */
const markViewedNotificationsAsProcessed = async (user, io) => {
  const userId = user.id;
  const relevantTypesForSender = [
    'new_approved', 'edit_approved', 'delete_approved',
    'new_rejected', 'edit_rejected', 'delete_rejected'
  ];

  const notificationsToUpdate = await Notification.find({
    userId: userId, // Thông báo mà user này là người tạo/liên quan
    status: 'pending',    // Chỉ những cái đang pending
    type: { $in: relevantTypesForSender } // Chỉ các loại thông báo kết quả
  });

  if (notificationsToUpdate.length === 0) {
    return { message: 'Không có thông báo nào cần đánh dấu đã xem.', processedCount: 0 };
  }

  const bulkOps = notificationsToUpdate.map(notif => ({
    updateOne: {
      filter: { _id: notif._id },
      update: { $set: { status: 'processed' } }
    }
  }));

  const result = await Notification.bulkWrite(bulkOps);
  const processedCount = result.modifiedCount || 0;

  if (processedCount > 0) {
    // Emit event cho từng notification đã được cập nhật để client có thể xử lý
    notificationsToUpdate.forEach(notif => {
      if (io) io.emit('notification_processed', notif._id.toString());
    });
    logger.info(`[MarkViewedProcessed] User ${userId}: ${processedCount} thông báo "chỉ xem" đã được đánh dấu xử lý.`);
  }
  return { message: `Đã đánh dấu ${processedCount} thông báo đã xem là đã xử lý.`, processedCount };
};

module.exports = {
  getRejectedProjectsList,
  approveProject,
  rejectProject,
  restoreRejectedProject,
  permanentlyDeleteRejectedProject,
  markProjectAsCompleted,
  moveProjectToNextFinancialYear,
  markAllUserNotificationsAsProcessed,
  markViewedNotificationsAsProcessed,
};
