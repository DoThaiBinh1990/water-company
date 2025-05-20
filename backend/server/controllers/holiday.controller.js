// d:\CODE\water-company\backend\server\controllers\holiday.controller.js
const holidayService = require('../services/holiday.service'); // Sẽ tạo file này
const logger = require('../config/logger');

exports.createOrUpdateHolidays = async (req, res, next) => {
    try {
        const { year, holidays } = req.body; // holidays là một mảng các { date: 'YYYY-MM-DD', description: '...' }
        if (!year || !Array.isArray(holidays)) {
            return res.status(400).json({ message: 'Năm và danh sách ngày nghỉ là bắt buộc.' });
        }
        const result = await holidayService.createOrUpdateHolidaysForYear(year, holidays, req.user);
        res.status(200).json(result);
    } catch (error) {
        logger.error("Lỗi Controller tạo/cập nhật ngày nghỉ:", { error: error.message, stack: error.stack });
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
