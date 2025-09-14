'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, ArrowLeft, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export default function SubscriptionCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <CardTitle className="text-2xl font-bold text-gray-900">
            Subscription Cancelled
          </CardTitle>
          
          <CardDescription>
            Your payment was cancelled and no charges were made.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Still want to try ImprovToday?</h3>
            <p className="text-sm text-blue-800 mb-3">
              Start your free 14-day trial with no payment required. You can always upgrade later.
            </p>
            <Link href="/subscription">
              <Button variant="outline" size="sm" className="w-full">
                Start Free Trial
              </Button>
            </Link>
          </div>

          <div className="space-y-2">
            <Link href="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>
            </Link>
          </div>

          <div className="text-center pt-4 border-t">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 mr-2" />
              Need Help?
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              Have questions about our plans or features?
            </p>
            <div className="space-y-2 text-xs text-gray-500">
              <p>Email: support@improvtoday.com</p>
              <p>We typically respond within 24 hours</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}