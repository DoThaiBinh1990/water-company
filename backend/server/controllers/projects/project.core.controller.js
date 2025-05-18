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
  // Bỏ kiểm tra user.permissions.edit ở đây, service sẽ xử lý chi tiết
  // if (!req.user.permissions.edit) return res.status(403).json({ message: 'Không có quyền sửa công trình.' });
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

    // Service sẽ xử lý logic phân quyền chi tiết
    const result = await projectService.deleteProjectById(projectId, type, user, req.io);
    res.json(result);

  } catch (error) {
    logger.error("Lỗi Controller xóa công trình:", { path: req.path, method: req.method, projectId: req.params.id, message: error.message, stack: error.stack, statusCode: error.statusCode });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

exports.importProjectsFromExcel = async (req, res, next) => {
  try {
    const { type } = req.query; // 'category' or 'minor_repair'
    const { projects } = req.body; // Array of project data from Excel

    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) trong query là bắt buộc và hợp lệ.' });
    }
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ message: 'Dữ liệu công trình (projects) là bắt buộc và phải là một mảng không rỗng.' });
    }
    const result = await projectService.importProjectsBatch(projects, req.user, type, req.io);
    res.status(200).json(result);
  } catch (error) {
    logger.error("Lỗi Controller nhập công trình từ Excel:", { path: req.path, method: req.method, message: error.message, stack: error.stack, statusCode: error.statusCode });
    if (error.statusCode) { return res.status(error.statusCode).json({ message: error.message }); }
    next(error);
  }
};
