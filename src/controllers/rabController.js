const db = require('../config/database');
const { sendNotificationToMasters } = require('../helpers/notificationHelper');

class RabController {
    /**
     * Get dashboard statistics for supervisi
     */
    static async getDashboardStats(req, res) {
        try {
            const supervisiId = req.user.id;

            // Get total RAB count for this supervisi
            const [totalResult] = await db.query(
                'SELECT COUNT(*) as total FROM rancangan_anggaran_biaya WHERE supervisi_id = ? AND status_deleted = 0',
                [supervisiId]
            );

            // Get RAB count by status
            const [statusResult] = await db.query(
                `SELECT 
          status,
          COUNT(*) as count
        FROM rancangan_anggaran_biaya 
        WHERE supervisi_id = ? AND status_deleted = 0
        GROUP BY status`,
                [supervisiId]
            );

            // Format status counts
            const statusCounts = {
                draft: 0,
                on_progress: 0,
                selesai: 0
            };

            statusResult.forEach(row => {
                if (statusCounts.hasOwnProperty(row.status)) {
                    statusCounts[row.status] = row.count;
                }
            });

            res.json({
                status: 'success',
                data: {
                    total: totalResult[0].total,
                    byStatus: statusCounts
                }
            });

        } catch (error) {
            console.error('Get dashboard stats error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Get list of RABs for supervisi
     */
    static async getRABList(req, res) {
        try {
            const supervisiId = req.user.id;
            const { limit = 10, offset = 0, status } = req.query;

            // Build query
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
          u.name as created_by_name
        FROM rancangan_anggaran_biaya rab
        LEFT JOIN users u ON rab.created_by = u.id
        WHERE rab.supervisi_id = ? AND rab.status_deleted = 0
      `;

            const params = [supervisiId];

            // Add status filter if provided
            if (status) {
                query += ' AND rab.status = ?';
                params.push(status);
            }

            query += ' ORDER BY rab.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const [rabs] = await db.query(query, params);

            // Get total count
            let countQuery = 'SELECT COUNT(*) as total FROM rancangan_anggaran_biaya WHERE supervisi_id = ? AND status_deleted = 0';
            const countParams = [supervisiId];

            if (status) {
                countQuery += ' AND status = ?';
                countParams.push(status);
            }

            const [countResult] = await db.query(countQuery, countParams);

            res.json({
                status: 'success',
                data: {
                    rabs,
                    pagination: {
                        total: countResult[0].total,
                        limit: parseInt(limit),
                        offset: parseInt(offset)
                    }
                }
            });

        } catch (error) {
            console.error('Get RAB list error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Get RAB detail by ID
     */
    static async getRABDetail(req, res) {
        try {
            const { id } = req.params;
            const supervisiId = req.user.id;

            // Get RAB detail
            const [rabs] = await db.query(
                `SELECT 
          rab.*,
          u.name as created_by_name,
          u.email as created_by_email,
          pem.nomor_pemasangan,
          pem.json_pemasangan as pemasangan_json
        FROM rancangan_anggaran_biaya rab
        LEFT JOIN users u ON rab.created_by = u.id
        LEFT JOIN pemasangan pem ON rab.pemasangan_id = pem.id
        WHERE rab.id = ? AND rab.supervisi_id = ? AND rab.status_deleted = 0`,
                [id, supervisiId]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan atau Anda tidak memiliki akses'
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
                'json_pengeluaran_pemasangan'
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

            // Format response with pemasangan data
            const formattedRab = {
                ...rab,
                pemasangan: rab.nomor_pemasangan ? {
                    id: rab.pemasangan_id,
                    nomor_pemasangan: rab.nomor_pemasangan,
                    total: pemasanganTotal
                } : null
            };

            // Remove duplicate fields
            delete formattedRab.pemasangan_json;

            res.json({
                status: 'success',
                data: formattedRab
            });

        } catch (error) {
            console.error('Get RAB detail error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update entertainment expenses
     */
    static async updateEntertainment(req, res) {
        try {
            const { id } = req.params;
            const supervisiId = req.user.id;
            const { json_pengeluaran_entertaiment } = req.body;

            // Verify RAB belongs to this supervisi
            const [rabs] = await db.query(
                'SELECT id FROM rancangan_anggaran_biaya WHERE id = ? AND supervisi_id = ? AND status_deleted = 0',
                [id, supervisiId]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan atau Anda tidak memiliki akses'
                });
            }

            // Clean and validate data
            const cleanData = [];
            if (Array.isArray(json_pengeluaran_entertaiment)) {
                for (const mr of json_pengeluaran_entertaiment) {
                    const cleanMaterials = [];
                    if (Array.isArray(mr.materials)) {
                        for (const material of mr.materials) {
                            if (material.supplier || material.item || material.qty || material.harga_satuan) {
                                cleanMaterials.push({
                                    supplier: material.supplier || '',
                                    item: material.item || '',
                                    qty: parseFloat(material.qty) || 0,
                                    satuan: material.satuan || '',
                                    harga_satuan: parseFloat(material.harga_satuan) || 0,
                                    status: material.status || 'Pengajuan',
                                    sub_total: parseFloat(material.sub_total) || 0
                                });
                            }
                        }
                    }
                    if (cleanMaterials.length > 0) {
                        cleanData.push({
                            mr: mr.mr || '',
                            tanggal: mr.tanggal || '',
                            materials: cleanMaterials
                        });
                    }
                }
            }

            // Get existing data to compare with new data
            const [existingRabs] = await db.query(
                'SELECT json_pengeluaran_entertaiment FROM rancangan_anggaran_biaya WHERE id = ?',
                [id]
            );
            let existingData = [];
            if (existingRabs[0]?.json_pengeluaran_entertaiment) {
                try {
                    existingData = JSON.parse(existingRabs[0].json_pengeluaran_entertaiment) || [];
                } catch (e) {
                    existingData = [];
                }
            }

            // Count pengajuan (status "Pengajuan") in existing data
            const existingPengajuanCount = existingData.reduce((count, mr) => {
                if (mr.materials && Array.isArray(mr.materials)) {
                    return count + mr.materials.filter(mat => mat.status === 'Pengajuan').length;
                }
                return count;
            }, 0);

            // Count pengajuan (status "Pengajuan") in new data
            const newPengajuanCount = cleanData.reduce((count, mr) => {
                if (mr.materials && Array.isArray(mr.materials)) {
                    return count + mr.materials.filter(mat => mat.status === 'Pengajuan').length;
                }
                return count;
            }, 0);

            // Check if there are new pengajuan (count increased)
            const hasNewPengajuan = newPengajuanCount > existingPengajuanCount;

            // Get RAB info for notification
            const [rabInfo] = await db.query(
                'SELECT proyek, pekerjaan FROM rancangan_anggaran_biaya WHERE id = ?',
                [id]
            );
            const rabProyek = rabInfo[0]?.proyek || 'RAB';

            // Update RAB
            await db.query(
                'UPDATE rancangan_anggaran_biaya SET json_pengeluaran_entertaiment = ? WHERE id = ?',
                [JSON.stringify(cleanData), id]
            );

            // Send notification to masters only if there are new pengajuan
            if (hasNewPengajuan) {
                await sendNotificationToMasters({
                    title: 'Pengajuan Non Material Baru',
                    body: `Supervisi membuat pengajuan non material untuk proyek: ${rabProyek}`,
                    type: 'pengajuan',
                    relatedId: parseInt(id),
                    relatedType: 'RancanganAnggaranBiaya',
                    actionUrl: `pengajuan/entertainment/${id}`,
                    data: {
                        pengajuanType: 'non_material',
                        rabId: parseInt(id),
                        rabProyek: rabProyek
                    }
                });
            }

            res.json({
                status: 'success',
                message: 'Data pengeluaran entertainment berhasil diperbarui'
            });

        } catch (error) {
            console.error('Update entertainment error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update tukang expenses
     */
    static async updateTukang(req, res) {
        try {
            const { id } = req.params;
            const supervisiId = req.user.id;
            const { json_pengeluaran_tukang } = req.body;

            // Verify RAB belongs to this supervisi
            const [rabs] = await db.query(
                'SELECT id FROM rancangan_anggaran_biaya WHERE id = ? AND supervisi_id = ? AND status_deleted = 0',
                [id, supervisiId]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan atau Anda tidak memiliki akses'
                });
            }

            // Clean and validate data
            const cleanData = [];
            if (Array.isArray(json_pengeluaran_tukang)) {
                for (const section of json_pengeluaran_tukang) {
                    const cleanTermins = [];
                    if (Array.isArray(section.termin)) {
                        for (const termin of section.termin) {
                            if (termin.tanggal || termin.kredit || termin.status) {
                                cleanTermins.push({
                                    tanggal: termin.tanggal || '',
                                    kredit: parseFloat(termin.kredit) || 0,
                                    sisa: parseFloat(termin.sisa) || 0,
                                    persentase: termin.persentase || '',
                                    status: termin.status || 'Pengajuan'
                                });
                            }
                        }
                    }
                    if (cleanTermins.length > 0) {
                        cleanData.push({
                            debet: parseFloat(section.debet) || 0,
                            termin: cleanTermins
                        });
                    }
                }
            }

            // Get existing data to compare with new data
            const [existingRabs] = await db.query(
                'SELECT json_pengeluaran_tukang FROM rancangan_anggaran_biaya WHERE id = ?',
                [id]
            );
            let existingData = [];
            if (existingRabs[0]?.json_pengeluaran_tukang) {
                try {
                    existingData = JSON.parse(existingRabs[0].json_pengeluaran_tukang) || [];
                } catch (e) {
                    existingData = [];
                }
            }

            // Count pengajuan (status "Pengajuan") in existing data
            const existingPengajuanCount = existingData.reduce((count, section) => {
                if (section.termin && Array.isArray(section.termin)) {
                    return count + section.termin.filter(termin => termin.status === 'Pengajuan').length;
                }
                return count;
            }, 0);

            // Count pengajuan (status "Pengajuan") in new data
            const newPengajuanCount = cleanData.reduce((count, section) => {
                if (section.termin && Array.isArray(section.termin)) {
                    return count + section.termin.filter(termin => termin.status === 'Pengajuan').length;
                }
                return count;
            }, 0);

            // Check if there are new pengajuan (count increased)
            const hasNewPengajuan = newPengajuanCount > existingPengajuanCount;

            // Get RAB info for notification
            const [rabInfo] = await db.query(
                'SELECT proyek, pekerjaan FROM rancangan_anggaran_biaya WHERE id = ?',
                [id]
            );
            const rabProyek = rabInfo[0]?.proyek || 'RAB';

            // Update RAB
            await db.query(
                'UPDATE rancangan_anggaran_biaya SET json_pengeluaran_tukang = ? WHERE id = ?',
                [JSON.stringify(cleanData), id]
            );

            // Send notification to masters only if there are new pengajuan
            if (hasNewPengajuan) {
                await sendNotificationToMasters({
                    title: 'Pengajuan Tukang Baru',
                    body: `Supervisi membuat pengajuan tukang untuk proyek: ${rabProyek}`,
                    type: 'pengajuan',
                    relatedId: parseInt(id),
                    relatedType: 'RancanganAnggaranBiaya',
                    actionUrl: `pengajuan/tukang/${id}`,
                    data: {
                        pengajuanType: 'tukang',
                        rabId: parseInt(id),
                        rabProyek: rabProyek
                    }
                });
            }

            res.json({
                status: 'success',
                message: 'Data pengeluaran tukang berhasil diperbarui'
            });

        } catch (error) {
            console.error('Update tukang error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update kerja tambah expenses
     */
    static async updateKerjaTambah(req, res) {
        try {
            const { id } = req.params;
            const supervisiId = req.user.id;
            const { json_kerja_tambah } = req.body;

            // Verify RAB belongs to this supervisi
            const [rabs] = await db.query(
                'SELECT id FROM rancangan_anggaran_biaya WHERE id = ? AND supervisi_id = ? AND status_deleted = 0',
                [id, supervisiId]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan atau Anda tidak memiliki akses'
                });
            }

            // Clean and validate data (same structure as tukang)
            const cleanData = [];
            if (Array.isArray(json_kerja_tambah)) {
                for (const section of json_kerja_tambah) {
                    const cleanTermins = [];
                    if (Array.isArray(section.termin)) {
                        for (const termin of section.termin) {
                            if (termin.tanggal || termin.kredit || termin.status) {
                                cleanTermins.push({
                                    tanggal: termin.tanggal || '',
                                    kredit: parseFloat(termin.kredit) || 0,
                                    sisa: parseFloat(termin.sisa) || 0,
                                    persentase: termin.persentase || '',
                                    status: termin.status || 'Pengajuan'
                                });
                            }
                        }
                    }
                    if (cleanTermins.length > 0) {
                        cleanData.push({
                            debet: parseFloat(section.debet) || 0,
                            termin: cleanTermins
                        });
                    }
                }
            }

            // Get existing data to compare with new data
            const [existingRabs] = await db.query(
                'SELECT json_kerja_tambah FROM rancangan_anggaran_biaya WHERE id = ?',
                [id]
            );
            let existingData = [];
            if (existingRabs[0]?.json_kerja_tambah) {
                try {
                    existingData = JSON.parse(existingRabs[0].json_kerja_tambah) || [];
                } catch (e) {
                    existingData = [];
                }
            }

            // Count pengajuan (status "Pengajuan") in existing data
            const existingPengajuanCount = existingData.reduce((count, section) => {
                if (section.termin && Array.isArray(section.termin)) {
                    return count + section.termin.filter(termin => termin.status === 'Pengajuan').length;
                }
                return count;
            }, 0);

            // Count pengajuan (status "Pengajuan") in new data
            const newPengajuanCount = cleanData.reduce((count, section) => {
                if (section.termin && Array.isArray(section.termin)) {
                    return count + section.termin.filter(termin => termin.status === 'Pengajuan').length;
                }
                return count;
            }, 0);

            // Check if there are new pengajuan (count increased)
            const hasNewPengajuan = newPengajuanCount > existingPengajuanCount;

            // Get RAB info for notification
            const [rabInfo] = await db.query(
                'SELECT proyek, pekerjaan FROM rancangan_anggaran_biaya WHERE id = ?',
                [id]
            );
            const rabProyek = rabInfo[0]?.proyek || 'RAB';

            // Update RAB
            await db.query(
                'UPDATE rancangan_anggaran_biaya SET json_kerja_tambah = ? WHERE id = ?',
                [JSON.stringify(cleanData), id]
            );

            // Send notification to masters only if there are new pengajuan
            if (hasNewPengajuan) {
                await sendNotificationToMasters({
                    title: 'Pengajuan Kerja Tambah Baru',
                    body: `Supervisi membuat pengajuan kerja tambah untuk proyek: ${rabProyek}`,
                    type: 'pengajuan',
                    relatedId: parseInt(id),
                    relatedType: 'RancanganAnggaranBiaya',
                    actionUrl: `pengajuan/kerja-tambah/${id}`,
                    data: {
                        pengajuanType: 'kerja_tambah',
                        rabId: parseInt(id),
                        rabProyek: rabProyek
                    }
                });
            }

            res.json({
                status: 'success',
                message: 'Data kerja tambah berhasil diperbarui'
            });

        } catch (error) {
            console.error('Update kerja tambah error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update material tambahan expenses
     */
    static async updateMaterialTambahan(req, res) {
        try {
            const { id } = req.params;
            const supervisiId = req.user.id;
            const { json_pengeluaran_material_tambahan } = req.body;

            // Verify RAB belongs to this supervisi
            const [rabs] = await db.query(
                'SELECT id FROM rancangan_anggaran_biaya WHERE id = ? AND supervisi_id = ? AND status_deleted = 0',
                [id, supervisiId]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan atau Anda tidak memiliki akses'
                });
            }

            // Clean and validate data (same format as entertainment)
            const cleanData = [];
            if (Array.isArray(json_pengeluaran_material_tambahan)) {
                for (const mr of json_pengeluaran_material_tambahan) {
                    const cleanMaterials = [];
                    if (Array.isArray(mr.materials)) {
                        for (const material of mr.materials) {
                            if (material.supplier || material.item || material.qty || material.harga_satuan) {
                                cleanMaterials.push({
                                    supplier: material.supplier || '',
                                    item: material.item || '',
                                    qty: parseFloat(material.qty) || 0,
                                    satuan: material.satuan || '',
                                    harga_satuan: parseFloat(material.harga_satuan) || 0,
                                    status: material.status || 'Pengajuan',
                                    sub_total: parseFloat(material.sub_total) || 0
                                });
                            }
                        }
                    }
                    if (cleanMaterials.length > 0) {
                        cleanData.push({
                            mr: mr.mr || '',
                            tanggal: mr.tanggal || '',
                            materials: cleanMaterials
                        });
                    }
                }
            }

            // Get existing data to compare with new data
            const [existingRabs] = await db.query(
                'SELECT json_pengeluaran_material_tambahan FROM rancangan_anggaran_biaya WHERE id = ?',
                [id]
            );
            let existingData = [];
            if (existingRabs[0]?.json_pengeluaran_material_tambahan) {
                try {
                    existingData = JSON.parse(existingRabs[0].json_pengeluaran_material_tambahan) || [];
                } catch (e) {
                    existingData = [];
                }
            }

            // Count pengajuan (status "Pengajuan") in existing data
            const existingPengajuanCount = existingData.reduce((count, mr) => {
                if (mr.materials && Array.isArray(mr.materials)) {
                    return count + mr.materials.filter(mat => mat.status === 'Pengajuan').length;
                }
                return count;
            }, 0);

            // Count pengajuan (status "Pengajuan") in new data
            const newPengajuanCount = cleanData.reduce((count, mr) => {
                if (mr.materials && Array.isArray(mr.materials)) {
                    return count + mr.materials.filter(mat => mat.status === 'Pengajuan').length;
                }
                return count;
            }, 0);

            // Check if there are new pengajuan (count increased)
            const hasNewPengajuan = newPengajuanCount > existingPengajuanCount;

            // Get RAB info for notification
            const [rabInfo] = await db.query(
                'SELECT proyek, pekerjaan FROM rancangan_anggaran_biaya WHERE id = ?',
                [id]
            );
            const rabProyek = rabInfo[0]?.proyek || 'RAB';

            // Update RAB
            await db.query(
                'UPDATE rancangan_anggaran_biaya SET json_pengeluaran_material_tambahan = ? WHERE id = ?',
                [JSON.stringify(cleanData), id]
            );

            // Send notification to masters only if there are new pengajuan
            if (hasNewPengajuan) {
                await sendNotificationToMasters({
                    title: 'Pengajuan Material Tambahan Baru',
                    body: `Supervisi membuat pengajuan material tambahan untuk proyek: ${rabProyek}`,
                    type: 'pengajuan',
                    relatedId: parseInt(id),
                    relatedType: 'RancanganAnggaranBiaya',
                    actionUrl: `pengajuan/material-tambahan/${id}`,
                    data: {
                        pengajuanType: 'material_tambahan',
                        rabId: parseInt(id),
                        rabProyek: rabProyek
                    }
                });
            }

            res.json({
                status: 'success',
                message: 'Data pengeluaran material tambahan berhasil diperbarui'
            });

        } catch (error) {
            console.error('Update material tambahan error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }
}

module.exports = RabController;
