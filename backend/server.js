// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();
const app = express();
const server = http.createServer(app);

// Cấu hình CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin ${origin} không được phép.`);
      callback(new Error(`Origin ${origin} không được phép bởi CORS`));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const io = socketIo(server, { cors: corsOptions });

const port = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Đã kết nối MongoDB Atlas'))
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Schema để quản lý số thứ tự
const serialCounterSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true }, // 'category' hoặc 'minor_repair'
  currentSerial: { type: Number, default: 0 },
});
const SerialCounter = mongoose.model('SerialCounter', serialCounterSchema);

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'director', 'deputy_director', 'manager', 'deputy_manager', 'staff', 'branch_director', 'branch_deputy_director', 'branch_staff', 'worker'], default: 'staff' },
  permissions: {
    add: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
  },
});

userSchema.pre('save', function (next) {
  if (this.role === 'admin') {
    this.permissions = {
      add: true,
      edit: true,
      delete: true,
      approve: true,
    };
  }
  next();
});

const User = mongoose.model('User', userSchema);

// AllocatedUnit Schema
const allocatedUnitSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
});
const AllocatedUnit = mongoose.model('AllocatedUnit', allocatedUnitSchema);

// ConstructionUnit Schema
const constructionUnitSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
});
const ConstructionUnit = mongoose.model('ConstructionUnit', constructionUnitSchema);

// AllocationWave Schema
const allocationWaveSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
});
const AllocationWave = mongoose.model('AllocationWave', allocationWaveSchema);

// CategoryProject Schema (Công trình danh mục)
const categoryProjectSchema = new mongoose.Schema({
  categorySerialNumber: { type: Number, default: null, sparse: true, index: true },
  name: { type: String, required: true, trim: true },
  allocatedUnit: { type: String, required: true, trim: true },
  constructionUnit: { type: String, default: '', trim: true },
  allocationWave: { type: String, default: '', trim: true },
  location: { type: String, required: true, trim: true },
  scale: { type: String, required: true, trim: true }, // Bắt buộc cho danh mục
  enteredBy: { type: String, required: true, trim: true },
  status: { type: String, default: 'Chờ duyệt', index: true },
  assignedTo: { type: String, default: '', trim: true },
  pendingEdit: { type: Object, default: null },
  pendingDelete: { type: Boolean, default: false },
}, { timestamps: true });

categoryProjectSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const counter = await SerialCounter.findOneAndUpdate(
        { type: 'category' },
        { $inc: { currentSerial: 1 } },
        { new: true, upsert: true }
      );
      this.categorySerialNumber = counter.currentSerial;
    } catch (error) {
      console.error(`Lỗi khi tạo số thứ tự cho công trình danh mục:`, error);
      return next(new Error(`Không thể tạo số thứ tự cho công trình danh mục: ${error.message}`));
    }
  }
  next();
});

const CategoryProject = mongoose.model('CategoryProject', categoryProjectSchema);

// MinorRepairProject Schema (Công trình sửa chữa nhỏ)
const minorRepairProjectSchema = new mongoose.Schema({
  minorRepairSerialNumber: { type: Number, default: null, sparse: true, index: true },
  name: { type: String, required: true, trim: true },
  allocatedUnit: { type: String, required: true, trim: true },
  constructionUnit: { type: String, default: '', trim: true },
  allocationWave: { type: String, default: '', trim: true },
  location: { type: String, required: true, trim: true },
  enteredBy: { type: String, required: true, trim: true },
  status: { type: String, default: 'Chờ duyệt', index: true },
  assignedTo: { type: String, default: '', trim: true },
  pendingEdit: { type: Object, default: null },
  pendingDelete: { type: Boolean, default: false },
}, { timestamps: true });

minorRepairProjectSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const counter = await SerialCounter.findOneAndUpdate(
        { type: 'minor_repair' },
        { $inc: { currentSerial: 1 } },
        { new: true, upsert: true }
      );
      this.minorRepairSerialNumber = counter.currentSerial;
    } catch (error) {
      console.error(`Lỗi khi tạo số thứ tự cho công trình sửa chữa nhỏ:`, error);
      return next(new Error(`Không thể tạo số thứ tự cho công trình sửa chữa nhỏ: ${error.message}`));
    }
  }
  next();
});

const MinorRepairProject = mongoose.model('MinorRepairProject', minorRepairProjectSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, enum: ['new', 'edit', 'delete'], required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, refPath: 'projectModel' },
  projectModel: { type: String, required: true, enum: ['CategoryProject', 'MinorRepairProject'] },
  status: { type: String, enum: ['pending', 'processed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
const Notification = mongoose.model('Notification', notificationSchema);

// Hàm cập nhật số thứ tự cho từng loại công trình
async function updateSerialNumbers(type) {
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;
  const serialField = type === 'category' ? 'categorySerialNumber' : 'minorRepairSerialNumber';
  try {
    const projects = await Model.find().sort({ createdAt: 1 });
    const bulkOps = projects.map((project, index) => ({
      updateOne: {
        filter: { _id: project._id },
        update: { [serialField]: index + 1 },
      },
    }));

    if (bulkOps.length > 0) {
      await Model.bulkWrite(bulkOps, { ordered: false });
    }

    const newMaxSerial = projects.length > 0 ? projects.length : 0;
    await SerialCounter.findOneAndUpdate(
      { type },
      { currentSerial: newMaxSerial },
      { upsert: true }
    );
  } catch (error) {
    console.error(`Lỗi khi cập nhật số thứ tự cho loại ${type}:`, error);
    throw new Error(`Lỗi khi cập nhật số thứ tự: ${error.message}`);
  }
}

// Script đồng bộ dữ liệu từ collection projects cũ
async function syncOldProjects() {
  console.log('Bắt đầu đồng bộ dữ liệu công trình từ collection projects cũ...');
  try {
    // Kiểm tra xem collection projects có tồn tại không
    const collections = await mongoose.connection.db.listCollections().toArray();
    const projectsCollectionExists = collections.some(col => col.name === 'projects');
    if (!projectsCollectionExists) {
      console.log('Không tìm thấy collection projects cũ, bỏ qua đồng bộ.');
      return;
    }

    const OldProject = mongoose.model('OldProject', new mongoose.Schema({}, { strict: false }), 'projects');

    // Đồng bộ công trình danh mục
    const categoryProjects = await OldProject.find({ type: 'category' }).sort({ createdAt: 1 });
    for (let i = 0; i < categoryProjects.length; i++) {
      const oldProject = categoryProjects[i];
      const newProject = new CategoryProject({
        categorySerialNumber: oldProject.categorySerialNumber || (i + 1),
        name: oldProject.name,
        allocatedUnit: oldProject.allocatedUnit,
        constructionUnit: oldProject.constructionUnit || '',
        allocationWave: oldProject.allocationWave || '',
        location: oldProject.location,
        scale: oldProject.scale || '',
        enteredBy: oldProject.enteredBy,
        status: oldProject.status || 'Chờ duyệt',
        assignedTo: oldProject.assignedTo || '',
        pendingEdit: oldProject.pendingEdit || null,
        pendingDelete: oldProject.pendingDelete || false,
        createdAt: oldProject.createdAt,
        updatedAt: oldProject.updatedAt,
      });
      await newProject.save({ validateBeforeSave: false });
    }
    await SerialCounter.findOneAndUpdate(
      { type: 'category' },
      { currentSerial: categoryProjects.length },
      { upsert: true }
    );
    console.log(`Đã đồng bộ ${categoryProjects.length} công trình danh mục.`);

    // Đồng bộ công trình sửa chữa nhỏ
    const minorRepairProjects = await OldProject.find({ type: 'minor_repair' }).sort({ createdAt: 1 });
    for (let i = 0; i < minorRepairProjects.length; i++) {
      const oldProject = minorRepairProjects[i];
      const newProject = new MinorRepairProject({
        minorRepairSerialNumber: oldProject.minorRepairSerialNumber || (i + 1),
        name: oldProject.name,
        allocatedUnit: oldProject.allocatedUnit,
        constructionUnit: oldProject.constructionUnit || '',
        allocationWave: oldProject.allocationWave || '',
        location: oldProject.location,
        enteredBy: oldProject.enteredBy,
        status: oldProject.status || 'Chờ duyệt',
        assignedTo: oldProject.assignedTo || '',
        pendingEdit: oldProject.pendingEdit || null,
        pendingDelete: oldProject.pendingDelete || false,
        createdAt: oldProject.createdAt,
        updatedAt: oldProject.updatedAt,
      });
      await newProject.save({ validateBeforeSave: false });
    }
    await SerialCounter.findOneAndUpdate(
      { type: 'minor_repair' },
      { currentSerial: minorRepairProjects.length },
      { upsert: true }
    );
    console.log(`Đã đồng bộ ${minorRepairProjects.length} công trình sửa chữa nhỏ.`);

    // Cập nhật notifications
    const notifications = await Notification.find();
    for (const notification of notifications) {
      const project = await OldProject.findById(notification.projectId);
      if (project) {
        notification.projectModel = project.type === 'category' ? 'CategoryProject' : 'MinorRepairProject';
        await notification.save();
      }
    }
    console.log('Đã cập nhật projectModel cho notifications.');

    console.log('Đồng bộ dữ liệu hoàn tất.');
  } catch (error) {
    console.error('Lỗi khi đồng bộ dữ liệu:', error);
  }
}

// Chạy script đồng bộ khi server khởi động
mongoose.connection.once('open', async () => {
  console.log('Đã kết nối MongoDB Atlas');
  await syncOldProjects();
});

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Không có token hoặc token không đúng định dạng Bearer' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'admin') {
      decoded.permissions = { add: true, edit: true, delete: true, approve: true };
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Lỗi xác thực token:", error.message);
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

// API endpoints không thay đổi nhiều, chỉ cần điều chỉnh để sử dụng đúng model
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ message: 'Tên đăng nhập và mật khẩu không được để trống' }); }
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Tài khoản không tồn tại' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu không đúng' });
    let userPermissions = user.permissions;
    if (user.role === 'admin') { userPermissions = { add: true, edit: true, delete: true, approve: true }; }
    const token = jwt.sign({ id: user._id, role: user.role, permissions: userPermissions, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user._id, username: user.username, role: user.role, permissions: userPermissions } });
  } catch (error) {
    console.error("Lỗi API đăng nhập:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập' });
  }
});

