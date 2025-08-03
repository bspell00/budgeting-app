# Database Reset Guide

When testing gets messy and you need a clean slate, use these scripts to safely reset your database.

## 🚨 Important Safety Notes

- **NEVER run these scripts on production**
- **These scripts permanently delete ALL data**
- **Always backup important data before resetting**
- **Test locally before running on staging**

## Available Reset Scripts

### 1. Local Development Reset

For resetting your local development database:

```bash
# Interactive reset (will ask for confirmation)
node scripts/reset-database.js

# Skip confirmation (for automation)
node scripts/reset-database.js --confirm
```

**What it does:**
- Removes all users, accounts, transactions, budgets, goals, payees
- Resets database sequences
- Provides detailed feedback
- Safe for local development

### 2. Staging Environment Reset

For resetting your staging database on Heroku or other platforms:

```bash
# On staging server
NODE_ENV=staging node scripts/staging-reset.js

# Via Heroku CLI
heroku run node scripts/staging-reset.js --app your-staging-app
```

**What it does:**
- Includes environment safety checks
- Prevents running on production
- Provides detailed logging with timestamps
- Optimized for remote execution

## Step-by-Step Reset Process

### For Local Testing

1. **Stop your development server** (if running)
   ```bash
   # Press Ctrl+C to stop npm run dev
   ```

2. **Run the reset script**
   ```bash
   node scripts/reset-database.js
   ```

3. **Confirm when prompted**
   - Type `RESET` when asked to confirm

4. **Restart your development server**
   ```bash
   npm run dev
   ```

5. **Test with fresh data**
   - Visit http://localhost:3001
   - Create a new account
   - Connect bank accounts via Plaid
   - Test all functionality from scratch

### For Staging Environment

1. **Connect to your staging app**
   ```bash
   heroku login
   ```

2. **Run the staging reset**
   ```bash
   heroku run node scripts/staging-reset.js --app your-staging-app
   ```

3. **Monitor the output**
   - Check that all data is cleared
   - Verify no errors occurred

4. **Test the staging app**
   - Visit your staging URL
   - Create fresh test accounts
   - Verify all functionality works

## What Gets Deleted

Both scripts remove ALL of the following:

| Data Type | Description |
|-----------|-------------|
| **Users** | All user accounts and authentication data |
| **Accounts** | All connected bank accounts (Plaid connections) |
| **Transactions** | All imported and manual transactions |
| **Budgets** | All budget categories and amounts |
| **Goals** | All savings and debt payoff goals |
| **Payees** | All stored payees (including credit card payment payees) |
| **Transfers** | All budget transfer records |
| **AI Plans** | All AI-generated financial plans |

## After Reset Checklist

✅ **Database is empty** - No users or data remain  
✅ **App loads without errors** - No database conflicts  
✅ **Sign up works** - Can create new accounts  
✅ **Plaid integration works** - Can connect bank accounts  
✅ **Credit card automation works** - Payment payees are created  
✅ **All features function** - Everything works from scratch  

## Troubleshooting

### "Permission denied" error
```bash
chmod +x scripts/reset-database.js scripts/staging-reset.js
```

### "Cannot find module" error
```bash
npm install
```

### Heroku authentication issues
```bash
heroku login
heroku auth:whoami
```

### Database connection issues
Check your environment variables:
- `DATABASE_URL` is set correctly
- Database server is running

## Emergency Recovery

If something goes wrong during reset:

1. **Check error logs** in the script output
2. **Verify database state** using database tools
3. **Re-run the script** if it failed partway through
4. **Restore from backup** if you have one
5. **Recreate database** using Prisma migrations:
   ```bash
   npx prisma migrate reset --force
   npx prisma db push
   ```

## Prevention Tips

To avoid needing frequent resets:

- **Test incrementally** - Test small changes before big ones
- **Use version control** - Commit working states frequently  
- **Document changes** - Keep track of what you modified
- **Backup before experiments** - Save working database states
- **Use feature flags** - Toggle new features on/off safely

## Quick Commands Reference

```bash
# Local development reset
node scripts/reset-database.js --confirm

# Staging reset via Heroku
heroku run node scripts/staging-reset.js --app your-app

# Check database state
sqlite3 dev.db ".tables"
sqlite3 dev.db "SELECT count(*) FROM User;"

# Restart everything fresh
npm run dev
```

---

**Remember**: These scripts are nuclear options. Use them when you need a completely fresh start for testing. 🧹✨