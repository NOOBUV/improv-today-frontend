import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

export async function GET() {
  try {
    const session = await auth0.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      );
    }

    // Get access token from session
    const accessToken = session.accessToken;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token found' },
        { status: 401 }
      );
    }

    console.log('🔑 Providing access token to frontend:', accessToken.startsWith('eyJ') ? 'JWT' : 'opaque');
    
    return NextResponse.json({ 
      accessToken,
      tokenType: accessToken.startsWith('eyJ') ? 'JWT' : 'opaque'
    });
    
  } catch (error) {
    console.error('Token endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    );
  }
}