app.post('/api/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền thêm người dùng' });
  try {
    const { username, password, role, permissions } = req.body;
    if (!username || !password || !role) { return res.status(400).json({ message: 'Tên người dùng, mật khẩu và vai trò không được để trống' }); }
    if (username.toLowerCase() === 'admin' && role === 'admin') {
      const existingAdmin = await User.findOne({ username: 'admin', role: 'admin' });
      if (existingAdmin) { return res.status(400).json({ message: 'Tài khoản admin với username "admin" đã tồn tại.' }); }
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) { return res.status(400).json({ message: 'Tên người dùng đã tồn tại.' }); }
    const hashedPassword = await bcrypt.hash(password, 10);
    let finalPermissions = permissions;
    if (role === 'admin') { finalPermissions = { add: true, edit: true, delete: true, approve: true }; }
    const user = new User({ username, password: hashedPassword, role, permissions: finalPermissions });
    const newUser = await user.save();
    const userResponse = newUser.toObject(); delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (error) {
    console.error("Lỗi API thêm người dùng:", error);
    if (error.code === 11000) { return res.status(400).json({ message: `Tên người dùng "${req.body.username}" đã tồn tại.` }); }
    res.status(400).json({ message: 'Lỗi khi thêm người dùng: ' + error.message });
  }
});

