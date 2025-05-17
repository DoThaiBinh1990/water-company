// d:\CODE\water-company\backend\server\services\project.service.js
const { CategoryProject, MinorRepairProject, User, Notification } = require('../models');
const { populateProjectFields, updateSerialNumbers } = require('../utils'); // Đảm bảo updateSerialNumbers được import
const logger = require('../config/logger'); // Import logger

const getProjectsList = async (queryParams) => {
  const { type = 'category', page = 1, limit = 10, status, allocatedUnit, constructionUnit, allocationWave, assignedTo, search, minInitialValue, maxInitialValue, progress, pending, supervisor, estimator } = queryParams; // Mặc định type là 'category'
  const Model = type === 'category' ? CategoryProject : MinorRepairProject; // Bây giờ logic này sẽ đúng hơn
  const query = {};

  // Common search conditions
  if (allocatedUnit) query.allocatedUnit = allocatedUnit;
  if (constructionUnit && type === 'category') query.constructionUnit = constructionUnit;
  if (allocationWave && type === 'category') query.allocationWave = allocationWave;
  if (assignedTo) query.assignedTo = { $regex: assignedTo, $options: 'i' };
  if (search) query.name = { $regex: search, $options: 'i' };

  if (type === 'category') {
    if (minInitialValue || maxInitialValue) {
      query.initialValue = {};
      if (minInitialValue) query.initialValue.$gte = parseFloat(minInitialValue);
      if (maxInitialValue) query.initialValue.$lte = parseFloat(maxInitialValue);
    }
    if (progress) query.progress = progress;
  }

  // Status handling
  if (pending === 'true' || pending === true) {
    query.$or = [
      { status: 'Chờ duyệt' },
      { pendingEdit: { $ne: null, $exists: true } },
      { pendingDelete: true }
    ];
  } else if (status) {
    query.status = status;
  } else {
    // Default to 'Đã duyệt' if not pending and no specific status
    query.status = 'Đã duyệt';
  }

  // Update query for supervisor and estimator to find by ObjectId
  if (supervisor) query.supervisor = supervisor; // Assuming supervisor is an ObjectId
  if (estimator && type === 'category') query.estimator = estimator; // Assuming estimator is an ObjectId

  const count = await Model.countDocuments(query);
  // Tạm thời bỏ populate ở service, controller sẽ làm việc này
  const projects = await Model.find(query)
    .sort({ createdAt: -1 }) // Sort by latest creation time
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  return {
    projects,
    total: count,
    page: parseInt(page),
    pages: Math.ceil(count / parseInt(limit)),
  };
};

const createNewProject = async (projectData, user, projectType, io) => {
  const { name, allocatedUnit, location, approvedBy, scale, reportDate } = projectData;

  // Kiểm tra các trường bắt buộc (tương tự như trong route handler cũ)
  if (!name || !allocatedUnit || !location || !projectType || !approvedBy) {
    const error = new Error('Tên công trình, Đơn vị phân bổ, Địa điểm, Loại công trình và Người phê duyệt là bắt buộc.');
    error.statusCode = 400;
    throw error;
  }
  if (projectType === 'minor_repair' && (!scale || !reportDate)) {
    const error = new Error('Quy mô và Ngày xảy ra sự cố là bắt buộc cho công trình sửa chữa nhỏ.');
    error.statusCode = 400;
    throw error;
  }
  if (projectType === 'category' && !scale) {
    const error = new Error('Quy mô là bắt buộc cho công trình danh mục.');
    error.statusCode = 400;
    throw error;
  }

  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const dataToSave = { ...projectData, enteredBy: user.username, createdBy: user.id };

  const approver = await User.findById(approvedBy);
  if (!approver || !approver.permissions.approve) {
    const error = new Error('Người duyệt không hợp lệ hoặc không có quyền duyệt.');
    error.statusCode = 400;
    throw error;
  }
  dataToSave.approvedBy = approvedBy; // Đảm bảo approvedBy là ObjectId
  delete dataToSave.type; // Xóa trường 'type' khỏi dataToSave vì Model đã xác định loại

  const project = new Model(dataToSave);
  let newProject = await project.save(); // Pre-save hook trong model sẽ xử lý serial number
  newProject = await populateProjectFields(newProject); // Populate sau khi lưu

  // Tạo notification (logic tương tự như trong route handler cũ)
  const populatedProjectForNotification = { _id: newProject._id, name: newProject.name, type: projectType };
  const notification = new Notification({
    message: `Yêu cầu thêm công trình mới "${newProject.name}" đã được gửi để duyệt`,
    type: 'new',
    projectId: newProject._id,
    projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
    status: 'pending',
    userId: user.id,
  });
  await notification.save();
  if (io) {
    io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
  } else {
    logger.warn('Socket.IO không được khởi tạo trong service, bỏ qua gửi thông báo.');
  }

  return { message: 'Công trình đã được gửi để duyệt!', project: newProject, pending: true };
};

