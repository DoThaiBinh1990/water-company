// d:\CODE\water-company\backend\server\controllers\projects\project.standardize.controller.js
const standardizeService = require('../../services/project.standardize.service');
const logger = require('../../config/logger');

exports.prepareStandardization = async (req, res, next) => {
    try {
        // Query params: financialYear, projectType, allocatedUnitId, allocationWaveId (optional)
        const projectsToReview = await standardizeService.prepareStandardizationScope(req.query);
        res.json(projectsToReview);
    } catch (error) {
        logger.error("Lỗi Controller chuẩn bị chuẩn hóa mã:", { path: req.path, method: req.method, query: req.query, message: error.message, stack: error.stack, statusCode: error.statusCode });
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        next(error);
    }
};

exports.executeStandardization = async (req, res, next) => {
    try {
        // Body: { financialYear, projectType, allocatedUnitId, allocationWaveId (optional) }
        const result = await standardizeService.executeStandardization(req.body, req.user);
        res.json(result);
    } catch (error) {
        logger.error("Lỗi Controller thực thi chuẩn hóa mã:", { path: req.path, method: req.method, body: req.body, message: error.message, stack: error.stack, statusCode: error.statusCode });
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        next(error);
    }
};
