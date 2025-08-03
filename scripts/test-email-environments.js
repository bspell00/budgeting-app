#!/usr/bin/env node

const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function testEmailEnvironment() {
  console.log('🧪 Testing Email Configuration Across Environments');
  console.log('=' * 60);
  
  const environment = process.env.NODE_ENV || 'development';
  console.log(`📍 Current Environment: ${environment}`);
  
  // Check configuration
  const config = {
    resendApiKey: process.env.RESEND_API_KEY ? 'Present' : 'Missing',
    fromEmail: process.env.FROM_EMAIL || 'Not set',
    nextAuthUrl: process.env.NEXTAUTH_URL || 'Not set',
    environment: environment
  };
  
  console.log('\n📋 Configuration Status:');
  Object.entries(config).forEach(([key, value]) => {
    const status = key === 'resendApiKey' && value === 'Present' ? '✅' : 
                   key === 'resendApiKey' && value === 'Missing' ? '❌' : '📄';
    console.log(`  ${status} ${key}: ${value}`);
  });
  
  if (!process.env.RESEND_API_KEY) {
    console.log('\n❌ Cannot test email sending - RESEND_API_KEY is missing');
    console.log('💡 Set RESEND_API_KEY in your environment to test email functionality');
    return;
  }
  
  const resend = new Resend(process.env.RESEND_API_KEY);
  const testEmail = 'bspell00@gmail.com'; // Your verified email
  
  try {
    console.log('\n📧 Testing email sending...');
    
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: [testEmail],
      subject: `Email Test - ${environment.toUpperCase()} Environment`,
      html: `
        <h2>📧 Email Configuration Test</h2>
        <p><strong>Environment:</strong> ${environment}</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>From:</strong> ${process.env.FROM_EMAIL || 'onboarding@resend.dev'}</p>
        <p><strong>API Key (last 4):</strong> ...${process.env.RESEND_API_KEY?.slice(-4)}</p>
        
        <div style="background: #f0f8ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3>✅ Email System Status</h3>
          <p>Email delivery is working correctly in the <strong>${environment}</strong> environment!</p>
        </div>
        
        <hr>
        <small>This is an automated test email from your budgeting app.</small>
      `,
    });
    
    if (result.data?.id) {
      console.log('✅ Email sent successfully!');
      console.log(`📧 Email ID: ${result.data.id}`);
      console.log(`📍 Environment: ${environment}`);
      console.log(`📨 To: ${testEmail}`);
      console.log(`📤 From: ${process.env.FROM_EMAIL || 'onboarding@resend.dev'}`);
      
      // Check for common issues
      if (environment === 'production' && (process.env.FROM_EMAIL || 'onboarding@resend.dev') === 'onboarding@resend.dev') {
        console.log('\n⚠️  Production Recommendation:');
        console.log('   Consider verifying your own domain at resend.com/domains');
        console.log('   and updating FROM_EMAIL to use your domain (e.g., noreply@yourdomain.com)');
      }
      
    } else if (result.error) {
      console.log('❌ Email sending failed');
      console.log('Error:', result.error);
      
      // Provide specific guidance based on error
      if (result.error.message?.includes('403') && result.error.message?.includes('testing emails')) {
        console.log('\n🔧 Issue: Resend is in testing mode');
        console.log('📧 You can only send emails to your verified email address');
        console.log('💡 To send to any email address:');
        console.log('   1. Go to resend.com/domains');
        console.log('   2. Verify your domain');
        console.log('   3. Update FROM_EMAIL to use your verified domain');
      }
    }
    
  } catch (error) {
    console.log('❌ Email test failed');
    console.log('Error:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n🔑 Authentication failed - check your RESEND_API_KEY');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.log('\n🌐 Network issue - check your internet connection');
    }
  }
  
  console.log('\n' + '=' * 60);
  console.log('📋 Environment-Specific Recommendations:');
  
  if (environment === 'development') {
    console.log('🔧 LOCAL: Email configuration looks good for development');
    console.log('   - Using onboarding@resend.dev (can only send to verified email)');
    console.log('   - This is expected behavior for free Resend accounts');
  } else if (environment === 'staging') {
    console.log('🚀 STAGING: Email configuration ready for staging tests');
    console.log('   - Using onboarding@resend.dev (can only send to verified email)');
    console.log('   - Ensure RESEND_API_KEY is set in staging environment');
  } else if (environment === 'production') {
    console.log('🏭 PRODUCTION: Consider these improvements:');
    console.log('   - Verify your domain at resend.com/domains');
    console.log('   - Update FROM_EMAIL to use your domain');
    console.log('   - This allows sending to any email address');
    console.log('   - Improves email deliverability and branding');
  }
}

// Run the test
testEmailEnvironment().catch(console.error);