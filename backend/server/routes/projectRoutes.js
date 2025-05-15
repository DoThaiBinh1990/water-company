const express = require('express');
const router = express.Router();
const authenticate = require('../middleware');
const { CategoryProject, MinorRepairProject, Notification, RejectedProject, User } = require('../models');
const { updateSerialNumbers } = require('../utils');

router.get('/projects', authenticate, async (req, res) => {
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

router.get('/projects/:id/status', authenticate, async (req, res) => {
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

router.post('/projects', authenticate, async (req, res) => {
  if (!req.user.permissions.add) return res.status(403).json({ message: 'Không có quyền thêm công trình' });
  try {
    const { name, allocatedUnit, location, type, approvedBy, scale, reportDate } = req.body;
    // Kiểm tra các trường bắt buộc trong tab "Cơ bản" khi tạo mới
    if (!name || !allocatedUnit || !location || !type || !approvedBy) {
      return res.status(400).json({ message: 'Tên công trình, Đơn vị phân bổ, Địa điểm, Loại công trình và Người phê duyệt là bắt buộc.' });
    }
    // Kiểm tra bổ sung cho MinorRepairProject
    if (type === 'minor_repair') {
      if (!scale || !reportDate) {
        return res.status(400).json({ message: 'Quy mô và Ngày xảy ra sự cố là bắt buộc cho công trình sửa chữa nhỏ.' });
      }
    }
    // Kiểm tra cho CategoryProject
    if (type === 'category') {
      if (!scale) {
        return res.status(400).json({ message: 'Quy mô là bắt buộc cho công trình danh mục.' });
      }
    }
    const Model = type === 'category' ? CategoryProject : MinorRepairProject;
    const projectData = { ...req.body, enteredBy: req.user.username, createdBy: req.user.id };
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
    // Kiểm tra req.io trước khi gọi emit
    if (req.io) {
      req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
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

router.patch('/projects/:id', authenticate, async (req, res) => {
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
        if (req.io) {
          req.io.emit('notification_processed', editNotification._id);
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
          req.io.emit('notification', approvedNotification);
        } else {
          console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
        }
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
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
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

router.delete('/projects/:id', authenticate, async (req, res) => {
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
        if (req.io) {
          req.io.emit('notification_processed', anyPendingNotification._id);
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
          req.io.emit('notification', deletedNotification);
        } else {
          console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
        }
      }
      if (req.io) {
        req.io.emit('project_deleted', { projectId: project._id, projectType: type });
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
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
        if (req.io) {
          req.io.emit('notification_processed', deleteNotification._id);
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
          req.io.emit('notification', deletedNotification);
        } else {
          console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
        }
      }
      if (req.io) {
        req.io.emit('project_deleted', { projectId: project._id, projectType: type });
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
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
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
      return res.json({ message: 'Yêu cầu xóa đã được gửi để chờ duyệt.', project });
    } else if (hasDeletePermission && project.status !== 'Đã duyệt') {
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);
      if (req.io) {
        req.io.emit('project_deleted', { projectId: project._id, projectType: type });
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
      return res.json({ message: 'Đã xóa công trình.' });
    } else {
      return res.status(403).json({ message: 'Không có quyền xóa công trình này hoặc gửi yêu cầu xóa.' });
    }
  } catch (error) {
    console.error("Lỗi API xóa công trình:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa công trình: ' + error.message });
  }
});

router.patch('/projects/:id/approve', authenticate, async (req, res) => {
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
      if (req.io) {
        req.io.emit('notification_processed', newNotification._id);
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
        req.io.emit('notification', approvedNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }
    res.json(project);
  } catch (error) {
    console.error("Lỗi API duyệt công trình:", error);
    res.status(400).json({ message: 'Lỗi khi duyệt công trình: ' + error.message });
  }
});

router.patch('/projects/:id/reject', authenticate, async (req, res) => {
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
      if (req.io) {
        req.io.emit('notification_processed', newNotification._id);
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
        req.io.emit('notification', rejectedNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }

    if (req.io) {
      req.io.emit('project_rejected', { projectId: project._id, projectType: type });
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
    res.json({ message: 'Đã từ chối công trình và xóa khỏi danh sách.' });
  } catch (error) {
    console.error("Lỗi API từ chối công trình:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối công trình: ' + error.message });
  }
});

router.patch('/projects/:id/allocate', authenticate, async (req, res) => {
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

router.patch('/projects/:id/assign', authenticate, async (req, res) => {
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

router.patch('/projects/:id/approve-edit', authenticate, async (req, res) => {
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
      if (req.io) {
        req.io.emit('notification_processed', notification._id);
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
        req.io.emit('notification', approvedNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }
    res.json(project);
  } catch (error) {
    console.error("Lỗi API duyệt sửa:", error);
    res.status(400).json({ message: 'Lỗi khi duyệt sửa: ' + error.message });
  }
});

router.patch('/projects/:id/reject-edit', authenticate, async (req, res) => {
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
      if (req.io) {
        req.io.emit('notification_processed', notification._id);
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
        req.io.emit('notification', rejectedNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }

    if (req.io) {
      req.io.emit('project_rejected', { projectId: project._id, projectType: type });
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
    res.json({ message: 'Đã từ chối yêu cầu sửa và xóa công trình.' });
  } catch (error) {
    console.error("Lỗi API từ chối sửa:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối sửa: ' + error.message });
  }
});

router.patch('/projects/:id/approve-delete', authenticate, async (req, res) => {
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
      if (req.io) {
        req.io.emit('notification_processed', notification._id);
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
        req.io.emit('notification', deletedNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }

    if (req.io) {
      req.io.emit('project_deleted', { projectId: project._id, projectType: type });
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
    res.json({ message: 'Đã xóa công trình theo yêu cầu' });
  } catch (error) {
    console.error("Lỗi API duyệt xóa:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi duyệt xóa công trình: ' + error.message });
  }
});

router.patch('/projects/:id/reject-delete', authenticate, async (req, res) => {
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
      if (req.io) {
        req.io.emit('notification_processed', notification._id);
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
        req.io.emit('notification', rejectedNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }

    if (req.io) {
      req.io.emit('project_rejected', { projectId: project._id, projectType: type });
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
    res.json({ message: 'Đã từ chối yêu cầu xóa và xóa công trình.' });
  } catch (error) {
    console.error("Lỗi API từ chối xóa:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối xóa: ' + error.message });
  }
});

router.get('/rejected-projects', authenticate, async (req, res) => {
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

router.get('/notifications', authenticate, async (req, res) => {
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

router.patch('/notifications/:id', authenticate, async (req, res) => {
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
    if (req.io) {
      req.io.emit('notification_processed', notification._id);
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
    res.json(notification);
  } catch (error) {
    console.error("Lỗi API cập nhật thông báo:", error);
    res.status(400).json({ message: 'Lỗi khi cập nhật thông báo: ' + error.message });
  }
});

module.exports = router;