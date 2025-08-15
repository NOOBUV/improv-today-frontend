'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
  const [token, setToken] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/profile');
      if (response.ok) {
        const userData = await response.json();
        setSessionUser(userData);
        
        // Try to get access token
        const tokenResponse = await fetch('/api/auth/token');
        if (tokenResponse.ok) {
          const { accessToken } = await tokenResponse.json();
          setToken(accessToken);
          localStorage.setItem('auth_token', accessToken);
        }
      }
    } catch {
      // Clear any stale session data
      setSessionUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
    }
  };

  const fetchAccessToken = useCallback(async () => {
    if (!sessionUser) return;
    
    try {
      const response = await fetch('/api/auth/token');
      if (response.ok) {
        const { accessToken } = await response.json();
        setToken(accessToken);
        localStorage.setItem('auth_token', accessToken);
      }
    } catch {
      // Fallback to demo token for development
      const demoToken = 'demo-jwt-token';
      setToken(demoToken);
      localStorage.setItem('auth_token', demoToken);
    }
  }, [sessionUser]);

  useEffect(() => {
    const initAuth = async () => {
      // First check if we have a session cookie
      await checkSession();
      setIsLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (sessionUser) {
      fetchAccessToken();
    } else {
      // No session, check for demo token
      const savedToken = localStorage.getItem('auth_token');
      if (savedToken) {
        setToken(savedToken);
      }
    }
  }, [sessionUser, fetchAccessToken]);

  const refreshToken = async () => {
    await fetchAccessToken();
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('auth_token');
    window.location.href = '/api/auth/logout';
  };

  const value: AuthContextType = {
    user: sessionUser,
    token,
    isLoading: isLoading,
    isAuthenticated: !!sessionUser || !!token,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}