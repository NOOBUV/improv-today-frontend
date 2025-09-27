import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    // Get the Authorization header from the request
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 })
    }

    // Extract query parameters from the URL
    const url = new URL(request.url)
    const planPriceId = url.searchParams.get('plan_price_id')
    const successUrl = url.searchParams.get('success_url')
    const cancelUrl = url.searchParams.get('cancel_url')

    if (!planPriceId || !successUrl || !cancelUrl) {
      return NextResponse.json({ 
        error: 'Missing required query parameters: plan_price_id, success_url, cancel_url' 
      }, { status: 400 })
    }

    // Build query string for backend
    const backendParams = new URLSearchParams({
      plan_price_id: planPriceId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/subscriptions/upgrade-checkout?${backendParams}`, {
      method: 'POST',
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