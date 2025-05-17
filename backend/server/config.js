// d:\CODE\water-company\backend\server\config.js
const mongoose = require('mongoose');
const logger = require('./config/logger'); // Import logger

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Các tùy chọn useNewUrlParser, useUnifiedTopology, useCreateIndex, useFindAndModify không còn cần thiết trong Mongoose 6+
      // Tuy nhiên, nếu bạn dùng Mongoose < 6, hãy giữ lại chúng.
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      // useCreateIndex: true, // Nếu bạn dùng Mongoose < 6 và có index
      // useFindAndModify: false, // Nếu bạn dùng Mongoose < 6
    });
    logger.info('MongoDB đã kết nối thành công.');
  } catch (err) {
    logger.error('Lỗi kết nối MongoDB:', { message: err.message, stack: err.stack });
    process.exit(1); // Thoát tiến trình nếu không kết nối được DB
  }
};

module.exports = connectDB;
