const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    
    // Ambil token dari header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Token tidak ditemukan'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verifikasi token without expiration check
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mki_secret_key_2024');
    
    // Tambahkan user ke request
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token tidak valid'
      });
    }
    // Remove TokenExpiredError check since tokens never expire
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server'
    });
  }
};

// Middleware untuk admin (role = 1)
const adminAuth = (req, res, next) => {
  try {
    
    // Ambil token dari header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Token tidak ditemukan'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verifikasi token without expiration check
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mki_secret_key_2024');
    
    // Cek apakah user adalah admin (role = 1)
    if (decoded.role !== 1) {
      return res.status(403).json({
        status: 'error',
        message: 'Anda tidak memiliki akses admin'
      });
    }
    
    // Tambahkan user ke request
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token tidak valid'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan pada server'
    });
  }
};

// Middleware untuk mengecek role
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Anda tidak memiliki akses'
      });
    }
    next();
  };
};

module.exports = { auth, adminAuth, checkRole }; 