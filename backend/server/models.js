// d:\CODE\water-company\backend\server\models.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // Đảm bảo đã import bcrypt

// SerialCounter Schema
const serialCounterSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true },
  currentSerial: { type: Number, default: 0 },
});
const SerialCounter = mongoose.model('SerialCounter', serialCounterSchema);

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: [
      'admin',
      'director', // Tổng giám đốc (Quản lý công ty)
      'deputy_director', // Phó tổng giám đốc (Quản lý công ty)
      'manager-office', // Trưởng phòng công ty (Quản lý công ty)
      'deputy_manager-office', // Phó phòng công ty
      'staff-office', // Nhân viên phòng công ty
      'manager-branch', // Giám đốc chi nhánh (Quản lý chi nhánh)
      'deputy_manager-branch', // Phó giám đốc chi nhánh
      'staff-branch', // Nhân viên chi nhánh
      'worker' // Công nhân
    ],
    default: 'staff-office' // Mặc định có thể thay đổi tùy theo nhu cầu
  },
  fullName: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  phoneNumber: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  unit: { type: String, trim: true, default: '' }, // Tên đơn vị/chi nhánh của user
  permissions: {
    add: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
    viewRejected: { type: Boolean, default: false },
    allocate: { type: Boolean, default: false }, // Quyền phân bổ (cho category project)
    assign: { type: Boolean, default: false },   // Quyền giao việc (gán supervisor, estimator)
    viewOtherBranchProjects: { type: Boolean, default: false }, // Quyền xem công trình chi nhánh khác
  },
});

// Mã hóa mật khẩu trước khi lưu và set default permissions
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  // Chỉ set default permissions nếu là user mới hoặc role bị thay đổi,
  // và client không cung cấp permissions (hoặc role là admin thì luôn set full)
  if (this.isNew || this.isModified('role')) {
    // Nếu client đã cung cấp permissions cho user mới (và không phải admin), thì không ghi đè ở đây.
    // Trừ khi là admin, thì luôn đảm bảo full quyền.
    let shouldSetDefaultPermissions = true;
    if (!this.isNew && this.isModified('role') && this.permissions && Object.keys(this.permissions).length > 0 && this.role !== 'admin') {
        // Nếu role thay đổi nhưng permissions đã được set (ví dụ từ PATCH request), không ghi đè trừ khi là admin
        // Hoặc có thể bạn muốn reset permissions theo role mới bất kể client gửi gì
    } else if (this.isNew && this.permissions && Object.keys(this.permissions).length > 0 && this.role !== 'admin') {
        shouldSetDefaultPermissions = false;
    }


    if (shouldSetDefaultPermissions || this.role === 'admin') {
        switch (this.role) {
            case 'admin':
                this.permissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: true };
                break;
            case 'director':
            case 'deputy_director':
            case 'manager-office': // Quản lý công ty (Phòng/Ban)
                this.permissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: true };
                break;
            case 'deputy_manager-office':
                 this.permissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: true }; // Ví dụ
                break;
            case 'staff-office': // Nhân viên phòng công ty
                this.permissions = { add: true, edit: true, delete: true, approve: false, viewRejected: true, allocate: false, assign: false, viewOtherBranchProjects: true }; // Cho phép xem CT bị từ chối và xem tất cả CT
                break;
            case 'manager-branch': // Quản lý chi nhánh
                this.permissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: false }; // viewOtherBranchProjects có thể được admin set riêng
                break;
            case 'deputy_manager-branch':
                this.permissions = { add: true, edit: true, delete: true, approve: true, viewRejected: true, allocate: true, assign: true, viewOtherBranchProjects: false }; // Ví dụ
                break;
            case 'staff-branch': // Nhân viên chi nhánh
                this.permissions = { add: true, edit: true, delete: true, approve: false, viewRejected: false, allocate: false, assign: false, viewOtherBranchProjects: false };
                break;
            case 'worker':
                this.permissions = { add: false, edit: false, delete: false, approve: false, viewRejected: false, allocate: false, assign: false, viewOtherBranchProjects: false };
                break;
            default: // Mặc định cho các role chưa được định nghĩa rõ
                this.permissions = { add: false, edit: false, delete: false, approve: false, viewRejected: false, allocate: false, assign: false, viewOtherBranchProjects: false };
        }
    }
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
  allocatedUnit: { type: String, required: true, trim: true, index: true }, // Đơn vị/Chi nhánh quản lý công trình
  constructionUnit: { type: String, default: '', trim: true },
  allocationWave: { type: String, default: '', trim: true },
  location: { type: String, required: true, trim: true },
  scale: { type: String, required: true, trim: true },
  initialValue: { type: Number, default: 0 },
  enteredBy: { type: String, required: true, trim: true }, // Username of creator for display
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // ObjectId of creator
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'Chờ duyệt', index: true },
  assignedTo: { type: String, default: '', trim: true }, // Could be ObjectId ref: 'User'
  estimator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  durationDays: { type: Number, default: 0 },
  startDate: { type: Date },
  completionDate: { type: Date },
  taskDescription: { type: String, default: '', trim: true },
  contractValue: { type: Number, default: 0 },
  progress: { type: String, default: '', trim: true },
  feasibility: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  pendingEdit: { type: Object, default: null }, // { changes: [{field, oldValue, newValue}], requestedBy: ObjectId, requestedAt: Date }
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
  allocatedUnit: { type: String, required: true, trim: true, index: true }, // Đơn vị/Chi nhánh quản lý công trình
  location: { type: String, required: true, trim: true },
  scale: { type: String, default: '' },
  reportDate: { type: Date },
  inspectionDate: { type: Date },
  paymentDate: { type: Date },
  paymentValue: { type: Number, default: 0 },
  leadershipApproval: { type: String, default: '', trim: true },
  enteredBy: { type: String, required: true, trim: true }, // Username of creator
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // ObjectId of creator
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'Chờ duyệt', index: true },
  assignedTo: { type: String, default: '', trim: true },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  taskDescription: { type: String, default: '', trim: true },
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
  type: { type: String, enum: ['new', 'edit', 'delete', 'new_approved', 'edit_approved', 'delete_approved', 'new_rejected', 'edit_rejected', 'delete_rejected', 'allocated', 'assigned'], required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, refPath: 'projectModel' },
  projectModel: { type: String, required: true, enum: ['CategoryProject', 'MinorRepairProject'] },
  status: { type: String, enum: ['pending', 'processed'], default: 'pending' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User liên quan đến thông báo (người tạo yêu cầu, hoặc người nhận)
  originalProjectId: { type: mongoose.Schema.Types.ObjectId }, // ID của project gốc nếu nó bị xóa (ví dụ khi từ chối 'new')
  createdAt: { type: Date, default: Date.now },
});
const Notification = mongoose.model('Notification', notificationSchema);

