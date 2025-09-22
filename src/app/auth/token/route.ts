import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'

export async function GET() {
  try {
    const session = await auth0.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const accessToken = await auth0.getAccessToken()
    
    if (!accessToken) {
      return NextResponse.json({ error: 'No access token available' }, { status: 400 })
    }

    return NextResponse.json({ accessToken: accessToken.token })
  } catch (error) {
    console.error('Token endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}