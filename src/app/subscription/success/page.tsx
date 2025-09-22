'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/shared/AuthProvider';
import { useSubscriptionStore } from '@/store/subscription-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader } from 'lucide-react';
import Link from 'next/link';

export default function SubscriptionSuccessPage() {
  const { token } = useAuth();
  const { fetchSubscriptionStatus } = useSubscriptionStore();
  const [isRefreshing, setIsRefreshing] = useState(true);

  useEffect(() => {
    // Refresh subscription status after successful payment
    const refreshStatus = async () => {
      if (token) {
        await fetchSubscriptionStatus(token);
      }
      setIsRefreshing(false);
    };

    // Add a small delay to ensure Stripe webhook has processed
    const timer = setTimeout(refreshStatus, 2000);
    
    return () => clearTimeout(timer);
  }, [fetchSubscriptionStatus, token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            {isRefreshing ? (
              <Loader className="w-8 h-8 text-green-600 animate-spin" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-600" />
            )}
          </div>
          
          <CardTitle className="text-2xl font-bold text-gray-900">
            {isRefreshing ? 'Processing...' : 'Welcome to ImprovToday!'}
          </CardTitle>
          
          <CardDescription>
            {isRefreshing 
              ? 'We are setting up your subscription...'
              : 'Your subscription has been activated successfully.'
            }
          </CardDescription>
        </CardHeader>

        {!isRefreshing && (
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">What&apos;s next?</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Start practicing conversations with Ava</li>
                <li>• Get personalized feedback on your English</li>
                <li>• Track your progress over time</li>
                <li>• Access all premium features</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Link href="/practice">
                <Button className="w-full" size="lg">
                  Start Your First Conversation
                </Button>
              </Link>
              
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                Questions? Contact us at support@improvtoday.com
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}