// d:\CODE\water-company\backend\server\routes\projects\projects.core.routes.js
const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware'); // Đường dẫn tới middleware authenticate
const projectCoreController = require('../../controllers/projects/project.core.controller.js');

// Route này sẽ được mount với prefix /api/projects (trong server.js)
router.get('/', authenticate, projectCoreController.getProjects);

router.post('/', authenticate, projectCoreController.createProject);

router.patch('/:id', authenticate, projectCoreController.updateProject);

router.delete('/:id', authenticate, projectCoreController.deleteProject); // Thêm route DELETE by ID

module.exports = router;
