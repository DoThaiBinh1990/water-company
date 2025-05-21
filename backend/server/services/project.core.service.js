// d:\CODE\water-company\backend\server\services\project.core.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, User, SerialCounter, Notification } = require('../models');
const { populateProjectFields, updateSerialNumbers, areDatesEqual } = require('../utils');
const logger = require('../config/logger');
const Joi = require('joi');
const { userFieldToQuery } = require('./helpers/serviceHelpers');

/**
 * Retrieves a list of projects based on query parameters.
 * @param {object} queryParams - Query parameters for filtering, pagination, and sorting.
 * @param {object} user - The authenticated user object.
 * @returns {Promise<object>} An object containing the list of projects, total count, page, and total pages.
 */
const getProjectsList = async (queryParams) => {
  const { user, type = 'category', page = 1, limit = 10, status, allocatedUnit, constructionUnit, allocationWave, assignedTo, search, minInitialValue, maxInitialValue, progress, pending, supervisor, estimator, reportDate, financialYear, isCompleted } = queryParams;
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;
  const query = {};

  if (allocatedUnit) query.allocatedUnit = allocatedUnit;
  if (constructionUnit && type === 'category') query.constructionUnit = constructionUnit;
  if (allocationWave && type === 'category') query.allocationWave = allocationWave;
  if (assignedTo) {
    const userAssigned = await userFieldToQuery(assignedTo);
    if (userAssigned) query.assignedTo = userAssigned;
    else query.assignedTo = null;
  }
  if (search) query.name = { $regex: search, $options: 'i' };
  if (reportDate && type === 'minor_repair') query.reportDate = new Date(reportDate);

  if (financialYear) {
    query.financialYear = parseInt(financialYear, 10);
  }

  query.isCompleted = (isCompleted === 'true' || isCompleted === true);

  if (queryParams.projectType && type === 'category') {
    query.projectType = queryParams.projectType;
  }

  if (type === 'category') {
    if (minInitialValue || maxInitialValue) {
      query.initialValue = {};
      if (minInitialValue) query.initialValue.$gte = parseFloat(minInitialValue);
      if (maxInitialValue) query.initialValue.$lte = parseFloat(maxInitialValue);
    }
    if (progress) query.progress = progress;
  }

  if (pending === 'true' || pending === true) {
    query.$or = [
      { status: 'Chờ duyệt' },
      { pendingEdit: { $ne: null, $exists: true } },
      { pendingDelete: true }
    ];
  } else {
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['Đã duyệt', 'Đã phân bổ', 'Đang thực hiện', 'Hoàn thành'] };
    }
  }

  if (supervisor) {
    const supervisorId = await userFieldToQuery(supervisor);
    if (supervisorId) query.supervisor = supervisorId;
    else query.supervisor = null;
  }
  if (estimator && type === 'category') {
    const estimatorId = await userFieldToQuery(estimator);
    if (estimatorId) query.estimator = estimatorId;
    else query.estimator = null;
  }

  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      if (query.$or) {
        query.$or.forEach(condition => {
            if (!condition.allocatedUnit) {
                condition.allocatedUnit = user.unit;
            }
        });
      } else {
        query.allocatedUnit = user.unit;
      }
    }
  }

  const count = await Model.countDocuments(query);
  const projectsFromDB = await Model.find(query)
    .populate('createdBy', 'username fullName')
    .populate('approvedBy', 'username fullName')
    .populate('supervisor', 'username fullName')
    .populate(type === 'category' ? { path: 'estimator', select: 'username fullName' } : '')
    .populate({ path: 'pendingEdit.requestedBy', select: 'username fullName' })
    .populate({ path: 'history.user', select: 'username fullName' })
    .sort({ createdAt: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  const projects = await Promise.all(
    projectsFromDB.map(p => populateProjectFields(p))
  );

  return {
    projects,
    total: count,
    page: parseInt(page),
    pages: Math.ceil(count / parseInt(limit)),
  };
};

/**
 * Creates a new project.
 * @param {object} projectData - The data for the new project.
 * @param {object} user - The authenticated user creating the project.
 * @param {string} projectType - The type of project ('category' or 'minor_repair').
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The newly created project and status.
 */
const createNewProject = async (projectData, user, projectType, io) => {
  const { name, allocatedUnit, location, approvedBy: approvedByInput, scale, reportDate, supervisor: supervisorInput, estimator: estimatorInput, financialYear, ...restData } = projectData;

  if (!name || !allocatedUnit || !location || !financialYear) {
    throw { statusCode: 400, message: 'Tên công trình, Đơn vị phân bổ, Địa điểm và Năm tài chính là bắt buộc.' };
  }
  if (projectType === 'minor_repair' && (!scale || !reportDate)) {
    throw { statusCode: 400, message: 'Quy mô và Ngày xảy ra sự cố là bắt buộc cho công trình sửa chữa nhỏ.' };
  }
  if (projectType === 'category' && !scale) {
    throw { statusCode: 400, message: 'Quy mô là bắt buộc cho công trình danh mục.' };
  }

  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;

  const dataToSave = {
    name, allocatedUnit, location, scale,
    ...restData,
    financialYear: parseInt(financialYear, 10),
    enteredBy: user.username,
    createdBy: user.id,
  };

  if (projectType === 'minor_repair') {
    dataToSave.reportDate = reportDate;
  }

  if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
    if (dataToSave.allocatedUnit !== user.unit) {
      if (!user.permissions.viewOtherBranchProjects) {
        throw { statusCode: 403, message: `Bạn chỉ có thể tạo công trình cho chi nhánh ${user.unit}.` };
      }
    }
  } else if (!user.role.includes('admin') && !user.role.includes('office') && !user.role.includes('director')) {
    if (!user.unit) throw { statusCode: 403, message: 'Tài khoản của bạn chưa được gán đơn vị, không thể tạo công trình.' };
  }

  if (dataToSave.financialYear && isNaN(parseInt(dataToSave.financialYear, 10))) {
    throw { statusCode: 400, message: 'Năm tài chính không hợp lệ.' };
  }

  dataToSave.history = [{
    action: 'created',
    user: user.id,
    timestamp: new Date()
  }];

  let isPending = true;

  if (user.role === 'admin') {
    dataToSave.status = 'Đã duyệt';
    dataToSave.approvedBy = user.id;
    dataToSave.history.push({ action: 'approved', user: user.id, timestamp: new Date(), details: "Admin direct creation" });
    isPending = false; // Admin tạo thì không pending
  } else {
    dataToSave.status = 'Chờ duyệt';
    if (!approvedByInput) {
        throw { statusCode: 400, message: 'Người phê duyệt là bắt buộc cho công trình mới.' };
    }
    const approver = await User.findById(approvedByInput);
    if (!approver || !approver.permissions.approve) {
        throw { statusCode: 400, message: 'Người duyệt không hợp lệ hoặc không có quyền duyệt.' };
    }
    dataToSave.approvedBy = approver._id; // Lưu ObjectId của người duyệt
  }

  if (supervisorInput) {
    if (mongoose.Types.ObjectId.isValid(supervisorInput)) {
      const supervisorUser = await User.findById(supervisorInput);
      if (supervisorUser) dataToSave.supervisor = supervisorUser._id;
      else dataToSave.supervisor = null;
    } else {
      dataToSave.supervisor = null;
    }
  } else {
    dataToSave.supervisor = null;
  }

  if (projectType === 'category' && estimatorInput) {
    if (mongoose.Types.ObjectId.isValid(estimatorInput)) {
      const estimatorUser = await User.findById(estimatorInput);
      if (estimatorUser) dataToSave.estimator = estimatorUser._id;
      else dataToSave.estimator = null;
    } else {
      dataToSave.estimator = null;
    }
  } else if (projectType === 'category') {
    dataToSave.estimator = null;
  }

  delete dataToSave.type;

  const project = new Model(dataToSave);
  let newProject = await project.save();
  newProject = await populateProjectFields(newProject);

  const populatedProjectForNotification = { _id: newProject._id, name: newProject.name, type: projectType };

  if (isPending) {
    const newProjectNotification = new Notification({
      message: `Yêu cầu thêm công trình mới "${newProject.name}" đã được gửi để duyệt`,
      type: 'new',
      projectId: newProject._id,
      projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      status: 'pending',
      userId: user.id,
      recipientId: dataToSave.approvedBy
    });
    await newProjectNotification.save();
    if (io) {
      io.emit('notification', { ...newProjectNotification.toObject(), projectId: populatedProjectForNotification });
    } else {
      logger.warn('Socket.IO không được khởi tạo trong service, bỏ qua gửi thông báo cho công trình chờ duyệt.');
    }
    return { message: 'Công trình đã được gửi để duyệt!', project: newProject.toObject(), pending: true };
  } else {
    if (io) {
      io.emit('project_updated', { ...newProject.toObject(), projectType });
    }
    return { message: 'Công trình đã được tạo và duyệt bởi Admin!', project: newProject.toObject(), pending: false };
  }
};

