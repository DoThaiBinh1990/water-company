// server.js (Cập nhật quyền Admin)
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

const feUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const localBuildPort = process.env.LOCAL_BUILD_PORT || '3001';

const allowedOrigins = [
  feUrl,
  `http://localhost:${localBuildPort}`,
];
if (!allowedOrigins.includes(feUrl) && feUrl.startsWith('http://localhost')) {
    allowedOrigins.push(feUrl);
}

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

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Đã kết nối MongoDB Atlas'))
.catch(err => console.error('Lỗi kết nối MongoDB:', err));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

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

// <<< Thay đổi/Thêm mới >>>
// Hook để đảm bảo admin luôn có full permissions khi lưu
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

// Notification Schema
const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, enum: ['new', 'edit', 'delete'], required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  status: { type: String, enum: ['pending', 'processed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
const Notification = mongoose.model('Notification', notificationSchema);

// Project Schema
const projectSchema = new mongoose.Schema({
  categorySerialNumber: { type: Number, default: null, index: true },
  minorRepairSerialNumber: { type: Number, default: null, index: true },
  type: { type: String, enum: ['category', 'minor_repair'], required: true, index: true },
  name: { type: String, required: true, trim: true },
  allocatedUnit: { type: String, required: true, trim: true },
  constructionUnit: { type: String, default: '', trim: true },
  allocationWave: { type: String, default: '', trim: true },
  location: { type: String, required: true, trim: true },
  scale: { type: String, trim: true, required: function() { return this.type === 'category'; } },
  enteredBy: { type: String, required: true, trim: true },
  status: { type: String, default: 'Chờ duyệt', index: true },
  assignedTo: { type: String, default: '', trim: true },
  pendingEdit: { type: Object, default: null },
  pendingDelete: { type: Boolean, default: false },
}, { timestamps: true });

projectSchema.pre('save', async function (next) {
  if (this.isNew) {
    const model = this.constructor;
    const serialField = this.type === 'category' ? 'categorySerialNumber' : 'minorRepairSerialNumber';
    const lastProject = await model.findOne({ type: this.type }).sort({ [serialField]: -1 });
    this[serialField] = lastProject && typeof lastProject[serialField] === 'number' ? lastProject[serialField] + 1 : 1;
  }
  next();
});

async function updateSerialNumbers(type) {
  const projects = await Project.find({ type }).sort({ createdAt: 1 });
  const serialField = type === 'category' ? 'categorySerialNumber' : 'minorRepairSerialNumber';
  for (let i = 0; i < projects.length; i++) {
    if (projects[i][serialField] !== i + 1) {
        projects[i][serialField] = i + 1;
        await projects[i].save({ validateBeforeSave: false });
    }
  }
}
const Project = mongoose.model('Project', projectSchema);

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Không có token hoặc token không đúng định dạng Bearer' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // <<< Thay đổi/Thêm mới >>>
    // Đảm bảo admin luôn có full permissions trong req.user
    if (decoded.role === 'admin') {
      decoded.permissions = {
        add: true,
        edit: true,
        delete: true,
        approve: true,
      };
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Lỗi xác thực token:", error.message);
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Tên đăng nhập và mật khẩu không được để trống' });
    }
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Tài khoản không tồn tại' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu không đúng' });

    // <<< Thay đổi/Thêm mới >>>
    let userPermissions = user.permissions;
    if (user.role === 'admin') {
      userPermissions = { add: true, edit: true, delete: true, approve: true };
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, permissions: userPermissions, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
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
    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Tên người dùng, mật khẩu và vai trò không được để trống' });
    }

    // <<< Thay đổi/Thêm mới >>>
    // Kiểm tra nếu cố gắng tạo user 'admin' thứ hai
    if (username.toLowerCase() === 'admin' && role === 'admin') {
        const existingAdmin = await User.findOne({ username: 'admin', role: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Tài khoản admin với username "admin" đã tồn tại. Không thể tạo thêm.' });
        }
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return res.status(400).json({ message: 'Tên người dùng đã tồn tại.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    
    let finalPermissions = permissions;
    if (role === 'admin') { // Đảm bảo admin mới tạo có full quyền
        finalPermissions = { add: true, edit: true, delete: true, approve: true };
    }

    const user = new User({ username, password: hashedPassword, role, permissions: finalPermissions });
    const newUser = await user.save(); // Hook pre-save sẽ đảm bảo admin có full quyền
    const userResponse = newUser.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (error) {
    console.error("Lỗi API thêm người dùng:", error);
    if (error.code === 11000) { // Lỗi unique key của Mongoose
        return res.status(400).json({ message: `Tên người dùng "${req.body.username}" đã tồn tại.` });
    }
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

    // <<< Thay đổi/Thêm mới >>>
    // Kiểm tra và bảo vệ tài khoản admin
    if (userToUpdate.role === 'admin' || userToUpdate.username === 'admin') {
      if (role && role !== 'admin') {
        return res.status(403).json({ message: 'Không thể thay đổi vai trò của tài khoản admin.' });
      }
      // Không cho phép thay đổi username của admin nếu username là 'admin'
      if (username && username.toLowerCase() !== 'admin' && userToUpdate.username === 'admin') {
        return res.status(403).json({ message: 'Không thể thay đổi username của tài khoản admin chính ("admin").' });
      }
      // Nếu cố gắng sửa username 'admin' thành 'admin' với role khác admin (đã chặn ở trên)
      // Hoặc nếu cố gắng sửa username khác thành 'admin' và role là 'admin'
      if (username && username.toLowerCase() === 'admin' && userToUpdate.username.toLowerCase() !== 'admin') {
        const existingAdmin = await User.findOne({ username: 'admin', role: 'admin' });
        if (existingAdmin && !existingAdmin._id.equals(userToUpdate._id)) {
            return res.status(400).json({ message: 'Tên người dùng "admin" đã được sử dụng bởi tài khoản admin khác.' });
        }
      }
      // Bỏ qua mọi thay đổi permissions cho admin, nó sẽ được set bởi pre-save hook
      if (permissions) {
        console.log("Admin permissions update attempt ignored. Will be set by pre-save hook.");
      }
      userToUpdate.role = 'admin'; // Đảm bảo role vẫn là admin
    } else {
      // Cho các user không phải admin
      if (role) userToUpdate.role = role;
      if (permissions) userToUpdate.permissions = permissions;
    }

    if (username && username !== userToUpdate.username && !(userToUpdate.role === 'admin' && userToUpdate.username === 'admin')) { // Không cho đổi username 'admin'
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Tên người dùng mới đã tồn tại.' });
        }
        userToUpdate.username = username;
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      }
      userToUpdate.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await userToUpdate.save(); // pre-save hook sẽ xử lý permissions cho admin
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (error) {
    console.error("Lỗi API sửa người dùng:", error);
    if (error.code === 11000) {
        return res.status(400).json({ message: `Tên người dùng "${req.body.username}" đã tồn tại.` });
    }
    res.status(400).json({ message: 'Lỗi khi cập nhật người dùng: ' + error.message });
  }
});

app.delete('/api/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền xóa người dùng' });
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    
    // <<< Thay đổi/Thêm mới >>>
    if (user.role === 'admin') { // Kiểm tra chặt chẽ hơn
      return res.status(403).json({ message: 'Không thể xóa tài khoản admin.' });
    }
    if (user._id.equals(req.user.id)) { // req.user.id là id của admin đang thực hiện request
        return res.status(403).json({ message: 'Bạn không thể tự xóa chính mình.' });
    }
    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'Đã xóa người dùng' });
  } catch (error) {
    console.error("Lỗi API xóa người dùng:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa người dùng' });
  }
});

