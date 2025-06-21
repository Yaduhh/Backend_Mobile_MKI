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
        process.env.JWT_SECRET || 'mki_secret_key_2024',
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
        message: 'Terjadi kesalahan pada server',
        error: error.message || error.toString()
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

  static async changePassword(req, res) {
    try {
      const { current_password, new_password, confirm_password } = req.body;
      const userId = req.user.id;

      // Validasi input
      if (!current_password || !new_password || !confirm_password) {
        return res.status(400).json({
          status: 'error',
          message: 'Semua field password harus diisi'
        });
      }

      // Validasi panjang password baru
      if (new_password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Password baru minimal 6 karakter'
        });
      }

      // Validasi konfirmasi password
      if (new_password !== confirm_password) {
        return res.status(400).json({
          status: 'error',
          message: 'Konfirmasi password tidak cocok'
        });
      }

      // Ambil data user
      const user = await User.findByIdWithPassword(userId);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User tidak ditemukan'
        });
      }

      // Verifikasi password saat ini
      const isValidCurrentPassword = await bcrypt.compare(current_password, user.password);
      if (!isValidCurrentPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Password saat ini salah'
        });
      }

      // Cek apakah password baru sama dengan password lama
      const isSamePassword = await bcrypt.compare(new_password, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Password baru tidak boleh sama dengan password saat ini'
        });
      }

      // Hash password baru
      const hashedNewPassword = await bcrypt.hash(new_password, 10);

      // Update password di database
      await User.updatePassword(userId, hashedNewPassword);

      res.json({
        status: 'success',
        message: 'Password berhasil diubah'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada server'
      });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { name, email, notelp, profile } = req.body;
      const userId = req.user.id;

      // Validasi input
      if (!name || !email || !notelp) {
        return res.status(400).json({
          status: 'error',
          message: 'Nama, email, dan nomor telepon wajib diisi'
        });
      }

      // Validasi format email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          status: 'error',
          message: 'Format email tidak valid'
        });
      }

      // Cek apakah email sudah digunakan user lain
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          status: 'error',
          message: 'Email sudah digunakan oleh user lain'
        });
      }

      // Update profile di database
      const updateData = {
        name: name.trim(),
        email: email.trim(),
        notelp: notelp.trim(),
      };

      // Hanya tambahkan profile jika ada dan tidak undefined
      if (profile && profile.trim() !== '') {
        updateData.profile = profile.trim();
      }

      console.log('Update data:', updateData); // Debug log

      const success = await User.update(userId, updateData);
      if (!success) {
        return res.status(404).json({
          status: 'error',
          message: 'User tidak ditemukan'
        });
      }

      // Ambil data user yang sudah diupdate
      const updatedUser = await User.findById(userId);

      res.json({
        status: 'success',
        message: 'Profil berhasil diperbarui',
        data: updatedUser
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada server'
      });
    }
  }

  static async uploadProfile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'Tidak ada file yang diupload'
        });
      }

      // Generate profile path sesuai format yang diminta
      const profilePath = `profiles/${req.file.filename}`;

      res.json({
        status: 'success',
        message: 'Foto profil berhasil diupload',
        profile_path: profilePath
      });

    } catch (error) {
      console.error('Upload profile error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan saat upload foto profil'
      });
    }
  }
}

module.exports = AuthController;