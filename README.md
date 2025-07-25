# AI-Powered Budgeting App

A modern, YNAB-style budgeting application with Plaid integration for automatic transaction syncing and Finley AI assistant for intelligent financial guidance.

## Features

- 🏦 **Plaid Integration**: Automatic bank account syncing and transaction categorization
- 🧠 **Finley AI Assistant**: Intelligent budget suggestions, spending insights, and personalized financial advice
- 💰 **Zero-Based Budgeting**: Assign every dollar a purpose before spending
- 🎯 **Debt Payoff Goals**: Automated debt snowball and avalanche calculations
- 📊 **Beautiful Dashboard**: Clean, modern interface inspired by YNAB
- 🔒 **Secure**: End-to-end encryption for sensitive financial data

## Quick Start

1. **Clone and Install**
   ```bash
   git clone https://github.com/bspell00/budgeting-app.git
   cd budgeting-app
   npm install
   ```

2. **Set up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Set up Database**
   ```bash
   # Set up PostgreSQL database
   npx prisma db push
   npx prisma generate
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Environment Setup

### Required API Keys

1. **Plaid Account**: Sign up at [plaid.com](https://plaid.com)
   - Get your `PLAID_CLIENT_ID` and `PLAID_SECRET`
   - Start with sandbox environment

2. **OpenAI Account**: Sign up at [openai.com](https://openai.com)
   - Get your `OPENAI_API_KEY` for AI features

3. **PostgreSQL Database**: 
   - Local: Install PostgreSQL
   - Cloud: Use Railway, Supabase, or Neon

### Database Schema

The app uses Prisma ORM with PostgreSQL. Key models:
- `User`: Authentication and user management
- `Account`: Bank accounts from Plaid
- `Transaction`: Individual transactions
- `Category`: Spending categories with auto-rules
- `Budget`: Monthly zero-based budgets
- `Goal`: Savings and debt payoff goals

## Core Features

### Plaid Integration
- Automatic bank account connection
- Real-time transaction syncing
- Intelligent transaction categorization
- Webhook support for live updates

### AI Features
- Budget adjustment suggestions
- Automatic goal creation
- Spending pattern analysis
- Debt optimization strategies

### Zero-Based Budgeting
- Monthly budget creation
- Category-based allocation
- Progress tracking
- Rollover handling

### Goal Management
- Emergency fund suggestions
- Debt payoff calculators
- Vacation fund planning
- Custom savings goals

## Development

### Project Structure
- `/pages`: Next.js pages and API routes
- `/components`: React components
- `/lib`: Utility functions and services
- `/prisma`: Database schema and migrations
- `/styles`: Global CSS and Tailwind config

### Key Technologies
- **Next.js**: Full-stack React framework
- **TypeScript**: Type-safe development
- **Prisma**: Database ORM
- **Tailwind CSS**: Utility-first styling
- **NextAuth.js**: Authentication
- **Plaid**: Financial data integration
- **OpenAI**: AI-powered insights

## Security

- All sensitive data encrypted at rest
- Plaid access tokens encrypted in database
- HTTPS-only in production
- Input validation on all endpoints
- Rate limiting on API routes

## Deployment

1. **Production Database**: Set up PostgreSQL instance
2. **Environment Variables**: Update production values
3. **Plaid Environment**: Switch to production/development
4. **Deploy**: Use Vercel, Railway, or your preferred platform

```bash
npm run build
npm start