// CRUD cho các Units (Allocated, Construction, AllocationWave)
const createUnitCrudEndpoints = (model, modelNameSingular, modelNamePlural) => {
    app.post(`/api/${modelNamePlural}`, authenticate, async (req, res) => {
        if (req.user.role !== 'admin') return res.status(403).json({ message: `Chỉ admin mới có quyền thêm ${modelNameSingular}` });
        try {
            const { name } = req.body;
            if (!name || name.trim() === "") {
                return res.status(400).json({ message: `Tên ${modelNameSingular} không được để trống` });
            }
            const existingUnit = await model.findOne({ name: name.trim() });
            if (existingUnit) {
                return res.status(400).json({ message: `${modelNameSingular} "${name.trim()}" đã tồn tại.` });
            }
            const unit = new model({ name: name.trim() });
            const newUnit = await unit.save();
            res.status(201).json(newUnit);
        } catch (error) {
            console.error(`Lỗi API thêm ${modelNameSingular}:`, error);
            if (error.code === 11000) {
                return res.status(400).json({ message: `${modelNameSingular} đã tồn tại (lỗi DB).` });
            }
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
             if (!name || name.trim() === "") {
                return res.status(400).json({ message: `Tên ${modelNameSingular} không được để trống` });
            }
            const unitToUpdate = await model.findById(req.params.id);
            if (!unitToUpdate) return res.status(404).json({ message: `Không tìm thấy ${modelNameSingular}` });

            const existingUnit = await model.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
            if (existingUnit) {
                return res.status(400).json({ message: `${modelNameSingular} "${name.trim()}" đã tồn tại.` });
            }

            unitToUpdate.name = name.trim();
            await unitToUpdate.save();
            res.json(unitToUpdate);
        } catch (error) {
            console.error(`Lỗi API sửa ${modelNameSingular}:`, error);
             if (error.code === 11000) {
                return res.status(400).json({ message: `${modelNameSingular} đã tồn tại (lỗi DB).` });
            }
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
                projectsUsingUnit = await Project.findOne({ allocatedUnit: unit.name });
            } else if (modelNamePlural === 'construction-units') {
                projectsUsingUnit = await Project.findOne({ constructionUnit: unit.name });
            } else if (modelNamePlural === 'allocation-waves') {
                projectsUsingUnit = await Project.findOne({ allocationWave: unit.name });
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

// Notifications API
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    // <<< Thay đổi/Thêm mới >>>
    // Chỉ người có quyền approve mới xem được thông báo 'pending'
    // Người dùng thường có thể xem thông báo 'processed' của chính họ (nếu có logic đó sau này)
    // Hiện tại, chỉ admin/approver xem được.
    if (!req.user.permissions.approve && status === 'pending') {
        return res.json([]); // Trả về mảng rỗng nếu không có quyền xem pending
    }
    // Nếu không phải approver, và không có status filter, hoặc status là 'processed'
    // thì có thể cần thêm điều kiện filter theo người dùng liên quan đến thông báo.
    // Hiện tại, giữ nguyên logic cũ là nếu không phải approver thì không thấy pending.

    const notifications = await Notification.find(query)
                                        .sort({ createdAt: -1 })
                                        .populate('projectId', 'name type');
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
        return res.status(400).json({message: 'Trạng thái không hợp lệ.'})
    }
    await notification.save();
    io.emit('notification_processed', notification._id); // Gửi ID của thông báo đã xử lý
    res.json(notification);
  } catch (error) {
    console.error("Lỗi API cập nhật thông báo:", error);
    res.status(400).json({ message: 'Lỗi khi cập nhật thông báo: ' + error.message });
  }
});

