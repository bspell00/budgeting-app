import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { SecurityAuditService } from './secure-data';
import { 
  addProductionSecurityHeaders, 
  enhancedRateLimit, 
  createSecureAuditLog,
  sanitizeForAPI 
} from './security-enhancements';

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface SecurityConfig {
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  requireAuth?: boolean;
  auditAction?: string;
  sensitiveEndpoint?: boolean;
}

/**
 * Security middleware for API endpoints
 */
export function withSecurity(
  config: SecurityConfig = {}
) {
  return function (handler: Function) {
    return async function (req: NextApiRequest, res: NextApiResponse) {
      const {
        rateLimit = { maxRequests: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
        requireAuth = true,
        auditAction,
        sensitiveEndpoint = false,
      } = config;

      try {
        // Add enhanced security headers
        if (process.env.NODE_ENV === 'production') {
          addProductionSecurityHeaders(res);
        } else {
          addSecurityHeaders(res);
        }

        // Get client IP for rate limiting
        const clientIP = getClientIP(req);
        
        // Apply enhanced rate limiting
        const rateLimitResult = enhancedRateLimit(
          clientIP, 
          rateLimit.maxRequests, 
          rateLimit.windowMs
        );
        
        if (!rateLimitResult.allowed) {
          await SecurityAuditService.logSecurityEvent({
            action: 'RATE_LIMIT_EXCEEDED',
            resource: req.url || 'unknown',
            ip: clientIP,
            success: false,
            details: `Rate limit exceeded for IP: ${clientIP}`,
          });
          
          return res.status(429).json({ 
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
            remaining: rateLimitResult.remaining
          });
        }

        // Check authentication if required
        let session = null;
        let userId = null;
        
        if (requireAuth) {
          session = await getServerSession(req, res, authOptions);
          if (!session?.user) {
            await SecurityAuditService.logSecurityEvent({
              action: 'UNAUTHORIZED_ACCESS',
              resource: req.url || 'unknown',
              ip: clientIP,
              success: false,
              details: 'Attempted access without authentication',
            });
            
            return res.status(401).json({ error: 'Unauthorized' });
          }
          
          userId = (session.user as any).id;
          if (!userId) {
            return res.status(401).json({ error: 'No user ID found' });
          }
        }

        // Audit log for sensitive endpoints
        if (auditAction && userId) {
          await SecurityAuditService.logSecurityEvent({
            userId,
            action: auditAction,
            resource: req.url || 'unknown',
            ip: clientIP,
            userAgent: req.headers['user-agent'],
            success: true,
            details: `Accessed ${sensitiveEndpoint ? 'sensitive' : 'standard'} endpoint`,
          });
        }

        // Add security context to request
        (req as any).security = {
          userId,
          session,
          clientIP,
          isAuthenticated: !!session,
        };

        // Call the original handler
        return await handler(req, res);

      } catch (error) {
        console.error('Security middleware error:', error);
        
        await SecurityAuditService.logSecurityEvent({
          userId: (req as any).security?.userId,
          action: 'SECURITY_ERROR',
          resource: req.url || 'unknown',
          ip: getClientIP(req),
          success: false,
          details: `Security middleware error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });

        return res.status(500).json({ error: 'Security error occurred' });
      }
    };
  };
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(res: NextApiResponse) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (HTTPS only)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Content Security Policy - relaxed for auth flows
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.openai.com https://production.plaid.com https://development.plaid.com https://sandbox.plaid.com",
    "frame-src https://cdn.plaid.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
}

/**
 * Get client IP address
 */
function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
  }
  
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Simple rate limiting check
 */
function checkRateLimit(
  key: string, 
  config: { maxRequests: number; windowMs: number }
): boolean {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Clean up old entries
  const entriesToDelete: string[] = [];
  rateLimitMap.forEach((v, k) => {
    if (v.resetTime < now) {
      entriesToDelete.push(k);
    }
  });
  entriesToDelete.forEach(k => rateLimitMap.delete(k));
  
  const current = rateLimitMap.get(key);
  
  if (!current) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }
  
  if (current.resetTime < now) {
    // Window expired, reset
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }
  
  if (current.count >= config.maxRequests) {
    return false;
  }
  
  current.count++;
  return true;
}

/**
 * Validate sensitive input data
 */
export function validateInput(data: any, rules: Record<string, any>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    
    if (rule.required && (!value || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (rule.type && value !== undefined) {
      if (rule.type === 'email' && !isValidEmail(value)) {
        errors.push(`${field} must be a valid email`);
      }
      
      if (rule.type === 'number' && isNaN(Number(value))) {
        errors.push(`${field} must be a number`);
      }
      
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }
    }
    
    if (rule.minLength && value && value.length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} characters`);
    }
    
    if (rule.maxLength && value && value.length > rule.maxLength) {
      errors.push(`${field} must be no more than ${rule.maxLength} characters`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize output data (remove sensitive fields)
 */
export function sanitizeOutput(data: any, sensitiveFields: string[] = []): any {
  if (Array.isArray(data)) {
    return data.map(item => sanitizeOutput(item, sensitiveFields));
  }
  
  if (data && typeof data === 'object') {
    const sanitized = { ...data };
    
    // Remove common sensitive fields
    const defaultSensitiveFields = [
      'password',
      'plaidAccessToken',
      'secret',
      'key',
      'token',
      'hash',
    ];
    
    const fieldsToRemove = [...defaultSensitiveFields, ...sensitiveFields];
    
    for (const field of fieldsToRemove) {
      delete sanitized[field];
    }
    
    return sanitized;
  }
  
  return data;
}