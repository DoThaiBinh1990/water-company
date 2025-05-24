// d:\CODE\water-company\backend\server\services\timeline.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, User, Holiday } = require('../models');
const { populateProjectFields } = require('../utils');
const logger = require('../config/logger');
const { calculateEndDate, calculateDurationDays } = require('./helpers/dateCalculation');
const { userFieldToQuery } = require('./helpers/serviceHelpers');

const getProfileTimelineProjectsList = async (queryParams) => {
  const { user, financialYear, estimatorId, allocatedUnit } = queryParams;
  const Model = CategoryProject;
  const query = {
    status: { $in: ['Đã duyệt', 'Đã phân bổ', 'Đang thực hiện'] },
    isCompleted: false,
  };

  if (financialYear) {
    query.financialYear = parseInt(financialYear, 10);
  }

  if (estimatorId && mongoose.Types.ObjectId.isValid(estimatorId)) {
    query['profileTimeline.estimator'] = new mongoose.Types.ObjectId(estimatorId);
  } else if (estimatorId === 'unassigned') {
    query.$or = [
        { profileTimeline: { $exists: false } },
        { 'profileTimeline.estimator': { $exists: false } },
        { 'profileTimeline.estimator': null }
    ];
  }
  // If estimatorId is empty or invalid (and not 'unassigned'),
  // the query will fetch projects based on other criteria (year, status, etc.),
  // which is suitable for the main Gantt chart view.

  if (allocatedUnit) query.allocatedUnit = allocatedUnit;

  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      query.allocatedUnit = user.unit;
    }
  }

  const sort = { 'profileTimeline.order': 1, 'profileTimeline.startDate': 1 };

  const projects = await Model.find(query)
    .populate('profileTimeline.estimator', 'username fullName')
    .populate('profileTimeline.assignedBy', 'username fullName')
    .populate('supervisor', 'username fullName') // Populate the main supervisor field
    .sort(sort);

  const formattedProjects = projects
    .map(p => {
      if (!p) {
        logger.warn('Một project null hoặc undefined đã được tìm thấy trong kết quả query getProfileTimelineProjectsList. Bỏ qua.');
        return null;
      }
      return {
        id: p._id.toString(),
        name: p.name || `Công trình ID: ${p._id.toString()}`,
        start: p.profileTimeline?.startDate ? p.profileTimeline.startDate.toISOString().split('T')[0] : null,
        end: p.profileTimeline?.endDate ? p.profileTimeline.endDate.toISOString().split('T')[0] : null,
        progress: p.profileTimeline?.progress || 0,
        dependencies: '',
        custom_class: p.profileTimeline?.assignmentType === 'manual' ? 'manual-task' : 'auto-task',
        project: p.toObject({ virtuals: true }),
      };
    })
    .filter(p => p !== null);

  return formattedProjects;
};

const getConstructionTimelineProjectsList = async (queryParams) => {
  const { user, type, financialYear, constructionUnitName, allocatedUnit } = queryParams;
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;
  const query = {
    status: { $in: ['Đã duyệt', 'Đã phân bổ', 'Đang thực hiện'] },
    isCompleted: false,
  };

  if (financialYear) {
    query.financialYear = parseInt(financialYear, 10);
  }

  if (constructionUnitName && constructionUnitName !== 'unassigned') {
    query['constructionTimeline.constructionUnit'] = constructionUnitName;
  } else if (constructionUnitName === 'unassigned') {
     query.$or = [
        { constructionTimeline: { $exists: false } },
        { 'constructionTimeline.constructionUnit': { $exists: false } },
        { 'constructionTimeline.constructionUnit': null },
        { 'constructionTimeline.constructionUnit': '' }
     ];
  }
  // Similar to profile timeline, if constructionUnitName is empty or invalid,
  // it fetches based on other criteria for the main Gantt view.

  if (allocatedUnit) query.allocatedUnit = allocatedUnit;

  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      query.allocatedUnit = user.unit;
    }
  }

  const sort = { 'constructionTimeline.order': 1, 'constructionTimeline.startDate': 1 };

  const projects = await Model.find(query)
    .populate('constructionTimeline.supervisor', 'username fullName')
    .populate('constructionTimeline.assignedBy', 'username fullName')
    .populate('supervisor', 'username fullName') // Populate the main supervisor field
    .sort(sort);

  const formattedProjects = projects
    .map(p => {
      if (!p) {
        logger.warn('Một project null hoặc undefined đã được tìm thấy trong kết quả query getConstructionTimelineProjectsList. Bỏ qua.');
        return null;
      }
      return {
        id: p._id.toString(),
        name: p.name || `Công trình ID: ${p._id.toString()}`,
        start: p.constructionTimeline?.startDate ? p.constructionTimeline.startDate.toISOString().split('T')[0] : null,
        end: p.constructionTimeline?.endDate ? p.constructionTimeline.endDate.toISOString().split('T')[0] : null,
        progress: p.constructionTimeline?.progress || 0,
        dependencies: '',
        custom_class: p.constructionTimeline?.assignmentType === 'manual' ? 'manual-task' : 'auto-task',
        project: p.toObject({ virtuals: true }),
      };
    })
    .filter(p => p !== null);

  return formattedProjects;
};