app.get('/api/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền xem người dùng' });
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error("Lỗi API lấy danh sách người dùng:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách người dùng' });
  }
});

app.patch('/api/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền sửa người dùng' });
  try {
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    const { username, password, role, permissions } = req.body;
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
    if (password) {
      if (password.length < 6) { return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }); }
      userToUpdate.password = await bcrypt.hash(password, 10);
    }
    const updatedUser = await userToUpdate.save();
    const userResponse = updatedUser.toObject(); delete userResponse.password;
    res.json(userResponse);
  } catch (error) {
    console.error("Lỗi API sửa người dùng:", error);
    if (error.code === 11000) { return res.status(400).json({ message: `Tên người dùng "${req.body.username || ''}" đã tồn tại.` }); }
    res.status(400).json({ message: 'Lỗi khi cập nhật người dùng: ' + error.message });
  }
});

app.delete('/api/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền xóa người dùng' });
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    if (user.role === 'admin') { return res.status(403).json({ message: 'Không thể xóa tài khoản admin.' }); }
    if (user._id.equals(req.user.id)) { return res.status(403).json({ message: 'Bạn không thể tự xóa chính mình.' }); }
    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'Đã xóa người dùng' });
  } catch (error) {
    console.error("Lỗi API xóa người dùng:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa người dùng' });
  }
});

const createUnitCrudEndpoints = (model, modelNameSingular, modelNamePlural) => {
  app.post(`/api/${modelNamePlural}`, authenticate, async (req, res) => {
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
      console.error(`Lỗi API thêm ${modelNameSingular}:`, error);
      if (error.code === 11000) { return res.status(400).json({ message: `${modelNameSingular} đã tồn tại (lỗi DB).` }); }
      res.status(400).json({ message: `Lỗi khi thêm ${modelNameSingular}: ` + error.message });
    }
  });

  app.get(`/api/${modelNamePlural}`, authenticate, async (req, res) => {
    try {
      const units = await model.find().sort({ name: 1 });
      res.json(units);
    } catch (error) {
      console.error(`Lỗi API lấy danh sách ${modelNameSingular}:`, error);
      res.status(500).json({ message: `Lỗi máy chủ khi lấy danh sách ${modelNameSingular}` });
    }
  });

  app.patch(`/api/${modelNamePlural}/:id`, authenticate, async (req, res) => {
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
      console.error(`Lỗi API sửa ${modelNameSingular}:`, error);
      if (error.code === 11000) { return res.status(400).json({ message: `${modelNameSingular} đã tồn tại (lỗi DB).` }); }
      res.status(400).json({ message: `Lỗi khi cập nhật ${modelNameSingular}: ` + error.message });
    }
  });

  app.delete(`/api/${modelNamePlural}/:id`, authenticate, async (req, res) => {
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
      }
      if (projectsUsingUnit) {
        return res.status(400).json({ message: `Không thể xóa. ${modelNameSingular} "${unit.name}" đang được sử dụng trong ít nhất một công trình.` });
      }
      await model.deleteOne({ _id: req.params.id });
      res.json({ message: `Đã xóa ${modelNameSingular}` });
    } catch (error) {
      console.error(`Lỗi API xóa ${modelNameSingular}:`, error);
      res.status(500).json({ message: `Lỗi máy chủ khi xóa ${modelNameSingular}` });
    }
  });
};

createUnitCrudEndpoints(AllocatedUnit, 'đơn vị phân bổ', 'allocated-units');
createUnitCrudEndpoints(ConstructionUnit, 'đơn vị thi công', 'construction-units');
createUnitCrudEndpoints(AllocationWave, 'đợt phân bổ', 'allocation-waves');

app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    if (!req.user.permissions.approve && status === 'pending') { return res.json([]); }
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).populate('projectId', 'name');
    res.json(notifications);
  } catch (error) {
    console.error("Lỗi API lấy thông báo:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy thông báo' });
  }
});

