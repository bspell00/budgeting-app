#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.DATABASE_URL?.includes('postgresql://') ||
                     process.env.DATABASE_URL?.includes('postgres://');

console.log('🔧 Setting up database schema...');
console.log(`📍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');
const PRODUCTION_SCHEMA_PATH = path.join(__dirname, '../prisma/schema.production.prisma');

try {
  let schemaToUse = SCHEMA_PATH;
  
  if (isProduction) {
    // Use production schema for Heroku
    if (fs.existsSync(PRODUCTION_SCHEMA_PATH)) {
      schemaToUse = PRODUCTION_SCHEMA_PATH;
      console.log('✅ Using PostgreSQL schema for production');
    } else {
      console.log('⚠️  Production schema not found, using default');
    }
  } else {
    console.log('✅ Using SQLite schema for development');
  }

  console.log('🔄 Generating Prisma client...');
  execSync(`npx prisma generate --schema="${schemaToUse}"`, { stdio: 'inherit' });
  console.log('✅ Schema setup complete!');
} catch (error) {
  console.error('❌ Error setting up schema:', error.message);
  process.exit(1);
}