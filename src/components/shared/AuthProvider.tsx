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
    user: auth0User || null,
    token,
    isLoading: auth0Loading || tokenLoading,
    isAuthenticated: !!auth0User,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}