const batchUpdateProfileTimeline = async (payload, user) => {
  const { financialYear, estimatorId, assignments } = payload;
  if (!financialYear || !estimatorId || !Array.isArray(assignments)) {
    throw { statusCode: 400, message: 'Dữ liệu không hợp lệ để cập nhật timeline hồ sơ.' };
  }
  if (!mongoose.Types.ObjectId.isValid(estimatorId)) {
    throw { statusCode: 400, message: 'ID Người lập dự toán không hợp lệ.' };
  }
  const validEstimatorId = new mongoose.Types.ObjectId(estimatorId);


  const holidayDoc = await Holiday.findOne({ year: parseInt(financialYear, 10) });
  const holidaysList = holidayDoc && holidayDoc.holidays ? holidayDoc.holidays.map(h => new Date(h.date).toISOString().split('T')[0]) : [];

  const bulkOps = [];
  const sortedAssignments = [...assignments].sort((a, b) => (a.order || 0) - (b.order || 0));
  let previousAutoTaskEndDate = null;

  for (const assignment of sortedAssignments) {
    const { projectId, assignmentType = 'auto', startDate: inputStartDate, durationDays, endDate, excludeHolidays = true, order } = assignment;
    let currentStartDate = inputStartDate;
    if (assignmentType === 'auto' && previousAutoTaskEndDate && !inputStartDate) {
      currentStartDate = new Date(previousAutoTaskEndDate);
      currentStartDate.setDate(currentStartDate.getDate() + 1);
    }

    if (!projectId || !currentStartDate) {
        logger.warn(`Bỏ qua assignment cho projectId ${projectId} (profile) do thiếu thông tin startDate.`);
        continue;
    }

    let calculatedEndDate = endDate;
    if (durationDays && !endDate) {
      calculatedEndDate = await calculateEndDate(new Date(currentStartDate), parseInt(durationDays, 10), excludeHolidays, holidaysList);
    }

    if (assignmentType === 'auto' && calculatedEndDate) {
        previousAutoTaskEndDate = new Date(calculatedEndDate);
    } else if (assignmentType === 'manual') {
        previousAutoTaskEndDate = null;
    }

    bulkOps.push({
        updateOne: {
            filter: { _id: projectId, financialYear: parseInt(financialYear, 10) },
            update: [
                {
                    $set: {
                        profileTimeline: { $ifNull: ['$profileTimeline', {}] }
                    }
                },
                {
                    $set: {
                        'profileTimeline.estimator': validEstimatorId,
                        'profileTimeline.assignedBy': user.id,
                        'profileTimeline.assignmentType': assignmentType,
                        'profileTimeline.startDate': new Date(currentStartDate),
                        'profileTimeline.durationDays': durationDays ? parseInt(durationDays, 10) : null,
                        'profileTimeline.endDate': calculatedEndDate ? new Date(calculatedEndDate) : null,
                        'profileTimeline.excludeHolidays': excludeHolidays,
                        'profileTimeline.order': order !== undefined ? parseInt(order, 10) : null,
                        'profileTimeline.progress': 0,
                        'profileTimeline.statusNotes': '',
                    }
                },
                {
                    $set: {
                        startDate: '$profileTimeline.startDate',
                        completionDate: '$profileTimeline.endDate',
                        durationDays: '$profileTimeline.durationDays',
                        estimator: '$profileTimeline.estimator'
                    }
                }
            ]
          }
    });
  }

  if (bulkOps.length > 0) {
    const result = await CategoryProject.bulkWrite(bulkOps);
    logger.info(`Batch update profile timeline result for estimator ${estimatorId}, year ${financialYear}:`, result);
    return { message: `Đã cập nhật timeline hồ sơ cho ${result.modifiedCount || 0} công trình.`, modifiedCount: result.modifiedCount };
  }
  return { message: 'Không có công trình nào được cập nhật timeline hồ sơ.', modifiedCount: 0 };
};

