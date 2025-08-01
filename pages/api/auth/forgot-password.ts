import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { withSecurity, validateInput } from '../../../lib/security-middleware';
import { sendEmail, generatePasswordResetEmail } from '../../../lib/email';
import { storeResetToken } from '../../../lib/temp-token-store';

const prisma = new PrismaClient();

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  // Validate input
  const validation = validateInput({ email }, {
    email: { required: true, type: 'email' }
  });

  if (!validation.isValid) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: validation.errors 
    });
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    // But only send email if user actually exists
    if (user) {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token temporarily (in memory for development)
      // In production, add resetToken and resetTokenExpiry fields to User model
      storeResetToken(email, resetToken, resetTokenExpiry);

      // Generate reset URL - ensure we have a valid base URL
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
      const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      
      console.log('🔗 Generated reset URL:', resetUrl);
      
      // Send password reset email
      const emailResult = await sendEmail({
        to: email,
        subject: 'Reset Your Password - Budget App',
        html: generatePasswordResetEmail(resetUrl, email),
      });

      if (emailResult.success) {
        console.log(`✅ Password reset email sent to ${email}`);
      } else {
        console.error(`❌ Failed to send password reset email to ${email}:`, emailResult.error);
        // Still log the reset link for development
        console.log('--- PASSWORD RESET LINK (Development Fallback) ---');
        console.log(`Visit: ${resetUrl}`);
        console.log('--- END RESET LINK ---');
      }
    }

    // Always return success message
    res.json({ 
      success: true, 
      message: 'If an account with that email exists, we have sent you a password reset link.' 
    });

  } catch (error) {
    console.error('Password reset error:', error);
    
    // More detailed error for debugging in staging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      environment: process.env.NODE_ENV,
      hasResendKey: !!process.env.RESEND_API_KEY,
      nextAuthUrl: process.env.NEXTAUTH_URL
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}

export default withSecurity({
  requireAuth: false,
  auditAction: 'PASSWORD_RESET_REQUEST',
  sensitiveEndpoint: true,
})(handler);