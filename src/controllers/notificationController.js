const db = require('../config/database');

class NotificationController {
  /**
   * Register device token
   * POST /api/notifications/register-token
   */
  static async registerToken(req, res) {
    try {
      const userId = req.user.id;
      const { device_token, device_type, device_id, device_name, app_version } = req.body;

      // Validasi
      if (!device_token) {
        return res.status(400).json({
          success: false,
          message: 'Device token harus diisi'
        });
      }

      // Cek apakah token sudah ada (bisa dari user lain atau user yang sama)
      const [existingToken] = await db.query(
        'SELECT * FROM device_tokens WHERE device_token = ?',
        [device_token]
      );

      if (existingToken.length > 0) {
        const existing = existingToken[0];

        // Jika token sudah ada untuk user yang sama
        if (existing.user_id === userId) {
          // Update existing token
          await db.query(
            `UPDATE device_tokens 
             SET device_type = ?, device_id = ?, device_name = ?, app_version = ?, 
                 is_active = 1, last_used_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [
              device_type || null,
              device_id || null,
              device_name || null,
              app_version || null,
              existing.id
            ]
          );

          return res.json({
            success: true,
            message: 'Device token berhasil diupdate',
            data: { id: existing.id }
          });
        } else {
          // Token sudah ada tapi untuk user berbeda
          // Deactivate semua token user lama
          await db.query(
            'UPDATE device_tokens SET is_active = 0 WHERE user_id = ?',
            [existing.user_id]
          );

          // Update token untuk user baru
          await db.query(
            `UPDATE device_tokens 
             SET user_id = ?, device_type = ?, device_id = ?, device_name = ?, app_version = ?, 
                 is_active = 1, last_used_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [
              userId,
              device_type || null,
              device_id || null,
              device_name || null,
              app_version || null,
              existing.id
            ]
          );

          return res.json({
            success: true,
            message: 'Device token berhasil diupdate untuk user baru',
            data: { id: existing.id }
          });
        }
      }

      // Deactivate semua token user yang sama (jika ada)
      await db.query(
        'UPDATE device_tokens SET is_active = 0 WHERE user_id = ?',
        [userId]
      );

      // Insert new token
      const [result] = await db.query(
        `INSERT INTO device_tokens 
         (user_id, device_token, device_type, device_id, device_name, app_version, is_active, last_used_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
        [
          userId,
          device_token,
          device_type || null,
          device_id || null,
          device_name || null,
          app_version || null
        ]
      );

      return res.json({
        success: true,
        message: 'Device token berhasil diregister',
        data: { id: result.insertId }
      });
    } catch (error) {
      console.error('Register token error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Get list of notifications
   * GET /api/notifications
   */
  static async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, type, is_read } = req.query;
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM notifications WHERE user_id = ?';
      const params = [userId];

      // Filter by type
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      // Filter by read status
      if (is_read !== undefined) {
        query += ' AND is_read = ?';
        params.push(is_read === 'true' ? 1 : 0);
      }

      // Order by created_at DESC
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [notifications] = await db.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
      const countParams = [userId];
      if (type) {
        countQuery += ' AND type = ?';
        countParams.push(type);
      }
      if (is_read !== undefined) {
        countQuery += ' AND is_read = ?';
        countParams.push(is_read === 'true' ? 1 : 0);
      }

      const [countResult] = await db.query(countQuery, countParams);
      const total = countResult[0].total;

      // Parse JSON data field
      const formattedNotifications = notifications.map(notif => ({
        ...notif,
        data: notif.data ? JSON.parse(notif.data) : null,
        is_read: notif.is_read === 1,
      }));

      return res.json({
        success: true,
        data: formattedNotifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  static async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const [result] = await db.query(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notifikasi tidak ditemukan'
        });
      }

      return res.json({
        success: true,
        message: 'Notifikasi berhasil ditandai sebagai dibaca'
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/mark-all-read
   */
  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      await db.query(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
        [userId]
      );

      return res.json({
        success: true,
        message: 'Semua notifikasi berhasil ditandai sebagai dibaca'
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  static async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const [result] = await db.query(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Notifikasi tidak ditemukan'
        });
      }

      return res.json({
        success: true,
        message: 'Notifikasi berhasil dihapus'
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;

      const [result] = await db.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );

      return res.json({
        success: true,
        data: {
          count: result[0].count
        }
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Deactivate all device tokens for user (logout)
   * POST /api/notifications/logout
   */
  static async logout(req, res) {
    try {
      const userId = req.user.id;

      // Deactivate all device tokens for this user
      await db.query(
        'UPDATE device_tokens SET is_active = 0, updated_at = NOW() WHERE user_id = ?',
        [userId]
      );

      return res.json({
        success: true,
        message: 'Device tokens berhasil dinonaktifkan'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }
  /**
   * Broadcast notification to all users
   * POST /api/notifications/broadcast
   */
  static async broadcastNotification(req, res) {
    try {
      const { title, body, data = {} } = req.body;

      if (!title || !body) {
        return res.status(400).json({
          success: false,
          message: 'Title dan Body harus diisi'
        });
      }

      // Check if current user is admin (role = 1)
      if (req.user.role !== 1) {
        return res.status(403).json({
          success: false,
          message: 'Hanya admin yang dapat mengirim broadcast'
        });
      }

      // 1. Get all active users
      const [users] = await db.query(
        'SELECT id FROM users WHERE status_deleted = 0'
      );

      if (users.length === 0) {
        return res.json({
          success: true,
          message: 'Tidak ada user aktif untuk dikirimkan notifikasi'
        });
      }

      // 2. Get all active device tokens
      const [tokens] = await db.query(
        'SELECT device_token FROM device_tokens WHERE is_active = 1'
      );

      // 3. Send push notifications via Expo
      if (tokens.length > 0) {
        const axios = require('axios');
        // Expo limit is 100 messages per request
        const chunks = [];
        for (let i = 0; i < tokens.length; i += 100) {
          chunks.push(tokens.slice(i, i + 100));
        }

        for (const chunk of chunks) {
          const messages = chunk.map(token => ({
            to: token.device_token,
            sound: 'default',
            title: title,
            body: body,
            data: {
              type: 'broadcast',
              ...data
            },
            priority: 'high',
          }));

          try {
            await axios.post('https://exp.host/--/api/v2/push/send', messages, {
              headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
              },
            });
          } catch (pushError) {
            console.error('Expo push error:', pushError.message);
          }
        }
      }

      // 4. Save to notifications table for all users
      const insertQuery = `
        INSERT INTO notifications 
        (user_id, title, body, type, is_read, data, created_at, updated_at)
        VALUES ?
      `;

      const now = new Date();
      const insertValues = users.map(user => [
        user.id,
        title,
        body,
        'broadcast',
        0,
        JSON.stringify(data),
        now,
        now
      ]);

      await db.query(insertQuery, [insertValues]);

      return res.json({
        success: true,
        message: `Broadcast berhasil dikirim ke ${users.length} user`,
        recipientCount: users.length
      });

    } catch (error) {
      console.error('Broadcast notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }
}

module.exports = NotificationController;

