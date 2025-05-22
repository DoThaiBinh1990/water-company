// d:\CODE\water-company\backend\server\services\holiday.service.js
const { Holiday } = require('../models');
const logger = require('../config/logger');
/**
 * Adds a new holiday to a specific year.
 * @param {number} year - The year to add the holiday to.
 * @param {object} holidayData - Object containing { date: 'YYYY-MM-DD' or Date object, description: '...' }.
 * @param {object} user - The authenticated user performing the action.
 * @returns {Promise<object>} The updated holiday document for the year.
 */
const addHolidayToYear = async (year, holidayData, user) => {
    if (!user || user.role !== 'admin') {
        throw { statusCode: 403, message: 'Không có quyền thực hiện thao tác này.' };
    }
    const parsedYear = parseInt(year, 10);

    // Log dữ liệu nhận được ở đầu service
    // logger.info(`[addHolidayToYear Service] Received year: ${year}, holidayData: ${JSON.stringify(holidayData)}`);

    // Joi ở controller đã validate định dạng date và sự tồn tại của description.
    // Service chỉ cần kiểm tra sự tồn tại của holidayData và date.
    if (isNaN(parsedYear) || !holidayData || !holidayData.date || !holidayData.description) {
        // logger.error(`[addHolidayToYear Service] Validation failed. ParsedYear: ${parsedYear}, holidayData: ${JSON.stringify(holidayData)}`);
        throw { statusCode: 400, message: 'Dữ liệu đầu vào cho ngày nghỉ không hợp lệ (Service Level).' };
    }

    // Chuẩn hóa holidayData.date thành chuỗi YYYY-MM-DD để so sánh và lưu trữ
    let dateStringForComparisonAndStorage;
    if (holidayData.date instanceof Date) {
        dateStringForComparisonAndStorage = holidayData.date.toISOString().split('T')[0];
    } else if (typeof holidayData.date === 'string') {
        // Nếu là chuỗi, cố gắng lấy phần YYYY-MM-DD (phòng trường hợp Joi trả về ISO string đầy đủ)
        dateStringForComparisonAndStorage = holidayData.date.split('T')[0];
        // Kiểm tra lại định dạng sau khi split
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStringForComparisonAndStorage)) {
            // logger.error(`[addHolidayToYear Service] Invalid date string after processing: ${dateStringForComparisonAndStorage}`);
            throw { statusCode: 400, message: 'Định dạng ngày nghỉ không hợp lệ sau khi xử lý.' };
        }
    } else {
        // logger.error(`[addHolidayToYear Service] holidayData.date is not a Date object or string: ${typeof holidayData.date}`);
        throw { statusCode: 400, message: 'Kiểu dữ liệu ngày nghỉ không hợp lệ.' };
    }

    const parts = dateStringForComparisonAndStorage.split('-');
    const newHolidayDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));

    if (isNaN(newHolidayDate.getTime())) {
        // logger.error(`[addHolidayToYear Service] Failed to parse date string into valid Date object: ${dateStringForComparisonAndStorage}`);
        throw { statusCode: 400, message: 'Ngày nghỉ không hợp lệ.' };
    }

    const dayOfWeek = newHolidayDate.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        // logger.warn(`Attempting to add a weekend as a holiday: ${dateStringForComparisonAndStorage}`);
        // Frontend nên xử lý cảnh báo này. Backend có thể cho phép nếu frontend đã xác nhận.
    }

    const newHolidayEntry = {
        date: newHolidayDate, // Lưu trữ là Date object (UTC midnight)
        description: holidayData.description.trim()
    };

    let holidayDoc = await Holiday.findOne({ year: parsedYear });

    if (holidayDoc) {
        const existingHolidayIndex = holidayDoc.holidays.findIndex(h =>
            new Date(h.date).toISOString().split('T')[0] === dateStringForComparisonAndStorage
        );

        if (existingHolidayIndex > -1) {
            throw { statusCode: 409, message: `Ngày nghỉ ${dateStringForComparisonAndStorage} đã tồn tại cho năm ${parsedYear}.` };
        }
        holidayDoc.holidays.push(newHolidayEntry);
        holidayDoc.holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
        holidayDoc.lastUpdatedBy = user.id;
    } else {
        holidayDoc = new Holiday({
            year: parsedYear,
            holidays: [newHolidayEntry],
            createdBy: user.id,
            lastUpdatedBy: user.id,
        });
    }
    await holidayDoc.save();
    logger.info(`Đã thêm ngày nghỉ ${dateStringForComparisonAndStorage} cho năm ${parsedYear} bởi ${user.username}`);
    const plainHolidayDoc = holidayDoc.toObject();
    // Đảm bảo date trả về cho client là Date object hoặc chuỗi ISO tùy theo nhu cầu của client
    plainHolidayDoc.holidays = plainHolidayDoc.holidays.map(h => ({ ...h, date: new Date(h.date) }));
    return plainHolidayDoc;
};

/**
 * Updates the description of a specific holiday in a year.
 * @param {number} year - The year of the holiday.
 * @param {string} dateString - The date of the holiday to update ('YYYY-MM-DD').
 * @param {string} newDescription - The new description for the holiday.
 * @param {object} user - The authenticated user.
 * @returns {Promise<object>} The updated holiday document for the year.
 */