app.patch('/api/notifications/:id', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền cập nhật thông báo' });
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Không tìm thấy thông báo' });
    if (req.body.status && ['pending', 'processed'].includes(req.body.status)) {
      notification.status = req.body.status;
    } else {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }
    await notification.save();
    io.emit('notification_processed', notification._id);
    res.json(notification);
  } catch (error) {
    console.error("Lỗi API cập nhật thông báo:", error);
    res.status(400).json({ message: 'Lỗi khi cập nhật thông báo: ' + error.message });
  }
});

// API lấy danh sách công trình
app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const { type, page = 1, limit = 10, status, allocatedUnit, constructionUnit, allocationWave, assignedTo, search } = req.query;
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const query = {};
    if (status) query.status = status;
    if (allocatedUnit) query.allocatedUnit = allocatedUnit;
    if (constructionUnit) query.constructionUnit = constructionUnit;
    if (allocationWave) query.allocationWave = allocationWave;
    if (assignedTo) query.assignedTo = { $regex: assignedTo, $options: 'i' };
    if (search) query.name = { $regex: search, $options: 'i' };
    const count = await Model.countDocuments(query);
    const projects = await Model.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({
      projects,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("Lỗi API lấy danh sách công trình:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách công trình' });
  }
});

// API thêm công trình
app.post('/api/projects', authenticate, async (req, res) => {
  if (!req.user.permissions.add) return res.status(403).json({ message: 'Không có quyền thêm công trình' });
  try {
    const { name, allocatedUnit, location, type, scale } = req.body;
    if (!name || !allocatedUnit || !location || !type) {
      return res.status(400).json({ message: 'Tên công trình, đơn vị phân bổ, vị trí và loại công trình là bắt buộc.' });
    }
    if (type === 'category' && !scale) {
      return res.status(400).json({ message: 'Quy mô là bắt buộc cho công trình danh mục.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const projectData = { ...req.body, enteredBy: req.user.username };
    if (type === 'minor_repair' && projectData.hasOwnProperty('scale')) {
      delete projectData.scale;
    }
    delete projectData.type; // Không cần trường type trong dữ liệu lưu trữ
    const project = new Model(projectData);
    const newProject = await project.save();
    const populatedProjectForNotification = { _id: newProject._id, name: newProject.name, type };
    const notification = new Notification({
      message: `Công trình mới "${newProject.name}" (${type === 'category' ? 'Danh mục' : 'Sửa chữa nhỏ'}) bởi ${req.user.username}`,
      type: 'new',
      projectId: newProject._id,
      projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
    });
    await notification.save();
    io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
    res.status(201).json(newProject);
  } catch (error) {
    console.error("Lỗi API thêm công trình:", error);
    if (error.code === 11000 && (error.message.includes('categorySerialNumber') || error.message.includes('minorRepairSerialNumber'))) {
      return res.status(400).json({ message: 'Lỗi tạo số thứ tự công trình: Số thứ tự đã tồn tại. Vui lòng thử lại sau.' });
    }
    if (error.message.startsWith('Không thể tạo số thứ tự cho công trình')) {
      return res.status(500).json({ message: error.message });
    }
    res.status(400).json({ message: 'Lỗi khi thêm công trình: ' + error.message });
  }
});

// API sửa công trình
app.patch('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { type } = req.query; // Lấy type từ query để biết model nào
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    const canEditDirectly = req.user.permissions.edit && project.status !== 'Đã duyệt';
    const canRequestEdit = req.user.permissions.edit && (project.enteredBy === req.user.username || req.user.role === 'admin');
    const isApprover = req.user.permissions.approve;
    const updateData = { ...req.body };
    if (project.status === 'Đã duyệt' && !isApprover) {
      delete updateData.status;
      delete updateData.categorySerialNumber;
      delete updateData.minorRepairSerialNumber;
    }
    if (type === 'minor_repair' && updateData.hasOwnProperty('scale')) {
      delete updateData.scale;
    }
    if (isApprover && project.pendingEdit && req.body.approvedEdit === true) {
      Object.assign(project, project.pendingEdit);
      project.pendingEdit = null;
      project.status = 'Đã duyệt';
      await project.save();
      const editNotification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
      if (editNotification) {
        editNotification.status = 'processed';
        await editNotification.save();
        io.emit('notification_processed', editNotification._id);
      }
      return res.json(project);
    } else if (canRequestEdit && project.status === 'Đã duyệt' && !isApprover) {
      const dataToPending = { ...updateData };
      delete dataToPending.status;
      project.pendingEdit = dataToPending;
      await project.save();
      const populatedProjectForNotification = { _id: project._id, name: project.name, type };
      const notification = new Notification({
        message: `Yêu cầu sửa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'edit',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      });
      await notification.save();
      io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      return res.json({ message: 'Yêu cầu sửa đã được gửi để chờ duyệt', project });
    } else if (canEditDirectly || (isApprover && !project.pendingEdit)) {
      Object.assign(project, updateData);
      await project.save();
      return res.json(project);
    } else {
      return res.status(403).json({ message: 'Không có quyền sửa công trình này hoặc gửi yêu cầu sửa.' });
    }
  } catch (error) {
    console.error("Lỗi API sửa công trình:", error);
    res.status(400).json({ message: 'Lỗi khi cập nhật công trình: ' + error.message });
  }
});

// API xóa công trình
app.delete('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    const isUserAdmin = req.user.role === 'admin';
    const hasDeletePermission = req.user.permissions.delete;
    const isApprover = req.user.permissions.approve;

    if (isUserAdmin) {
      const projectId = project._id;
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);

      const anyPendingNotification = await Notification.findOne({ projectId: projectId, status: 'pending', type: 'delete', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
      if (anyPendingNotification) {
        anyPendingNotification.status = 'processed';
        await anyPendingNotification.save();
        io.emit('notification_processed', anyPendingNotification._id);
      }
      return res.json({ message: 'Admin đã xóa công trình thành công.' });
    } else if (isApprover && project.pendingDelete) {
      const projectId = project._id;
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);

      const deleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
      if (deleteNotification) {
        deleteNotification.status = 'processed';
        await deleteNotification.save();
        io.emit('notification_processed', deleteNotification._id);
      }
      return res.json({ message: 'Đã xóa công trình (sau khi duyệt yêu cầu).' });
    } else if (hasDeletePermission && (project.enteredBy === req.user.username) && project.status === 'Đã duyệt' && !isApprover) {
      project.pendingDelete = true;
      await project.save();
      const populatedProjectForNotification = { _id: project._id, name: project.name, type };
      const notification = new Notification({
        message: `Yêu cầu xóa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'delete',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      });
      await notification.save();
      io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      return res.json({ message: 'Yêu cầu xóa đã được gửi để chờ duyệt.', project });
    } else if (hasDeletePermission && project.status !== 'Đã duyệt') {
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);
      return res.json({ message: 'Đã xóa công trình.' });
    } else {
      return res.status(403).json({ message: 'Không có quyền xóa công trình này hoặc gửi yêu cầu xóa.' });
    }
  } catch (error) {
    console.error("Lỗi API xóa công trình:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa công trình: ' + error.message });
  }
});

// API duyệt công trình
app.patch('/api/projects/:id/approve', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền duyệt' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status !== 'Chờ duyệt') return res.status(400).json({ message: 'Công trình đã được xử lý hoặc không ở trạng thái chờ duyệt.' });
    project.status = 'Đã duyệt';
    project.pendingEdit = null;
    project.pendingDelete = false;
    await project.save();
    res.json(project);
  } catch (error) {
    console.error("Lỗi API duyệt công trình:", error);
    res.status(400).json({ message: 'Lỗi khi duyệt công trình: ' + error.message });
  }
});

