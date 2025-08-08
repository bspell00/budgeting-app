#!/usr/bin/env node

const { execSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres =
  dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
const env = process.env.NODE_ENV || 'development';

console.log('🔧 Setting up Prisma…');
console.log(`📍 NODE_ENV: ${env}`);
console.log(`🗄️  DATABASE_URL: ${isPostgres ? 'PostgreSQL' : dbUrl ? 'SQLite/Other' : 'UNSET'}`);

// Always use the single canonical schema
const schemaPath = 'prisma/schema.prisma';

try {
  // Generate client from the canonical schema
  console.log('🔄 Generating Prisma client…');
  execSync(`npx prisma generate --schema="${schemaPath}"`, { stdio: 'inherit' });

  // Optionally run migrations when not in production CI containers, etc.
  // Only run if DATABASE_URL is set (prevents noise during build steps that don’t have env wired)
  if (isPostgres && env !== 'production') {
    // Safe for dev; if you prefer, change to `prisma migrate deploy`
    console.log('🧭 Applying dev migrations…');
    execSync(`npx prisma migrate dev --schema="${schemaPath}" --name "auto_dev_sync"`, {
      stdio: 'inherit',
    });
  } else {
    console.log('ℹ️ Skipping migrate (either production or non-Postgres DB).');
  }

  console.log('✅ Prisma setup complete!');
} catch (err) {
  console.error('❌ Prisma setup failed:', err?.message || err);
  process.exit(1);
}