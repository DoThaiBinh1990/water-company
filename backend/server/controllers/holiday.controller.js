// d:\CODE\water-company\backend\server\controllers\holiday.controller.js
const holidayService = require('../services/holiday.service'); // Sẽ tạo file này
const logger = require('../config/logger');
const Joi = require('joi');

const addHolidaySchema = Joi.object({
    year: Joi.number().integer().min(2000).max(2100).required(),
    date: Joi.string().isoDate().required().messages({ // YYYY-MM-DD
        'string.isoDate': 'Ngày nghỉ phải có định dạng YYYY-MM-DD.',
        'any.required': 'Ngày nghỉ là bắt buộc.'
    }),
    description: Joi.string().trim().min(1).required().messages({
        'string.empty': 'Mô tả không được để trống.',
        'any.required': 'Mô tả là bắt buộc.'
    })
});

exports.addHoliday = async (req, res, next) => {
    try {
        // Log quan trọng để xem chính xác backend nhận được gì
        logger.info(`[addHoliday Controller] Received req.body: ${JSON.stringify(req.body)}, Type of req.body.year: ${typeof req.body.year}`);
        const { error, value } = addHolidaySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }
        const { year, date, description } = value;
        const result = await holidayService.addHolidayToYear(year, { date, description }, req.user);
        res.status(200).json(result);
    } catch (error) {
        logger.error("Lỗi Controller tạo/cập nhật ngày nghỉ:", { error: error.message, stack: error.stack });
        next(error);
    }
};

const updateHolidaySchema = Joi.object({
    description: Joi.string().trim().min(1).required().messages({
        'string.empty': 'Mô tả không được để trống.',
        'any.required': 'Mô tả là bắt buộc.'
    })
});

exports.updateHoliday = async (req, res, next) => {
    try {
        const { error, value } = updateHolidaySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }
        const { year, dateString } = req.params;
        const result = await holidayService.updateHolidayInYear(parseInt(year, 10), dateString, value.description, req.user);
        res.status(200).json(result);
    } catch (error) {
        logger.error("Lỗi Controller cập nhật ngày nghỉ:", { error: error.message, stack: error.stack });
        next(error);
    }
};

exports.getHolidaysByYear = async (req, res, next) => {
    try {
        const year = parseInt(req.params.year, 10);
        if (isNaN(year)) {
            return res.status(400).json({ message: 'Năm không hợp lệ.' });
        }
        const result = await holidayService.getHolidays(year);
        res.status(200).json(result);
    } catch (error) {
        logger.error("Lỗi Controller lấy ngày nghỉ:", { error: error.message, stack: error.stack });
        next(error);
    }
};

exports.deleteHolidayDate = async (req, res, next) => {
    try {
        const year = parseInt(req.params.year, 10);
        const dateString = req.params.dateString; // YYYY-MM-DD
         if (isNaN(year) || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return res.status(400).json({ message: 'Năm hoặc ngày không hợp lệ.' });
        }
        const result = await holidayService.removeHolidayDate(year, dateString, req.user);
        res.status(200).json(result);
    } catch (error) {
        logger.error("Lỗi Controller xóa ngày nghỉ:", { error: error.message, stack: error.stack });
        next(error);
    }
};
