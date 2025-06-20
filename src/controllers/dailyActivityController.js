const db = require('../config/database');
const multer = require('multer');
const path = require('path');

// Multer storage config for dokumentasi
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), 'upload/dokumentasi'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

class DailyActivityController {
  // Get all daily activities
  static async getAllDailyActivities(req, res) {
    try {
      let { startDate, endDate, userId } = req.query;
      let where = 'da.deleted_status = false';
      let params = [];

      // Default tanggal: hari ini jika tidak dikirim
      const today = new Date();
      const pad = n => n < 10 ? '0' + n : n;
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      if (!startDate) startDate = todayStr;
      if (!endDate) endDate = todayStr;

      // Debug log untuk parameter
      console.log('Query params:', { startDate, endDate, userId });

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
               c.nama as client_name
        FROM daily_activities da
        LEFT JOIN users u ON da.created_by = u.id
        LEFT JOIN clients c ON da.pihak_bersangkutan = c.id
        WHERE ${where}
        ORDER BY da.created_at DESC
      `;
      // Debug log untuk query dan params
      console.log('SQL Query:', query);
      console.log('SQL Params:', params);
      const [activities] = await db.query(query, params);
      // Parse JSON fields
      const formattedActivities = activities.map(activity => ({
        ...activity,
        dokumentasi: JSON.parse(activity.dokumentasi || '[]'),
        komentar: JSON.parse(activity.komentar || '[]')
      }));
      res.json({
        success: true,
        data: formattedActivities
      });
    } catch (error) {
      console.error('Error fetching daily activities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch daily activities'
      });
    }
  }

  // Get daily activity by ID
  static async getDailyActivityById(req, res) {
    try {
      const { id } = req.params;
      
      const query = `
        SELECT da.*, 
               u.email as creator_email,
               c.nama as client_name
        FROM daily_activities da
        LEFT JOIN users u ON da.created_by = u.id
        LEFT JOIN clients c ON da.pihak_bersangkutan = c.id
        WHERE da.id = ? AND da.deleted_status = false
      `;
      
      const [activities] = await db.query(query, [id]);
      
      if (activities.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Daily activity not found'
        });
      }

      const activity = activities[0];
      activity.dokumentasi = JSON.parse(activity.dokumentasi || '[]');
      activity.komentar = JSON.parse(activity.komentar || '[]');

      res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      console.error('Error fetching daily activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch daily activity'
      });
    }
  }

  // Create new daily activity
  static async createDailyActivity(req, res) {
    try {
      let dokumentasiArr = [];
      if (req.files && req.files.length > 0) {
        dokumentasiArr = req.files.map(file => `dokumentasi/${file.filename}`);
      } else if (req.body.dokumentasi) {
        // If dokumentasi is sent as JSON string (for update without new upload)
        try {
          dokumentasiArr = JSON.parse(req.body.dokumentasi);
        } catch (e) {
          dokumentasiArr = [];
        }
      }
      const {
        perihal,
        pihak_bersangkutan,
        komentar,
        summary,
        lokasi
      } = req.body;

      const created_by = req.user.id; // Assuming user info is available in req.user
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

      const query = `
        INSERT INTO daily_activities (
          dokumentasi,
          perihal,
          pihak_bersangkutan,
          komentar,
          summary,
          lokasi,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Format dokumentasi agar slash di-escape (dokumentasi\/namafile.png)
      const dokumentasiJson = JSON.stringify(dokumentasiArr).replace(/\//g, '\\/');
      const komentarJson = JSON.stringify(komentar === undefined ? null : komentar);

      const [result] = await db.query(query, [
        dokumentasiJson,
        perihal,
        pihak_bersangkutan,
        komentarJson,
        summary,
        lokasi,
        created_by,
        now,
        now
      ]);

      const [newActivity] = await db.query(
        'SELECT * FROM daily_activities WHERE id = ?',
        [result.insertId]
      );

      if (newActivity.length > 0) {
        const activity = newActivity[0];
        activity.dokumentasi = JSON.parse(activity.dokumentasi || '[]');
        activity.komentar = JSON.parse(activity.komentar || '[]');

        res.status(201).json({
          success: true,
          data: activity
        });
      } else {
        throw new Error('Failed to retrieve created activity');
      }
    } catch (error) {
      console.error('Error creating daily activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create daily activity'
      });
    }
  }

  // Update daily activity
  static async updateDailyActivity(req, res) {
    try {
      const { id } = req.params;
      let dokumentasiArr = [];
      let perihal, pihak_bersangkutan, komentar, summary, lokasi;
      // Cek apakah request multipart (ada file)
      if (req.files && req.files.length > 0) {
        // Ambil file baru
        dokumentasiArr = req.files.map(file => `dokumentasi/${file.filename}`);
        // Ambil file lama dari body (jika ada)
        if (req.body.dokumentasi) {
          try {
            let oldDocs = [];
            if (Array.isArray(req.body.dokumentasi)) {
              oldDocs = req.body.dokumentasi;
            } else if (typeof req.body.dokumentasi === 'string') {
              // Bisa jadi string JSON array atau string path tunggal
              if (req.body.dokumentasi.trim().startsWith('[')) {
                oldDocs = JSON.parse(req.body.dokumentasi);
              } else {
                oldDocs = [req.body.dokumentasi];
              }
            }
            // Hanya masukkan path lama yang bukan file://
            dokumentasiArr = [...oldDocs.filter(doc => typeof doc === 'string' && !doc.startsWith('file://')), ...dokumentasiArr];
          } catch (e) {}
        }
        perihal = req.body.perihal;
        pihak_bersangkutan = req.body.pihak_bersangkutan;
        komentar = [];
        summary = req.body.summary;
        lokasi = req.body.lokasi;
      } else {
        // JSON biasa
        const { dokumentasi = [], perihal: p, pihak_bersangkutan: pb, summary: s, lokasi: l } = req.body;
        // Jika dokumentasi string (bukan array), parse
        let dokArr = dokumentasi;
        if (typeof dokumentasi === 'string') {
          try {
            dokArr = JSON.parse(dokumentasi);
          } catch (e) {
            dokArr = [dokumentasi];
          }
        }
        dokumentasiArr = dokArr;
        perihal = p;
        pihak_bersangkutan = pb;
        komentar = [];
        summary = s;
        lokasi = l;
      }
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const query = `
        UPDATE daily_activities
        SET dokumentasi = ?,
            perihal = ?,
            pihak_bersangkutan = ?,
            komentar = ?,
            summary = ?,
            lokasi = ?,
            updated_at = ?
        WHERE id = ? AND deleted_status = false
      `;
      const dokumentasiJson = JSON.stringify(dokumentasiArr).replace(/\//g, '\\/');
      const komentarJson = JSON.stringify(komentar === undefined ? null : komentar);
      const [result] = await db.query(query, [
        dokumentasiJson,
        perihal,
        pihak_bersangkutan,
        komentarJson,
        summary,
        lokasi,
        now,
        id
      ]);
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Daily activity not found'
        });
      }
      const [updatedActivity] = await db.query(
        'SELECT * FROM daily_activities WHERE id = ?',
        [id]
      );
      if (updatedActivity.length > 0) {
        const activity = updatedActivity[0];
        activity.dokumentasi = JSON.parse(activity.dokumentasi || '[]');
        activity.komentar = JSON.parse(activity.komentar || '[]');
        res.json({
          success: true,
          data: activity
        });
      } else {
        throw new Error('Failed to retrieve updated activity');
      }
    } catch (error) {
      console.error('Error updating daily activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update daily activity'
      });
    }
  }

  // Delete daily activity (soft delete)
  static async deleteDailyActivity(req, res) {
    try {
      const { id } = req.params;
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

      const query = `
        UPDATE daily_activities
        SET deleted_status = true,
            updated_at = ?
        WHERE id = ? AND deleted_status = false
      `;

      const [result] = await db.query(query, [now, id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Daily activity not found'
        });
      }

      res.json({
        success: true,
        message: 'Daily activity deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting daily activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete daily activity'
      });
    }
  }

  // Tambah komentar ke daily activity
  static async addComment(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Komentar tidak boleh kosong' });
      }
      // Ambil user dari req.user
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      // Ambil data activity
      const [rows] = await db.query('SELECT komentar FROM daily_activities WHERE id = ? AND deleted_status = false', [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
      }
      let komentarArr = [];
      try {
        const parsed = JSON.parse(rows[0].komentar || '[]');
        komentarArr = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        komentarArr = [];
      }
      // Format timestamp as YYYY-MM-DDTHH:mm:ss+07:00
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const pad = n => n < 10 ? '0' + n : n;
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+07:00`;
      // Ambil user_name dari body jika ada, jika tidak pakai user.name
      const userNameFinal = (req.body.user_name && req.body.user_name.trim()) ? req.body.user_name.trim() : (user.name || 'User');
      // Tambah komentar baru
      const newComment = {
        user_id: user.id,
        user_name: userNameFinal,
        user_profile: user.profile || null,
        message: message.trim(),
        timestamp: timestamp,
      };
      komentarArr.unshift(newComment);
      // Simpan ke database sebagai string array JSON dengan tanda kutip ganda di awal/akhir
      let komentarJson = JSON.stringify(komentarArr);
      komentarJson = `"${komentarJson.replace(/"/g, '\\"')}"`;
      await db.query('UPDATE daily_activities SET komentar = ? WHERE id = ?', [komentarJson, id]);
      res.json({ success: true, data: newComment });
    } catch (error) {
      console.error('Error add comment:', error);
      res.status(500).json({ success: false, message: 'Gagal menambah komentar' });
    }
  }
}

module.exports = { DailyActivityController, upload };