// API từ chối công trình
app.patch('/api/projects/:id/reject', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền từ chối' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status !== 'Chờ duyệt') return res.status(400).json({ message: 'Công trình đã được xử lý hoặc không ở trạng thái chờ duyệt.' });
    project.status = 'Từ chối';
    project.pendingEdit = null;
    project.pendingDelete = false;
    await project.save();
    res.json(project);
  } catch (error) {
    console.error("Lỗi API từ chối công trình:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối công trình: ' + error.message });
  }
});

// API phân bổ công trình
app.patch('/api/projects/:id/allocate', authenticate, async (req, res) => {
  if (!req.user.permissions.edit) return res.status(403).json({ message: 'Không có quyền phân bổ công trình' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status !== 'Đã duyệt') {
      return res.status(400).json({ message: 'Chỉ có thể phân bổ công trình đã được duyệt.' });
    }
    project.allocationWave = req.body.allocationWave || '';
    await project.save();
    res.json(project);
  } catch (error) {
    console.error("Lỗi API phân bổ công trình:", error);
    res.status(400).json({ message: 'Lỗi khi phân bổ công trình: ' + error.message });
  }
});

// API phân công công trình
app.patch('/api/projects/:id/assign', authenticate, async (req, res) => {
  if (!req.user.permissions.edit) return res.status(403).json({ message: 'Không có quyền phân công' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status !== 'Đã duyệt') {
      return res.status(400).json({ message: 'Chỉ có thể phân công công trình đã được duyệt.' });
    }
    project.assignedTo = req.body.assignedTo || '';
    await project.save();
    res.json(project);
  } catch (error) {
    console.error("Lỗi API phân công công trình:", error);
    res.status(400).json({ message: 'Lỗi khi phân công công trình: ' + error.message });
  }
});

