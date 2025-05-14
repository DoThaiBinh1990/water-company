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
  type: { type: String, required: true, unique: true },
  currentSerial: { type: Number, default: 0 },
});
const SerialCounter = mongoose.model('SerialCounter', serialCounterSchema);

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'director', 'deputy_director', 'manager', 'deputy_manager', 'staff', 'branch_director', 'branch_deputy_director', 'branch_staff', 'worker'], default: 'staff' },
  fullName: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  phoneNumber: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  unit: { type: String, trim: true, default: '' },
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

// AllocatedUnit Schema (Đơn vị)
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

// ProjectType Schema (Loại công trình)
const projectTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
});
const ProjectType = mongoose.model('ProjectType', projectTypeSchema);

// CategoryProject Schema (Công trình danh mục)
const categoryProjectSchema = new mongoose.Schema({
  categorySerialNumber: { type: Number, default: null, sparse: true, index: true },
  name: { type: String, required: true, trim: true },
  allocatedUnit: { type: String, required: true, trim: true },
  constructionUnit: { type: String, default: '', trim: true },
  allocationWave: { type: String, default: '', trim: true },
  location: { type: String, required: true, trim: true },
  scale: { type: String, required: true, trim: true },
  initialValue: { type: Number, default: 0 },
  enteredBy: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'Chờ duyệt', index: true },
  assignedTo: { type: String, default: '', trim: true },
  estimator: { type: String, default: '', trim: true },
  supervisor: { type: String, default: '', trim: true },
  durationDays: { type: Number, default: 0 },
  startDate: { type: Date },
  completionDate: { type: Date },
  taskDescription: { type: String, default: '', trim: true },
  contractValue: { type: Number, default: 0 },
  progress: { type: String, default: '', trim: true },
  feasibility: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  pendingEdit: { type: Object, default: null },
  pendingDelete: { type: Boolean, default: false },
  projectType: { type: String, default: '', trim: true },
  estimatedValue: { type: Number, default: 0 },
  leadershipApproval: { type: String, default: '', trim: true },
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
  initialValue: { type: Number, default: 0 },
  enteredBy: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'Chờ duyệt', index: true },
  assignedTo: { type: String, default: '', trim: true },
  estimator: { type: String, default: '', trim: true },
  supervisor: { type: String, default: '', trim: true },
  durationDays: { type: Number, default: 0 },
  startDate: { type: Date },
  completionDate: { type: Date },
  taskDescription: { type: String, default: '', trim: true },
  contractValue: { type: Number, default: 0 },
  progress: { type: String, default: '', trim: true },
  feasibility: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
const Notification = mongoose.model('Notification', notificationSchema);

// RejectedProject Schema (Công trình bị từ chối)
const rejectedProjectSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  projectName: { type: String, required: true },
  projectModel: { type: String, enum: ['CategoryProject', 'MinorRepairProject'], required: true },
  actionType: { type: String, enum: ['new', 'edit', 'delete'], required: true },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rejectedAt: { type: Date, default: Date.now },
  details: { type: mongoose.Schema.Types.Mixed },
});
const RejectedProject = mongoose.model('RejectedProject', rejectedProjectSchema);

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

