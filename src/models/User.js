const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async findByEmail(email) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND status_deleted = 0',
      [email]
    );
    return rows[0];
  }

  static async create(userData) {
    const { name, email, password, role, notelp, profile } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, role, notelp, profile, status, status_deleted) 
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
      [name, email, hashedPassword, role, notelp, profile]
    );
    
    return result.insertId;
  }

  static async update(id, userData) {
    const { name, email, notelp, profile, status } = userData;
    const [result] = await db.execute(
      `UPDATE users 
       SET name = ?, email = ?, notelp = ?, profile = ?, status = ?
       WHERE id = ? AND status_deleted = 0`,
      [name, email, notelp, profile, status, id]
    );
    return result.affectedRows > 0;
  }

  static async softDelete(id) {
    const [result] = await db.execute(
      'UPDATE users SET status_deleted = 1 WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async findAll() {
    const [rows] = await db.execute(
      'SELECT id, name, email, role, notelp, profile, status FROM users WHERE status_deleted = 0'
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT id, name, email, role, notelp, profile, status FROM users WHERE id = ? AND status_deleted = 0',
      [id]
    );
    return rows[0];
  }
}

module.exports = User; 