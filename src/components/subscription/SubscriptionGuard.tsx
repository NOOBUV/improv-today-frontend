'use client';

import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/components/shared/AuthProvider';
import { useSubscriptionStore, useCanAccessConversation } from '@/store/subscription-store';
import { TrialSignup } from './TrialSignup';
import { SubscriptionStatus } from './SubscriptionStatus';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { token } = useAuth();
  const {
    subscriptionStatus,
    isLoadingTrialStatus,
    fetchSubscriptionStatus,
    fetchSubscriptionPlans
  } = useSubscriptionStore();
  
  const canAccessConversation = useCanAccessConversation();

  // DEBUG: Test SubscriptionGuard only
  console.log('SubscriptionGuard: Rendered, token:', token ? 'present' : 'missing');
  console.log('SubscriptionGuard: Subscription status:', subscriptionStatus);
  console.log('SubscriptionGuard: Can access conversation:', canAccessConversation);
  useEffect(() => {
    console.log('SubscriptionGuard: useEffect triggered, token:', token ? 'present' : 'missing');
    if (token) {
      console.log('SubscriptionGuard: Fetching subscription status with token');
      fetchSubscriptionStatus(token);
    } else {
      console.log('SubscriptionGuard: No token available yet');
    }
  }, [token]); // Only depend on token - fetchSubscriptionStatus is stable

  // Fetch subscription plans once when SubscriptionGuard mounts
  useEffect(() => {
    fetchSubscriptionPlans();
  }, []); // Only fetch once when component mounts

  // Only show loading spinner if subscription status is being fetched AND we don't have it yet
  if (isLoadingTrialStatus && !subscriptionStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If user doesn't have access, show appropriate signup/upgrade UI
  if (!canAccessConversation) {
    if (!subscriptionStatus) {
      // No subscription status yet - user needs to sign up for trial
      return <TrialSignup />;
    }
    
    // Use the new user_type field to determine what to show
    switch (subscriptionStatus.user_type) {
      case 'new_user':
        // New user who has never had a subscription - show trial signup
        return <TrialSignup />;
      case 'previous_subscriber':
        // User had a subscription that ended - show subscription options
        return <SubscriptionStatus />;
      case 'trial_user':
        // User has a trial (could be active or expired)
        if (!subscriptionStatus.is_trial_active) {
          return <SubscriptionStatus />;
        }
        // Active trial users with access are handled above
        return <SubscriptionStatus />;
      case 'subscriber':
        // Active subscriber - should have access (handled above)
        return <SubscriptionStatus />;
      default:
        // Fallback - show trial signup for unknown states
        return <TrialSignup />;
    }
  }

  // User has access - show the protected content
  return <>{children}</>;
}