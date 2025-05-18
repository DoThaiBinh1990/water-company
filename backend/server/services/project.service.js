// d:\CODE\water-company\backend\server\services\project.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, User, Notification, RejectedProject, SerialCounter } = require('../models');
const { populateProjectFields, updateSerialNumbers } = require('../utils');
const logger = require('../config/logger');

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

const importProjectsBatch = async (projectsToImport, user, projectType, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const validationResults = []; 
  const projectsToSavePayloads = []; 
  let hasAnyError = false;
  
  let basicRequiredFieldsConfig = [
    { name: 'name', label: 'Tên công trình' },
    { name: 'allocatedUnit', label: 'Đơn vị phân bổ' },
    { name: 'location', label: 'Địa điểm' },
  ];
  if (projectType === 'category') {
    basicRequiredFieldsConfig.push(
        { name: 'projectType', label: 'Loại công trình' }, 
        { name: 'scale', label: 'Quy mô' }
    );
  } else {
    basicRequiredFieldsConfig.push(
        { name: 'scale', label: 'Quy mô' },
        { name: 'reportDate', label: 'Ngày xảy ra sự cố' }
    );
  }

  for (let i = 0; i < projectsToImport.length; i++) {
    const projectDataFromExcel = { ...projectsToImport[i] };
    const originalProjectNameForDisplay = projectDataFromExcel.name || `Hàng ${i + 1} trong Excel`;
    let dataToValidateAndSave = {}; 

    try {
      for (const fieldConfig of basicRequiredFieldsConfig) {
        const fieldValue = projectDataFromExcel[fieldConfig.name];
        if (fieldValue === null || fieldValue === undefined || String(fieldValue).trim() === '') {
          throw new Error(`Trường "${fieldConfig.label}" (cột "${fieldConfig.name}") là bắt buộc cho công trình "${originalProjectNameForDisplay}".`);
        }
        dataToValidateAndSave[fieldConfig.name] = fieldValue;
      }

      const allModelFields = Object.keys(Model.schema.paths);
      allModelFields.forEach(modelFieldKey => {
        if (projectDataFromExcel.hasOwnProperty(modelFieldKey) && !dataToValidateAndSave.hasOwnProperty(modelFieldKey)) {
            dataToValidateAndSave[modelFieldKey] = projectDataFromExcel[modelFieldKey];
        }
      });
      
      if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
        if (dataToValidateAndSave.allocatedUnit !== user.unit && !user.permissions.viewOtherBranchProjects) { 
            throw new Error(`Bạn chỉ có thể nhập công trình cho chi nhánh ${user.unit}. Công trình "${originalProjectNameForDisplay}" thuộc đơn vị ${dataToValidateAndSave.allocatedUnit}.`);
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
              if (config.required) throw new Error(`Không tìm thấy người dùng với ID "${userIdentifier}" cho trường ${fieldName} của công trình "${originalProjectNameForDisplay}".`);
              dataToValidateAndSave[fieldName] = null;
            } else {
              if (fieldName === 'approvedBy' && !userFoundById.permissions?.approve) {
                throw new Error(`Người dùng "${userFoundById.fullName || userFoundById.username}" (ID: ${userIdentifier}) không có quyền phê duyệt cho công trình "${originalProjectNameForDisplay}".`);
              }
              dataToValidateAndSave[fieldName] = userFoundById._id;
            }
          } else if (typeof userIdentifier === 'string') { 
            const userFoundByName = await User.findOne({
              $or: [{ username: userIdentifier }, { fullName: userIdentifier }],
            }).select('_id permissions fullName username');
            if (!userFoundByName) {
              if (config.required) throw new Error(`Không tìm thấy người dùng có tên/username "${userIdentifier}" cho trường ${fieldName} của công trình "${originalProjectNameForDisplay}".`);
              dataToValidateAndSave[fieldName] = null;
            } else {
              if (fieldName === 'approvedBy' && !userFoundByName.permissions?.approve) {
                throw new Error(`Người dùng "${userFoundByName.fullName || userFoundByName.username}" không có quyền phê duyệt cho công trình "${originalProjectNameForDisplay}".`);
              }
              dataToValidateAndSave[fieldName] = userFoundByName._id;
            }
          } else { 
            if (config.required) throw new Error(`Giá trị không hợp lệ "${userIdentifier}" cho trường ${fieldName} của công trình "${originalProjectNameForDisplay}".`);
            dataToValidateAndSave[fieldName] = null;
          }
        } else if (config.required) { 
            throw new Error(`Trường ${fieldName} là bắt buộc và phải hợp lệ cho công trình "${originalProjectNameForDisplay}".`);
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
             throw new Error(`Người phê duyệt là bắt buộc cho công trình "${originalProjectNameForDisplay}" khi nhập bởi người dùng không phải Admin.`);
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
      logger.error(`Lỗi validate công trình "${originalProjectNameForDisplay}" (hàng ${i+1}) từ Excel:`, { message: error.message, data: projectDataFromExcel, path: 'importProjectsBatch' });
      validationResults.push({ success: false, projectName: originalProjectNameForDisplay, error: error.message, rowIndex: i, field: error.field }); 
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
