const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' } });
const port = process.env.PORT || 5000;

// Cấu hình CORS để cho phép domain Vercel
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

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

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'director', 'deputy_director', 'manager', 'deputy_manager', 'staff', 'branch_director', 'branch_deputy_director', 'branch_staff', 'worker'], default: 'staff' },
  permissions: {
    add: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
  },
});
const User = mongoose.model('User', userSchema);

const allocatedUnitSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});
const AllocatedUnit = mongoose.model('AllocatedUnit', allocatedUnitSchema);

const constructionUnitSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});
const ConstructionUnit = mongoose.model('ConstructionUnit', constructionUnitSchema);

const allocationWaveSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});
const AllocationWave = mongoose.model('AllocationWave', allocationWaveSchema);

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, enum: ['new', 'edit', 'delete'], required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  status: { type: String, enum: ['pending', 'processed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
const Notification = mongoose.model('Notification', notificationSchema);

const projectSchema = new mongoose.Schema({
  categorySerialNumber: { type: Number, default: null },
  minorRepairSerialNumber: { type: Number, default: null },
  type: { type: String, enum: ['category', 'minor_repair'], required: true },
  name: { type: String, required: true },
  allocatedUnit: { type: String, required: true },
  allocationWave: { type: String, default: '' },
  location: { type: String, required: true },
  scale: { type: String, required: function() { return this.type === 'category'; } },
  enteredBy: { type: String, required: true },
  status: { type: String, default: 'Chờ duyệt' },
  assignedTo: { type: String, default: '' },
  pendingEdit: { type: Object, default: null },
  pendingDelete: { type: Boolean, default: false },
}, { timestamps: true });

projectSchema.pre('save', async function (next) {
  if (this.isNew) {
    if (this.type === 'category') {
      const lastProject = await this.constructor.findOne({ type: 'category' }).sort({ categorySerialNumber: -1 });
      this.categorySerialNumber = lastProject ? lastProject.categorySerialNumber + 1 : 1;
    } else {
      const lastProject = await this.constructor.findOne({ type: 'minor_repair' }).sort({ minorRepairSerialNumber: -1 });
      this.minorRepairSerialNumber = lastProject ? lastProject.minorRepairSerialNumber + 1 : 1;
    }
  }
  next();
});

async function updateSerialNumbers(type) {
  const projects = await Project.find({ type }).sort({ [`${type}SerialNumber`]: 1 });
  for (let i = 0; i < projects.length; i++) {
    projects[i][`${type}SerialNumber`] = i + 1;
    await projects[i].save();
  }
}

const Project = mongoose.model('Project', projectSchema);

// API đăng nhập
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Tài khoản không tồn tại' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu không đúng' });
    res.json({ user: { id: user._id, username: user.username, role: user.role, permissions: user.permissions } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API người dùng
app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, permissions } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, role, permissions });
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }
    Object.assign(user, req.body);
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Không thể xóa tài khoản admin' });
    await user.deleteOne();
    res.json({ message: 'Đã xóa người dùng' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// API đơn vị phân bổ
app.post('/api/allocated-units', async (req, res) => {
  try {
    const { name } = req.body;
    const unit = new AllocatedUnit({ name });
    const newUnit = await unit.save();
    res.status(201).json(newUnit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/allocated-units', async (req, res) => {
  try {
    const units = await AllocatedUnit.find();
    res.json(units);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/allocated-units/:id', async (req, res) => {
  try {
    const unit = await AllocatedUnit.findById(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Không tìm thấy đơn vị phân bổ' });
    unit.name = req.body.name;
    await unit.save();
    res.json(unit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/allocated-units/:id', async (req, res) => {
  try {
    const unit = await AllocatedUnit.findById(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Không tìm thấy đơn vị phân bổ' });
    await unit.deleteOne();
    res.json({ message: 'Đã xóa đơn vị phân bổ' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// API đơn vị thi công
app.post('/api/construction-units', async (req, res) => {
  try {
    const { name } = req.body;
    const unit = new ConstructionUnit({ name });
    const newUnit = await unit.save();
    res.status(201).json(newUnit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/construction-units', async (req, res) => {
  try {
    const units = await ConstructionUnit.find();
    res.json(units);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/construction-units/:id', async (req, res) => {
  try {
    const unit = await ConstructionUnit.findById(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Không tìm thấy đơn vị thi công' });
    unit.name = req.body.name;
    await unit.save();
    res.json(unit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/construction-units/:id', async (req, res) => {
  try {
    const unit = await ConstructionUnit.findById(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Không tìm thấy đơn vị thi công' });
    await unit.deleteOne();
    res.json({ message: 'Đã xóa đơn vị thi công' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// API đợt phân bổ
app.post('/api/allocation-waves', async (req, res) => {
  try {
    const { name } = req.body;
    const wave = new AllocationWave({ name });
    const newWave = await wave.save();
    res.status(201).json(newWave);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/allocation-waves', async (req, res) => {
  try {
    const waves = await AllocationWave.find();
    res.json(waves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/allocation-waves/:id', async (req, res) => {
  try {
    const wave = await AllocationWave.findById(req.params.id);
    if (!wave) return res.status(404).json({ message: 'Không tìm thấy đợt phân bổ' });
    wave.name = req.body.name;
    await wave.save();
    res.json(wave);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/allocation-waves/:id', async (req, res) => {
  try {
    const wave = await AllocationWave.findById(req.params.id);
    if (!wave) return res.status(404).json({ message: 'Không tìm thấy đợt phân bổ' });
    await wave.deleteOne();
    res.json({ message: 'Đã xóa đợt phân bổ' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// API thông báo
app.get('/api/notifications', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Không tìm thấy thông báo' });
    notification.status = req.body.status;
    await notification.save();
    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// API công trình
app.get('/api/projects', async (req, res) => {
  try {
    const { type } = req.query;
    const query = type ? { type } : {};
    const projects = await Project.find(query);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const project = new Project(req.body);
    const newProject = await project.save();
    const notification = new Notification({
      message: `Công trình mới: ${newProject.name}`,
      type: 'new',
      projectId: newProject._id,
    });
    await notification.save();
    io.emit('notification', notification);
    res.status(201).json(newProject);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status === 'Đã duyệt') {
      project.pendingEdit = req.body;
      const notification = new Notification({
        message: `Yêu cầu sửa công trình: ${project.name}`,
        type: 'edit',
        projectId: project._id,
      });
      await notification.save();
      io.emit('notification', notification);
    } else {
      Object.assign(project, req.body);
    }
    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status === 'Đã duyệt') {
      project.pendingDelete = true;
      const notification = new Notification({
        message: `Yêu cầu xóa công trình: ${project.name}`,
        type: 'delete',
        projectId: project._id,
      });
      await notification.save();
      io.emit('notification', notification);
      await project.save();
      res.json({ message: 'Yêu cầu xóa đã được gửi' });
    } else {
      await project.deleteOne();
      await updateSerialNumbers(project.type);
      res.json({ message: 'Đã xóa công trình' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/projects/:id/approve', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    project.status = 'Đã duyệt';
    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/projects/:id/reject', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    project.status = 'Từ chối';
    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/projects/:id/approve-edit', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.pendingEdit) {
      Object.assign(project, project.pendingEdit);
      project.pendingEdit = null;
      await project.save();
      const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending' });
      if (notification) {
        notification.status = 'processed';
        await notification.save();
      }
      res.json(project);
    } else {
      res.status(400).json({ message: 'Không có yêu cầu sửa' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/projects/:id/reject-edit', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    project.pendingEdit = null;
    await project.save();
    const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
    }
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/projects/:id/approve-delete', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.pendingDelete) {
      const type = project.type;
      await project.deleteOne();
      await updateSerialNumbers(type);
      const notification = await Notification.findOne({ projectId: project._id, type: 'delete', status: 'pending' });
      if (notification) {
        notification.status = 'processed';
        await notification.save();
      }
      res.json({ message: 'Đã xóa công trình' });
    } else {
      res.status(400).json({ message: 'Không có yêu cầu xóa' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch('/api/projects/:id/reject-delete', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    project.pendingDelete = false;
    await project.save();
    const notification = await Notification.findOne({ projectId: project._id, type: 'delete', status: 'pending' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
    }
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

server.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});