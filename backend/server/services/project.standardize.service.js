// d:\CODE\water-company\backend\server\services\project.standardize.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, AllocatedUnit, AllocationWave, ProjectType: ModelProjectType, ProjectCodeCounter } = require('../models');
const logger = require('../config/logger');

// Hàm nội bộ để tạo mã chuẩn hóa, khác với generateProjectCode ở chỗ nó nhận sequenceNumber trực tiếp
async function generateStandardizedCodeInternal(projectTypeString, financialYear, allocatedUnitShortCode, allocationWaveShortCode = '00', sequenceNumber) {
    const typePrefix = projectTypeString === 'category' ? 'DM' : 'SC';
    const yearSuffix = String(financialYear).slice(-2);

    let dddFormatted = String(sequenceNumber);
    if (sequenceNumber < 1000) {
        dddFormatted = dddFormatted.padStart(3, '0');
    }
    // allocationWaveShortCode đã được cung cấp (hoặc '00')
    if (projectTypeString === 'minor_repair') {
        return `${typePrefix}${yearSuffix}${allocatedUnitShortCode}${dddFormatted}`;
    } else { // Cho 'category'
        return `${typePrefix}${allocationWaveShortCode}${yearSuffix}${allocatedUnitShortCode}${dddFormatted}`;
    }
}

