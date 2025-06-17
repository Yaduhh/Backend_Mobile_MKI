const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

class AuthController {
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validasi input
      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Email dan password harus diisi'
        });
      }

      // Cari user berdasarkan email
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Email atau password salah'
        });
      }

      // Cek status user
      if (user.status !== 1) {
        return res.status(401).json({
          status: 'error',
          message: 'Akun tidak aktif'
        });
      }

      // Verifikasi password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          status: 'error',
          message: 'Email atau password salah'
        });
      }

      // Generate token
      const token = jwt.sign(
        { 
          id: user.id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Kirim response
      res.json({
        status: 'success',
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            notelp: user.notelp,
            profile: user.profile
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada server'
      });
    }
  }

  static async register(req, res) {
    try {
      const { name, email, password, role, notelp, profile } = req.body;

      // Validasi input
      if (!name || !email || !password || !role) {
        return res.status(400).json({
          status: 'error',
          message: 'Semua field wajib diisi'
        });
      }

      // Cek apakah email sudah terdaftar
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Email sudah terdaftar'
        });
      }

      // Buat user baru
      const userId = await User.create({
        name,
        email,
        password,
        role,
        notelp,
        profile
      });

      res.status(201).json({
        status: 'success',
        message: 'Registrasi berhasil',
        data: {
          id: userId,
          name,
          email,
          role,
          notelp,
          profile
        }
      });

    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada server'
      });
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User tidak ditemukan'
        });
      }

      res.json({
        status: 'success',
        data: user
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada server'
      });
    }
  }
}

module.exports = AuthController; 