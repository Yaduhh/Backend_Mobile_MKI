const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { DailyActivityController, upload } = require('../controllers/dailyActivityController');

// Apply auth middleware to all routes
router.use(auth);

// Daily activity routes
router.get('/', DailyActivityController.getAllDailyActivities);
router.get('/:id', DailyActivityController.getDailyActivityById);
router.post('/', upload.array('dokumentasi', 10), DailyActivityController.createDailyActivity);
router.put('/:id', upload.array('dokumentasi', 10), DailyActivityController.updateDailyActivity);
router.delete('/:id', DailyActivityController.deleteDailyActivity);
// Tambahkan endpoint baru untuk komentar
router.post('/:id/komentar', DailyActivityController.addComment);

module.exports = router;