// Projects API
app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const {
      type,
      page = 1,
      limit = 10,
      status,
      allocatedUnit,
      constructionUnit,
      allocationWave,
      assignedTo,
      search
    } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (allocatedUnit) query.allocatedUnit = allocatedUnit;
    if (constructionUnit) query.constructionUnit = constructionUnit;
    if (allocationWave) query.allocationWave = allocationWave;
    if (assignedTo) query.assignedTo = { $regex: assignedTo, $options: 'i' };
    if (search) query.name = { $regex: search, $options: 'i' };

    const count = await Project.countDocuments(query);
    const projects = await Project.find(query)
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian tạo mới nhất lên đầu
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

app.post('/api/projects', authenticate, async (req, res) => {
  if (!req.user.permissions.add) return res.status(403).json({ message: 'Không có quyền thêm công trình' });
  try {
    const projectData = { ...req.body, enteredBy: req.user.username }; // Gán người nhập là user hiện tại
    if (projectData.type === 'minor_repair' && projectData.hasOwnProperty('scale')) {
        delete projectData.scale; // Xóa trường scale nếu là sửa chữa nhỏ
    }
    const project = new Project(projectData);
    const newProject = await project.save();

    const populatedProjectForNotification = { _id: newProject._id, name: newProject.name, type: newProject.type };
    const notification = new Notification({
      message: `Công trình mới "${newProject.name}" (${newProject.type === 'category' ? 'Danh mục' : 'Sửa chữa nhỏ'}) bởi ${req.user.username}`,
      type: 'new',
      projectId: newProject._id, // Lưu ID của project
    });
    await notification.save();
    // Gửi thông báo real-time tới client (admin/approvers)
    io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification }); // Gửi kèm thông tin project đã populate
    res.status(201).json(newProject);
  } catch (error) {
    console.error("Lỗi API thêm công trình:", error);
    res.status(400).json({ message: 'Lỗi khi thêm công trình: ' + error.message });
  }
});

