const db = require('../config/database');

class AdminRabController {
    /**
     * Get all RABs for admin (no supervisi filter)
     */
    static async getAllRAB(req, res) {
        try {
            const { search, status } = req.query;

            // Build base query
            let query = `
                SELECT 
                    rab.id,
                    rab.proyek,
                    rab.pekerjaan,
                    rab.kontraktor,
                    rab.lokasi,
                    rab.status,
                    rab.created_at,
                    rab.updated_at,
                    rab.supervisi_id,
                    u.name as created_by_name,
                    u.email as created_by_email,
                    s.name as supervisi_name,
                    p.nomor_penawaran,
                    pem.nomor_pemasangan
                FROM rancangan_anggaran_biaya rab
                LEFT JOIN users u ON rab.created_by = u.id
                LEFT JOIN users s ON rab.supervisi_id = s.id
                LEFT JOIN penawaran p ON rab.penawaran_id = p.id
                LEFT JOIN pemasangan pem ON rab.pemasangan_id = pem.id
                WHERE rab.status_deleted = 0
            `;

            const params = [];

            // Search functionality
            if (search) {
                query += ` AND (
                    rab.proyek LIKE ? OR 
                    rab.pekerjaan LIKE ? OR 
                    rab.kontraktor LIKE ? OR 
                    rab.lokasi LIKE ? OR
                    p.nomor_penawaran LIKE ?
                )`;
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
            }

            // Filter by status
            if (status && status !== '') {
                query += ' AND rab.status = ?';
                params.push(status);
            }

            query += ' ORDER BY rab.created_at DESC';

            const [rabs] = await db.query(query, params);

            // Format response with relationships
            const formattedRabs = rabs.map(rab => ({
                id: rab.id,
                proyek: rab.proyek,
                pekerjaan: rab.pekerjaan,
                kontraktor: rab.kontraktor,
                lokasi: rab.lokasi,
                status: rab.status,
                created_at: rab.created_at,
                updated_at: rab.updated_at,
                created_by: rab.created_by,
                supervisi_id: rab.supervisi_id,
                penawaran_id: rab.penawaran_id,
                pemasangan_id: rab.pemasangan_id,
                user: rab.created_by_name ? {
                    id: rab.created_by,
                    name: rab.created_by_name,
                    email: rab.created_by_email
                } : null,
                supervisi: rab.supervisi_name ? {
                    id: rab.supervisi_id,
                    name: rab.supervisi_name
                } : null,
                penawaran: rab.nomor_penawaran ? {
                    id: rab.penawaran_id,
                    nomor_penawaran: rab.nomor_penawaran
                } : null,
                pemasangan: rab.nomor_pemasangan ? {
                    id: rab.pemasangan_id,
                    nomor_pemasangan: rab.nomor_pemasangan
                } : null
            }));

            res.json({
                success: true,
                data: formattedRabs
            });

        } catch (error) {
            console.error('Get admin RAB list error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Get RAB detail by ID (admin)
     */
    static async getRABDetail(req, res) {
        try {
            const { id } = req.params;

            // Get RAB detail with all relationships
            const [rabs] = await db.query(
                `SELECT 
                    rab.*,
                    u.name as created_by_name,
                    u.email as created_by_email,
                    s.name as supervisi_name,
                    s.email as supervisi_email,
                    p.nomor_penawaran,
                    p.total as penawaran_total,
                    pem.nomor_pemasangan,
                    pem.json_pemasangan as pemasangan_json
                FROM rancangan_anggaran_biaya rab
                LEFT JOIN users u ON rab.created_by = u.id
                LEFT JOIN users s ON rab.supervisi_id = s.id
                LEFT JOIN penawaran p ON rab.penawaran_id = p.id
                LEFT JOIN pemasangan pem ON rab.pemasangan_id = pem.id
                WHERE rab.id = ? AND rab.status_deleted = 0`,
                [id]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'RAB tidak ditemukan'
                });
            }

            const rab = rabs[0];

            // Parse JSON fields
            const jsonFields = [
                'json_pengeluaran_material_utama',
                'json_pengeluaran_material_pendukung',
                'json_pengeluaran_entertaiment',
                'json_pengeluaran_tukang',
                'json_kerja_tambah',
                'json_pengeluaran_material_tambahan',
                'json_pengeluaran_pemasangan',
                'json_section_material_pendukung',
                'json_pengajuan_harga_tukang'
            ];

            jsonFields.forEach(field => {
                if (rab[field]) {
                    try {
                        rab[field] = JSON.parse(rab[field]);
                    } catch (e) {
                        rab[field] = [];
                    }
                } else {
                    rab[field] = [];
                }
            });

            // Parse pemasangan json dan hitung total dari table pemasangan
            let pemasanganTotal = 0;
            if (rab.pemasangan_json) {
                try {
                    const pemasanganData = JSON.parse(rab.pemasangan_json);
                    // Struktur json_pemasangan: array of sections, setiap section punya items
                    if (Array.isArray(pemasanganData)) {
                        pemasanganData.forEach((section) => {
                            if (section.items && Array.isArray(section.items)) {
                                section.items.forEach((item) => {
                                    // Hitung dari total_harga atau qty * harga_satuan
                                    let itemTotal = 0;
                                    if (item.total_harga) {
                                        itemTotal = typeof item.total_harga === 'string'
                                            ? parseFloat(item.total_harga.replace(/[^\d]/g, '')) || 0
                                            : (parseFloat(item.total_harga) || 0);
                                    } else if (item.qty && item.harga_satuan) {
                                        const qty = typeof item.qty === 'string'
                                            ? parseFloat(item.qty.replace(/[^\d]/g, '')) || 0
                                            : (parseFloat(item.qty) || 0);
                                        const harga = typeof item.harga_satuan === 'string'
                                            ? parseFloat(item.harga_satuan.replace(/[^\d]/g, '')) || 0
                                            : (parseFloat(item.harga_satuan) || 0);
                                        itemTotal = qty * harga;
                                    }
                                    pemasanganTotal += itemTotal;
                                });
                            }
                        });
                    }
                } catch (e) {
                    // Ignore parse error
                }
            }

            // Format response with relationships
            const formattedRab = {
                ...rab,
                user: rab.created_by_name ? {
                    id: rab.created_by,
                    name: rab.created_by_name,
                    email: rab.created_by_email
                } : null,
                supervisi: rab.supervisi_name ? {
                    id: rab.supervisi_id,
                    name: rab.supervisi_name,
                    email: rab.supervisi_email
                } : null,
                penawaran: rab.nomor_penawaran ? {
                    id: rab.penawaran_id,
                    nomor_penawaran: rab.nomor_penawaran,
                    total: rab.penawaran_total
                } : null,
                pemasangan: rab.nomor_pemasangan ? {
                    id: rab.pemasangan_id,
                    nomor_pemasangan: rab.nomor_pemasangan,
                    total: pemasanganTotal
                } : null
            };

            // Remove duplicate fields
            delete formattedRab.created_by_name;
            delete formattedRab.created_by_email;
            delete formattedRab.supervisi_name;
            delete formattedRab.supervisi_email;
            delete formattedRab.pemasangan_json;
            delete formattedRab.nomor_penawaran;
            delete formattedRab.penawaran_total;
            delete formattedRab.nomor_pemasangan;

            res.json({
                success: true,
                data: formattedRab
            });

        } catch (error) {
            console.error('Get admin RAB detail error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update RAB status (admin)
     */
    static async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            // Validate status
            const validStatuses = ['draft', 'on_progress', 'selesai'];
            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status tidak valid. Status harus: draft, on_progress, atau selesai'
                });
            }

            // Check if RAB exists
            const [rabs] = await db.query(
                'SELECT id FROM rancangan_anggaran_biaya WHERE id = ? AND status_deleted = 0',
                [id]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'RAB tidak ditemukan'
                });
            }

            // Update status
            await db.query(
                'UPDATE rancangan_anggaran_biaya SET status = ? WHERE id = ?',
                [status, id]
            );

            res.json({
                success: true,
                message: 'Status RAB berhasil diubah'
            });

        } catch (error) {
            console.error('Update RAB status error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update supervisi (admin)
     */
    static async updateSupervisi(req, res) {
        try {
            const { id } = req.params;
            const { supervisi_id } = req.body;

            // Check if RAB exists
            const [rabs] = await db.query(
                'SELECT id FROM rancangan_anggaran_biaya WHERE id = ? AND status_deleted = 0',
                [id]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'RAB tidak ditemukan'
                });
            }

            // If supervisi_id provided, verify it exists and is a supervisi
            if (supervisi_id) {
                const [supervisis] = await db.query(
                    'SELECT id, name FROM users WHERE id = ? AND role = 4 AND status_deleted = false',
                    [supervisi_id]
                );

                if (supervisis.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Supervisi tidak ditemukan atau bukan supervisi'
                    });
                }
            }

            // Update supervisi
            await db.query(
                'UPDATE rancangan_anggaran_biaya SET supervisi_id = ? WHERE id = ?',
                [supervisi_id || null, id]
            );

            const message = supervisi_id 
                ? 'Supervisi berhasil diubah' 
                : 'Supervisi berhasil dihapus dari RAB ini';

            res.json({
                success: true,
                message: message
            });

        } catch (error) {
            console.error('Update supervisi error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Get all supervisi users
     */
    static async getAllSupervisi(req, res) {
        try {
            const [supervisis] = await db.query(
                'SELECT id, name, email FROM users WHERE role = 4 AND status_deleted = 0 ORDER BY name ASC'
            );

            res.json({
                success: true,
                data: supervisis
            });
        } catch (error) {
            console.error('Get supervisi list error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }
}

module.exports = AdminRabController;

