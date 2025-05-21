// d:\CODE\water-company\backend\server\services\timeline.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, User, Holiday } = require('../models'); // Holiday is already imported
const { populateProjectFields } = require('../utils');
const logger = require('../config/logger');
const { calculateEndDate, calculateDurationDays } = require('./helpers/dateCalculation');
const { userFieldToQuery } = require('./helpers/serviceHelpers');

const getProfileTimelineProjectsList = async (queryParams) => {
  const { user, financialYear, estimatorId } = queryParams;
  const Model = CategoryProject; // Timeline hồ sơ chỉ cho CategoryProject
  const query = {
    'profileTimeline.startDate': { $exists: true, $ne: null },
    'profileTimeline.endDate': { $exists: true, $ne: null },
    isCompleted: false,
  };

  if (financialYear) {
    query.financialYear = parseInt(financialYear, 10);
  }

  if (estimatorId && mongoose.Types.ObjectId.isValid(estimatorId)) {
    query['profileTimeline.estimator'] = estimatorId;
  } else if (estimatorId === 'unassigned') {
    query['profileTimeline.estimator'] = { $exists: false };
  }

  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      query.allocatedUnit = user.unit;
    }
  }

  const sort = { 'profileTimeline.order': 1, 'profileTimeline.startDate': 1 };

  const projects = await Model.find(query)
    .populate('profileTimeline.estimator', 'username fullName')
    .populate('profileTimeline.assignedBy', 'username fullName')
    .sort(sort);

  const formattedProjects = projects
    .map(p => {
      if (!p) {
        logger.warn('Một project null hoặc undefined đã được tìm thấy trong kết quả query getProfileTimelineProjectsList. Bỏ qua.');
        return null;
      }
      return {
        id: p._id,
        name: p.name || `Công trình ID: ${p._id}`,
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
  const { user, type, financialYear, constructionUnitName } = queryParams;
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;
  const query = {
    'constructionTimeline.startDate': { $exists: true, $ne: null },
    'constructionTimeline.endDate': { $exists: true, $ne: null },
    isCompleted: false,
  };

  // if (type) query.projectType = type; // This was incorrect for this query context
  if (financialYear) {
    query.financialYear = parseInt(financialYear, 10);
  }

  if (constructionUnitName) {
    query['constructionTimeline.constructionUnit'] = constructionUnitName;
  } else if (constructionUnitName === 'unassigned') {
     query['constructionTimeline.constructionUnit'] = { $exists: false };
  }

  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      query.allocatedUnit = user.unit;
    }
  }

  const sort = { 'constructionTimeline.order': 1, 'constructionTimeline.startDate': 1 };

  const projects = await Model.find(query)
    .populate('constructionTimeline.supervisor', 'username fullName')
    .populate('constructionTimeline.assignedBy', 'username fullName')
    .sort(sort);

  const formattedProjects = projects
    .map(p => {
      if (!p) {
        logger.warn('Một project null hoặc undefined đã được tìm thấy trong kết quả query getConstructionTimelineProjectsList. Bỏ qua.');
        return null;
      }
      return {
        id: p._id,
        name: p.name || `Công trình ID: ${p._id}`,
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
        update: {
          $set: {
            'profileTimeline.estimator': estimatorId,
            'profileTimeline.assignedBy': user.id,
            'profileTimeline.assignmentType': assignmentType,
            'profileTimeline.startDate': new Date(currentStartDate),
            'profileTimeline.durationDays': durationDays ? parseInt(durationDays, 10) : null,
            'profileTimeline.endDate': calculatedEndDate ? new Date(calculatedEndDate) : null,
            'profileTimeline.excludeHolidays': excludeHolidays,
            'profileTimeline.order': order !== undefined ? parseInt(order, 10) : null,
            'profileTimeline.actualStartDate': null,
            'profileTimeline.actualEndDate': null,
            'profileTimeline.progress': 0,
            'profileTimeline.statusNotes': '',
          }
        }
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

    bulkOps.push({
      updateOne: {
        filter: { _id: projectId, financialYear: parseInt(financialYear, 10) },
        update: {
          $set: {
            'constructionTimeline.constructionUnit': constructionUnitName,
            'constructionTimeline.supervisor': inputSupervisor || null,
            'constructionTimeline.assignedBy': user.id,
            'constructionTimeline.assignmentType': assignmentType,
            'constructionTimeline.startDate': new Date(currentStartDate),
            'constructionTimeline.durationDays': durationDays ? parseInt(durationDays, 10) : null,
            'constructionTimeline.endDate': calculatedEndDate ? new Date(calculatedEndDate) : null,
            'constructionTimeline.excludeHolidays': excludeHolidays,
            'constructionTimeline.order': order !== undefined ? parseInt(order, 10) : null,
            'constructionTimeline.actualStartDate': null,
            'constructionTimeline.actualEndDate': null,
            'constructionTimeline.progress': 0,
            'constructionTimeline.statusNotes': '',
          }
        }
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
  await CategoryProject.updateOne({ _id: projectId }, { $set: updatePayload });
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
  await Model.updateOne({ _id: projectId }, { $set: updatePayload });
  const updatedProject = await Model.findById(projectId).populate('constructionTimeline.supervisor', 'username fullName').populate('constructionTimeline.assignedBy', 'username fullName');
  return { message: 'Đã cập nhật timeline thi công.', project: updatedProject.toObject(), modifiedCount: 1 };
};

const getProjectsForTimelineAssignment = async (queryParams) => {
  const { user, financialYear, timelineType, objectType, estimatorId, constructionUnitName } = queryParams;
  let Model;
  const query = {
    financialYear: parseInt(financialYear, 10),
    isCompleted: false,
    status: 'Đã duyệt',
  };

  if (timelineType === 'profile' && objectType === 'category') {
    Model = CategoryProject;
    if (estimatorId && mongoose.Types.ObjectId.isValid(estimatorId)) {
      query.$and = [
        { $or: [{ estimator: estimatorId }, { estimator: null }, { estimator: { $exists: false } }] },
        { $or: [{ 'profileTimeline.assignmentType': 'auto' }, { 'profileTimeline.assignmentType': { $exists: false } }, { profileTimeline: { $exists: false } }] }
      ];
    } else return [];
  } else if (timelineType === 'construction') {
    Model = objectType === 'category' ? CategoryProject : MinorRepairProject;
    if (constructionUnitName) {
      query.$and = [
        { $or: [{ constructionUnit: constructionUnitName }, { constructionUnit: null }, { constructionUnit: '' }, { constructionUnit: { $exists: false } }] },
        { $or: [{ 'constructionTimeline.assignmentType': 'auto' }, { 'constructionTimeline.assignmentType': { $exists: false } }, { constructionTimeline: { $exists: false } }] }
      ];
    } else return [];
  } else {
    throw { statusCode: 400, message: 'Loại timeline hoặc loại đối tượng không hợp lệ.' };
  }

  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      query.allocatedUnit = user.unit;
    }
  }

  const projects = await Model.find(query)
    .populate('estimator', 'username fullName')
    .populate('supervisor', 'username fullName')
    .populate('profileTimeline.estimator', 'username fullName')
    .populate('constructionTimeline.supervisor', 'username fullName')
    .sort({ createdAt: 1 });

  const populatedProjects = await Promise.all(projects.map(p => populateProjectFields(p)));
  return populatedProjects;
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