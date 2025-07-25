import crypto from 'crypto';
import CryptoJS from 'crypto-js';

// Generate a secure encryption key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted string with IV and auth tag
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  try {
    // Generate a random IV for each encryption
    const iv = crypto.randomBytes(16);
    // Derive a proper key from the encryption key
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param encryptedText - Encrypted string with IV and auth tag
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    // Derive the same key used for encryption
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data using SHA-256 (one-way)
 * @param text - Text to hash
 * @returns SHA-256 hash
 */
export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Encrypt Plaid access tokens with additional security
 * @param token - Plaid access token
 * @returns Encrypted token
 */
export function encryptPlaidToken(token: string): string {
  if (!token) return '';
  
  // Use crypto-js for additional security layer
  const encrypted = CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
  return encrypted;
}

/**
 * Decrypt Plaid access tokens
 * @param encryptedToken - Encrypted Plaid token
 * @returns Decrypted token
 */
export function decryptPlaidToken(encryptedToken: string): string {
  if (!encryptedToken) return '';
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Plaid token decryption error:', error);
    throw new Error('Failed to decrypt Plaid token');
  }
}

/**
 * Generate a secure random encryption key
 * @returns 256-bit hex key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate encryption key strength
 * @param key - Encryption key to validate
 * @returns Whether key is strong enough
 */
export function validateEncryptionKey(key: string): boolean {
  return key.length >= 32; // At least 256 bits
}