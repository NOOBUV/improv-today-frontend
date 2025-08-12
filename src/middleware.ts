import { NextRequest } from 'next/server';
import { auth0 } from './utils/auth0';

export function middleware(request: NextRequest) {
  return auth0.middleware(request);
}

export const config = {
  matcher: [
    // Mount built-in Auth0 routes under /auth/*
    '/auth/:path*',
    // Protect backend proxy by default
    '/api/backend/:path*',
  ],
};


