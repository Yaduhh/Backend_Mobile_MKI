const db = require('../config/database');

class SupervisiPengajuanController {
    /**
     * Get all types of pengajuan for the logged in supervisi
     */
    static async getAllPengajuan(req, res) {
        try {
            const supervisi_id = req.user.id;

            // Get all RAB assigned to this supervisi
            let query = `
                SELECT 
                    rab.id,
                    rab.proyek,
                    rab.pekerjaan,
                    rab.lokasi,
                    rab.kontraktor,
                    rab.json_pengeluaran_entertaiment,
                    rab.json_pengeluaran_material_tambahan,
                    rab.json_pengeluaran_material_pendukung,
                    rab.json_pengeluaran_tukang,
                    rab.json_pengajuan_harga_tukang,
                    rab.json_kerja_tambah,
                    rab.created_at
                FROM rancangan_anggaran_biaya rab
                WHERE rab.supervisi_id = ?
                AND rab.status_deleted = 0
                ORDER BY rab.created_at DESC
            `;

            const [rabs] = await db.query(query, [supervisi_id]);

            const allPengajuan = [];

            const extractNumericValue = (value) => {
                if (typeof value === 'number') return parseFloat(value) || 0;
                if (typeof value === 'string') {
                    let cleanValue = value.replace(/Rp|[\s,]/g, '').replace(/\./g, '');
                    return cleanValue ? parseFloat(cleanValue) || 0 : 0;
                }
                return 0;
            };

            rabs.forEach(rab => {
                // 1. Entertainment (Non Material)
                try {
                    const data = JSON.parse(rab.json_pengeluaran_entertaiment) || [];
                    if (Array.isArray(data)) {
                        data.forEach((group) => {
                            if (group.materials && Array.isArray(group.materials)) {
                                group.materials.forEach(m => {
                                    if (!m.item && !m.sub_total) return;
                                    allPengajuan.push({
                                        id: `ent-${rab.id}-${m.item}-${m.sub_total}`,
                                        rab_id: rab.id,
                                        proyek: rab.proyek,
                                        type: 'Non Material',
                                        item: m.item,
                                        tanggal: group.tanggal || null,
                                        nominal: extractNumericValue(m.sub_total),
                                        status: m.status || 'Pengajuan',
                                        icon: 'star',
                                        color: '#3B82F6'
                                    });
                                });
                            }
                        });
                    }
                } catch (e) { }

                // 2. Material Tambahan
                try {
                    const data = JSON.parse(rab.json_pengeluaran_material_tambahan) || [];
                    if (Array.isArray(data)) {
                        data.forEach((group) => {
                            if (group.materials && Array.isArray(group.materials)) {
                                group.materials.forEach(m => {
                                    if (!m.item && !m.sub_total) return;
                                    allPengajuan.push({
                                        id: `mt-${rab.id}-${m.item}-${m.sub_total}`,
                                        rab_id: rab.id,
                                        proyek: rab.proyek,
                                        type: 'Material Tambahan',
                                        item: m.item,
                                        tanggal: group.tanggal || null,
                                        nominal: extractNumericValue(m.sub_total),
                                        status: m.status || 'Pengajuan',
                                        icon: 'cube',
                                        color: '#6366F1'
                                    });
                                });
                            }
                        });
                    }
                } catch (e) { }

                // 3. Material Pendukung
                try {
                    const data = JSON.parse(rab.json_pengeluaran_material_pendukung) || [];
                    if (Array.isArray(data)) {
                        data.forEach((group) => {
                            if (group.materials && Array.isArray(group.materials)) {
                                group.materials.forEach(m => {
                                    if (!m.item && !m.sub_total) return;
                                    allPengajuan.push({
                                        id: `mp-${rab.id}-${m.item}-${m.sub_total}`,
                                        rab_id: rab.id,
                                        proyek: rab.proyek,
                                        type: 'Material Pendukung',
                                        item: m.item,
                                        tanggal: group.tanggal || null,
                                        nominal: extractNumericValue(m.sub_total),
                                        status: m.status || 'Pengajuan',
                                        icon: 'package-variant',
                                        color: '#0EA5E9'
                                    });
                                });
                            }
                        });
                    }
                } catch (e) { }

                // 4. Tukang
                try {
                    const data = JSON.parse(rab.json_pengeluaran_tukang) || [];
                    if (Array.isArray(data)) {
                        data.forEach((section) => {
                            if (section.termin && Array.isArray(section.termin)) {
                                section.termin.forEach((t, idx) => {
                                    if (!t.kredit) return;
                                    allPengajuan.push({
                                        id: `tk-${rab.id}-${idx}-${t.kredit}`,
                                        rab_id: rab.id,
                                        proyek: rab.proyek,
                                        type: 'Tukang',
                                        item: `Pembayaran Termin ${idx + 1}`,
                                        tanggal: t.tanggal || null,
                                        nominal: extractNumericValue(t.kredit),
                                        status: t.status || 'Pengajuan',
                                        icon: 'account-group',
                                        color: '#A855F7'
                                    });
                                });
                            }
                        });
                    }
                } catch (e) { }

                // 5. Harga Tukang
                try {
                    const data = JSON.parse(rab.json_pengajuan_harga_tukang) || [];
                    if (Array.isArray(data)) {
                        data.forEach((m) => {
                            if (!m.item && !m.total_harga) return;
                            allPengajuan.push({
                                id: `ht-${rab.id}-${m.item}-${m.total_harga}`,
                                rab_id: rab.id,
                                proyek: rab.proyek,
                                type: 'Harga Tukang',
                                item: m.item,
                                tanggal: rab.created_at, // Use RAB date as fallback
                                nominal: extractNumericValue(m.total_harga),
                                status: m.status || 'Pengajuan',
                                icon: 'currency-usd',
                                color: '#10B981'
                            });
                        });
                    }
                } catch (e) { }

                // 6. Kerja Tambah
                try {
                    const data = JSON.parse(rab.json_kerja_tambah) || [];
                    if (Array.isArray(data)) {
                        data.forEach((section) => {
                            if (section.termin && Array.isArray(section.termin)) {
                                section.termin.forEach((t, idx) => {
                                    if (!t.kredit) return;
                                    allPengajuan.push({
                                        id: `kt-${rab.id}-${idx}-${t.kredit}`,
                                        rab_id: rab.id,
                                        proyek: rab.proyek,
                                        type: 'Kerja Tambah',
                                        item: `Kerja Tambah Termin ${idx + 1}`,
                                        tanggal: t.tanggal || null,
                                        nominal: extractNumericValue(t.kredit),
                                        status: t.status || 'Pengajuan',
                                        icon: 'wrench',
                                        color: '#F97316'
                                    });
                                });
                            }
                        });
                    }
                } catch (e) { }
            });

            // Final sort by date descending
            allPengajuan.sort((a, b) => {
                const dateA = a.tanggal ? new Date(a.tanggal) : new Date(0);
                const dateB = b.tanggal ? new Date(b.tanggal) : new Date(0);
                return dateB - dateA;
            });

            res.json({
                status: 'success',
                data: allPengajuan
            });

        } catch (error) {
            console.error('Get supervisi pengajuan error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Terjadi kesalahan pada server',
                error: error.message
            });
        }
    }
}

module.exports = SupervisiPengajuanController;