const updateProjectById = async (projectId, projectType, updateData, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    const error = new Error('Không tìm thấy công trình');
    error.statusCode = 404;
    throw error;
  }

  const isApprover = user.permissions.approve;
  // Admin hoặc người có quyền approve có thể sửa trực tiếp project đã duyệt
  const canEditDirectly = (user.permissions.edit && project.status !== 'Đã duyệt') || (user.role === 'admin' || isApprover);
  const canRequestEdit = user.permissions.edit && (project.enteredBy === user.username || user.role === 'admin');


  const currentUpdateData = { ...updateData };

  if (!project.createdBy) {
    project.createdBy = user.id; // Gán createdBy nếu chưa có
  }
  delete currentUpdateData.createdBy; // Không cho phép cập nhật createdBy từ request

  // Nếu công trình đã duyệt và người dùng không phải là người duyệt (và không phải admin), không cho phép sửa một số trường nhạy cảm
  if (project.status === 'Đã duyệt' && !isApprover && user.role !== 'admin') {
    delete currentUpdateData.status;
    delete currentUpdateData.categorySerialNumber;
    delete currentUpdateData.minorRepairSerialNumber;
    // Có thể thêm các trường khác không cho phép sửa ở đây
  }

  // Chỉ tạo pendingEdit nếu không phải admin/approver và project đã duyệt và user có quyền yêu cầu sửa
  if (canRequestEdit && project.status === 'Đã duyệt' && !(user.role === 'admin' || isApprover)) {
    const dataToPending = { ...currentUpdateData };
    delete dataToPending.status; // Không cho phép thay đổi status khi yêu cầu sửa

    const getStorableValue = (value) => {
      if (value && typeof value === 'object' && value._id) {
        return value._id.toString();
      }
      return value;
    };

    const changesArray = [];
    for (const field in dataToPending) {
      if (Object.prototype.hasOwnProperty.call(dataToPending, field)) {
        const nonEditableFields = ['_id', '__v', 'createdAt', 'updatedAt', 'categorySerialNumber', 'minorRepairSerialNumber', 'enteredBy', 'createdBy', 'type'];

        let oldValueNormalized = project[field];
        let newValueNormalized = dataToPending[field];

        // Chuẩn hóa giá trị ngày và số để so sánh chính xác
        if (['startDate', 'completionDate', 'reportDate', 'inspectionDate', 'paymentDate'].includes(field)) {
          const formatDateToCompare = (dateVal) => {
            if (!dateVal) return null;
            try { return new Date(dateVal).toISOString().split('T')[0]; } catch (e) { return String(dateVal); }
          };
          oldValueNormalized = formatDateToCompare(project[field]);
          newValueNormalized = formatDateToCompare(dataToPending[field]);
        } else if (['initialValue', 'estimatedValue', 'contractValue', 'durationDays', 'paymentValue'].includes(field)) {
          oldValueNormalized = project[field] === null || project[field] === undefined ? null : Number(project[field]);
          newValueNormalized = dataToPending[field] === '' || dataToPending[field] === null || dataToPending[field] === undefined ? null : Number(dataToPending[field]);
        }

        if (!nonEditableFields.includes(field) && String(oldValueNormalized) !== String(newValueNormalized)) {
          changesArray.push({
            field: field,
            oldValue: getStorableValue(project[field]),
            newValue: getStorableValue(dataToPending[field])
          });
        }
      }
    }

    if (changesArray.length === 0) {
      const populatedNoChangeProject = await populateProjectFields(project);
      return { message: 'Không có thay đổi nào được ghi nhận để yêu cầu sửa.', project: populatedNoChangeProject, updated: false };
    }

    project.pendingEdit = {
      changes: changesArray,
      requestedBy: user.id,
      requestedAt: new Date()
    };
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);

    const populatedProjectForNotification = { _id: populatedProject._id, name: populatedProject.name, type: projectType };
    const notification = new Notification({
      message: `Yêu cầu sửa công trình "${populatedProject.name}" bởi ${user.username}`,
      type: 'edit', projectId: populatedProject._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'pending', userId: user.id,
    });
    await notification.save();
    if (io) io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
    return { message: 'Yêu cầu sửa đã được gửi để chờ duyệt', project: populatedProject, updated: true, pending: true };
  } else if (canEditDirectly) { // Bao gồm cả trường hợp admin/approver sửa project đã duyệt
    Object.assign(project, currentUpdateData);
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);
    return { message: 'Công trình đã được cập nhật.', project: populatedProject, updated: true };
  } else {
    const error = new Error('Không có quyền sửa công trình này hoặc gửi yêu cầu sửa.');
    error.statusCode = 403;
    throw error;
  }
};

