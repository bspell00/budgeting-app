// Temporary in-memory token storage for development
// In production, these should be stored in the database

interface ResetToken {
  email: string;
  token: string;
  expiry: Date;
}

// In-memory storage (will be lost on server restart)
const resetTokens = new Map<string, ResetToken>();

export function storeResetToken(email: string, token: string, expiry: Date) {
  resetTokens.set(token, {
    email: email.toLowerCase(),
    token,
    expiry,
  });
  
  // Log for development
  console.log(`🔒 Reset token stored for ${email} (expires: ${expiry.toISOString()})`);
  console.log(`📝 Current tokens in memory: ${resetTokens.size}`);
}

export function getResetToken(token: string): ResetToken | null {
  const storedToken = resetTokens.get(token);
  
  if (!storedToken) {
    console.log(`❌ Token not found: ${token}`);
    return null;
  }
  
  // Check if token has expired
  if (new Date() > storedToken.expiry) {
    console.log(`⏰ Token expired for ${storedToken.email}`);
    resetTokens.delete(token);
    return null;
  }
  
  console.log(`✅ Valid token found for ${storedToken.email}`);
  return storedToken;
}

export function deleteResetToken(token: string): boolean {
  const deleted = resetTokens.delete(token);
  console.log(`🗑️ Token ${deleted ? 'deleted' : 'not found'}: ${token}`);
  return deleted;
}

export function cleanExpiredTokens() {
  const now = new Date();
  let cleaned = 0;
  
  // Use forEach instead of for...of to avoid TypeScript target issues
  resetTokens.forEach((data, token) => {
    if (now > data.expiry) {
      resetTokens.delete(token);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired tokens`);
  }
}

// Clean expired tokens every 5 minutes
setInterval(cleanExpiredTokens, 5 * 60 * 1000);