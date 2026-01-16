const db = require('../config/database');

class AdminPenawaranController {
  /**
   * Get all penawaran with filters
   */
  static async getAllPenawaran(req, res) {
    try {
      const { search, user, client, status, page = 1, limit = 12 } = req.query;
      const offset = (page - 1) * limit;

      // Build base query
      let query = `
        SELECT 
          p.*,
          c.nama as client_nama,
          c.nama_perusahaan as client_nama_perusahaan,
          u.name as user_name,
          u.email as user_email
        FROM penawaran p
        LEFT JOIN clients c ON p.id_client = c.id
        LEFT JOIN users u ON p.id_user = u.id
        WHERE p.status_deleted = false
        AND p.penawaran_pintu = false
      `;

      const params = [];

      // Search functionality
      if (search) {
        query += ` AND (
          p.nomor_penawaran LIKE ? OR 
          p.judul_penawaran LIKE ? OR
          c.nama LIKE ? OR
          c.nama_perusahaan LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Filter by user (sales)
      if (user && user !== '') {
        query += ' AND p.id_user = ?';
        params.push(user);
      }

      // Filter by client
      if (client && client !== '') {
        query += ' AND p.id_client = ?';
        params.push(client);
      }

      // Filter by status
      if (status !== undefined && status !== null && status !== '') {
        query += ' AND p.status = ?';
        params.push(parseInt(status));
      }

      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [penawarans] = await db.query(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM penawaran p
        LEFT JOIN clients c ON p.id_client = c.id
        WHERE p.status_deleted = false
        AND p.penawaran_pintu = false
      `;
      const countParams = [];

      if (search) {
        countQuery += ` AND (
          p.nomor_penawaran LIKE ? OR 
          p.judul_penawaran LIKE ? OR
          c.nama LIKE ? OR
          c.nama_perusahaan LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (user && user !== '') {
        countQuery += ' AND p.id_user = ?';
        countParams.push(user);
      }

      if (client && client !== '') {
        countQuery += ' AND p.id_client = ?';
        countParams.push(client);
      }

      // Filter by status for count query
      if (status !== undefined && status !== null && status !== '') {
        countQuery += ' AND p.status = ?';
        countParams.push(parseInt(status));
      }

      const [countResult] = await db.query(countQuery, countParams);
      const total = countResult[0].total;
      const lastPage = Math.ceil(total / limit);

      // Get stats from the SAME filtered query (without pagination and without status filter)
      // Stats should show all statuses (WIN, LOSE, Draft) even when filtering by status
      // This matches web Laravel behavior where stats are calculated from filtered data
      let statsQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN p.status = 1 THEN 1 ELSE 0 END) as win,
          SUM(CASE WHEN p.status = 2 THEN 1 ELSE 0 END) as lose,
          SUM(CASE WHEN p.status = 0 THEN 1 ELSE 0 END) as draft
        FROM penawaran p
        LEFT JOIN clients c ON p.id_client = c.id
        WHERE p.status_deleted = false
        AND p.penawaran_pintu = false
      `;
      const statsParams = [];

      // Apply same filters as main query (search and user), but NOT status filter
      // Status filter only affects the list, not the stats
      if (search) {
        statsQuery += ` AND (
          p.nomor_penawaran LIKE ? OR 
          p.judul_penawaran LIKE ? OR
          c.nama LIKE ? OR
          c.nama_perusahaan LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        statsParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (user && user !== '') {
        statsQuery += ' AND p.id_user = ?';
        statsParams.push(user);
      }

      if (client && client !== '') {
        statsQuery += ' AND p.id_client = ?';
        statsParams.push(client);
      }

      const [statsResult] = await db.query(statsQuery, statsParams);
      const stats = {
        total: parseInt(statsResult[0].total) || 0,
        win: parseInt(statsResult[0].win) || 0,
        lose: parseInt(statsResult[0].lose) || 0,
        draft: parseInt(statsResult[0].draft) || 0,
      };

      // Parse JSON fields
      const formattedPenawarans = penawarans.map(penawaran => {
        const formatted = {
          id: penawaran.id,
          id_user: penawaran.id_user,
          id_client: penawaran.id_client,
          nomor_penawaran: penawaran.nomor_penawaran,
          tanggal_penawaran: penawaran.tanggal_penawaran,
          judul_penawaran: penawaran.judul_penawaran,
          project: penawaran.project,
          diskon: penawaran.diskon,
          diskon_satu: penawaran.diskon_satu,
          diskon_dua: penawaran.diskon_dua,
          ppn: penawaran.ppn,
          total: penawaran.total,
          total_diskon: penawaran.total_diskon,
          total_diskon_1: penawaran.total_diskon_1,
          total_diskon_2: penawaran.total_diskon_2,
          grand_total: penawaran.grand_total,
          status: penawaran.status,
          status_deleted: penawaran.status_deleted,
          is_revisi: penawaran.is_revisi,
          revisi_from: penawaran.revisi_from,
          catatan_revisi: penawaran.catatan_revisi,
          catatan: penawaran.catatan,
          created_at: penawaran.created_at,
          updated_at: penawaran.updated_at,
          client: penawaran.client_nama ? {
            id: penawaran.id_client,
            nama: penawaran.client_nama,
            nama_perusahaan: penawaran.client_nama_perusahaan
          } : null,
          user: penawaran.user_name ? {
            id: penawaran.id_user,
            name: penawaran.user_name,
            email: penawaran.user_email
          } : null
        };

        // Parse JSON fields
        if (penawaran.json_produk) {
          try {
            formatted.json_produk = JSON.parse(penawaran.json_produk);
          } catch (e) {
            formatted.json_produk = [];
          }
        } else {
          formatted.json_produk = [];
        }

        if (penawaran.syarat_kondisi) {
          try {
            formatted.syarat_kondisi = JSON.parse(penawaran.syarat_kondisi);
          } catch (e) {
            formatted.syarat_kondisi = [];
          }
        } else {
          formatted.syarat_kondisi = [];
        }

        if (penawaran.additional_condition) {
          try {
            formatted.additional_condition = JSON.parse(penawaran.additional_condition);
          } catch (e) {
            formatted.additional_condition = [];
          }
        } else {
          formatted.additional_condition = [];
        }

        return formatted;
      });

      res.json({
        success: true,
        data: formattedPenawarans,
        meta: {
          current_page: parseInt(page),
          last_page: lastPage,
          per_page: parseInt(limit),
          total: total
        },
        stats: stats
      });

    } catch (error) {
      console.error('Get admin penawaran list error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Get penawaran detail by ID
   */
  static async getPenawaranDetail(req, res) {
    try {
      const { id } = req.params;

      const [penawarans] = await db.query(
        `SELECT 
          p.*,
          c.nama as client_nama,
          c.nama_perusahaan as client_nama_perusahaan,
          c.email as client_email,
          c.notelp as client_notelp,
          c.alamat as client_alamat,
          u.name as user_name,
          u.email as user_email,
          u.notelp as user_notelp
        FROM penawaran p
        LEFT JOIN clients c ON p.id_client = c.id
        LEFT JOIN users u ON p.id_user = u.id
        WHERE p.id = ? AND p.status_deleted = false`,
        [id]
      );

      if (penawarans.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Penawaran tidak ditemukan'
        });
      }

      const penawaran = penawarans[0];

      // Format response
      const formatted = {
        id: penawaran.id,
        id_user: penawaran.id_user,
        id_client: penawaran.id_client,
        nomor_penawaran: penawaran.nomor_penawaran,
        tanggal_penawaran: penawaran.tanggal_penawaran,
        judul_penawaran: penawaran.judul_penawaran,
        project: penawaran.project,
        diskon: penawaran.diskon,
        diskon_satu: penawaran.diskon_satu,
        diskon_dua: penawaran.diskon_dua,
        ppn: penawaran.ppn,
        total: penawaran.total,
        total_diskon: penawaran.total_diskon,
        total_diskon_1: penawaran.total_diskon_1,
        total_diskon_2: penawaran.total_diskon_2,
        grand_total: penawaran.grand_total,
        status: penawaran.status,
        status_deleted: penawaran.status_deleted,
        is_revisi: penawaran.is_revisi,
        revisi_from: penawaran.revisi_from,
        catatan_revisi: penawaran.catatan_revisi,
        catatan: penawaran.catatan,
        created_at: penawaran.created_at,
        updated_at: penawaran.updated_at,
        client: penawaran.client_nama ? {
          id: penawaran.id_client,
          nama: penawaran.client_nama,
          nama_perusahaan: penawaran.client_nama_perusahaan,
          email: penawaran.client_email,
          notelp: penawaran.client_notelp,
          alamat: penawaran.client_alamat
        } : null,
        user: penawaran.user_name ? {
          id: penawaran.id_user,
          name: penawaran.user_name,
          email: penawaran.user_email,
          notelp: penawaran.user_notelp
        } : null
      };

      // Parse JSON fields
      if (penawaran.json_produk) {
        try {
          formatted.json_produk = JSON.parse(penawaran.json_produk);
        } catch (e) {
          formatted.json_produk = [];
        }
      } else {
        formatted.json_produk = [];
      }

      if (penawaran.syarat_kondisi) {
        try {
          formatted.syarat_kondisi = JSON.parse(penawaran.syarat_kondisi);
        } catch (e) {
          formatted.syarat_kondisi = [];
        }
      } else {
        formatted.syarat_kondisi = [];
      }

      if (penawaran.additional_condition) {
        try {
          formatted.additional_condition = JSON.parse(penawaran.additional_condition);
        } catch (e) {
          formatted.additional_condition = [];
        }
      } else {
        formatted.additional_condition = [];
      }

      // Get related pemasangan
      const [pemasangans] = await db.query(
        `SELECT id, nomor_pemasangan, judul_pemasangan, tanggal_pemasangan
         FROM pemasangan
         WHERE id_penawaran = ? AND status_deleted = 0`,
        [id]
      );
      formatted.pemasangans = pemasangans || [];

      // Get related RAB
      const [rabs] = await db.query(
        `SELECT id, proyek, pekerjaan, status
         FROM rancangan_anggaran_biaya
         WHERE penawaran_id = ? AND status_deleted = 0`,
        [id]
      );
      formatted.rancanganAnggaranBiayas = rabs || [];

      res.json({
        success: true,
        data: formatted
      });

    } catch (error) {
      console.error('Get penawaran detail error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Get users (sales) for filter
   */
  static async getUsers(req, res) {
    try {
      const [users] = await db.query(
        `SELECT id, name, email, role
         FROM users
         WHERE status_deleted = 0
         ORDER BY name ASC`
      );

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Get clients by sales ID
   */
  static async getClientsBySales(req, res) {
    try {
      const { salesId } = req.params;

      const [clients] = await db.query(
        `SELECT id, nama, nama_perusahaan
         FROM clients
         WHERE created_by = ? AND status_deleted = false
         ORDER BY nama ASC`,
        [salesId]
      );

      res.json(clients);
    } catch (error) {
      console.error('Get clients by sales error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Update penawaran status
   */
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (status === undefined || ![0, 1, 2].includes(parseInt(status))) {
        return res.status(400).json({
          success: false,
          message: 'Status tidak valid. Harus 0 (Draft), 1 (WIN), atau 2 (LOSE)'
        });
      }

      const [result] = await db.query(
        `UPDATE penawaran 
         SET status = ?, updated_at = NOW()
         WHERE id = ? AND status_deleted = false`,
        [status, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Penawaran tidak ditemukan'
        });
      }

      const statusText = status == 1 ? 'WIN' : status == 2 ? 'LOSE' : 'Draft';

      res.json({
        success: true,
        message: `Status penawaran berhasil diubah menjadi ${statusText}`,
        data: { status: parseInt(status) }
      });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Delete penawaran (soft delete)
   */
  static async deletePenawaran(req, res) {
    try {
      const { id } = req.params;

      const [result] = await db.query(
        `UPDATE penawaran 
         SET status_deleted = true, updated_at = NOW()
         WHERE id = ? AND status_deleted = false`,
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Penawaran tidak ditemukan'
        });
      }

      res.json({
        success: true,
        message: 'Penawaran berhasil dihapus'
      });
    } catch (error) {
      console.error('Delete penawaran error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }

  /**
   * Cetak PDF - Proxy to Laravel web
   */
  static async cetak(req, res) {
    try {
      const { id } = req.params;
      const axios = require('axios');
      
      // Laravel web URL - try IP address (192.168.1.10:8000) or localhost
      let LARAVEL_BASE_URL = process.env.LARAVEL_BASE_URL;
      if (!LARAVEL_BASE_URL) {
        // Try IP address first (common for mobile development)
        LARAVEL_BASE_URL = 'http://192.168.1.10:8000';
      }
      const laravelUrl = `${LARAVEL_BASE_URL}/admin/penawaran/cetak/${id}`;
      
      console.log('Proxying PDF request to:', laravelUrl);
      
      // Forward request to Laravel
      const response = await axios({
        method: 'GET',
        url: laravelUrl,
        responseType: 'stream',
        timeout: 10000, // 10 seconds timeout (shorter to fail faster)
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        },
      });

      // Check if response is successful
      if (response.status >= 400) {
        throw new Error(`Laravel returned status ${response.status}`);
      }

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="penawaran_${id}.pdf"`);

      // Pipe the PDF stream to response
      response.data.pipe(res);
    } catch (error) {
      console.error('Error in cetak PDF:', error);
      
      // Return Laravel URL so mobile can open it directly in browser
      let LARAVEL_BASE_URL_FALLBACK = process.env.LARAVEL_BASE_URL || 'http://192.168.1.10:8000';
      const laravelUrl = `${LARAVEL_BASE_URL_FALLBACK}/admin/penawaran/cetak/${req.params.id}`;
      
      res.status(500).json({
        success: false,
        message: 'Gagal generate PDF melalui proxy. Silakan buka di browser.',
        error: error.message,
        laravelUrl: laravelUrl, // Return URL so mobile can open it
      });
    }
  }
}

module.exports = AdminPenawaranController;

