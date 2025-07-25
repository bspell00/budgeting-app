#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');
const DEV_SCHEMA = path.join(__dirname, '../prisma/schema.dev.prisma');
const PROD_SCHEMA = path.join(__dirname, '../prisma/schema.prod.prisma');

const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.DATABASE_URL?.includes('postgresql://') ||
                     process.env.DATABASE_URL?.includes('postgres://');

console.log('🔧 Setting up database schema...');
console.log(`📍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

try {
  // Choose the correct schema
  const sourceSchema = isProduction ? PROD_SCHEMA : DEV_SCHEMA;
  
  // Copy the appropriate schema
  const schemaContent = fs.readFileSync(sourceSchema, 'utf8');
  fs.writeFileSync(SCHEMA_PATH, schemaContent);
  
  console.log(`✅ Using ${isProduction ? 'PostgreSQL' : 'SQLite'} schema`);
  console.log('🔄 Generating Prisma client...');
  
  // Generate Prisma client
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('✅ Schema setup complete!');
  
} catch (error) {
  console.error('❌ Error setting up schema:', error.message);
  process.exit(1);
}