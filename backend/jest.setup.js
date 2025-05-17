// d:\CODE\water-company\backend\jest.setup.js

// Tăng thời gian timeout mặc định cho các test nếu cần (ví dụ: khi test có tương tác DB)
// jest.setTimeout(30000); // 30 giây, mặc định là 5 giây

// Ví dụ về cách sử dụng mongodb-memory-server để tạo DB test trong bộ nhớ
// Chúng ta sẽ kích hoạt và cấu hình phần này sau nếu cần thiết cho integration tests.
/*
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server'); // Cần cài đặt: npm install --save-dev mongodb-memory-server

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  // Cập nhật biến môi trường MONGO_URI cho các test nếu cần
  // process.env.MONGO_URI_TEST = mongoUri; // Hoặc ghi đè process.env.MONGO_URI nếu logic kết nối DB của bạn cho phép
  await mongoose.connect(mongoUri, {
    // Các tùy chọn kết nối nếu cần
  });
  console.log(`Mock MongoDB for testing connected at ${mongoUri}`);
});

// Dọn dẹp dữ liệu trong các collections sau mỗi test case
// Điều này giúp đảm bảo các test độc lập với nhau
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({}); // Xóa tất cả documents trong collection
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('Mock MongoDB for testing disconnected and stopped.');
});
*/

// Hiện tại, file này có thể để trống hoặc chỉ chứa các cài đặt đơn giản như jest.setTimeout.
// Các thiết lập phức tạp hơn như kết nối DB test sẽ được thêm vào khi chúng ta viết integration tests.

console.log('Jest setup file loaded.'); // Để xác nhận file này được chạy
