# Claude Code Project Memory

## Project Overview
This is a YNAB-style budgeting application built with Next.js, TypeScript, Prisma, and SQLite. The app integrates with Plaid for real banking data and includes advanced credit card automation features.

## Technology Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: SQLite (dev.db)
- **Authentication**: NextAuth.js
- **Banking Integration**: Plaid API (sandbox mode)
- **Drag & Drop**: @dnd-kit
- **UI Components**: Lucide React icons

## Key Features Implemented

### 1. YNAB-Style Credit Card Automation ✅
- **Automatic Budget Transfers**: When you spend on a credit card, money automatically moves from spending budgets to credit card payment budgets
- **Smart Categorization**: 200+ merchant patterns for automatic transaction categorization
- **Budget Transfer Tracking**: Complete audit trail of all automated transfers
- **Enhanced API**: `/api/budget/credit-card-automation` for automation management

### 2. Banking Integration ✅
- **Plaid Integration**: Real bank account connections via Plaid Link
- **Account Management**: Connected accounts display in left sidebar
- **Transaction Import**: Automatic transaction sync with smart categorization
- **Account Views**: Click accounts to view transaction details

### 3. Budget Management ✅
- **YNAB-Style Categories**: Hierarchical category groups (Credit Card Payments, Monthly Bills, etc.)
- **Drag & Drop**: Move budgets between categories
- **Inline Editing**: Edit budget names and amounts directly
- **Progress Bars**: Visual spending progress with toggle option
- **Move Money**: In-place popover for transferring money between budgets

### 4. Dashboard Layout ✅
- **Three-Panel Design**: Left sidebar, main content, right sidebar
- **Tabbed Interface**: Budget, Transactions, Charts, Accounts, Actions tabs
- **Connected Accounts**: Always visible in left sidebar
- **AI Insights**: Spending analysis and recommendations

### 5. Transaction Management ✅
- **YNAB-Style Table**: Running balance calculations
- **Inline Category Editing**: Click to edit transaction categories
- **Smart Categorization**: Automatic categorization with merchant recognition
- **Manual Entry**: Add transactions for testing

## Database Schema

### Core Tables
- **User**: Authentication and user management
- **Account**: Connected bank accounts from Plaid
- **Budget**: Budget categories with amounts and spending
- **Transaction**: All financial transactions
- **Goal**: Savings and debt payoff goals
- **BudgetTransfer**: Audit trail for credit card automation transfers

### Key Relationships
- Users have multiple Accounts, Budgets, Transactions, Goals
- Transactions link to Accounts and optionally to Budgets
- BudgetTransfers track automated money movements

## API Endpoints

### Banking Integration
- `POST /api/plaid/create-link-token` - Create Plaid Link token
- `POST /api/plaid/exchange-token` - Exchange public token and import data
- `POST /api/plaid/sync` - Sync new transactions

### Budget Management
- `GET/POST/PUT/DELETE /api/budgets` - Budget CRUD operations
- `POST /api/budget/credit-card-automation` - Trigger/view automation
- `PUT /api/transactions/update-category` - Update transaction categories

### Data Endpoints
- `GET /api/dashboard` - Main dashboard data
- `GET /api/accounts` - Connected accounts list
- `GET /api/transactions` - Transaction data with filters

## Environment Variables
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="..."
PLAID_CLIENT_ID="..."
PLAID_SECRET="..."
PLAID_ENV="sandbox"
```

## Development Commands

### Database
```bash
npx prisma generate          # Generate Prisma client
npx prisma db push          # Apply schema changes
npx prisma migrate reset    # Reset database
sqlite3 dev.db ".tables"    # Check database tables
```

### Application
```bash
npm run dev                 # Start development server
npm run build              # Build for production
npm run lint               # Run linting
npm run typecheck          # Check TypeScript
```

## Current Status

### ✅ Completed Features
- YNAB-style credit card automation with full audit trail
- Smart transaction categorization (200+ merchant patterns)
- Connected accounts management and transaction views
- Drag & drop budget management with inline editing
- Three-panel dashboard with tabbed interface
- Move money functionality with in-place popovers

### 🔧 Known Issues
- TypeScript compilation errors need fixing for production build
- Database tables created manually after migration issues
- Credit card automation ready for testing but needs connected accounts

### 📋 Testing Instructions
1. Start dev server: `npm run dev`
2. Sign up/login to create user account
3. Click "Connect Bank Account" to start Plaid Link
4. Use Plaid sandbox credentials to import test data
5. Test credit card automation by importing credit card transactions
6. Verify automatic budget transfers in Credit Card Automation section

### 🎯 Next Steps
1. Fix TypeScript compilation errors
2. Test credit card automation with real Plaid data
3. Implement monthly budget rollover features
4. Add budget alerts and notifications

## File Structure
```
/components/           # React components
  Dashboard.tsx        # Main dashboard component
  CreditCardAutomation.tsx  # Automation UI
  BudgetItem.tsx      # Individual budget items
  CategoryGroup.tsx   # Budget category groups
  MoveMoneyPopover.tsx # Money transfer interface

/pages/api/           # API endpoints
  plaid/             # Plaid integration
  budget/            # Budget management
  transactions/      # Transaction handling

/lib/                # Utilities and services
  credit-card-automation.ts  # Automation logic
  auth.ts           # Authentication config
  
/prisma/             # Database
  schema.prisma     # Database schema
  migrations/       # Migration files
```

## Credit Card Automation Details
The system implements YNAB's exact credit card methodology:
1. **Connect Credit Card**: Auto-creates "[Card Name] Payment" budget
2. **Make Purchase**: Transaction categorized (e.g., "Starbucks" → "Food & Dining")  
3. **Auto Transfer**: Money moves from "Food & Dining" to "Credit Card Payment"
4. **Track Transfer**: Logged in BudgetTransfer table with transaction link
5. **Pay Bill**: Use accumulated "Credit Card Payment" budget

This ensures you always have money set aside for credit card payments.