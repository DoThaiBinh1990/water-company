// d:\CODE\water-company\backend\server\controllers\projects\project.core.controller.js
const projectService = require('../../services/project.service.js');
const { populateProjectFields } = require('../../utils');
const logger = require('../../config/logger');
const Joi = require('joi'); // Import Joi
const { CategoryProject, MinorRepairProject, Notification } = require('../../models');

exports.getProjects = async (req, res, next) => {
  try {
    // Truyền req.user (chứa thông tin user đã xác thực) vào service
    const result = await projectService.getProjectsList({ ...req.query, user: req.user });
    // Population is now handled within the service
    res.json(result);
  } catch (error) {
    logger.error("Lỗi Controller lấy danh sách công trình:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
};

// Define Joi schemas for validation
const createProjectSchema = Joi.object({
  type: Joi.string().valid('category', 'minor_repair').required(),
  name: Joi.string().trim().required().messages({
    'any.required': 'Tên công trình là bắt buộc.',
    'string.empty': 'Tên công trình không được để trống.',
  }),
  allocatedUnit: Joi.string().trim().required().messages({
    'any.required': 'Đơn vị phân bổ là bắt buộc.',
    'string.empty': 'Đơn vị phân bổ không được để trống.',
  }),
  location: Joi.string().trim().required().messages({
    'any.required': 'Địa điểm là bắt buộc.',
    'string.empty': 'Địa điểm không được để trống.',
  }),
  scale: Joi.string().trim().required().messages({ // Scale required for both types
     'any.required': 'Quy mô là bắt buộc.',
     'string.empty': 'Quy mô không được để trống.',
  }),
  reportDate: Joi.date().iso().when('type', {
    is: 'minor_repair',
    then: Joi.required().messages({
      'any.required': 'Ngày xảy ra sự cố là bắt buộc cho công trình sửa chữa nhỏ.',
      'date.format': 'Ngày xảy ra sự cố không đúng định dạng ISO 8601.',
    }),
    otherwise: Joi.optional().allow(null, ''),
  }),
  approvedBy: Joi.string().hex().length(24).required().messages({ // Expecting ObjectId string
    'any.required': 'Người phê duyệt là bắt buộc.',
    'string.empty': 'Người phê duyệt không được để trống.',
    'string.hex': 'ID người phê duyệt không hợp lệ.',
    'string.length': 'ID người phê duyệt không hợp lệ.',
  }),
  // Allow other fields present in the schema, but not required by default
  // Use .unknown(true) if you want to allow *any* other fields
  // Or list specific optional fields with their types/validations
}).unknown(true); // Allow other fields not explicitly defined

exports.createProject = async (req, res, next) => {
  // Permission check for 'add' is still relevant at the entry point
  if (!req.user.permissions.add) {
    return res.status(403).json({ message: 'Bạn không có quyền thêm công trình.' });
  }
  try {
    const { type } = req.body;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) là bắt buộc và hợp lệ.' });
    }
    // The service will now handle if it's direct approval (admin) or pending (non-admin)

    // Validate request body using Joi schema
    const { error } = createProjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const result = await projectService.createNewProject(req.body, req.user, type, req.io);
    res.status(result.pending ? 202 : 201).json(result);
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

// Define Joi schema for update (fields are optional)
const updateProjectSchema = Joi.object({
  name: Joi.string().trim().optional().allow(''),
  allocatedUnit: Joi.string().trim().optional().allow(''),
  location: Joi.string().trim().optional().allow(''),
  scale: Joi.string().trim().optional().allow(''),
  reportDate: Joi.date().iso().optional().allow(null, ''),
  approvedBy: Joi.string().hex().length(24).optional().allow(null, '').messages({ // Allow null or empty string for clearing
    'string.hex': 'ID người phê duyệt không hợp lệ.',
    'string.length': 'ID người phê duyệt không hợp lệ.',
  }),
  supervisor: Joi.string().hex().length(24).optional().allow(null, '').messages({
     'string.hex': 'ID người theo dõi không hợp lệ.', 'string.length': 'ID người theo dõi không hợp lệ.'
  }),
  estimator: Joi.string().hex().length(24).optional().allow(null, '').messages({
     'string.hex': 'ID người lập dự toán không hợp lệ.', 'string.length': 'ID người lập dự toán không hợp lệ.'
  }),
  // Add other fields that can be updated
}).unknown(true);

exports.updateProject = async (req, res, next) => {
  // Service will handle detailed permission logic for editing
  try {
    const { type } = req.query;
    const projectId = req.params.id;

    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) trong query là bắt buộc và hợp lệ.' });
    }

    // Validate request body using Joi schema
    const { error } = updateProjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const result = await projectService.updateProjectById(projectId, type, req.body, req.user, req.io);
    res.status(result.pending ? 202 : (result.updated ? 200 : 200)).json(result); // 202 if pending, 200 if updated/no change
  } catch (error) {
    logger.error("Lỗi Controller cập nhật công trình:", { path: req.path, method: req.method, projectId: req.params.id, message: error.message, stack: error.stack, statusCode: error.statusCode });
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  // Service will handle detailed permission logic for deleting
  try {
    const { type } = req.query;
    const projectId = req.params.id;
    const user = req.user;

    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) trong query là bắt buộc và hợp lệ.' });
    }

    const result = await projectService.deleteProjectById(projectId, type, user, req.io);
    res.status(result.pendingDelete ? 202 : 200).json(result);

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

    // Basic validation for the array structure
    if (!Joi.array().items(Joi.object().unknown(true)).min(1).required().validate(projects).error) {
         // Detailed validation for each project object will be done in the service
    } else { return res.status(400).json({ message: 'Dữ liệu công trình (projects) là bắt buộc và phải là một mảng không rỗng.' }); }

    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình (type) trong query là bắt buộc và hợp lệ.' });
    }
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ message: 'Dữ liệu công trình (projects) là bắt buộc và phải là một mảng không rỗng.' });
    }
    // Admin imports are directly approved, others are pending. Service handles this.
    const result = await projectService.importProjectsBatch(projects, req.user, type, req.io);
    res.status(200).json(result);
  } catch (error) {
    logger.error("Lỗi Controller nhập công trình từ Excel:", { path: req.path, method: req.method, message: error.message, stack: error.stack, statusCode: error.statusCode });
    if (error.statusCode) { return res.status(error.statusCode).json({ message: error.message, results: error.results }); } // Pass results if available
    next(error);
  }
};
