const db = require('../config/database');

class AdminPemasanganController {
  /**
   * Get pemasangan detail by ID
   */
  static async getPemasanganDetail(req, res) {
    try {
      const { id } = req.params;

      // Get pemasangan with relationships
      const [pemasangans] = await db.query(
        `SELECT 
          p.*,
          c.nama as client_nama,
          c.email as client_email,
          c.notelp as client_notelp,
          c.alamat as client_alamat,
          u.name as sales_name,
          u.email as sales_email,
          pen.nomor_penawaran,
          pen.penawaran_pintu,
          pemasangan_asli.nomor_pemasangan as pemasangan_asli_nomor,
          pemasangan_asli.judul_pemasangan as pemasangan_asli_judul,
          pemasangan_asli.created_at as pemasangan_asli_created_at
        FROM pemasangan p
        LEFT JOIN clients c ON p.id_client = c.id
        LEFT JOIN users u ON p.id_sales = u.id
        LEFT JOIN penawaran pen ON p.id_penawaran = pen.id
        LEFT JOIN pemasangan pemasangan_asli ON p.revisi_from = pemasangan_asli.id
        WHERE p.id = ? AND p.status_deleted = 0`,
        [id]
      );

      if (pemasangans.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pemasangan tidak ditemukan'
        });
      }

      const pemasangan = pemasangans[0];

      // Format pemasangan data
      const formatted = {
        id: pemasangan.id,
        nomor_pemasangan: pemasangan.nomor_pemasangan,
        tanggal_pemasangan: pemasangan.tanggal_pemasangan,
        judul_pemasangan: pemasangan.judul_pemasangan,
        logo: pemasangan.logo,
        total: parseFloat(pemasangan.total || 0),
        diskon: parseFloat(pemasangan.diskon || 0),
        grand_total: parseFloat(pemasangan.grand_total || 0),
        ppn: parseInt(pemasangan.ppn || 0),
        status: parseInt(pemasangan.status || 0),
        is_revisi: pemasangan.is_revisi ? true : false,
        revisi_from: pemasangan.revisi_from,
        catatan_revisi: pemasangan.catatan_revisi,
        created_at: pemasangan.created_at,
        client: {
          id: pemasangan.id_client,
          nama: pemasangan.client_nama,
          email: pemasangan.client_email,
          notelp: pemasangan.client_notelp,
          alamat: pemasangan.client_alamat,
        },
        sales: {
          id: pemasangan.id_sales,
          name: pemasangan.sales_name,
          email: pemasangan.sales_email,
        },
        penawaran: {
          id: pemasangan.id_penawaran,
          nomor_penawaran: pemasangan.nomor_penawaran,
          penawaran_pintu: pemasangan.penawaran_pintu ? true : false,
        },
        pemasanganAsli: pemasangan.revisi_from ? {
          id: pemasangan.revisi_from,
          nomor_pemasangan: pemasangan.pemasangan_asli_nomor,
          judul_pemasangan: pemasangan.pemasangan_asli_judul,
          created_at: pemasangan.pemasangan_asli_created_at,
        } : null,
      };

      // Parse JSON fields
      if (pemasangan.json_pemasangan) {
        try {
          formatted.json_pemasangan = typeof pemasangan.json_pemasangan === 'string' 
            ? JSON.parse(pemasangan.json_pemasangan) 
            : pemasangan.json_pemasangan;
        } catch (e) {
          formatted.json_pemasangan = [];
        }
      } else {
        formatted.json_pemasangan = [];
      }

      if (pemasangan.json_syarat_kondisi) {
        try {
          formatted.json_syarat_kondisi = typeof pemasangan.json_syarat_kondisi === 'string'
            ? JSON.parse(pemasangan.json_syarat_kondisi)
            : pemasangan.json_syarat_kondisi;
        } catch (e) {
          formatted.json_syarat_kondisi = [];
        }
      } else {
        formatted.json_syarat_kondisi = [];
      }

      // Get revisi list (if this is original pemasangan)
      if (!pemasangan.is_revisi) {
        const [revisiList] = await db.query(
          `SELECT id, nomor_pemasangan, judul_pemasangan, created_at, catatan_revisi, is_revisi
           FROM pemasangan
           WHERE revisi_from = ? AND status_deleted = 0
           ORDER BY created_at ASC`,
          [id]
        );
        formatted.revisi = revisiList || [];
      } else {
        formatted.revisi = [];
      }

      // Calculate status_revisi (R1, R2, R3)
      if (formatted.is_revisi) {
        const revisionMatch = formatted.nomor_pemasangan?.match(/\s+R(\d+)$/);
        formatted.status_revisi = revisionMatch ? `R${revisionMatch[1]}` : null;
      } else {
        formatted.status_revisi = null;
      }

      res.json({
        success: true,
        data: formatted
      });

    } catch (error) {
      console.error('Get pemasangan detail error:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
        error: error.message
      });
    }
  }
}

module.exports = AdminPemasanganController;

