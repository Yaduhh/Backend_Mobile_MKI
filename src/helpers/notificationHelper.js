const db = require('../config/database');
const axios = require('axios');

/**
 * Send notification to users with master = 1
 * @param {Object} options - Notification options
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {string} options.type - Notification type (pengajuan, rab, etc.)
 * @param {number} options.relatedId - Related RAB ID
 * @param {string} options.relatedType - Related type (e.g., 'RancanganAnggaranBiaya')
 * @param {string} options.actionUrl - Deep link URL
 * @param {Object} options.data - Additional data
 */
async function sendNotificationToMasters(options) {
  try {
    const { title, body, type = 'pengajuan', relatedId, relatedType, actionUrl, data = {} } = options;

    // Get all users with master = 1
    const [masters] = await db.query(
      'SELECT id, name FROM users WHERE master = 1 AND status_deleted = 0'
    );

    if (masters.length === 0) {
      console.log('No master users found');
      return;
    }

    // Get active device tokens for all master users (only is_active = 1)
    const masterIds = masters.map(m => m.id);
    const placeholders = masterIds.map(() => '?').join(',');
    
    const [tokens] = await db.query(
      `SELECT dt.user_id, dt.device_token, u.name 
       FROM device_tokens dt
       INNER JOIN users u ON dt.user_id = u.id
       WHERE dt.user_id IN (${placeholders}) AND dt.is_active = 1`,
      masterIds
    );

    console.log(`Found ${tokens.length} active device tokens for ${masters.length} master users`);

    if (tokens.length === 0) {
      console.log('No active device tokens found for master users');
      // Still save notifications to database even if no active tokens
    }

    // Prepare Expo push notification messages
    const messages = tokens.map(token => ({
      to: token.device_token,
      sound: 'default',
      title: title,
      body: body,
      data: {
        type: type,
        relatedId: relatedId,
        relatedType: relatedType,
        actionUrl: actionUrl,
        ...data
      },
      priority: 'high',
    }));

    // Send push notifications via Expo API
    if (messages.length > 0) {
      try {
        const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
        });

        console.log(`Sent ${messages.length} push notifications to master users`);
      } catch (pushError) {
        console.error('Error sending push notifications:', pushError.message);
        // Continue to save notifications even if push fails
      }
    }

    // Save notifications to database for each master user
    const notificationPromises = masters.map(master => {
      return db.query(
        `INSERT INTO notifications 
         (user_id, title, body, type, related_id, related_type, action_url, priority, is_read, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'high', 0, ?, NOW(), NOW())`,
        [
          master.id,
          title,
          body,
          type,
          relatedId || null,
          relatedType || null,
          actionUrl || null,
          JSON.stringify(data)
        ]
      );
    });

    await Promise.all(notificationPromises);
    console.log(`Saved ${masters.length} notifications for master users`);

  } catch (error) {
    console.error('Error sending notification to masters:', error);
    // Don't throw error, just log it so it doesn't break the main flow
  }
}

/**
 * Send notification to specific user (supervisi)
 * @param {Object} options - Notification options
 * @param {number} options.userId - Target user ID (supervisi)
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {string} options.type - Notification type (pengajuan, rab, etc.)
 * @param {number} options.relatedId - Related RAB ID
 * @param {string} options.relatedType - Related type (e.g., 'RancanganAnggaranBiaya')
 * @param {string} options.actionUrl - Deep link URL
 * @param {Object} options.data - Additional data
 */
async function sendNotificationToUser(options) {
  try {
    const { userId, title, body, type = 'pengajuan', relatedId, relatedType, actionUrl, data = {} } = options;

    if (!userId) {
      console.log('No user ID provided for notification');
      return;
    }

    // Get user info
    const [users] = await db.query(
      'SELECT id, name FROM users WHERE id = ? AND status_deleted = 0',
      [userId]
    );

    if (users.length === 0) {
      console.log(`User with ID ${userId} not found`);
      return;
    }

    // Get active device tokens for the user (only is_active = 1)
    const [tokens] = await db.query(
      `SELECT dt.user_id, dt.device_token, u.name 
       FROM device_tokens dt
       INNER JOIN users u ON dt.user_id = u.id
       WHERE dt.user_id = ? AND dt.is_active = 1`,
      [userId]
    );

    console.log(`Found ${tokens.length} active device tokens for user ${userId}`);

    if (tokens.length === 0) {
      console.log(`No active device tokens found for user ${userId}`);
      // Still save notification to database even if no active tokens
    }

    // Prepare Expo push notification messages
    const messages = tokens.map(token => ({
      to: token.device_token,
      sound: 'default',
      title: title,
      body: body,
      data: {
        type: type,
        relatedId: relatedId,
        relatedType: relatedType,
        actionUrl: actionUrl,
        ...data
      },
      priority: 'high',
    }));

    // Send push notifications via Expo API
    if (messages.length > 0) {
      try {
        const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
        });

        console.log(`Sent ${messages.length} push notifications to user ${userId}`);
      } catch (pushError) {
        console.error('Error sending push notifications:', pushError.message);
        // Continue to save notifications even if push fails
      }
    }

    // Save notification to database
    await db.query(
      `INSERT INTO notifications 
       (user_id, title, body, type, related_id, related_type, action_url, priority, is_read, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'high', 0, ?, NOW(), NOW())`,
      [
        userId,
        title,
        body,
        type,
        relatedId || null,
        relatedType || null,
        actionUrl || null,
        JSON.stringify(data)
      ]
    );

    console.log(`Saved notification for user ${userId}`);

  } catch (error) {
    console.error('Error sending notification to user:', error);
    // Don't throw error, just log it so it doesn't break the main flow
  }
}

module.exports = {
  sendNotificationToMasters,
  sendNotificationToUser
};

