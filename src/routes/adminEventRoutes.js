const express = require('express');
const router = express.Router();
const adminEventController = require('../controllers/adminEventController');
const { auth } = require('../middleware/auth');


// Apply auth middleware to all routes
router.use(auth);

// ===== ADMIN EVENT ROUTES =====

// Get all events for admin
router.get('/', (req, res, next) => {
  next();
}, adminEventController.getAllEvents);

// Get upcoming events
router.get('/upcoming', (req, res, next) => {
  next();
}, adminEventController.getUpcomingEvents);

// Get past events
router.get('/past', (req, res, next) => {
  next();
}, adminEventController.getPastEvents);

// Get event statistics
router.get('/stats', (req, res, next) => {
  next();
}, adminEventController.getStats);

// Get all users for participant selection
router.get('/users', (req, res, next) => {
  next();
}, adminEventController.getAllUsers);

// Create new event
router.post('/', (req, res, next) => {
  next();
}, adminEventController.createEvent);

// Get event by ID (harus di bawah route spesifik)
router.get('/:id', (req, res, next) => {
  next();
}, adminEventController.getEventById);

// Update event
router.put('/:id', (req, res, next) => {
  next();
}, adminEventController.updateEvent);

// Update event status
router.put('/:id/status', (req, res, next) => {
  next();
}, adminEventController.updateStatus);

// Delete event
router.delete('/:id', (req, res, next) => {
  next();
}, adminEventController.deleteEvent);

module.exports = router; 