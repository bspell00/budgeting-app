#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');

const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.DATABASE_URL?.includes('postgresql://') ||
                     process.env.DATABASE_URL?.includes('postgres://');

console.log('🔧 Setting up database schema...');
console.log(`📍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

try {
  // Check if schema exists
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error('❌ Schema file not found:', SCHEMA_PATH);
    process.exit(1);
  }
  
  console.log(`✅ Using unified schema for ${isProduction ? 'PostgreSQL' : 'SQLite'}`);
  console.log('🔄 Generating Prisma client...');
  
  // Generate Prisma client
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('✅ Schema setup complete!');
  
} catch (error) {
  console.error('❌ Error setting up schema:', error.message);
  process.exit(1);
}