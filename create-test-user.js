const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  console.log('🔧 Creating test user...');
  
  try {
    // Hash a simple password
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    // Create user with the verified email address
    const user = await prisma.user.create({
      data: {
        email: 'bspell00@gmail.com',
        name: 'Brandon Spell',
        password: hashedPassword,
      }
    });
    
    console.log('✅ Test user created successfully:');
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', user.name);
    console.log('🔑 Password: password123');
    console.log('🆔 User ID:', user.id);
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ️ User already exists with email bspell00@gmail.com');
      
      // Get existing user
      const existingUser = await prisma.user.findUnique({
        where: { email: 'bspell00@gmail.com' }
      });
      
      console.log('📧 Existing user:', existingUser?.email);
      console.log('👤 Name:', existingUser?.name);
      console.log('🆔 User ID:', existingUser?.id);
    } else {
      console.error('❌ Error creating user:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();