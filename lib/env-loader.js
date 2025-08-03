/**
 * Environment Loader
 * 
 * Loads the appropriate .env file based on NODE_ENV
 * This ensures each environment uses its own configuration
 */

const path = require('path');
const fs = require('fs');

function loadEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Map NODE_ENV to .env file names
  const envFiles = {
    'development': '.env.development',
    'test': '.env.test',
    'staging': '.env.staging',
    'production': '.env.production'
  };
  
  const envFile = envFiles[nodeEnv] || '.env';
  const envPath = path.resolve(process.cwd(), envFile);
  
  console.log(`🌍 Environment: ${nodeEnv}`);
  console.log(`📄 Loading config from: ${envFile}`);
  
  // Check if the specific env file exists
  if (fs.existsSync(envPath)) {
    // Load the environment-specific file
    require('dotenv').config({ path: envPath, override: true });
    console.log(`✅ Loaded environment config from ${envFile}`);
  } else {
    console.log(`⚠️  ${envFile} not found, falling back to .env`);
    // Fall back to default .env
    require('dotenv').config();
  }
  
  // Also load .env.local if it exists (for local overrides)
  const localEnvPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(localEnvPath)) {
    require('dotenv').config({ path: localEnvPath });
    console.log('📄 Also loaded .env.local overrides');
  }
  
  // Validate critical environment variables
  const required = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error(`   Check your ${envFile} file`);
    process.exit(1);
  }
  
  console.log(`🗄️  Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);
}

module.exports = { loadEnvironment };