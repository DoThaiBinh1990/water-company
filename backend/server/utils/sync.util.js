// d:\CODE\water-company\backend\server\utils\sync.util.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, SerialCounter, Notification, User } = require('../models');
const { userFieldToQuery } = require('../services/helpers/serviceHelpers');
const logger = require('../config/logger');

async function syncOldProjects() {
  logger.info('Bắt đầu đồng bộ dữ liệu công trình từ collection projects cũ...');
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const projectsCollectionExists = collections.some(col => col.name === 'projects');
    if (!projectsCollectionExists) {
      throw new Error('Không tìm thấy collection projects cũ để đồng bộ.');
    }

    const OldProject = mongoose.model('OldProjectSyncData', new mongoose.Schema({}, { strict: false }), 'projects');

    // Đồng bộ Category Projects
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
        projectType: oldProject.projectType || '',
        leadershipApproval: oldProject.leadershipApproval || '',
        enteredBy: oldProject.enteredBy, // Giữ lại enteredBy nếu có
        status: oldProject.status || 'Chờ duyệt',
        assignedTo: oldProject.assignedTo || '', // Sẽ được resolve nếu là ID/username
        taskDescription: oldProject.taskDescription || '',
        progress: oldProject.progress || '',
        feasibility: oldProject.feasibility || '',
        notes: oldProject.notes ?? '',
        pendingEdit: oldProject.pendingEdit || null,
        pendingDelete: oldProject.pendingDelete === true,
        createdAt: oldProject.createdAt,
        updatedAt: oldProject.updatedAt,
        history: oldProject.history || [],
        profileTimeline: oldProject.profileTimeline || null,
        constructionTimeline: oldProject.constructionTimeline || null,
      };

      projectData.financialYear = oldProject.financialYear ? parseInt(String(oldProject.financialYear), 10) : (oldProject.createdAt ? new Date(oldProject.createdAt).getFullYear() : new Date().getFullYear());
      if (isNaN(projectData.financialYear)) projectData.financialYear = new Date().getFullYear();
      
      projectData.isCompleted = oldProject.isCompleted === true || String(oldProject.isCompleted).toLowerCase() === 'true';

      projectData.createdBy = await userFieldToQuery(oldProject.createdBy) || await userFieldToQuery(oldProject.enteredBy);
      if (!projectData.createdBy) {
          const defaultCreator = await User.findOne({ role: 'admin' });
          projectData.createdBy = defaultCreator ? defaultCreator._id : null;
          if (!projectData.createdBy) {
            logger.error(`Không thể gán người tạo mặc định cho CT Danh mục cũ ${oldProject._id}. Bỏ qua.`);
            continue;
          }
      }
      projectData.approvedBy = await userFieldToQuery(oldProject.approvedBy);
      projectData.supervisor = await userFieldToQuery(oldProject.supervisor);
      projectData.estimator = await userFieldToQuery(oldProject.estimator);
      if (typeof oldProject.assignedTo === 'string') { // Resolve assignedTo if it's a string
        projectData.assignedTo = await userFieldToQuery(oldProject.assignedTo) || oldProject.assignedTo;
      }


      projectData.startDate = oldProject.startDate ? new Date(oldProject.startDate) : null;
      projectData.completionDate = oldProject.completionDate ? new Date(oldProject.completionDate) : null;

      const parseNumeric = (value) => {
        if (value === undefined || value === null || String(value).trim() === '') return null;
        const num = parseFloat(String(value).replace(/,/g, ''));
        return isNaN(num) ? null : num;
      };
      projectData.initialValue = parseNumeric(oldProject.initialValue);
      projectData.contractValue = parseNumeric(oldProject.contractValue);
      projectData.estimatedValue = parseNumeric(oldProject.estimatedValue);
      projectData.durationDays = oldProject.durationDays !== undefined && oldProject.durationDays !== null ? parseInt(String(oldProject.durationDays), 10) : null;
      if (isNaN(projectData.durationDays)) projectData.durationDays = null;


      const categorySchemaPaths = Object.keys(CategoryProject.schema.paths);
      for (const key in projectData) {
          if (!categorySchemaPaths.includes(key) && key !== '_id') {
              delete projectData[key];
          }
      }

      if (existingProject) {
        categoryBulkOps.push({ updateOne: { filter: { _id: oldProject._id }, update: { $set: projectData } } });
      } else {
        categoryBulkOps.push({ insertOne: { document: { _id: oldProject._id, ...projectData } } });
      }
    }
    if (categoryBulkOps.length > 0) await CategoryProject.bulkWrite(categoryBulkOps, { ordered: false });
    await SerialCounter.findOneAndUpdate({ type: 'category' }, { currentSerial: categorySerial.currentSerial }, { upsert: true });
    logger.info(`Đã đồng bộ ${categoryProjects.length} công trình danh mục.`);

    // Đồng bộ Minor Repair Projects
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
        location: oldProject.location,
        scale: oldProject.scale || '',
        leadershipApproval: oldProject.leadershipApproval || '',
        enteredBy: oldProject.enteredBy,
        status: oldProject.status || 'Chờ duyệt',
        assignedTo: oldProject.assignedTo || '',
        taskDescription: oldProject.taskDescription || '',
        notes: oldProject.notes ?? '',
        pendingEdit: oldProject.pendingEdit || null,
        pendingDelete: oldProject.pendingDelete === true,
        createdAt: oldProject.createdAt,
        updatedAt: oldProject.updatedAt,
        history: oldProject.history || [],
        constructionTimeline: oldProject.constructionTimeline || null,
      };

      projectData.financialYear = oldProject.financialYear ? parseInt(String(oldProject.financialYear), 10) : (oldProject.createdAt ? new Date(oldProject.createdAt).getFullYear() : new Date().getFullYear());
      if (isNaN(projectData.financialYear)) projectData.financialYear = new Date().getFullYear();
      
      projectData.isCompleted = oldProject.isCompleted === true || String(oldProject.isCompleted).toLowerCase() === 'true';

      projectData.createdBy = await userFieldToQuery(oldProject.createdBy) || await userFieldToQuery(oldProject.enteredBy);
      if (!projectData.createdBy) {
          const defaultCreator = await User.findOne({ role: 'admin' });
          projectData.createdBy = defaultCreator ? defaultCreator._id : null;
          if (!projectData.createdBy) {
            logger.error(`Không thể gán người tạo mặc định cho CT SCN cũ ${oldProject._id}. Bỏ qua.`);
            continue;
          }
      }
      projectData.approvedBy = await userFieldToQuery(oldProject.approvedBy);
      projectData.supervisor = await userFieldToQuery(oldProject.supervisor);
       if (typeof oldProject.assignedTo === 'string') {
        projectData.assignedTo = await userFieldToQuery(oldProject.assignedTo) || oldProject.assignedTo;
      }

      projectData.reportDate = oldProject.reportDate ? new Date(oldProject.reportDate) : null;
      projectData.inspectionDate = oldProject.inspectionDate ? new Date(oldProject.inspectionDate) : null;
      projectData.paymentDate = oldProject.paymentDate ? new Date(oldProject.paymentDate) : null;
      projectData.paymentValue = parseNumeric(oldProject.paymentValue);

      const minorRepairSchemaPaths = Object.keys(MinorRepairProject.schema.paths);
      for (const key in projectData) {
          if (!minorRepairSchemaPaths.includes(key) && key !== '_id') {
              delete projectData[key];
          }
      }

      if (existingProject) {
        minorRepairBulkOps.push({ updateOne: { filter: { _id: oldProject._id }, update: { $set: projectData } } });
      } else {
        minorRepairBulkOps.push({ insertOne: { document: { _id: oldProject._id, ...projectData } } });
      }
    }
    if (minorRepairBulkOps.length > 0) await MinorRepairProject.bulkWrite(minorRepairBulkOps, { ordered: false });
    await SerialCounter.findOneAndUpdate({ type: 'minor_repair' }, { currentSerial: minorRepairSerial.currentSerial }, { upsert: true });
    logger.info(`Đã đồng bộ ${minorRepairProjects.length} công trình sửa chữa nhỏ.`);

    // Cập nhật projectModel cho Notifications
    const notifications = await Notification.find();
    for (const notification of notifications) {
      if (notification.projectId) {
        const project = await OldProject.findById(notification.projectId);
        if (project) {
          notification.projectModel = project.type === 'category' ? 'CategoryProject' : 'MinorRepairProject';
          await notification.save();
        } else {
          logger.warn(`Không tìm thấy project cũ với ID ${notification.projectId} cho notification ${notification._id}`);
        }
      } else {
         logger.warn(`Notification ${notification._id} không có projectId.`);
      }
    }
    logger.info('Đã cập nhật projectModel cho notifications.');

    logger.info('Đồng bộ dữ liệu hoàn tất.');
    return { message: 'Đồng bộ dữ liệu công trình thành công.' };
  } catch (error) {
    logger.error('Lỗi khi đồng bộ dữ liệu:', { message: error.message, stack: error.stack });
    throw new Error(`Lỗi khi đồng bộ dữ liệu: ${error.message}`);
  }
}

module.exports = { syncOldProjects };