// API duyệt yêu cầu sửa
app.patch('/api/projects/:id/approve-edit', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền duyệt sửa' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (!project.pendingEdit) return res.status(400).json({ message: 'Không có yêu cầu sửa nào đang chờ duyệt cho công trình này.' });
    Object.assign(project, project.pendingEdit);
    project.pendingEdit = null;
    project.status = 'Đã duyệt';
    await project.save();
    const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      io.emit('notification_processed', notification._id);
    }
    res.json(project);
  } catch (error) {
    console.error("Lỗi API duyệt sửa:", error);
    res.status(400).json({ message: 'Lỗi khi duyệt sửa: ' + error.message });
  }
});

// API từ chối yêu cầu sửa
app.patch('/api/projects/:id/reject-edit', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền từ chối sửa' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (!project.pendingEdit) return res.status(400).json({ message: 'Không có yêu cầu sửa nào đang chờ duyệt cho công trình này.' });
    project.pendingEdit = null;
    await project.save();
    const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      io.emit('notification_processed', notification._id);
    }
    res.json(project);
  } catch (error) {
    console.error("Lỗi API từ chối sửa:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối sửa: ' + error.message });
  }
});

// API duyệt yêu cầu xóa
app.patch('/api/projects/:id/approve-delete', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền duyệt xóa' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (!project.pendingDelete) return res.status(400).json({ message: 'Công trình này không có yêu cầu xóa đang chờ duyệt.' });
    const projectId = project._id;
    await Model.deleteOne({ _id: projectId });
    await updateSerialNumbers(type);
    const notification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      io.emit('notification_processed', notification._id);
    }
    res.json({ message: 'Đã xóa công trình theo yêu cầu' });
  } catch (error) {
    console.error("Lỗi API duyệt xóa:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi duyệt xóa công trình: ' + error.message });
  }
});

// API từ chối yêu cầu xóa
app.patch('/api/projects/:id/reject-delete', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền từ chối xóa' });
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (!project.pendingDelete) return res.status(400).json({ message: 'Công trình này không có yêu cầu xóa đang chờ duyệt.' });
    project.pendingDelete = false;
    await project.save();
    const notification = await Notification.findOne({ projectId: project._id, type: 'delete', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      io.emit('notification_processed', notification._id);
    }
    res.json(project);
  } catch (error) {
    console.error("Lỗi API từ chối xóa:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối xóa: ' + error.message });
  }
});

server.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});