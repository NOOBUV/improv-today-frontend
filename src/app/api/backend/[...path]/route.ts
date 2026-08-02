import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

// NOTE: next.config.ts rewrites /api/backend/:path* straight to the backend, which shadows
// this handler — the browser's own Authorization header is what the backend actually sees.
// Kept in sync anyway so the two paths don't diverge if that rewrite is ever removed.
// Dev-only: skip Auth0 and forward with NO Authorization header — the backend accepts
// unauthenticated requests as a dev user when its environment is development.
// NODE_ENV is 'production' in any real build, so this is compile-time dead code there.
const DEV_AUTH_BYPASS = process.env.NODE_ENV === 'development';

async function handle(req: Request) {
  try {
    console.log('🚀 Auth0 Bearer proxy hit for:', req.url);

    // Try to get session and access token from Auth0
    let accessToken: string | null = null;

    try {
      const session = DEV_AUTH_BYPASS ? null : await auth0.getSession();
      console.log('🔍 Auth0 session exists:', !!session);
      
      if (session) {
        accessToken = (session.accessToken as string) || null;
        console.log('✅ Auth0 access token retrieved:', !!accessToken);
        
        if (accessToken) {
          console.log('🔑 Token type:', accessToken.startsWith('eyJ') ? 'JWT' : 'opaque');
        }
      }
    } catch (auth0Error) {
      console.log('⚠️ Auth0 token retrieval failed, trying fallback:', auth0Error);
      
      // Fallback: check for demo token in Authorization header
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.replace('Bearer ', '');
        console.log('🎭 Using fallback token:', accessToken.substring(0, 20) + '...');
      }
    }
    
    if (!accessToken && !DEV_AUTH_BYPASS) {
      console.log('❌ No valid Bearer token found');
      return NextResponse.json(
        { error: 'Authentication required - Bearer token missing' },
        { status: 401 }
      );
    }

    // Build the backend URL
    const { pathname, search } = new URL(req.url);
    const pathString = pathname.replace(/^\/api\/backend\//, '');
    const url = `${API_BASE}/api/${pathString}${search}`;
    
    // Prepare headers with authentication
    const headers: Record<string, string> = {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      'Content-Type': 'application/json',
    };
    
    // Handle request body for POST/PUT/PATCH
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      body = await req.text();
    }
    
    // Forward request to backend
    console.log('Forwarding to backend:', { url, method: req.method, hasAuth: !!headers.Authorization });
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: body || null,
    });
    
    // Get response data
    const responseData = await response.text();
    console.log('Backend response:', { status: response.status, hasData: !!responseData });
    
    if (!response.ok) {
      console.error('Backend error response:', responseData);
    }
    
    // Return response with same status and headers
    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
    
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

export async function PUT(req: Request) {
  return handle(req);
}

export async function PATCH(req: Request) {
  return handle(req);
}

export async function DELETE(req: Request) {
  return handle(req);
}