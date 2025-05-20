// d:\CODE\water-company\backend\server\services\holiday.service.js
const { Holiday } = require('../models');
const logger = require('../config/logger');

const createOrUpdateHolidaysForYear = async (year, holidaysData, user) => {
    if (!user || user.role !== 'admin') {
        throw { statusCode: 403, message: 'Không có quyền thực hiện thao tác này.' };
    }
    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear)) {
        throw { statusCode: 400, message: 'Năm không hợp lệ.' };
    }

    const validHolidays = holidaysData
        .filter(h => h.date && /^\d{4}-\d{2}-\d{2}$/.test(h.date)) // Validate date format
        .map(h => ({
            date: new Date(h.date + "T00:00:00.000Z"), // Đảm bảo lưu trữ là UTC date
            description: h.description || `Ngày nghỉ ${h.date}`
        }));

    let holidayDoc = await Holiday.findOne({ year: parsedYear });

    if (holidayDoc) {
        // Cập nhật: có thể chọn ghi đè hoàn toàn hoặc merge
        // Hiện tại, chúng ta sẽ ghi đè hoàn toàn danh sách ngày nghỉ cho năm đó
        holidayDoc.holidays = validHolidays;
        holidayDoc.lastUpdatedBy = user.id;
    } else {
        holidayDoc = new Holiday({
            year: parsedYear,
            holidays: validHolidays,
            createdBy: user.id,
            lastUpdatedBy: user.id,
        });
    }
    await holidayDoc.save();
    logger.info(`Ngày nghỉ cho năm ${parsedYear} đã được cập nhật bởi ${user.username}`);
    return holidayDoc;
};

const getHolidays = async (year) => {
    const parsedYear = parseInt(year, 10);
     if (isNaN(parsedYear)) {
        logger.error(`[getHolidays] Invalid year provided: ${year}`);
        throw { statusCode: 400, message: 'Năm không hợp lệ.' };
    }
    logger.info(`[getHolidays] Attempting to fetch holidays for year: ${parsedYear}`);
    const holidayDoc = await Holiday.findOne({ year: parsedYear })
                                    .populate('createdBy', 'username fullName')
                                    .populate('lastUpdatedBy', 'username fullName');
    if (holidayDoc) {
        logger.info(`[getHolidays] Found holiday document for year ${parsedYear}. Holidays count: ${holidayDoc.holidays.length}`);
        // Đảm bảo date là Date object khi trả về
        const plainHolidayDoc = holidayDoc.toObject(); // Chuyển Mongoose document thành plain object
        plainHolidayDoc.holidays = plainHolidayDoc.holidays.map(h_item => {
            if (!h_item || !h_item.date) {
                logger.warn(`[getHolidays] Invalid holiday item or missing date in holidayDoc for year ${parsedYear}:`, h_item);
                return null; // Sẽ được lọc ra sau
            }
            const dateObj = new Date(h_item.date);
            if (isNaN(dateObj.getTime())) {
                logger.warn(`[getHolidays] Invalid date value in holidayDoc for year ${parsedYear}, date: ${h_item.date}. Original item:`, h_item);
                return null; // Sẽ được lọc ra sau
            }
            return { ...h_item, date: dateObj }; // Giữ date là Date object, JSON.stringify sẽ chuyển thành ISO
        }).filter(h_item => h_item !== null); // Lọc bỏ các item không hợp lệ
        return plainHolidayDoc;
    } else {
        logger.info(`[getHolidays] No holiday document found for year ${parsedYear}. Returning empty list.`);
    }
    return { year: parsedYear, holidays: [] }; // Luôn trả về cấu trúc này
};

const removeHolidayDate = async (year, dateString, user) => {
    if (!user || user.role !== 'admin') {
        throw { statusCode: 403, message: 'Không có quyền thực hiện thao tác này.' };
    }
    const parsedYear = parseInt(year, 10);
    const targetDate = new Date(dateString + "T00:00:00.000Z"); // So sánh với UTC date

    if (isNaN(parsedYear) || isNaN(targetDate.getTime())) {
        throw { statusCode: 400, message: 'Năm hoặc ngày không hợp lệ.' };
    }

    const holidayDoc = await Holiday.findOne({ year: parsedYear });
    if (!holidayDoc) {
        throw { statusCode: 404, message: `Không tìm thấy dữ liệu ngày nghỉ cho năm ${parsedYear}.` };
    }

    const initialLength = holidayDoc.holidays.length;
    // Lọc ra các ngày nghỉ không phải là targetDate
    // Cần so sánh ngày mà không tính đến giờ, phút, giây
    holidayDoc.holidays = holidayDoc.holidays.filter(h => { // h.date từ DB là Date object (UTC)
        const holidayDate = new Date(h.date);
        return !(holidayDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
                 holidayDate.getUTCMonth() === targetDate.getUTCMonth() &&
                 holidayDate.getUTCDate() === targetDate.getUTCDate());
    });

    if (holidayDoc.holidays.length < initialLength) {
        holidayDoc.lastUpdatedBy = user.id;
        await holidayDoc.save();
        logger.info(`Ngày nghỉ ${dateString} cho năm ${parsedYear} đã được xóa bởi ${user.username}`);
        // Trả về holidayDoc đã được cập nhật, với date là Date object
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
    createOrUpdateHolidaysForYear,
    getHolidays,
    removeHolidayDate,
};
