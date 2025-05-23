// d:\CODE\water-company\backend\server\routes\authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware');
const { User } = require('../models');
const logger = require('../config/logger');

router.get('/auth/me', authenticate, (req, res) => {
  // req.user đã được middleware authenticate gán
  // Trả về thông tin user (bao gồm permissions đã được resolve)
  res.json({ user: req.user });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Tên đăng nhập và mật khẩu không được để trống' });
    }
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Tài khoản không tồn tại' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu không đúng' });

    // Permissions được lấy từ user document (đã được set bởi pre-save hook hoặc admin)
    const userPermissions = user.permissions;
    const userUnit = user.unit; // Lấy unit của user

    const token = jwt.sign({
      id: user._id,
      role: user.role,
      permissions: userPermissions,
      username: user.username,
      fullName: user.fullName,
      address: user.address, // Thêm address vào token
      phoneNumber: user.phoneNumber, // Thêm phoneNumber vào token
      email: user.email, // Thêm email vào token
      unit: userUnit, // Thêm unit vào payload của token
    }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token, user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        address: user.address,
        phoneNumber: user.phoneNumber,
        email: user.email,
        unit: userUnit, // Trả về unit cho client
        permissions: userPermissions
      }
    });
  } catch (error) {
    logger.error("Lỗi API đăng nhập:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.post('/users', authenticate, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền thêm người dùng' });
  try {
    const { username, password, role, fullName, address, phoneNumber, email, unit, permissions: clientPermissions } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ message: 'Tên người dùng, mật khẩu và vai trò không được để trống' });
    }
    if (username.toLowerCase() === 'admin' && role === 'admin') {
      const existingAdmin = await User.findOne({ username: 'admin', role: 'admin' });
      if (existingAdmin) { return res.status(400).json({ message: 'Tài khoản admin với username "admin" đã tồn tại.' }); }
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) { return res.status(400).json({ message: 'Tên người dùng đã tồn tại.' }); }

    const user = new User({
      username,
      password,
      role,
      fullName: fullName || '',
      address: address || '',
      phoneNumber: phoneNumber || '',
      email: email || '',
      unit: unit || '', // Lưu unit
      // permissions sẽ được pre-save hook set dựa trên role.
    });

    // Nếu client gửi permissions và role không phải admin, ghi đè lên default từ pre-save
    // pre-save hook sẽ chạy sau khi các trường được gán ở đây.
    // Nếu role là admin, pre-save hook sẽ luôn set full quyền.
    if (clientPermissions && role !== 'admin') {
        // Tạo một object permissions mới dựa trên default của role đó (nếu có) rồi merge với clientPermissions
        // Hoặc đơn giản là gán clientPermissions, pre-save sẽ set default nếu role thay đổi và clientPermissions không đủ
        let basePermissions = {}; // Lấy base permissions cho role từ logic tương tự pre-save nếu cần
        // Ví dụ:
        // if (role === 'staff-branch') basePermissions = { add: true, edit: true, delete: true, approve: false, ... };
        // user.permissions = { ...basePermissions, ...clientPermissions };
        // Hiện tại, để đơn giản, nếu client gửi permissions, ta dùng nó (trừ admin)
        // pre-save sẽ xử lý phần còn lại.
        user.permissions = clientPermissions;
    }


    const newUser = await user.save(); // pre-save hook sẽ chạy
    const userResponse = newUser.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (error) {
    logger.error("Lỗi API thêm người dùng:", { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
    if (error.code === 11000) { return res.status(400).json({ message: `Tên người dùng "${req.body.username}" đã tồn tại.` }); }
    next(error);
  }
});

router.get('/users', authenticate, async (req, res, next) => {
  // Cho phép tất cả người dùng đã xác thực lấy danh sách người dùng.
  // Việc lọc danh sách cho các mục đích cụ thể (ví dụ: người duyệt) sẽ được thực hiện ở frontend.
  // if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền xem người dùng' });
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    logger.error("Lỗi API lấy danh sách người dùng:", { path: req.path, method: req.method, message: error.message, stack: error.stack });
    next(error);
  }
});

