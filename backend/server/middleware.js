// d:\CODE\water-company\backend\server\middleware.js
const jwt = require('jsonwebtoken');
const logger = require('./config/logger'); // Import logger

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Xác thực thất bại: Không có token hoặc token không đúng định dạng Bearer', { path: req.path, method: req.method });
    return res.status(401).json({ message: 'Không có token hoặc token không đúng định dạng Bearer' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'admin') {
      decoded.permissions = {
        add: true,
        edit: true,
        delete: true,
        approve: true,
        viewRejected: true,
        allocate: true,
        assign: true,
      };
    }
    req.user = decoded;
    next();
  } catch (error) {
    logger.error("Lỗi xác thực token:", { path: req.path, method: req.method, message: error.message, tokenUsed: token });
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

module.exports = authenticate;
