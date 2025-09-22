'use client';

import { ReactNode } from 'react';
import { useUser } from '@auth0/nextjs-auth0';
import { LoginScreen } from './LoginScreen';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, error, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If there's an error or no user, show login screen
  // Auth0 v4 sometimes returns "Unauthorized" errors instead of null user
  if (error || !user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}