router.patch('/users/:id', authenticate, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền sửa người dùng' });
  try {
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    const { username, password, role, fullName, address, phoneNumber, email, unit, permissions: clientPermissions } = req.body;

    const isUpdatingOwnAdminAccount = userToUpdate.username.toLowerCase() === 'admin' && userToUpdate.role === 'admin';

    if (isUpdatingOwnAdminAccount) {
      if (role && role !== 'admin') {
        return res.status(403).json({ message: 'Không thể thay đổi vai trò của tài khoản admin chính.' });
      }
      userToUpdate.role = 'admin';
      // Permissions của admin chính luôn full, không cho client thay đổi
      userToUpdate.permissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: true };
    } else {
      const previousRole = userToUpdate.role;
      if (role) {
        userToUpdate.role = role;
      }
      // Nếu client gửi permissions, áp dụng chúng.
      // pre-save hook sẽ chạy sau và có thể điều chỉnh permissions dựa trên role mới.
      if (clientPermissions) {
        // Nếu role thay đổi, permissions cũ có thể không còn phù hợp.
        // Ta có thể reset permissions về rỗng trước khi gán clientPermissions,
        // sau đó pre-save hook sẽ điền các default cho role mới nếu clientPermissions không đủ.
        // Hoặc, nếu muốn clientPermissions ghi đè hoàn toàn (trừ admin), thì gán trực tiếp.
        if (userToUpdate.role !== previousRole) {
            userToUpdate.permissions = clientPermissions; // Gán thẳng, pre-save sẽ bổ sung nếu thiếu cho role mới
        } else {
            userToUpdate.permissions = { ...userToUpdate.permissions, ...clientPermissions }; // Merge nếu role không đổi
        }
      }
    }

    if (username && username !== userToUpdate.username) {
      if (isUpdatingOwnAdminAccount) {
        return res.status(403).json({ message: 'Không thể thay đổi username của tài khoản admin chính.' });
      }
      const existingUser = await User.findOne({ username });
      if (existingUser && !existingUser._id.equals(userToUpdate._id)) {
        return res.status(400).json({ message: 'Tên người dùng mới đã tồn tại.' });
      }
      userToUpdate.username = username;
    }

    if (fullName !== undefined) userToUpdate.fullName = fullName;
    if (address !== undefined) userToUpdate.address = address;
    if (phoneNumber !== undefined) userToUpdate.phoneNumber = phoneNumber;
    if (email !== undefined) userToUpdate.email = email;
    if (unit !== undefined) userToUpdate.unit = unit; // Cập nhật unit

    if (password) {
      if (password.length < 6) { return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }); }
      userToUpdate.password = password; // pre-save hook sẽ hash
    }

    const updatedUser = await userToUpdate.save(); // pre-save hook sẽ chạy lại
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (error) {
    logger.error("Lỗi API sửa người dùng:", { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
    if (error.code === 11000) { return res.status(400).json({ message: `Tên người dùng "${req.body.username || ''}" đã tồn tại.` }); }
    next(error);
  }
});