/**
 * Updates an existing project by ID.
 * @param {string} projectId - The ID of the project to update.
 * @param {string} projectType - The type of project ('category' or 'minor_repair').
 * @param {object} updateData - The data to update the project with.
 * @param {object} user - The authenticated user performing the update.
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The updated project and status.
 */
const updateProjectById = async (projectId, projectType, updateData, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình' };
  }

  if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
    if (project.allocatedUnit !== user.unit && !user.permissions.viewOtherBranchProjects) {
      throw { statusCode: 403, message: `Bạn chỉ có thể sửa công trình thuộc chi nhánh ${user.unit}.` };
    }
  }

  const isUserAdmin = user.role === 'admin';
  const isCreator = project.createdBy.toString() === user.id.toString();

  const currentUpdateData = { ...updateData };
  const forbiddenFields = ['createdBy', 'enteredBy', 'categorySerialNumber', 'minorRepairSerialNumber', 'status', 'pendingEdit', 'pendingDelete', 'history'];

  // Chỉ admin mới được sửa approvedBy của project đã duyệt (hoặc chưa duyệt)
  // User thường không được sửa approvedBy
  if (!isUserAdmin) {
      forbiddenFields.push('approvedBy');
  } // Nếu project đã duyệt, user thường cũng không được sửa approvedBy
  forbiddenFields.forEach(field => delete currentUpdateData[field]);

  if (currentUpdateData.hasOwnProperty('supervisor')) {
    if (currentUpdateData.supervisor === '' || !mongoose.Types.ObjectId.isValid(currentUpdateData.supervisor)) {
      currentUpdateData.supervisor = null;
    } else {
      const supervisorUser = await User.findById(currentUpdateData.supervisor);
      if (!supervisorUser) currentUpdateData.supervisor = null;
    }
  }
  if (projectType === 'category' && currentUpdateData.hasOwnProperty('estimator')) {
    if (currentUpdateData.estimator === '' || !mongoose.Types.ObjectId.isValid(currentUpdateData.estimator)) {
      currentUpdateData.estimator = null;
    } else {
      const estimatorUser = await User.findById(currentUpdateData.estimator);
      if (!estimatorUser) currentUpdateData.estimator = null;
    }
  }
  if (currentUpdateData.hasOwnProperty('approvedBy')) {
    if (currentUpdateData.approvedBy && !mongoose.Types.ObjectId.isValid(currentUpdateData.approvedBy)) {
        throw { statusCode: 400, message: 'Người phê duyệt là bắt buộc và phải là ID hợp lệ khi cập nhật.' };
    }
    const newApprover = await User.findById(currentUpdateData.approvedBy);
    if (!newApprover || !newApprover.permissions.approve) {
        throw { statusCode: 400, message: 'Người phê duyệt mới không hợp lệ hoặc không có quyền duyệt.' };
    }
  }
  if (currentUpdateData.financialYear && isNaN(parseInt(currentUpdateData.financialYear, 10))) {
    throw { statusCode: 400, message: 'Năm tài chính không hợp lệ.' };
  }

  if (isUserAdmin) {
    const originalStatus = project.status;
    // const originalApprovedBy = project.approvedBy; // Không cần thiết vì admin có thể thay đổi

    Object.assign(project, currentUpdateData);

    let action = 'edited';
    let notificationMessage = `Công trình "${project.name}" đã được cập nhật bởi quản trị viên ${user.username}.`;
    let notifyUserTarget = project.createdBy; // Default notify creator
    let notificationActionType = 'edit'; // For notification type

    // Case 1: Admin approves a pending project by changing status or approvedBy to self
    if (originalStatus === 'Chờ duyệt' && (currentUpdateData.status === 'Đã duyệt' || (currentUpdateData.approvedBy && currentUpdateData.approvedBy.toString() === user.id.toString()))) {
        project.status = 'Đã duyệt';
        if (!project.approvedBy || project.approvedBy.toString() !== user.id.toString()) {
            project.approvedBy = user.id; // Admin becomes approver if not already
        }
        action = 'approved';
        notificationMessage = `Công trình "${project.name}" đã được duyệt bởi quản trị viên ${user.username}.`;
        notificationActionType = 'new_approved';
    }
    // Case 2: Admin edits an already approved project
    else if (originalStatus === 'Đã duyệt') {
      // Message and notifyUserTarget are already set for general update
    }
    // Case 3: Admin edits a pending project, but it remains pending
    else if (originalStatus === 'Chờ duyệt' && project.status === 'Chờ duyệt') {
      notificationMessage = `Công trình "${project.name}" (đang chờ duyệt bởi ${project.approvedBy?.fullName || project.approvedBy?.username || 'N/A'}) đã được cập nhật bởi quản trị viên ${user.username}. Vui lòng kiểm tra.`;
      notifyUserTarget = project.approvedBy || project.createdBy; // Notify original approver or creator
    }

    project.pendingEdit = null;
    project.history.push({ action, user: user.id, timestamp: new Date(), details: { changes: project.pendingEdit?.changes || 'Admin direct edit' } });
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);

    // Send notification
    if (notifyUserTarget && notifyUserTarget.toString() !== user.id.toString()) {
        const adminUpdateNotification = new Notification({
            message: notificationMessage,
            type: notificationActionType,
            projectId: populatedProject._id,
            projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
            status: 'processed', // Admin actions are final
            userId: notifyUserTarget, // Recipient is the user to be notified
        });
        await adminUpdateNotification.save();
        if (io) io.emit('notification', { ...adminUpdateNotification.toObject(), projectId: { _id: populatedProject._id, name: populatedProject.name, type: projectType } });
    }

    if (io) io.emit(action === 'approved' ? 'project_approved' : 'project_updated', { ...populatedProject.toObject(), projectType });
    return { message: 'Công trình đã được cập nhật bởi Admin.', project: populatedProject.toObject(), updated: true, pending: false };
  }

  if (user.permissions.edit) {
    const canEditDirectlyUnapproved = isCreator && project.status !== 'Đã duyệt';

    if (project.status !== 'Đã duyệt') { // Project is NOT approved
      if (canEditDirectlyUnapproved) { // Creator edits unapproved project
        Object.assign(project, currentUpdateData);
        project.history.push({ action: 'edited', user: user.id, timestamp: new Date(), details: { note: 'User edit while pending approval' } });
        await project.save({ validateModifiedOnly: true });
        const populatedProjectDirectEdit = await populateProjectFields(project);

        if (project.approvedBy && project.approvedBy.toString() !== user.id.toString()) {
            const directEditNotification = new Notification({
                message: `Công trình "${project.name}" đang chờ duyệt đã được cập nhật bởi ${user.username}. Vui lòng kiểm tra.`,
                type: 'edit',
                projectId: project._id,
                projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending',
                userId: user.id,
                recipientId: project.approvedBy // Notify the original approver
            });
            await directEditNotification.save();
            if (io) io.emit('notification', { ...directEditNotification.toObject(), projectId: { _id: project._id, name: project.name, type: projectType } });
        }
        if (io) io.emit('project_updated', { ...populatedProjectDirectEdit.toObject(), projectType }); // Emit project_updated for frontend list update
        return { message: 'Công trình (chưa duyệt) đã được cập nhật.', project: populatedProjectDirectEdit.toObject(), updated: true, pending: true };
      } else { // Non-creator edits unapproved project -> request edit
        const changesArray = [];
        for (const field in currentUpdateData) {
          if (Object.prototype.hasOwnProperty.call(currentUpdateData, field)) {
            const projectFieldValue = project[field];
            const updateFieldValue = currentUpdateData[field];

            let changed = false;
            if (['reportDate', 'inspectionDate', 'paymentDate', 'startDate', 'completionDate'].includes(field)) {
              if (!areDatesEqual(projectFieldValue, updateFieldValue)) {
                changed = true;
              }
            } else {
              const val1 = projectFieldValue instanceof mongoose.Types.ObjectId ? String(projectFieldValue) : projectFieldValue;
              const val2 = updateFieldValue instanceof mongoose.Types.ObjectId ? String(updateFieldValue) : updateFieldValue;

              const normalizedVal1 = (val1 === null || val1 === undefined) ? "" : (typeof val1 === 'boolean' ? val1 : String(val1));
              const normalizedVal2 = (val2 === null || val2 === undefined) ? "" : (typeof val2 === 'boolean' ? val2 : String(val2));
              if (normalizedVal1 !== normalizedVal2) changed = true;
            }
            if (changed) {
              changesArray.push({ field, oldValue: project[field], newValue: updateFieldValue });
            }
          }
        }
        if (changesArray.length === 0) {
          const populatedNoChangeProject = await populateProjectFields(project);
          return { message: 'Không có thay đổi nào được ghi nhận để yêu cầu sửa.', project: populatedNoChangeProject.toObject(), updated: false, pending: true };
        }
        project.pendingEdit = { data: currentUpdateData, changes: changesArray, requestedBy: user.id, requestedAt: new Date() };
        project.history.push({ action: 'edit_requested', user: user.id, timestamp: new Date(), details: { changes: changesArray, note: 'Edit request on unapproved project by non-creator' } });
        await project.save({ validateModifiedOnly: true });
        const populatedProjectRequestEditUnapproved = await populateProjectFields(project);

        if (project.approvedBy) {
            const requestEditUnapprovedNotification = new Notification({
                message: `Yêu cầu sửa công trình "${populatedProjectRequestEditUnapproved.name}" (chưa duyệt) bởi ${user.username}`,
                type: 'edit', projectId: populatedProjectRequestEditUnapproved._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'pending', userId: user.id,
                recipientId: project.approvedBy
            });
            await requestEditUnapprovedNotification.save();
            if (io) io.emit('notification', { ...requestEditUnapprovedNotification.toObject(), projectId: { _id: populatedProjectRequestEditUnapproved._id, name: populatedProjectRequestEditUnapproved.name, type: projectType } });
        }
        if (io) io.emit('project_updated', { ...populatedProjectRequestEditUnapproved.toObject(), projectType }); // Emit project_updated for frontend list update
        return { message: 'Yêu cầu sửa công trình (chưa duyệt) đã được gửi để chờ duyệt.', project: populatedProjectRequestEditUnapproved.toObject(), updated: true, pending: true };
      }
    } else { // Project IS approved -> request edit
    //   if (canRequestEditApproved) { // This condition is implicitly true if user.permissions.edit is true and project is approved
        const changesArray = [];
        for (const field in currentUpdateData) {
          if (Object.prototype.hasOwnProperty.call(currentUpdateData, field)) {
            const projectFieldValue = project[field];
            const updateFieldValue = currentUpdateData[field]; // Ensure this is the correct value

            let changed = false;
            if (['reportDate', 'inspectionDate', 'paymentDate', 'startDate', 'completionDate'].includes(field)) {
              if (!areDatesEqual(projectFieldValue, updateFieldValue)) {
                changed = true;
              }
            } else {
              const val1 = projectFieldValue instanceof mongoose.Types.ObjectId ? String(projectFieldValue) : projectFieldValue;
              const val2 = updateFieldValue instanceof mongoose.Types.ObjectId ? String(updateFieldValue) : updateFieldValue;

              const normalizedVal1 = (val1 === null || val1 === undefined) ? "" : (typeof val1 === 'boolean' ? val1 : String(val1));
              const normalizedVal2 = (val2 === null || val2 === undefined) ? "" : (typeof val2 === 'boolean' ? val2 : String(val2));
              if (normalizedVal1 !== normalizedVal2) changed = true;
            }

            if (changed) {
              changesArray.push({ field, oldValue: project[field], newValue: updateFieldValue });
            }
          }
        }

        if (changesArray.length === 0) {
          const populatedNoChangeProject = await populateProjectFields(project);
          return { message: 'Không có thay đổi nào được ghi nhận để yêu cầu sửa.', project: populatedNoChangeProject.toObject(), updated: false, pending: false };
        }

        project.pendingEdit = { data: currentUpdateData, changes: changesArray, requestedBy: user.id, requestedAt: new Date() };
        project.history.push({ action: 'edit_requested', user: user.id, timestamp: new Date(), details: { changes: changesArray } });
        await project.save({ validateModifiedOnly: true });
        const populatedProjectRequestEditApproved = await populateProjectFields(project);

        if (project.approvedBy) {
            const populatedProjectForNotification = { _id: populatedProjectRequestEditApproved._id, name: populatedProjectRequestEditApproved.name, type: projectType };
            const requestEditApprovedNotification = new Notification({
              message: `Yêu cầu sửa công trình "${populatedProjectRequestEditApproved.name}" bởi ${user.username}`,
              type: 'edit', projectId: populatedProjectRequestEditApproved._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'pending', userId: user.id,
              recipientId: project.approvedBy
            });
            await requestEditApprovedNotification.save();
            if (io) io.emit('notification', { ...requestEditApprovedNotification.toObject(), projectId: populatedProjectForNotification });
        }
        if (io) io.emit('project_updated', { ...populatedProjectRequestEditApproved.toObject(), projectType }); // Emit project_updated for frontend list update
        return { message: 'Yêu cầu sửa đã được gửi để chờ duyệt.', project: populatedProjectRequestEditApproved.toObject(), updated: true, pending: true };
    //   } else { // Should not be reached if user.permissions.edit is true
    //     throw { statusCode: 403, message: 'Không có quyền yêu cầu sửa công trình này.' };
    //   }
    }
  }

  throw { statusCode: 403, message: 'Không có quyền sửa công trình này hoặc gửi yêu cầu sửa.' };
};

