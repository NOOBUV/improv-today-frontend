'use client';

import { useAuth } from './AuthProvider';
import { UserProfile } from '../subscription/UserProfile';

interface AuthProps {
  moodColor?: string;
}

export function Auth({ moodColor }: AuthProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-sm hidden sm:inline font-medium transition-colors duration-300"
        style={{
          color: moodColor || 'rgba(255, 255, 255, 0.8)'
        }}
      >
        {user.name || user.email}
      </span>
      <UserProfile />
    </div>
  );
}