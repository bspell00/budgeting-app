# Email Service Setup Guide

This guide will help you set up **Resend** (free email service) for password reset functionality.

## 1. Sign Up for Resend (Free)

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account (3,000 emails/month free)
3. Verify your email address

## 2. Get Your API Key

1. Log into your Resend dashboard
2. Click "API Keys" in the sidebar
3. Click "Create API Key"
4. Name it "Budget App" 
5. Copy the API key (starts with `re_`)

## 3. Add Environment Variables

Add these to your `.env.local` file:

```bash
# Resend Email Service
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=noreply@yourdomain.com

# Or use the default Resend domain for testing
FROM_EMAIL=onboarding@resend.dev
```

## 4. Install Resend Package

Run this command to install the Resend SDK:

```bash
npm install resend
```

## 5. Push Database Schema

Update your database with the new reset token fields:

```bash
npx prisma db push
```

## 6. Test the Integration

1. Start your development server: `npm run dev`
2. Go to the forgot password page: `http://localhost:3001/auth/forgot-password`
3. Enter a valid email address
4. Check your email for the reset link!

## 7. Domain Setup (Optional - For Production)

For production, you'll want to:

1. **Add your domain** in Resend dashboard
2. **Verify DNS records** (SPF, DKIM, DMARC)
3. **Update FROM_EMAIL** to use your domain: `noreply@yourdomain.com`

## Features Included

✅ **Professional email template** with your brand colors  
✅ **Secure token-based reset** (1-hour expiration)  
✅ **Mobile-responsive design**  
✅ **Security notices and warnings**  
✅ **Fallback to console logging** if email fails  
✅ **Prevention of email enumeration attacks**  

## Troubleshooting

- **"Email service not configured"**: Add `RESEND_API_KEY` to your `.env.local`
- **Emails not sending**: Check API key is correct and account is verified
- **Domain issues**: Use `onboarding@resend.dev` for testing
- **Database errors**: Run `npx prisma db push` to update schema

## Alternative Free Services

If you prefer other services, here are alternatives:

- **SendGrid**: 100 emails/day free
- **Mailgun**: 5,000 emails/month free (first 3 months)
- **Brevo (Sendinblue)**: 300 emails/day free
- **EmailJS**: 200 emails/month free (client-side only)

Choose Resend for the best developer experience and generous free tier! 🚀