'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser } from '@auth0/nextjs-auth0';

interface User {
  name?: string;
  email?: string;
  sub?: string;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// Dev-only login bypass. NODE_ENV is 'production' in any real build, so this is
// compile-time dead code there. Counterpart to the backend's dev auth bypass
// (it accepts requests with no Authorization header when environment=development).
export const DEV_AUTH_BYPASS = process.env.NODE_ENV === 'development';
export const DEV_USER: User = { name: 'Dev User', email: 'dev@localhost', sub: 'dev|localhost' };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { user: auth0User, isLoading: auth0Loading } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);

  // Stable token fetching function - no auth0User dependency
  const fetchAccessToken = useCallback(async () => {
    setTokenLoading(true);
    try {
      const response = await fetch('/auth/token');
      if (response.ok) {
        const { accessToken } = await response.json();
        console.log('AuthProvider: Token fetched successfully');
        setToken(accessToken);
      } else if (response.status === 401) {
        // User not authenticated - clear token but don't auto-logout
        console.log('AuthProvider: Authentication required, clearing token');
        setToken(null);
      } else {
        // Other errors - log but don't auto-logout
        console.error('AuthProvider: Token fetch error:', response.status);
        setToken(null);
      }
    } catch (error) {
      console.error('AuthProvider: Failed to fetch access token:', error);
      setToken(null);
    } finally {
      setTokenLoading(false);
    }
  }, []); // No dependencies - stable function

  // Only fetch token when auth0User changes
  useEffect(() => {
    if (DEV_AUTH_BYPASS) return;
    console.log('AuthProvider: useEffect triggered, auth0User:', !!auth0User);
    if (auth0User) {
      fetchAccessToken();
    } else {
      setToken(null);
    }
  }, [auth0User, fetchAccessToken]); // Include fetchAccessToken since it's stable now

  const refreshToken = useCallback(async () => {
    if (auth0User) {
      await fetchAccessToken();
    }
  }, [auth0User, fetchAccessToken]); // Both are now stable

  const logout = () => {
    setToken(null);
    window.location.href = '/auth/logout';
  };

  const value: AuthContextType = {
    user: DEV_AUTH_BYPASS ? DEV_USER : auth0User || null,
    // Stays null in dev: /api/backend/* is rewritten straight to the backend (next.config.ts),
    // so the browser's own Authorization header is what it sees — and it only falls back to the
    // dev user when that header is ABSENT. No token => every `Bearer ${token}` site skips it.
    token: DEV_AUTH_BYPASS ? null : token,
    isLoading: DEV_AUTH_BYPASS ? false : auth0Loading || tokenLoading,
    isAuthenticated: DEV_AUTH_BYPASS || !!auth0User,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}