const updateHolidayInYear = async (year, dateString, newDescription, user) => {
    if (!user || user.role !== 'admin') {
        throw { statusCode: 403, message: 'Không có quyền thực hiện thao tác này.' };
    }
    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear) || !dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !newDescription || newDescription.trim() === "") {
        throw { statusCode: 400, message: 'Năm, ngày hoặc mô tả không hợp lệ.' };
    }

    const holidayDoc = await Holiday.findOne({ year: parsedYear });
    if (!holidayDoc) {
        throw { statusCode: 404, message: `Không tìm thấy dữ liệu ngày nghỉ cho năm ${parsedYear}.` };
    }

    const holidayIndex = holidayDoc.holidays.findIndex(h => new Date(h.date).toISOString().split('T')[0] === dateString);
    if (holidayIndex === -1) {
        throw { statusCode: 404, message: `Không tìm thấy ngày nghỉ ${dateString} trong năm ${parsedYear}.` };
    }

    holidayDoc.holidays[holidayIndex].description = newDescription.trim();
    holidayDoc.lastUpdatedBy = user.id;
    await holidayDoc.save();
    logger.info(`Đã cập nhật mô tả cho ngày nghỉ ${dateString} năm ${parsedYear} bởi ${user.username}`);
    const plainHolidayDoc = holidayDoc.toObject();
    plainHolidayDoc.holidays = plainHolidayDoc.holidays.map(h => ({ ...h, date: new Date(h.date) }));
    return plainHolidayDoc;
};

const getHolidays = async (year) => {
    const parsedYear = parseInt(year, 10);
     if (isNaN(parsedYear)) {
        logger.error(`[getHolidays] Invalid year provided: ${year}`);
        throw { statusCode: 400, message: 'Năm không hợp lệ.' };
    }
    // logger.info(`[getHolidays] Attempting to fetch holidays for year: ${parsedYear}`);
    const holidayDoc = await Holiday.findOne({ year: parsedYear })
                                    .populate('createdBy', 'username fullName')
                                    .populate('lastUpdatedBy', 'username fullName');
    if (holidayDoc) {
        // logger.info(`[getHolidays] Found holiday document for year ${parsedYear}. Holidays count: ${holidayDoc.holidays.length}`);
        const plainHolidayDoc = holidayDoc.toObject();
        plainHolidayDoc.holidays = plainHolidayDoc.holidays.map(h_item => {
            if (!h_item || !h_item.date) {
                logger.warn(`[getHolidays] Invalid holiday item or missing date in holidayDoc for year ${parsedYear}:`, h_item);
                return null;
            }
            const dateObj = new Date(h_item.date);
            if (isNaN(dateObj.getTime())) {
                logger.warn(`[getHolidays] Invalid date value in holidayDoc for year ${parsedYear}, date: ${h_item.date}. Original item:`, h_item);
                return null;
            }
            return { ...h_item, date: dateObj };
        }).filter(h_item => h_item !== null);
        return plainHolidayDoc;
    } else {
        // logger.info(`[getHolidays] No holiday document found for year ${parsedYear}. Returning empty list.`);
    }
    return { year: parsedYear, holidays: [] };
};

const removeHolidayDate = async (year, dateString, user) => {
    if (!user || user.role !== 'admin') {
        throw { statusCode: 403, message: 'Không có quyền thực hiện thao tác này.' };
    }
    const parsedYear = parseInt(year, 10);
    // dateString từ params đã được validate ở controller là YYYY-MM-DD
    // Chuyển nó thành Date object UTC để so sánh
    const parts = dateString.split('-');
    const targetDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));


    if (isNaN(parsedYear) || isNaN(targetDate.getTime())) {
        throw { statusCode: 400, message: 'Năm hoặc ngày không hợp lệ.' };
    }

    const holidayDoc = await Holiday.findOne({ year: parsedYear });
    if (!holidayDoc) {
        throw { statusCode: 404, message: `Không tìm thấy dữ liệu ngày nghỉ cho năm ${parsedYear}.` };
    }

    const initialLength = holidayDoc.holidays.length;
    holidayDoc.holidays = holidayDoc.holidays.filter(h => {
        const holidayDate = new Date(h.date); // h.date từ DB là Date object (UTC)
        return !(holidayDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
                 holidayDate.getUTCMonth() === targetDate.getUTCMonth() &&
                 holidayDate.getUTCDate() === targetDate.getUTCDate());
    });

    if (holidayDoc.holidays.length < initialLength) {
        holidayDoc.lastUpdatedBy = user.id;
        await holidayDoc.save();
        logger.info(`Ngày nghỉ ${dateString} cho năm ${parsedYear} đã được xóa bởi ${user.username}`);
        const updatedHolidayDoc = holidayDoc.toObject();
        updatedHolidayDoc.holidays = updatedHolidayDoc.holidays.map(h => ({ ...h, date: new Date(h.date) }));
        return { message: `Ngày nghỉ ${dateString} đã được xóa.`, holidays: updatedHolidayDoc };
    } else {
        const currentHolidayDoc = holidayDoc.toObject();
        currentHolidayDoc.holidays = currentHolidayDoc.holidays.map(h => ({ ...h, date: new Date(h.date) }));
        return { message: `Không tìm thấy ngày nghỉ ${dateString} để xóa trong năm ${parsedYear}.`, holidays: currentHolidayDoc };
    }
};


module.exports = {
    addHolidayToYear,
    updateHolidayInYear,
    getHolidays,
    removeHolidayDate,
};
