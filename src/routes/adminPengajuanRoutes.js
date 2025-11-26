const express = require('express');
const router = express.Router();
const AdminPengajuanController = require('../controllers/adminPengajuanController');
const { auth } = require('../middleware/auth');

// Middleware untuk memastikan user adalah admin
const adminAuth = (req, res, next) => {
    if (req.user && req.user.role === 1) {
        next();
    } else {
        res.status(403).json({
            status: 'error',
            message: 'Akses ditolak. Hanya admin yang dapat mengakses endpoint ini.'
        });
    }
};

// All routes require authentication and admin role
router.use(auth);
router.use(adminAuth);

// Entertainment (Non Material) routes
router.get('/entertainment', AdminPengajuanController.getEntertainmentList);
router.patch('/entertainment/:id/update-status', AdminPengajuanController.updateEntertainmentStatus);

// Material Tambahan routes
router.get('/material-tambahan', AdminPengajuanController.getMaterialTambahanList);
router.patch('/material-tambahan/:id/update-status', AdminPengajuanController.updateMaterialTambahanStatus);

// Tukang routes
router.get('/tukang', AdminPengajuanController.getTukangList);
router.patch('/tukang/:id/update-status', AdminPengajuanController.updateTukangStatus);

// Kerja Tambah routes
router.get('/kerja-tambah', AdminPengajuanController.getKerjaTambahList);
router.patch('/kerja-tambah/:id/update-status', AdminPengajuanController.updateKerjaTambahStatus);

module.exports = router;
