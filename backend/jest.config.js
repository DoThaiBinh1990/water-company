// d:\CODE\water-company\backend\jest.config.js
module.exports = {
  // Môi trường test (node cho backend, jsdom cho frontend React/Vue)
  testEnvironment: 'node',

  // Pattern để Jest tìm các file test
  // Mặc định là các file .test.js, .spec.js trong thư mục __tests__
  // hoặc các file có tên [filename].test.js hoặc [filename].spec.js
  // testMatch: ['**/__tests__/**/*.test.js?(x)', '**/?(*.)+(spec|test).js?(x)'],

  // Thư mục sẽ được bỏ qua khi tìm kiếm file test
  // modulePathIgnorePatterns: ['<rootDir>/some_directory_to_ignore/'],

  // Setup file sẽ chạy trước mỗi bộ test (ví dụ: kết nối DB test, khởi tạo server)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Coverage report (báo cáo độ bao phủ của test)
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.js', // Chỉ tính coverage cho các file trong thư mục server
    '!server/server.js', // Loại trừ file server.js chính
    '!server/config/**',   // Loại trừ thư mục config (bao gồm logger.js, config.js kết nối DB)
    '!server/models/**',   // Loại trừ thư mục models (thường không unit test trực tiếp model schema)
    // Tạm thời loại trừ các file routes và middleware, chúng sẽ được test qua integration tests
    '!server/routes/**/*.js',
    '!server/middleware.js',
    // Loại trừ các file utils không cần thiết hoặc sẽ test riêng
    '!server/utils/sync.util.js', // File đồng bộ dữ liệu cũ
    // Thêm các file hoặc thư mục khác bạn muốn loại trừ khỏi coverage
  ],
  coverageThreshold: { // Ngưỡng coverage tối thiểu (tùy chọn, có thể điều chỉnh sau)
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },

  // Reset mocks giữa các test để đảm bảo tính độc lập
  resetMocks: true,

  // Xóa mocks giữa các test
  clearMocks: true,

  // Verbose output (hiển thị chi tiết hơn khi chạy test)
  verbose: true,
};
