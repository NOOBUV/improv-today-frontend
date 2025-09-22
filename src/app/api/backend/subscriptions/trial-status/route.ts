import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    // Get the Authorization header from the request
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 })
    }

    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/subscriptions/trial-status`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      return NextResponse.json(
        { error: `Backend error: ${errorText}` }, 
        { status: backendResponse.status }
      )
    }

    const data = await backendResponse.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}