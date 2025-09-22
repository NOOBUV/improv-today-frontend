/**
 * Subscription Service - API client for subscription and trial management
 * Handles all subscription-related API calls with proper error handling
 */

export interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  interval: string;
  stripe_price_id: string;
  features: Record<string, unknown>;
  is_active: boolean;
}

export interface UserSubscriptionStatus {
  user_type: 'new_user' | 'trial_user' | 'subscriber' | 'previous_subscriber';
  is_trial_active: boolean;
  trial_end_date: string | null;
  days_remaining: number | null;
  has_subscription: boolean;
  subscription_status: string | null;
  can_access_conversation: boolean;
}

export interface CheckoutSession {
  checkout_url: string;
  session_id: string;
}

class SubscriptionService {
  private baseUrl = '/api/backend';

  async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true,
    token?: string | null
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add auth token if required and available
    if (requireAuth && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'omit', // Use Bearer tokens instead of cookies
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get all available subscription plans
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.makeRequest<SubscriptionPlan[]>('/subscriptions/plans', {}, false);
  }

  /**
   * Get current user's subscription status
   */
  async getSubscriptionStatus(token?: string | null): Promise<UserSubscriptionStatus> {
    return this.makeRequest<UserSubscriptionStatus>('/subscriptions/subscription-status', {}, true, token);
  }

  /**
   * Create checkout session for upgrading from trial to paid subscription
   */
  async createUpgradeCheckoutSession(
    planPriceId: string,
    successUrl: string,
    cancelUrl: string,
    token?: string | null
  ): Promise<CheckoutSession> {
    const params = new URLSearchParams({
      plan_price_id: planPriceId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    
    return this.makeRequest<CheckoutSession>(`/subscriptions/upgrade-checkout?${params}`, {
      method: 'POST',
    }, true, token);
  }

  /**
   * Start trial for the current user
   */
  async startTrial(token?: string | null): Promise<{ success: boolean; message: string }> {
    return this.makeRequest<{ success: boolean; message: string }>('/subscriptions/start-trial', {
      method: 'POST',
    }, true, token);
  }

  /**
   * Create test subscription plans (development only)
   */
  async createTestPlans(): Promise<{ success: boolean; message: string }> {
    return this.makeRequest<{ success: boolean; message: string }>('/subscriptions/admin/create-test-plans', {
      method: 'POST',
    }, false);
  }
}

export const subscriptionService = new SubscriptionService();