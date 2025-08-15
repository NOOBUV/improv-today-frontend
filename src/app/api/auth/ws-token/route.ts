import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // For demo purposes, return a demo token
    // In a real app, this would validate the session and return the Auth0 access token
    const demoToken = 'demo-websocket-jwt-token';
    
    // Return the demo token for WebSocket authentication
    return NextResponse.json({ token: demoToken });
    
  } catch (error) {
    console.error('WebSocket token error:', error);
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
}