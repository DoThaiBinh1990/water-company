// d:\CODE\water-company\backend\server\controllers\projects\project.core.controller.js
const projectService = require('../../services/project.service.js');
const { populateProjectFields } = require('../../utils');
const logger = require('../../config/logger');
const { CategoryProject, MinorRepairProject, Notification } = require('../../models');

exports.getProjects = async (req, res, next) => {
  try {
    // Truyền req.user (chứa thông tin user đã xác thực) vào service
    const result = await projectService.getProjectsList({ ...req.query, user: req.user });
    const populatedProjects = await Promise.all(
      result.projects.map(p => populateProjectFields(p))
    );
    res.json({ ...result, projects: populatedProjects });
  } catch (error) {
    logger.error("Lỗi Controller lấy danh sách công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  if (!req.user.permissions.add) {
    return res.status(403).json({ message: 'Không có quyền thêm công trình' });
  }
  try {
    const { type } = req.body;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) là bắt buộc và hợp lệ.' });
    }
    const result = await projectService.createNewProject(req.body, req.user, type, req.io);
    res.status(201).json(result);
  } catch (error) {
    logger.error("Lỗi Controller thêm công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code, statusCode: error.statusCode });
    if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    if (error.code === 11000 && (error.message.includes('categorySerialNumber') || error.message.includes('minorRepairSerialNumber'))) {
      return res.status(400).json({ message: 'Lỗi tạo số thứ tự công trình: Số thứ tự đã tồn tại. Vui lòng thử lại sau.' });
    }
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  if (!req.user.permissions.edit) { // Kiểm tra quyền edit cơ bản ở controller
      return res.status(403).json({ message: 'Không có quyền sửa công trình.' });
  }
  try {
    const { type } = req.query;
    const projectId = req.params.id;

    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) trong query là bắt buộc và hợp lệ.' });
    }
    // Service sẽ xử lý logic phân quyền chi tiết hơn
    const result = await projectService.updateProjectById(projectId, type, req.body, req.user, req.io);
    res.status(result.updated ? 200 : (result.pending ? 202 : 200)).json(result);
  } catch (error) {
    logger.error("Lỗi Controller cập nhật công trình:", { path: req.path, method: req.method, projectId: req.params.id, message: error.message, stack: error.stack, statusCode: error.statusCode });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const { type } = req.query;
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
    const isUserOfficeManagement = ['director', 'deputy_director', 'manager-office', 'deputy_manager-office'].includes(user.role);
    const isUserBranchManagement = ['manager-branch', 'deputy_manager-branch'].includes(user.role);
    const isUserOfficeStaff = user.role === 'staff-office';
    const isUserBranchStaff = user.role === 'staff-branch';

    const isUserApprover = user.permissions.approve; // Người có quyền duyệt chung
    const userHasDeletePermission = user.permissions.delete;

    const isProjectCreator = project.createdBy && project.createdBy.toString() === user.id;
    const projectBelongsToUserUnit = user.unit && project.allocatedUnit === user.unit;

    // 1. Admin xóa trực tiếp (bất kể trạng thái)
    if (isUserAdmin) {
      const result = await projectService.deleteProjectById(projectId, type, user, req.io);
      return res.json(result);
    }

    // 2. Người có quyền duyệt (approve) duyệt yêu cầu xóa (project.pendingDelete = true)
    // Chỉ áp dụng nếu họ không phải admin (admin đã xử lý ở trên)
    if (isUserApprover && project.pendingDelete) {
      const result = await projectService.deleteProjectById(projectId, type, user, req.io);
      return res.json(result);
    }

    // 3. Các vai trò khác có quyền 'delete'
    if (userHasDeletePermission) {
      let canPerformAction = false;

      if (isUserOfficeManagement || isUserOfficeStaff) { // Quản lý công ty, Nhân viên phòng -> Xóa/YC xóa tất cả
        canPerformAction = true;
      } else if (isUserBranchManagement) { // Quản lý chi nhánh
        canPerformAction = projectBelongsToUserUnit; // Xóa/YC xóa CT thuộc chi nhánh mình
      } else if (isUserBranchStaff) { // Nhân viên chi nhánh
        canPerformAction = isProjectCreator && projectBelongsToUserUnit;
      }

      if (canPerformAction) {
        if (project.status !== 'Đã duyệt') { // Xóa trực tiếp công trình CHƯA DUYỆT
          const result = await projectService.deleteProjectById(projectId, type, user, req.io);
          return res.json(result);
        } else if (!project.pendingDelete) { // Yêu cầu xóa công trình ĐÃ DUYỆT (và chưa có yêu cầu xóa trước đó)
          project.pendingDelete = true;
          await project.save();
          const populatedProjectForNotification = { _id: project._id, name: project.name, type };
          const notification = new Notification({
            message: `Yêu cầu xóa công trình "${project.name}" bởi ${user.username}`,
            type: 'delete', projectId: project._id, projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
            status: 'pending', userId: user.id,
          });
          await notification.save();
          if (req.io) req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
          return res.json({ message: 'Yêu cầu xóa đã được gửi để chờ duyệt.', project: { _id: project._id, name: project.name, pendingDelete: project.pendingDelete, type } });
        }
        // Nếu đã có pendingDelete và user không phải approver/admin, thì không làm gì thêm ở đây.
      }
    }

    // Nếu không rơi vào các trường hợp trên -> không có quyền
    return res.status(403).json({ message: 'Không có quyền thực hiện hành động xóa này.' });

  } catch (error) {
    logger.error("Lỗi Controller xóa công trình:", { path: req.path, method: req.method, projectId: req.params.id, message: error.message, stack: error.stack, statusCode: error.statusCode });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};