router.delete('/users/:id', authenticate, async (req, res, next) => {
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
  router.post(`/${modelNamePlural}`, authenticate, async (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: `Chỉ admin mới có quyền thêm ${modelNameSingular}` });
    try {
      const { name, shortCode } = req.body; // Thêm shortCode
      if (!name || name.trim() === "") { return res.status(400).json({ message: `Tên ${modelNameSingular} không được để trống` }); }
      if (modelNameSingular === 'đơn vị' && (!shortCode || shortCode.trim().length !== 3)) { // Validate shortCode cho AllocatedUnit
        return res.status(400).json({ message: 'Mã viết tắt đơn vị là bắt buộc và phải có 3 ký tự.' });
      }

      const existingUnit = await model.findOne({ name: name.trim() });
      if (existingUnit) { return res.status(400).json({ message: `${modelNameSingular} "${name.trim()}" đã tồn tại.` }); }

      const dataToSave = { name: name.trim() };
      if (modelNameSingular === 'đơn vị' && shortCode) dataToSave.shortCode = shortCode.trim().toUpperCase();

      const unit = new model(dataToSave);
      const newUnit = await unit.save();
      res.status(201).json(newUnit);
    } catch (error) {
      logger.error(`Lỗi API thêm ${modelNameSingular}:`, { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
      if (error.code === 11000) { return res.status(400).json({ message: `${modelNameSingular} đã tồn tại (lỗi DB).` }); }
      next(error);
    }
  });

  router.get(`/${modelNamePlural}`, authenticate, async (req, res, next) => {
    try {
      const units = await model.find().sort({ name: 1 });
      res.json(units);
    } catch (error) {
      logger.error(`Lỗi API lấy danh sách ${modelNameSingular}:`, { path: req.path, method: req.method, message: error.message, stack: error.stack });
      next(error);
    }
  });

  router.patch(`/${modelNamePlural}/:id`, authenticate, async (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: `Chỉ admin mới có quyền sửa ${modelNameSingular}` });
    try {
      const { name, shortCode } = req.body; // Thêm shortCode
      if (!name || name.trim() === "") { return res.status(400).json({ message: `Tên ${modelNameSingular} không được để trống` }); }
      if (modelNameSingular === 'đơn vị' && shortCode && shortCode.trim().length !== 3) {
        return res.status(400).json({ message: 'Mã viết tắt đơn vị phải có 3 ký tự nếu được cung cấp.' });
      }

      const unitToUpdate = await model.findById(req.params.id);
      if (!unitToUpdate) return res.status(404).json({ message: `Không tìm thấy ${modelNameSingular}` });
      const existingUnit = await model.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
      if (existingUnit) { return res.status(400).json({ message: `${modelNameSingular} "${name.trim()}" đã tồn tại.` }); }

      unitToUpdate.name = name.trim();
      if (modelNameSingular === 'đơn vị' && shortCode) {
        unitToUpdate.shortCode = shortCode.trim().toUpperCase();
      }
      await unitToUpdate.save();
      res.json(unitToUpdate);
    } catch (error) {
      logger.error(`Lỗi API sửa ${modelNameSingular}:`, { path: req.path, method: req.method, message: error.message, stack: error.stack, code: error.code });
      if (error.code === 11000) { return res.status(400).json({ message: `${modelNameSingular} đã tồn tại (lỗi DB).` }); }
      next(error);
    }
  });

  router.delete(`/${modelNamePlural}/:id`, authenticate, async (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: `Chỉ admin mới có quyền xóa ${modelNameSingular}` });
    try {
      const unit = await model.findById(req.params.id);
      if (!unit) return res.status(404).json({ message: `Không tìm thấy ${modelNameSingular}` });
      // Logic kiểm tra unit có đang được sử dụng không
      const isUsedInCategory = await CategoryProject.exists({ $or: [{ allocatedUnit: unit.name }, { constructionUnit: unit.name }, { allocationWave: unit.name }] });
      const isUsedInMinorRepair = await MinorRepairProject.exists({ allocatedUnit: unit.name });
      const isUserUnit = await User.exists({ unit: unit.name });

      if (isUsedInCategory || isUsedInMinorRepair || isUserUnit) {
        return res.status(400).json({ message: `${modelNameSingular} "${unit.name}" đang được sử dụng và không thể xóa.` });
      }

      await model.deleteOne({ _id: req.params.id });
      res.json({ message: `Đã xóa ${modelNameSingular}` });
    } catch (error) {
      logger.error(`Lỗi API xóa ${modelNameSingular}:`, { path: req.path, method: req.method, message: error.message, stack: error.stack });
      next(error);
    }
  });
};
const { AllocatedUnit, ConstructionUnit, AllocationWave, ProjectType, CategoryProject, MinorRepairProject } = require('../models');
createUnitCrudEndpoints(router, AllocatedUnit, 'đơn vị', 'allocated-units');
createUnitCrudEndpoints(router, ConstructionUnit, 'đơn vị thi công', 'construction-units');
createUnitCrudEndpoints(router, AllocationWave, 'đợt phân bổ', 'allocation-waves');
createUnitCrudEndpoints(router, ProjectType, 'loại công trình', 'project-types');

// Route cho user tự cập nhật thông tin cá nhân (không bao gồm role, permissions)
router.patch('/users/me/profile', authenticate, async (req, res, next) => {
  try {
    const userToUpdate = await User.findById(req.user.id);
    if (!userToUpdate) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    const { fullName, address, phoneNumber, email } = req.body;

    if (fullName !== undefined) userToUpdate.fullName = fullName;
    if (address !== undefined) userToUpdate.address = address;
    if (phoneNumber !== undefined) userToUpdate.phoneNumber = phoneNumber;
    if (email !== undefined) {
      // Optional: Validate email format
      userToUpdate.email = email;
    }

    const updatedUser = await userToUpdate.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password; // Không trả về mật khẩu
    // Cập nhật thông tin user trong token nếu cần, hoặc yêu cầu client fetch lại user info
    res.json({ message: 'Thông tin cá nhân đã được cập nhật.', user: userResponse });

  } catch (error) {
    logger.error("Lỗi API cập nhật profile người dùng:", { userId: req.user.id, message: error.message, stack: error.stack });
    next(error);
  }
});

// Route cho user tự đổi mật khẩu
router.patch('/users/me/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại và mật khẩu mới là bắt buộc.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const user = await User.findById(req.user.id); // Lấy cả password hash
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });

    user.password = newPassword; // pre-save hook sẽ hash mật khẩu mới
    await user.save();

    res.json({ message: 'Mật khẩu đã được thay đổi thành công.' });
  } catch (error) {
    logger.error("Lỗi API đổi mật khẩu người dùng:", { userId: req.user.id, message: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;
