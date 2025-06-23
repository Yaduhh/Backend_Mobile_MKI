const pool = require('../config/database');

const adminClientController = {
  // Get all clients (admin can see all clients from all sales)
  getAllClients: async (req, res) => {
    try {
      const query = `
        SELECT 
          c.*, 
          u.name as sales_name,
          creator.name as creator_name,
          COALESCE(COUNT(da.id), 0) as visit_count
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN users creator ON c.created_by = creator.id
        LEFT JOIN daily_activities da ON c.id = da.pihak_bersangkutan AND da.deleted_status = false
        WHERE c.status_deleted = false
        GROUP BY c.id, c.nama, c.email, c.notelp, c.nama_perusahaan, c.alamat, c.description_json, c.status, c.created_by, c.created_at, c.updated_at, u.name, creator.name
        ORDER BY c.created_at DESC
      `;
      
      const [clients] = await pool.query(query);
      
      // Transform description_json to description array
      const transformedClients = clients.map(client => ({
        ...client,
        description: client.description_json ? JSON.parse(client.description_json).items : [],
        creator: {
          name: client.creator_name || null
        }
      }));
      
      res.json({
        success: true,
        data: transformedClients,
        message: 'Data client berhasil diambil'
      });
    } catch (error) {
      console.error('Error in getAllClients:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data client'
      });
    }
  },

  // Get client by ID
  getClientById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const query = `
        SELECT 
          c.*, 
          u.name as sales_name,
          creator.name as creator_name,
          COALESCE(COUNT(da.id), 0) as visit_count
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN users creator ON c.created_by = creator.id
        LEFT JOIN daily_activities da ON c.id = da.pihak_bersangkutan AND da.deleted_status = false
        WHERE c.id = ? AND c.status_deleted = false
        GROUP BY c.id, c.nama, c.email, c.notelp, c.nama_perusahaan, c.alamat, c.description_json, c.status, c.created_by, c.created_at, c.updated_at, u.name, creator.name
      `;
      
      const [clients] = await pool.query(query, [id]);
      
      if (clients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client tidak ditemukan'
        });
      }

      const client = clients[0];
      // Transform description_json to description array
      client.description = client.description_json ? JSON.parse(client.description_json).items : [];
      
      // Add creator object for consistency with frontend
      client.creator = {
        name: client.creator_name || null
      };
      
      res.json({
        success: true,
        data: client,
        message: 'Detail client berhasil diambil'
      });
    } catch (error) {
      console.error('Error in getClientById:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil detail client'
      });
    }
  },

  // Create new client
  createClient: async (req, res) => {
    try {
      const {
        nama,
        email,
        notelp,
        nama_perusahaan,
        alamat,
        description,
        created_by,
        status = true
      } = req.body;
      
      // Validasi input
      if (!nama || !notelp || !nama_perusahaan || !alamat) {
        return res.status(400).json({
          success: false,
          message: 'Nama, nomor telepon, nama perusahaan, dan alamat harus diisi'
        });
      }
      
      // Validasi email jika diisi
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: 'Format email tidak valid'
          });
        }
      }
      
      // Validasi nomor telepon
      const phoneRegex = /^\d{10,15}$/;
      if (!phoneRegex.test(notelp.replace(/\D/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Nomor telepon harus 10-15 digit'
        });
      }
      
      // Check if created_by exists and is a sales
      if (created_by) {
        const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [created_by]);
        if (users.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Sales tidak ditemukan'
          });
        }
        if (users[0].role !== 2) {
          return res.status(400).json({
            success: false,
            message: 'User yang dipilih bukan sales'
          });
        }
      }
      
      // Create description_json with proper format and escaping
      const description_json = description && description.length > 0 
        ? JSON.stringify(JSON.stringify({ items: description }))
        : JSON.stringify(JSON.stringify({ items: [] }));

      // Get current timestamp
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      const query = `
        INSERT INTO clients (
          nama, email, notelp, nama_perusahaan, alamat, 
          description_json, status, created_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await pool.query(query, [
        nama,
        email || null,
        notelp,
        nama_perusahaan,
        alamat,
        description_json,
        status,
        created_by || null,
        now,
        now
      ]);
      
      // Get the created client
      const [newClient] = await pool.query(
        'SELECT * FROM clients WHERE id = ?',
        [result.insertId]
      );

      // Parse description_json back to array for response
      const parsedDescription = newClient[0].description_json 
        ? JSON.parse(JSON.parse(newClient[0].description_json)).items 
        : [];
      
      res.status(201).json({
        success: true,
        data: {
          ...newClient[0],
          description: parsedDescription
        },
        message: 'Client berhasil dibuat'
      });
    } catch (error) {
      console.error('Error in createClient:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat membuat client'
      });
    }
  },

  // Update client
  updateClient: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        nama,
        email,
        notelp,
        nama_perusahaan,
        alamat,
        description,
        created_by,
        status
      } = req.body;
      
      // Check if client exists
      const [existingClient] = await pool.query(
        'SELECT * FROM clients WHERE id = ? AND status_deleted = false',
        [id]
      );
      
      if (existingClient.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client tidak ditemukan'
        });
      }
      
      // Validasi input
      if (!nama || !notelp || !nama_perusahaan || !alamat) {
        return res.status(400).json({
          success: false,
          message: 'Nama, nomor telepon, nama perusahaan, dan alamat harus diisi'
        });
      }
      
      // Validasi email jika diisi
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: 'Format email tidak valid'
          });
        }
      }
      
      // Validasi nomor telepon
      const phoneRegex = /^\d{10,15}$/;
      if (!phoneRegex.test(notelp.replace(/\D/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Nomor telepon harus 10-15 digit'
        });
      }
      
      // Check if created_by exists and is a sales
      if (created_by) {
        const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [created_by]);
        if (users.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Sales tidak ditemukan'
          });
        }
        if (users[0].role !== 2) {
          return res.status(400).json({
            success: false,
            message: 'User yang dipilih bukan sales'
          });
        }
      }
      
      // Create description_json with proper format and escaping
      const description_json = description && description.length > 0 
        ? JSON.stringify(JSON.stringify({ items: description }))
        : JSON.stringify(JSON.stringify({ items: [] }));

      // Get current timestamp
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      const updateQuery = `
        UPDATE clients 
        SET 
          nama = ?,
          email = ?,
          notelp = ?,
          nama_perusahaan = ?,
          alamat = ?,
          description_json = ?,
          status = ?,
          created_by = ?,
          updated_at = ?
        WHERE id = ?
      `;
      
      await pool.query(updateQuery, [
        nama,
        email || null,
        notelp,
        nama_perusahaan,
        alamat,
        description_json,
        status !== undefined ? status : existingClient[0].status,
        created_by || null,
        now,
        id
      ]);
      
      // Get the updated client
      const [updatedClient] = await pool.query(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      );

      // Parse description_json back to array for response
      const parsedDescription = updatedClient[0].description_json 
        ? JSON.parse(JSON.parse(updatedClient[0].description_json)).items 
        : [];
      
      res.json({
        success: true,
        data: {
          ...updatedClient[0],
          description: parsedDescription
        },
        message: 'Client berhasil diupdate'
      });
    } catch (error) {
      console.error('Error in updateClient:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengupdate client'
      });
    }
  },

  // Delete client (soft delete)
  deleteClient: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if client exists
      const [existingClient] = await pool.query(
        'SELECT * FROM clients WHERE id = ? AND status_deleted = false',
        [id]
      );
      
      if (existingClient.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client tidak ditemukan'
        });
      }
      
      // Soft delete
      await pool.query('UPDATE clients SET status_deleted = true WHERE id = ?', [id]);
      
      res.json({
        success: true,
        message: 'Client berhasil dihapus'
      });
    } catch (error) {
      console.error('Error in deleteClient:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat menghapus client'
      });
    }
  },

  // Restore client
  restoreClient: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if client exists and is deleted
      const [existingClient] = await pool.query(
        'SELECT * FROM clients WHERE id = ? AND status_deleted = true',
        [id]
      );
      
      if (existingClient.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client yang dihapus tidak ditemukan'
        });
      }
      
      // Restore
      await pool.query('UPDATE clients SET status_deleted = false WHERE id = ?', [id]);
      
      res.json({
        success: true,
        message: 'Client berhasil dipulihkan'
      });
    } catch (error) {
      console.error('Error in restoreClient:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat memulihkan client'
      });
    }
  },

  // Get deleted clients
  getDeletedClients: async (req, res) => {
    try {
      const query = `
        SELECT 
          c.*,
          u.name as sales_name
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.status_deleted = true
        ORDER BY c.updated_at DESC
      `;
      
      const [clients] = await pool.query(query);
      
      // Transform description_json to description array
      const transformedClients = clients.map(client => ({
        ...client,
        description: client.description_json ? JSON.parse(client.description_json).items : []
      }));
      
      res.json({
        success: true,
        data: transformedClients,
        message: 'Data client yang dihapus berhasil diambil'
      });
    } catch (error) {
      console.error('Error in getDeletedClients:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data client yang dihapus'
      });
    }
  },

  // Search clients
  searchClients: async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Query pencarian diperlukan'
        });
      }
      
      const searchQuery = `
        SELECT 
          c.*, 
          u.name as sales_name,
          COALESCE(COUNT(da.id), 0) as visit_count
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN daily_activities da ON c.id = da.pihak_bersangkutan AND da.deleted_status = false
        WHERE c.status_deleted = false
          AND (c.nama LIKE ? OR c.email LIKE ? OR c.nama_perusahaan LIKE ? OR c.notelp LIKE ? OR u.name LIKE ?)
        GROUP BY c.id, c.nama, c.email, c.notelp, c.nama_perusahaan, c.alamat, c.description_json, c.status, c.created_by, c.created_at, c.updated_at, u.name
        ORDER BY c.created_at DESC
      `;
      
      const searchTerm = `%${q}%`;
      const [clients] = await pool.query(searchQuery, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);
      
      // Transform description_json to description array
      const transformedClients = clients.map(client => ({
        ...client,
        description: client.description_json ? JSON.parse(client.description_json).items : []
      }));
      
      res.json({
        success: true,
        data: transformedClients,
        message: 'Pencarian client berhasil'
      });
    } catch (error) {
      console.error('Error in searchClients:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mencari client'
      });
    }
  },

  // Get clients by sales ID
  getClientsBySales: async (req, res) => {
    try {
      const { salesId } = req.params;
      
      // Check if sales exists
      const [sales] = await pool.query('SELECT * FROM users WHERE id = ? AND role = 2', [salesId]);
      if (sales.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sales tidak ditemukan'
        });
      }
      
      const query = `
        SELECT 
          c.*, 
          u.name as sales_name,
          COALESCE(COUNT(da.id), 0) as visit_count
        FROM clients c
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN daily_activities da ON c.id = da.pihak_bersangkutan AND da.deleted_status = false
        WHERE c.created_by = ? AND c.status_deleted = false
        GROUP BY c.id, c.nama, c.email, c.notelp, c.nama_perusahaan, c.alamat, c.description_json, c.status, c.created_by, c.created_at, c.updated_at, u.name
        ORDER BY c.created_at DESC
      `;
      
      const [clients] = await pool.query(query, [salesId]);
      
      // Transform description_json to description array
      const transformedClients = clients.map(client => ({
        ...client,
        description: client.description_json ? JSON.parse(client.description_json).items : []
      }));
      
      res.json({
        success: true,
        data: transformedClients,
        message: 'Data client sales berhasil diambil'
      });
    } catch (error) {
      console.error('Error in getClientsBySales:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data client sales'
      });
    }
  },

  // Get client statistics
  getClientStats: async (req, res) => {
    try {
      // Total clients
      const [totalClients] = await pool.query('SELECT COUNT(*) as total FROM clients WHERE status_deleted = false');
      
      // Active clients
      const [activeClients] = await pool.query('SELECT COUNT(*) as total FROM clients WHERE status_deleted = false AND status = 1');
      
      // Inactive clients
      const [inactiveClients] = await pool.query('SELECT COUNT(*) as total FROM clients WHERE status_deleted = false AND status = 0');
      
      // Clients with visits
      const [clientsWithVisits] = await pool.query(`
        SELECT COUNT(DISTINCT c.id) as total 
        FROM clients c 
        INNER JOIN daily_activities da ON c.id = da.pihak_bersangkutan AND da.deleted_status = false
        WHERE c.status_deleted = false
      `);
      
      // Clients by sales
      const [clientsBySales] = await pool.query(`
        SELECT 
          u.name as sales_name,
          COUNT(c.id) as client_count
        FROM users u
        LEFT JOIN clients c ON u.id = c.created_by AND c.status_deleted = false
        WHERE u.role = 2
        GROUP BY u.id, u.name
        ORDER BY client_count DESC
      `);
      
      // Recent clients (last 30 days)
      const [recentClients] = await pool.query(`
        SELECT COUNT(*) as total 
        FROM clients 
        WHERE status_deleted = false 
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);
      
      res.json({
        success: true,
        data: {
          total: totalClients[0].total,
          active: activeClients[0].total,
          inactive: inactiveClients[0].total,
          withVisits: clientsWithVisits[0].total,
          bySales: clientsBySales,
          recent: recentClients[0].total
        },
        message: 'Statistik client berhasil diambil'
      });
    } catch (error) {
      console.error('Error in getClientStats:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil statistik client'
      });
    }
  }
};

module.exports = adminClientController; 