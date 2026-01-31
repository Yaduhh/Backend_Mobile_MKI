const express = require('express');
const router = express.Router();
const SupervisiPengajuanController = require('../controllers/supervisiPengajuanController');
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

router.get('/', SupervisiPengajuanController.getAllPengajuan);

module.exports = router;
