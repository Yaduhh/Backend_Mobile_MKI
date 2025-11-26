const { generateLaravelCompatibleHash } = require('./src/utils/bcryptHelper');
const db = require('./src/config/database');

async function createAdmin() {
  try {
    // Check if admin already exists
    const [existingAdmin] = await db.execute(
      'SELECT id FROM users WHERE email = ?',
      ['admin@mki.com']
    );
    
    if (existingAdmin.length > 0) {
      process.exit(0);
    }
    
    // Hash password menggunakan helper yang kompatibel dengan Laravel
    const adminPassword = 'password'; // Default Laravel password
    const hashedPassword = await generateLaravelCompatibleHash(adminPassword, 12);
    
    // Create admin user
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, role, notelp, profile, status, status_deleted) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Admin', 'admin@mki.com', hashedPassword, 1, '08123456789', 'Admin MKI', 1, 0]
    );
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin(); 