const batchUpdateConstructionTimeline = async (payload, user) => {
  const { type, financialYear, constructionUnitName, assignments } = payload;
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;

  if (!type || !financialYear || !constructionUnitName || !Array.isArray(assignments)) {
    throw { statusCode: 400, message: 'Dữ liệu không hợp lệ để cập nhật timeline thi công.' };
  }

  const holidayDoc = await Holiday.findOne({ year: parseInt(financialYear, 10) });
  const holidaysList = holidayDoc && holidayDoc.holidays ? holidayDoc.holidays.map(h => new Date(h.date).toISOString().split('T')[0]) : [];

  const bulkOps = [];
  const sortedAssignments = [...assignments].sort((a, b) => (a.order || 0) - (b.order || 0));
  let previousAutoTaskEndDate = null;

  for (const assignment of sortedAssignments) {
    const { projectId, assignmentType = 'auto', startDate: inputStartDate, durationDays, endDate, excludeHolidays = true, supervisor: inputSupervisor, order } = assignment;
    let currentStartDate = inputStartDate;
    if (assignmentType === 'auto' && previousAutoTaskEndDate && !inputStartDate) {
      currentStartDate = new Date(previousAutoTaskEndDate);
      currentStartDate.setDate(currentStartDate.getDate() + 1);
    }

    if (!projectId || !currentStartDate) {
        logger.warn(`Bỏ qua assignment cho projectId ${projectId} do thiếu thông tin startDate.`);
        continue;
    }

    let calculatedEndDate = endDate;
    if (durationDays && !endDate) {
      calculatedEndDate = await calculateEndDate(new Date(currentStartDate), parseInt(durationDays, 10), excludeHolidays, holidaysList);
    }

    if (assignmentType === 'auto' && calculatedEndDate) {
        previousAutoTaskEndDate = new Date(calculatedEndDate);
    } else if (assignmentType === 'manual') {
        previousAutoTaskEndDate = null;
    }

    let supervisorObjectId = null;
    if (inputSupervisor && mongoose.Types.ObjectId.isValid(inputSupervisor)) {
        supervisorObjectId = new mongoose.Types.ObjectId(inputSupervisor);
    } else if (inputSupervisor) {
        supervisorObjectId = await userFieldToQuery(inputSupervisor);
    }


    bulkOps.push({
        updateOne: {
            filter: { _id: projectId, financialYear: parseInt(financialYear, 10) },
            update: [
                {
                    $set: {
                        constructionTimeline: { $ifNull: ['$constructionTimeline', {}] }
                    }
                },
                {
                    $set: {
                        'constructionTimeline.constructionUnit': constructionUnitName,
                        'constructionTimeline.supervisor': supervisorObjectId,
                        'constructionTimeline.assignedBy': user.id,
                        'constructionTimeline.assignmentType': assignmentType,
                        'constructionTimeline.startDate': new Date(currentStartDate),
                        'constructionTimeline.durationDays': durationDays ? parseInt(durationDays, 10) : null,
                        'constructionTimeline.endDate': calculatedEndDate ? new Date(calculatedEndDate) : null,
                        'constructionTimeline.excludeHolidays': excludeHolidays,
                        'constructionTimeline.order': order !== undefined ? parseInt(order, 10) : null,
                        'constructionTimeline.progress': 0,
                        'constructionTimeline.statusNotes': '',
                    }
                },
                ...(Model.modelName === 'CategoryProject' ? [{
                    $set: {
                        supervisor: '$constructionTimeline.supervisor',
                        constructionUnit: '$constructionTimeline.constructionUnit'
                    }
                }] : [])
            ]
          }
    });
  }

  if (bulkOps.length > 0) {
    const result = await Model.bulkWrite(bulkOps);
    logger.info(`Batch update construction timeline result for type ${type}, unit ${constructionUnitName}, year ${financialYear}:`, result);
    return { message: `Đã cập nhật timeline thi công cho ${result.modifiedCount || 0} công trình.`, modifiedCount: result.modifiedCount };
  }
  return { message: 'Không có công trình nào được cập nhật timeline thi công.', modifiedCount: 0 };
};

