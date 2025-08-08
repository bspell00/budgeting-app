#!/bin/bash

# Baseline staging database for Prisma migrations
echo "🎯 Baselining Heroku staging database..."

# Set staging database URL
export DATABASE_URL="postgres://u1la56nn5pvu2c:pf97e8a4e0edeecdd092813d0a1504defd36bee5994dc8ae4433bf5a8b3381d36@ca8lne8pi75f88.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d4go8e84m26jm5"

echo "📊 Current database schema status..."
npx prisma db pull

echo "🏁 Creating baseline migration..."
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > baseline.sql

echo "🔧 Creating baseline migration folder..."
mkdir -p prisma/migrations/0_baseline
mv baseline.sql prisma/migrations/0_baseline/migration.sql

echo "✅ Marking baseline as applied..."
npx prisma migrate resolve --applied 0_baseline

echo "🎉 Staging database baselined successfully!"
echo "Now you can run: heroku releases:retry --app budgeting-app-staging"