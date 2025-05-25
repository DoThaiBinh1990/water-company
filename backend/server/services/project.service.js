// d:\CODE\water-company\backend\server\services\project.service.js
const projectCoreService = require('./project.core.service');
const projectActionsService = require('./project.actions.service');
const timelineService = require('./timeline.service'); // Assuming timeline.service.js is already created and correct

// This file now acts as an aggregator for project-related services.
// Specific helper imports like dateCalculation or serviceHelpers are now within their respective consumer services.


// Helper function to resolve user identifier to ObjectId
const getProjectsList = async (queryParams) => {
  const { user, type = 'category', page = 1, limit = 10, status, allocatedUnit, constructionUnit, allocationWave, assignedTo, search, minInitialValue, maxInitialValue, progress, pending, supervisor, estimator, reportDate, financialYear, isCompleted } = queryParams; // Thêm financialYear, isCompleted
  const Model = type === 'category' ? CategoryProject : MinorRepairProject;
  const query = {};

  // Apply general filters first
  if (allocatedUnit) query.allocatedUnit = allocatedUnit;
  if (constructionUnit && type === 'category') query.constructionUnit = constructionUnit;
  if (allocationWave && type === 'category') query.allocationWave = allocationWave;
  if (assignedTo) { // Assuming assignedTo is a user ID or username/fullName
    const userAssigned = await User.findOne({ $or: [{ _id: mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null }, { username: assignedTo }, { fullName: assignedTo }] }).select('_id');
    if (userAssigned) query.assignedTo = userAssigned._id;
    else query.assignedTo = null; // Or handle as "no match"
  }
  if (search) query.name = { $regex: search, $options: 'i' };
  if (reportDate && type === 'minor_repair') query.reportDate = new Date(reportDate);

  // Lọc theo năm tài chính
  if (financialYear) {
    query.financialYear = parseInt(financialYear, 10);
  }

  // Lọc theo trạng thái hoàn thành (isCompleted)
  // Mặc định, nếu không có isCompleted, chỉ lấy công trình chưa hoàn thành (false)
  query.isCompleted = (isCompleted === 'true' || isCompleted === true);

  // Filter by projectType for category projects
  if (queryParams.projectType && type === 'category') {
    query.projectType = queryParams.projectType;
  }

  if (type === 'category') {
    if (minInitialValue || maxInitialValue) {
      query.initialValue = {};
      if (minInitialValue) query.initialValue.$gte = parseFloat(minInitialValue);
      if (maxInitialValue) query.initialValue.$lte = parseFloat(maxInitialValue);
    }
    if (progress) query.progress = progress;
  }

  // Logic for 'pending' tab vs 'projects' tab
  if (pending === 'true' || pending === true) { // For 'pending' tab
    query.$or = [
      { status: 'Chờ duyệt' }, // New projects awaiting approval
      { pendingEdit: { $ne: null, $exists: true } }, // Approved projects with pending edits
      { pendingDelete: true } // Approved projects with pending deletions
    ];
  } else { // For 'projects' tab (main list)
    if (status) { // If user explicitly filters by a status on the main tab
      query.status = status;
    } else { // Default for 'projects' tab: show only 'Đã duyệt' and other post-approval active statuses
      query.status = { $in: ['Đã duyệt', 'Đã phân bổ', 'Đang thực hiện', 'Hoàn thành'] };
      // This implicitly excludes 'Chờ duyệt' (new unapproved) and 'Đã từ chối'.
    }
  }


  if (supervisor) {
    const supervisorId = await userFieldToQuery(supervisor);
    if (supervisorId) query.supervisor = supervisorId;
    else query.supervisor = null; // No match for supervisor
  }
  if (estimator && type === 'category') {
    const estimatorId = await userFieldToQuery(estimator);
    if (estimatorId) query.estimator = estimatorId;
    else query.estimator = null; // No match for estimator
  }


  // Role-based filtering
  if (user) {
    if ((user.role === 'staff-branch' || user.role === 'manager-branch') && user.unit && !user.permissions.viewOtherBranchProjects) {
      // If 'pending' is true, we might want to show pending items for their unit regardless of status
      // The current $or for pending already includes 'Chờ duyệt' which might be from other units if not restricted.
      // Let's ensure unit restriction applies correctly.
      if (query.$or) { // If it's the pending tab
        query.$or.forEach(condition => {
            if (!condition.allocatedUnit) { // Add unit restriction if not already there
                condition.allocatedUnit = user.unit;
            }
        });
      } else { // For main tab or if $or is not used
        query.allocatedUnit = user.unit;
      }
    }
  }


  const count = await Model.countDocuments(query);
  const projectsFromDB = await Model.find(query)
    .populate('createdBy', 'username fullName')
    .populate('approvedBy', 'username fullName')
    .populate('supervisor', 'username fullName')
    .populate(type === 'category' ? { path: 'estimator', select: 'username fullName' } : '')
    .populate({ path: 'pendingEdit.requestedBy', select: 'username fullName' })
    .populate({ path: 'history.user', select: 'username fullName' }) // Populate user in history
    .sort({ createdAt: -1 }) // Sắp xếp theo ngày tạo mới nhất
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  // Populate fields for each project
  const projects = await Promise.all(
    projectsFromDB.map(p => populateProjectFields(p)) // populateProjectFields should handle history.user as well
  );

  return {
    projects,
    total: count,
    page: parseInt(page),
    pages: Math.ceil(count / parseInt(limit)),
  };
};


module.exports = {
  ...projectCoreService,
  ...projectActionsService,
  ...timelineService,
  markAllUserNotificationsAsProcessed: projectActionsService.markAllUserNotificationsAsProcessed,
  markViewedNotificationsAsProcessed: projectActionsService.markViewedNotificationsAsProcessed, // Thêm dòng này
};
