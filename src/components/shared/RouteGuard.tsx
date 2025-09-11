'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RouteGuardProps {
  children: React.ReactNode;
  route: string;
  disabled?: boolean;
  redirectTo?: string;
  disabledMessage?: string;
}

export function RouteGuard({ 
  children, 
  route, 
  disabled = false, 
  redirectTo = '/conversation',
  disabledMessage = 'This feature is currently disabled.' 
}: RouteGuardProps) {
  const router = useRouter();

  useEffect(() => {
    if (disabled) {
      // Redirect to the specified route when disabled
      console.warn(`Route ${route} is disabled, redirecting to ${redirectTo}`);
      router.push(redirectTo);
    }
  }, [disabled, route, redirectTo, router]);

  // If disabled, show a message while redirecting
  if (disabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Feature Unavailable</h1>
          <p className="text-white/70 mb-6">{disabledMessage}</p>
          <div className="text-white/50 text-sm">Redirecting...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}