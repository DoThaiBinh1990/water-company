const winston = require('winston');
require('winston-daily-rotate-file');
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs'); // Thư mục logs sẽ nằm trong server/logs

// Tạo thư mục logs nếu chưa tồn tại
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
  filename: `${logDir}/application-%DATE%.log`, // Tên file log, %DATE% sẽ được thay thế
  datePattern: 'YYYY-MM-DD',                 // Xoay vòng log mỗi ngày
  zippedArchive: true,                       // Nén file log cũ thành file .gz
  maxSize: '20m',                            // Kích thước tối đa mỗi file log trước khi xoay vòng
  maxFiles: '14d',                           // Giữ log trong 14 ngày (ví dụ: 14 file nếu xoay vòng hàng ngày)
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  )
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Mức log, có thể cấu hình qua biến môi trường
  format: winston.format.json(),          // Định dạng log mặc định (có thể tùy chỉnh)
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      ),
    }),
    dailyRotateFileTransport // Thêm transport xoay vòng log
  ],
  exitOnError: false, // Không thoát ứng dụng khi có lỗi ghi log
});

module.exports = logger;