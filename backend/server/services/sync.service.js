// d:\CODE\water-company\backend\server\services\sync.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, AllocatedUnit, User, RejectedProject } = require('../models'); // Thêm RejectedProject
const { userFieldToQuery } = require('./helpers/serviceHelpers');
const { generateProjectCode } = require('./helpers/projectCodeHelper');
const logger = require('../config/logger');
const { categoryFormConfig, minorRepairFormConfig } = require('../config/formConfigs');
const { updateSerialNumbers } = require('../utils/serialNumber.util'); // Import updateSerialNumbers

/**
 * Prepares project data for synchronization, identifying missing fields and auto-filled values based on form configs.
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

  // Lấy cấu hình form để xác định các trường bắt buộc và optionsSource
  const formConfigs = {
      category: categoryFormConfig,
      minor_repair: minorRepairFormConfig,
  };
  const getFieldConfig = (projectType, fieldName) => {
      return formConfigs[projectType]?.tabs.flatMap(tab => tab.fields).find(f => f.name === fieldName);
  };

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

    // Lấy tất cả các trường từ form config cho loại công trình này
    const relevantFormFields = formConfigs[preparedData.projectType]?.tabs.flatMap(tab => tab.fields) || [];

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

    // 2. Ánh xạ và xử lý các trường (bao gồm tự động điền và kiểm tra bắt buộc)
    for (const field of relevantSchemaFields) {
      if (['_id', '__v', 'categorySerialNumber', 'minorRepairSerialNumber'].includes(field)) continue;

      const fieldName = field; // Đổi tên biến để rõ ràng hơn
      let value = oldProjectData[field];

      // Các trường tự động điền/suy luận
      if (field === 'financialYear') {
        value = effectiveFinancialYear;
        if (oldProjectData.financialYear === undefined || oldProjectData.financialYear === null) preparedData.autoFilledFields[field] = value;
      } else if (field === 'projectCode' && !oldProjectData.projectCode) {
        try {
          // Gọi generateProjectCode ở chế độ xem trước (previewMode = true)
          // Nó sẽ không tăng bộ đếm hoặc upsert counter, chỉ tính toán mã kỳ vọng.
          // oldProjectData.allocatedUnit có thể là ID hoặc tên.
          // oldProjectData.allocationWave có thể là ID hoặc tên.
          // Hàm generateProjectCode đã được cập nhật để xử lý cả hai trường hợp.
          const unitIdentifier = oldProjectData.allocatedUnit;
          const waveIdentifier = oldProjectData.allocationWave;

          value = await generateProjectCode(preparedData.projectType, effectiveFinancialYear, unitIdentifier, waveIdentifier, true); // Thêm previewMode = true
          
          if (value) { // Chỉ gán nếu generateProjectCode trả về mã hợp lệ
            preparedData.autoFilledFields[fieldName] = value; // Đánh dấu là auto-filled
          } else {
            logger.warn(`Không thể tạo projectCode dự kiến cho ${oldProjectData._id} do thiếu thông tin đơn vị.`);
            // Nếu projectCode là bắt buộc, nó sẽ được đánh dấu trong missingMandatoryFields
          }
        } catch (e) { logger.error(`Lỗi trong quá trình tạo projectCode dự kiến cho ${oldProjectData._id} khi chuẩn bị đồng bộ: ${e.message}`); }
      } else if (fieldName === 'isCompleted') {
        value = oldProjectData.isCompleted === true || String(oldProjectData.isCompleted).toLowerCase() === 'true' || false; // Default to false if undefined/null
        if (oldProjectData.isCompleted === undefined) preparedData.autoFilledFields[field] = value; // Chỉ đánh dấu auto-filled nếu trường gốc là undefined
      } else if (field === 'status' && !oldProjectData.status) {
        value = 'Chờ duyệt'; // Mặc định
        preparedData.autoFilledFields[field] = value;
      } else if (['createdBy', 'approvedBy', 'supervisor', 'estimator'].includes(field) && oldProjectData[field]) {
        const resolvedUser = await userFieldToQuery(String(oldProjectData[field]));
        if (resolvedUser) {
          value = resolvedUser.toString(); // Lưu ID dạng string
          // Không đánh dấu là auto-filled nếu giá trị gốc đã có và resolve được
        } else if (oldProjectData[field] !== undefined && oldProjectData[field] !== null && String(oldProjectData[field]).trim() !== '') {
           // Nếu có giá trị gốc nhưng không resolve được, giữ lại giá trị gốc để người dùng review
           value = String(oldProjectData[field]);
        }
      } else if (['initialValue', 'estimatedValue', 'contractValue', 'paymentValue'].includes(fieldName)) {
          // Xử lý các trường số
          const num = parseFloat(String(value).replace(/,/g, ''));
          value = isNaN(num) ? null : num;
      } else if (['reportDate', 'inspectionDate', 'paymentDate', 'startDate', 'completionDate'].includes(fieldName)) {
          // Xử lý các trường ngày tháng
          value = (value && !isNaN(new Date(value).getTime())) ? new Date(value).toISOString().split('T')[0] : null; // Lưu dưới dạng YYYY-MM-DD string, kiểm tra ngày hợp lệ
      }


      preparedData.syncData[field] = value !== undefined ? value : null; // Gán giá trị vào syncData

      // 3. Kiểm tra trường bắt buộc còn thiếu
      const fieldConfig = getFieldConfig(preparedData.projectType, fieldName);
      const schemaFieldDefinition = Model.schema.paths[fieldName];

      // Xác định xem trường có thực sự bắt buộc không, ưu tiên formConfig
      let isFieldConsideredRequired = false;
      if (fieldConfig && typeof fieldConfig.required === 'boolean') {
        isFieldConsideredRequired = fieldConfig.required;
      } else if (schemaFieldDefinition && schemaFieldDefinition.isRequired) {
        isFieldConsideredRequired = schemaFieldDefinition.isRequired;
        const isEffectivelyEmpty = preparedData.syncData[field] === null ||
                                   preparedData.syncData[field] === undefined ||
                                   (typeof preparedData.syncData[field] === 'string' && preparedData.syncData[field].trim() === '');
        // Trường projectCode là bắt buộc trong schema, nhưng ta tự tạo nếu thiếu.
        // Chỉ đánh dấu thiếu nếu không có giá trị VÀ không phải là trường projectCode
        if (isEffectivelyEmpty && field !== 'projectCode') {
          const fieldConfig = getFieldConfig(preparedData.projectType, field);
          preparedData.missingMandatoryFields.push({
            field: field,
            // Lấy label và optionsSource từ form config nếu có, ngược lại dùng schema info
            label: fieldConfig?.label || schemaFieldDefinition.options.label || field,
            optionsSource: fieldConfig?.optionsSource || schemaFieldDefinition.options.optionsSource || null
          });
        }
      }
    }
    // Đảm bảo các trường cơ bản có mặt trong syncData dù giá trị là null
    // (Có thể đã được thêm ở vòng lặp trên, nhưng thêm lại để chắc chắn)
    ['name', 'allocatedUnit', 'location', 'scale', 'financialYear'].forEach(f => {
        if (preparedData.syncData[f] === undefined) preparedData.syncData[f] = oldProjectData[f] || null;
    });
    if (isCategory && preparedData.syncData['projectType'] === undefined) {
        preparedData.syncData['projectType'] = oldProjectData['projectType'] || null;
    }
     if (!isCategory && preparedData.syncData['createdBy'] === undefined) {
        preparedData.syncData['createdBy'] = oldProjectData['createdBy'] || null;
    }
    // Đảm bảo các trường khác có giá trị mặc định nếu cần

    // KIỂM TRA XEM CÔNG TRÌNH NÀY CÓ CẦN REVIEW KHÔNG
    // Điều kiện để một công trình được coi là "không cần review" (đã hoàn hảo):
    // 1. Không bị trùng lặp (isDuplicateInNewSystem = false)
    // 2. Không có trường bắt buộc nào bị thiếu (missingMandatoryFields.length === 0)
    // 3. Không có trường nào được tự động điền (Object.keys(autoFilledFields).length === 0)
    //    NGOẠI LỆ: projectCode được tạo mới KHÔNG làm cho công trình cần review nếu mọi thứ khác hoàn hảo.
    const needsReview = preparedData.isDuplicateInNewSystem ||
                        preparedData.missingMandatoryFields.length > 0 ||
                        Object.keys(preparedData.autoFilledFields).some(key => key !== 'projectCode'); // Cần review nếu có auto-filled field KHÁC projectCode
    // Sửa điều kiện needsReview: Chỉ cần review nếu có duplicate HOẶC missing mandatory fields HOẶC auto-filled fields KHÁC projectCode, status, isCompleted, financialYear
    if (needsReview) {
      preparedProjects.push(preparedData);
    }
  }

  logger.info(`[SyncService] Đã chuẩn bị ${preparedProjects.length} công trình để review.`);
  return preparedProjects;
};

/**
 * Deletes an original project by its ID and type.
 * This is intended for use from the sync review modal to remove duplicates.
 * @param {string} projectId - The ID of the project to delete.
 * @param {string} projectType - The type of the project ('category' or 'minor_repair').
 * @param {object} userPerformingAction - The user performing the action.
 * @returns {Promise<object>} A success message.
 */
const deleteOriginalProjectByIdService = async (projectId, projectType, userPerformingAction) => {
  logger.info(`[SyncService] Yêu cầu xóa công trình gốc. ID: ${projectId}, Loại: ${projectType}, User: ${userPerformingAction.username}`);
  const Model = projectType === 'category' ? CategoryProject : MinorRepairProject;

  const project = await Model.findById(projectId);
  if (!project) {
    throw { statusCode: 404, message: 'Không tìm thấy công trình gốc để xóa.' };
  }

  // Thực hiện xóa
  await Model.deleteOne({ _id: projectId });
  logger.info(`[SyncService] Đã xóa công trình gốc ID: ${projectId} từ collection ${Model.modelName}.`);

  // Cập nhật lại số thứ tự cho các công trình còn lại cùng loại
  await updateSerialNumbers(projectType);
  logger.info(`[SyncService] Đã cập nhật số thứ tự cho loại công trình: ${projectType} sau khi xóa.`);

  return { message: `Công trình "${project.name || projectId}" đã được xóa vĩnh viễn.` };
};

module.exports = {
  prepareProjectsForSyncService,
  deleteOriginalProjectByIdService,
};
