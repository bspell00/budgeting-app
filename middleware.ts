import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV;
  const isProduction = environment === 'production';
  const showComingSoon = process.env.SHOW_COMING_SOON === 'true';
  const pathname = request.nextUrl.pathname;
  
  // Allow these paths even in production
  const allowedProductionPaths = [
    '/coming-soon',
    '/api/',
    '/_next/',
    '/img/',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml'
  ];
  
  // Check if current path is allowed
  const isAllowedPath = allowedProductionPaths.some(path => 
    pathname.startsWith(path) || pathname === path
  );
  
  // If coming soon is enabled and not an allowed path, redirect to coming soon
  if ((isProduction && showComingSoon) && !isAllowedPath && pathname !== '/coming-soon') {
    return NextResponse.redirect(new URL('/coming-soon', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};