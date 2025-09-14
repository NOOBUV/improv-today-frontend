'use client';

import { useAuth } from './AuthProvider';
import { UserProfile } from '../subscription/UserProfile';

export function Auth() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 hidden sm:inline">
        Welcome, {user.name || user.email}
      </span>
      <UserProfile />
    </div>
  );
}