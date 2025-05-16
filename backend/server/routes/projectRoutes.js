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

    // Điều kiện tìm kiếm chung
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

    // Xử lý trạng thái
    if (pending === 'true' || pending === true) {
      // Lấy công trình chờ duyệt, chờ sửa, chờ xóa
      query.$or = [
        { status: 'Chờ duyệt' },
        { pendingEdit: { $ne: null } },
        { pendingDelete: true }
      ];
    } else if (status) {
      // Lọc đúng theo status truyền vào
      query.status = status;
    } else {
      // Mặc định chỉ lấy công trình đã duyệt
      // Frontend sẽ xử lý việc hiển thị chỉ báo nếu có pendingEdit/pendingDelete
      query.status = 'Đã duyệt';
      // Không lọc theo pendingEdit, pendingDelete ở đây nữa để tab chính vẫn thấy các công trình đã duyệt
      // đang có yêu cầu sửa/xóa.
      // query.pendingEdit = null; // Removed
      // query.pendingDelete = false; // Removed
    }

    const count = await Model.countDocuments(query);
    const projects = await Model.find(query)
      .populate('createdBy', 'username')
      .populate('approvedBy', 'username')
      .populate('pendingEdit.requestedBy', 'username') // Populate người yêu cầu sửa
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
      if (!scale) { // Giả sử scale là bắt buộc cho category
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
    delete projectData.type; // Xóa trường type khỏi projectData trước khi lưu
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
      userId: req.user.id, // Người tạo yêu cầu
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
      await project.save(); // Lưu lại createdBy
    }

    // Loại bỏ createdBy khỏi updateData để không ghi đè giá trị hiện tại
    delete updateData.createdBy;

    // Nếu công trình đang ở trạng thái "Đã duyệt" và người dùng không có quyền duyệt
    if (project.status === 'Đã duyệt' && !isApprover) {
      delete updateData.status; // Không cho phép thay đổi status
      delete updateData.categorySerialNumber; // Không cho phép thay đổi serial
      delete updateData.minorRepairSerialNumber; // Không cho phép thay đổi serial
    }


    // Trường hợp người dùng có quyền duyệt và đang duyệt yêu cầu sửa
    if (isApprover && project.pendingEdit && req.body.approvedEdit === true) { // approvedEdit là một cờ gửi từ client
      Object.assign(project, project.pendingEdit);
      project.pendingEdit = null;
      project.status = 'Đã duyệt'; // Đảm bảo trạng thái là đã duyệt
      await project.save({ validateModifiedOnly: true }); // Chỉ validate các trường đã thay đổi
      // Xử lý thông báo
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
            userId: project.createdBy, // Gửi cho người tạo công trình gốc
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
      delete dataToPending.status; // Không cho phép thay đổi status qua pendingEdit
      project.pendingEdit = {
        changes: dataToPending,
        requestedBy: req.user.id, // Lưu ID người yêu cầu sửa
        requestedAt: new Date()   // Lưu thời gian yêu cầu sửa
      };
      await project.save({ validateModifiedOnly: true }); // Chỉ validate các trường đã thay đổi
      const populatedProjectForNotification = { _id: project._id, name: project.name, type };
      const notification = new Notification({
        message: `Yêu cầu sửa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'edit',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'pending',
        userId: req.user.id, // Người tạo yêu cầu sửa
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

    // Admin có thể xóa công trình chưa duyệt trực tiếp
    if (isUserAdmin && project.status !== 'Đã duyệt') {
      const projectId = project._id; // Lưu projectId trước khi xóa
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);

      // Xử lý thông báo nếu có
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
            projectId: project._id, // projectId vẫn còn giá trị ở đây
            projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
            status: 'processed',
            userId: project.createdBy, // Gửi cho người tạo công trình gốc
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
    }
    // Người duyệt duyệt yêu cầu xóa
    else if (isApprover && project.pendingDelete) {
      const projectId = project._id; // Lưu projectId trước khi xóa
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);

      // Xử lý thông báo
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
            projectId: project._id, // projectId vẫn còn giá trị ở đây
            projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
            status: 'processed',
            userId: project.createdBy, // Gửi cho người tạo công trình gốc
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
    }
    // Người dùng có quyền xóa và công trình đã duyệt -> gửi yêu cầu xóa
    else if (hasDeletePermission && (project.enteredBy === req.user.username || req.user.role === 'admin') && project.status === 'Đã duyệt') {
      project.pendingDelete = true;
      await project.save();
      const populatedProjectForNotification = { _id: project._id, name: project.name, type };
      const notification = new Notification({
        message: `Yêu cầu xóa công trình "${project.name}" bởi ${req.user.username}`,
        type: 'delete',
        projectId: project._id,
        projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
        status: 'pending',
        userId: req.user.id, // Người tạo yêu cầu xóa
      });
      await notification.save();
      if (req.io) {
        req.io.emit('notification', { ...notification.toObject(), projectId: populatedProjectForNotification });
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
      return res.json({ message: 'Yêu cầu xóa đã được gửi để chờ duyệt.', project });
    }
    // Người dùng có quyền xóa và công trình chưa duyệt -> xóa trực tiếp
    else if (hasDeletePermission && project.status !== 'Đã duyệt') {
      await Model.deleteOne({ _id: req.params.id });
      await updateSerialNumbers(type);
      if (req.io) {
        req.io.emit('project_deleted', { projectId: project._id, projectType: type });
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
      return res.json({ message: 'Đã xóa công trình.' });
    }
    else {
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
    project.pendingEdit = null; // Xóa yêu cầu sửa nếu có
    project.pendingDelete = false; // Xóa yêu cầu xóa nếu có
    project.approvedBy = req.user.id; // Lưu người duyệt
    await project.save();

    // Xử lý thông báo
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
          userId: project.createdBy, // Gửi cho người tạo công trình gốc
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
    
    // Chỉ từ chối công trình đang ở trạng thái "Chờ duyệt" (tức là yêu cầu tạo mới)
    if (project.status !== 'Chờ duyệt') {
        return res.status(400).json({ message: 'Công trình không ở trạng thái chờ duyệt mới.' });
    }

    // Lưu công trình vào RejectedProjects trước khi xóa
    const rejectedProject = new RejectedProject({
      projectId: project._id,
      projectName: project.name,
      projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
      actionType: 'new', // Chỉ 'new' mới vào đây
      rejectedBy: req.user.id,
      details: project.toObject(), // Lưu toàn bộ thông tin công trình
    });
    await rejectedProject.save();

    const originalProjectId = project._id; // Lưu lại ID trước khi xóa
    await Model.deleteOne({ _id: req.params.id });
    await updateSerialNumbers(type); // Cập nhật số thứ tự

    // Xử lý thông báo
    const newNotification = await Notification.findOne({ projectId: originalProjectId, type: 'new', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (newNotification) {
      newNotification.status = 'processed';
      await newNotification.save();
      if (req.io) {
        req.io.emit('notification_processed', newNotification._id);
        // Gửi thông báo cho người tạo yêu cầu
        const rejectedUserNotification = new Notification({ // Đổi tên biến để tránh nhầm lẫn
          message: `Công trình "${project.name}" đã bị từ chối`,
          type: 'new',
          projectId: originalProjectId, // Sử dụng ID đã lưu
          projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'processed',
          userId: project.createdBy, // Gửi cho người tạo công trình gốc
        });
        await rejectedUserNotification.save();
        req.io.emit('notification', rejectedUserNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }

    if (req.io) {
      req.io.emit('project_rejected', { projectId: originalProjectId, projectType: type, isNewRejection: true });
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
    res.json({ message: 'Đã từ chối công trình và chuyển vào danh sách bị từ chối.' });
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
    project.status = 'Đã duyệt'; // Đảm bảo trạng thái là đã duyệt
    project.approvedBy = req.user.id; // Gán người duyệt là người dùng hiện tại

    // Lưu công trình với validateModifiedOnly để chỉ kiểm tra các trường đã thay đổi
    await project.save({ validateModifiedOnly: true });

    // Xử lý thông báo
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
          userId: project.createdBy, // Gửi cho người tạo công trình gốc
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

    // Hoàn lại trạng thái, không đưa vào RejectedProject
    project.pendingEdit = null;
    if (project.status !== 'Chờ duyệt') { // Nếu công trình đã từng được duyệt trước đó
        project.status = 'Đã duyệt';
    }
    // Nếu công trình đang 'Chờ duyệt' (tức là yêu cầu sửa được tạo khi công trình mới chưa được duyệt),
    // thì khi từ chối sửa, nó vẫn ở trạng thái 'Chờ duyệt'.
    await project.save();

    // Xử lý thông báo
    const notification = await Notification.findOne({ projectId: project._id, type: 'edit', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed'; // Đánh dấu là đã xử lý
      await notification.save();
      if (req.io) {
        req.io.emit('notification_processed', notification._id);
        // Gửi thông báo cho người tạo yêu cầu
        const rejectedUserNotification = new Notification({ // Đổi tên biến
          message: `Yêu cầu sửa công trình "${project.name}" đã bị từ chối`,
          type: 'edit', // Giữ nguyên type là 'edit'
          projectId: project._id,
          projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'processed', // Đã xử lý
          userId: project.createdBy, // Gửi cho người tạo công trình gốc
        });
        await rejectedUserNotification.save();
        req.io.emit('notification', rejectedUserNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }

    if (req.io) {
      // Gửi sự kiện để client cập nhật lại danh sách (nếu cần)
      req.io.emit('project_edit_rejected', { projectId: project._id, projectType: type });
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
    res.json({ message: 'Đã từ chối yêu cầu sửa. Công trình được hoàn lại trạng thái trước đó.', project });
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

    const originalProjectId = project._id; // Lưu ID trước khi xóa
    const originalProjectName = project.name; // Lưu tên trước khi xóa
    const originalProjectCreatedBy = project.createdBy; // Lưu người tạo

    await Model.deleteOne({ _id: originalProjectId });
    await updateSerialNumbers(type);

    // Xử lý thông báo
    const notification = await Notification.findOne({ projectId: originalProjectId, type: 'delete', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      if (req.io) {
        req.io.emit('notification_processed', notification._id);
        // Gửi thông báo cho người tạo yêu cầu
        const deletedUserNotification = new Notification({ // Đổi tên biến
          message: `Yêu cầu xóa công trình "${originalProjectName}" đã được duyệt`,
          type: 'delete',
          projectId: originalProjectId,
          projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'processed',
          userId: originalProjectCreatedBy,
        });
        await deletedUserNotification.save();
        req.io.emit('notification', deletedUserNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }

    if (req.io) {
      req.io.emit('project_deleted', { projectId: originalProjectId, projectType: type });
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

    // Hoàn lại trạng thái, không đưa vào RejectedProject
    project.pendingDelete = false;
    if (project.status !== 'Chờ duyệt') { // Nếu công trình đã từng được duyệt
        project.status = 'Đã duyệt';
    }
    // Nếu công trình đang 'Chờ duyệt' (tức là yêu cầu xóa được tạo khi công trình mới chưa được duyệt),
    // thì khi từ chối xóa, nó vẫn ở trạng thái 'Chờ duyệt'.
    await project.save();

    // Xử lý thông báo
    const notification = await Notification.findOne({ projectId: project._id, type: 'delete', status: 'pending', projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject' });
    if (notification) {
      notification.status = 'processed';
      await notification.save();
      if (req.io) {
        req.io.emit('notification_processed', notification._id);
        // Gửi thông báo cho người tạo yêu cầu
        const rejectedUserNotification = new Notification({ // Đổi tên biến
          message: `Yêu cầu xóa công trình "${project.name}" đã bị từ chối`,
          type: 'delete',
          projectId: project._id,
          projectModel: type === 'category' ? 'CategoryProject' : 'MinorRepairProject',
          status: 'processed',
          userId: project.createdBy, // Gửi cho người tạo công trình gốc
        });
        await rejectedUserNotification.save();
        req.io.emit('notification', rejectedUserNotification);
      } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
      }
    }

    if (req.io) {
      // Gửi sự kiện để client cập nhật lại danh sách (nếu cần)
      req.io.emit('project_delete_rejected', { projectId: project._id, projectType: type });
    } else {
      console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }
    res.json({ message: 'Đã từ chối yêu cầu xóa. Công trình được hoàn lại trạng thái trước đó.', project });
  } catch (error) {
    console.error("Lỗi API từ chối xóa:", error);
    res.status(400).json({ message: 'Lỗi khi từ chối xóa: ' + error.message });
  }
});

router.post('/rejected-projects/:id/restore', authenticate, async (req, res) => {
  if (!req.user.permissions.approve) {
    return res.status(403).json({ message: 'Không có quyền khôi phục công trình.' });
  }
  try {
    const { id: rejectedId } = req.params;
    const rejectedEntry = await RejectedProject.findById(rejectedId);

    if (!rejectedEntry) {
      return res.status(404).json({ message: 'Không tìm thấy công trình bị từ chối.' });
    }

    // Chỉ khôi phục nếu actionType là 'new'
    if (rejectedEntry.actionType !== 'new') {
        return res.status(400).json({ message: 'Chỉ có thể khôi phục công trình bị từ chối khi tạo mới.' });
    }

    const { projectDetails, projectModel } = rejectedEntry; // Không cần originalProjectId và actionType nữa
    const ModelToRestore = projectModel === 'CategoryProject' ? CategoryProject : MinorRepairProject;

    let restoredProjectData = { ...projectDetails };

    // Xóa _id cũ để MongoDB tạo _id mới, và các trường serial
    delete restoredProjectData._id;
    delete restoredProjectData.categorySerialNumber;
    delete restoredProjectData.minorRepairSerialNumber;
    delete restoredProjectData.createdAt; // Để mongoose tự tạo
    delete restoredProjectData.updatedAt; // Để mongoose tự tạo
    delete restoredProjectData.__v;     // Xóa version key

    // Thiết lập trạng thái và người duyệt
    restoredProjectData.status = 'Đã duyệt';
    restoredProjectData.approvedBy = req.user.id; // Người khôi phục là người duyệt
    restoredProjectData.pendingEdit = null;
    restoredProjectData.pendingDelete = false;
    
    // Đảm bảo createdBy và enteredBy được giữ lại từ bản gốc nếu có
    // Nếu không, sử dụng thông tin người dùng hiện tại (người khôi phục)
    restoredProjectData.createdBy = projectDetails.createdBy || req.user.id;
    restoredProjectData.enteredBy = projectDetails.enteredBy || req.user.username;


    const newRestoredProject = new ModelToRestore(restoredProjectData);
    await newRestoredProject.save(); // Hook pre-save sẽ tự tạo serial number mới

    // Xóa bản ghi khỏi RejectedProject
    await RejectedProject.findByIdAndDelete(rejectedId);
    
    // Cập nhật lại số thứ tự sau khi thêm mới
    await updateSerialNumbers(projectModel === 'CategoryProject' ? 'category' : 'minor_repair');

    if (req.io) {
        req.io.emit('project_restored', { projectId: newRestoredProject._id, projectType: projectModel === 'CategoryProject' ? 'category' : 'minor_repair' });
    } else {
        console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
    }

    res.status(200).json({ message: 'Công trình đã được khôi phục và duyệt thành công.', project: newRestoredProject });

  } catch (error) {
    console.error("Lỗi API khôi phục công trình:", error);
    res.status(500).json({ message: 'Lỗi máy chủ khi khôi phục công trình: ' + error.message });
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

router.delete('/rejected-projects/:id', authenticate, async (req, res) => {
    if (!req.user.permissions.delete) { // Hoặc một quyền admin đặc biệt
        return res.status(403).json({ message: 'Không có quyền xóa vĩnh viễn công trình bị từ chối.' });
    }
    try {
        const rejectedProject = await RejectedProject.findByIdAndDelete(req.params.id);
        if (!rejectedProject) {
            return res.status(404).json({ message: 'Không tìm thấy công trình bị từ chối để xóa.' });
        }
        // Không cần cập nhật serial number ở đây vì chỉ xóa khỏi bảng rejected
        if (req.io) {
            req.io.emit('rejected_project_permanently_deleted', { rejectedId: req.params.id });
        } else {
            console.warn('Socket.IO không được khởi tạo, bỏ qua gửi thông báo.');
        }
        res.status(200).json({ message: 'Đã xóa vĩnh viễn công trình bị từ chối.' });
    } catch (error) {
        console.error("Lỗi API xóa vĩnh viễn công trình bị từ chối:", error);
        res.status(500).json({ message: 'Lỗi máy chủ khi xóa vĩnh viễn công trình bị từ chối: ' + error.message });
    }
});

router.get('/notifications', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    // Chỉ hiển thị thông báo liên quan đến người dùng
    if (!req.user.permissions.approve) { // Nếu không phải người duyệt
      query.userId = req.user.id; // Chỉ lấy thông báo của chính người đó
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