const updateProfileTimelineTask = async (projectId, updateData, user) => {
  const project = await CategoryProject.findById(projectId);
  if (!project) throw { statusCode: 404, message: 'Không tìm thấy công trình danh mục.' };
  if (user.role !== 'admin' && !user.permissions.assignProfileTimeline) throw { statusCode: 403, message: 'Bạn không có quyền cập nhật timeline hồ sơ.' };

  const holidayDoc = await Holiday.findOne({ year: project.financialYear });
  const holidaysList = holidayDoc && holidayDoc.holidays ? holidayDoc.holidays.map(h => new Date(h.date).toISOString().split('T')[0]) : [];

  const allowedFields = ['startDate', 'endDate', 'durationDays', 'progress', 'statusNotes', 'assignmentType', 'excludeHolidays'];
  const updatePayload = {};
  allowedFields.forEach(field => {
    if (updateData.hasOwnProperty(field)) {
      if (['startDate', 'endDate'].includes(field) && typeof updateData[field] === 'string') {
        const dateObj = new Date(updateData[field] + "T00:00:00.000Z");
        if (!isNaN(dateObj.getTime())) updatePayload[`profileTimeline.${field}`] = dateObj;
        else logger.warn(`Invalid date string for field ${field}: ${updateData[field]}`);
      } else {
        updatePayload[`profileTimeline.${field}`] = updateData[field];
      }
    }
  });

  if (Object.keys(updatePayload).length === 0) return { message: 'Không có trường nào hợp lệ để cập nhật.', modifiedCount: 0 };

  if (updateData.hasOwnProperty('startDate') && updateData.hasOwnProperty('endDate')) {
    const newStartDate = updatePayload['profileTimeline.startDate'];
    const newEndDate = updatePayload['profileTimeline.endDate'];
    const excludeHolidays = updateData.hasOwnProperty('excludeHolidays') ? updateData.excludeHolidays : (project.profileTimeline?.excludeHolidays ?? true);
    if (newStartDate && newEndDate) {
      updatePayload['profileTimeline.durationDays'] = await calculateDurationDays(newStartDate, newEndDate, excludeHolidays, holidaysList);
    }
  }
  updatePayload['profileTimeline.assignedBy'] = user.id;
  if (updateData.assignmentType === 'manual' && !updatePayload['profileTimeline.estimator'] && project.profileTimeline?.estimator) {
    updatePayload['profileTimeline.estimator'] = project.profileTimeline.estimator;
  } else if (updateData.assignmentType === 'manual' && !updatePayload['profileTimeline.estimator'] && !project.profileTimeline?.estimator) {
    if (updateData.estimatorId && mongoose.Types.ObjectId.isValid(updateData.estimatorId)) {
        updatePayload['profileTimeline.estimator'] = new mongoose.Types.ObjectId(updateData.estimatorId);
    }
  }

  const pipeline = [
    { $set: { profileTimeline: { $ifNull: ['$profileTimeline', {}] } } },
    { $set: updatePayload }
  ];

  pipeline.push({
    $set: {
      startDate: '$profileTimeline.startDate',
      completionDate: '$profileTimeline.endDate',
      durationDays: '$profileTimeline.durationDays',
      estimator: '$profileTimeline.estimator'
    }
  });

  await CategoryProject.updateOne(
    { _id: projectId },
    pipeline
  );

  const updatedProject = await CategoryProject.findById(projectId).populate('profileTimeline.estimator', 'username fullName').populate('profileTimeline.assignedBy', 'username fullName');
  return { message: 'Đã cập nhật timeline hồ sơ.', project: updatedProject.toObject(), modifiedCount: 1 };
};

