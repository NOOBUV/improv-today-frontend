/**
 * Subscription Store - Zustand store for managing subscription state
 * Handles trial status, subscription plans, and loading states
 */

import { create } from 'zustand';
import { subscriptionService, SubscriptionPlan, UserSubscriptionStatus } from '@/services/subscription-service';

interface SubscriptionStore {
  // State
  subscriptionStatus: UserSubscriptionStatus | null;
  subscriptionPlans: SubscriptionPlan[];
  isLoading: boolean;
  isLoadingTrialStatus: boolean;
  isLoadingPlans: boolean;
  error: string | null;
  
  // Actions
  fetchSubscriptionStatus: (token?: string | null) => Promise<void>;
  fetchSubscriptionPlans: () => Promise<void>;
  startTrial: (token?: string | null) => Promise<boolean>;
  createUpgradeCheckout: (planPriceId: string, token?: string | null) => Promise<string | null>;
  clearError: () => void;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  // Initial state
  subscriptionStatus: null,
  subscriptionPlans: [],
  isLoading: false,
  isLoadingTrialStatus: false,
  isLoadingPlans: false,
  error: null,

  // Actions
  fetchSubscriptionStatus: async (token?: string | null) => {
    console.log('SubscriptionStore: fetchSubscriptionStatus called with token:', token ? 'present' : 'missing');
    
    // Prevent multiple concurrent requests
    const currentState = get();
    if (currentState.isLoadingTrialStatus) {
      console.log('SubscriptionStore: Subscription status fetch already in progress, skipping');
      return;
    }
    
    set({ isLoadingTrialStatus: true, isLoading: true, error: null });
    try {
      const subscriptionStatus = await subscriptionService.getSubscriptionStatus(token);
      set({ subscriptionStatus, isLoadingTrialStatus: false, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subscription status';
      
      // On auth errors, don't set error state to prevent retry loops
      if (errorMessage.includes('401')) {
        console.log('SubscriptionStore: Auth error, not setting error state to prevent loops');
        set({ isLoadingTrialStatus: false, isLoading: false });
      } else {
        set({ 
          error: errorMessage,
          isLoadingTrialStatus: false,
          isLoading: false 
        });
      }
    }
  },

  fetchSubscriptionPlans: async () => {
    // Prevent multiple concurrent requests
    const currentState = get();
    if (currentState.isLoadingPlans) {
      console.log('SubscriptionStore: Plans fetch already in progress, skipping');
      return;
    }
    
    set({ isLoadingPlans: true, error: null });
    try {
      const subscriptionPlans = await subscriptionService.getSubscriptionPlans();
      set({ subscriptionPlans, isLoadingPlans: false });
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch subscription plans',
        isLoadingPlans: false 
      });
    }
  },

  startTrial: async (token?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const result = await subscriptionService.startTrial(token);
      if (result.success) {
        // Refresh subscription status after starting trial
        await get().fetchSubscriptionStatus(token);
        set({ isLoading: false });
        return true;
      } else {
        set({ 
          error: result.message,
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      console.error('Failed to start trial:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to start trial',
        isLoading: false 
      });
      return false;
    }
  },

  createUpgradeCheckout: async (planPriceId: string, token?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const successUrl = `${window.location.origin}/subscription/success`;
      const cancelUrl = `${window.location.origin}/subscription/cancel`;
      
      const checkoutSession = await subscriptionService.createUpgradeCheckoutSession(
        planPriceId,
        successUrl,
        cancelUrl,
        token
      );
      
      set({ isLoading: false });
      return checkoutSession.checkout_url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
        isLoading: false 
      });
      return null;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      subscriptionStatus: null,
      subscriptionPlans: [],
      isLoading: false,
      error: null,
    });
  },
}));

// Computed values helper hooks
export const useTrialActive = () => {
  const subscriptionStatus = useSubscriptionStore(state => state.subscriptionStatus);
  return subscriptionStatus?.is_trial_active ?? false;
};

export const useHasSubscription = () => {
  const subscriptionStatus = useSubscriptionStore(state => state.subscriptionStatus);
  return subscriptionStatus?.has_subscription ?? false;
};

export const useCanAccessConversation = () => {
  const subscriptionStatus = useSubscriptionStore(state => state.subscriptionStatus);
  return subscriptionStatus?.can_access_conversation ?? false;
};

export const useSubscriptionLoading = () => {
  return useSubscriptionStore(state => state.isLoading);
};