'use client';

import { useState } from 'react';
import { useSubscriptionStore, useTrialActive, useHasSubscription, useCanAccessConversation } from '@/store/subscription-store';
import { useAuth } from '@/components/shared/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, AlertCircle, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

export function SubscriptionStatus() {
  const { token } = useAuth();
  const {
    subscriptionStatus,
    subscriptionPlans,
    isLoading,
    error,
    createUpgradeCheckout
  } = useSubscriptionStore();
  
  const isTrialActive = useTrialActive();
  const hasSubscription = useHasSubscription();
  const canAccessConversation = useCanAccessConversation();
  
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);

  // Subscription plans are now fetched by SubscriptionGuard

  const handleUpgrade = async (planPriceId: string) => {
    setIsUpgrading(planPriceId);
    try {
      const checkoutUrl = await createUpgradeCheckout(planPriceId, token);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      console.error('Failed to create checkout:', err);
    } finally {
      setIsUpgrading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
        <div className="h-24 bg-gray-100 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionStatus) {
    return null;
  }

  const trialProgress = subscriptionStatus.days_remaining !== null
    ? Math.max(0, (subscriptionStatus.days_remaining / 14) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                {hasSubscription ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    Active Subscription
                  </>
                ) : isTrialActive ? (
                  <>
                    <Clock className="w-5 h-5 text-blue-600 mr-2" />
                    Free Trial
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    Trial Expired
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {hasSubscription
                  ? `You have an active ${subscriptionStatus.subscription_status} subscription`
                  : isTrialActive && subscriptionStatus.days_remaining !== null
                  ? `${subscriptionStatus.days_remaining} days remaining in your trial`
                  : 'Your trial has ended. Upgrade to continue using Clara.'
                }
              </CardDescription>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              canAccessConversation 
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {canAccessConversation ? 'Active' : 'Inactive'}
            </div>
          </div>
        </CardHeader>
        
        {isTrialActive && subscriptionStatus.days_remaining !== null && (
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Trial Progress</span>
                <span className="font-medium">{subscriptionStatus.days_remaining} days left</span>
              </div>
              <Progress value={trialProgress} className="w-full" />
              {subscriptionStatus.trial_end_date && (
                <p className="text-xs text-gray-500">
                  Trial ends on {format(new Date(subscriptionStatus.trial_end_date), 'MMMM do, yyyy')}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Upgrade Options */}
      {!hasSubscription && subscriptionPlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              {isTrialActive ? 'Upgrade Your Plan' : 'Choose a Plan'}
            </CardTitle>
            <CardDescription>
              {isTrialActive 
                ? 'Upgrade now to ensure uninterrupted access to Clara'
                : 'Subscribe to regain access to conversation practice'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="grid gap-4">
              {subscriptionPlans.map((plan) => (
                <div 
                  key={plan.id} 
                  className={`border rounded-lg p-4 ${
                    plan.name.toLowerCase().includes('pro') 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        {plan.name.toLowerCase().includes('pro') && (
                          <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm">{plan.description}</p>
                      <div className="text-2xl font-bold mt-1">
                        ${(plan.price_cents / 100).toFixed(2)}
                        <span className="text-sm font-normal text-gray-500">/month</span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleUpgrade(plan.stripe_price_id)}
                      disabled={isUpgrading === plan.stripe_price_id}
                      variant={plan.name.toLowerCase().includes('pro') ? 'default' : 'outline'}
                    >
                      {isUpgrading === plan.stripe_price_id ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          <span>Processing...</span>
                        </div>
                      ) : (
                        'Subscribe'
                      )}
                    </Button>
                  </div>
                  
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                    {plan.features.conversations_per_month === -1 ? (
                      <span className="flex items-center">
                        <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                        Unlimited conversations
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                        {plan.features.conversations_per_month as number} conversations/month
                      </span>
                    )}
                    
                    {plan.features.premium_features as boolean && (
                      <span className="flex items-center">
                        <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                        Premium features
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}