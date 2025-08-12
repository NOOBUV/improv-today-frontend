import { NextResponse } from 'next/server';
import { auth0 } from '@/utils/auth0';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

async function handle(req: Request) {
  try {
    // Get session from Auth0
    const session = await auth0.getSession();
    console.log('Session exists:', !!session);
    
    if (!session) {
      console.log('No session found for API proxy request');
      return NextResponse.json(
        { error: 'Authentication required - no session' },
        { status: 401 }
      );
    }
    
    // Get access token from Auth0
    const { token: accessToken } = await auth0.getAccessToken();
    console.log('Access token exists:', !!accessToken);
    
    // Build the backend URL
    const { pathname, search } = new URL(req.url);
    const pathString = pathname.replace(/^\/api\/backend\//, '');
    const url = `${API_BASE}/api/${pathString}${search}`;
    
    // Prepare headers with authentication
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    
    // Handle request body for POST/PUT/PATCH
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      body = await req.text();
    }
    
    // Forward request to backend
    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
    });
    
    // Get response data
    const responseData = await response.text();
    
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