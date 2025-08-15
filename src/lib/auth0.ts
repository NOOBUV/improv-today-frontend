import { cookies } from 'next/headers';

class CustomAuth0Client {
  async getSession() {
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get('appSession');
      
      if (!sessionCookie) {
        return null;
      }

      const session = JSON.parse(sessionCookie.value);
      
      // Check if session is expired
      if (session.expiresAt && Date.now() > session.expiresAt) {
        return null;
      }

      return {
        user: session.user,
        accessToken: session.accessToken,
        idToken: session.idToken,
        refreshToken: session.refreshToken
      };
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }
}

export const auth0 = new CustomAuth0Client();