const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');
const path = require('path');
const db = require('../config/database');
const User = require('../models/User');

// Initialize Firebase Admin SDK
console.log('🚀 Starting Firebase Admin SDK initialization...');

if (!admin.apps.length) {
    try {
        console.log('🔄 Initializing Firebase Admin SDK...');

        // Path to your specific service account file
        const serviceAccountPath = path.join(__dirname, '../../mki-online-cd9d0c2d04f9.json');

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.log('� Using environment credentials');
            admin.initializeApp({
                credential: admin.credential.applicationDefault()
            });
        } else {
            console.log('📄 Using local service account file:', serviceAccountPath);
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
        }

        const app = admin.app();
        console.log('✅ Firebase Admin SDK initialized. Project ID:', app.options.projectId);

    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    }
}

const expo = new Expo({});
console.log('✅ Expo SDK initialized');

// Helper function to parse pihak terkait
const parsePihakTerkait = (pihakTerkait) => {
    if (!pihakTerkait) return [];
    if (typeof pihakTerkait === 'string') {
        try {
            return JSON.parse(pihakTerkait);
        } catch (e) {
            return [];
        }
    }
    return Array.isArray(pihakTerkait) ? pihakTerkait : [];
};

// Send to single device
const sendNotificationToDevice = async (expoToken, title, body, data = {}) => {
    try {
        console.log(`📤 Sending to: ${expoToken}`);
        if (!Expo.isExpoPushToken(expoToken)) {
            console.error(`❌ Invalid token: ${expoToken}`);
            return false;
        }

        const message = {
            to: expoToken,
            sound: 'default',
            title: title,
            body: body,
            data: data,
        };

        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];

        for (let chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        }

        const success = tickets.length > 0 && tickets.some(t => t.status === 'ok');
        console.log(`📊 Result: ${success ? 'SUCCESS' : 'FAILED'}`);
        return success;
    } catch (error) {
        console.error('❌ Error sending notification:', error);
        return false;
    }
};

// Send to user devices (using mysql2 query)
const sendNotificationToUser = async (userId, title, body, data = {}) => {
    try {
        // Ambil token dari tabel device_tokens lu
        const [devices] = await db.execute(
            'SELECT device_token FROM device_tokens WHERE user_id = ? AND is_active = 1',
            [userId]
        );

        if (devices.length === 0) {
            console.log(`ℹ️ No active devices for user ${userId}`);
            return false;
        }

        const results = await Promise.all(
            devices.map(d => sendNotificationToDevice(d.device_token, title, body, data))
        );

        return results.some(r => r === true);
    } catch (error) {
        console.error('❌ Error sending to user:', error);
        return false;
    }
};

// Chat, Task, Komplain, Saran - Logic (Adapted to your DB)
const sendChatNotification = async (senderId, receiverId, message, senderName) => {
    const title = `Pesan baru dari ${senderName}`;
    return await sendNotificationToUser(receiverId, title, message.substring(0, 50), {
        type: 'chat',
        sender_id: senderId
    });
};

const sendTaskNotification = async (taskData, pemberiTugas) => {
    try {
        const title = `📋 Tugas Baru: ${taskData.judul_tugas}`;
        const body = `Anda ditugaskan oleh ${pemberiTugas.name || pemberiTugas.nama}`;

        // Kirim ke penerima utama
        await sendNotificationToUser(taskData.penerima_tugas, title, body, { type: 'task_assigned', task_id: taskData.id });

        // Kirim ke pihak terkait
        const pihakTerkait = parsePihakTerkait(taskData.pihak_terkait);
        for (const uid of pihakTerkait) {
            if (uid !== taskData.penerima_tugas) {
                await sendNotificationToUser(uid, `👥 Tugas Terkait: ${taskData.judul_tugas}`, body, { type: 'task_related', task_id: taskData.id });
            }
        }
        return true;
    } catch (e) { return false; }
};

// Dan seterusnya (Komplain, Saran, dll) sesuai kebutuhan dengan pola yang sama...

module.exports = {
    admin,
    expo,
    sendNotificationToDevice,
    sendNotificationToUser,
    sendChatNotification,
    sendTaskNotification,
    // Tambahkan export fungsi lainnya di sini...
};
