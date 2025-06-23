const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { AdminKunjunganController } = require('../controllers/adminKunjunganController');

// Apply auth middleware to all routes
router.use(auth);

// GET /api/admin/kunjungan
router.get('/', AdminKunjunganController.getAllKunjungan);

// GET /api/admin/kunjungan/sales
router.get('/sales', AdminKunjunganController.getAllSales);

module.exports = router; 