// d:\CODE\water-company\backend\server\server.js
const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config'); // Giả sử file config.js của bạn export connectDB
const logger = require('./config/logger'); // Import logger
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes'); // File route gốc
const projectCoreRoutes = require('./routes/projects/projects.core.routes'); // Import route mới
const syncRoutes = require('./routes/syncRoutes');

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO setup
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  }
});

io.on('connection', (socket) => {
  logger.info(`Một người dùng đã kết nối: ${socket.id}`);
  socket.on('disconnect', () => {
    logger.info(`Người dùng đã ngắt kết nối: ${socket.id}`);
  });
});

// Make io accessible to our router
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Đăng ký các routes
app.use('/api', authRoutes);
app.use('/api/projects', projectCoreRoutes);
app.use('/api', projectRoutes);
app.use('/api', syncRoutes);

// Global error handler (ví dụ cơ bản)
app.use((err, req, res, next) => {
  logger.error('Lỗi không xác định:', { 
    message: err.message, 
    stack: err.stack, 
    statusCode: err.statusCode, 
    path: req.path, 
    method: req.method 
  });
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Lỗi máy chủ nội bộ';
  res.status(statusCode).json({ message });
});


const port = process.env.PORT || 5000;
server.listen(port, () => logger.info(`Máy chủ đang chạy trên cổng ${port}`));