const prepareStandardizationScope = async (queryParams) => {
    const { financialYear, projectType: projectTypeString, allocatedUnitId, allocationWaveId } = queryParams;

    if (!projectTypeString) {
        throw { statusCode: 400, message: 'Loại công trình là bắt buộc để chuẩn bị chuẩn hóa.' };
    }

    let unitsToQuery = [];
    if (allocatedUnitId) {
        if (!mongoose.Types.ObjectId.isValid(allocatedUnitId)) {
            throw { statusCode: 400, message: 'ID Đơn vị phân bổ không hợp lệ.' };
        }
        const singleUnit = await AllocatedUnit.findById(allocatedUnitId).select('shortCode name');
        if (!singleUnit) throw { statusCode: 404, message: 'Không tìm thấy đơn vị phân bổ được chỉ định.' };
        if (!singleUnit.shortCode) throw { statusCode: 400, message: `Đơn vị "${singleUnit.name}" không có mã viết tắt.` };
        unitsToQuery.push(singleUnit);
    } else {
        unitsToQuery = await AllocatedUnit.find({ shortCode: { $exists: true, $ne: null, $ne: '' } }).select('shortCode name');
        if (unitsToQuery.length === 0) {
            logger.info('[Prepare Standardization] Không có đơn vị nào có mã viết tắt để chuẩn bị.');
            return [];
        }
    }

    const Model = projectTypeString === 'category' ? CategoryProject : (projectTypeString === 'minor_repair' ? MinorRepairProject : null);
    if (!Model) throw { statusCode: 400, message: 'Loại công trình không hợp lệ.' };

    const allProjectsToReview = [];

    for (const currentUnit of unitsToQuery) {
        const unitShortCode = currentUnit.shortCode;
        const unitName = currentUnit.name;

        let waveShortCodeForFiltering = '00';
        let allocationWaveNameForQuery = null;
        if (projectTypeString === 'category' && allocationWaveId) {
            if (mongoose.Types.ObjectId.isValid(allocationWaveId)) {
                const wave = await AllocationWave.findById(allocationWaveId).select('shortCode name');
                if (wave) {
                    if (wave.shortCode) waveShortCodeForFiltering = wave.shortCode;
                    allocationWaveNameForQuery = wave.name;
                } else {
                    logger.warn(`[Prepare Standardization Unit: ${unitName}] Đợt phân bổ ID "${allocationWaveId}" không tìm thấy.`);
                }
            }
        }

        const query = {
            allocatedUnit: unitName,
        };
        if (financialYear && String(financialYear).trim() !== '') {
            query.financialYear = parseInt(financialYear, 10);
        }
        if (projectTypeString === 'category') {
            if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && allocationWaveNameForQuery) {
                query.allocationWave = allocationWaveNameForQuery;
            }
        }

        const projectsInUnitScope = await Model.find(query)
            .select('_id name projectCode createdAt financialYear allocatedUnit' + (projectTypeString === 'category' ? ' allocationWave projectType' : ''))
            .sort({ createdAt: 1 });

        let firstNonPerfectIndexInUnit = -1;
        for (let i = 0; i < projectsInUnitScope.length; i++) {
            const project = projectsInUnitScope[i];
            const expectedSequenceNumber = i + 1;
            let currentProjectWaveShortCodeForExpected = '00';

            if (projectTypeString === 'category') {
                if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && waveShortCodeForFiltering !== '00') {
                    currentProjectWaveShortCodeForExpected = waveShortCodeForFiltering;
                } else if (project.allocationWave) {
                    const projectWaveDoc = await AllocationWave.findOne({ name: project.allocationWave }).select('shortCode');
                    if (projectWaveDoc && projectWaveDoc.shortCode) {
                        currentProjectWaveShortCodeForExpected = projectWaveDoc.shortCode;
                    }
                }
            }

            const expectedCode = await generateStandardizedCodeInternal(
                projectTypeString,
                project.financialYear,
                unitShortCode,
                currentProjectWaveShortCodeForExpected,
                expectedSequenceNumber
            );

            if (project.projectCode !== expectedCode) {
                if (firstNonPerfectIndexInUnit === -1) {
                    firstNonPerfectIndexInUnit = i;
                }
            }
        }

        if (firstNonPerfectIndexInUnit !== -1) {
            for (let i = firstNonPerfectIndexInUnit; i < projectsInUnitScope.length; i++) {
                const project = projectsInUnitScope[i];
                allProjectsToReview.push({
                    _id: project._id,
                    name: project.name,
                    currentProjectCode: project.projectCode,
                    createdAt: project.createdAt,
                    allocatedUnitName: unitName,
                });
            }
        }
    }

    allProjectsToReview.sort((a, b) => {
        if (a.allocatedUnitName < b.allocatedUnitName) return -1;
        if (a.allocatedUnitName > b.allocatedUnitName) return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return allProjectsToReview;
};

const executeStandardization = async (bodyParams, userPerformingAction) => {
    const { financialYear, projectType: projectTypeString, allocatedUnitId, allocationWaveId } = bodyParams;

    if (!projectTypeString) {
        throw { statusCode: 400, message: 'Loại công trình là bắt buộc để chuẩn hóa.' };
    }

    const Model = projectTypeString === 'category' ? CategoryProject : (projectTypeString === 'minor_repair' ? MinorRepairProject : null);
    if (!Model) throw { statusCode: 400, message: 'Loại công trình không hợp lệ.' };

    let unitsToProcess = [];
    if (allocatedUnitId) {
        if (!mongoose.Types.ObjectId.isValid(allocatedUnitId)) {
            throw { statusCode: 400, message: 'ID Đơn vị phân bổ không hợp lệ.' };
        }
        const singleUnit = await AllocatedUnit.findById(allocatedUnitId).select('shortCode name');
        if (!singleUnit) {
            throw { statusCode: 404, message: 'Không tìm thấy đơn vị phân bổ được chỉ định.' };
        }
        if (!singleUnit.shortCode) {
             throw { statusCode: 400, message: `Đơn vị "${singleUnit.name}" không có mã viết tắt, không thể chuẩn hóa.` };
        }
        unitsToProcess.push(singleUnit);
    } else {
        unitsToProcess = await AllocatedUnit.find({ shortCode: { $exists: true, $ne: null, $ne: '' } }).select('shortCode name');
        if (unitsToProcess.length === 0) {
            logger.info('[Standardize Execute] Không tìm thấy đơn vị nào có mã viết tắt để chuẩn hóa.');
            return { message: 'Không có đơn vị nào hợp lệ để chuẩn hóa.', updatedCount: 0 };
        }
        logger.info(`[Standardize Execute] Sẽ chuẩn hóa cho ${unitsToProcess.length} đơn vị.`);
    }

    let totalUpdatedCount = 0;
    const errors = [];

    for (const currentAllocatedUnit of unitsToProcess) {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const unitShortCode = currentAllocatedUnit.shortCode;
                const unitName = currentAllocatedUnit.name;
                let currentUnitUpdatedCount = 0;

                let filterWaveShortCode = '00';
                let allocationWaveNameForQuery = null;
                if (projectTypeString === 'category' && allocationWaveId) {
                    if (mongoose.Types.ObjectId.isValid(allocationWaveId)) {
                        const wave = await AllocationWave.findById(allocationWaveId).session(session).select('shortCode name');
                        if (wave) {
                            if (wave.shortCode) filterWaveShortCode = wave.shortCode;
                            allocationWaveNameForQuery = wave.name;
                        } else {
                            logger.warn(`[Standardize Execute Unit: ${unitName}] Đợt phân bổ ID "${allocationWaveId}" không tìm thấy. Sẽ không lọc theo đợt này cho đơn vị ${unitName}.`);
                        }
                    }
                }

                const query = {
                    allocatedUnit: unitName,
                };
                if (financialYear && String(financialYear).trim() !== '') {
                    query.financialYear = parseInt(financialYear, 10);
                }
                if (projectTypeString === 'category') {
                    if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && allocationWaveNameForQuery) {
                         query.allocationWave = allocationWaveNameForQuery;
                    }
                }

                const projectsInScope = await Model.find(query)
                    .select('_id name projectCode createdAt history financialYear allocationWave')
                    .sort({ createdAt: 1 })
                    .session(session);

                if (projectsInScope.length === 0) {
                    logger.info(`[Standardize Execute Unit: ${unitName}] Không có công trình nào trong scope để chuẩn hóa.`);
                    return; 
                }

                const bulkOps = [];
                for (let i = 0; i < projectsInScope.length; i++) {
                    const project = projectsInScope[i];
                    const newSequenceNumber = i + 1;

                    let newProjectWaveShortCode = '00';
                    if (projectTypeString === 'category') {
                        if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && filterWaveShortCode !== '00') {
                            newProjectWaveShortCode = filterWaveShortCode;
                        } else if (project.allocationWave) {
                            const projectWaveDoc = await AllocationWave.findOne({ name: project.allocationWave }).session(session).select('shortCode');
                            if (projectWaveDoc && projectWaveDoc.shortCode) {
                                newProjectWaveShortCode = projectWaveDoc.shortCode;
                            }
                        }
                    }

                    const newStandardCode = await generateStandardizedCodeInternal(
                        projectTypeString,
                        project.financialYear,
                        unitShortCode,
                        newProjectWaveShortCode,
                        newSequenceNumber
                    );

                    if (project.projectCode !== newStandardCode) {
                        const oldCode = project.projectCode;
                        const historyEntry = {
                            action: 'code_standardized',
                            user: userPerformingAction.id,
                            timestamp: new Date(),
                            details: {
                                note: `Mã CT chuẩn hóa từ ${oldCode || 'chưa có'} thành ${newStandardCode} cho đơn vị ${unitName}.`,
                                changes: [{ field: 'projectCode', oldValue: oldCode, newValue: newStandardCode }]
                            }
                        };
                        bulkOps.push({
                            updateOne: {
                                filter: { _id: project._id },
                                update: {
                                    $set: { projectCode: newStandardCode },
                                    $push: { history: historyEntry }
                                }
                            }
                        });
                        currentUnitUpdatedCount++;
                    }
                }

                if (bulkOps.length > 0) {
                    await Model.bulkWrite(bulkOps, { session });
                    logger.info(`[Standardize Execute Unit: ${unitName}] Đã cập nhật mã cho ${currentUnitUpdatedCount} công trình.`);

                    // Chỉ cập nhật ProjectCodeCounter nếu không lọc theo một đợt cụ thể
                    if (!allocationWaveId || !mongoose.Types.ObjectId.isValid(allocationWaveId) || !allocationWaveNameForQuery) {
                        // Xác định năm tài chính hiệu lực cho bộ đếm
                        // Ưu tiên financialYear từ request, nếu không có thì lấy từ công trình đầu tiên trong scope
                        const effectiveYearForCounter = (financialYear && String(financialYear).trim() !== '')
                            ? parseInt(financialYear, 10)
                            : (projectsInScope.length > 0 ? projectsInScope[0].financialYear : null);

                        if (!effectiveYearForCounter) {
                             logger.error(`[Standardize Execute Unit: ${unitName}] Không thể xác định năm tài chính để cập nhật bộ đếm.`);
                        } else {
                            const counterQueryForUpdate = {
                                year: effectiveYearForCounter,
                                type: projectTypeString,
                                unitShortCode: unitShortCode,
                                // Không bao gồm allocationWaveShortCode vì bộ đếm hiện tại là chung
                            };
                            const maxSequenceNumberInScope = projectsInScope.length;

                            await ProjectCodeCounter.findOneAndUpdate(
                                counterQueryForUpdate,
                                { currentSerial: maxSequenceNumberInScope },
                                { upsert: true, new: true, session }
                            );
                            logger.info(`[Standardize Execute Unit: ${unitName}] Đã đồng bộ ProjectCodeCounter cho ${JSON.stringify(counterQueryForUpdate)} thành currentSerial: ${maxSequenceNumberInScope}.`);
                        }
                    } else {
                         logger.info(`[Standardize Execute Unit: ${unitName}] Chuẩn hóa cho đợt cụ thể "${allocationWaveNameForQuery}". Bỏ qua cập nhật ProjectCodeCounter (vì nó là bộ đếm chung).`);
                    }
                }
                totalUpdatedCount += currentUnitUpdatedCount;
            }); 
        } catch (error) {
            logger.error(`[Standardize Execute Unit: ${currentAllocatedUnit.name}] Lỗi trong quá trình chuẩn hóa: ${error.message}`, { stack: error.stack });
            errors.push({ unitName: currentAllocatedUnit.name, error: error.message });
        } finally {
            if (session.inTransaction()) {
                await session.abortTransaction();
                logger.warn(`[Standardize Execute Unit: ${currentAllocatedUnit.name}] Transaction aborted.`);
            }
            session.endSession();
        }
    } 

    if (errors.length > 0) {
        const errorMessages = errors.map(e => `Đơn vị ${e.unitName}: ${e.error}`).join('; ');
        // Ném lỗi để controller có thể bắt và trả về status code phù hợp
        throw { statusCode: 500, message: `Hoàn tất chuẩn hóa với một số lỗi. Tổng cộng ${totalUpdatedCount} mã được cập nhật. Lỗi: ${errorMessages}`, updatedCount: totalUpdatedCount, errors };
    }

    return { message: `Đã chuẩn hóa thành công ${totalUpdatedCount} mã công trình trên ${unitsToProcess.length} đơn vị.`, updatedCount: totalUpdatedCount };
};

module.exports = {
    prepareStandardizationScope,
    executeStandardization,
};