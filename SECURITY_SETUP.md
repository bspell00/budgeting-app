# 🔐 Security Setup Guide

## ⚠️ IMPORTANT: API Key Security

This repository has proper security measures in place to prevent accidental exposure of API keys. Follow this guide to set up your environment securely.

## 🛡️ Environment File Setup

### 1. Create Your Local Environment File

```bash
# Copy the template
cp .env.example .env.development

# Edit with your actual API keys
nano .env.development  # or use your preferred editor
```

### 2. Required API Keys

#### OpenAI API Key (Required for AI Features)
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new secret key
3. Replace `your_openai_api_key_here` in your `.env.development` file

#### Plaid API (Required for Banking Integration)
1. Sign up at [Plaid Dashboard](https://dashboard.plaid.com/signup)
2. Get your Client ID and Secret from the sandbox environment
3. Replace the Plaid credentials in your `.env.development` file

#### Database Setup
1. Install PostgreSQL locally
2. Create a database: `createdb budgeting_app_dev`
3. Update the `DATABASE_URL` in your `.env.development` file

### 3. Generate Secure Keys

#### NextAuth Secret (32+ characters)
```bash
openssl rand -base64 32
```

#### Encryption Key (64 hex characters)
```bash
openssl rand -hex 32
```

## 🚫 What NOT to Do

- ❌ Never commit `.env*` files to git
- ❌ Never share API keys in chat, email, or documentation
- ❌ Never use production keys in development
- ❌ Never hardcode secrets in source code

## ✅ Security Best Practices

- ✅ Use `.env.example` as a template
- ✅ Keep real environment files in `.gitignore`
- ✅ Use different API keys for development/staging/production
- ✅ Rotate API keys regularly
- ✅ Use environment variables in production (not files)

## 🔄 If You Accidentally Expose Secrets

1. **Immediately revoke the exposed keys** at their respective service dashboards
2. Generate new keys
3. Update your environment files
4. If committed to git, remove from history using `git filter-branch` or BFG
5. Force push to overwrite the exposed commit

## 📞 Questions?

If you're unsure about any security practices, please ask before proceeding. Security is everyone's responsibility!