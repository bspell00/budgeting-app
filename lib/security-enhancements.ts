import crypto from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Enhanced security utilities for production deployment
 */

/**
 * Generate secure encryption key for production
 */
export function generateSecureEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate secure NextAuth secret
 */
export function generateSecureNextAuthSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Enhanced rate limiting with sliding window
 */
interface RateLimitEntry {
  requests: number[];
  blocked: boolean;
  blockExpiry?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function enhancedRateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  blockDurationMs: number = 60 * 60 * 1000 // 1 hour block
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  let entry = rateLimitStore.get(key);
  
  // Check if currently blocked
  if (entry?.blocked && entry.blockExpiry && now < entry.blockExpiry) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.blockExpiry
    };
  }
  
  // Initialize or clean entry
  if (!entry) {
    entry = { requests: [], blocked: false };
    rateLimitStore.set(key, entry);
  }
  
  // Remove old requests outside window
  entry.requests = entry.requests.filter(time => time > windowStart);
  entry.blocked = false;
  entry.blockExpiry = undefined;
  
  // Check if limit exceeded
  if (entry.requests.length >= maxRequests) {
    // Block for extended period
    entry.blocked = true;
    entry.blockExpiry = now + blockDurationMs;
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.blockExpiry
    };
  }
  
  // Add current request
  entry.requests.push(now);
  
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - entry.requests.length),
    resetTime: windowStart + windowMs
  };
}

/**
 * Content Security Policy for production
 */
export function getProductionCSP(): string {
  return [
    "default-src 'self'",
    "script-src 'self' https://cdn.plaid.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.openai.com https://production.plaid.com",
    "frame-src https://cdn.plaid.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
}

/**
 * Enhanced security headers for production
 */
export function addProductionSecurityHeaders(res: NextApiResponse) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (2 years)
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', getProductionCSP());
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()'
  ].join(', '));
  
  // Remove server signature
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
}

/**
 * Secure session configuration
 */
export const secureSessionConfig = {
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      }
    },
    callbackUrl: {
      name: '__Secure-next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60
      }
    },
    csrfToken: {
      name: '__Host-next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  }
};

/**
 * Data sanitization for API responses
 */
export function sanitizeForAPI(data: any): any {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForAPI(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Remove sensitive fields
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key') ||
          key === 'plaidAccessToken') {
        continue;
      }
      
      sanitized[key] = sanitizeForAPI(value);
    }
    
    return sanitized;
  }
  
  return data;
}

/**
 * Validate IP address for geolocation blocking
 */
export function validateIPAddress(ip: string): {
  isValid: boolean;
  isPrivate: boolean;
  country?: string;
} {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  const isValid = ipv4Regex.test(ip) || ipv6Regex.test(ip);
  
  // Check for private IP ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];
  
  const isPrivate = privateRanges.some(range => range.test(ip));
  
  return { isValid, isPrivate };
}

/**
 * Secure password validation
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }
  
  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain lowercase letters');
  } else {
    score += 1;
  }
  
  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain uppercase letters');
  } else {
    score += 1;
  }
  
  if (!/\d/.test(password)) {
    feedback.push('Password must contain numbers');
  } else {
    score += 1;
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Password must contain special characters');
  } else {
    score += 1;
  }
  
  if (password.length >= 12) {
    score += 1;
  }
  
  return {
    isValid: score >= 4,
    score,
    feedback
  };
}

/**
 * Generate secure audit log entry
 */
export function createSecureAuditLog(event: {
  userId?: string;
  action: string;
  resource: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  sensitiveData?: boolean;
  details?: string;
}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventId: crypto.randomUUID(),
    ...event,
    // Hash IP for privacy while maintaining ability to detect patterns
    ipHash: event.ip ? crypto.createHash('sha256').update(event.ip).digest('hex').substring(0, 16) : undefined,
    // Hash user agent for privacy
    userAgentHash: event.userAgent ? crypto.createHash('sha256').update(event.userAgent).digest('hex').substring(0, 16) : undefined
  };
  
  // Remove original IP and user agent after hashing
  delete (logEntry as any).ip;
  delete (logEntry as any).userAgent;
  
  return logEntry;
}

/**
 * Environment security validation
 */
export function validateEnvironmentSecurity(): {
  isSecure: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check encryption key
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length < 32) {
    issues.push('Encryption key is missing or too short');
    recommendations.push('Generate a 256-bit (32-byte) encryption key');
  }
  
  // Check NextAuth secret
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (!nextAuthSecret || nextAuthSecret.length < 32) {
    issues.push('NextAuth secret is missing or too short');
    recommendations.push('Generate a secure NextAuth secret (32+ characters)');
  }
  
  // Check HTTPS enforcement
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.startsWith('https://')) {
    issues.push('HTTPS not enforced in production');
    recommendations.push('Set NEXTAUTH_URL to use HTTPS in production');
  }
  
  // Check for development keys in production
  if (process.env.NODE_ENV === 'production') {
    if (encryptionKey?.includes('dev') || encryptionKey?.includes('test')) {
      issues.push('Development encryption key used in production');
      recommendations.push('Generate production-specific encryption key');
    }
    
    if (nextAuthSecret?.includes('dev') || nextAuthSecret?.includes('test')) {
      issues.push('Development NextAuth secret used in production');
      recommendations.push('Generate production-specific NextAuth secret');
    }
  }
  
  return {
    isSecure: issues.length === 0,
    issues,
    recommendations
  };
}