// src/utils/logger.js
const logger = {
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args), // Trong môi trường production, bạn có thể muốn gửi lỗi này đến một dịch vụ giám sát
};

export default logger;
