const { generateLaravelCompatibleHash, comparePassword } = require('./src/utils/bcryptHelper');

async function testHash() {
  try {
    const password = 'wakwaw123';
    
    // Generate hash
    const hash = await generateLaravelCompatibleHash(password, 12);
    
    // Check if it starts with $2y$
    if (hash.startsWith('$2y$')) {
      return;
    } else {
      return;
    }
    
  } catch (error) {
    return;
  }
}

testHash(); 