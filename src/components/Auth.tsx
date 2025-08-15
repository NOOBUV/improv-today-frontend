'use client';

import { useAuth } from './AuthProvider';
import { Button } from './ui/button';

export function Auth() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700">
        Welcome, {user?.name || user?.email}
      </span>
      <Button 
        variant="outline" 
        size="sm"
        onClick={logout}
      >
        Logout
      </Button>
    </div>
  );
}