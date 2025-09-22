'use client';

import { useAuth } from '@/components/shared/AuthProvider';
import { AdminUser } from '@/types/admin';
import { useMemo } from 'react';

export function useAdminAuth() {
  const { user, isLoading, isAuthenticated } = useAuth();

  const adminUser: AdminUser | null = useMemo(() => {
    if (!user) return null;

    // Check user roles from JWT token claims first
    const userRoles = user['https://improvtoday.com/roles'] || [];
    const hasAdminRole = Array.isArray(userRoles) && userRoles.includes('admin');
    
    // Fallback to email-based admin check for development
    const adminEmails = [
      'admin@improvtoday.com',
      'utkarshvijay99@gmail.com'
      // Add other admin emails as needed
    ];

    const isEmailAdmin = adminEmails.includes(user.email || '') ||
                        (user.email || '').endsWith('@improvtoday.com');

    const isAdmin = hasAdminRole || isEmailAdmin;

    const result: AdminUser = {
      id: user.sub || '',
      email: user.email || '',
      roles: isAdmin ? ['admin'] : ['user'],
      isAdmin,
    };

    if (user.name) {
      result.name = user.name;
    }

    return result;
  }, [user]);

  const checkAdminRole = () => {
    return adminUser?.isAdmin || false;
  };

  return {
    user: adminUser,
    isAdmin: adminUser?.isAdmin || false,
    isLoading,
    isAuthenticated,
    checkAdminRole,
  };
}