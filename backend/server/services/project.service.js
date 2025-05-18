// d:\CODE\water-company\backend\server\services\project.service.js
const { CategoryProject, MinorRepairProject, User, Notification } = require('../models');
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
  if (assignedTo) query.assignedTo = { $regex: assignedTo, $options: 'i' };
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

  if (supervisor) query.supervisor = supervisor;
  if (estimator && type === 'category') query.estimator = estimator;

  // Role-based filtering
  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      // Nếu user có unit (chi nhánh) và không có quyền xem chi nhánh khác, lọc theo unit của họ.
      // Điều này sẽ ghi đè filter `allocatedUnit` từ client nếu nó khác và user không có quyền xem chi nhánh khác.
      query.allocatedUnit = user.unit;
    }
    // Các vai trò admin, director, manager-office, staff-office có thể xem tất cả theo mặc định,
    // trừ khi có filter cụ thể được áp dụng (ví dụ: client chọn một `allocatedUnit` cụ thể).
  }

  const count = await Model.countDocuments(query);
  const projects = await Model.find(query)
    .sort({ createdAt: -1 }) // Sắp xếp theo ngày tạo mới nhất
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
  const dataToSave = { ...projectData, enteredBy: user.username, createdBy: user.id, status: 'Chờ duyệt' };

  // Đối với nhân viên chi nhánh, đảm bảo họ chỉ tạo công trình cho chi nhánh của mình
  if (user.role === 'staff-branch' && user.unit) {
    if (dataToSave.allocatedUnit !== user.unit) {
      throw { statusCode: 403, message: 'Nhân viên chi nhánh chỉ có thể tạo công trình cho chi nhánh của mình.' };
    }
  }
  // Quản lý chi nhánh cũng nên bị giới hạn nếu không có quyền tạo cho chi nhánh khác (mặc định là không)
  if (user.role === 'manager-branch' && user.unit && !user.permissions.viewOtherBranchProjects) { // Giả sử viewOtherBranchProjects cũng ngầm định quyền tạo cho chi nhánh khác
     if (dataToSave.allocatedUnit !== user.unit) {
      throw { statusCode: 403, message: 'Quản lý chi nhánh chỉ có thể tạo công trình cho chi nhánh của mình trừ khi có quyền đặc biệt.' };
    }
  }


  const approver = await User.findById(approvedBy);
  if (!approver || !approver.permissions.approve) {
    throw { statusCode: 400, message: 'Người duyệt không hợp lệ hoặc không có quyền duyệt.' };
  }
  dataToSave.approvedBy = approvedBy;
  delete dataToSave.type; // Xóa trường 'type' không cần thiết khỏi payload lưu vào DB

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
    userId: user.id, // User tạo yêu cầu
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
    throw { statusCode: 404, message: 'Không tìm thấy công trình' };
  }

  const isUserAdmin = user.role === 'admin';
  const isUserOfficeManagement = ['director', 'deputy_director', 'manager-office', 'deputy_manager-office'].includes(user.role);
  const isUserBranchManagement = ['manager-branch', 'deputy_manager-branch'].includes(user.role);
  const isUserOfficeStaff = user.role === 'staff-office';
  const isUserBranchStaff = user.role === 'staff-branch';

  const isProjectCreator = project.createdBy && project.createdBy.toString() === user.id;
  const projectBelongsToUserUnit = user.unit && project.allocatedUnit === user.unit;

  const currentUpdateData = { ...updateData };
  // Không cho phép cập nhật các trường này
  ['createdBy', 'enteredBy', 'categorySerialNumber', 'minorRepairSerialNumber', 'status', 'pendingEdit', 'pendingDelete', 'approvedBy'].forEach(field => delete currentUpdateData[field]);


  // 1. Admin và Quản lý công ty (Phòng/Ban, TGĐ, PTGĐ) có thể sửa trực tiếp
  if (isUserAdmin || isUserOfficeManagement) {
    Object.assign(project, currentUpdateData);
    if (project.status === 'Chờ duyệt') { // Nếu sửa công trình đang chờ duyệt, thì duyệt luôn
        project.status = 'Đã duyệt';
        project.approvedBy = user.id;
    }
    await project.save({ validateModifiedOnly: true });
    const populatedProject = await populateProjectFields(project);
    if (io) io.emit('project_updated', { ...populatedProject.toObject(), projectType });
    return { message: 'Công trình đã được cập nhật.', project: populatedProject, updated: true };
  }

  // 2. Các vai trò khác có quyền 'edit'
  if (user.permissions.edit) {
    let canEditDirectlyUnapproved = false; // Sửa trực tiếp công trình CHƯA DUYỆT
    let canRequestEditApproved = false;   // Yêu cầu sửa công trình ĐÃ DUYỆT

    if (isUserOfficeStaff) { // Nhân viên phòng
      canEditDirectlyUnapproved = true; // Sửa trực tiếp mọi công trình chưa duyệt
      canRequestEditApproved = true;    // Yêu cầu sửa mọi công trình đã duyệt
    } else if (isUserBranchManagement) { // Quản lý chi nhánh
      if (projectBelongsToUserUnit) { // Chỉ sửa/YC sửa CT thuộc chi nhánh mình
        canEditDirectlyUnapproved = true;
        canRequestEditApproved = true;
      }
    } else if (isUserBranchStaff) { // Nhân viên chi nhánh
      if (isProjectCreator && projectBelongsToUserUnit) {
        canEditDirectlyUnapproved = true;
        canRequestEditApproved = true;
      } // User chi nhánh vẫn chỉ sửa/YC sửa CT mình tạo VÀ thuộc chi nhánh mình
    }

    if (project.status !== 'Đã duyệt') { // Công trình CHƯA DUYỆT
      if (canEditDirectlyUnapproved) {
        Object.assign(project, currentUpdateData);
        await project.save({ validateModifiedOnly: true });
        const populatedProject = await populateProjectFields(project);
        if (io) io.emit('project_updated', { ...populatedProject.toObject(), projectType });
        return { message: 'Công trình đã được cập nhật (trước duyệt).', project: populatedProject, updated: true };
      } else {
        throw { statusCode: 403, message: 'Không có quyền sửa công trình này khi chưa duyệt.' };
      }
    } else { // Công trình ĐÃ DUYỆT -> tạo pendingEdit
      if (canRequestEditApproved) {
        const dataToPending = { ...currentUpdateData };
        const changesArray = [];
        for (const field in dataToPending) {
          if (Object.prototype.hasOwnProperty.call(dataToPending, field)) {
            const nonEditableFields = ['_id', '__v', 'createdAt', 'updatedAt']; // Các trường không nên có trong changes
            if (!nonEditableFields.includes(field) && String(project[field]) !== String(dataToPending[field])) {
              changesArray.push({ field, oldValue: project[field], newValue: dataToPending[field] });
            }
          }
        }

        if (changesArray.length === 0) {
          const populatedNoChangeProject = await populateProjectFields(project);
          return { message: 'Không có thay đổi nào được ghi nhận để yêu cầu sửa.', project: populatedNoChangeProject, updated: false };
        }

        project.pendingEdit = { changes: changesArray, requestedBy: user.id, requestedAt: new Date() };
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
      } else {
        throw { statusCode: 403, message: 'Không có quyền yêu cầu sửa công trình này.' };
      }
    }
  }

  throw { statusCode: 403, message: 'Không có quyền sửa công trình này.' };
};

