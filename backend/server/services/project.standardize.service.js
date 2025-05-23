// d:\CODE\water-company\backend\server\services\project.standardize.service.js
const mongoose = require('mongoose');
const { CategoryProject, MinorRepairProject, AllocatedUnit, AllocationWave, ProjectType: ModelProjectType } = require('../models');
// const { generateProjectCode } = require('./helpers/projectCodeHelper'); // Không dùng trực tiếp ở đây nữa
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
        return `${typePrefix}${yearSuffix}${allocatedUnitShortCode}${dddFormatted}`; // Không bao gồm allocationWaveShortCode cho SCN
    } else { // Cho 'category'
        return `${typePrefix}${allocationWaveShortCode}${yearSuffix}${allocatedUnitShortCode}${dddFormatted}`;
    }
}


const prepareStandardizationScope = async (queryParams) => {
    const { financialYear, projectType: projectTypeString, allocatedUnitId, allocationWaveId } = queryParams;
    // Loại công trình và Đơn vị phân bổ cụ thể là bắt buộc cho logic chuẩn hóa này
    if (!projectTypeString || !allocatedUnitId) {
        throw { statusCode: 400, message: 'Loại công trình và Đơn vị phân bổ cụ thể là bắt buộc để chuẩn hóa.' };
    }
    if (!mongoose.Types.ObjectId.isValid(allocatedUnitId)) {
        throw { statusCode: 400, message: 'ID Đơn vị phân bổ không hợp lệ.' };
    }


    const Model = projectTypeString === 'category' ? CategoryProject : (projectTypeString === 'minor_repair' ? MinorRepairProject : null);
    if (!Model) throw { statusCode: 400, message: 'Loại công trình không hợp lệ.' };

    const allocatedUnit = await AllocatedUnit.findById(allocatedUnitId).select('shortCode name');
    if (!allocatedUnit || !allocatedUnit.shortCode) {
        throw { statusCode: 404, message: 'Không tìm thấy đơn vị phân bổ hoặc đơn vị không có mã viết tắt.' };
    }
    const unitShortCode = allocatedUnit.shortCode;

    let waveShortCode = '00';
    let allocationWaveName = null; // Dùng để query nếu allocationWaveId được cung cấp
    if (projectTypeString === 'category' && allocationWaveId) {
        if (mongoose.Types.ObjectId.isValid(allocationWaveId)) { // Chỉ xử lý nếu là ID hợp lệ
            const wave = await AllocationWave.findById(allocationWaveId).select('shortCode name');
            if (!wave) { // Nếu ID hợp lệ nhưng không tìm thấy đợt
                 logger.warn(`Đợt phân bổ với ID "${allocationWaveId}" không tìm thấy. Sẽ không lọc theo đợt này.`);
                 // waveShortCode vẫn là '00', allocationWaveName là null
            } else {
                if (wave.shortCode) {
                    waveShortCode = wave.shortCode;
                } else {
                    logger.warn(`Đợt phân bổ "${wave.name}" (ID: ${allocationWaveId}) không có mã shortCode. Sẽ sử dụng "00" cho mã công trình, nhưng vẫn lọc theo tên đợt.`);
                }
                allocationWaveName = wave.name; // Dùng để query
            }
        }
        // Nếu allocationWaveId là rỗng (Tất cả đợt), waveShortCode vẫn là '00' và allocationWaveName là null
    }

    const query = {
        allocatedUnit: allocatedUnit.name, // Luôn lọc theo đơn vị đã chọn
    };

    if (financialYear && String(financialYear).trim() !== '') { // Chỉ thêm nếu financialYear có giá trị
        query.financialYear = parseInt(financialYear, 10);
    }

    if (projectTypeString === 'category') {
        if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && allocationWaveName) {
            // Nếu một đợt cụ thể được chọn và tìm thấy
            query.allocationWave = allocationWaveName;
        } else if (!allocationWaveId || String(allocationWaveId).trim() === '') {
            // Nếu chọn "Tất cả đợt" (allocationWaveId rỗng), không thêm bộ lọc allocationWave
            // Điều này sẽ bao gồm cả công trình có đợt và không có đợt.
        }
        // Trường hợp allocationWaveId hợp lệ nhưng không tìm thấy wave đã được xử lý ở trên (không thêm vào query)
    }
    // MinorRepairProject không có allocationWave, nên không cần thêm điều kiện

    const projectsInScope = await Model.find(query)
        .select(
            '_id name projectCode createdAt financialYear allocatedUnit' +
            (projectTypeString === 'category' ? ' allocationWave projectType' : '') // Chỉ select allocationWave và projectType cho CategoryProject
        )
        .populate(
            projectTypeString === 'category' ? { path: 'projectType', select: 'name' } : undefined
        )
        .sort({ createdAt: 1 });



    let firstNonPerfectIndex = -1;
    const projectsToStandardizeResult = [];

    for (let i = 0; i < projectsInScope.length; i++) {
        const project = projectsInScope[i];
        const expectedSequenceNumber = i + 1;

        // Xác định waveShortCode cho mã kỳ vọng dựa trên đợt của công trình hiện tại (nếu có)
        // HOẶC waveShortCode từ bộ lọc nếu một đợt cụ thể được chọn
        let currentProjectWaveShortCode = '00';
        if (projectTypeString === 'category') {
            if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && waveShortCode !== '00') {
                // Nếu lọc theo một đợt cụ thể CÓ shortCode, dùng shortCode đó
                currentProjectWaveShortCode = waveShortCode;
            } else if (project.allocationWave) {
                // Nếu không lọc theo đợt cụ thể, hoặc đợt cụ thể không có shortCode,
                // thử lấy shortCode từ chính công trình đó (nếu nó thuộc một đợt có shortCode)
                const projectWaveDoc = await AllocationWave.findOne({ name: project.allocationWave }).select('shortCode');
                if (projectWaveDoc && projectWaveDoc.shortCode) {
                    currentProjectWaveShortCode = projectWaveDoc.shortCode;
                }
            }
        }


        const expectedCode = await generateStandardizedCodeInternal(
            projectTypeString,
            project.financialYear,
            unitShortCode, // Luôn là unitShortCode của đơn vị đã chọn
            currentProjectWaveShortCode,
            expectedSequenceNumber
        );

        if (project.projectCode !== expectedCode) {
            if (firstNonPerfectIndex === -1) {
                firstNonPerfectIndex = i;
            }
        }
        // Thêm tất cả công trình vào danh sách review, nhưng chỉ những cái từ firstNonPerfectIndex mới thực sự "cần chuẩn hóa"
        // Frontend sẽ quyết định hiển thị như thế nào, backend trả về những gì nó tìm thấy
        // Yêu cầu là "danh sách sẽ chỉ hiện 5 công trình chưa được chuẩn hoá đê người dùng thực hiện chuẩn hoá mã công trình."
        // Backend sẽ trả về tất cả những công trình có mã không khớp VÀ nằm sau chuỗi hoàn hảo đầu tiên.
    }

    if (firstNonPerfectIndex !== -1) {
        for (let i = firstNonPerfectIndex; i < projectsInScope.length; i++) {
            const project = projectsInScope[i];
            // Mã kỳ vọng ở đây không quan trọng bằng việc nó nằm trong danh sách cần chuẩn hóa
            projectsToStandardizeResult.push({
                _id: project._id,
                name: project.name,
                currentProjectCode: project.projectCode,
                createdAt: project.createdAt,
            });
        }
    }
    return projectsToStandardizeResult;
};

