const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const dailyActivityRoutes = require('./routes/dailyActivityRoutes');
const absensiRoutes = require('./routes/absensiRoutes');
const eventRoutes = require('./routes/eventRoutes');
const arsipFileRoutes = require('./routes/arsipFileRoutes');
const adminClientRoutes = require('./routes/adminClientRoutes');
const adminArsipFileRoutes = require('./routes/adminArsipFileRoutes');
const rabRoutes = require('./routes/rabRoutes');
const adminPengajuanRoutes = require('./routes/adminPengajuanRoutes');
const adminRabRoutes = require('./routes/adminRabRoutes');
const supervisiPengajuanRoutes = require('./routes/supervisiPengajuanRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve dokumentasi images statically
app.use('/upload/dokumentasi', express.static(require('path').join(process.cwd(), 'upload/dokumentasi/')));
// Serve arsip files statically
app.use('/upload/arsip_files', express.static(require('path').join(process.cwd(), 'upload/arsip_files/')));
// Serve profile images statically
app.use('/upload/profiles', express.static(require('path').join(process.cwd(), 'upload/profiles/')));

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Backend Mobile MKI sudah berjalan!'
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/daily-activities', dailyActivityRoutes);
app.use('/api/absensi', absensiRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/arsip-files', arsipFileRoutes);
app.use('/api/admin/clients', adminClientRoutes);
app.use('/api/admin/events', eventRoutes);
app.use('/api/admin/arsip-files', adminArsipFileRoutes);
app.use('/api/admin/pengajuan', adminPengajuanRoutes);
app.use('/api/admin/rancangan-anggaran-biaya', adminRabRoutes);
app.use('/api/supervisi/pengajuan', supervisiPengajuanRoutes);
app.use('/api/supervisi', rabRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Terjadi kesalahan pada server'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route tidak ditemukan'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di port ${PORT}`);
});