const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.post('/register-token', auth, NotificationController.registerToken);
router.post('/logout', auth, NotificationController.logout);
router.get('/', auth, NotificationController.getNotifications);
router.patch('/:id/read', auth, NotificationController.markAsRead);
router.patch('/mark-all-read', auth, NotificationController.markAllAsRead);
router.delete('/:id', auth, NotificationController.deleteNotification);
router.get('/unread-count', auth, NotificationController.getUnreadCount);

module.exports = router;

