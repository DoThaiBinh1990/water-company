// d:\CODE\water-company\backend\server\services\project.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, User, Notification, RejectedProject, SerialCounter } = require('../models');
const { populateProjectFields, updateSerialNumbers } = require('../utils');
const logger = require('../config/logger');
const Joi = require('joi'); // Import Joi

const getProjectsList = async (queryParams) => {
  const { user, type = 'category', page = 1, limit = 10, status, allocatedUnit, constructionUnit, allocationWave, assignedTo, search, minInitialValue, maxInitialValue, progress, pending, supervisor, estimator, reportDate } = queryParams;
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;
  const query = {};

  // Apply general filters first
  if (allocatedUnit) query.allocatedUnit = allocatedUnit;
  if (constructionUnit && type === 'category') query.constructionUnit = constructionUnit;
  if (allocationWave && type === 'category') query.allocationWave = allocationWave;
  if (assignedTo) { // Assuming assignedTo is a user ID or username/fullName
    const userAssigned = await User.findOne({ $or: [{ _id: mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null }, { username: assignedTo }, { fullName: assignedTo }] }).select('_id');
    if (userAssigned) query.assignedTo = userAssigned._id;
    else query.assignedTo = null; // Or handle as "no match"
  }
  if (search) query.name = { $regex: search, $options: 'i' };
  if (reportDate && type === 'minor_repair') query.reportDate = new Date(reportDate);

  // Filter by projectType for category projects
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

  // Logic for 'pending' tab vs 'projects' tab
  if (pending === 'true' || pending === true) { // For 'pending' tab
    query.$or = [
      { status: 'Chờ duyệt' }, // New projects awaiting approval
      { pendingEdit: { $ne: null, $exists: true } }, // Approved projects with pending edits
      { pendingDelete: true } // Approved projects with pending deletions
    ];
  } else { // For 'projects' tab (main list)
    if (status) { // If user explicitly filters by a status on the main tab
      query.status = status;
    } else { // Default for 'projects' tab: show only 'Đã duyệt' and other post-approval active statuses
      query.status = { $in: ['Đã duyệt', 'Đã phân bổ', 'Đang thực hiện', 'Hoàn thành'] };
      // This implicitly excludes 'Chờ duyệt' (new unapproved) and 'Đã từ chối'.
    }
  }

  const userFieldToQuery = async (userIdentifier) => {
    if (!userIdentifier) return null;
    if (mongoose.Types.ObjectId.isValid(userIdentifier)) {
        const userById = await User.findById(userIdentifier).select('_id');
        return userById ? userById._id : null;
    }
    const userByName = await User.findOne({ $or: [{ username: userIdentifier }, { fullName: userIdentifier }] }).select('_id');
    return userByName ? userByName._id : null;
  };

  if (supervisor) {
    const supervisorId = await userFieldToQuery(supervisor);
    if (supervisorId) query.supervisor = supervisorId;
    else query.supervisor = null; // No match for supervisor
  }
  if (estimator && type === 'category') {
    const estimatorId = await userFieldToQuery(estimator);
    if (estimatorId) query.estimator = estimatorId;
    else query.estimator = null; // No match for estimator
  }


  // Role-based filtering
  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      // If 'pending' is true, we might want to show pending items for their unit regardless of status
      // The current $or for pending already includes 'Chờ duyệt' which might be from other units if not restricted.
      // Let's ensure unit restriction applies correctly.
      if (query.$or) { // If it's the pending tab
        query.$or.forEach(condition => {
            if (!condition.allocatedUnit) { // Add unit restriction if not already there
                condition.allocatedUnit = user.unit;
            }
        });
      } else { // For main tab or if $or is not used
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
    .populate({ path: 'history.user', select: 'username fullName' }) // Populate user in history
    .sort({ createdAt: -1 }) // Sắp xếp theo ngày tạo mới nhất
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  // Populate fields for each project
  const projects = await Promise.all(
    projectsFromDB.map(p => populateProjectFields(p)) // populateProjectFields should handle history.user as well
  );

  return {
    projects,
    total: count,
    page: parseInt(page),
    pages: Math.ceil(count / parseInt(limit)),
  };
};

const getRejectedProjectsList = async (queryParams) => {
  const { user, type, page = 1, limit = 10, search, allocatedUnit, rejectionReason } = queryParams;
  const query = {};
  if (type) query.projectType = type;
  if (search) query.name = { $regex: search, $options: 'i' };
  if (allocatedUnit) query.allocatedUnit = allocatedUnit;
  if (rejectionReason) query.rejectionReason = { $regex: rejectionReason, $options: 'i' };

  // Role-based filtering for rejected projects
  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      query.allocatedUnit = user.unit;
    }
    // Add more specific permission checks if needed, e.g., only show rejected projects created by the user
    // if (!user.permissions.viewRejected && user.role !== 'admin' && !user.role.includes('office') && !user.role.includes('director')) {
    //   query.createdBy = user.id;
    // }
  }


  const count = await RejectedProject.countDocuments(query);
  const rejectedProjectsFromDB = await RejectedProject.find(query)
    .populate('rejectedBy', 'username fullName')
    .populate('createdBy', 'username fullName') // Populate createdBy for rejected projects
    .sort({ rejectedAt: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  // Populate fields for each rejected project (if populateProjectFields is applicable)
  // Assuming populateProjectFields can handle the structure of RejectedProject
  const rejectedProjects = await Promise.all(
    rejectedProjectsFromDB.map(p => populateProjectFields(p, true)) // true for isRejected
  );

  return {
    rejectedProjects,
    total: count,
    page: parseInt(page),
    pages: Math.ceil(count / parseInt(limit)),
  };
};

const createNewProject = async (projectData, user, projectType, io) => {
  const { name, allocatedUnit, location, approvedBy: approvedByInput, scale, reportDate, supervisor: supervisorInput, estimator: estimatorInput, ...restData } = projectData;

  if (!name || !allocatedUnit || !location) { // approvedBy is handled differently now
    throw { statusCode: 400, message: 'Tên công trình, Đơn vị phân bổ, và Địa điểm là bắt buộc.' };
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
    enteredBy: user.username, 
    createdBy: user.id,
    // Status and approvedBy determined below
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
  
  dataToSave.history = [{
    action: 'created',
    user: user.id,
    timestamp: new Date()
  }];

  let isPending = true;

  if (user.role === 'admin') {
    dataToSave.status = 'Đã duyệt';
    dataToSave.approvedBy = user.id; // Admin approves their own creation
    dataToSave.history.push({ action: 'approved', user: user.id, timestamp: new Date(), details: "Admin direct creation" });
    isPending = false;
  } else {
    dataToSave.status = 'Chờ duyệt'; // Default, but make explicit
    if (!approvedByInput) {
        throw { statusCode: 400, message: 'Người phê duyệt là bắt buộc cho công trình mới.' };
    }
    const approver = await User.findById(approvedByInput);
    if (!approver || !approver.permissions.approve) {
        throw { statusCode: 400, message: 'Người duyệt không hợp lệ hoặc không có quyền duyệt.' };
    }
    dataToSave.approvedBy = approvedByInput;
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

  delete dataToSave.type; // Remove 'type' from projectData as it's not a schema field

  const project = new Model(dataToSave);
  let newProject = await project.save();
  newProject = await populateProjectFields(newProject);

  const populatedProjectForNotification = { _id: newProject._id, name: newProject.name, type: projectType };

  if (isPending) {
    const notification = new Notification({
      message: `Yêu cầu thêm công trình mới "${newProject.name}" đã được gửi để duyệt`,
      type: 'new',
      projectId: newProject._id,
      projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      status: 'pending',
      userId: user.id, // User who created the request
      recipientId: dataToSave.approvedBy // User who needs to approve
    });
    await notification.save();
    if (io) {
      io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
    } else {
      logger.warn('Socket.IO không được khởi tạo trong service, bỏ qua gửi thông báo cho công trình chờ duyệt.');
    }
    return { message: 'Công trình đã được gửi để duyệt!', project: newProject.toObject(), pending: true };
  } else {
    // Admin direct creation
    if (io) {
      io.emit('project_updated', { ...newProject.toObject(), projectType });
    }
    return { message: 'Công trình đã được tạo và duyệt bởi Admin!', project: newProject.toObject(), pending: false };
  }
};

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
  
  const currentUpdateData = { ...updateData };
  const forbiddenFields = ['createdBy', 'enteredBy', 'categorySerialNumber', 'minorRepairSerialNumber', 'status', 'pendingEdit', 'pendingDelete', 'history'];
  
  if (project.status === 'Đã duyệt' || !isUserAdmin) { 
      forbiddenFields.push('approvedBy');
  }
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
    if (!currentUpdateData.approvedBy || !mongoose.Types.ObjectId.isValid(currentUpdateData.approvedBy)) {
        throw { statusCode: 400, message: 'Người phê duyệt là bắt buộc và phải là ID hợp lệ khi cập nhật.' };
    }
    const newApprover = await User.findById(currentUpdateData.approvedBy);
    if (!newApprover || !newApprover.permissions.approve) {
        throw { statusCode: 400, message: 'Người phê duyệt mới không hợp lệ hoặc không có quyền duyệt.' };
    }
  }

  // Admin can edit directly
  if (isUserAdmin) {
    Object.assign(project, currentUpdateData);
    let action = 'edited';
    if (project.status === 'Chờ duyệt' && currentUpdateData.approvedBy === user.id) { 
        project.status = 'Đã duyệt';
        action = 'approved'; 
    } else if (project.status === 'Chờ duyệt' && !currentUpdateData.approvedBy && project.approvedBy !== user.id) {
        // Admin edits a project pending someone else's approval, it remains pending that person.
    }

    project.pendingEdit = null; 
    project.history.push({ action, user: user.id, timestamp: new Date(), details: { changes: project.pendingEdit?.changes || 'Admin direct edit' } });
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);
    if (io) io.emit('project_updated', { ...populatedProject.toObject(), projectType });
    return { message: 'Công trình đã được cập nhật bởi Admin.', project: populatedProject.toObject(), updated: true, pending: false };
  }

  // Non-admin users with edit permission
  if (user.permissions.edit) {
    let canEditDirectlyUnapproved = false;
    let canRequestEditApproved = true; // All non-admin with edit permission can request edit for approved projects

    // Only the creator can edit their own unapproved project directly.
    if (project.createdBy.toString() === user.id.toString() && project.status !== 'Đã duyệt') {
        canEditDirectlyUnapproved = true;
    }

    if (project.status !== 'Đã duyệt') { // Project is 'Chờ duyệt' (or other non-approved status)
      if (canEditDirectlyUnapproved) {
        Object.assign(project, currentUpdateData);
        project.history.push({ action: 'edited', user: user.id, timestamp: new Date(), details: { note: 'User edit while pending approval' } });
        await project.save({ validateModifiedOnly: true });
        const populatedProject = await populateProjectFields(project);
        const approverForNotification = await User.findById(project.approvedBy);
        if (approverForNotification) {
            const notification = new Notification({
                message: `Công trình "${project.name}" đang chờ duyệt đã được cập nhật bởi ${user.username}. Vui lòng kiểm tra.`,
                type: 'edit', 
                projectId: project._id,
                projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', 
                userId: user.id,
                recipientId: project.approvedBy
            });
            await notification.save();
            if (io) io.emit('notification', { ...notification.toObject(), projectId: { _id: project._id, name: project.name, type: projectType } });
        }
        return { message: 'Công trình (chưa duyệt) đã được cập nhật.', project: populatedProject.toObject(), updated: true, pending: true };
      } else {
        // Non-creator editing an unapproved project: must go to pendingEdit
        const changesArray = [];
        for (const field in currentUpdateData) {
          if (Object.prototype.hasOwnProperty.call(currentUpdateData, field)) {
            if (String(project[field]) !== String(currentUpdateData[field])) {
              changesArray.push({ field, oldValue: project[field], newValue: currentUpdateData[field] });
            }
          }
        }
        if (changesArray.length === 0) {
          const populatedNoChangeProject = await populateProjectFields(project);
          return { message: 'Không có thay đổi nào được ghi nhận.', project: populatedNoChangeProject.toObject(), updated: false, pending: false };
        }
        project.pendingEdit = { data: currentUpdateData, changes: changesArray, requestedBy: user.id, requestedAt: new Date() };
        project.history.push({ action: 'edit_requested', user: user.id, timestamp: new Date(), details: { changes: changesArray, note: 'Edit request on unapproved project by non-creator' } });
        await project.save({ validateModifiedOnly: true });
        const populatedProject = await populateProjectFields(project);
        const approverForNotification = await User.findById(project.approvedBy);
        if (approverForNotification) {
            const notification = new Notification({
                message: `Yêu cầu sửa công trình "${populatedProject.name}" (chưa duyệt) bởi ${user.username}`,
                type: 'edit', projectId: populatedProject._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'pending', userId: user.id,
                recipientId: project.approvedBy
            });
            await notification.save();
            if (io) io.emit('notification', { ...notification.toObject(), projectId: { _id: populatedProject._id, name: populatedProject.name, type: projectType } });
        }
        return { message: 'Yêu cầu sửa công trình (chưa duyệt) đã được gửi để chờ duyệt.', project: populatedProject.toObject(), updated: true, pending: true };
      }
    } else { // Project is 'Đã duyệt' (or other post-approval status)
      if (canRequestEditApproved) {
        const changesArray = [];
        for (const field in currentUpdateData) {
          if (Object.prototype.hasOwnProperty.call(currentUpdateData, field)) {
            if (String(project[field]) !== String(currentUpdateData[field])) {
              changesArray.push({ field, oldValue: project[field], newValue: currentUpdateData[field] });
            }
          }
        }

        if (changesArray.length === 0) {
          const populatedNoChangeProject = await populateProjectFields(project);
          return { message: 'Không có thay đổi nào được ghi nhận.', project: populatedNoChangeProject.toObject(), updated: false, pending: false };
        }

        project.pendingEdit = { data: currentUpdateData, changes: changesArray, requestedBy: user.id, requestedAt: new Date() };
        project.history.push({ action: 'edit_requested', user: user.id, timestamp: new Date(), details: { changes: changesArray } });
        await project.save({ validateModifiedOnly: true });
        const populatedProject = await populateProjectFields(project);

        const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type: projectType };
        const notification = new Notification({
          message: `Yêu cầu sửa công trình "${populatedProject.name}" bởi ${user.username}`,
          type: 'edit', projectId: populatedProject._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'pending', userId: user.id,
          recipientId: project.approvedBy 
        });
        await notification.save();
        if (io) io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
        return { message: 'Yêu cầu sửa đã được gửi để chờ duyệt.', project: populatedProject.toObject(), updated: true, pending: true };
      } else {
        // This case should ideally not be reached if user.permissions.edit is true.
        // It's a fallback.
        throw { statusCode: 403, message: 'Không có quyền yêu cầu sửa công trình này.' };
      }
    }
  }

  throw { statusCode: 403, message: 'Không có quyền sửa công trình này.' };
};

