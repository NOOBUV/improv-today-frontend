import { NextResponse } from 'next/server';
import { auth0 } from '@/utils/auth0';

export async function GET() {
  try {
    // Check if user has session
    const session = await auth0.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get access token from Auth0 session
    const { token: accessToken } = await auth0.getAccessToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Return the token for WebSocket authentication
    return NextResponse.json({ token: accessToken });
    
  } catch (error) {
    console.error('WebSocket token error:', error);
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
}