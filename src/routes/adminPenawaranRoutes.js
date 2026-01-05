const express = require('express');
const router = express.Router();
const AdminPenawaranController = require('../controllers/adminPenawaranController');
const { auth } = require('../middleware/auth');

// Middleware untuk memastikan user adalah admin
const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 1) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Akses ditolak. Hanya admin yang dapat mengakses endpoint ini.'
    });
  }
};

// Apply auth middleware to all routes
router.use(auth);
router.use(adminAuth);

// Get all penawaran (harus sebelum /:id)
router.get('/', AdminPenawaranController.getAllPenawaran);

// Get users for filter (harus sebelum /:id)
router.get('/users', AdminPenawaranController.getUsers);

// Get clients by sales ID (harus sebelum /:id)
router.get('/clients/:salesId', AdminPenawaranController.getClientsBySales);

// Cetak PDF (harus sebelum /:id)
router.get('/cetak/:id', AdminPenawaranController.cetak);

// Get penawaran detail by ID
router.get('/:id', AdminPenawaranController.getPenawaranDetail);

// Update penawaran status
router.patch('/:id/update-status', AdminPenawaranController.updateStatus);

// Delete penawaran (soft delete)
router.delete('/:id', AdminPenawaranController.deletePenawaran);

module.exports = router;