const updateConstructionTimelineTask = async (projectId, updateData, user) => {
  const Model = updateData.type === 'category' ? CategoryProject : MinorRepairProject;
  const project = await Model.findById(projectId);
  if (!project) throw { statusCode: 404, message: 'Không tìm thấy công trình.' };
  if (user.role !== 'admin' && !user.permissions.assignConstructionTimeline) throw { statusCode: 403, message: 'Bạn không có quyền cập nhật timeline thi công.' };

  const holidayDoc = await Holiday.findOne({ year: project.financialYear });
  const holidaysList = holidayDoc && holidayDoc.holidays ? holidayDoc.holidays.map(h => new Date(h.date).toISOString().split('T')[0]) : [];

  const allowedFields = ['startDate', 'endDate', 'durationDays', 'progress', 'statusNotes', 'assignmentType', 'excludeHolidays'];
  const updatePayload = {};
  allowedFields.forEach(field => {
    if (updateData.hasOwnProperty(field)) {
      if (['startDate', 'endDate'].includes(field) && typeof updateData[field] === 'string') {
        const dateObj = new Date(updateData[field] + "T00:00:00.000Z");
        if (!isNaN(dateObj.getTime())) updatePayload[`constructionTimeline.${field}`] = dateObj;
        else logger.warn(`Invalid date string for field ${field}: ${updateData[field]}`);
      } else {
        updatePayload[`constructionTimeline.${field}`] = updateData[field];
      }
    }
  });

  if (Object.keys(updatePayload).length === 0) return { message: 'Không có trường nào hợp lệ để cập nhật.', modifiedCount: 0 };

  if (updateData.hasOwnProperty('startDate') && updateData.hasOwnProperty('endDate')) {
    const newStartDate = updatePayload['constructionTimeline.startDate'];
    const newEndDate = updatePayload['constructionTimeline.endDate'];
    const excludeHolidays = updateData.hasOwnProperty('excludeHolidays') ? updateData.excludeHolidays : (project.constructionTimeline?.excludeHolidays ?? true);
    if (newStartDate && newEndDate) {
      updatePayload['constructionTimeline.durationDays'] = await calculateDurationDays(newStartDate, newEndDate, excludeHolidays, holidaysList);
    }
  }
  updatePayload['constructionTimeline.assignedBy'] = user.id;
  if (updateData.assignmentType === 'manual') {
    if (!updatePayload['constructionTimeline.supervisor'] && project.constructionTimeline?.supervisor) {
        updatePayload['constructionTimeline.supervisor'] = project.constructionTimeline.supervisor;
    }
    if (!updatePayload['constructionTimeline.constructionUnit'] && project.constructionTimeline?.constructionUnit) {
        updatePayload['constructionTimeline.constructionUnit'] = project.constructionTimeline.constructionUnit;
    }
    if (updateData.supervisorId && mongoose.Types.ObjectId.isValid(updateData.supervisorId)) {
        updatePayload['constructionTimeline.supervisor'] = new mongoose.Types.ObjectId(updateData.supervisorId);
    }
    if (updateData.constructionUnitName) {
        updatePayload['constructionTimeline.constructionUnit'] = updateData.constructionUnitName;
    }
  }

  const pipeline = [
    { $set: { constructionTimeline: { $ifNull: ['$constructionTimeline', {}] } } },
    { $set: updatePayload }
  ];

  if (Model.modelName === 'CategoryProject') {
    pipeline.push({
      $set: {
        supervisor: '$constructionTimeline.supervisor',
        constructionUnit: '$constructionTimeline.constructionUnit'
      }
    });
  }

  await Model.updateOne(
    { _id: projectId },
    pipeline
  );
  const updatedProject = await Model.findById(projectId).populate('constructionTimeline.supervisor', 'username fullName').populate('constructionTimeline.assignedBy', 'username fullName');
  return { message: 'Đã cập nhật timeline thi công.', project: updatedProject.toObject(), modifiedCount: 1 };
};