const executeStandardization = async (bodyParams, userPerformingAction) => {
    const { financialYear, projectType: projectTypeString, allocatedUnitId, allocationWaveId } = bodyParams;
    // Loại công trình và Đơn vị phân bổ cụ thể là bắt buộc
    if (!projectTypeString || !allocatedUnitId) {
        throw { statusCode: 400, message: 'Loại công trình và Đơn vị phân bổ cụ thể là bắt buộc để chuẩn hóa.' };
    }
    if (!mongoose.Types.ObjectId.isValid(allocatedUnitId)) {
        throw { statusCode: 400, message: 'ID Đơn vị phân bổ không hợp lệ.' };
    }

    const Model = projectTypeString === 'category' ? CategoryProject : (projectTypeString === 'minor_repair' ? MinorRepairProject : null);
    if (!Model) throw { statusCode: 400, message: 'Loại công trình không hợp lệ.' };

    const session = await mongoose.startSession();
    let updatedCount = 0;

    try {
        await session.withTransaction(async () => {
            const allocatedUnit = await AllocatedUnit.findById(allocatedUnitId).session(session).select('shortCode name');
            if (!allocatedUnit || !allocatedUnit.shortCode) {
                throw { statusCode: 404, message: 'Không tìm thấy đơn vị phân bổ hoặc đơn vị không có mã viết tắt.' };
            }
            const unitShortCode = allocatedUnit.shortCode;

            let filterWaveShortCode = '00'; // Dùng cho mã mới nếu lọc theo đợt cụ thể
            let allocationWaveNameForQuery = null; // Dùng để query
            if (projectTypeString === 'category' && allocationWaveId) {
                if (mongoose.Types.ObjectId.isValid(allocationWaveId)) {
                    const wave = await AllocationWave.findById(allocationWaveId).session(session).select('shortCode name');
                    if (wave) { // Chỉ xử lý nếu tìm thấy đợt
                        if (wave.shortCode) filterWaveShortCode = wave.shortCode;
                        allocationWaveNameForQuery = wave.name;
                    } else {
                        logger.warn(`Đợt phân bổ với ID "${allocationWaveId}" không tìm thấy khi thực thi chuẩn hóa. Sẽ không lọc theo đợt này.`);
                    }
                }
            }

            const query = {
                allocatedUnit: allocatedUnit.name,
            };
            if (financialYear && String(financialYear).trim() !== '') {
                query.financialYear = parseInt(financialYear, 10);
            }
            if (projectTypeString === 'category') {
                if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && allocationWaveNameForQuery) {
                     query.allocationWave = allocationWaveNameForQuery;
                }
                // Nếu "Tất cả đợt", không lọc theo allocationWave
            }

            const projectsInScope = await Model.find(query)
                .select('_id name projectCode createdAt history financialYear allocationWave') // Thêm allocationWave để xác định mã
                .sort({ createdAt: 1 })
                .session(session);

            let firstNonPerfectIndex = -1;
            for (let i = 0; i < projectsInScope.length; i++) {
                const project = projectsInScope[i];
                const expectedSequenceNumber = i + 1;

                let currentProjectWaveShortCodeForExpected = '00';
                 if (projectTypeString === 'category') {
                    if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && filterWaveShortCode !== '00') {
                        currentProjectWaveShortCodeForExpected = filterWaveShortCode;
                    } else if (project.allocationWave) {
                        const projectWaveDoc = await AllocationWave.findOne({ name: project.allocationWave }).session(session).select('shortCode');
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
                    firstNonPerfectIndex = i;
                    break;
                }
            }

            if (firstNonPerfectIndex === -1 && projectsInScope.length > 0) {
                return; // Tất cả đã hoàn hảo
            }
            if (projectsInScope.length === 0) return; // Không có gì để làm

            const bulkOps = [];
            for (let i = firstNonPerfectIndex; i < projectsInScope.length; i++) {
                const project = projectsInScope[i];
                const newSequenceNumber = i + 1;

                let newProjectWaveShortCode = '00';
                 if (projectTypeString === 'category') {
                    if (allocationWaveId && mongoose.Types.ObjectId.isValid(allocationWaveId) && filterWaveShortCode !== '00') {
                        // Nếu đang chuẩn hóa theo một đợt cụ thể CÓ shortCode, mã mới sẽ dùng shortCode đó
                        newProjectWaveShortCode = filterWaveShortCode;
                    } else if (project.allocationWave) {
                        // Nếu không, mã mới sẽ dựa trên đợt hiện tại của công trình (nếu có shortCode)
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
                    // project.projectCode = newStandardCode; // Sẽ set trong bulkOps
                    const historyEntry = {
                        action: 'code_standardized',
                        user: userPerformingAction.id,
                        timestamp: new Date(),
                        details: {
                            note: `Mã công trình được chuẩn hóa từ ${oldCode || 'chưa có'} thành ${newStandardCode}.`,
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
                    updatedCount++;
                }
            }
            if (bulkOps.length > 0) {
                await Model.bulkWrite(bulkOps, { session });
            }
        });
    } catch (error) {
        logger.error('Lỗi trong quá trình thực thi chuẩn hóa mã:', error);
        throw error;
    } finally {
        if (session.inTransaction()) {
            await session.abortTransaction();
            logger.warn('Transaction aborted due to an error or incomplete execution in executeStandardization.');
        }
        session.endSession();
    }
    return { message: `Đã chuẩn hóa thành công ${updatedCount} mã công trình.`, updatedCount };
};

module.exports = {
    prepareStandardizationScope,
    executeStandardization,
};