const deleteProjectById = async (projectId, projectType, user, io) => {
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    const error = new Error('Không tìm thấy công trình');
    error.statusCode = 404;
    throw error;
  }

  const isUserAdmin = user.role === 'admin';
  // const hasDeletePermission = user.permissions.delete; // Quyền này sẽ được kiểm tra ở controller
  const isApprover = user.permissions.approve;

  // Trường hợp Admin xóa công trình chưa duyệt, hoặc người dùng có quyền xóa xóa công trình chưa duyệt
  if ((isUserAdmin || user.permissions.delete) && project.status !== 'Đã duyệt') {
    await Model.deleteOne({ _id: projectId });
    await updateSerialNumbers(projectType); 

    const anyPendingNotification = await Notification.findOne({ projectId: projectId, status: 'pending', type: 'delete', projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (anyPendingNotification) {
      anyPendingNotification.status = 'processed';
      await anyPendingNotification.save();
      if (io) {
        io.emit('notification_processed', anyPendingNotification._id);
        const deletedNotification = new Notification({
          message: `Công trình "${project.name}" đã được xóa bởi ${user.username}`, type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'processed', userId: project.createdBy,
        });
        await deletedNotification.save();
        io.emit('notification', deletedNotification);
      }
    }
    if (io) io.emit('project_deleted', { projectId: project._id, projectType: projectType });
    return { message: 'Công trình đã được xóa thành công.' };
  }
  // Trường hợp Approver duyệt yêu cầu xóa (project.pendingDelete = true)
  else if (isApprover && project.pendingDelete) {
    await Model.deleteOne({ _id: projectId });
    await updateSerialNumbers(projectType);

    const deleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending', projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (deleteNotification) {
      deleteNotification.status = 'processed';
      await deleteNotification.save();
      if (io) {
        io.emit('notification_processed', deleteNotification._id);
        const deletedNotification = new Notification({
          message: `Yêu cầu xóa công trình "${project.name}" đã được duyệt`, type: 'delete', projectId: project._id, projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject', status: 'processed', userId: project.createdBy,
        });
        await deletedNotification.save();
        io.emit('notification', deletedNotification);
      }
    }
    if (io) io.emit('project_deleted', { projectId: project._id, projectType: projectType });
    return { message: 'Đã xóa công trình (sau khi duyệt yêu cầu).' };
  }
  // Các trường hợp khác (ví dụ: yêu cầu xóa đã được xử lý ở controller)
  // Service này chỉ nên xử lý việc xóa thực sự dựa trên các điều kiện đã được controller xác định
  else {
    // Nếu logic đến đây, có nghĩa là controller đã gọi service này trong trường hợp không phù hợp
    // hoặc logic quyền trong service cần được xem xét lại để khớp với controller.
    // Hiện tại, controller sẽ xử lý việc tạo "yêu cầu xóa".
    const error = new Error('Hành động xóa không được phép hoặc không phù hợp với trạng thái hiện tại của công trình từ service.');
    error.statusCode = 403; 
    throw error;
  }
};

module.exports = {
  getProjectsList,
  createNewProject,
  updateProjectById,
  deleteProjectById,
};
