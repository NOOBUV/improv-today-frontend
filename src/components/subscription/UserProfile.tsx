'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/shared/AuthProvider';
import { useSubscriptionStore } from '@/store/subscription-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, LogOut, CreditCard, Settings } from 'lucide-react';

export function UserProfile() {
  const { user, logout, token } = useAuth();
  const { subscriptionStatus, fetchSubscriptionStatus } = useSubscriptionStore();

  // Fetch subscription status when token is available
  useEffect(() => {
    if (token && user) {
      console.log('UserProfile: Fetching subscription status with token:', token ? 'present' : 'missing');
      fetchSubscriptionStatus(token);
    } else {
      console.log('UserProfile: Not fetching subscription status. Token:', token ? 'present' : 'missing', 'User:', user ? 'present' : 'missing');
    }
  }, [token, user, fetchSubscriptionStatus]);

  const getUserInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.picture} alt={user.name || user.email} />
            <AvatarFallback>
              {getUserInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.picture} alt={user.name || user.email} />
                <AvatarFallback>
                  {getUserInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">
                  {user.name || 'Anonymous User'}
                </CardTitle>
                <CardDescription className="truncate">
                  {user.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Quick Subscription Status */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${
                  subscriptionStatus?.has_subscription
                    ? 'text-green-600'
                    : subscriptionStatus?.is_trial_active
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}>
                  {subscriptionStatus?.has_subscription
                    ? 'Subscribed'
                    : subscriptionStatus?.is_trial_active
                    ? `Trial (${subscriptionStatus.days_remaining} days)`
                    : 'Expired'
                  }
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" size="sm">
                <User className="w-4 h-4 mr-2" />
                Account Settings
              </Button>
              
              <Button variant="ghost" className="w-full justify-start" size="sm">
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Subscription
              </Button>
              
              <Button variant="ghost" className="w-full justify-start" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Preferences
              </Button>
            </div>

            <div className="pt-2 border-t">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" 
                size="sm"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}