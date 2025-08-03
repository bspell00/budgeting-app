# PostgreSQL Migration Guide

This guide walks you through migrating from SQLite to PostgreSQL with environment-specific databases.

## 🎯 Benefits of PostgreSQL

- **Production Ready**: Industry-standard database for web applications
- **Environment Isolation**: Separate databases for dev/test/staging/production
- **Better Performance**: Superior handling of concurrent connections
- **Advanced Features**: JSON support, full-text search, advanced indexing
- **Heroku Compatible**: Native PostgreSQL support on Heroku

## 📋 Prerequisites

1. **PostgreSQL installed locally**
2. **Database administrator access**
3. **New Resend API key** (old one was revoked for security)

## 🚀 Step-by-Step Migration

### Step 1: Install PostgreSQL

#### macOS (Homebrew)
```bash
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows
Download from [postgresql.org/download](https://www.postgresql.org/download/windows/)

### Step 2: Set Up Databases

Run the automated setup script:

```bash
npm run db:setup
```

Or manually create databases:

```bash
createdb budgeting_app_dev
createdb budgeting_app_test
createdb budgeting_app_staging
```

### Step 3: Install Dependencies

```bash
npm install pg @types/pg dotenv-cli
```

### Step 4: Update Environment Variables

#### 4.1 Create New Resend API Key
1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. Delete the old compromised key
3. Create a new API key
4. Update all .env files with the new key

#### 4.2 Update Database URLs
Edit your environment files with PostgreSQL connection strings:

**`.env.development`**:
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/budgeting_app_dev?schema=public"
```

**`.env.test`**:
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/budgeting_app_test?schema=public"
```

**`.env.staging`** (update for your staging environment):
```bash
DATABASE_URL="postgresql://staging_user:staging_pass@staging-host:5432/budgeting_app_staging?schema=public"
```

### Step 5: Database Schema Migration

#### 5.1 Generate Prisma Client
```bash
npx prisma generate
```

#### 5.2 Push Schema to Development Database
```bash
npm run db:push:dev
```

#### 5.3 Push Schema to Test Database
```bash
npm run db:push:test
```

### Step 6: Test the Migration

#### 6.1 Start Development Server
```bash
npm run dev
```

#### 6.2 Verify Database Connection
- Visit http://localhost:3001
- Create a new user account
- Connect a bank account via Plaid
- Test all major functionality

#### 6.3 Test Environment Switching
```bash
# Test environment
npm run dev:test

# Staging environment (if configured)
npm run dev:staging
```

## 🛠️ Environment-Specific Commands

### Development Environment
```bash
npm run dev                 # Start development server
npm run db:push:dev        # Update development database schema
npm run migrate:dev        # Run development migrations
```

### Test Environment
```bash
npm run dev:test           # Start server with test database
npm run db:push:test       # Update test database schema
npm run db:reset:test      # Reset test database (safe)
```

### Database Management
```bash
npm run db:reset           # Interactive database reset
npm run db:setup           # Set up PostgreSQL databases
npm run db:generate        # Generate Prisma client
```

## 🔧 Troubleshooting

### PostgreSQL Connection Issues

#### Check if PostgreSQL is running:
```bash
pg_isready
```

#### Start PostgreSQL service:
```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

#### Check connection to specific database:
```bash
psql postgresql://postgres:password@localhost:5432/budgeting_app_dev
```

### Common Errors

#### "password authentication failed"
Update the password in your connection string or reset PostgreSQL password:
```bash
ALTER USER postgres PASSWORD 'newpassword';
```

#### "database does not exist"
Create the missing database:
```bash
createdb budgeting_app_dev
```

#### "relation does not exist"
Run the schema push:
```bash
npm run db:push:dev
```

### Migration Verification

#### Check database tables:
```bash
psql budgeting_app_dev -c "\\dt"
```

#### Check user count:
```bash
psql budgeting_app_dev -c "SELECT COUNT(*) FROM \"User\";"
```

## 🔐 Security Best Practices

### Environment Variables
- ✅ **Never commit real API keys** to git
- ✅ **Use different keys per environment**
- ✅ **Rotate keys regularly**
- ✅ **Use strong database passwords**

### Database Security
- ✅ **Separate databases per environment**
- ✅ **Limited user permissions in production**
- ✅ **SSL connections in production**
- ✅ **Regular backups**

## 📊 Environment Overview

| Environment | Database | Purpose | API Keys |
|-------------|----------|---------|----------|
| **Development** | `budgeting_app_dev` | Local development | Development keys |
| **Test** | `budgeting_app_test` | Automated testing | Test keys |
| **Staging** | `budgeting_app_staging` | Pre-production testing | Staging keys |
| **Production** | `budgeting_app_prod` | Live application | Production keys |

## 🎉 Post-Migration Checklist

- [ ] ✅ PostgreSQL is installed and running
- [ ] ✅ All databases created (dev, test, staging)
- [ ] ✅ Environment files configured
- [ ] ✅ New Resend API key generated and set
- [ ] ✅ Dependencies installed
- [ ] ✅ Database schema deployed
- [ ] ✅ Application starts without errors
- [ ] ✅ User registration works
- [ ] ✅ Plaid integration works
- [ ] ✅ Credit card automation works
- [ ] ✅ Environment switching works
- [ ] ✅ Database reset scripts work

## 🚀 Deployment Updates

### Heroku Staging
```bash
# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini --app your-staging-app

# Set environment variables
heroku config:set NODE_ENV=staging --app your-staging-app
heroku config:set RESEND_API_KEY=your-staging-key --app your-staging-app

# Deploy and migrate
git push heroku main
heroku run npx prisma db push --app your-staging-app
```

### Production Deployment
```bash
# Use production-grade PostgreSQL
heroku addons:create heroku-postgresql:standard-0 --app your-production-app

# Set production environment variables
heroku config:set NODE_ENV=production --app your-production-app
heroku config:set RESEND_API_KEY=your-production-key --app your-production-app

# Deploy with migrations
git push heroku main
heroku run npx prisma migrate deploy --app your-production-app
```

---

**You now have a robust, production-ready database setup with proper environment separation! 🎉**