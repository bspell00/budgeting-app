require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifySetup() {
  console.log('🔍 Verifying complete app setup...\n');
  
  try {
    // 1. Test database connection
    console.log('1️⃣ Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // 2. Verify database is empty (fresh start)
    const userCount = await prisma.user.count();
    const accountCount = await prisma.account.count();
    const transactionCount = await prisma.transaction.count();
    
    console.log(`📊 Database status:
  - Users: ${userCount}
  - Accounts: ${accountCount}  
  - Transactions: ${transactionCount}`);
    
    if (userCount === 0) {
      console.log('✅ Database is clean and ready for fresh start');
    } else {
      console.log('ℹ️  Database has existing data');
    }
    
    // 3. Test Plaid connection
    console.log('\n2️⃣ Testing Plaid API...');
    const plaidEnv = process.env.PLAID_ENV || 'sandbox';
    
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      console.error('❌ Missing Plaid credentials');
      return;
    }
    
    const baseUrl = `https://${plaidEnv}.plaid.com`;
    const response = await fetch(`${baseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
      body: JSON.stringify({
        client_name: 'Budgeting App',
        country_codes: ['US'],
        language: 'en',
        user: { client_user_id: 'test-user' },
        products: ['transactions'],
      }),
    });
    
    if (response.ok) {
      console.log('✅ Plaid API connection working');
    } else {
      const error = await response.text();
      console.error('❌ Plaid API error:', error);
    }
    
    // 4. Check environment variables
    console.log('\n3️⃣ Checking environment variables...');
    const requiredVars = [
      'DATABASE_URL',
      'NEXTAUTH_URL', 
      'NEXTAUTH_SECRET',
      'PLAID_CLIENT_ID',
      'PLAID_SECRET',
      'PLAID_ENV'
    ];
    
    let allPresent = true;
    requiredVars.forEach(varName => {
      if (process.env[varName]) {
        console.log(`✅ ${varName}: Present`);
      } else {
        console.log(`❌ ${varName}: Missing`);
        allPresent = false;
      }
    });
    
    // 5. Summary
    console.log('\n🎉 Setup Verification Complete!\n');
    
    if (allPresent && response.ok) {
      console.log('✨ Everything looks good! Your app is ready to use.');
      console.log('\n🚀 Next steps:');
      console.log('  1. Run: npm run dev');
      console.log('  2. Go to: http://localhost:3001');
      console.log('  3. Sign up for a new account');
      console.log('  4. Connect your bank accounts');
      console.log('  5. Enjoy the optimistic UI updates!');
    } else {
      console.log('⚠️  Some issues found. Please fix them before proceeding.');
    }
    
  } catch (error) {
    console.error('❌ Setup verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySetup();