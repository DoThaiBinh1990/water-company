const express = require('express');
const router = express.Router();
const authenticate = require('../middleware');
const { syncOldProjects } = require('../utils');

router.post('/sync-projects', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ admin mới có quyền đồng bộ dữ liệu công trình' });
  try {
    const result = await syncOldProjects();
    res.json(result);
  } catch (error) {
    console.error("Lỗi API đồng bộ công trình:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;