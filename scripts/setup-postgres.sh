#!/bin/bash

# PostgreSQL Database Setup Script
# This script sets up PostgreSQL databases for all environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐘 PostgreSQL Database Setup${NC}"
echo "================================"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL first:"
    echo ""
    echo "macOS (with Homebrew):"
    echo "  brew install postgresql"
    echo "  brew services start postgresql"
    echo ""
    echo "Ubuntu/Debian:"
    echo "  sudo apt update"
    echo "  sudo apt install postgresql postgresql-contrib"
    echo ""
    echo "Windows:"
    echo "  Download from https://www.postgresql.org/download/windows/"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is installed${NC}"

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo -e "${YELLOW}⚠️  PostgreSQL is not running${NC}"
    echo "Starting PostgreSQL..."
    
    # Try to start PostgreSQL (macOS with Homebrew)
    if command -v brew &> /dev/null; then
        brew services start postgresql || true
    fi
    
    # Wait a moment and check again
    sleep 2
    if ! pg_isready -q; then
        echo -e "${RED}❌ Could not start PostgreSQL${NC}"
        echo "Please start PostgreSQL manually and run this script again"
        exit 1
    fi
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Database configuration
DB_USER=$(whoami)  # Use current macOS username
DB_PASSWORD=""     # Homebrew PostgreSQL typically doesn't need a password for local connections
DB_HOST="localhost"
DB_PORT="5432"

# Database names for each environment
DB_DEV="budgeting_app_dev"
DB_TEST="budgeting_app_test"
DB_STAGING="budgeting_app_staging"

echo ""
echo -e "${BLUE}📋 Database Configuration:${NC}"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo "  Development DB: $DB_DEV"
echo "  Test DB: $DB_TEST"
echo "  Staging DB: $DB_STAGING"

# Function to create a database
create_database() {
    local db_name=$1
    local env_name=$2
    
    echo ""
    echo -e "${YELLOW}🔨 Creating $env_name database: $db_name${NC}"
    
    # Check if database already exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        echo -e "${GREEN}✅ Database $db_name already exists${NC}"
    else
        # Create the database
        if createdb -h "$DB_HOST" -p "$DB_PORT" "$db_name"; then
            echo -e "${GREEN}✅ Created database: $db_name${NC}"
        else
            echo -e "${RED}❌ Failed to create database: $db_name${NC}"
            return 1
        fi
    fi
}

# Create databases for each environment
create_database "$DB_DEV" "Development"
create_database "$DB_TEST" "Test"
create_database "$DB_STAGING" "Staging"

echo ""
echo -e "${BLUE}🔧 Environment Setup:${NC}"

# Check if .env files exist and show next steps
if [ -f ".env.development" ]; then
    echo -e "${GREEN}✅ .env.development exists${NC}"
else
    echo -e "${RED}❌ .env.development missing${NC}"
fi

if [ -f ".env.test" ]; then
    echo -e "${GREEN}✅ .env.test exists${NC}"
else
    echo -e "${RED}❌ .env.test missing${NC}"
fi

if [ -f ".env.staging" ]; then
    echo -e "${GREEN}✅ .env.staging exists${NC}"
else
    echo -e "${RED}❌ .env.staging missing${NC}"
fi

echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "1. Update your .env files with the new PostgreSQL URLs"
echo "2. Install PostgreSQL dependencies:"
echo "   npm install pg @types/pg"
echo "3. Generate Prisma client:"
echo "   npx prisma generate"
echo "4. Run initial migration:"
echo "   npx prisma db push"
echo "5. Test the connection:"
echo "   npm run dev"

echo ""
echo -e "${GREEN}🎉 PostgreSQL setup complete!${NC}"

# Show connection strings
echo ""
echo -e "${BLUE}🔗 Connection Strings:${NC}"
if [ -z "$DB_PASSWORD" ]; then
    echo "Development: postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_DEV?schema=public"
    echo "Test:        postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_TEST?schema=public"
    echo "Staging:     postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_STAGING?schema=public"
else
    echo "Development: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_DEV?schema=public"
    echo "Test:        postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_TEST?schema=public"
    echo "Staging:     postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_STAGING?schema=public"
fi

echo ""
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo "• Change default PostgreSQL password for security"
echo "• Update .env files with correct credentials"
echo "• Never commit real credentials to git"
echo "• Use environment variables in production"