const deleteProjectById = async (projectId, projectType, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình để xóa.' };
  }
  const originalProjectName = project.name;
  const originalCreatorId = project.createdBy;
  const originalApproverId = project.approvedBy;

  if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
    if (project.allocatedUnit !== user.unit && !user.permissions.viewOtherBranchProjects) { 
      throw { statusCode: 403, message: `Bạn chỉ có thể thao tác với công trình thuộc chi nhánh ${user.unit}.` };
    }
  }

  if (user.role === 'admin') {
    await Model.deleteOne({ _id: projectId });
    await updateSerialNumbers(projectType);
    const pendingDeleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending' });
    if (pendingDeleteNotification) {
        pendingDeleteNotification.status = 'processed';
        await pendingDeleteNotification.save();
        if (io) io.emit('notification_processed', pendingDeleteNotification._id);
    }
    const deletedConfirmationNotification = new Notification({
        message: `Công trình "${originalProjectName}" đã được xóa bởi quản trị viên ${user.username}.`,
        type: 'delete_approved', 
        projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: originalCreatorId, 
        originalProjectId: projectId, 
    });
    await deletedConfirmationNotification.save();
    if (io) {
        io.emit('notification', deletedConfirmationNotification.toObject());
        io.emit('project_deleted', { projectId: projectId, projectType: projectType, projectName: originalProjectName });
    }
    return { message: `Công trình "${originalProjectName}" đã được xóa bởi Admin.`, pendingDelete: false };
  }

  if (user.permissions.delete) {
    let canPerformDirectDeleteUnapproved = false; 
    let canRequestDeleteApproved = true; // All non-admin with delete permission can request delete for approved projects

    if (project.createdBy.toString() === user.id.toString() && project.status !== 'Đã duyệt') {
        canPerformDirectDeleteUnapproved = true;
    }

    if (project.status !== 'Đã duyệt') { // Project is 'Chờ duyệt'
        if (canPerformDirectDeleteUnapproved) {
            await Model.deleteOne({ _id: projectId });
            await updateSerialNumbers(projectType);
            const deletedNotification = new Notification({ 
                message: `Công trình "${originalProjectName}" (chưa duyệt) đã được xóa bởi ${user.username}.`,
                type: 'delete_approved', 
                projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'processed',
                userId: originalCreatorId,
                originalProjectId: projectId,
            });
            await deletedNotification.save();
            if (io) {
                io.emit('notification', deletedNotification.toObject());
                io.emit('project_deleted', { projectId: projectId, projectType: projectType, projectName: originalProjectName });
            }
            return { message: `Công trình "${originalProjectName}" (chưa duyệt) đã được xóa.`, pendingDelete: false };
        } else {
            // Non-creator trying to delete unapproved project: must go to pendingDelete
            if (project.pendingDelete) {
                 return { message: `Công trình "${originalProjectName}" (chưa duyệt) đã được yêu cầu xóa trước đó.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
            }
            project.pendingDelete = true;
            project.history.push({ action: 'delete_requested', user: user.id, timestamp: new Date(), details: { note: 'Delete request on unapproved project by non-creator' } });
            await project.save();
            const populatedProjectForNotification = { _id: project._id, name: project.name, type: projectType };
            const notification = new Notification({
                message: `Yêu cầu xóa công trình "${project.name}" (chưa duyệt) bởi ${user.username}`,
                type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', userId: user.id,
                recipientId: originalApproverId || project.approvedBy 
            });
            await notification.save();
            if (io) io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
            return { message: `Yêu cầu xóa công trình "${originalProjectName}" (chưa duyệt) đã được gửi để chờ duyệt.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
        }
    } else { // Project is 'Đã duyệt' (or other post-approval status)
        if (canRequestDeleteApproved) {
            if (project.pendingDelete) { 
                 return { message: `Công trình "${originalProjectName}" đã được yêu cầu xóa trước đó.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
            }
            project.pendingDelete = true;
            project.history.push({ action: 'delete_requested', user: user.id, timestamp: new Date() });
            await project.save();
            const populatedProjectForNotification = { _id: project._id, name: project.name, type: projectType };
            const notification = new Notification({
                message: `Yêu cầu xóa công trình "${project.name}" bởi ${user.username}`,
                type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', userId: user.id,
                recipientId: originalApproverId || project.approvedBy 
            });
            await notification.save();
            if (io) io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
            return { message: `Yêu cầu xóa công trình "${originalProjectName}" đã được gửi để chờ duyệt.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
        } else {
            // Should not be reached if user.permissions.delete is true
            throw { statusCode: 403, message: 'Không có quyền yêu cầu xóa công trình đã duyệt này.' };
        }
    }
  }
  
  throw { statusCode: 403, message: 'Không có quyền xóa hoặc gửi yêu cầu xóa công trình này.' };
};

// --- New Service Functions for Project Actions ---

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
  let userToNotify = null; // User who initiated the request

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
      message: `Yêu cầu xóa công trình "${projectName}" đã được duyệt và công trình đã được xóa.`,
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

// const allocateProject = async (projectId, constructionUnit, allocationWave, user, io) => {
//     const Model = CategoryProject; 
//     const project = await Model.findById(projectId);

//     if (!project) {
//       throw { statusCode: 404, message: 'Không tìm thấy công trình' };
//     }

//     if (!user.permissions.allocate) {
//         throw { statusCode: 403, message: 'Bạn không có quyền phân bổ công trình.' };
//     }

//     if (!constructionUnit || !allocationWave) {
//       throw { statusCode: 400, message: 'Đơn vị thi công và Đợt phân bổ là bắt buộc.' };
//     }

//     if (project.status !== 'Đã duyệt') {
//       throw { statusCode: 400, message: 'Chỉ công trình đã duyệt mới có thể được phân bổ.' };
//     }

//     project.constructionUnit = constructionUnit;
//     project.allocationWave = allocationWave;
//     project.status = 'Đã phân bổ'; 
//     project.history.push({
//       action: 'allocated',
//       user: user.id,
//       timestamp: new Date(),
//       details: { constructionUnit, allocationWave }
//     });
//     await project.save({ validateModifiedOnly: true });
//     const populatedProject = await populateProjectFields(project);

//     const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type: 'category' };
//     const notification = new Notification({
//       message: `Công trình "${populatedProject.name}" đã được phân bổ cho ${constructionUnit} (Đợt: ${allocationWave}) bởi ${user.username}.`,
//       type: 'allocated',
//       projectId: populatedProject._id,
//       projectModel: 'CategoryProject',
//       status: 'processed', 
//       userId: populatedProject.createdBy?._id || populatedProject.createdBy,
//     });
//     await notification.save();

//     if (io) {
//       io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
//       io.emit('project_allocated', populatedProject.toObject());
//     }

//     return { message: 'Công trình đã được phân bổ.', project: populatedProject.toObject() };
// };

// const assignProject = async (projectId, supervisorId, estimatorId, projectType, user, io) => {
//     const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
//     const project = await Model.findById(projectId);

//     if (!project) {
//       throw { statusCode: 404, message: 'Không tìm thấy công trình' };
//     }

//     if (!user.permissions.assign) {
//         throw { statusCode: 403, message: 'Bạn không có quyền giao việc công trình.' };
//     }

//     if (!supervisorId) {
//       throw { statusCode: 400, message: 'Người giám sát là bắt buộc.' };
//     }

//     const supervisorUser = await User.findById(supervisorId);
//     if (!supervisorUser) {
//         throw { statusCode: 400, message: 'Người giám sát không hợp lệ.' };
//     }

//     let estimatorUser = null;
//     if (projectType === 'category' && estimatorId) {
//         estimatorUser = await User.findById(estimatorId);
//         if (!estimatorUser) {
//             throw { statusCode: 400, message: 'Người dự toán không hợp lệ.' };
//         }
//     }

//     if (!['Đã duyệt', 'Đã phân bổ', 'Đang thực hiện'].includes(project.status)) { 
//         throw { statusCode: 400, message: `Công trình với trạng thái "${project.status}" không thể giao việc.` };
//     }

//     project.supervisor = supervisorUser._id;
//     if (projectType === 'category') {
//       project.estimator = estimatorUser ? estimatorUser._id : null; 
//     }
//     project.history.push({
//       action: 'assigned',
//       user: user.id,
//       timestamp: new Date(),
//       details: { supervisor: supervisorUser._id, estimator: projectType === 'category' ? (estimatorUser ? estimatorUser._id : null) : undefined }
//     });
//     await project.save({ validateModifiedOnly: true });
//     const populatedProject = await populateProjectFields(project);

//     let assignMessage = `Công trình "${populatedProject.name}" đã được giao cho Giám sát: ${supervisorUser.fullName || supervisorUser.username}`;
//     if (estimatorUser) {
//       assignMessage += ` và Dự toán: ${estimatorUser.fullName || estimatorUser.username}`;
//     }
//     assignMessage += ` bởi ${user.username}.`;

//     const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type: projectType };
//     const notification = new Notification({
//       message: assignMessage,
//       type: 'assigned',
//       projectId: populatedProject._id,
//       projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
//       status: 'processed',
//       userId: populatedProject.createdBy?._id || populatedProject.createdBy, 
//     });
//     await notification.save();

//     if (io) {
//       io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
//       io.emit('project_assigned', populatedProject.toObject());
//     }

//     return { message: 'Công trình đã được giao việc.', project: populatedProject.toObject() };
// };

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

    if (rejectedProject.projectType === 'category') {
      projectDataToRestore.projectType = projectDataToRestore.projectType || rejectedProject.details?.projectType || ''; 
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
  getRejectedProjectsList, // Export hàm mới
  createNewProject,
  updateProjectById,
  deleteProjectById,
  importProjectsBatch,
  restoreRejectedProject,
  permanentlyDeleteRejectedProject,
  approveProject,
  rejectProject,
  // allocateProject, // Removed
  // assignProject, // Removed
};
