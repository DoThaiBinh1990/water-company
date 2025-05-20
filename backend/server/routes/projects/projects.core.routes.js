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

// Route for importing projects from Excel
router.post('/import', authenticate, projectCoreController.importProjectsFromExcel);

// Route to mark a project as completed
router.patch('/:id/complete', authenticate, projectCoreController.markProjectAsCompleted);

// Route to move a project to the next financial year
router.patch('/:id/move-next-year', authenticate, projectCoreController.moveProjectToNextFinancialYear);

// Routes for Timeline data
router.get('/timeline/profile-category', authenticate, projectCoreController.getProfileTimelineProjects);
router.get('/timeline/construction', authenticate, projectCoreController.getConstructionTimelineProjects); // Sử dụng query param 'type'

// Routes for Batch Updating Timelines
router.patch('/timeline/profile-category/batch-update', authenticate, projectCoreController.batchUpdateProfileTimeline);
router.patch('/timeline/construction/batch-update', authenticate, projectCoreController.batchUpdateConstructionTimeline);

// Routes for Updating Single Timeline Task (used by Gantt chart interaction)
router.patch('/timeline/profile-category/:id', authenticate, projectCoreController.updateProfileTimelineTask);
router.patch('/timeline/construction/:id', authenticate, projectCoreController.updateConstructionTimelineTask); // Sử dụng query param 'type'

// Route for getting projects eligible for timeline assignment
router.get('/timeline/for-assignment', authenticate, projectCoreController.getProjectsForTimelineAssignment);

module.exports = router;
