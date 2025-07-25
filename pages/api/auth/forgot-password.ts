import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { withSecurity, validateInput } from '../../../lib/security-middleware';

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

      // Store reset token (in a real app, you'd want a separate table for this)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          // Note: In production, you'd add these fields to your schema
          // resetToken,
          // resetTokenExpiry,
        }
      });

      // In a real app, you'd send an email here
      console.log(`Password reset requested for ${email}`);
      console.log(`Reset token: ${resetToken}`);
      console.log(`Reset URL: ${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`);
      
      // For development, log the reset link
      console.log('--- PASSWORD RESET LINK (Development Only) ---');
      console.log(`Visit: ${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`);
      console.log('--- END RESET LINK ---');
    }

    // Always return success message
    res.json({ 
      success: true, 
      message: 'If an account with that email exists, we have sent you a password reset link.' 
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default withSecurity({
  requireAuth: false,
  auditAction: 'PASSWORD_RESET_REQUEST',
  sensitiveEndpoint: true,
})(handler);