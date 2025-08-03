import { Resend } from 'resend';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  // Use custom ENVIRONMENT variable for proper staging detection
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not configured. Email would be sent to:', to);
      console.warn('📧 Email subject:', subject);
      console.warn('🔧 Set RESEND_API_KEY environment variable to enable email sending');
      
      // In development, still log the email content for testing
      if (environment === 'development') {
        console.log('--- EMAIL CONTENT (Development) ---');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('HTML Preview:', html.substring(0, 200) + '...');
        console.log('--- END EMAIL CONTENT ---');
      }
      
      return { success: false, error: 'Email service not configured - RESEND_API_KEY missing' };
    }

    // Determine the appropriate FROM email based on environment
    let fromEmail = from || process.env.FROM_EMAIL || 'onboarding@resend.dev';
    
    // For production, ensure we're using a verified domain
    if (environment === 'production' && fromEmail === 'onboarding@resend.dev') {
      console.warn('⚠️ Using default Resend email in production. Consider verifying your own domain.');
    }

    const result = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html,
    });

    // Enhanced logging based on environment
    if (environment === 'development') {
      console.log('📧 Email sent successfully in development:', {
        to,
        subject,
        emailId: result.data?.id,
        from: fromEmail
      });
    } else {
      console.log('📧 Email sent successfully:', {
        emailId: result.data?.id,
        environment
      });
    }

    return { success: true, id: result.data?.id };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Enhanced error handling for different environments
    console.error(`❌ Failed to send email in ${environment}:`, {
      error: errorMessage,
      to: environment === 'development' ? to : '[redacted]',
      subject: environment === 'development' ? subject : '[redacted]'
    });

    // Specific error handling for common Resend issues
    if (errorMessage.includes('403') && errorMessage.includes('testing emails')) {
      console.error('🔧 Resend is in testing mode. You can only send emails to your verified email address.');
      console.error('💡 To send to any email: Verify a domain at resend.com/domains');
    } else if (errorMessage.includes('401')) {
      console.error('🔑 Authentication failed. Check your RESEND_API_KEY.');
    } else if (errorMessage.includes('domain')) {
      console.error('🌐 Domain verification issue. Check your Resend domain settings.');
    }

    return { success: false, error: errorMessage };
  }
}

export function generatePasswordResetEmail(resetUrl: string, userEmail: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 32px;
        }
        .logo {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #004735, #151C18);
          border-radius: 20px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        h1 {
          color: #151C18;
          font-size: 28px;
          margin: 0 0 8px 0;
          font-weight: 700;
        }
        .subtitle {
          color: #6b7280;
          font-size: 16px;
          margin: 0;
        }
        .content {
          margin: 32px 0;
        }
        .reset-button {
          display: inline-block;
          background: #004735;
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 600;
          font-size: 16px;
          text-align: center;
          margin: 24px 0;
          transition: background-color 0.3s ease;
        }
        .reset-button:hover {
          background: #003527;
        }
        .security-info {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 16px;
          margin: 24px 0;
        }
        .security-title {
          color: #15803d;
          font-weight: 600;
          font-size: 14px;
          margin: 0 0 8px 0;
        }
        .security-text {
          color: #166534;
          font-size: 14px;
          margin: 0;
        }
        .footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
          text-align: center;
        }
        .footer a {
          color: #004735;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">💰</div>
          <h1>Reset Your Password</h1>
          <p class="subtitle">We received a request to reset your password</p>
        </div>
        
        <div class="content">
          <p>Hi there,</p>
          <p>Someone (hopefully you!) requested a password reset for your account associated with <strong>${userEmail}</strong>.</p>
          <p>Click the button below to reset your password. This link will expire in 1 hour for security reasons.</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="reset-button">Reset My Password</a>
          </div>
          
          <div class="security-info">
            <p class="security-title">🔒 Security Notice</p>
            <p class="security-text">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280; font-family: monospace; font-size: 12px; background: #f9fafb; padding: 8px; border-radius: 6px;">${resetUrl}</p>
        </div>
        
        <div class="footer">
          <p>This email was sent by your budgeting app. If you have questions, please contact our support team.</p>
          <p>© 2024 Budget App. Built with ❤️ for financial freedom.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}