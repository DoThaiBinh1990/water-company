// d:\CODE\water-company\backend\server\routes\holidayRoutes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware');
const holidayController = require('../controllers/holiday.controller'); // Sẽ tạo file này

// Chỉ admin mới có quyền quản lý ngày nghỉ
router.use(authenticate, (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Chỉ admin mới có quyền truy cập chức năng này.' });
    }
    next();
});

router.post('/', holidayController.createOrUpdateHolidays); // Tạo hoặc cập nhật ngày nghỉ cho một năm
router.get('/:year', holidayController.getHolidaysByYear);
router.delete('/:year/date/:dateString', holidayController.deleteHolidayDate); // Xóa một ngày nghỉ cụ thể trong năm

module.exports = router;