const deleteProjectById = async (projectId, projectType, user, io) => {
  // Service này chỉ thực hiện xóa. Logic quyền và pendingDelete đã được controller xử lý.
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);

  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình để xóa trong service' };
  }
  const originalProjectName = project.name;
  const originalCreatorId = project.createdBy; // Lưu ID người tạo gốc

  await Model.deleteOne({ _id: projectId });
  await updateSerialNumbers(projectType); // Cập nhật lại số thứ tự

  // Xử lý notification cho việc xóa
  // Tìm và cập nhật notification yêu cầu xóa (nếu có)
  const pendingDeleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending' });
  if (pendingDeleteNotification) {
    pendingDeleteNotification.status = 'processed';
    await pendingDeleteNotification.save();
    if (io) io.emit('notification_processed', pendingDeleteNotification._id);
  }

  // Tạo thông báo xác nhận xóa (gửi cho người tạo gốc)
  const deletedConfirmationNotification = new Notification({
    message: `Công trình "${originalProjectName}" đã được xóa bởi ${user.username}.`,
    type: 'delete_approved', // Hoặc một type chung cho delete
    projectModel: projectType === 'category' ? 'CategoryProject' : 'MinorRepairProject',
    status: 'processed',
    userId: originalCreatorId, // Gửi cho người tạo công trình gốc
    originalProjectId: projectId, // Lưu lại ID của project đã bị xóa
  });
  await deletedConfirmationNotification.save();

  if (io) {
    io.emit('notification', deletedConfirmationNotification); // Gửi thông báo xác nhận xóa
    io.emit('project_deleted', { projectId: projectId, projectType: projectType }); // Thông báo project đã bị xóa
  }
  return { message: `Công trình "${originalProjectName}" đã được xóa.` };
};

module.exports = {
  getProjectsList,
  createNewProject,
  updateProjectById,
  deleteProjectById,
};
