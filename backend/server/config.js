const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Đã kết nối MongoDB Atlas');
  } catch (err) {
    console.error('Lỗi kết nối MongoDB:', err);
    process.exit(1); // Thoát ứng dụng nếu không kết nối được
  }
};

module.exports = connectDB;