const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const dailyActivityRoutes = require('./src/routes/dailyActivityRoutes');
const absensiRoutes = require('./src/routes/absensiRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const arsipFileRoutes = require('./src/routes/arsipFileRoutes');
const adminKunjunganRoutes = require('./src/routes/adminKunjunganRoutes');
const adminClientRoutes = require('./src/routes/adminClientRoutes');
const adminArsipFileRoutes = require('./src/routes/adminArsipFileRoutes');
const adminEventRoutes = require('./src/routes/adminEventRoutes');
const adminPengajuanRoutes = require('./src/routes/adminPengajuanRoutes');
const adminRabRoutes = require('./src/routes/adminRabRoutes');
const rabRoutes = require('./src/routes/rabRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

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
    message: 'Backend Mobile MKI Terbaru V1 sudah berjalan!'
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/daily-activities', dailyActivityRoutes);
app.use('/api/absensi', absensiRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/arsip-files', arsipFileRoutes);
app.use('/api/sales/arsip-files', arsipFileRoutes);
app.use('/api/admin/kunjungan', adminKunjunganRoutes);
app.use('/api/admin/clients', adminClientRoutes);
app.use('/api/admin/arsip-files', adminArsipFileRoutes);
app.use('/api/admin/events', adminEventRoutes);
app.use('/api/admin/pengajuan', adminPengajuanRoutes);
app.use('/api/admin/rancangan-anggaran-biaya', adminRabRoutes);
app.use('/api/supervisi', rabRoutes);
app.use('/api/notifications', notificationRoutes);

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