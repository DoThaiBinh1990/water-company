// d:\CODE\water-company\backend\server\utils\sync.util.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, SerialCounter, Notification, User } = require('../models');
const logger = require('../config/logger'); // Import logger

// Hàm đồng bộ dữ liệu từ collection projects cũ
async function syncOldProjects() {
  logger.info('Bắt đầu đồng bộ dữ liệu công trình từ collection projects cũ...');
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const projectsCollectionExists = collections.some(col => col.name === 'projects');
    if (!projectsCollectionExists) {
      throw new Error('Không tìm thấy collection projects cũ để đồng bộ.');
    }

    const OldProject = mongoose.model('OldProjectSyncData', new mongoose.Schema({}, { strict: false }), 'projects');

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
      if (projectData.createdBy && !mongoose.Types.ObjectId.isValid(projectData.createdBy)) {
        logger.warn(`Invalid createdBy ID ${projectData.createdBy} for old category project ${oldProject._id}. Attempting to find user by username.`);
        const creatorUser = await User.findOne({ username: projectData.createdBy });
        projectData.createdBy = creatorUser ? creatorUser._id : null;
      }
      if (!projectData.createdBy) {
         const defaultCreator = await User.findOne({ role: 'admin' });
         if (defaultCreator) projectData.createdBy = defaultCreator._id;
         else {
            logger.error(`Cannot assign a default creator for old category project ${oldProject._id}. Skipping.`);
            continue;
         }
      }


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
    logger.info(`Đã đồng bộ ${categoryProjects.length} công trình danh mục.`);

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
        scale: oldProject.scale || '',
        reportDate: oldProject.reportDate || null,
        inspectionDate: oldProject.inspectionDate || null,
        paymentDate: oldProject.paymentDate || null,
        paymentValue: oldProject.paymentValue || 0,
        leadershipApproval: oldProject.leadershipApproval || '',
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
      if (projectData.createdBy && !mongoose.Types.ObjectId.isValid(projectData.createdBy)) {
        logger.warn(`Invalid createdBy ID ${projectData.createdBy} for old minor_repair project ${oldProject._id}. Attempting to find user by username.`);
        const creatorUser = await User.findOne({ username: projectData.createdBy });
        projectData.createdBy = creatorUser ? creatorUser._id : null;
      }
      if (!projectData.createdBy) {
         const defaultCreator = await User.findOne({ role: 'admin' });
         if (defaultCreator) projectData.createdBy = defaultCreator._id;
         else {
            logger.error(`Cannot assign a default creator for old minor_repair project ${oldProject._id}. Skipping.`);
            continue;
         }
      }

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
    logger.info(`Đã đồng bộ ${minorRepairProjects.length} công trình sửa chữa nhỏ.`);

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
