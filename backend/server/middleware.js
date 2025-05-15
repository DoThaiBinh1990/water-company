const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Không có token hoặc token không đúng định dạng Bearer' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'admin') {
      decoded.permissions = { add: true, edit: true, delete: true, approve: true };
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Lỗi xác thực token:", error.message);
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

module.exports = authenticate;