const getProjectsForTimelineAssignment = async (queryParams) => {
  const { user, financialYear, timelineType, objectType, estimatorId, constructionUnitName } = queryParams;
  let Model;
  const query = {
    financialYear: parseInt(financialYear, 10),
    isCompleted: false, // Chỉ lấy công trình chưa hoàn thành
    status: 'Đã duyệt',   // Chỉ lấy công trình đã duyệt
  };

  if (!financialYear) {
    logger.warn('[getProjectsForTimelineAssignment] financialYear is required. Returning empty array.');
    return [];
  }

  if (timelineType === 'profile' && objectType === 'category') {
    Model = CategoryProject;
    if (estimatorId && mongoose.Types.ObjectId.isValid(estimatorId)) {
      // Chỉ lấy các công trình đã được phân công cho estimatorId này.
      query['profileTimeline.estimator'] = new mongoose.Types.ObjectId(estimatorId);
    } else if (estimatorId === 'unassigned') {
      // Lấy các công trình chưa có profileTimeline hoặc estimator là null/không tồn tại
      query.$or = [
        { profileTimeline: { $exists: false } },
        { 'profileTimeline.estimator': { $exists: false } },
        { 'profileTimeline.estimator': null }
      ];
    } else { // estimatorId là rỗng, null, undefined hoặc không hợp lệ (và không phải 'unassigned')
        logger.warn('[getProjectsForTimelineAssignment] Profile: estimatorId không được cung cấp hoặc không hợp lệ. Modal phân công cần một estimator cụ thể hoặc "unassigned". Trả về mảng rỗng.');
        return [];
    }
  } else if (timelineType === 'construction') {
    Model = objectType === 'category' ? CategoryProject : MinorRepairProject;
    if (constructionUnitName && constructionUnitName !== 'unassigned') {
      // Chỉ lấy các công trình đã được phân công cho constructionUnitName này.
      query['constructionTimeline.constructionUnit'] = constructionUnitName;
    } else if (constructionUnitName === 'unassigned') {
        // Lấy các công trình chưa có constructionTimeline hoặc constructionUnit là null/rỗng/không tồn tại
        query.$or = [
            { constructionTimeline: { $exists: false } },
            { 'constructionTimeline.constructionUnit': { $exists: false } },
            { 'constructionTimeline.constructionUnit': null },
            { 'constructionTimeline.constructionUnit': '' }
        ];
    } else { // constructionUnitName là rỗng, null, undefined hoặc không hợp lệ (và không phải 'unassigned')
        logger.warn('[getProjectsForTimelineAssignment] Construction: constructionUnitName không được cung cấp hoặc không hợp lệ. Modal phân công cần một đơn vị cụ thể hoặc "unassigned". Trả về mảng rỗng.');
        return [];
    }
  } else {
    throw { statusCode: 400, message: 'Loại timeline hoặc loại đối tượng không hợp lệ.' };
  }

  // Áp dụng filter theo đơn vị của user nếu có
  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      // Nếu đã có $or, cần thêm allocatedUnit vào mỗi nhánh của $or hoặc dùng $and
      if (query.$or) {
        query.$and = [
          { allocatedUnit: user.unit },
          { $or: query.$or }
        ];
        delete query.$or; // Xóa $or gốc sau khi đã đưa vào $and
      } else {
        query.allocatedUnit = user.unit;
      }
    }
  }

  const projects = await Model.find(query)
    .populate('estimator', 'username fullName') // Populate estimator ở gốc (nếu có)
    .populate('supervisor', 'username fullName') // Populate supervisor ở gốc (nếu có)
    .populate('profileTimeline.estimator', 'username fullName')
    .populate('constructionTimeline.supervisor', 'username fullName')
    .sort({ createdAt: 1 });

  return projects.map(p => p.toObject({ virtuals: true }));
};

module.exports = {
    getProfileTimelineProjectsList,
    getConstructionTimelineProjectsList,
    batchUpdateProfileTimeline,
    batchUpdateConstructionTimeline,
    updateProfileTimelineTask,
    updateConstructionTimelineTask,
    getProjectsForTimelineAssignment,
};
