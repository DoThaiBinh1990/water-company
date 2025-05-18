// d:\CODE\water-company\backend\server\services\project.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, User, Notification, RejectedProject, SerialCounter } = require('../models');
const { populateProjectFields, updateSerialNumbers } = require('../utils');
const logger = require('../config/logger'); // Đã sửa đường dẫn này

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

  if (pending === 'true' || pending === true) {
    query.$or = [
      { status: 'Chờ duyệt' },
      { pendingEdit: { $ne: null, $exists: true } },
      { pendingDelete: true }
    ];
  } else if (status) {
    query.status = status;
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
      query.allocatedUnit = user.unit;
    }
  }

  const count = await Model.countDocuments(query);
  const projectsFromDB = await Model.find(query)
    .populate('createdBy', 'username fullName')
    .populate('approvedBy', 'username fullName')
    .populate('supervisor', 'username fullName')
    .populate(type === 'category' ? { path: 'estimator', select: 'username fullName' } : '')
    .populate({ path: 'pendingEdit.requestedBy', select: 'username fullName' })
    .sort({ createdAt: -1 }) // Sắp xếp theo ngày tạo mới nhất
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  // Populate fields for each project
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
  const { name, allocatedUnit, location, approvedBy, scale, reportDate, supervisor: supervisorInput, estimator: estimatorInput, ...restData } = projectData;

  if (!name || !allocatedUnit || !location || !approvedBy) {
    throw { statusCode: 400, message: 'Tên công trình, Đơn vị phân bổ, Địa điểm, và Người phê duyệt là bắt buộc.' };
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
    ...restData, // Bao gồm các trường khác như initialValue, notes, etc.
    enteredBy: user.username, 
    createdBy: user.id, 
    status: 'Chờ duyệt' 
  };

  if (projectType === 'minor_repair') {
    dataToSave.reportDate = reportDate;
  }


  // Kiểm tra quyền tạo công trình dựa trên đơn vị của user
  if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
    if (dataToSave.allocatedUnit !== user.unit) {
      // Nếu user chi nhánh cố tạo cho đơn vị khác unit của họ VÀ họ không có quyền viewOtherBranchProjects (ngầm định là không có quyền tạo cho đơn vị khác)
      // Hoặc có thể thêm một quyền riêng "createForOtherBranch"
      if (!user.permissions.viewOtherBranchProjects) { // Tạm dùng quyền này để kiểm soát
        throw { statusCode: 403, message: `Bạn chỉ có thể tạo công trình cho chi nhánh ${user.unit}.` };
      }
    }
  } else if (!user.role.includes('admin') && !user.role.includes('office') && !user.role.includes('director')) {
    // Các vai trò không phải admin/công ty/giám đốc mà không có unit thì không được tạo
    if (!user.unit) throw { statusCode: 403, message: 'Tài khoản của bạn chưa được gán đơn vị, không thể tạo công trình.' };
  }


  const approver = await User.findById(approvedBy);
  if (!approver || !approver.permissions.approve) {
    throw { statusCode: 400, message: 'Người duyệt không hợp lệ hoặc không có quyền duyệt.' };
  }
  dataToSave.approvedBy = approvedBy;

  // Xử lý supervisor và estimator (nếu có)
  if (supervisorInput) {
    if (mongoose.Types.ObjectId.isValid(supervisorInput)) {
      const supervisorUser = await User.findById(supervisorInput);
      if (supervisorUser) dataToSave.supervisor = supervisorUser._id;
      else dataToSave.supervisor = null; // Hoặc báo lỗi nếu ID không tìm thấy
    } else {
      dataToSave.supervisor = null; // Nếu không phải ID hợp lệ
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
  const notification = new Notification({
    message: `Yêu cầu thêm công trình mới "${newProject.name}" đã được gửi để duyệt`,
    type: 'new',
    projectId: newProject._id,
    projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
    status: 'pending',
    userId: user.id,
    recipientId: newProject.approvedBy // Gửi cho người duyệt đã chọn
  });
  await notification.save();
  if (io) {
    io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
  } else {
    logger.warn('Socket.IO không được khởi tạo trong service, bỏ qua gửi thông báo.');
  }

  return { message: 'Công trình đã được gửi để duyệt!', project: newProject.toObject(), pending: true };
};

const updateProjectById = async (projectId, projectType, updateData, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình' };
  }

  // Kiểm tra quyền sửa dựa trên đơn vị của user và công trình
  if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
    if (project.allocatedUnit !== user.unit) {
      if (!user.permissions.viewOtherBranchProjects) { 
        throw { statusCode: 403, message: `Bạn chỉ có thể sửa công trình thuộc chi nhánh ${user.unit}.` };
      }
    }
    // Staff-branch và manager-branch có thể sửa công trình của chi nhánh mình nếu có quyền user.permissions.edit
    // Không cần kiểm tra isProjectCreator nữa nếu họ có quyền edit chung cho chi nhánh.
  }

  const isUserAdmin = user.role === 'admin';
  const isUserOfficeManagement = ['director', 'deputy_director', 'manager-office', 'deputy_manager-office'].includes(user.role);
  
  const currentUpdateData = { ...updateData };
  const forbiddenFields = ['createdBy', 'enteredBy', 'categorySerialNumber', 'minorRepairSerialNumber', 'status', 'pendingEdit', 'pendingDelete'];
  if (!(isUserAdmin || isUserOfficeManagement) || project.status === 'Đã duyệt') {
      forbiddenFields.push('approvedBy');
  }
  forbiddenFields.forEach(field => delete currentUpdateData[field]);

  // Xử lý supervisor và estimator nếu có trong updateData
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

  // 1. Admin và Quản lý công ty (Phòng/Ban, TGĐ, PTGĐ) có thể sửa trực tiếp
  if (isUserAdmin || isUserOfficeManagement) {
    Object.assign(project, currentUpdateData);
    if (project.status === 'Chờ duyệt') {
        project.status = 'Đã duyệt';
        project.approvedBy = currentUpdateData.approvedBy || user.id; 
    }
    project.pendingEdit = null; 
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);
    if (io) io.emit('project_updated', { ...populatedProject.toObject(), projectType });
    return { message: 'Công trình đã được cập nhật.', project: populatedProject.toObject(), updated: true };
  }

  // 2. Các vai trò khác có quyền 'edit'
  if (user.permissions.edit) {
    let canEditDirectlyUnapproved = false;
    let canRequestEditApproved = false;

    if (user.role === 'staff-office') { // Nhân viên phòng công ty
      canEditDirectlyUnapproved = true;
      canRequestEditApproved = true;
    } else if (user.role.includes('-branch')) { // manager-branch và staff-branch
      if (user.unit && project.allocatedUnit === user.unit) { // Phải thuộc chi nhánh của họ
        canEditDirectlyUnapproved = true;
        canRequestEditApproved = true;
      }
    }

    if (project.status !== 'Đã duyệt') { // Công trình CHƯA DUYỆT
      if (canEditDirectlyUnapproved) {
        Object.assign(project, currentUpdateData);
        await project.save({ validateModifiedOnly: true });
        const populatedProject = await populateProjectFields(project);
        const approverForNotification = await User.findById(project.approvedBy);
        if (approverForNotification) {
            const notification = new Notification({
                message: `Công trình "${project.name}" đang chờ duyệt đã được cập nhật bởi ${user.username}. Vui lòng kiểm tra.`,
                type: 'edit_pending',
                projectId: project._id,
                projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending',
                userId: user.id,
                recipientId: project.approvedBy
            });
            await notification.save();
            if (io) io.emit('notification', { ...notification.toObject(), projectId: { _id: project._id, name: project.name, type: projectType } });
        }
        return { message: 'Công trình đã được cập nhật (trước duyệt).', project: populatedProject.toObject(), updated: true };
      } else {
        throw { statusCode: 403, message: 'Không có quyền sửa công trình này khi chưa duyệt.' };
      }
    } else { // Công trình ĐÃ DUYỆT -> tạo pendingEdit
      if (canRequestEditApproved) {
        const dataToPending = { ...currentUpdateData };
        const changesArray = [];
        for (const field in dataToPending) {
          if (Object.prototype.hasOwnProperty.call(dataToPending, field)) {
            const nonEditableFields = ['_id', '__v', 'createdAt', 'updatedAt'];
            if (!nonEditableFields.includes(field) && String(project[field]) !== String(dataToPending[field])) {
              changesArray.push({ field, oldValue: project[field], newValue: dataToPending[field] });
            }
          }
        }

        if (changesArray.length === 0) {
          const populatedNoChangeProject = await populateProjectFields(project);
          return { message: 'Không có thay đổi nào được ghi nhận để yêu cầu sửa.', project: populatedNoChangeProject.toObject(), updated: false };
        }

        project.pendingEdit = { data: dataToPending, changes: changesArray, requestedBy: user.id, requestedAt: new Date() };
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
        return { message: 'Yêu cầu sửa đã được gửi để chờ duyệt', project: populatedProject.toObject(), updated: true, pending: true };
      } else {
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
    throw { statusCode: 404, message: 'Không tìm thấy công trình để xóa trong service' };
  }
  const originalProjectName = project.name;
  const originalCreatorId = project.createdBy;

  // Kiểm tra quyền xóa dựa trên đơn vị của user và công trình
  if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
    if (project.allocatedUnit !== user.unit) {
      if (!user.permissions.viewOtherBranchProjects) { 
        throw { statusCode: 403, message: `Bạn chỉ có thể xóa công trình thuộc chi nhánh ${user.unit}.` };
      }
    }
  }

  // Admin có thể xóa trực tiếp
  if (user.role === 'admin') {
    await Model.deleteOne({ _id: projectId });
    await updateSerialNumbers(projectType);
    // ... (xử lý notification)
    const pendingDeleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending' });
    if (pendingDeleteNotification) {
        pendingDeleteNotification.status = 'processed';
        await pendingDeleteNotification.save();
        if (io) io.emit('notification_processed', pendingDeleteNotification._id);
    }
    const deletedConfirmationNotification = new Notification({
        message: `Công trình "${originalProjectName}" đã được xóa bởi ${user.username}.`,
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
    return { message: `Công trình "${originalProjectName}" đã được xóa bởi admin.` };
  }

  // User có quyền delete
  if (user.permissions.delete) {
    let canPerformAction = false;
    if (user.role.includes('office') || user.role.includes('director')) { // Quản lý công ty, Nhân viên phòng -> Xóa/YC xóa tất cả
        canPerformAction = true;
    } else if (user.role.includes('-branch')) { // manager-branch và staff-branch
        if (user.unit && project.allocatedUnit === user.unit) { // Phải thuộc chi nhánh của họ
            canPerformAction = true;
        }
    }

    if (canPerformAction) {
        if (project.status !== 'Đã duyệt' && !project.pendingDelete) { // Xóa trực tiếp công trình CHƯA DUYỆT
            await Model.deleteOne({ _id: projectId });
            await updateSerialNumbers(projectType);
            // ... (xử lý notification)
            const deletedConfirmationNotification = new Notification({ /* ... */ }); // Tương tự như admin
            await deletedConfirmationNotification.save();
            if (io) { /* ... */ }
            return { message: `Công trình "${originalProjectName}" (chưa duyệt) đã được xóa.` };
        } else if (!project.pendingDelete) { // Yêu cầu xóa công trình ĐÃ DUYỆT
            project.pendingDelete = true;
            await project.save();
            const populatedProjectForNotification = { _id: project._id, name: project.name, type: projectType };
            const notification = new Notification({
                message: `Yêu cầu xóa công trình "${project.name}" bởi ${user.username}`,
                type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
                status: 'pending', userId: user.id,
                recipientId: project.approvedBy // Gửi cho người duyệt hiện tại
            });
            await notification.save();
            if (io) io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
            return { message: `Yêu cầu xóa công trình "${originalProjectName}" đã được gửi!`, project: (await populateProjectFields(project)).toObject(), pendingDelete: true };
        }
        // Nếu đã có pendingDelete, và user không phải approver, thì không làm gì thêm (controller sẽ chặn nếu cần)
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
    { name: 'approvedBy', label: 'Người phê duyệt' },
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
    let dataToValidate = {};

    try {
      for (const fieldConfig of basicRequiredFieldsConfig) {
        const fieldValue = projectDataFromExcel[fieldConfig.name];
        if (fieldValue === null || fieldValue === undefined || String(fieldValue).trim() === '') {
          throw new Error(`Trường "${fieldConfig.label}" là bắt buộc.`);
        }
        dataToValidate[fieldConfig.name] = fieldValue;
      }

      const allModelFields = Object.keys(Model.schema.paths);
      allModelFields.forEach(modelFieldKey => {
        if (projectDataFromExcel.hasOwnProperty(modelFieldKey) && !dataToValidate.hasOwnProperty(modelFieldKey)) {
            dataToValidate[modelFieldKey] = projectDataFromExcel[modelFieldKey];
        }
      });
      
      // Kiểm tra quyền tạo công trình dựa trên đơn vị của user cho từng dòng Excel
      if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit) {
        if (dataToValidate.allocatedUnit !== user.unit) {
          if (!user.permissions.viewOtherBranchProjects) { // Tạm dùng quyền này
            throw new Error(`Bạn chỉ có thể nhập công trình cho chi nhánh ${user.unit}. Công trình "${originalProjectNameForDisplay}" thuộc đơn vị ${dataToValidate.allocatedUnit}.`);
          }
        }
      }


      const userRefFields = ['approvedBy', 'supervisor', 'estimator'];
      for (const field of userRefFields) {
        const fieldValue = dataToValidate[field];
        if (fieldValue) {
          if (mongoose.Types.ObjectId.isValid(fieldValue)) {
            const userFoundById = await User.findById(fieldValue).select('_id permissions fullName username');
            if (!userFoundById) {
              if (field === 'approvedBy') throw new Error(`Không tìm thấy người dùng với ID "${fieldValue}" cho trường Người phê duyệt.`);
              dataToValidate[field] = null;
            } else {
              if (field === 'approvedBy' && !userFoundById.permissions?.approve) {
                throw new Error(`Người dùng "${userFoundById.fullName || userFoundById.username}" (ID: ${fieldValue}) không có quyền phê duyệt.`);
              }
              dataToValidate[field] = userFoundById._id;
            }
          } else if (typeof fieldValue === 'string') {
            const userFoundByName = await User.findOne({
              $or: [{ username: fieldValue }, { fullName: fieldValue }],
            }).select('_id permissions fullName username');
            if (!userFoundByName) {
              if (field === 'approvedBy') throw new Error(`Không tìm thấy người dùng có tên/username "${fieldValue}" cho trường Người phê duyệt.`);
              dataToValidate[field] = null;
            } else {
              if (field === 'approvedBy' && !userFoundByName.permissions?.approve) {
                throw new Error(`Người dùng "${userFoundByName.fullName || userFoundByName.username}" không có quyền phê duyệt.`);
              }
              dataToValidate[field] = userFoundByName._id;
            }
          } else {
            if (field === 'approvedBy') throw new Error(`Giá trị không hợp lệ "${fieldValue}" cho trường Người phê duyệt.`);
            dataToValidate[field] = null;
          }
        } else if (field === 'approvedBy') {
            throw new Error(`Trường Người phê duyệt là bắt buộc.`);
        } else {
            dataToValidate[field] = null; 
        }
      }

      if (!dataToValidate.approvedBy) {
        throw new Error(`Người phê duyệt là bắt buộc và phải hợp lệ.`);
      }

      const finalPayload = {};
      allModelFields.forEach(schemaField => {
          if (dataToValidate.hasOwnProperty(schemaField) && schemaField !== '_id' && schemaField !== '__v') {
              finalPayload[schemaField] = dataToValidate[schemaField];
          }
      });
      finalPayload.enteredBy = user.username;
      finalPayload.createdBy = user.id;
      
      projectsToSavePayloads.push(finalPayload);
      validationResults.push({ success: true, projectName: originalProjectNameForDisplay, rowIndex: i });

    } catch (error) {
      logger.error(`Lỗi validate công trình "${originalProjectNameForDisplay}" từ Excel:`, { message: error.message, data: projectDataFromExcel, path: 'importProjectsBatch' });
      validationResults.push({ success: false, projectName: originalProjectNameForDisplay, error: error.message, rowIndex: i, field: error.field }); // Thêm field nếu có
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
      if (user.role === 'admin') {
        projectPayload.status = 'Đã duyệt';
        projectPayload.approvedBy = user.id;
      } else {
        projectPayload.status = 'Chờ duyệt';
      }
      const project = new Model(projectPayload);
      let newProject = await project.save();
      newProject = await populateProjectFields(newProject);

      if (user.role !== 'admin') {
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
    } catch (error) {
      logger.error(`Lỗi khi lưu công trình "${projectPayload.name}" từ Excel (sau validate):`, { message: error.message, data: projectPayload, path: 'importProjectsBatch' });
      throw new Error(`Lỗi nghiêm trọng khi lưu công trình "${projectPayload.name}" đã validate: ${error.message}`);
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
