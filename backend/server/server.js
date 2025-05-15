const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

const connectDB = require('./config');
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const syncRoutes = require('./routes/syncRoutes');

dotenv.config();
const app = express();
const server = http.createServer(app);

// Cấu hình CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin ${origin} không được phép.`);
      callback(new Error(`Origin ${origin} không được phép bởi CORS`));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const io = socketIo(server, { cors: corsOptions });

// Kết nối MongoDB
connectDB();

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Đăng ký các routes
app.use('/api', authRoutes);
app.use('/api', projectRoutes);
app.use('/api', syncRoutes);

// Truyền io vào các route để sử dụng Socket.IO
app.use((req, res, next) => {
  req.io = io;
  next();
});

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});