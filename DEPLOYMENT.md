# Deployment Guide

## Email Configuration Across Environments

### Local Development ✅
- **Status**: Configured and working
- **Email Service**: Resend (free tier)
- **From Email**: `onboarding@resend.dev`
- **Limitation**: Can only send to verified email (`bspell00@gmail.com`)
- **Test Command**: `node scripts/test-email-environments.js`

### Staging Environment 🚀

#### Heroku Configuration
```bash
# Set environment variables on Heroku
heroku config:set RESEND_API_KEY="re_fpyaWSXb_5G6MvFgVQHNmHA4Skyy3TZuF" --app your-staging-app
heroku config:set FROM_EMAIL="onboarding@resend.dev" --app your-staging-app
heroku config:set NODE_ENV="staging" --app your-staging-app
heroku config:set NEXTAUTH_URL="https://your-staging-app.herokuapp.com" --app your-staging-app
```

#### Test Staging Email
```bash
# After deployment, test with:
heroku run node scripts/test-email-environments.js --app your-staging-app
```

### Production Environment 🏭

#### Recommended Setup
1. **Verify Domain**: Go to [resend.com/domains](https://resend.com/domains)
2. **Add Your Domain**: Add your production domain (e.g., `yourdomain.com`)
3. **Update DNS**: Add required DNS records
4. **Update FROM_EMAIL**: Use `noreply@yourdomain.com`

#### Production Heroku Configuration
```bash
# Production environment variables
heroku config:set RESEND_API_KEY="your-production-resend-key" --app your-production-app
heroku config:set FROM_EMAIL="noreply@yourdomain.com" --app your-production-app
heroku config:set NODE_ENV="production" --app your-production-app
heroku config:set NEXTAUTH_URL="https://yourdomain.com" --app your-production-app
```

## Environment-Specific Behavior

### Development
- ✅ Detailed logging
- ✅ Fallback reset URL in console
- ✅ Full error details
- ⚠️ Limited to verified email only

### Staging  
- ✅ Environment-aware logging
- ✅ Email testing capabilities
- ✅ Same API key as development
- ⚠️ Limited to verified email only

### Production
- ✅ Security-focused logging
- ✅ Custom domain support
- ✅ Send to any email address
- ✅ Professional branding

## Testing Email Functionality

### Quick Test Script
```bash
# Test current environment
node scripts/test-email-environments.js

# Test specific environment
NODE_ENV=production node scripts/test-email-environments.js
```

### Manual Password Reset Test
1. Navigate to `/auth/forgot-password`
2. Enter `bspell00@gmail.com` (for development/staging)
3. Check console logs and email inbox
4. For production: Use any valid email address

## Troubleshooting

### Common Issues

#### "403 - Testing emails only"
- **Cause**: Free Resend account limitation
- **Solution**: Only use `bspell00@gmail.com` for testing, or verify a domain

#### "401 - Authentication failed"
- **Cause**: Invalid or missing RESEND_API_KEY
- **Solution**: Check API key in environment variables

#### "Domain verification required"
- **Cause**: Using unverified domain in production
- **Solution**: Verify domain at resend.com/domains

### Environment Variables Checklist

#### Required for All Environments
- [ ] `RESEND_API_KEY` - Your Resend API key
- [ ] `FROM_EMAIL` - Sender email address
- [ ] `NEXTAUTH_URL` - Base URL for reset links
- [ ] `NODE_ENV` - Environment identifier

#### Development
- [ ] `FROM_EMAIL="onboarding@resend.dev"`
- [ ] `NEXTAUTH_URL="http://localhost:3001"`

#### Staging
- [ ] `FROM_EMAIL="onboarding@resend.dev"`
- [ ] `NEXTAUTH_URL="https://your-staging-app.herokuapp.com"`
- [ ] `NODE_ENV="staging"`

#### Production
- [ ] `FROM_EMAIL="noreply@yourdomain.com"` (verified domain)
- [ ] `NEXTAUTH_URL="https://yourdomain.com"`
- [ ] `NODE_ENV="production"`

## Next Steps for Production

1. **Domain Verification**:
   - Sign up for Resend domain verification
   - Add your production domain
   - Update FROM_EMAIL to use verified domain

2. **Email Templates**:
   - Current templates are production-ready
   - Branded with your app colors and styling
   - Mobile-responsive design

3. **Monitoring**:
   - Resend provides delivery analytics
   - Check bounce rates and delivery success
   - Monitor from your Resend dashboard