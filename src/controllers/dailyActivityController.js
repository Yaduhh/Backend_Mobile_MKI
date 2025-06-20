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
      const query = `
        SELECT da.*, 
               u.email as creator_email,
               c.nama as client_name
        FROM daily_activities da
        LEFT JOIN users u ON da.created_by = u.id
        LEFT JOIN clients c ON da.pihak_bersangkutan = c.id
        WHERE da.deleted_status = false
        ORDER BY da.created_at DESC
      `;
      
      const [activities] = await db.query(query);
      
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
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

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
      const komentarJson = JSON.stringify(komentar || []);

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
      const {
        dokumentasi,
        perihal,
        pihak_bersangkutan,
        komentar,
        summary,
        lokasi
      } = req.body;

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

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

      // Format dokumentasi agar slash di-escape (dokumentasi\/namafile.png)
      const dokumentasiJson = JSON.stringify(dokumentasi || []).replace(/\//g, '\\/');
      const komentarJson = JSON.stringify(komentar || []);

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
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

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
}

module.exports = { DailyActivityController, upload };