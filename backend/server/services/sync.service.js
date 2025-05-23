// d:\CODE\water-company\backend\server\services\sync.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, AllocatedUnit, User } = require('../models');
const { userFieldToQuery } = require('./helpers/serviceHelpers');
const { generateProjectCode } = require('./helpers/projectCodeHelper');
const logger = require('../config/logger');

/**
 * Prepares old project data for synchronization, identifying missing fields and auto-filled values.
 * @param {string|number} [targetFinancialYear] - Optional. The specific financial year to sync. Can be "all" or a year number.
 * @param {string} [targetProjectType] - Optional. The specific project type to sync ('category', 'minor_repair', 'all').
 * @param {object} [currentUser] - The user performing the action (for context, not used for filtering here).
 * @returns {Promise<Array>} An array of project data prepared for frontend review.
 */
const prepareProjectsForSyncService = async (targetFinancialYear, targetProjectType, currentUser) => {
  logger.info(`[SyncService] Chuẩn bị dữ liệu đồng bộ. Năm: ${targetFinancialYear || 'Tất cả'}, Loại CT: ${targetProjectType || 'Tất cả'}`);
  
  let projectsToProcess = [];
  const categoryQuery = {};
  const minorRepairQuery = {};

  // Không còn đọc từ 'OldProjectSyncData' nữa
  // Thay vào đó, đọc từ CategoryProject và MinorRepairProject
  const categoryProjectsFromDB = await CategoryProject.find(categoryQuery).sort({ createdAt: 1 });
  const minorRepairProjectsFromDB = await MinorRepairProject.find(minorRepairQuery).sort({ createdAt: 1 });

  let allCurrentProjects = [
    ...categoryProjectsFromDB.map(p => ({ ...p.toObject(), type: 'category' })),
    ...minorRepairProjectsFromDB.map(p => ({ ...p.toObject(), type: 'minor_repair' }))
  ];

  // Lọc theo targetProjectType nếu được cung cấp và không phải 'all'
  if (targetProjectType && targetProjectType.toLowerCase() !== 'all') {
    projectsToProcess = allCurrentProjects.filter(p => p.type === targetProjectType);
    logger.info(`[SyncService] Lọc theo loại công trình: ${targetProjectType}. Số lượng còn lại: ${projectsToProcess.length}`);
  } else {
    projectsToProcess = allCurrentProjects;
  }


  logger.info(`[SyncService] Tìm thấy tổng cộng ${projectsToProcess.length} công trình từ CategoryProject và MinorRepairProject.`);

  const preparedProjects = [];
  const categorySchemaFields = Object.keys(CategoryProject.schema.paths);
  const minorRepairSchemaFields = Object.keys(MinorRepairProject.schema.paths);

  // Sửa ở đây: Lặp qua projectsToProcess thay vì oldProjects
  for (const oldP of projectsToProcess) {
    // oldP đã là một plain object do .map(p => ({ ...p.toObject(), ... })) ở trên
    const oldProjectData = oldP; 
    let effectiveFinancialYear = oldProjectData.financialYear;
    if (!effectiveFinancialYear && oldProjectData.createdAt) {
      effectiveFinancialYear = new Date(oldProjectData.createdAt).getUTCFullYear(); // Use UTCFullYear
    } else if (!effectiveFinancialYear) {
      effectiveFinancialYear = new Date().getUTCFullYear(); // Default, use UTCFullYear
    }
    effectiveFinancialYear = parseInt(String(effectiveFinancialYear), 10);

    if (targetFinancialYear && String(targetFinancialYear).toLowerCase() !== 'all' && effectiveFinancialYear !== parseInt(targetFinancialYear, 10)) {
      continue; // Bỏ qua nếu không khớp năm mục tiêu
    }

    // Xác định isCategory dựa trên modelName hoặc trường 'type' đã gán ở trên
    // Chỉ dựa vào trường 'type' vì oldP đã là plain object
    const isCategory = oldProjectData.type === 'category';
    const relevantSchemaFields = isCategory ? categorySchemaFields : minorRepairSchemaFields;
    const Model = isCategory ? CategoryProject : MinorRepairProject;

    const preparedData = {
      _id: oldProjectData._id, // Giữ lại ID gốc để tham chiếu
      originalData: { ...oldProjectData }, // Giữ một bản sao của dữ liệu gốc
      syncData: {}, // Dữ liệu sẽ được đồng bộ, có thể được người dùng sửa đổi
      missingMandatoryFields: [],
      autoFilledFields: {},
      isDuplicateInNewSystem: false,
      projectType: isCategory ? 'category' : 'minor_repair', // Đảm bảo projectType chính xác
    };

    // 1. Kiểm tra trùng lặp trong hệ thống mới
    const duplicateCheckName = (oldProjectData.name || '').trim();
    const duplicateCheckUnit = (oldProjectData.allocatedUnit || '').trim();
    if (duplicateCheckName && duplicateCheckUnit) {
      const existingDuplicate = await Model.findOne({
        name: duplicateCheckName,
        allocatedUnit: duplicateCheckUnit,
        financialYear: effectiveFinancialYear,
        _id: { $ne: oldProjectData._id } // Quan trọng: Loại trừ chính nó
      });
      if (existingDuplicate) {
        preparedData.isDuplicateInNewSystem = true;
      }
    }

    // 2. Ánh xạ và tự động điền các trường
    for (const field of relevantSchemaFields) {
      if (['_id', '__v', 'categorySerialNumber', 'minorRepairSerialNumber'].includes(field)) continue;

      let value = oldProjectData[field];

      // Các trường tự động điền/suy luận
      if (field === 'financialYear') {
        value = effectiveFinancialYear;
        if (oldProjectData.financialYear === undefined || oldProjectData.financialYear === null) preparedData.autoFilledFields[field] = value;
      } else if (field === 'projectCode' && !oldProjectData.projectCode) {
        try {
          value = await generateProjectCode(preparedData.projectType, effectiveFinancialYear, oldProjectData.allocatedUnit);
          preparedData.autoFilledFields[field] = value;
        } catch (e) { logger.error(`Lỗi tạo projectCode cho ${oldProjectData._id} khi chuẩn bị đồng bộ: ${e.message}`); }
      } else if (field === 'isCompleted') {
        value = oldProjectData.isCompleted === true || String(oldProjectData.isCompleted).toLowerCase() === 'true';
        if (oldProjectData.isCompleted === undefined) preparedData.autoFilledFields[field] = value; // Chỉ đánh dấu auto-filled nếu trường gốc là undefined
      } else if (field === 'status' && !oldProjectData.status) {
        value = 'Chờ duyệt'; // Mặc định
        preparedData.autoFilledFields[field] = value;
      } else if (['createdBy', 'approvedBy', 'supervisor', 'estimator'].includes(field) && oldProjectData[field]) {
        const resolvedUser = await userFieldToQuery(String(oldProjectData[field]));
        if (resolvedUser) {
          value = resolvedUser.toString(); // Lưu ID dạng string
          // Không đánh dấu là auto-filled nếu giá trị gốc đã có và resolve được
        } else if (oldProjectData[field]) {
           // Nếu có giá trị gốc nhưng không resolve được, giữ lại giá trị gốc để người dùng review
           value = String(oldProjectData[field]);
        }
      }

      preparedData.syncData[field] = value !== undefined ? value : null; // Gán giá trị vào syncData

      // 3. Kiểm tra trường bắt buộc còn thiếu
      const schemaFieldDefinition = Model.schema.paths[field];
      if (schemaFieldDefinition && schemaFieldDefinition.isRequired) {
        const isEffectivelyEmpty = preparedData.syncData[field] === null ||
                                   preparedData.syncData[field] === undefined ||
                                   (typeof preparedData.syncData[field] === 'string' && preparedData.syncData[field].trim() === '');
        if (isEffectivelyEmpty) {
          preparedData.missingMandatoryFields.push({
            field: field,
            label: schemaFieldDefinition.options.label || field, // Giả sử bạn có 'label' trong options schema
            optionsSource: schemaFieldDefinition.options.optionsSource || null // Thêm optionsSource nếu có
          });
        }
      }
    }
    // Đảm bảo các trường cơ bản có mặt trong syncData dù giá trị là null
    ['name', 'allocatedUnit', 'location', 'scale', 'financialYear'].forEach(f => {
        if (preparedData.syncData[f] === undefined) preparedData.syncData[f] = oldProjectData[f] || null;
    });
    if (isCategory && preparedData.syncData['projectType'] === undefined) {
        preparedData.syncData['projectType'] = oldProjectData['projectType'] || null;
    }
    if (!isCategory && preparedData.syncData['reportDate'] === undefined && oldProjectData['reportDate']) {
        preparedData.syncData['reportDate'] = oldProjectData['reportDate'] ? new Date(oldProjectData['reportDate']).toISOString().split('T')[0] : null;
    }
    // Đảm bảo các trường khác có giá trị mặc định nếu cần
    
    // KIỂM TRA XEM CÔNG TRÌNH NÀY CÓ CẦN REVIEW KHÔNG
    // Điều kiện để một công trình được coi là "không cần review" (đã hoàn hảo):
    // 1. Không bị trùng lặp (isDuplicateInNewSystem = false)
    // 2. Không có trường bắt buộc nào bị thiếu (missingMandatoryFields.length === 0)
    // 3. Không có trường nào được tự động điền (Object.keys(autoFilledFields).length === 0)
    //    HOẶC các trường tự động điền là những trường "luôn được tính toán" như projectCode mới.
    //    Để đơn giản, nếu có autoFilledFields (ngoài projectCode mới nếu nó được tạo), thì vẫn nên review.
    const needsReview = preparedData.isDuplicateInNewSystem || 
                        preparedData.missingMandatoryFields.length > 0 ||
                        Object.keys(preparedData.autoFilledFields).some(key => !(key === 'projectCode' && oldProjectData.projectCode === null && preparedData.autoFilledFields.projectCode !== null));

    if (needsReview) {
      preparedProjects.push(preparedData);
    }
  }

  logger.info(`[SyncService] Đã chuẩn bị ${preparedProjects.length} công trình để review.`);
  return preparedProjects;
};

module.exports = {
  prepareProjectsForSyncService,
};