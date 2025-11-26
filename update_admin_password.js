const { generateLaravelCompatibleHash } = require('./src/utils/bcryptHelper');
const db = require('./src/config/database');

async function updateAdminPassword() {
  try {
    // Hash password menggunakan helper yang kompatibel dengan Laravel
    const adminPassword = 'password'; // Default Laravel password
    const hashedPassword = await generateLaravelCompatibleHash(adminPassword, 12);
    
    // Update password admin
    const [result] = await db.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, 'admin@mki.com']
    );
    
    if (result.affectedRows > 0) {
      return;
    } else {
      return;
    }
    
    process.exit(0);
  } catch (error) {
    return;
    process.exit(1);
  }
}

updateAdminPassword(); 