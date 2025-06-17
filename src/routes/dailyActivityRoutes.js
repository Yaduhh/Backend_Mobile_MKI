const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const DailyActivityController = require('../controllers/dailyActivityController');

// Apply auth middleware to all routes
router.use(auth);

// Daily activity routes
router.get('/', DailyActivityController.getAllDailyActivities);
router.get('/:id', DailyActivityController.getDailyActivityById);
router.post('/', DailyActivityController.createDailyActivity);
router.put('/:id', DailyActivityController.updateDailyActivity);
router.delete('/:id', DailyActivityController.deleteDailyActivity);

module.exports = router; 