app.patch('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    const canEditDirectly = req.user.permissions.edit && project.status !== 'Đã duyệt';
    const canRequestEdit = req.user.permissions.edit && (project.enteredBy === req.user.username || req.user.role === 'admin');
    const isApprover = req.user.permissions.approve;

    const updateData = { ...req.body };
    // User thường không được tự ý thay đổi các trường nhạy cảm khi yêu cầu sửa CT đã duyệt
    if (project.status === 'Đã duyệt' && !isApprover) {
        delete updateData.status; // Không cho thay đổi status
        delete updateData.categorySerialNumber; // Không cho thay đổi STT
        delete updateData.minorRepairSerialNumber; // Không cho thay đổi STT
        delete updateData.type; // Không cho thay đổi loại CT
        // delete updateData.enteredBy; // Không cho thay đổi người nhập
    }
     if (updateData.type === 'minor_repair' && updateData.hasOwnProperty('scale')) { // Đảm bảo scale bị xóa nếu type là SC nhỏ
        delete updateData.scale;
    }


    // Trường hợp Approver duyệt một yêu cầu sửa đã có (pendingEdit)
    if (isApprover && project.pendingEdit && req.body.approvedEdit === true) { // Client gửi approvedEdit: true để xác nhận duyệt
        Object.assign(project, project.pendingEdit);
        project.pendingEdit = null;
        project.status = 'Đã duyệt'; // Đảm bảo trạng thái sau khi duyệt sửa
        await project.save();

        // Xử lý notification
        const editNotification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending' });
        if (editNotification) {
            editNotification.status = 'processed';
            await editNotification.save();
            io.emit('notification_processed', editNotification._id);
        }
        return res.json(project);
    }
    // Trường hợp User (có quyền edit) yêu cầu sửa một công trình đã duyệt (và user đó không phải là approver)
    else if (canRequestEdit && project.status === 'Đã duyệt' && !isApprover) {
      const dataToPending = { ...updateData };
      delete dataToPending.status; // Yêu cầu sửa không làm thay đổi status ngay

      project.pendingEdit = dataToPending; // Lưu các thay đổi vào pendingEdit
      await project.save();
      const populatedProjectForNotification = { _id: project._id, name: project.name, type: project.type };
      const notification = new Notification({
        message: `Yêu cầu sửa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'edit',
        projectId: project._id,
      });
      await notification.save();
      io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      return res.json({ message: 'Yêu cầu sửa đã được gửi để chờ duyệt', project });
    }
    // Trường hợp User sửa công trình chưa được duyệt, hoặc Approver sửa trực tiếp (không có pendingEdit)
    else if (canEditDirectly || (isApprover && !project.pendingEdit)) {
      Object.assign(project, updateData);
      await project.save();
      return res.json(project);
    }
    // Các trường hợp khác không có quyền
    else {
      return res.status(403).json({ message: 'Không có quyền sửa công trình này hoặc gửi yêu cầu sửa.' });
    }
  } catch (error) {
    console.error("Lỗi API sửa công trình:", error);
    res.status(400).json({ message: 'Lỗi khi cập nhật công trình: ' + error.message });
  }
});


app.delete('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });

    const canDeleteDirectly = req.user.permissions.delete && project.status !== 'Đã duyệt';
    const canRequestDelete = req.user.permissions.delete && (project.enteredBy === req.user.username || req.user.role === 'admin');
    const isApprover = req.user.permissions.approve;

    // Trường hợp Approver duyệt một yêu cầu xóa đã có (pendingDelete)
    if (isApprover && project.pendingDelete) { // Không cần req.body.approvedDelete nữa, chỉ cần check pendingDelete là true
        const type = project.type;
        const projectId = project._id; // Lưu lại ID trước khi xóa
        await Project.deleteOne({ _id: req.params.id });
        await updateSerialNumbers(type); // Cập nhật lại STT

        // Xử lý notification
        const deleteNotification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending' });
        if (deleteNotification) {
            deleteNotification.status = 'processed';
            await deleteNotification.save();
            io.emit('notification_processed', deleteNotification._id);
        }
        return res.json({ message: 'Đã xóa công trình (sau khi duyệt yêu cầu)' });
    }
    // Trường hợp User (có quyền delete) yêu cầu xóa một công trình đã duyệt (và user đó không phải là approver)
    else if (canRequestDelete && project.status === 'Đã duyệt' && !isApprover) {
      project.pendingDelete = true; // Đánh dấu chờ xóa
      await project.save();
      const populatedProjectForNotification = { _id: project._id, name: project.name, type: project.type };
      const notification = new Notification({
        message: `Yêu cầu xóa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'delete',
        projectId: project._id,
      });
      await notification.save();
      io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      return res.json({ message: 'Yêu cầu xóa đã được gửi để chờ duyệt', project });
    }
    // Trường hợp User xóa công trình chưa được duyệt
    else if (canDeleteDirectly) {
      const type = project.type;
      await Project.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type); // Cập nhật lại STT
      return res.json({ message: 'Đã xóa công trình' });
    }
    // Các trường hợp khác không có quyền
     else {
      return res.status(403).json({ message: 'Không có quyền xóa công trình này hoặc gửi yêu cầu xóa.' });
    }
  } catch (error) {
    console.error("Lỗi API xóa công trình:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa công trình' });
  }
});


