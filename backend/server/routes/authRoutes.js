// d:\CODE\water-company\backend\server\routes\authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware');
const { User, AllocatedUnit, ConstructionUnit, AllocationWave, ProjectType, CategoryProject, MinorRepairProject } = require('../models');
const logger = require('../config/logger'); // Import logger

router.get('/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post('/login', async (req, res, next) => { // Thêm next
  try {
    const { username, password } = req.body;
    if (!username || !password) { 
      return res.status(400).json({ message: 'Tên đăng nhập và mật khẩu không được để trống' }); 
    }
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Tài khoản không tồn tại' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu không đúng' });
    let userPermissions = user.permissions;
    if (user.role === 'admin') { 
      userPermissions = {
        add: true,
        edit: true,
        delete: true,
        approve: true,
        viewRejected: true,
        allocate: true,
        assign: true,
      }; 
    }
    const token = jwt.sign({ 
      id: user._id, 
      role: user.role, 
      permissions: userPermissions, 
      username: user.username,
      fullName: user.fullName,
      address: user.address,
      phoneNumber: user.phoneNumber,
      email: user.email,
      unit: user.unit
    }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { 
      id: user._id, 
      username: user.username, 
      role: user.role, 
      fullName: user.fullName,
      address: user.address,
      phoneNumber: user.phoneNumber,
      email: user.email,
      unit: user.unit,
      permissions: userPermissions 
    } });
  } catch (error) {
    logger.error("Lỗi API đăng nhập:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.post('/users', authenticate, async (req, res, next) => { // Thêm next
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền thêm người dùng' });
  try {
    const { username, password, role, fullName, address, phoneNumber, email, unit, permissions } = req.body;
    if (!username || !password || !role) { 
      return res.status(400).json({ message: 'Tên người dùng, mật khẩu và vai trò không được để trống' }); 
    }
    if (username.toLowerCase() === 'admin' && role === 'admin') {
      const existingAdmin = await User.findOne({ username: 'admin', role: 'admin' });
      if (existingAdmin) { return res.status(400).json({ message: 'Tài khoản admin với username "admin" đã tồn tại.' }); }
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) { return res.status(400).json({ message: 'Tên người dùng đã tồn tại.' }); }
    // const hashedPassword = await bcrypt.hash(password, 10); // Mật khẩu đã được hash trong pre-save hook
    let finalPermissions = permissions || {};
    if (role === 'admin') {
      finalPermissions = {
        add: true,
        edit: true,
        delete: true,
        approve: true,
        viewRejected: true,
        allocate: true,
        assign: true,
      };
    }
    const user = new User({ 
      username, 
      password, // Truyền mật khẩu chưa hash, pre-save hook sẽ xử lý
      role, 
      fullName: fullName || '',
      address: address || '',
      phoneNumber: phoneNumber || '',
      email: email || '',
      unit: unit || '',
      permissions: finalPermissions 
    });
    const newUser = await user.save();
    const userResponse = newUser.toObject(); 
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (error) {
    logger.error("Lỗi API thêm người dùng:", { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
    if (error.code === 11000) { return res.status(400).json({ message: `Tên người dùng "${req.body.username}" đã tồn tại.` }); }
    next(error);
  }
});

router.get('/users', authenticate, async (req, res, next) => { // Thêm next
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền xem người dùng' });
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    logger.error("Lỗi API lấy danh sách người dùng:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.patch('/users/:id', authenticate, async (req, res, next) => { // Thêm next
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền sửa người dùng' });
  try {
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    const { username, password, role, fullName, address, phoneNumber, email, unit, permissions } = req.body;
    
    if (userToUpdate.role === 'admin' || userToUpdate.username.toLowerCase() === 'admin') {
      if (role && role !== 'admin') { return res.status(403).json({ message: 'Không thể thay đổi vai trò của tài khoản admin.' }); }
      if (username && username.toLowerCase() !== 'admin' && userToUpdate.username.toLowerCase() === 'admin') { return res.status(403).json({ message: 'Không thể thay đổi username của tài khoản admin chính ("admin").' }); }
      if (username && username.toLowerCase() === 'admin' && userToUpdate.username.toLowerCase() !== 'admin') {
        const existingAdmin = await User.findOne({ username: 'admin', role: 'admin' });
        if (existingAdmin && !existingAdmin._id.equals(userToUpdate._id)) { return res.status(400).json({ message: 'Tên người dùng "admin" đã được sử dụng bởi tài khoản admin khác.' }); }
      }
      userToUpdate.role = 'admin';
    } else {
      if (role) userToUpdate.role = role;
      if (permissions) userToUpdate.permissions = permissions;
    }

    if (username && username !== userToUpdate.username && !(userToUpdate.role === 'admin' && userToUpdate.username.toLowerCase() === 'admin')) {
      const existingUser = await User.findOne({ username });
      if (existingUser && !existingUser._id.equals(userToUpdate._id)) { return res.status(400).json({ message: 'Tên người dùng mới đã tồn tại.' }); }
      userToUpdate.username = username;
    }
    if (fullName !== undefined) userToUpdate.fullName = fullName;
    if (address !== undefined) userToUpdate.address = address;
    if (phoneNumber !== undefined) userToUpdate.phoneNumber = phoneNumber;
    if (email !== undefined) userToUpdate.email = email;
    if (unit !== undefined) userToUpdate.unit = unit;

    if (password) {
      if (password.length < 6) { return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }); }
      userToUpdate.password = password; // pre-save hook sẽ hash
    }
    
    const updatedUser = await userToUpdate.save();
    const userResponse = updatedUser.toObject(); 
    delete userResponse.password;
    res.json(userResponse);
  } catch (error) {
    logger.error("Lỗi API sửa người dùng:", { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
    if (error.code === 11000) { return res.status(400).json({ message: `Tên người dùng "${req.body.username || ''}" đã tồn tại.` }); }
    next(error);
  }
});

router.delete('/users/:id', authenticate, async (req, res, next) => { // Thêm next
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền xóa người dùng' });
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    if (user.role === 'admin') { return res.status(403).json({ message: 'Không thể xóa tài khoản admin.' }); }
    if (user._id.equals(req.user.id)) { return res.status(403).json({ message: 'Bạn không thể tự xóa chính mình.' }); }
    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'Đã xóa người dùng' });
  } catch (error) {
    logger.error("Lỗi API xóa người dùng:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

const createUnitCrudEndpoints = (router, model, modelNameSingular, modelNamePlural) => {
  router.post(`/${modelNamePlural}`, authenticate, async (req, res, next) => { // Thêm next
    if (req.user.role !== 'admin') return res.status(403).json({ message: `Chỉ admin mới có quyền thêm ${modelNameSingular}` });
    try {
      const { name } = req.body;
      if (!name || name.trim() === "") { return res.status(400).json({ message: `Tên ${modelNameSingular} không được để trống` }); }
      const existingUnit = await model.findOne({ name: name.trim() });
      if (existingUnit) { return res.status(400).json({ message: `${modelNameSingular} "${name.trim()}" đã tồn tại.` }); }
      const unit = new model({ name: name.trim() });
      const newUnit = await unit.save();
      res.status(201).json(newUnit);
    } catch (error) {
      logger.error(`Lỗi API thêm ${modelNameSingular}:`, { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
      if (error.code === 11000) { return res.status(400).json({ message: `${modelNameSingular} đã tồn tại (lỗi DB).` }); }
      next(error);
    }
  });

  router.get(`/${modelNamePlural}`, authenticate, async (req, res, next) => { // Thêm next
    try {
      const units = await model.find().sort({ name: 1 });
      res.json(units);
    } catch (error) {
      logger.error(`Lỗi API lấy danh sách ${modelNameSingular}:`, { path: req.path, method: req.method, message: error.message, stack: error.stack });
      next(error);
    }
  });

  router.patch(`/${modelNamePlural}/:id`, authenticate, async (req, res, next) => { // Thêm next
    if (req.user.role !== 'admin') return res.status(403).json({ message: `Chỉ admin mới có quyền sửa ${modelNameSingular}` });
    try {
      const { name } = req.body;
      if (!name || name.trim() === "") { return res.status(400).json({ message: `Tên ${modelNameSingular} không được để trống` }); }
      const unitToUpdate = await model.findById(req.params.id);
      if (!unitToUpdate) return res.status(404).json({ message: `Không tìm thấy ${modelNameSingular}` });
      const existingUnit = await model.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
      if (existingUnit) { return res.status(400).json({ message: `${modelNameSingular} "${name.trim()}" đã tồn tại.` }); }
      unitToUpdate.name = name.trim();
      await unitToUpdate.save();
      res.json(unitToUpdate);
    } catch (error) {
      logger.error(`Lỗi API sửa ${modelNameSingular}:`, { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
      if (error.code === 11000) { return res.status(400).json({ message: `${modelNameSingular} đã tồn tại (lỗi DB).` }); }
      next(error);
    }
  });

  router.delete(`/${modelNamePlural}/:id`, authenticate, async (req, res, next) => { // Thêm next
    if (req.user.role !== 'admin') return res.status(403).json({ message: `Chỉ admin mới có quyền xóa ${modelNameSingular}` });
    try {
      const unit = await model.findById(req.params.id);
      if (!unit) return res.status(404).json({ message: `Không tìm thấy ${modelNameSingular}` });
      let projectsUsingUnit;
      if (modelNamePlural === 'allocated-units') {
        projectsUsingUnit = await CategoryProject.findOne({ allocatedUnit: unit.name }) || await MinorRepairProject.findOne({ allocatedUnit: unit.name });
      } else if (modelNamePlural === 'construction-units') {
        projectsUsingUnit = await CategoryProject.findOne({ constructionUnit: unit.name }) || await MinorRepairProject.findOne({ constructionUnit: unit.name });
      } else if (modelNamePlural === 'allocation-waves') {
        projectsUsingUnit = await CategoryProject.findOne({ allocationWave: unit.name }) || await MinorRepairProject.findOne({ allocationWave: unit.name });
      } else if (modelNamePlural === 'project-types') {
        projectsUsingUnit = await CategoryProject.findOne({ projectType: unit.name });
      }
      if (projectsUsingUnit) {
        return res.status(400).json({ message: `Không thể xóa. ${modelNameSingular} "${unit.name}" đang được sử dụng trong ít nhất một công trình.` });
      }
      await model.deleteOne({ _id: req.params.id });
      res.json({ message: `Đã xóa ${modelNameSingular}` });
    } catch (error) {
      logger.error(`Lỗi API xóa ${modelNameSingular}:`, { path: req.path, method: req.method, message: error.message, stack: error.stack });
      next(error);
    }
  });
};

createUnitCrudEndpoints(router, AllocatedUnit, 'đơn vị', 'allocated-units');
createUnitCrudEndpoints(router, ConstructionUnit, 'đơn vị thi công', 'construction-units');
createUnitCrudEndpoints(router, AllocationWave, 'đợt phân bổ', 'allocation-waves');
createUnitCrudEndpoints(router, ProjectType, 'loại công trình', 'project-types');

module.exports = router;
