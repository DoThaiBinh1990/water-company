const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, SerialCounter, Notification } = require('./models');

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

module.exports = {
  updateSerialNumbers,
  syncOldProjects
};