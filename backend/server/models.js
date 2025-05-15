const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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

// Mã hóa mật khẩu trước khi lưu
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
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
  scale: { type: String, default: '' }, // Bỏ required
  reportDate: { type: Date }, // Bỏ required
  inspectionDate: { type: Date },
  paymentDate: { type: Date },
  paymentValue: { type: Number, default: 0 },
  leadershipApproval: { type: String, default: '', trim: true },
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

module.exports = {
  SerialCounter,
  User,
  AllocatedUnit,
  ConstructionUnit,
  AllocationWave,
  ProjectType,
  CategoryProject,
  MinorRepairProject,
  Notification,
  RejectedProject
};