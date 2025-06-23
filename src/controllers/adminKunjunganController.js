const db = require('../config/database');

class AdminKunjunganController {
  // Get all sales users for filter dropdown
  static async getAllSales(req, res) {
    try {
      const query = `
        SELECT id, email, name, role
        FROM users 
        WHERE role = 2 AND status_deleted = false
        ORDER BY name ASC
      `;
      const [sales] = await db.query(query);
      res.json({
        success: true,
        data: sales
      });
    } catch (error) {
      console.error('Error fetching sales users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales users'
      });
    }
  }

  // Get all daily activities (admin, no userId filter)
  static async getAllKunjungan(req, res) {
    try {
      let { startDate, endDate, clientId, userId } = req.query;
      let where = 'da.deleted_status = false';
      let params = [];

      // Default tanggal: hari ini jika tidak dikirim
      const today = new Date();
      const pad = n => n < 10 ? '0' + n : n;
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      if (!startDate) startDate = todayStr;
      if (!endDate) endDate = todayStr;

      if (clientId) {
        where += ' AND da.pihak_bersangkutan = ?';
        params.push(clientId);
      }
      if (userId) {
        where += ' AND da.created_by = ?';
        params.push(userId);
      }
      if (startDate && endDate) {
        where += ' AND DATE(da.created_at) BETWEEN ? AND ?';
        params.push(startDate, endDate);
      } else if (startDate) {
        where += ' AND DATE(da.created_at) = ?';
        params.push(startDate);
      }

      const query = `
        SELECT da.*, 
               u.email as creator_email,
               u.name as creator_name,
               c.nama as client_name
        FROM daily_activities da
        LEFT JOIN users u ON da.created_by = u.id
        LEFT JOIN clients c ON da.pihak_bersangkutan = c.id
        WHERE ${where}
        ORDER BY da.created_at DESC
      `;
      const [activities] = await db.query(query, params);
      // Parse JSON fields
      const formattedActivities = activities.map(activity => {
        // Parse dokumentasi
        let dokumentasi = [];
        try {
          dokumentasi = JSON.parse(activity.dokumentasi || '[]');
        } catch (e) {
          dokumentasi = [];
        }
        // Parse komentar
        let komentar = [];
        try {
          const komentarRaw = activity.komentar;
          if (komentarRaw) {
            let str = komentarRaw;
            if (str.startsWith('"') && str.endsWith('"')) {
              str = str.slice(1, -1);
            }
            str = str.replace(/\\"/g, '"');
            const parsed = JSON.parse(str);
            komentar = Array.isArray(parsed) ? parsed : [];
          }
        } catch (e) {
          komentar = [];
        }
        return {
          ...activity,
          dokumentasi,
          komentar
        };
      });
      res.json({
        success: true,
        data: formattedActivities
      });
    } catch (error) {
      console.error('Error fetching admin kunjungan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch kunjungan (admin)'
      });
    }
  }
}

module.exports = { AdminKunjunganController };