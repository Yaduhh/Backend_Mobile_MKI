const express = require('express');
const router = express.Router();
const AdminRabController = require('../controllers/adminRabController');
const { auth } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// GET /api/admin/rancangan-anggaran-biaya
router.get('/', AdminRabController.getAllRAB);

// GET /api/admin/rancangan-anggaran-biaya/:id
router.get('/:id', AdminRabController.getRABDetail);

// PATCH /api/admin/rancangan-anggaran-biaya/:id/update-status
router.patch('/:id/update-status', AdminRabController.updateStatus);

// PATCH /api/admin/rancangan-anggaran-biaya/:id/update-supervisi
router.patch('/:id/update-supervisi', AdminRabController.updateSupervisi);

// GET /api/admin/rancangan-anggaran-biaya/supervisi/list
router.get('/supervisi/list', AdminRabController.getAllSupervisi);

module.exports = router;

