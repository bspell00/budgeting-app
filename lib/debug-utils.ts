// Debug utilities for WebSocket and development issues
export function addGlobalErrorHandler() {
  if (typeof window === 'undefined') return;

  // Capture and filter error events to identify sources
  window.addEventListener('error', (event) => {
    const error = event.error;
    const message = event.message;
    
    // Filter out browser extension errors
    if (
      message?.includes('Cannot respond. No request with id') ||
      message?.includes('Extension') ||
      event.filename?.includes('extension') ||
      event.filename?.includes('chrome-extension') ||
      event.filename?.includes('moz-extension')
    ) {
      console.log('🔍 Filtered out browser extension error:', message);
      event.preventDefault();
      return false;
    }

    // Log our application errors with context
    if (message?.includes('WebSocket') || message?.includes('Socket.IO')) {
      console.error('🔌 WebSocket-related error:', {
        message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: error?.stack
      });
    }
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    
    // Filter out extension-related promise rejections
    if (
      reason?.message?.includes('Cannot respond. No request with id') ||
      reason?.message?.includes('Extension') ||
      reason?.stack?.includes('extension')
    ) {
      console.log('🔍 Filtered out browser extension promise rejection:', reason?.message);
      event.preventDefault();
      return false;
    }

    // Log our application promise rejections
    console.error('🔌 Unhandled promise rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack
    });
  });

  console.log('🔍 Global error handler installed');
}

export function debugWebSocketConnection() {
  if (typeof window === 'undefined') return;

  console.log('🔍 WebSocket Debug Info:', {
    userAgent: navigator.userAgent,
    location: window.location.href,
    sessionStorage: !!window.sessionStorage,
    localStorage: !!window.localStorage,
    webSocketSupport: !!window.WebSocket,
    extensions: (window as any).chrome?.runtime ? 'Chrome extensions detected' : 'No Chrome extensions detected'
  });
}