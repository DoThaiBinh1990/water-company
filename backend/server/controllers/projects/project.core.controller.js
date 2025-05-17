// d:\CODE\water-company\backend\server\controllers\projects\project.core.controller.js
const projectService = require('../../services/project.service.js');
const { populateProjectFields } = require('../../utils'); // Import populateProjectFields
const logger = require('../../config/logger'); // Import logger
const { CategoryProject, MinorRepairProject, Notification } = require('../../models'); // Cần Notification và Models ở đây

exports.getProjects = async (req, res, next) => {
  try {
    const result = await projectService.getProjectsList(req.query);

    // Populate projects sau khi lấy từ service
    const populatedProjects = await Promise.all(
      result.projects.map(p => populateProjectFields(p)) // populateProjectFields đã được import từ utils
    );

    res.json({ ...result, projects: populatedProjects });
  } catch (error) {
    logger.error("Lỗi Controller lấy danh sách công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error); // Chuyển lỗi cho middleware xử lý lỗi tập trung
  }
};

exports.createProject = async (req, res, next) => {
  // Kiểm tra quyền thêm công trình
  if (!req.user.permissions.add) {
    return res.status(403).json({ message: 'Không có quyền thêm công trình' });
  }
  try {
    const { type } = req.body; // Lấy type từ body của request
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) là bắt buộc và hợp lệ.' });
    }

    // Gọi service để tạo công trình, truyền req.io để service có thể gửi socket event
    const result = await projectService.createNewProject(req.body, req.user, type, req.io);
    res.status(201).json(result);
  } catch (error) {
    logger.error("Lỗi Controller thêm công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
    if (error.code === 11000 && (error.message.includes('categorySerialNumber') || error.message.includes('minorRepairSerialNumber'))) {
      return res.status(400).json({ message: 'Lỗi tạo số thứ tự công trình: Số thứ tự đã tồn tại. Vui lòng thử lại sau.' });
    }
    // Chuyển lỗi cho middleware xử lý lỗi tập trung
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { type } = req.query; // Lấy type từ query params
    const projectId = req.params.id;

    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) trong query là bắt buộc và hợp lệ.' });
    }

    // Gọi service để cập nhật công trình
    const result = await projectService.updateProjectById(projectId, type, req.body, req.user, req.io);

    // Trả về response dựa trên kết quả từ service
    // Service có thể trả về message, project, và các cờ như 'updated', 'pending'
    res.status(result.updated ? 200 : (result.pending ? 202 : 200) ).json(result);

  } catch (error) {
    logger.error("Lỗi Controller cập nhật công trình:", { path: req.path, method: req.method, projectId: req.params.id, message: error.message, stack: error.stack, statusCode: error.statusCode });
    // Chuyển lỗi cho middleware xử lý lỗi tập trung, đảm bảo statusCode được truyền đi nếu có
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const { type } = req.query; // Lấy type từ query params
    const projectId = req.params.id;
    const user = req.user;

    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) trong query là bắt buộc và hợp lệ.' });
    }

    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: 'Không tìm thấy công trình' });
    }

    const isUserAdmin = user.role === 'admin';
    const hasDeletePermission = user.permissions.delete;
    const isApprover = user.permissions.approve;

    // Trường hợp 1: Admin xóa công trình chưa duyệt HOẶC người dùng có quyền delete xóa công trình chưa duyệt
    if ((isUserAdmin || hasDeletePermission) && project.status !== 'Đã duyệt') {
      const result = await projectService.deleteProjectById(projectId, type, user, req.io);
      return res.json(result);
    }
    // Trường hợp 2: Approver duyệt yêu cầu xóa (project.pendingDelete = true)
    else if (isApprover && project.pendingDelete) {
      const result = await projectService.deleteProjectById(projectId, type, user, req.io);
      return res.json(result);
    }
    // Trường hợp 3: Người dùng (có quyền delete) yêu cầu xóa công trình đã duyệt
    else if (hasDeletePermission && (project.enteredBy === user.username || isUserAdmin) && project.status === 'Đã duyệt' && !project.pendingDelete) {
      project.pendingDelete = true;
      await project.save();
      const populatedProjectForNotification = { _id: project._id, name: project.name, type };
      const notification = new Notification({
        message: `Yêu cầu xóa công trình "${project.name}" bởi ${user.username}`,
        type: 'delete',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'pending',
        userId: user.id,
      });
      await notification.save();
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      }
      return res.json({ message: 'Yêu cầu xóa đã được gửi để chờ duyệt.', project: { _id: project._id, name: project.name, pendingDelete: project.pendingDelete, type } });
    }
    // Trường hợp không có quyền
    else {
      return res.status(403).json({ message: 'Không có quyền xóa công trình này hoặc gửi yêu cầu xóa theo cách này.' });
    }

  } catch (error) {
    logger.error("Lỗi Controller xóa công trình:", { path: req.path, method: req.method, projectId: req.params.id, message: error.message, stack: error.stack, statusCode: error.statusCode });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};