// Hàm đồng bộ dữ liệu từ collection projects cũ
async function syncOldProjects() {
  console.log('Bắt đầu đồng bộ dữ liệu công trình từ collection projects cũ...');
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const projectsCollectionExists = collections.some(col => col.name === 'projects');
    if (!projectsCollectionExists) {
      throw new Error('Không tìm thấy collection projects cũ để đồng bộ.');
    }

    const OldProject = mongoose.model('OldProject', new mongoose.Schema({}, { strict: false }), 'projects');

    const categoryProjects = await OldProject.find({ type: 'category' }).sort({ createdAt: 1 });
    const categoryBulkOps = [];
    let categorySerial = await SerialCounter.findOne({ type: 'category' });
    if (!categorySerial) {
      categorySerial = new SerialCounter({ type: 'category', currentSerial: 0 });
    }

    for (const oldProject of categoryProjects) {
      const existingProject = await CategoryProject.findById(oldProject._id);
      const projectData = {
        categorySerialNumber: existingProject ? existingProject.categorySerialNumber : ++categorySerial.currentSerial,
        name: oldProject.name,
        allocatedUnit: oldProject.allocatedUnit,
        constructionUnit: oldProject.constructionUnit || '',
        allocationWave: oldProject.allocationWave || '',
        location: oldProject.location,
        scale: oldProject.scale || '',
        initialValue: oldProject.initialValue || 0,
        enteredBy: oldProject.enteredBy,
        createdBy: oldProject.createdBy || null,
        status: oldProject.status || 'Chờ duyệt',
        assignedTo: oldProject.assignedTo || '',
        estimator: oldProject.estimator || '',
        supervisor: oldProject.supervisor || '',
        durationDays: oldProject.durationDays || 0,
        startDate: oldProject.startDate || null,
        completionDate: oldProject.completionDate || null,
        taskDescription: oldProject.taskDescription || '',
        contractValue: oldProject.contractValue || 0,
        progress: oldProject.progress || '',
        feasibility: oldProject.feasibility || '',
        notes: oldProject.notes || '',
        pendingEdit: oldProject.pendingEdit || null,
        pendingDelete: oldProject.pendingDelete || false,
        projectType: oldProject.projectType || '',
        estimatedValue: oldProject.estimatedValue || 0,
        leadershipApproval: oldProject.leadershipApproval || '',
        createdAt: oldProject.createdAt,
        updatedAt: oldProject.updatedAt,
      };

      if (existingProject) {
        categoryBulkOps.push({
          updateOne: {
            filter: { _id: oldProject._id },
            update: { $set: projectData },
          },
        });
      } else {
        categoryBulkOps.push({
          insertOne: {
            document: { _id: oldProject._id, ...projectData },
          },
        });
      }
    }

    if (categoryBulkOps.length > 0) {
      await CategoryProject.bulkWrite(categoryBulkOps);
    }
    await SerialCounter.findOneAndUpdate(
      { type: 'category' },
      { currentSerial: categorySerial.currentSerial },
      { upsert: true }
    );
    console.log(`Đã đồng bộ ${categoryProjects.length} công trình danh mục.`);

    const minorRepairProjects = await OldProject.find({ type: 'minor_repair' }).sort({ createdAt: 1 });
    const minorRepairBulkOps = [];
    let minorRepairSerial = await SerialCounter.findOne({ type: 'minor_repair' });
    if (!minorRepairSerial) {
      minorRepairSerial = new SerialCounter({ type: 'minor_repair', currentSerial: 0 });
    }

    for (const oldProject of minorRepairProjects) {
      const existingProject = await MinorRepairProject.findById(oldProject._id);
      const projectData = {
        minorRepairSerialNumber: existingProject ? existingProject.minorRepairSerialNumber : ++minorRepairSerial.currentSerial,
        name: oldProject.name,
        allocatedUnit: oldProject.allocatedUnit,
        constructionUnit: oldProject.constructionUnit || '',
        allocationWave: oldProject.allocationWave || '',
        location: oldProject.location,
        initialValue: oldProject.initialValue || 0,
        enteredBy: oldProject.enteredBy,
        createdBy: oldProject.createdBy || null,
        status: oldProject.status || 'Chờ duyệt',
        assignedTo: oldProject.assignedTo || '',
        estimator: oldProject.estimator || '',
        supervisor: oldProject.supervisor || '',
        durationDays: oldProject.durationDays || 0,
        startDate: oldProject.startDate || null,
        completionDate: oldProject.completionDate || null,
        taskDescription: oldProject.taskDescription || '',
        contractValue: oldProject.contractValue || 0,
        progress: oldProject.progress || '',
        feasibility: oldProject.feasibility || '',
        notes: oldProject.notes || '',
        pendingEdit: oldProject.pendingEdit || null,
        pendingDelete: oldProject.pendingDelete || false,
        createdAt: oldProject.createdAt,
        updatedAt: oldProject.updatedAt,
      };

      if (existingProject) {
        minorRepairBulkOps.push({
          updateOne: {
            filter: { _id: oldProject._id },
            update: { $set: projectData },
          },
        });
      } else {
        minorRepairBulkOps.push({
          insertOne: {
            document: { _id: oldProject._id, ...projectData },
          },
        });
      }
    }

    if (minorRepairBulkOps.length > 0) {
      await MinorRepairProject.bulkWrite(minorRepairBulkOps);
    }
    await SerialCounter.findOneAndUpdate(
      { type: 'minor_repair' },
      { currentSerial: minorRepairSerial.currentSerial },
      { upsert: true }
    );
    console.log(`Đã đồng bộ ${minorRepairProjects.length} công trình sửa chữa nhỏ.`);

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
    return { message: 'Đồng bộ dữ liệu công trình thành công.' };
  } catch (error) {
    console.error('Lỗi khi đồng bộ dữ liệu:', error);
    throw new Error(`Lỗi khi đồng bộ dữ liệu: ${error.message}`);
  }
}

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

