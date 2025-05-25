// d:\CODE\water-company\backend\server\services\project.core.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, User, SerialCounter, Notification } = require('../models');
const { populateProjectFields, updateSerialNumbers, areDatesEqual } = require('../utils');
const logger = require('../config/logger'); // Import logger
const Joi = require('joi');
const { generateProjectCode } = require('./helpers/projectCodeHelper'); // Import helper tạo mã CT
const { userFieldToQuery, escapeRegExp } = require('./helpers/serviceHelpers'); // Thêm escapeRegExp

const getProjectsList = async (queryParams) => {
  const { user, type = 'category', page = 1, limit = 10, status, allocatedUnit, constructionUnit, allocationWave, assignedTo, search, minInitialValue, maxInitialValue, progress, pending, supervisor, estimator, reportDate, financialYear, isCompleted, projectType: categoryProjectTypeFilter } = queryParams;
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;
  const query = {};

  if (allocatedUnit) query.allocatedUnit = allocatedUnit;
  if (constructionUnit && type === 'category') query.constructionUnit = constructionUnit;
  if (allocationWave && type === 'category') query.allocationWave = allocationWave;
  if (assignedTo) {
    const userAssigned = await userFieldToQuery(assignedTo);
    if (userAssigned) query.assignedTo = userAssigned;
    else query.assignedTo = null; // Hoặc không thêm vào query nếu không tìm thấy
  }
  if (search) query.name = { $regex: search, $options: 'i' };
  if (reportDate && type === 'minor_repair') query.reportDate = new Date(reportDate);

  if (financialYear) {
    const parsedYear = parseInt(financialYear, 10);
    if (!isNaN(parsedYear)) query.financialYear = parsedYear;
  }

  if (isCompleted !== undefined && isCompleted !== null && String(isCompleted).trim() !== '') {
    query.isCompleted = (String(isCompleted).toLowerCase() === 'true');
  }

  if (categoryProjectTypeFilter && type === 'category') {
    query.projectType = categoryProjectTypeFilter;
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

const createNewProject = async (projectData, user, projectType, io) => {
  const { name, allocatedUnit, location, approvedBy: approvedByInput, scale, reportDate, supervisor: supervisorInput, estimator: estimatorInput, financialYear, isCompleted, ...restData } = projectData;

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

  // Kiểm tra trùng lặp trước khi tạo
  const existingProjectByNameUnitYear = await Model.findOne({
    name: name.trim(), // Trim name before checking
    allocatedUnit: allocatedUnit.trim(), // Trim allocatedUnit
    financialYear: parseInt(financialYear, 10)
  });
  if (existingProjectByNameUnitYear) {
    throw { statusCode: 409, message: `Công trình "${name.trim()}" của đơn vị "${allocatedUnit.trim()}" trong năm ${financialYear} đã tồn tại.` };
  }

  const dataToSave = {
    name, allocatedUnit, location, scale,
    ...restData,
    financialYear: parseInt(financialYear, 10),
    isCompleted: isCompleted === true || String(isCompleted).toLowerCase() === 'true',
    enteredBy: user.username,
    projectCode: await generateProjectCode(projectType, parseInt(financialYear, 10), allocatedUnit, projectData.allocationWave), // Thêm allocationWave
    createdBy: user.id,
  };

  if (projectType === 'minor_repair') {
    dataToSave.reportDate = reportDate ? new Date(reportDate) : null;
  }
  if (projectType === 'category') {
    dataToSave.startDate = dataToSave.startDate ? new Date(dataToSave.startDate) : null;
    dataToSave.completionDate = dataToSave.completionDate ? new Date(dataToSave.completionDate) : null;
    // Đồng bộ với profileTimeline nếu các trường ngày tháng hồ sơ được nhập
    if (dataToSave.startDate && dataToSave.durationDays) {
      dataToSave.profileTimeline = {
        ...(dataToSave.profileTimeline || {}), // Giữ lại các trường khác nếu có
        startDate: dataToSave.startDate,
        durationDays: parseInt(String(dataToSave.durationDays), 10) || null,
        endDate: dataToSave.completionDate, // completionDate ở gốc sẽ là endDate của profileTimeline
        assignmentType: 'manual', // Khi nhập từ form chính, coi là manual
        estimator: dataToSave.estimator || null, // Gán estimator nếu có
      };
    }
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

  if (dataToSave.financialYear && isNaN(dataToSave.financialYear)) {
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
    isPending = false;
  } else {
    dataToSave.status = 'Chờ duyệt';
    if (!approvedByInput) {
        throw { statusCode: 400, message: 'Người phê duyệt là bắt buộc cho công trình mới.' };
    }
    const approver = await userFieldToQuery(approvedByInput); // Use helper
    if (!approver) {
        throw { statusCode: 400, message: 'Người duyệt không hợp lệ hoặc không có quyền duyệt (không tìm thấy).' };
    }
    const approverDoc = await User.findById(approver);
    if (!approverDoc || !approverDoc.permissions.approve) {
        throw { statusCode: 400, message: 'Người duyệt không hợp lệ hoặc không có quyền duyệt.' };
    }
    dataToSave.approvedBy = approver;
  }

  if (supervisorInput) {
    dataToSave.supervisor = await userFieldToQuery(supervisorInput);
  } else {
    dataToSave.supervisor = null;
  }

  if (projectType === 'category' && estimatorInput) {
    dataToSave.estimator = await userFieldToQuery(estimatorInput);
  } else if (projectType === 'category') {
    dataToSave.estimator = null;
  }

  delete dataToSave.type; // 'type' is from req.body, not part of schema

  const project = new Model(dataToSave);
  let newProject = await project.save();
  newProject = await populateProjectFields(newProject);

  const populatedProjectForNotification = { _id: newProject._id, name: newProject.name, type: projectType };

  if (isPending) {
    const newProjectNotification = new Notification({
      message: `Có yêu cầu thêm công trình mới "${newProject.name}" từ ${user.username} cần bạn duyệt.`,
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
      io.emit('project_updated', { ...newProject.toObject(), projectType }); // Use project_updated for consistency
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
  const isCreator = project.createdBy.toString() === user.id.toString();

  const currentUpdateData = { ...updateData };
  const forbiddenFields = ['createdBy', 'enteredBy', 'categorySerialNumber', 'minorRepairSerialNumber', 'status', 'pendingEdit', 'pendingDelete', 'history'];

  if (!isUserAdmin) {
      // Nếu không phải admin, không cho phép sửa projectCode trực tiếp
      if (currentUpdateData.hasOwnProperty('projectCode')) {
          delete currentUpdateData.projectCode;
          logger.warn(`User ${user.username} (không phải admin) đã cố gắng sửa projectCode. Thay đổi này đã bị bỏ qua.`);
      }
      forbiddenFields.push('approvedBy');
  }
  forbiddenFields.forEach(field => delete currentUpdateData[field]);

  // Kiểm tra trùng lặp nếu các trường khóa (name, allocatedUnit, financialYear) thay đổi
  const newName = currentUpdateData.hasOwnProperty('name') ? currentUpdateData.name.trim() : project.name.trim();
  const newAllocatedUnit = currentUpdateData.hasOwnProperty('allocatedUnit') ? currentUpdateData.allocatedUnit.trim() : project.allocatedUnit.trim();
  const newFinancialYear = currentUpdateData.hasOwnProperty('financialYear') ? parseInt(currentUpdateData.financialYear, 10) : project.financialYear;

  if (
    (currentUpdateData.hasOwnProperty('name') && currentUpdateData.name.trim() !== project.name.trim()) ||
    (currentUpdateData.hasOwnProperty('allocatedUnit') && currentUpdateData.allocatedUnit.trim() !== project.allocatedUnit.trim()) ||
    (currentUpdateData.hasOwnProperty('financialYear') && parseInt(currentUpdateData.financialYear, 10) !== project.financialYear)
  ) {
    const conflictingProject = await Model.findOne({
      name: newName,
      allocatedUnit: newAllocatedUnit,
      financialYear: newFinancialYear,
      _id: { $ne: project._id } // Quan trọng: loại trừ chính công trình đang sửa
    });
    if (conflictingProject) {
      throw { statusCode: 409, message: `Không thể cập nhật. Công trình "${newName}" của đơn vị "${newAllocatedUnit}" trong năm ${newFinancialYear} đã tồn tại.` };
    }
  }
  // Resolve user fields
  if (currentUpdateData.hasOwnProperty('supervisor')) {
    currentUpdateData.supervisor = await userFieldToQuery(currentUpdateData.supervisor) || null;
  }
  if (projectType === 'category' && currentUpdateData.hasOwnProperty('estimator')) {
    currentUpdateData.estimator = await userFieldToQuery(currentUpdateData.estimator) || null;
  }
  if (currentUpdateData.hasOwnProperty('approvedBy') && currentUpdateData.approvedBy) {
    const newApproverId = await userFieldToQuery(currentUpdateData.approvedBy);
    if (!newApproverId) throw { statusCode: 400, message: 'Người phê duyệt mới không hợp lệ (không tìm thấy).' };
    const newApproverDoc = await User.findById(newApproverId);
    if (!newApproverDoc || !newApproverDoc.permissions.approve) {
        throw { statusCode: 400, message: 'Người phê duyệt mới không hợp lệ hoặc không có quyền duyệt.' };
    }
    currentUpdateData.approvedBy = newApproverId;
  } else if (currentUpdateData.hasOwnProperty('approvedBy') && !currentUpdateData.approvedBy) {
    currentUpdateData.approvedBy = null; // Allow clearing approver if admin
  }


  if (currentUpdateData.financialYear) {
    const parsedYear = parseInt(currentUpdateData.financialYear, 10);
    if (isNaN(parsedYear)) throw { statusCode: 400, message: 'Năm tài chính không hợp lệ.' };
    currentUpdateData.financialYear = parsedYear;
  }
  if (currentUpdateData.hasOwnProperty('isCompleted')) {
    currentUpdateData.isCompleted = currentUpdateData.isCompleted === true || String(currentUpdateData.isCompleted).toLowerCase() === 'true';
  }
  // Convert date fields
  ['reportDate', 'inspectionDate', 'paymentDate', 'startDate', 'completionDate'].forEach(dateField => {
    if (currentUpdateData.hasOwnProperty(dateField)) {
        currentUpdateData[dateField] = currentUpdateData[dateField] ? new Date(currentUpdateData[dateField]) : null;
    }
  });

  // Nếu là CategoryProject và các trường ngày tháng hồ sơ ở gốc được cập nhật
  // thì cập nhật profileTimeline và set assignmentType = 'manual'
  if (projectType === 'category' && (currentUpdateData.hasOwnProperty('startDate') || currentUpdateData.hasOwnProperty('completionDate') || currentUpdateData.hasOwnProperty('durationDays'))) {
    const newProfileTimelineData = {
      startDate: currentUpdateData.startDate !== undefined ? currentUpdateData.startDate : project.startDate,
      endDate: currentUpdateData.completionDate !== undefined ? currentUpdateData.completionDate : project.completionDate,
      durationDays: currentUpdateData.durationDays !== undefined ? (parseInt(String(currentUpdateData.durationDays), 10) || null) : project.durationDays,
      assignmentType: 'manual',
      estimator: currentUpdateData.estimator !== undefined ? currentUpdateData.estimator : project.estimator, // Cập nhật estimator nếu có
      // Giữ lại các trường khác của profileTimeline nếu có
      ...(project.profileTimeline || {}),
    };
    // Ghi đè các trường đã cập nhật
    Object.assign(newProfileTimelineData, { startDate: newProfileTimelineData.startDate, endDate: newProfileTimelineData.endDate, durationDays: newProfileTimelineData.durationDays, assignmentType: 'manual', estimator: newProfileTimelineData.estimator });
    currentUpdateData.profileTimeline = newProfileTimelineData;
  }

  // Xử lý sửa projectCode bởi Admin
  if (isUserAdmin && currentUpdateData.hasOwnProperty('projectCode')) {
    const newProjectCode = String(currentUpdateData.projectCode).trim().toUpperCase();
    if (newProjectCode && newProjectCode !== project.projectCode) {
      const existingWithNewCode = await Model.findOne({ projectCode: newProjectCode, _id: { $ne: project._id } });
      if (existingWithNewCode) {
        throw { statusCode: 400, message: `Mã công trình "${newProjectCode}" đã tồn tại.` };
      }
      project.projectCode = newProjectCode; // Gán trực tiếp vào project object
      project.history.push({
        action: 'edited', // Hoặc một action riêng 'project_code_changed'
        user: user.id,
        timestamp: new Date(),
        details: { changes: [{ field: 'projectCode', oldValue: project.projectCode, newValue: newProjectCode }] }
      });
    }
    // Xóa projectCode khỏi currentUpdateData để không bị ghi đè bởi Object.assign bên dưới
    delete currentUpdateData.projectCode;
  }

  if (isUserAdmin) {
    const originalStatus = project.status;
    Object.assign(project, currentUpdateData);
    let action = 'edited';
    let notificationMessage = `Công trình "${project.name}" đã được cập nhật bởi quản trị viên ${user.username}.`;
    let notifyUserTarget = project.createdBy;
    let notificationActionType = 'edit';

    if (originalStatus === 'Chờ duyệt' && (currentUpdateData.status === 'Đã duyệt' || (currentUpdateData.approvedBy && currentUpdateData.approvedBy.toString() === user.id.toString()))) {
        project.status = 'Đã duyệt';
        if (!project.approvedBy || project.approvedBy.toString() !== user.id.toString()) {
            project.approvedBy = user.id;
        }
        action = 'approved';
        notificationMessage = `Công trình "${project.name}" đã được duyệt bởi quản trị viên ${user.username}.`;
        notificationActionType = 'new_approved';
    }
    else if (originalStatus === 'Chờ duyệt' && project.status === 'Chờ duyệt' && project.approvedBy) {
      notificationMessage = `Công trình "${project.name}" (đang chờ duyệt bởi ${project.approvedBy?.fullName || project.approvedBy?.username || 'N/A'}) đã được cập nhật bởi quản trị viên ${user.username}. Vui lòng kiểm tra.`;
      notifyUserTarget = project.approvedBy;
    }

    project.pendingEdit = null;
    project.history.push({ action, user: user.id, timestamp: new Date(), details: { changes: project.pendingEdit?.changes || 'Admin direct edit' } });
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);

    if (notifyUserTarget && notifyUserTarget.toString() !== user.id.toString()) {
        const adminUpdateNotification = new Notification({
            message: notificationMessage, type: notificationActionType, projectId: populatedProject._id,
            projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
            status: 'processed', userId: notifyUserTarget,
        });
        await adminUpdateNotification.save();
        if (io) io.emit('notification', { ...adminUpdateNotification.toObject(), projectId: { _id: populatedProject._id, name: populatedProject.name, type: projectType } });
    }

    if (io) io.emit(action === 'approved' ? 'project_approved' : 'project_updated', { ...populatedProject.toObject(), projectType });
    return { message: 'Công trình đã được cập nhật bởi Admin.', project: populatedProject.toObject(), updated: true, pending: false };
  }

  if (user.permissions.edit) {
    const canEditDirectlyUnapproved = isCreator && project.status !== 'Đã duyệt';

    if (project.status !== 'Đã duyệt') {
      if (canEditDirectlyUnapproved) {
        Object.assign(project, currentUpdateData);
        project.history.push({ action: 'edited', user: user.id, timestamp: new Date(), details: { note: 'User edit while pending approval' } });
        await project.save({ validateModifiedOnly: true });
        const populatedProjectDirectEdit = await populateProjectFields(project);

        if (project.approvedBy && project.approvedBy.toString() !== user.id.toString()) {
            const directEditNotification = new Notification({
                message: `Công trình "${project.name}" đang chờ duyệt đã được cập nhật bởi ${user.username}. Vui lòng kiểm tra.`,
                type: 'edit', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', userId: user.id, recipientId: project.approvedBy
            });
            await directEditNotification.save();
            if (io) io.emit('notification', { ...directEditNotification.toObject(), projectId: { _id: project._id, name: project.name, type: projectType } });
        }
        if (io) io.emit('project_updated', { ...populatedProjectDirectEdit.toObject(), projectType });
        return { message: 'Công trình (chưa duyệt) đã được cập nhật.', project: populatedProjectDirectEdit.toObject(), updated: true, pending: true };
      } else {
        // Non-creator edits unapproved project -> request edit
        const changesArray = [];
        for (const field in currentUpdateData) {
          if (Object.prototype.hasOwnProperty.call(currentUpdateData, field)) {
            const projectFieldValue = project[field];
            const updateFieldValue = currentUpdateData[field];
            let changed = false;
            if (['reportDate', 'inspectionDate', 'paymentDate', 'startDate', 'completionDate'].includes(field)) {
              if (!areDatesEqual(projectFieldValue, updateFieldValue)) changed = true;
            } else {
              const val1 = projectFieldValue instanceof mongoose.Types.ObjectId ? String(projectFieldValue) : projectFieldValue;
              const val2 = updateFieldValue instanceof mongoose.Types.ObjectId ? String(updateFieldValue) : updateFieldValue;
              const normalizedVal1 = (val1 === null || val1 === undefined) ? "" : (typeof val1 === 'boolean' ? val1 : String(val1));
              const normalizedVal2 = (val2 === null || val2 === undefined) ? "" : (typeof val2 === 'boolean' ? val2 : String(val2));
              if (normalizedVal1 !== normalizedVal2) changed = true;
            }
            if (changed) changesArray.push({ field, oldValue: project[field], newValue: updateFieldValue });
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
                message: `Có yêu cầu sửa công trình "${populatedProjectRequestEditUnapproved.name}" (chưa duyệt) từ ${user.username} cần bạn duyệt.`,
                type: 'edit', projectId: populatedProjectRequestEditUnapproved._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'pending', userId: user.id,
                recipientId: project.approvedBy
            });
            await requestEditUnapprovedNotification.save();
            if (io) io.emit('notification', { ...requestEditUnapprovedNotification.toObject(), projectId: { _id: populatedProjectRequestEditUnapproved._id, name: populatedProjectRequestEditUnapproved.name, type: projectType } });
        }
        if (io) io.emit('project_updated', { ...populatedProjectRequestEditUnapproved.toObject(), projectType });
        return { message: 'Yêu cầu sửa công trình (chưa duyệt) đã được gửi để chờ duyệt.', project: populatedProjectRequestEditUnapproved.toObject(), updated: true, pending: true };
      }
    } else { // Project IS approved -> request edit
        const changesArray = [];
        for (const field in currentUpdateData) {
          if (Object.prototype.hasOwnProperty.call(currentUpdateData, field)) {
            const projectFieldValue = project[field];
            const updateFieldValue = currentUpdateData[field];
            let changed = false;
            if (['reportDate', 'inspectionDate', 'paymentDate', 'startDate', 'completionDate'].includes(field)) {
              if (!areDatesEqual(projectFieldValue, updateFieldValue)) changed = true;
            } else {
              const val1 = projectFieldValue instanceof mongoose.Types.ObjectId ? String(projectFieldValue) : projectFieldValue;
              const val2 = updateFieldValue instanceof mongoose.Types.ObjectId ? String(updateFieldValue) : updateFieldValue;
              const normalizedVal1 = (val1 === null || val1 === undefined) ? "" : (typeof val1 === 'boolean' ? val1 : String(val1));
              const normalizedVal2 = (val2 === null || val2 === undefined) ? "" : (typeof val2 === 'boolean' ? val2 : String(val2));
              if (normalizedVal1 !== normalizedVal2) changed = true;
            }
            if (changed) changesArray.push({ field, oldValue: project[field], newValue: updateFieldValue });
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
              message: `Có yêu cầu sửa công trình "${populatedProjectRequestEditApproved.name}" từ ${user.username} cần bạn duyệt.`,
              type: 'edit', projectId: populatedProjectRequestEditApproved._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'pending', userId: user.id,
              recipientId: project.approvedBy
            });
            await requestEditApprovedNotification.save();
            if (io) io.emit('notification', { ...requestEditApprovedNotification.toObject(), projectId: populatedProjectForNotification });
        }
        if (io) io.emit('project_updated', { ...populatedProjectRequestEditApproved.toObject(), projectType });
        return { message: 'Yêu cầu sửa đã được gửi để chờ duyệt.', project: populatedProjectRequestEditApproved.toObject(), updated: true, pending: true };
    }
  }
  throw { statusCode: 403, message: 'Không có quyền sửa công trình này hoặc gửi yêu cầu sửa.' };
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
    const pendingDeleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending', projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (pendingDeleteNotification) {
        pendingDeleteNotification.status = 'processed';
        await pendingDeleteNotification.save();
        if (io) io.emit('notification_processed', pendingDeleteNotification._id);
    }
    const adminDeleteConfirmationNotification = new Notification({
        message: `Công trình "${originalProjectName}" đã được xóa bởi quản trị viên ${user.username}.`,
        type: 'delete_approved', projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed', userId: originalCreatorId, originalProjectId: projectId,
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

    if (project.status !== 'Đã duyệt') {
        if (canPerformDirectDeleteUnapproved) {
            await Model.deleteOne({ _id: projectId });
            await updateSerialNumbers(projectType);
            const directDeleteNotification = new Notification({
                message: `Công trình "${originalProjectName}" (chưa duyệt) đã được xóa bởi ${user.username}.`,
                type: 'delete_approved', projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'processed', userId: originalApproverId || originalCreatorId, originalProjectId: projectId,
            });
            await directDeleteNotification.save();
            if (io) {
                io.emit('notification', { ...directDeleteNotification.toObject(), projectId: { _id: projectId, name: originalProjectName, type: projectType } });
                io.emit('project_deleted', { projectId: projectId, projectType: projectType, projectName: originalProjectName });
            }
            return { message: `Công trình "${originalProjectName}" (chưa duyệt) đã được xóa.`, pendingDelete: false };
        } else {
            if (project.pendingDelete) {
                 return { message: `Công trình "${originalProjectName}" (chưa duyệt) đã được yêu cầu xóa trước đó.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
            }
            project.pendingDelete = true;
            project.history.push({ action: 'delete_requested', user: user.id, timestamp: new Date(), details: { note: 'Delete request on unapproved project by non-creator' } });
            await project.save();
            const populatedProjectForNotification = { _id: project._id, name: project.name, type: projectType };
            const requestDeleteUnapprovedNotification = new Notification({
                message: `Có yêu cầu xóa công trình "${project.name}" (chưa duyệt) từ ${user.username} cần bạn duyệt.`,
                type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', userId: user.id, recipientId: originalApproverId || project.approvedBy
            });
            await requestDeleteUnapprovedNotification.save();
            if (io) io.emit('notification', { ...requestDeleteUnapprovedNotification.toObject(), projectId: populatedProjectForNotification });
            if (io) io.emit('project_updated', { ...(await populateProjectFields(project)).toObject(), projectType });
            return { message: `Yêu cầu xóa công trình "${originalProjectName}" (chưa duyệt) đã được gửi để chờ duyệt.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
        }
    } else { // Project IS approved -> request delete
            if (project.pendingDelete) {
                 return { message: `Công trình "${originalProjectName}" đã được yêu cầu xóa trước đó.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
            }
            project.pendingDelete = true;
            project.history.push({ action: 'delete_requested', user: user.id, timestamp: new Date() });
            await project.save();
            const populatedProjectForNotification = { _id: project._id, name: project.name, type: projectType };
            const requestDeleteApprovedNotification = new Notification({
                message: `Có yêu cầu xóa công trình "${project.name}" từ ${user.username} cần bạn duyệt.`,
                type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', userId: user.id, recipientId: originalApproverId || project.approvedBy
            });
            await requestDeleteApprovedNotification.save();
            if (io) io.emit('notification', { ...requestDeleteApprovedNotification.toObject(), projectId: populatedProjectForNotification });
            if (io) io.emit('project_updated', { ...(await populateProjectFields(project)).toObject(), projectType });
            return { message: `Yêu cầu xóa công trình "${originalProjectName}" đã được gửi để chờ duyệt.`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
    }
  }
  throw { statusCode: 403, message: 'Không có quyền xóa hoặc gửi yêu cầu xóa công trình này.' };
};


const importProjectsBatch = async (projectsToImport, user, projectType, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const validationResults = [];
  const projectsToSavePayloads = [];
  let hasAnyError = false;

  // Define Joi schemas for validation
  const baseProjectSchema = Joi.object({
    name: Joi.string().trim().required().messages({ 'any.required': 'Tên công trình là bắt buộc.', 'string.empty': 'Tên công trình không được để trống.' }),
    allocatedUnit: Joi.string().trim().required().messages({ 'any.required': 'Đơn vị phân bổ là bắt buộc.', 'string.empty': 'Đơn vị phân bổ không được để trống.' }),
    location: Joi.string().trim().required().messages({ 'any.required': 'Địa điểm là bắt buộc.', 'string.empty': 'Địa điểm không được để trống.' }),
    scale: Joi.string().trim().required().messages({ 'any.required': 'Quy mô là bắt buộc.', 'string.empty': 'Quy mô không được để trống.' }),
    financialYear: Joi.number().integer().min(2000).max(2100).optional().allow(null, ''),
    isCompleted: Joi.boolean().optional().allow(null, ''),
    approvedBy: Joi.string().optional().allow(null, ''), // Sẽ được resolve thành ID
    supervisor: Joi.string().optional().allow(null, ''), // Sẽ được resolve thành ID
    initialValue: Joi.number().optional().allow(null, ''),
    taskDescription: Joi.string().optional().allow(null, ''),
    notes: Joi.string().optional().allow(null, ''),
    leadershipApproval: Joi.string().optional().allow(null, ''),
    projectCode: Joi.string().trim().uppercase().optional().allow(null, ''), // Cho phép projectCode từ Excel
  }).unknown(true); // Cho phép các trường khác không được định nghĩa tường minh

  const categoryProjectImportSchema = baseProjectSchema.keys({
    projectType: Joi.string().trim().required().messages({ 'any.required': 'Loại công trình là bắt buộc.', 'string.empty': 'Loại công trình không được để trống.' }),
    estimator: Joi.string().optional().allow(null, ''), // Sẽ được resolve thành ID
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

    try { // Bắt đầu khối try cho việc xử lý từng project
      const schema = projectType === 'category' ? categoryProjectImportSchema : minorRepairProjectImportSchema;
      const { error: joiValidationError, value } = schema.validate(projectDataFromExcel, { abortEarly: false, stripUnknown: false });
      if (joiValidationError) {
        // Gắn một thuộc tính để dễ nhận diện lỗi Joi trong khối catch chung
        joiValidationError.isJoiError = true;
        throw joiValidationError;
      }
      dataToValidateAndSave = value;

      // Xử lý financialYear
      if (dataToValidateAndSave.hasOwnProperty('financialYear')) {
        dataToValidateAndSave.financialYear = dataToValidateAndSave.financialYear ? parseInt(String(dataToValidateAndSave.financialYear), 10) : new Date().getFullYear();
      } else {
        dataToValidateAndSave.financialYear = new Date().getFullYear();
      }
      // Xử lý isCompleted
      if (dataToValidateAndSave.hasOwnProperty('isCompleted')) {
        dataToValidateAndSave.isCompleted = dataToValidateAndSave.isCompleted === true || String(dataToValidateAndSave.isCompleted).toLowerCase() === 'true';
      } else {
        dataToValidateAndSave.isCompleted = false;
      }

      // Đảm bảo tất cả các trường model từ Excel được xem xét nếu chưa có trong dữ liệu đã validate
      const allModelFields = Object.keys(Model.schema.paths);
      allModelFields.forEach(modelFieldKey => {
        if (projectDataFromExcel.hasOwnProperty(modelFieldKey) && !dataToValidateAndSave.hasOwnProperty(modelFieldKey)) {
          dataToValidateAndSave[modelFieldKey] = projectDataFromExcel[modelFieldKey];
        }
      });

      // Validate quyền dựa trên đơn vị của người dùng
      if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
        if (dataToValidateAndSave.allocatedUnit !== user.unit && !user.permissions.viewOtherBranchProjects) {
          throw new Error(`Đơn vị phân bổ "${dataToValidateAndSave.allocatedUnit}" không thuộc chi nhánh của bạn (${user.unit}).`);
        }
      }

      // Resolve các trường tham chiếu người dùng
      const userRefFieldsToProcess = {
        approvedBy: { required: user.role !== 'admin' }, // Bắt buộc nếu không phải admin
        supervisor: { required: false },
        estimator: { required: false, categoryOnly: true }
      };

      for (const fieldName in userRefFieldsToProcess) {
        const config = userRefFieldsToProcess[fieldName];
        if (config.categoryOnly && projectType !== 'category') continue;
        let userIdentifier = dataToValidateAndSave[fieldName];
        if (userIdentifier) {
          const resolvedUserId = await userFieldToQuery(String(userIdentifier));
          if (resolvedUserId) {
            const userFoundById = await User.findById(resolvedUserId).select('_id permissions fullName username');
            if (!userFoundById) {
              if (config.required) throw new Error(`Không tìm thấy người dùng với thông tin "${userIdentifier}" cho trường "${fieldName}".`);
              dataToValidateAndSave[fieldName] = null;
            } else {
              if (fieldName === 'approvedBy' && !userFoundById.permissions?.approve) {
                throw new Error(`Người dùng "${userFoundById.fullName || userFoundById.username}" (ID: ${userIdentifier}) không có quyền phê duyệt.`);
              }
              dataToValidateAndSave[fieldName] = userFoundById._id; // Lưu ID
            }
          } else { // Không resolve được userIdentifier
            if (config.required) throw new Error(`Không tìm thấy người dùng với thông tin "${userIdentifier}" cho trường ${fieldName}.`);
            dataToValidateAndSave[fieldName] = null;
          }
        } else if (config.required) { // UserIdentifier rỗng nhưng trường là bắt buộc
          throw new Error(`Trường ${fieldName} là bắt buộc.`);
        } else { // UserIdentifier rỗng và trường không bắt buộc
          dataToValidateAndSave[fieldName] = null;
        }
      }

      const finalPayload = { ...dataToValidateAndSave };
      finalPayload.enteredBy = user.username;
      finalPayload.createdBy = user.id;
      finalPayload.history = [{ action: 'created', user: user.id, timestamp: new Date() }];

      if (user.role === 'admin') {
        finalPayload.status = 'Đã duyệt';
        finalPayload.approvedBy = user.id; // Admin tự duyệt
        finalPayload.history.push({ action: 'approved', user: user.id, timestamp: new Date(), details: "Admin direct import" });
      } else {
        finalPayload.status = 'Chờ duyệt';
        if (!finalPayload.approvedBy) { // Đã validate ở trên
          throw new Error(`Người phê duyệt là bắt buộc khi nhập bởi người dùng không phải Admin.`);
        }
      }

      // Chuyển đổi các trường ngày tháng (Joi đã validate là ISO string) thành Date objects
      ['reportDate', 'inspectionDate', 'paymentDate', 'startDate', 'completionDate'].forEach(dateField => {
        if (finalPayload.hasOwnProperty(dateField) && finalPayload[dateField]) {
          const dateVal = new Date(finalPayload[dateField]);
          if (!isNaN(dateVal.getTime())) {
            finalPayload[dateField] = dateVal;
          } else {
            // Nếu Joi đã pass mà new Date() vẫn lỗi, có thể là do Excel date number chưa được xử lý
            // Hoặc frontend gửi định dạng không chuẩn ISO mà Joi lại chấp nhận.
            // Thêm xử lý cho Excel date number nếu cần.
            if (typeof finalPayload[dateField] === 'number' && finalPayload[dateField] > 25569) {
                const excelDateNumber = finalPayload[dateField];
                finalPayload[dateField] = new Date(Math.round((excelDateNumber - 25569) * 86400 * 1000));
                if (isNaN(finalPayload[dateField].getTime())) {
                    logger.warn(`Invalid Excel date number for ${dateField}: ${excelDateNumber} for project ${originalProjectNameForDisplay}`);
                    finalPayload[dateField] = null;
                }
            } else {
                logger.warn(`Invalid date string for ${dateField}: ${finalPayload[dateField]} for project ${originalProjectNameForDisplay}`);
                finalPayload[dateField] = null;
            }
          }
        }
      });

      // Dọn dẹp các trường không thuộc schema
      const schemaKeys = new Set(allModelFields);
      for (const key in finalPayload) {
        if (!schemaKeys.has(key) && key !== 'history') { // Cho phép 'history' vì nó được push
          delete finalPayload[key];
        }
      }
      delete finalPayload.type; // 'type' từ req.body, không phải của schema project

      projectsToSavePayloads.push(finalPayload);
      validationResults.push({ success: true, projectName: originalProjectNameForDisplay, rowIndex: i });

    } catch (err) { // Khối catch chung
      hasAnyError = true;
      const rowErrors = {};
      let errorMessage = 'Lỗi không xác định trong quá trình xử lý.';
      let errorField = null;

      if (err.isJoiError || (err.details && Array.isArray(err.details))) { // Kiểm tra lỗi Joi
        errorMessage = err.message;
        if (err.details && Array.isArray(err.details)) {
            err.details.forEach(detail => {
                rowErrors[detail.path.join('.')] = detail.message;
            });
            errorField = err.details?.[0]?.path.join('.');
        } else {
            rowErrors['general'] = err.message;
        }
        logger.error(`Lỗi Joi validate công trình "${originalProjectNameForDisplay}" (hàng ${i + 1}) từ Excel:`, { message: err.message, data: projectDataFromExcel, path: 'importProjectsBatch' });
      } else { // Các lỗi khác (custom hoặc không mong muốn)
        errorMessage = err.message || 'Lỗi không xác định.';
        rowErrors['general'] = errorMessage;
        if (err.message.includes("không thuộc chi nhánh của bạn") || err.message.includes("Người phê duyệt là bắt buộc") || err.message.includes("Không tìm thấy người dùng") || err.message.includes("không có quyền phê duyệt")) {
            logger.error(`Lỗi xử lý công trình "${originalProjectNameForDisplay}" (hàng ${i + 1}) từ Excel:`, { message: err.message, data: projectDataFromExcel, path: 'importProjectsBatch' });
        } else {
            logger.error(`Lỗi không xác định khi xử lý công trình "${originalProjectNameForDisplay}" (hàng ${i + 1}) từ Excel:`, { message: err.message, stack: err.stack, data: projectDataFromExcel, path: 'importProjectsBatch' });
        }
      }
      validationResults.push({ success: false, projectName: originalProjectNameForDisplay, error: errorMessage, rowIndex: i, field: errorField, details: rowErrors });
    } // Đóng khối try-catch chung
  } // Đóng vòng lặp for

  if (hasAnyError) {
    const errorResponse = new Error('Có lỗi trong dữ liệu Excel. Vui lòng kiểm tra và thử lại.');
    errorResponse.statusCode = 400;
    errorResponse.results = validationResults; // Gửi kết quả validate chi tiết về frontend
    throw errorResponse;
  }

  const savedProjectsResults = [];
  let importedCount = 0;
  for (let k = 0; k < projectsToSavePayloads.length; k++) {
    const projectPayload = projectsToSavePayloads[k];
    // Lấy rowIndex gốc từ validationResults để báo lỗi đúng hàng nếu có lỗi ở bước lưu
    const originalRowIndex = validationResults.find(vr => vr.projectName === projectPayload.name && vr.success)?.rowIndex ?? k;

    try { // Bắt đầu khối try cho việc lưu từng project
      // Kiểm tra trùng lặp nghiêm ngặt trước khi lưu
      const existingProject = await Model.findOne({
        name: { $regex: `^${String(projectPayload.name).trim()}$`, $options: 'i' },
        allocatedUnit: { $regex: `^${String(projectPayload.allocatedUnit).trim()}$`, $options: 'i' },
        financialYear: projectPayload.financialYear
      });

      if (existingProject) {
        const errorMessage = `Công trình "${projectPayload.name}" của đơn vị "${projectPayload.allocatedUnit}" trong năm ${projectPayload.financialYear} đã tồn tại trong CSDL.`;
        logger.warn(`[Import Excel] Bỏ qua công trình trùng lặp: ${errorMessage}`);
        savedProjectsResults.push({ success: false, projectName: projectPayload.name, error: errorMessage, rowIndex: originalRowIndex });
        continue; // QUAN TRỌNG: Bỏ qua không lưu công trình này
      }

      // Tạo projectCode nếu chưa có hoặc rỗng
      if (!projectPayload.projectCode || String(projectPayload.projectCode).trim() === '') {
        try {
            projectPayload.projectCode = await generateProjectCode(
                projectType,
                projectPayload.financialYear,
                projectPayload.allocatedUnit, // Truyền tên hoặc ID
                projectPayload.allocationWave // Truyền tên hoặc ID (chỉ cho category)
            ); // Mặc định previewMode = false
            if (!projectPayload.projectCode) {
                // Điều này có thể xảy ra nếu generateProjectCode trả về null (ví dụ, không tìm thấy unit shortCode)
                logger.warn(`Không thể tạo mã cho công trình: ${projectPayload.name} do thiếu thông tin đơn vị/đợt. Mã sẽ để trống.`);
            }
        } catch (codeGenError) {
            logger.error(`Lỗi tạo projectCode cho công trình "${projectPayload.name}" khi nhập Excel: ${codeGenError.message}. Mã sẽ để trống.`);
            projectPayload.projectCode = null; // Hoặc một giá trị mặc định nếu cần
        }
      }


      const project = new Model(projectPayload);
      let newProject = await project.save();
      newProject = await populateProjectFields(newProject); // Populate để trả về đầy đủ thông tin

      if (projectPayload.status === 'Chờ duyệt') {
        const notification = new Notification({
          message: `Yêu cầu thêm công trình mới "${newProject.name}" (từ Excel) đã được gửi để duyệt`,
          type: 'new',
          projectId: newProject._id,
          projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'pending',
          userId: user.id,
          recipientId: projectPayload.approvedBy // Đã được resolve thành ID ở bước trước
        });
        await notification.save();
        if (io) io.emit('notification', { ...notification.toObject(), projectId: { _id: newProject._id, name: newProject.name, type: projectType } });
      } else { // Admin import, đã duyệt
        if (io) io.emit('project_updated', { ...newProject.toObject(), projectType }); // Hoặc 'project_created'
      }
      savedProjectsResults.push({ success: true, projectName: newProject.name, project: newProject.toObject(), rowIndex: originalRowIndex });
      importedCount++;
    } catch (dbError) { // Đóng khối try cho việc lưu từng project
      logger.error(`Lỗi khi lưu công trình "${projectPayload.name}" từ Excel (sau validate):`, { message: dbError.message, data: projectPayload, path: 'importProjectsBatch' });
      // Thêm lỗi vào savedProjectsResults cho dòng cụ thể này
      savedProjectsResults.push({ success: false, projectName: projectPayload.name, error: `Lỗi CSDL: ${dbError.message}`, rowIndex: originalRowIndex });
      // Không throw lỗi ở đây để các công trình khác vẫn được xử lý,
      // frontend sẽ nhận được mảng results và hiển thị trạng thái từng dòng.
    } // Đóng khối catch cho việc lưu từng project
  } // Đóng vòng lặp for thứ hai
  // Kiểm tra xem có lỗi nào xảy ra trong quá trình lưu không
  const hasSavingErrors = savedProjectsResults.some(r => !r.success);
  if (hasSavingErrors) {
    // Trả về kết quả hỗn hợp: một số thành công, một số thất bại.
    // Frontend sẽ nhận mảng này và có thể hiển thị trạng thái từng dòng.
    return {
        message: `Hoàn tất nhập từ Excel. Đã nhập thành công ${importedCount} công trình. Một số công trình có thể đã gặp lỗi khi lưu.`,
        results: savedProjectsResults, // Gửi kết quả chi tiết về frontend
        partialSuccess: true
    };
  }

  return { message: `Hoàn tất nhập từ Excel. Đã nhập thành công ${importedCount} công trình.`, results: savedProjectsResults };
};


const checkDuplicatesFromExcel = async (projectsFromExcel, projectType) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const results = [];

  for (let i = 0; i < projectsFromExcel.length; i++) {
    const project = projectsFromExcel[i];
    const { name, allocatedUnit, financialYear: rawFinancialYear } = project;
    let isDuplicate = false;
    let existingProjectName = null;
    let existingProjectId = null;

    const financialYear = rawFinancialYear ? parseInt(String(rawFinancialYear), 10) : new Date().getFullYear();

    if (name && allocatedUnit && !isNaN(financialYear)) {
      const existing = await Model.findOne({
        name: { $regex: `^${escapeRegExp(String(name).trim())}$`, $options: 'i' },
        allocatedUnit: { $regex: `^${escapeRegExp(String(allocatedUnit).trim())}$`, $options: 'i' },
        financialYear: financialYear,
      }).select('_id name'); // Chỉ lấy _id và name để hiển thị

      if (existing) {
        isDuplicate = true;
        existingProjectId = existing._id.toString();
        existingProjectName = existing.name;
      }
    }
    results.push({
      originalIndex: i, // Giữ lại index gốc từ mảng input để frontend map lại
      isDuplicate,
      existingProjectId,
      existingProjectName,
      excelProjectName: name, // Trả lại tên từ excel để dễ đối chiếu
    });
  }
  return results;
};


module.exports = {
  getProjectsList,
  createNewProject,
  updateProjectById,
  deleteProjectById,
  importProjectsBatch,
  checkDuplicatesFromExcel,
};