/**
 * Deletes a project by ID.
 * @param {string} projectId - The ID of the project to delete.
 * @param {string} projectType - The type of project ('category' or 'minor_repair').
 * @param {object} user - The authenticated user performing the delete.
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The result of the delete operation.
 */
const deleteProjectById = async (projectId, projectType, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình để xóa.' };
  }
  const originalProjectName = project.name;
  const originalCreatorId = project.createdBy; // ObjectId
  const originalApproverId = project.approvedBy; // ObjectId or null

  if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
    if (project.allocatedUnit !== user.unit && !user.permissions.viewOtherBranchProjects) {
      throw { statusCode: 403, message: `Bạn chỉ có thể thao tác với công trình thuộc chi nhánh ${user.unit}.` };
    }
  }

  if (user.role === 'admin') {
    await Model.deleteOne({ _id: projectId });
    await updateSerialNumbers(projectType);
    // Notify if there was a pending delete request for this project
    const pendingDeleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending', projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (pendingDeleteNotification) {
        pendingDeleteNotification.status = 'processed';
        await pendingDeleteNotification.save();
        if (io) io.emit('notification_processed', pendingDeleteNotification._id);
    }
    const adminDeleteConfirmationNotification = new Notification({
        message: `Công trình "${originalProjectName}" đã được xóa bởi quản trị viên ${user.username}.`,
        type: 'delete_approved',
        projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: originalCreatorId,
        originalProjectId: projectId,
    });
    await adminDeleteConfirmationNotification.save();
    if (io) {
        io.emit('notification', { ...adminDeleteConfirmationNotification.toObject(), projectId: { _id: projectId, name: originalProjectName, type: projectType } });
        io.emit('project_deleted', { projectId: projectId, projectType: projectType, projectName: originalProjectName });
    }
    return { message: `Công trình "${originalProjectName}" đã được xóa bởi Admin.`, pendingDelete: false };
  }

  if (user.permissions.delete) {
    const isCreator = project.createdBy.toString() === user.id.toString();
    const canPerformDirectDeleteUnapproved = isCreator && project.status !== 'Đã duyệt';

    if (project.status !== 'Đã duyệt') { // Project is NOT approved
        if (canPerformDirectDeleteUnapproved) { // Creator deletes unapproved project
            await Model.deleteOne({ _id: projectId });
            await updateSerialNumbers(projectType);
            const directDeleteNotification = new Notification({
                message: `Công trình "${originalProjectName}" (chưa duyệt) đã được xóa bởi ${user.username}.`,
                type: 'delete_approved',
                projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'processed',
                userId: originalApproverId || originalCreatorId, // Notify approver if exists, else creator
                originalProjectId: projectId,
            });
            await directDeleteNotification.save();
            if (io) {
                io.emit('notification', { ...directDeleteNotification.toObject(), projectId: { _id: projectId, name: originalProjectName, type: projectType } });
                io.emit('project_deleted', { projectId: projectId, projectType: projectType, projectName: originalProjectName });
            }
            return { message: `Công trình "${originalProjectName}" (chưa duyệt) đã được xóa.`, pendingDelete: false };
        } else { // Non-creator (with delete permission) requests delete for unapproved project
            if (project.pendingDelete) {
                 return { message: `Công trình "${originalProjectName}" (chưa duyệt) đã được yêu cầu xóa trước đó.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
            }
            project.pendingDelete = true;
            project.history.push({ action: 'delete_requested', user: user.id, timestamp: new Date(), details: { note: 'Delete request on unapproved project by non-creator' } });
            await project.save();
            const populatedProjectForNotification = { _id: project._id, name: project.name, type: projectType };
            const requestDeleteUnapprovedNotification = new Notification({
                message: `Yêu cầu xóa công trình "${project.name}" (chưa duyệt) bởi ${user.username}`,
                type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', userId: user.id,
                recipientId: originalApproverId || project.approvedBy
            });
            await requestDeleteUnapprovedNotification.save();
            if (io) io.emit('notification', { ...requestDeleteUnapprovedNotification.toObject(), projectId: populatedProjectForNotification });
            if (io) io.emit('project_updated', { ...(await populateProjectFields(project)).toObject(), projectType }); // Update list for pending state
            return { message: `Yêu cầu xóa công trình "${originalProjectName}" (chưa duyệt) đã được gửi để chờ duyệt.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
        }
    } else { // Project IS approved -> request delete
        // if (canRequestDeleteApproved) { // Implicitly true if user.permissions.delete
            if (project.pendingDelete) {
                 return { message: `Công trình "${originalProjectName}" đã được yêu cầu xóa trước đó.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
            }
            project.pendingDelete = true;
            project.history.push({ action: 'delete_requested', user: user.id, timestamp: new Date() });
            await project.save();
            const populatedProjectForNotification = { _id: project._id, name: project.name, type: projectType };
            const requestDeleteApprovedNotification = new Notification({
                message: `Yêu cầu xóa công trình "${project.name}" bởi ${user.username}`,
                type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', userId: user.id,
                recipientId: originalApproverId || project.approvedBy
            });
            await requestDeleteApprovedNotification.save();
            if (io) io.emit('notification', { ...requestDeleteApprovedNotification.toObject(), projectId: populatedProjectForNotification });
            if (io) io.emit('project_updated', { ...(await populateProjectFields(project)).toObject(), projectType }); // Update list for pending state
            return { message: `Yêu cầu xóa công trình "${originalProjectName}" đã được gửi để chờ duyệt.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
        // } else { // Should not be reached if user.permissions.delete
        //     throw { statusCode: 403, message: 'Không có quyền yêu cầu xóa công trình đã duyệt này.' };
        // }
    }
  }

  throw { statusCode: 403, message: 'Không có quyền xóa hoặc gửi yêu cầu xóa công trình này.' };
};

/**
 * Imports projects from a batch of data (e.g., from Excel).
 * @param {Array<object>} projectsToImport - Array of project data objects.
 * @param {object} user - The authenticated user performing the import.
 * @param {string} projectType - The type of projects being imported ('category' or 'minor_repair').
 * @param {object} io - Socket.IO instance for emitting events.
 * @returns {Promise<object>} The result of the import operation.
 */
const importProjectsBatch = async (projectsToImport, user, projectType, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const validationResults = [];
  const projectsToSavePayloads = [];
  let hasAnyError = false;

  const baseProjectSchema = Joi.object({
    name: Joi.string().trim().required().messages({ 'any.required': 'Tên công trình là bắt buộc.', 'string.empty': 'Tên công trình không được để trống.' }),
    allocatedUnit: Joi.string().trim().required().messages({ 'any.required': 'Đơn vị phân bổ là bắt buộc.', 'string.empty': 'Đơn vị phân bổ không được để trống.' }),
    location: Joi.string().trim().required().messages({ 'any.required': 'Địa điểm là bắt buộc.', 'string.empty': 'Địa điểm không được để trống.' }),
    scale: Joi.string().trim().required().messages({ 'any.required': 'Quy mô là bắt buộc.', 'string.empty': 'Quy mô không được để trống.' }),
    approvedBy: Joi.string().optional().allow(null, ''),
    supervisor: Joi.string().optional().allow(null, ''),
    initialValue: Joi.number().optional().allow(null, ''),
    taskDescription: Joi.string().optional().allow(null, ''),
    notes: Joi.string().optional().allow(null, ''),
    leadershipApproval: Joi.string().optional().allow(null, ''),
  }).unknown(true);

  const categoryProjectImportSchema = baseProjectSchema.keys({
    projectType: Joi.string().trim().required().messages({ 'any.required': 'Loại công trình là bắt buộc.', 'string.empty': 'Loại công trình không được để trống.' }),
    estimator: Joi.string().optional().allow(null, ''),
    durationDays: Joi.number().optional().allow(null, ''),
    startDate: Joi.date().iso().optional().allow(null, ''),
    completionDate: Joi.date().iso().optional().allow(null, ''),
    contractValue: Joi.number().optional().allow(null, ''),
    progress: Joi.string().optional().allow(null, ''),
    feasibility: Joi.string().optional().allow(null, ''),
    estimatedValue: Joi.number().optional().allow(null, '')
  });

  const minorRepairProjectImportSchema = baseProjectSchema.keys({
    reportDate: Joi.date().iso().required().messages({ 'any.required': 'Ngày xảy ra sự cố là bắt buộc.', 'date.format': 'Ngày xảy ra sự cố không đúng định dạng.' }),
    inspectionDate: Joi.date().iso().optional().allow(null, ''),
    paymentDate: Joi.date().iso().optional().allow(null, ''),
    paymentValue: Joi.number().optional().allow(null, '')
  });


  for (let i = 0; i < projectsToImport.length; i++) {
    const projectDataFromExcel = { ...projectsToImport[i] };
    const originalProjectNameForDisplay = projectDataFromExcel.name || `Hàng ${i + 1} trong Excel`;
    let dataToValidateAndSave = {};

    try {
      const schema = projectType === 'category' ? categoryProjectImportSchema : minorRepairProjectImportSchema;
      const { error, value } = schema.validate(projectDataFromExcel, { abortEarly: false, stripUnknown: false });
      if (error) { throw error; }
      dataToValidateAndSave = value;

      const allModelFields = Object.keys(Model.schema.paths);
      allModelFields.forEach(modelFieldKey => {
        if (projectDataFromExcel.hasOwnProperty(modelFieldKey) && !dataToValidateAndSave.hasOwnProperty(modelFieldKey)) {
          dataToValidateAndSave[modelFieldKey] = projectDataFromExcel[modelFieldKey];
        }
      });

      if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
        if (dataToValidateAndSave.allocatedUnit !== user.unit && !user.permissions.viewOtherBranchProjects) {
          throw new Error(`Đơn vị phân bổ "${dataToValidateAndSave.allocatedUnit}" không thuộc chi nhánh của bạn (${user.unit}).`);
        }
      }

      const userRefFieldsToProcess = {
        approvedBy: { required: user.role !== 'admin' },
        supervisor: { required: false },
        estimator: { required: false, categoryOnly: true }
      };

      for (const fieldName in userRefFieldsToProcess) {
        const config = userRefFieldsToProcess[fieldName];
        if (config.categoryOnly && projectType !== 'category') continue;

        let userIdentifier = dataToValidateAndSave[fieldName];

        if (userIdentifier) {
          if (mongoose.Types.ObjectId.isValid(userIdentifier)) {
            const userFoundById = await User.findById(userIdentifier).select('_id permissions fullName username');
            if (!userFoundById) {
              if (config.required) throw new Error(`Không tìm thấy người dùng với ID "${userIdentifier}" cho trường "${fieldName}".`);
              dataToValidateAndSave[fieldName] = null;
            } else {
              if (fieldName === 'approvedBy' && !userFoundById.permissions?.approve) {
                throw new Error(`Người dùng "${userFoundById.fullName || userFoundById.username}" (ID: ${userIdentifier}) không có quyền phê duyệt.`);
              }
              dataToValidateAndSave[fieldName] = userFoundById._id;
            }
          } else if (typeof userIdentifier === 'string') {
            const userFoundByName = await User.findOne({
              $or: [{ username: userIdentifier }, { fullName: userIdentifier }],
            }).select('_id permissions fullName username');
            if (!userFoundByName) {
              if (config.required) throw new Error(`Không tìm thấy người dùng có tên/username "${userIdentifier}" cho trường "${fieldName}".`);
              dataToValidateAndSave[fieldName] = null;
            } else {
              if (fieldName === 'approvedBy' && !userFoundByName.permissions?.approve) {
                throw new Error(`Người dùng "${userFoundByName.fullName || userFoundByName.username}" không có quyền phê duyệt.`);
              }
              dataToValidateAndSave[fieldName] = userFoundByName._id;
            }
          } else {
            if (config.required) throw new Error(`Giá trị không hợp lệ "${userIdentifier}" cho trường ${fieldName}.`);
            dataToValidateAndSave[fieldName] = null;
          }
        } else if (config.required) {
          throw new Error(`Trường ${fieldName} là bắt buộc.`);
        } else {
          dataToValidateAndSave[fieldName] = null;
        }
      }

      const finalPayload = { ...dataToValidateAndSave };
      finalPayload.enteredBy = user.username;
      finalPayload.createdBy = user.id;
      finalPayload.history = [{ action: 'created', user: user.id, timestamp: new Date() }];

      if (user.role === 'admin') {
        finalPayload.status = 'Đã duyệt';
        finalPayload.approvedBy = user.id;
        finalPayload.history.push({ action: 'approved', user: user.id, timestamp: new Date(), details: "Admin direct import" });
      } else {
        finalPayload.status = 'Chờ duyệt';
        if (!finalPayload.approvedBy) {
          throw new Error(`Người phê duyệt là bắt buộc khi nhập bởi người dùng không phải Admin.`);
        }
      }

      const schemaKeys = new Set(allModelFields);
      for (const key in finalPayload) {
        if (!schemaKeys.has(key) && key !== 'history') {
          delete finalPayload[key];
        }
      }
      delete finalPayload.type;

      projectsToSavePayloads.push(finalPayload);
      validationResults.push({ success: true, projectName: originalProjectNameForDisplay, rowIndex: i });

    } catch (error) {
      const rowErrors = {};
      if (error.details && Array.isArray(error.details)) {
        error.details.forEach(detail => {
          rowErrors[detail.path.join('.')] = detail.message;
        });
      } else {
        rowErrors['general'] = error.message;
      }
      logger.error(`Lỗi validate công trình "${originalProjectNameForDisplay}" (hàng ${i + 1}) từ Excel:`, { message: error.message, data: projectDataFromExcel, path: 'importProjectsBatch' });
      validationResults.push({ success: false, projectName: originalProjectNameForDisplay, error: error.message, rowIndex: i, field: error.field, details: rowErrors });
      hasAnyError = true;
    }
  }

  if (hasAnyError) {
    const errorResponse = new Error('Có lỗi trong dữ liệu Excel. Vui lòng kiểm tra và thử lại.');
    errorResponse.statusCode = 400;
    errorResponse.results = validationResults;
    throw errorResponse;
  }

  const savedProjectsResults = [];
  let importedCount = 0;
  for (const projectPayload of projectsToSavePayloads) {
    try {
      const project = new Model(projectPayload);
      let newProject = await project.save();
      newProject = await populateProjectFields(newProject);

      if (projectPayload.status === 'Chờ duyệt') {
        const notification = new Notification({
          message: `Yêu cầu thêm công trình mới "${newProject.name}" (từ Excel) đã được gửi để duyệt`,
          type: 'new',
          projectId: newProject._id,
          projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'pending',
          userId: user.id,
          recipientId: projectPayload.approvedBy
        });
        await notification.save();
        if (io) io.emit('notification', { ...notification.toObject(), projectId: { _id: newProject._id, name: newProject.name, type: projectType } });
      } else {
        if (io) io.emit('project_updated', { ...newProject.toObject(), projectType });
      }
      savedProjectsResults.push({ success: true, projectName: newProject.name, project: newProject.toObject() });
      importedCount++;
    } catch (dbError) {
      logger.error(`Lỗi khi lưu công trình "${projectPayload.name}" từ Excel (sau validate):`, { message: dbError.message, data: projectPayload, path: 'importProjectsBatch' });
      const criticalError = new Error(`Lỗi nghiêm trọng khi lưu công trình "${projectPayload.name}" đã validate: ${dbError.message}`);
      criticalError.statusCode = 500;
      throw criticalError;
    }
  }
  return { message: `Hoàn tất nhập từ Excel. Đã nhập thành công ${importedCount} công trình.`, results: savedProjectsResults };
};

module.exports = {
  getProjectsList,
  createNewProject,
  updateProjectById,
  deleteProjectById,
  importProjectsBatch,
};