// RejectedProject Schema
const rejectedProjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  allocatedUnit: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  categorySerialNumber: { type: Number, sparse: true },
  minorRepairSerialNumber: { type: Number, sparse: true },
  scale: { type: String },
  reportDate: { type: Date },
  enteredBy: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rejectionReason: { type: String, required: true },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rejectedAt: { type: Date, default: Date.now },
  originalProjectId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  projectType: { type: String, enum: ['category', 'minor_repair'], required: true },
  constructionUnit: { type: String, default: '', trim: true },
  allocationWave: { type: String, default: '', trim: true },
  initialValue: { type: Number, default: 0 },
  assignedTo: { type: String, default: '', trim: true },
  estimator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  durationDays: { type: Number, default: 0 },
  startDate: { type: Date },
  completionDate: { type: Date },
  taskDescription: { type: String, default: '', trim: true },
  contractValue: { type: Number, default: 0 },
  progress: { type: String, default: '', trim: true },
  feasibility: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  estimatedValue: { type: Number, default: 0 },
  leadershipApproval: { type: String, default: '', trim: true },
  originalCreatedAt: { type: Date },
  originalUpdatedAt: { type: Date },
  actionType: { type: String, enum: ['new', 'edit', 'delete'], default: 'new' },
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

const RejectedProject = mongoose.model('RejectedProject', rejectedProjectSchema);

module.exports = {
  SerialCounter, User, AllocatedUnit, ConstructionUnit, AllocationWave,
  ProjectType, CategoryProject, MinorRepairProject, Notification, RejectedProject
};
