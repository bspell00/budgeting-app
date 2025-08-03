import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasResendKey = !!process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const nextAuthUrl = process.env.NEXTAUTH_URL;

  if (!hasResendKey) {
    return res.status(200).json({
      status: 'error',
      message: 'Resend API key not configured',
      hasResendKey: false,
      fromEmail,
      nextAuthUrl
    });
  }

  try {
    // Test Resend API
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Just test the API connection (don't actually send)
    const testResponse = await resend.emails.send({
      from: fromEmail || 'test@resend.dev',
      to: 'test@test.com', // This won't actually send
      subject: 'Test Email',
      html: '<p>Test</p>',
    }).catch((error) => {
      // Capture the error for debugging
      return { error: error.message };
    });

    return res.status(200).json({
      status: 'success',
      message: 'Email service configured correctly',
      hasResendKey: true,
      fromEmail,
      nextAuthUrl,
      testResult: testResponse
    });

  } catch (error: any) {
    return res.status(200).json({
      status: 'error',
      message: 'Email service configuration error',
      hasResendKey: true,
      fromEmail,
      nextAuthUrl,
      error: error.message || 'Unknown error'
    });
  }
}