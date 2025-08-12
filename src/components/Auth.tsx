'use client';

import { useUser } from '@auth0/nextjs-auth0';
import { Button } from './ui/button';

export function Auth() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">
          Welcome, {user.name || user.email}
        </span>
        <Button 
          variant="outline" 
          size="sm"
          asChild
        >
          <a href="/auth/logout">Logout</a>
        </Button>
      </div>
    );
  }

  return (
    <Button 
      variant="default" 
      size="sm"
      asChild
    >
      <a href="/auth/login">Login</a>
    </Button>
  );
}