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

  const fetchAccessToken = useCallback(async () => {
    if (!auth0User) {
      setToken(null);
      localStorage.removeItem('auth_token');
      return;
    }
    
    setTokenLoading(true);
    try {
      const response = await fetch('/auth/token');
      if (response.ok) {
        const { accessToken } = await response.json();
        setToken(accessToken);
        localStorage.setItem('auth_token', accessToken);
      } else if (response.status === 401 || response.status === 500) {
        // Token expired or server error - trigger logout
        setToken(null);
        localStorage.removeItem('auth_token');
        window.location.href = '/auth/logout';
      }
    } catch (error) {
      console.error('Failed to fetch access token:', error);
      // On network error, also trigger logout
      setToken(null);
      localStorage.removeItem('auth_token');
      window.location.href = '/auth/logout';
    } finally {
      setTokenLoading(false);
    }
  }, [auth0User]);

  useEffect(() => {
    fetchAccessToken();
  }, [fetchAccessToken]);

  const refreshToken = useCallback(async () => {
    await fetchAccessToken();
  }, [fetchAccessToken]);

  const logout = () => {
    setToken(null);
    localStorage.removeItem('auth_token');
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