// API Routes for Project Lifecycle (Approve, Reject, Allocate, Assign)
app.patch('/api/projects/:id/approve', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền duyệt' });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status !== 'Chờ duyệt') return res.status(400).json({message: 'Công trình đã được xử lý hoặc không ở trạng thái chờ duyệt.'})

    project.status = 'Đã duyệt';
    project.pendingEdit = null; // Xóa yêu cầu sửa nếu có khi duyệt
    project.pendingDelete = false; // Xóa yêu cầu xóa nếu có khi duyệt
    await project.save();
    res.json(project);
  } catch (error) {
    console.error("Lỗi API duyệt công trình:", error);
    res.status(400).json({ message: 'Lỗi khi duyệt công trình: ' + error.message });
  }
});

app.patch('/api/projects/:id/reject', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền từ chối' });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (project.status !== 'Chờ duyệt') return res.status(400).json({message: 'Công trình đã được xử lý hoặc không ở trạng thái chờ duyệt.'})

    project.status = 'Từ chối';
    project.pendingEdit = null; // Xóa yêu cầu sửa nếu có khi từ chối
    project.pendingDelete = false; // Xóa yêu cầu xóa nếu có khi từ chối
    await project.save();
    res.json(project);
  } catch (error) {
    console.error("Lỗi API từ chối công trình:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối công trình: ' + error.message });
  }
});

app.patch('/api/projects/:id/allocate', authenticate, async (req, res) => {
  if (!req.user.permissions.edit) return res.status(403).json({ message: 'Không có quyền phân bổ công trình' });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    // Chỉ cho phép phân bổ khi công trình đã được duyệt
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

app.patch('/api/projects/:id/assign', authenticate, async (req, res) => {
  if (!req.user.permissions.edit) return res.status(403).json({ message: 'Không có quyền phân công' });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    // Chỉ cho phép phân công khi công trình đã được duyệt
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

// API routes for approving/rejecting edits and deletions
app.patch('/api/projects/:id/approve-edit', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền duyệt sửa' });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (!project.pendingEdit) return res.status(400).json({ message: 'Không có yêu cầu sửa nào đang chờ duyệt cho công trình này.' });

    Object.assign(project, project.pendingEdit);
    project.pendingEdit = null;
    project.status = 'Đã duyệt'; // <<< Đảm bảo trạng thái là Đã duyệt
    await project.save();

    const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending' });
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

app.patch('/api/projects/:id/reject-edit', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền từ chối sửa' });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (!project.pendingEdit) return res.status(400).json({ message: 'Không có yêu cầu sửa nào đang chờ duyệt cho công trình này.' });

    project.pendingEdit = null;
    await project.save();

    const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending' });
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

app.patch('/api/projects/:id/approve-delete', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền duyệt xóa' });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (!project.pendingDelete) return res.status(400).json({ message: 'Công trình này không có yêu cầu xóa đang chờ duyệt.' });

    const type = project.type;
    const projectId = project._id; // Lưu ID trước khi xóa
    await Project.deleteOne({_id: projectId});
    await updateSerialNumbers(type); // Cập nhật STT

    const notification = await Notification.findOne({ projectId: projectId, type: 'delete', status: 'pending' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      io.emit('notification_processed', notification._id);
    }
    res.json({ message: 'Đã xóa công trình theo yêu cầu' });
  } catch (error) {
    console.error("Lỗi API duyệt xóa:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi duyệt xóa công trình' });
  }
});

app.patch('/api/projects/:id/reject-delete', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) return res.status(403).json({ message: 'Không có quyền từ chối xóa' });
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Không tìm thấy công trình' });
    if (!project.pendingDelete) return res.status(400).json({ message: 'Công trình này không có yêu cầu xóa đang chờ duyệt.' });

    project.pendingDelete = false;
    await project.save();

    const notification = await Notification.findOne({ projectId: project._id, type: 'delete', status: 'pending' });
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
