const db = require('../config/database');

class AdminPengajuanController {
    /**
     * Get entertainment (non material) list for admin
     */
    static async getEntertainmentList(req, res) {
        try {
            const { status_filter } = req.query;

            // Get all RAB with entertainment data
            let query = `
                SELECT 
                    rab.id,
                    rab.proyek,
                    rab.pekerjaan,
                    rab.status as rab_status,
                    rab.supervisi_id,
                    rab.json_pengeluaran_entertaiment,
                    u.name as supervisi_nama
                FROM rancangan_anggaran_biaya rab
                LEFT JOIN users u ON rab.supervisi_id = u.id
                WHERE rab.json_pengeluaran_entertaiment IS NOT NULL 
                AND rab.json_pengeluaran_entertaiment != '[]'
                AND rab.status != 'selesai'
                AND rab.status_deleted = 0
                ORDER BY rab.created_at DESC
            `;

            const [rabs] = await db.query(query);

            // Process and flatten data
            const entertainments = [];
            rabs.forEach(rab => {
                let jsonData = [];
                try {
                    jsonData = JSON.parse(rab.json_pengeluaran_entertaiment) || [];
                } catch (e) {
                    jsonData = [];
                }

                if (Array.isArray(jsonData)) {
                    jsonData.forEach((mrGroup, mrIndex) => {
                        if (mrGroup.materials && Array.isArray(mrGroup.materials)) {
                            mrGroup.materials.forEach((material, materialIndex) => {
                                // Skip data yang semua field-nya null atau kosong (sesuai Laravel)
                                if (!material.supplier && !material.item && !material.qty && 
                                    !material.satuan && !material.harga_satuan && !material.sub_total) {
                                    return;
                                }

                                entertainments.push({
                                    rab_id: rab.id,
                                    rab_proyek: rab.proyek,
                                    rab_pekerjaan: rab.pekerjaan,
                                    rab_status: rab.rab_status,
                                    supervisi_id: rab.supervisi_id,
                                    supervisi_nama: rab.supervisi_nama || '-',
                                    mr: mrGroup.mr || '-',
                                    tanggal: (mrGroup.tanggal && mrGroup.tanggal !== '-') ? mrGroup.tanggal : null,
                                    supplier: material.supplier || '-',
                                    item: material.item || '-',
                                    qty: material.qty || '-',
                                    satuan: material.satuan || '-',
                                    harga_satuan: parseFloat(material.harga_satuan) || 0,
                                    sub_total: parseFloat(material.sub_total) || 0,
                                    status: material.status || 'Pengajuan',
                                    mr_index: mrIndex,
                                    material_index: materialIndex
                                });
                            });
                        }
                    });
                }
            });

            // Filter by status if provided
            let filteredData = entertainments;
            if (status_filter) {
                filteredData = entertainments.filter(item => item.status === status_filter);
            }

            // Sort by tanggal descending (sesuai Laravel)
            filteredData.sort((a, b) => {
                if (!a.tanggal && !b.tanggal) return 0;
                if (!a.tanggal) return 1;
                if (!b.tanggal) return -1;
                return new Date(b.tanggal) - new Date(a.tanggal);
            });

            res.json({
                status: 'success',
                entertainments: filteredData
            });

        } catch (error) {
            console.error('Get entertainment list error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update entertainment status
     */
    static async updateEntertainmentStatus(req, res) {
        try {
            const { id } = req.params;
            const { entertainment_index, material_index, status } = req.body;

            // Validate status
            if (!['Pengajuan', 'Disetujui', 'Ditolak'].includes(status)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Status tidak valid'
                });
            }

            // Get RAB
            const [rabs] = await db.query(
                'SELECT json_pengeluaran_entertaiment FROM rancangan_anggaran_biaya WHERE id = ? AND status_deleted = 0',
                [id]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan'
                });
            }

            // Parse JSON
            let entertainmentData = [];
            try {
                entertainmentData = JSON.parse(rabs[0].json_pengeluaran_entertaiment) || [];
            } catch (e) {
                entertainmentData = [];
            }

            // Update status (sesuai Laravel)
            if (entertainmentData[entertainment_index] &&
                entertainmentData[entertainment_index].materials &&
                entertainmentData[entertainment_index].materials[material_index]) {

                entertainmentData[entertainment_index].materials[material_index].status = status;

                // Update database
                await db.query(
                    'UPDATE rancangan_anggaran_biaya SET json_pengeluaran_entertaiment = ? WHERE id = ?',
                    [JSON.stringify(entertainmentData), id]
                );

                res.json({
                    status: 'success',
                    message: 'Status material berhasil diperbarui'
                });
            } else {
                res.status(404).json({
                    status: 'error',
                    message: 'Data tidak ditemukan'
                });
            }

        } catch (error) {
            console.error('Update entertainment status error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Get material tambahan list for admin
     */
    static async getMaterialTambahanList(req, res) {
        try {
            const { status_filter } = req.query;

            const query = `
                SELECT 
                    rab.id,
                    rab.proyek,
                    rab.pekerjaan,
                    rab.status as rab_status,
                    rab.supervisi_id,
                    rab.json_pengeluaran_material_tambahan,
                    u.name as supervisi_nama
                FROM rancangan_anggaran_biaya rab
                LEFT JOIN users u ON rab.supervisi_id = u.id
                WHERE rab.json_pengeluaran_material_tambahan IS NOT NULL 
                AND rab.json_pengeluaran_material_tambahan != '[]'
                AND rab.status != 'selesai'
                AND rab.status_deleted = 0
                ORDER BY rab.created_at DESC
            `;

            const [rabs] = await db.query(query);

            const materialTambahans = [];
            rabs.forEach(rab => {
                let jsonData = [];
                try {
                    jsonData = JSON.parse(rab.json_pengeluaran_material_tambahan) || [];
                } catch (e) {
                    jsonData = [];
                }

                if (Array.isArray(jsonData)) {
                    jsonData.forEach((mrGroup, mrIndex) => {
                        if (mrGroup.materials && Array.isArray(mrGroup.materials)) {
                            mrGroup.materials.forEach((material, materialIndex) => {
                                // Skip data yang semua field-nya null atau kosong (sesuai Laravel)
                                if (!material.supplier && !material.item && !material.qty && 
                                    !material.satuan && !material.harga_satuan && !material.sub_total) {
                                    return;
                                }

                                // Extract numeric value (sesuai Laravel extractNumericValue method)
                                const extractNumericValue = (value) => {
                                    if (typeof value === 'number') {
                                        return parseFloat(value) || 0;
                                    }
                                    if (typeof value === 'string') {
                                        // Remove Rp, spaces, and commas
                                        let cleanValue = value.replace(/Rp|[\s,]/g, '');
                                        // Handle dots (thousands separator or decimal)
                                        if (cleanValue.includes('.')) {
                                            const parts = cleanValue.split('.');
                                            if (parts.length === 2 && parts[1].length === 3) {
                                                // Likely thousands separator
                                                cleanValue = cleanValue.replace(/\./g, '');
                                            }
                                        }
                                        return cleanValue ? parseFloat(cleanValue) || 0 : 0;
                                    }
                                    return 0;
                                };

                                materialTambahans.push({
                                    rab_id: rab.id,
                                    rab_proyek: rab.proyek,
                                    rab_pekerjaan: rab.pekerjaan,
                                    rab_status: rab.rab_status,
                                    supervisi_id: rab.supervisi_id,
                                    supervisi_nama: rab.supervisi_nama || '-',
                                    mr: mrGroup.mr || '-',
                                    tanggal: (mrGroup.tanggal && mrGroup.tanggal !== '-') ? mrGroup.tanggal : null,
                                    supplier: material.supplier || '-',
                                    item: material.item || '-',
                                    qty: material.qty || '-',
                                    satuan: material.satuan || '-',
                                    harga_satuan: extractNumericValue(material.harga_satuan),
                                    sub_total: extractNumericValue(material.sub_total),
                                    status: material.status || 'Pengajuan',
                                    mr_index: mrIndex,
                                    material_index: materialIndex
                                });
                            });
                        }
                    });
                }
            });

            let filteredData = materialTambahans;
            if (status_filter) {
                filteredData = materialTambahans.filter(item => item.status === status_filter);
            }

            // Sort by tanggal descending (sesuai Laravel)
            filteredData.sort((a, b) => {
                if (!a.tanggal && !b.tanggal) return 0;
                if (!a.tanggal) return 1;
                if (!b.tanggal) return -1;
                return new Date(b.tanggal) - new Date(a.tanggal);
            });

            res.json({
                status: 'success',
                materialTambahans: filteredData
            });

        } catch (error) {
            console.error('Get material tambahan list error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update material tambahan status
     */
    static async updateMaterialTambahanStatus(req, res) {
        try {
            const { id } = req.params;
            const { material_tambahan_index, material_index, status } = req.body;

            if (!['Pengajuan', 'Disetujui', 'Ditolak'].includes(status)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Status tidak valid'
                });
            }

            const [rabs] = await db.query(
                'SELECT json_pengeluaran_material_tambahan FROM rancangan_anggaran_biaya WHERE id = ? AND status_deleted = 0',
                [id]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan'
                });
            }

            let materialData = [];
            try {
                materialData = JSON.parse(rabs[0].json_pengeluaran_material_tambahan) || [];
            } catch (e) {
                materialData = [];
            }

            if (materialData[material_tambahan_index] &&
                materialData[material_tambahan_index].materials &&
                materialData[material_tambahan_index].materials[material_index]) {

                materialData[material_tambahan_index].materials[material_index].status = status;

                await db.query(
                    'UPDATE rancangan_anggaran_biaya SET json_pengeluaran_material_tambahan = ? WHERE id = ?',
                    [JSON.stringify(materialData), id]
                );

                res.json({
                    status: 'success',
                    message: 'Status material tambahan berhasil diperbarui'
                });
            } else {
                res.status(404).json({
                    status: 'error',
                    message: 'Data tidak ditemukan'
                });
            }

        } catch (error) {
            console.error('Update material tambahan status error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Get tukang list for admin
     */
    static async getTukangList(req, res) {
        try {
            const { status_filter } = req.query;

            const query = `
                SELECT 
                    rab.id,
                    rab.proyek,
                    rab.pekerjaan,
                    rab.status as rab_status,
                    rab.supervisi_id,
                    rab.json_pengeluaran_tukang,
                    u.name as supervisi_nama
                FROM rancangan_anggaran_biaya rab
                LEFT JOIN users u ON rab.supervisi_id = u.id
                WHERE rab.json_pengeluaran_tukang IS NOT NULL 
                AND rab.json_pengeluaran_tukang != '[]'
                AND rab.status != 'selesai'
                AND rab.status_deleted = 0
                ORDER BY rab.created_at DESC
            `;

            const [rabs] = await db.query(query);

            const tukangs = [];
            rabs.forEach(rab => {
                let jsonData = [];
                try {
                    jsonData = JSON.parse(rab.json_pengeluaran_tukang) || [];
                } catch (e) {
                    jsonData = [];
                }

                if (Array.isArray(jsonData)) {
                    jsonData.forEach((section, sectionIndex) => {
                        if (section.termin && Array.isArray(section.termin)) {
                            section.termin.forEach((termin, terminIndex) => {
                                // Skip data yang semua field-nya null atau kosong (sesuai Laravel)
                                if (!termin.tanggal && !termin.kredit && 
                                    !termin.sisa && !termin.persentase) {
                                    return;
                                }

                                tukangs.push({
                                    rab_id: rab.id,
                                    rab_proyek: rab.proyek,
                                    rab_pekerjaan: rab.pekerjaan,
                                    rab_status: rab.rab_status,
                                    supervisi_id: rab.supervisi_id,
                                    supervisi_nama: rab.supervisi_nama || '-',
                                    debet: parseFloat(section.debet) || 0,
                                    tanggal: termin.tanggal || null,
                                    kredit: parseFloat(termin.kredit) || 0,
                                    sisa: parseFloat(termin.sisa) || 0,
                                    persentase: termin.persentase || '0%',
                                    status: termin.status || 'Pengajuan',
                                    section_index: sectionIndex,
                                    termin_index: terminIndex
                                });
                            });
                        }
                    });
                }
            });

            let filteredData = tukangs;
            if (status_filter) {
                filteredData = tukangs.filter(item => item.status === status_filter);
            }

            // Sort by tanggal descending (sesuai Laravel)
            filteredData.sort((a, b) => {
                if (!a.tanggal && !b.tanggal) return 0;
                if (!a.tanggal) return 1;
                if (!b.tanggal) return -1;
                return new Date(b.tanggal) - new Date(a.tanggal);
            });

            res.json({
                status: 'success',
                tukangs: filteredData
            });

        } catch (error) {
            console.error('Get tukang list error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update tukang status
     */
    static async updateTukangStatus(req, res) {
        try {
            const { id } = req.params;
            const { section_index, termin_index, status } = req.body;

            if (!['Pengajuan', 'Disetujui', 'Ditolak'].includes(status)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Status tidak valid'
                });
            }

            const [rabs] = await db.query(
                'SELECT json_pengeluaran_tukang FROM rancangan_anggaran_biaya WHERE id = ? AND status_deleted = 0',
                [id]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan'
                });
            }

            let tukangData = [];
            try {
                tukangData = JSON.parse(rabs[0].json_pengeluaran_tukang) || [];
            } catch (e) {
                tukangData = [];
            }

            if (tukangData[section_index] &&
                tukangData[section_index].termin &&
                tukangData[section_index].termin[termin_index]) {

                tukangData[section_index].termin[termin_index].status = status;

                await db.query(
                    'UPDATE rancangan_anggaran_biaya SET json_pengeluaran_tukang = ? WHERE id = ?',
                    [JSON.stringify(tukangData), id]
                );

                res.json({
                    status: 'success',
                    message: 'Status termin tukang berhasil diperbarui'
                });
            } else {
                res.status(404).json({
                    status: 'error',
                    message: 'Data tidak ditemukan'
                });
            }

        } catch (error) {
            console.error('Update tukang status error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Get kerja tambah list for admin
     */
    static async getKerjaTambahList(req, res) {
        try {
            const { status_filter } = req.query;

            const query = `
                SELECT 
                    rab.id,
                    rab.proyek,
                    rab.pekerjaan,
                    rab.kontraktor,
                    rab.lokasi,
                    rab.json_kerja_tambah
                FROM rancangan_anggaran_biaya rab
                WHERE rab.json_kerja_tambah IS NOT NULL 
                AND rab.json_kerja_tambah != 'null'
                AND rab.status != 'selesai'
                AND rab.status_deleted = 0
                ORDER BY rab.created_at DESC
            `;

            const [rabs] = await db.query(query);

            const kerjaTambahData = [];
            rabs.forEach(rab => {
                let jsonData = [];
                try {
                    jsonData = JSON.parse(rab.json_kerja_tambah) || [];
                } catch (e) {
                    jsonData = [];
                }

                if (Array.isArray(jsonData)) {
                    jsonData.forEach(section => {
                        if (section.termin && Array.isArray(section.termin)) {
                            section.termin.forEach(termin => {
                                kerjaTambahData.push({
                                    id: rab.id,
                                    proyek: rab.proyek,
                                    pekerjaan: rab.pekerjaan,
                                    kontraktor: rab.kontraktor,
                                    lokasi: rab.lokasi,
                                    tanggal: termin.tanggal || '-',
                                    kredit: parseFloat(termin.kredit) || 0,
                                    sisa: parseFloat(termin.sisa) || 0,
                                    persentase: termin.persentase || '-',
                                    status: termin.status || 'Pengajuan',
                                    debet: parseFloat(section.debet) || 0
                                });
                            });
                        }
                    });
                }
            });

            let filteredData = kerjaTambahData;
            if (status_filter) {
                filteredData = kerjaTambahData.filter(item => item.status === status_filter);
            }

            // Sort by tanggal descending (sesuai Laravel)
            filteredData.sort((a, b) => {
                // Handle '-' as tanggal
                if ((!a.tanggal || a.tanggal === '-') && (!b.tanggal || b.tanggal === '-')) return 0;
                if (!a.tanggal || a.tanggal === '-') return 1;
                if (!b.tanggal || b.tanggal === '-') return -1;
                return new Date(b.tanggal) - new Date(a.tanggal);
            });

            res.json({
                status: 'success',
                kerjaTambahData: filteredData
            });

        } catch (error) {
            console.error('Get kerja tambah list error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }

    /**
     * Update kerja tambah status
     */
    static async updateKerjaTambahStatus(req, res) {
        try {
            const { id } = req.params;
            const { tanggal, kredit, status } = req.body;

            if (!['Pengajuan', 'Disetujui', 'Ditolak'].includes(status)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Status tidak valid'
                });
            }

            const [rabs] = await db.query(
                'SELECT json_kerja_tambah FROM rancangan_anggaran_biaya WHERE id = ? AND status_deleted = 0',
                [id]
            );

            if (rabs.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'RAB tidak ditemukan'
                });
            }

            let kerjaTambahData = [];
            try {
                kerjaTambahData = JSON.parse(rabs[0].json_kerja_tambah) || [];
            } catch (e) {
                kerjaTambahData = [];
            }

            let updated = false;
            for (let section of kerjaTambahData) {
                if (section.termin && Array.isArray(section.termin)) {
                    for (let termin of section.termin) {
                        if (termin.tanggal === tanggal && parseFloat(termin.kredit) == parseFloat(kredit)) {
                            termin.status = status;
                            updated = true;
                            break;
                        }
                    }
                }
                if (updated) break;
            }

            if (updated) {
                await db.query(
                    'UPDATE rancangan_anggaran_biaya SET json_kerja_tambah = ? WHERE id = ?',
                    [JSON.stringify(kerjaTambahData), id]
                );

                res.json({
                    status: 'success',
                    message: 'Status termin kerja tambah berhasil diperbarui'
                });
            } else {
                res.status(404).json({
                    status: 'error',
                    message: 'Data tidak ditemukan'
                });
            }

        } catch (error) {
            console.error('Update kerja tambah status error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }
}

module.exports = AdminPengajuanController;
