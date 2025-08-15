import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

export async function GET(request: NextRequest) {
  const { pathname } = new URL(request.url);
  const authAction = pathname.split('/').pop();

  switch (authAction) {
    case 'login':
      // Redirect to Auth0 login
      const baseUrlForLogin = process.env.AUTH0_BASE_URL || '';
      const loginUrl = `https://${process.env.AUTH0_DOMAIN}/authorize?response_type=code&client_id=${process.env.AUTH0_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrlForLogin + '/api/auth/callback')}&scope=openid profile email`;
      return NextResponse.redirect(loginUrl);

    case 'logout':
      // Handle logout
      const baseUrl = process.env.AUTH0_BASE_URL || '';
      const logoutUrl = `https://${process.env.AUTH0_DOMAIN}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(baseUrl)}`;
      
      const response = NextResponse.redirect(logoutUrl);
      
      // Clear session cookies
      const cookiesToClear = ['appSession', 'appSession.0', 'appSession.1', 'appSession.2', 'auth0'];
      cookiesToClear.forEach(cookieName => {
        response.cookies.set(cookieName, '', {
          expires: new Date(0),
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        });
      });
      
      return response;

    case 'callback':
      // Handle OAuth callback
      try {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        
        if (!code) {
          return NextResponse.redirect(new URL('/?error=missing_code', request.url));
        }

        // Exchange authorization code for tokens
        const tokenResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: process.env.AUTH0_CLIENT_ID,
            client_secret: process.env.AUTH0_CLIENT_SECRET,
            code: code,
            redirect_uri: `${process.env.AUTH0_BASE_URL || ''}/api/auth/callback`,
          }),
        });

        if (!tokenResponse.ok) {
          console.error('Token exchange failed:', await tokenResponse.text());
          return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
        }

        const tokens = await tokenResponse.json();
        
        // Get user info
        const userResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });

        if (!userResponse.ok) {
          console.error('Failed to get user info:', await userResponse.text());
          return NextResponse.redirect(new URL('/?error=user_info_failed', request.url));
        }

        const user = await userResponse.json();
        
        // Create session and redirect to home
        const response = NextResponse.redirect(new URL('/', request.url));
        
        // Set session cookies
        response.cookies.set('appSession', JSON.stringify({
          user: user,
          accessToken: tokens.access_token,
          idToken: tokens.id_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000)
        }), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: tokens.expires_in,
          path: '/'
        });
        
        return response;
      } catch (error) {
        console.error('Callback error:', error);
        return NextResponse.redirect(new URL('/?error=callback_failed', request.url));
      }

    case 'profile':
      // Get user profile
      try {
        const session = await auth0.getSession();
        if (!session) {
          return NextResponse.json({ error: 'No session' }, { status: 401 });
        }
        return NextResponse.json(session.user);
      } catch {
        return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
      }

    default:
      return NextResponse.json({ error: 'Invalid auth action' }, { status: 404 });
  }
}