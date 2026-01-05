const express = require('express');
const router = express.Router();
const AdminPemasanganController = require('../controllers/adminPemasanganController');
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

// Get pemasangan detail
router.get('/:id', AdminPemasanganController.getPemasanganDetail);

module.exports = router;