// API endpoints
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
    console.error("Lỗi API đăng nhập:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập' });
  }
});

app.post('/api/users', authenticate, async (req, res) => {
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
    const hashedPassword = await bcrypt.hash(password, 10);
    let finalPermissions = permissions;
    if (role === 'admin') { finalPermissions = { add: true, edit: true, delete: true, approve: true }; }
    const user = new User({ 
      username, 
      password: hashedPassword, 
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
      if (fullName !== undefined) userToUpdate.fullName = fullName;
      if (address !== undefined) userToUpdate.address = address;
      if (phoneNumber !== undefined) userToUpdate.phoneNumber = phoneNumber;
      if (email !== undefined) userToUpdate.email = email;
      if (unit !== undefined) userToUpdate.unit = unit;
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
    const userResponse = updatedUser.toObject(); 
    delete userResponse.password;
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
      } else if (modelNamePlural === 'project-types') {
        projectsUsingUnit = await CategoryProject.findOne({ projectType: unit.name });
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

createUnitCrudEndpoints(AllocatedUnit, 'đơn vị', 'allocated-units');
createUnitCrudEndpoints(ConstructionUnit, 'đơn vị thi công', 'construction-units');
createUnitCrudEndpoints(AllocationWave, 'đợt phân bổ', 'allocation-waves');
createUnitCrudEndpoints(ProjectType, 'loại công trình', 'project-types');

app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    // Chỉ hiển thị thông báo liên quan đến người dùng
    if (!req.user.permissions.approve) {
      query.userId = req.user.id;
    }
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

// API lấy danh sách công trình (cập nhật để hỗ trợ tìm kiếm nâng cao và tối ưu hóa)
app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const { type, page = 1, limit = 10, status, allocatedUnit, constructionUnit, allocationWave, assignedTo, search, minInitialValue, maxInitialValue, progress, pending } = req.query;
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const query = {};

    // Xây dựng điều kiện tìm kiếm
    if (status) query.status = status;
    if (allocatedUnit) query.allocatedUnit = allocatedUnit;
    if (constructionUnit) query.constructionUnit = constructionUnit;
    if (allocationWave) query.allocationWave = allocationWave;
    if (assignedTo) query.assignedTo = { $regex: assignedTo, $options: 'i' };
    if (search) query.name = { $regex: search, $options: 'i' };
    if (minInitialValue || maxInitialValue) {
      query.initialValue = {};
      if (minInitialValue) query.initialValue.$gte = parseFloat(minInitialValue);
      if (maxInitialValue) query.initialValue.$lte = parseFloat(maxInitialValue);
    }
    if (progress) query.progress = { $regex: progress, $options: 'i' };
    if (pending) {
      query.$or = [
        { status: 'Chờ duyệt' },
        { pendingEdit: { $ne: null } },
        { pendingDelete: true }
      ];
    } else {
      query.status = 'Đã duyệt';
      query.pendingEdit = null;
      query.pendingDelete = false;
    }

    const count = await Model.countDocuments(query);
    const projects = await Model.find(query)
      .populate('createdBy', 'username')
      .populate('approvedBy', 'username')
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

// API lấy trạng thái công trình
app.get('/api/projects/:id/status', authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    const status = {
      status: project.status,
      pendingEdit: !!project.pendingEdit,
      pendingDelete: project.pendingDelete
    };
    res.json(status);
  } catch (error) {
    console.error("Lỗi API lấy trạng thái công trình:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy trạng thái công trình' });
  }
});

// API thêm công trình
app.post('/api/projects', authenticate, async (req, res) => {
  if (!req.user.permissions.add) return res.status(403).json({ message: 'Không có quyền thêm công trình' });
  try {
    const { name, allocatedUnit, location, type, scale, initialValue, approvedBy } = req.body;
    if (!name || !allocatedUnit || !location || !type) {
      return res.status(400).json({ message: 'Tên công trình, đơn vị phân bổ, vị trí và loại công trình là bắt buộc.' });
    }
    if (type === 'category' && !scale) {
      return res.status(400).json({ message: 'Quy mô là bắt buộc cho công trình danh mục.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const projectData = { ...req.body, enteredBy: req.user.username, createdBy: req.user.id };
    if (type === 'minor_repair' && projectData.hasOwnProperty('scale')) {
      delete projectData.scale;
    }
    if (approvedBy) {
      const approver = await User.findById(approvedBy);
      if (!approver || !approver.permissions.approve) {
        return res.status(400).json({ message: 'Người duyệt không hợp lệ hoặc không có quyền duyệt.' });
      }
      projectData.approvedBy = approvedBy;
    }
    delete projectData.type;
    const project = new Model(projectData);
    const newProject = await project.save();
    const populatedProjectForNotification = { _id: newProject._id, name: newProject.name, type };

    // Luôn tạo thông báo "pending", kể cả khi tài khoản có quyền approve
    const notification = new Notification({
      message: `Yêu cầu thêm công trình mới "${newProject.name}" đã được gửi để duyệt`,
      type: 'new',
      projectId: newProject._id,
      projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      status: 'pending',
      userId: req.user.id,
    });
    await notification.save();
    io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
    return res.status(201).json({ message: 'Công trình đã được gửi để duyệt!', pending: true });
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
    const { type } = req.query;
    if (!type || !['category', 'minor_repair'].includes(type)) {
      return res.status(400).json({ message: 'Loại công trình không hợp lệ.' });
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const project = await Model.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    const canEditDirectly = req.user.permissions.edit && project.status !== 'Đã duyệt';
    const canRequestEdit = req.user.permissions.edit && (project.enteredBy === req.user.username || req.user.role === 'admin');
    const isApprover = req.user.permissions.approve;

    // Chuẩn bị dữ liệu cập nhật
    const updateData = { ...req.body };

    // Nếu công trình không có createdBy (công trình cũ), gán createdBy từ req.user.id
    if (!project.createdBy) {
      project.createdBy = req.user.id;
      await project.save();
    }

    // Loại bỏ createdBy khỏi updateData để không ghi đè giá trị hiện tại
    delete updateData.createdBy;

    // Nếu công trình đang ở trạng thái "Đã duyệt" và người dùng không có quyền duyệt
    if (project.status === 'Đã duyệt' && !isApprover) {
      delete updateData.status;
      delete updateData.categorySerialNumber;
      delete updateData.minorRepairSerialNumber;
    }

    // Xử lý trường scale cho MinorRepairProject
    if (type === 'minor_repair' && updateData.hasOwnProperty('scale')) {
      delete updateData.scale;
    }

    // Trường hợp người dùng có quyền duyệt và đang duyệt yêu cầu sửa
    if (isApprover && project.pendingEdit && req.body.approvedEdit === true) {
      Object.assign(project, project.pendingEdit);
      project.pendingEdit = null;
      project.status = 'Đã duyệt';
      await project.save({ validateModifiedOnly: true }); // Chỉ validate các trường đã thay đổi
      const editNotification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
      if (editNotification) {
        editNotification.status = 'processed';
        await editNotification.save();
        io.emit('notification_processed', editNotification._id);
        // Gửi thông báo cho người tạo yêu cầu
        const approvedNotification = new Notification({
          message: `Yêu cầu sửa công trình "${project.name}" đã được duyệt`,
          type: 'edit',
          projectId: project._id,
          projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'processed',
          userId: project.createdBy,
        });
        await approvedNotification.save();
        io.emit('notification', approvedNotification);
      }
      return res.json(project);
    } 
    // Trường hợp người dùng yêu cầu sửa công trình đã duyệt
    else if (canRequestEdit && project.status === 'Đã duyệt') {
      const dataToPending = { ...updateData };
      delete dataToPending.status;
      project.pendingEdit = dataToPending;
      await project.save({ validateModifiedOnly: true }); // Chỉ validate các trường đã thay đổi
      const populatedProjectForNotification = { _id: project._id, name: project.name, type };
      const notification = new Notification({
        message: `Yêu cầu sửa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'edit',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'pending',
        userId: req.user.id,
      });
      await notification.save();
      io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      return res.json({ message: 'Yêu cầu sửa đã được gửi để chờ duyệt', project });
    } 
    // Trường hợp người dùng có quyền sửa trực tiếp (công trình chưa duyệt)
    else if (canEditDirectly) {
      Object.assign(project, updateData);
      await project.save({ validateModifiedOnly: true }); // Chỉ validate các trường đã thay đổi
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

    if (isUserAdmin && project.status !== 'Đã duyệt') {
      const projectId = project._id;
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);

      const anyPendingNotification = await Notification.findOne({ projectId: projectId, status: 'pending', type: 'delete', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
      if (anyPendingNotification) {
        anyPendingNotification.status = 'processed';
        await anyPendingNotification.save();
        io.emit('notification_processed', anyPendingNotification._id);
        // Gửi thông báo cho người tạo yêu cầu
        const deletedNotification = new Notification({
          message: `Công trình "${project.name}" đã được xóa bởi admin`,
          type: 'delete',
          projectId: project._id,
          projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'processed',
          userId: project.createdBy,
        });
        await deletedNotification.save();
        io.emit('notification', deletedNotification);
      }
      io.emit('project_deleted', { projectId: project._id, projectType: type });
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
        // Gửi thông báo cho người tạo yêu cầu
        const deletedNotification = new Notification({
          message: `Yêu cầu xóa công trình "${project.name}" đã được duyệt`,
          type: 'delete',
          projectId: project._id,
          projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'processed',
          userId: project.createdBy,
        });
        await deletedNotification.save();
        io.emit('notification', deletedNotification);
      }
      io.emit('project_deleted', { projectId: project._id, projectType: type });
      return res.json({ message: 'Đã xóa công trình (sau khi duyệt yêu cầu).' });
    } else if (hasDeletePermission && (project.enteredBy === req.user.username || req.user.role === 'admin') && project.status === 'Đã duyệt') {
      project.pendingDelete = true;
      await project.save();
      const populatedProjectForNotification = { _id: project._id, name: project.name, type };
      const notification = new Notification({
        message: `Yêu cầu xóa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'delete',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'pending',
        userId: req.user.id,
      });
      await notification.save();
      io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      return res.json({ message: 'Yêu cầu xóa đã được gửi để chờ duyệt.', project });
    } else if (hasDeletePermission && project.status !== 'Đã duyệt') {
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);
      io.emit('project_deleted', { projectId: project._id, projectType: type });
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
    project.approvedBy = req.user.id; // Lưu người duyệt
    await project.save();
    const newNotification = await Notification.findOne({ projectId: project._id, type: 'new', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (newNotification) {
      newNotification.status = 'processed';
      await newNotification.save();
      io.emit('notification_processed', newNotification._id);
      // Gửi thông báo cho người tạo yêu cầu
      const approvedNotification = new Notification({
        message: `Công trình "${project.name}" đã được duyệt`,
        type: 'new',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: project.createdBy,
      });
      await approvedNotification.save();
      io.emit('notification', approvedNotification);
    }
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

    // Lưu công trình vào RejectedProjects trước khi xóa
    const rejectedProject = new RejectedProject({
      projectId: project._id,
      projectName: project.name,
      projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      actionType: 'new',
      rejectedBy: req.user.id,
      details: project.toObject(),
    });
    await rejectedProject.save();

    await Model.deleteOne({ _id: req.params.id });
    await updateSerialNumbers(type);

    const newNotification = await Notification.findOne({ projectId: project._id, type: 'new', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (newNotification) {
      newNotification.status = 'processed';
      await newNotification.save();
      io.emit('notification_processed', newNotification._id);
      // Gửi thông báo cho người tạo yêu cầu
      const rejectedNotification = new Notification({
        message: `Công trình "${project.name}" đã bị từ chối`,
        type: 'new',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: project.createdBy,
      });
      await rejectedNotification.save();
      io.emit('notification', rejectedNotification);
    }

    io.emit('project_rejected', { projectId: project._id, projectType: type });
    res.json({ message: 'Đã từ chối công trình và xóa khỏi danh sách.' });
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

    // Cập nhật dữ liệu từ pendingEdit
    Object.assign(project, project.pendingEdit);
    project.pendingEdit = null;
    project.status = 'Đã duyệt';
    project.approvedBy = req.user.id; // Gán người duyệt là người dùng hiện tại

    // Lưu công trình với validateModifiedOnly để chỉ kiểm tra các trường đã thay đổi
    await project.save({ validateModifiedOnly: true });

    const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      io.emit('notification_processed', notification._id);
      // Gửi thông báo cho người tạo yêu cầu
      const approvedNotification = new Notification({
        message: `Yêu cầu sửa công trình "${project.name}" đã được duyệt`,
        type: 'edit',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: project.createdBy,
      });
      await approvedNotification.save();
      io.emit('notification', approvedNotification);
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

    // Lưu công trình vào RejectedProjects trước khi xóa
    const rejectedProject = new RejectedProject({
      projectId: project._id,
      projectName: project.name,
      projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      actionType: 'edit',
      rejectedBy: req.user.id,
      details: project.toObject(),
    });
    await rejectedProject.save();

    await Model.deleteOne({ _id: req.params.id });
    await updateSerialNumbers(type);

    const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      io.emit('notification_processed', notification._id);
      // Gửi thông báo cho người tạo yêu cầu
      const rejectedNotification = new Notification({
        message: `Yêu cầu sửa công trình "${project.name}" đã bị từ chối`,
        type: 'edit',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: project.createdBy,
      });
      await rejectedNotification.save();
      io.emit('notification', rejectedNotification);
    }

    io.emit('project_rejected', { projectId: project._id, projectType: type });
    res.json({ message: 'Đã từ chối yêu cầu sửa và xóa công trình.' });
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
      // Gửi thông báo cho người tạo yêu cầu
      const deletedNotification = new Notification({
        message: `Yêu cầu xóa công trình "${project.name}" đã được duyệt`,
        type: 'delete',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: project.createdBy,
      });
      await deletedNotification.save();
      io.emit('notification', deletedNotification);
    }

    io.emit('project_deleted', { projectId: project._id, projectType: type });
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

    // Lưu công trình vào RejectedProjects trước khi xóa
    const rejectedProject = new RejectedProject({
      projectId: project._id,
      projectName: project.name,
      projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      actionType: 'delete',
      rejectedBy: req.user.id,
      details: project.toObject(),
    });
    await rejectedProject.save();

    await Model.deleteOne({ _id: req.params.id });
    await updateSerialNumbers(type);

    const notification = await Notification.findOne({ projectId: project._id, type: 'delete', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      io.emit('notification_processed', notification._id);
      // Gửi thông báo cho người tạo yêu cầu
      const rejectedNotification = new Notification({
        message: `Yêu cầu xóa công trình "${project.name}" đã bị từ chối`,
        type: 'delete',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'processed',
        userId: project.createdBy,
      });
      await rejectedNotification.save();
      io.emit('notification', rejectedNotification);
    }

    io.emit('project_rejected', { projectId: project._id, projectType: type });
    res.json({ message: 'Đã từ chối yêu cầu xóa và xóa công trình.' });
  } catch (error) {
    console.error("Lỗi API từ chối xóa:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối xóa: ' + error.message });
  }
});

// API lấy danh sách công trình bị từ chối
app.get('/api/rejected-projects', authenticate, async (req, res) => {
  try {
    const rejectedProjects = await RejectedProject.find()
      .populate('rejectedBy', 'username')
      .sort({ rejectedAt: -1 });
    res.status(200).json(rejectedProjects);
  } catch (error) {
    console.error("Lỗi API lấy danh sách công trình bị từ chối:", error);
    res.status(500).json({ message: "Lỗi máy chủ: " + error.message });
  }
});

// API mới: Đồng bộ công trình thủ công
app.post('/api/sync-projects', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền đồng bộ dữ liệu công trình' });
  try {
    const result = await syncOldProjects();
    res.json(result);
  } catch (error) {
    console.error("Lỗi API đồng bộ công trình:", error);
    res.status(500).json({ message: error.message });
  }
});

server.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});