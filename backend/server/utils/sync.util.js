// d:\CODE\water-company\backend\server\utils\sync.util.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, SerialCounter, Notification, User, AllocatedUnit, ProjectCodeCounter } = require('../models'); // Thêm AllocatedUnit, ProjectCodeCounter
const { generateProjectCode } = require('../services/helpers/projectCodeHelper'); // Import helper tạo mã
const { userFieldToQuery } = require('../services/helpers/serviceHelpers');
const logger = require('../config/logger');

/**
 * Synchronizes old project data to the new project schemas.
 * @param {string|number} [targetFinancialYear] - Optional. The specific financial year to sync. Can be "all" or a year number.
 * @param {Array} [projectsToSyncFromFrontend] - Optional. Array of pre-processed projects from frontend (for review-then-sync flow).
 * @param {object} [syncUser] - Optional. The user performing the sync (for logging or history).
 */
async function syncOldProjects(targetFinancialYear, projectsToSyncFromFrontend, syncUser) {
  logger.info(`Bắt đầu đồng bộ dữ liệu công trình. Năm mục tiêu: ${targetFinancialYear || 'Tất cả'}. User: ${syncUser ? syncUser.username : 'System'}`);
  try {
    if (projectsToSyncFromFrontend && projectsToSyncFromFrontend.length > 0) {
      logger.info(`Đồng bộ dựa trên danh sách ${projectsToSyncFromFrontend.length} công trình từ frontend.`);
    } else {
      // Nếu không có projectsToSyncFromFrontend, không có gì để làm.
      logger.info('Không có công trình nào được cung cấp từ frontend để đồng bộ.');
      return { message: 'Không có công trình nào được cung cấp để đồng bộ.', updatedCount: 0, skippedCount: 0 };
    }

    // Đồng bộ và tạo shortCode cho AllocatedUnits nếu chưa có
    const allocatedUnitsFromDB = await AllocatedUnit.find();
    for (const unit of allocatedUnitsFromDB) {
        if (!unit.shortCode) {
            let potentialShortCode = unit.name.substring(0, 3).toUpperCase();
            // Đảm bảo shortCode là duy nhất (logic đơn giản, có thể cần phức tạp hơn nếu có nhiều trùng lặp)
            let suffix = 1;
            let finalShortCode = potentialShortCode;
            while (await AllocatedUnit.findOne({ shortCode: finalShortCode, _id: { $ne: unit._id } })) {
                finalShortCode = potentialShortCode.substring(0, 3 - String(suffix).length) + String(suffix);
                suffix++;
                if (finalShortCode.length > 3) finalShortCode = finalShortCode.substring(0,3); // Đảm bảo không vượt quá 3 ký tự
            }
            unit.shortCode = finalShortCode;
            await unit.save();
            logger.info(`Đã tạo shortCode "${unit.shortCode}" cho đơn vị "${unit.name}".`);
        }
    }
    logger.info('Hoàn tất kiểm tra và tạo shortCode cho các đơn vị phân bổ.');

    // Định nghĩa hàm parseNumeric ở phạm vi ngoài để cả hai khối đều dùng được
    const parseNumeric = (value) => {
      if (value === undefined || value === null || String(value).trim() === '') return null;
      const num = parseFloat(String(value).replace(/,/g, ''));
      return isNaN(num) ? null : num;
    };

    // Đồng bộ Category Projects
    const categoryProjectsToSync = projectsToSyncFromFrontend.filter(p => p.projectType === 'category');
    let updatedCategoryCount = 0;

    const categoryBulkOps = [];
    let categorySerial = await SerialCounter.findOne({ type: 'category' });
    if (!categorySerial) {
      categorySerial = new SerialCounter({ type: 'category', currentSerial: 0 });
    }
    let skippedCategoryCount = 0;

    for (const oldProjectContainer of categoryProjectsToSync) {
      // oldProjectContainer._id là ID của công trình hiện tại trong DB
      // oldProjectContainer.userInputData là dữ liệu người dùng đã sửa/nhập
      const existingProjectId = oldProjectContainer._id;
      const userInputData = oldProjectContainer.userInputData || {};
      const originalProjectData = oldProjectContainer.projectData || {}; // Dữ liệu gốc để tham khảo

      // Suy luận/Xác định financialYear hiệu lực
      // Ưu tiên userInputData, sau đó là originalProjectData, cuối cùng là suy luận
      let effectiveFinancialYear = userInputData.financialYear || originalProjectData.financialYear;
      if (!effectiveFinancialYear && oldProject.createdAt) {
        // Sửa ở đây: oldProject.createdAt -> originalProjectData.createdAt
        effectiveFinancialYear = new Date(originalProjectData.createdAt).getUTCFullYear();
      } else if (!effectiveFinancialYear) {
        effectiveFinancialYear = new Date().getFullYear(); // Mặc định nếu không có gì cả
      }
      effectiveFinancialYear = parseInt(String(effectiveFinancialYear), 10);

      // Lọc theo targetFinancialYear nếu được cung cấp và không phải "all"
      if (targetFinancialYear && String(targetFinancialYear).toLowerCase() !== 'all' && effectiveFinancialYear !== parseInt(targetFinancialYear, 10)) {
        skippedCategoryCount++;
        continue; // Bỏ qua nếu không khớp năm mục tiêu
      }

      const existingProject = await CategoryProject.findById(existingProjectId);
      if (!existingProject) {
        logger.warn(`Không tìm thấy CT Danh mục với ID ${existingProjectId} để cập nhật. Bỏ qua.`);
        skippedCategoryCount++;
        continue;
      }
      const projectData = { // Đây là dữ liệu sẽ được dùng để CẬP NHẬT bản ghi CategoryProject hiện có
        // Merge userInputData vào projectData, ưu tiên userInputData
        ...userInputData, // Các trường người dùng đã nhập sẽ ghi đè oldProject
        // Các trường từ oldProject (sẽ bị ghi đè bởi userInputData nếu trùng key)
        categorySerialNumber: existingProject ? existingProject.categorySerialNumber : ++categorySerial.currentSerial,
        name: userInputData.name ?? originalProjectData.name,
        allocatedUnit: userInputData.allocatedUnit ?? originalProjectData.allocatedUnit, // Giả sử allocatedUnit luôn có giá trị
        constructionUnit: (userInputData.constructionUnit ?? originalProjectData.constructionUnit) || '',
        allocationWave: (userInputData.allocationWave ?? originalProjectData.allocationWave) || '',
        location: userInputData.location ?? originalProjectData.location,
        scale: (userInputData.scale ?? originalProjectData.scale) || '', // Scale is required for CategoryProject
        projectType: (userInputData.projectType ?? originalProjectData.projectType) || '',
        leadershipApproval: (userInputData.leadershipApproval ?? originalProjectData.leadershipApproval) || '',
        enteredBy: originalProjectData.enteredBy, // Giữ lại enteredBy gốc
        status: (userInputData.status ?? originalProjectData.status) || 'Chờ duyệt', // Ưu tiên status từ user input nếu có
        assignedTo: (userInputData.assignedTo ?? originalProjectData.assignedTo) || '',
        taskDescription: (userInputData.taskDescription ?? originalProjectData.taskDescription) || '',
        progress: (userInputData.progress ?? originalProjectData.progress) || '',
        feasibility: (userInputData.feasibility ?? originalProjectData.feasibility) || '',
        notes: (userInputData.notes ?? originalProjectData.notes) || '', // Sửa ở đây, không phải ?? '' mà là || '' sau ??
        pendingEdit: originalProjectData.pendingEdit || null, // Không nên cho user sửa trực tiếp
        pendingDelete: originalProjectData.pendingDelete === true, // Không nên cho user sửa trực tiếp
        createdAt: originalProjectData.createdAt, // Giữ lại createdAt gốc
        updatedAt: new Date(), // Cập nhật updatedAt
        history: originalProjectData.history || [], // Giữ lại history gốc, có thể thêm action mới
        profileTimeline: (userInputData.profileTimeline ?? originalProjectData.profileTimeline) || null,
        constructionTimeline: (userInputData.constructionTimeline ?? originalProjectData.constructionTimeline) || null,
      };

      projectData.financialYear = effectiveFinancialYear; // Sử dụng financialYear đã xác định
      if (isNaN(projectData.financialYear)) projectData.financialYear = new Date().getUTCFullYear();
      
      // Sửa ở đây: oldProject.isCompleted -> originalProjectData.isCompleted
      projectData.isCompleted = originalProjectData.isCompleted === true || String(originalProjectData.isCompleted).toLowerCase() === 'true';
      if (userInputData.hasOwnProperty('isCompleted')) { // Ưu tiên input từ người dùng nếu có
        projectData.isCompleted = userInputData.isCompleted === true || String(userInputData.isCompleted).toLowerCase() === 'true';
      }

      // Kiểm tra trùng lặp trong hệ thống mới
      const duplicateCheckName = (projectData.name || '').trim();
      const duplicateCheckUnit = (projectData.allocatedUnit || '').trim();
      if (duplicateCheckName && duplicateCheckUnit) {
        const existingDuplicateInNewSystem = await CategoryProject.findOne({
          name: duplicateCheckName,
          allocatedUnit: duplicateCheckUnit,
          financialYear: projectData.financialYear,
          _id: { $ne: existingProjectId } // Quan trọng: loại trừ trường hợp đang cập nhật chính nó
        });
        if (existingDuplicateInNewSystem) {
          logger.warn(`[SYNC EXECUTE] Bỏ qua cập nhật CT Danh mục "${duplicateCheckName}" (ID: ${existingProjectId}) do sẽ tạo bản ghi trùng (tên, ĐVPB, năm) với ID: ${existingDuplicateInNewSystem._id}.`);
          skippedCategoryCount++;
          continue;
        }
      }

      // Tạo projectCode nếu chưa có hoặc được cung cấp từ userInputData
      // Logic: Ưu tiên userInputData.projectCode > originalProjectData.projectCode > generate new code
      if (userInputData.projectCode) {
          projectData.projectCode = userInputData.projectCode;
      } else if (originalProjectData.projectCode) {
          projectData.projectCode = originalProjectData.projectCode;
      } else { // Chỉ tạo mã mới nếu cả hai đều không có
          try {
            projectData.projectCode = await generateProjectCode('category', projectData.financialYear, projectData.allocatedUnit, originalProjectData.allocationWave, false); // Không ở chế độ preview khi thực thi
          } catch (codeGenError) {
            logger.error(`Lỗi tạo projectCode cho CT Danh mục ID ${existingProjectId}: ${codeGenError.message}. Sẽ để trống.`); 
            projectData.projectCode = null; 
          }
      }
      projectData.createdBy = await userFieldToQuery(userInputData.createdBy || originalProjectData.createdBy) || await userFieldToQuery(originalProjectData.enteredBy);
      if (!projectData.createdBy && !existingProject.createdBy) { // Chỉ yêu cầu nếu cả hai đều thiếu
          const defaultCreator = await User.findOne({ role: 'admin' }).session(null); // Không cần session cho query đơn giản này
          if (!projectData.createdBy) {
            logger.error(`Không thể gán người tạo mặc định cho CT Danh mục ID ${existingProjectId}. Bỏ qua.`);
            continue;
          }
      }
      projectData.approvedBy = await userFieldToQuery(userInputData.approvedBy || originalProjectData.approvedBy);
      projectData.supervisor = await userFieldToQuery(userInputData.supervisor || originalProjectData.supervisor);
      projectData.estimator = await userFieldToQuery(userInputData.estimator || originalProjectData.estimator); // estimator có thể là ID hoặc tên
      if (typeof (userInputData.assignedTo || originalProjectData.assignedTo) === 'string') {
        projectData.assignedTo = await userFieldToQuery(userInputData.assignedTo || originalProjectData.assignedTo) || (userInputData.assignedTo || originalProjectData.assignedTo); // assignedTo có thể là ID hoặc tên
      }

      projectData.startDate = (userInputData.startDate || originalProjectData.startDate) ? new Date(userInputData.startDate || originalProjectData.startDate) : null;
      projectData.completionDate = (userInputData.completionDate || originalProjectData.completionDate) ? new Date(userInputData.completionDate || originalProjectData.completionDate) : null;

      projectData.initialValue = parseNumeric(userInputData.initialValue ?? originalProjectData.initialValue);
      projectData.contractValue = parseNumeric(userInputData.contractValue ?? originalProjectData.contractValue);
      projectData.estimatedValue = parseNumeric(userInputData.estimatedValue ?? originalProjectData.estimatedValue);
      projectData.durationDays = (userInputData.durationDays ?? originalProjectData.durationDays) !== undefined && (userInputData.durationDays ?? originalProjectData.durationDays) !== null ? parseInt(String(userInputData.durationDays ?? originalProjectData.durationDays), 10) : null;
      if (isNaN(projectData.durationDays)) projectData.durationDays = null;


      const categorySchemaPaths = Object.keys(CategoryProject.schema.paths);
      for (const key in projectData) {
          if (!categorySchemaPaths.includes(key) && key !== '_id') {
              delete projectData[key];
          }
      }

      if (existingProject) {
        categoryBulkOps.push({ updateOne: { filter: { _id: existingProjectId }, update: { $set: projectData } } });
        updatedCategoryCount++;
      }
    }
    if (categoryBulkOps.length > 0) await CategoryProject.bulkWrite(categoryBulkOps, { ordered: false });
    // Không cập nhật SerialCounter ở đây vì chúng ta đang UPDATE, không phải INSERT mới
    logger.info(`Đã xử lý ${categoryProjectsToSync.length} CT danh mục. Cập nhật thành công: ${updatedCategoryCount}. Bỏ qua (không tìm thấy/trùng/lọc năm): ${skippedCategoryCount + (categoryProjectsToSync.length - updatedCategoryCount)}.`);

    // Đồng bộ Minor Repair Projects
    const minorRepairProjectsToSync = projectsToSyncFromFrontend.filter(p => p.projectType === 'minor_repair');
    let updatedMinorRepairCount = 0;

    const minorRepairBulkOps = [];
    let minorRepairSerial = await SerialCounter.findOne({ type: 'minor_repair' });
    if (!minorRepairSerial) {
      minorRepairSerial = new SerialCounter({ type: 'minor_repair', currentSerial: 0 });
    }
    let skippedMinorRepairCount = 0;

    for (const oldProjectContainer of minorRepairProjectsToSync) {
      const existingProjectId = oldProjectContainer._id;
      const userInputData = oldProjectContainer.userInputData || {};
      const originalProjectData = oldProjectContainer.projectData || {};

      let effectiveFinancialYear = userInputData.financialYear || originalProjectData.financialYear;
      // Sửa ở đây: oldProject.createdAt -> originalProjectData.createdAt
      if (!effectiveFinancialYear && originalProjectData.createdAt) {
        effectiveFinancialYear = new Date(originalProjectData.createdAt).getFullYear();
      }
      else if (!effectiveFinancialYear) effectiveFinancialYear = new Date().getFullYear();
      effectiveFinancialYear = parseInt(String(effectiveFinancialYear), 10); // Use UTCFullYear consistently?

      if (targetFinancialYear && String(targetFinancialYear).toLowerCase() !== 'all' && effectiveFinancialYear !== parseInt(targetFinancialYear, 10)) {
        skippedMinorRepairCount++;
        continue;
      }

      const existingProject = await MinorRepairProject.findById(existingProjectId);
      if (!existingProject) {
        logger.warn(`Không tìm thấy CT SCN với ID ${existingProjectId} để cập nhật. Bỏ qua.`);
        skippedMinorRepairCount++;
        continue;
      }
      const projectData = { // Dữ liệu sẽ được dùng để CẬP NHẬT bản ghi MinorRepairProject hiện có
        ...userInputData,
        minorRepairSerialNumber: existingProject ? existingProject.minorRepairSerialNumber : ++minorRepairSerial.currentSerial,
        name: userInputData.name ?? originalProjectData.name,
        allocatedUnit: userInputData.allocatedUnit ?? originalProjectData.allocatedUnit, // Giả sử allocatedUnit luôn có giá trị
        location: userInputData.location ?? originalProjectData.location,
        scale: (userInputData.scale ?? originalProjectData.scale) || '',
        leadershipApproval: (userInputData.leadershipApproval ?? originalProjectData.leadershipApproval) || '',
        enteredBy: originalProjectData.enteredBy,
        status: (userInputData.status ?? originalProjectData.status) || 'Chờ duyệt', // Default status if both are empty
        assignedTo: (userInputData.assignedTo ?? originalProjectData.assignedTo) || '',
        taskDescription: (userInputData.taskDescription ?? originalProjectData.taskDescription) || '',
        notes: (userInputData.notes ?? originalProjectData.notes) || '', // Sửa ở đây
        pendingEdit: originalProjectData.pendingEdit || null,
        pendingDelete: originalProjectData.pendingDelete === true,
        createdAt: originalProjectData.createdAt,
        updatedAt: new Date(),
        history: originalProjectData.history || [],
        constructionTimeline: (userInputData.constructionTimeline ?? originalProjectData.constructionTimeline) || null,
      };

      projectData.financialYear = effectiveFinancialYear;
      if (isNaN(projectData.financialYear)) projectData.financialYear = new Date().getUTCFullYear();
      
      // Sửa ở đây: oldProject.isCompleted -> originalProjectData.isCompleted
      projectData.isCompleted = originalProjectData.isCompleted === true || String(originalProjectData.isCompleted).toLowerCase() === 'true';
      if (userInputData.hasOwnProperty('isCompleted')) {
        projectData.isCompleted = userInputData.isCompleted === true || String(userInputData.isCompleted).toLowerCase() === 'true';
      }

      const duplicateCheckName = (projectData.name || '').trim();
      const duplicateCheckUnit = (projectData.allocatedUnit || '').trim();
      if (duplicateCheckName && duplicateCheckUnit) {
        const existingDuplicateInNewSystem = await MinorRepairProject.findOne({
          name: duplicateCheckName,
          allocatedUnit: duplicateCheckUnit,
          financialYear: projectData.financialYear,
          _id: { $ne: existingProjectId }
        });
        if (existingDuplicateInNewSystem) {
          logger.warn(`[SYNC EXECUTE] Bỏ qua cập nhật CT SCN "${duplicateCheckName}" (ID: ${existingProjectId}) do sẽ tạo bản ghi trùng (tên, ĐVPB, năm) với ID: ${existingDuplicateInNewSystem._id}.`);
          skippedMinorRepairCount++;
          continue;
        }
      }

      // Tạo projectCode nếu chưa có hoặc được cung cấp từ userInputData
      // Logic: Ưu tiên userInputData.projectCode > originalProjectData.projectCode > generate new code
      if (userInputData.projectCode) {
          projectData.projectCode = userInputData.projectCode;
      } else if (originalProjectData.projectCode) {
          projectData.projectCode = originalProjectData.projectCode;
      } else { // Chỉ tạo mã mới nếu cả hai đều không có
          try {
            projectData.projectCode = await generateProjectCode('minor_repair', projectData.financialYear, projectData.allocatedUnit, null, false); // Minor repair không có allocationWave, không ở chế độ preview
          } catch (codeGenError) {
            logger.error(`Lỗi tạo projectCode cho CT SCN ID ${existingProjectId}: ${codeGenError.message}. Sẽ để trống.`); 
            projectData.projectCode = null; 
          }
      }

      projectData.createdBy = await userFieldToQuery(userInputData.createdBy || originalProjectData.createdBy) || await userFieldToQuery(originalProjectData.enteredBy);
      if (!projectData.createdBy && !existingProject.createdBy) {
          const defaultCreator = await User.findOne({ role: 'admin' }).session(null);
          projectData.createdBy = defaultCreator ? defaultCreator._id : null;
          if (!projectData.createdBy) {
            logger.error(`Không thể gán người tạo mặc định cho CT SCN ID ${existingProjectId}. Bỏ qua.`);
            continue;
          }
      }
      projectData.approvedBy = await userFieldToQuery(userInputData.approvedBy || originalProjectData.approvedBy); // approvedBy có thể là ID hoặc tên
      projectData.supervisor = await userFieldToQuery(userInputData.supervisor || originalProjectData.supervisor);
       if (typeof (userInputData.assignedTo || originalProjectData.assignedTo) === 'string') {
        projectData.assignedTo = await userFieldToQuery(userInputData.assignedTo || originalProjectData.assignedTo) || (userInputData.assignedTo || originalProjectData.assignedTo);
      }

      projectData.reportDate = (userInputData.reportDate || originalProjectData.reportDate) ? new Date(userInputData.reportDate || originalProjectData.reportDate) : null;
      projectData.inspectionDate = (userInputData.inspectionDate || originalProjectData.inspectionDate) ? new Date(userInputData.inspectionDate || originalProjectData.inspectionDate) : null;
      projectData.paymentDate = (userInputData.paymentDate || originalProjectData.paymentDate) ? new Date(userInputData.paymentDate || originalProjectData.paymentDate) : null;
      projectData.paymentValue = parseNumeric(userInputData.paymentValue ?? originalProjectData.paymentValue);

      const minorRepairSchemaPaths = Object.keys(MinorRepairProject.schema.paths);
      for (const key in projectData) {
          if (!minorRepairSchemaPaths.includes(key) && key !== '_id') {
              delete projectData[key];
          }
      }

      if (existingProject) {
        minorRepairBulkOps.push({ updateOne: { filter: { _id: existingProjectId }, update: { $set: projectData } } });
        updatedMinorRepairCount++;
      }
    }
    if (minorRepairBulkOps.length > 0) await MinorRepairProject.bulkWrite(minorRepairBulkOps, { ordered: false });
    // Không cập nhật SerialCounter
    logger.info(`Đã xử lý ${minorRepairProjectsToSync.length} CT SCN. Cập nhật thành công: ${updatedMinorRepairCount}. Bỏ qua (không tìm thấy/trùng/lọc năm): ${skippedMinorRepairCount + (minorRepairProjectsToSync.length - updatedMinorRepairCount)}.`);

    // Cập nhật projectModel cho Notifications
    const notifications = await Notification.find();
    for (const notification of notifications) {
      if (notification.projectId) {
        // Logic này có thể không còn cần thiết nếu projectModel đã đúng từ đầu
        // Hoặc nếu các notification cũ không còn liên quan đến dữ liệu "cũ" nữa.
        // Tạm thời giữ lại, nhưng cần xem xét lại mục đích của việc cập nhật này.
        // logger.debug(`Kiểm tra notification ${notification._id} cho projectId ${notification.projectId}`);
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
