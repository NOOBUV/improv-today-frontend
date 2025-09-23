'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useAuth } from '@/components/shared/AuthProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, Zap } from 'lucide-react';

export function TrialSignup() {
  const router = useRouter();
  const { token } = useAuth();
  const {
    subscriptionPlans,
    isLoading,
    error,
    startTrial,
    clearError
  } = useSubscriptionStore();
  
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  // Subscription plans are now fetched by SubscriptionGuard

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    clearError();
    
    try {
      const success = await startTrial(token);
      if (success) {
        // Trial started successfully - navigate to home page
        // The SubscriptionGuard will now allow access to protected routes
        router.push('/');
      }
    } catch (err) {
      console.error('Failed to start trial:', err);
    } finally {
      setIsStartingTrial(false);
    }
  };

  if (isLoading && subscriptionPlans.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Start Your Free Trial
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Practice English conversation with Clara, your AI conversation partner. 
            Try it free for 14 days, then choose a plan that works for you.
          </p>
        </div>

        {/* Trial Features */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="text-center mb-6">
            <Clock className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h2 className="text-2xl font-semibold text-gray-900">14-Day Free Trial</h2>
            <p className="text-gray-600">Full access to all conversation features</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900">Unlimited Conversations</h3>
              <p className="text-sm text-gray-600">Practice as much as you want during your trial</p>
            </div>
            <div className="text-center">
              <Zap className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900">AI-Powered Feedback</h3>
              <p className="text-sm text-gray-600">Get instant feedback on your English</p>
            </div>
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900">No Credit Card Required</h3>
              <p className="text-sm text-gray-600">Start your trial immediately</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="text-center">
            <Button
              onClick={handleStartTrial}
              disabled={isStartingTrial}
              size="lg"
              className="px-8 py-3 text-lg"
            >
              {isStartingTrial ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Starting Trial...</span>
                </div>
              ) : (
                'Start Free Trial'
              )}
            </Button>
          </div>
        </div>

        {/* Subscription Plans Preview */}
        {subscriptionPlans.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Choose Your Plan After Trial</h2>
              <p className="text-gray-600">You can upgrade anytime during or after your trial</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {subscriptionPlans.map((plan) => (
                <Card key={plan.id} className="relative">
                  {plan.name.toLowerCase().includes('pro') && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Popular
                      </span>
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="text-3xl font-bold text-gray-900">
                      ${(plan.price_cents / 100).toFixed(2)}
                      <span className="text-lg font-normal text-gray-500">/month</span>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-2">
                      {plan.features.conversations_per_month === -1 ? (
                        <div className="flex items-center text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                          Unlimited conversations
                        </div>
                      ) : (
                        <div className="flex items-center text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                          {plan.features.conversations_per_month as number} conversations per month
                        </div>
                      )}
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                        {plan.features.trial_days as number} days free trial
                      </div>
                      
                      {plan.features.premium_features as boolean && (
                        <div className="flex items-center text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                          Premium features
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            No commitment required • Cancel anytime • Secure payments by Stripe
          </p>
        </div>
      </div>
    </div>
  );
}