const express = require('express');
const router = express.Router();
const RabController = require('../controllers/rabController');
const { auth } = require('../middleware/auth');

// Middleware untuk memastikan user adalah supervisi
const supervisiAuth = (req, res, next) => {
    if (req.user && req.user.role === 4) {
        next();
    } else {
        res.status(403).json({
            status: 'error',
            message: 'Akses ditolak. Hanya supervisi yang dapat mengakses endpoint ini.'
        });
    }
};

// All routes require authentication and supervisi role
router.use(auth);
router.use(supervisiAuth);

// Dashboard statistics
router.get('/dashboard/stats', RabController.getDashboardStats);

// RAB list and detail
router.get('/rab', RabController.getRABList);
router.get('/rab/:id', RabController.getRABDetail);

// Update RAB expenses
router.put('/rab/:id/entertainment', RabController.updateEntertainment);
router.put('/rab/:id/harga-tukang', RabController.updateHargaTukang);
router.put('/rab/:id/tukang', RabController.updateTukang);
router.put('/rab/:id/kerja-tambah', RabController.updateKerjaTambah);
router.put('/rab/:id/material-tambahan', RabController.updateMaterialTambahan);

module.exports = router;
