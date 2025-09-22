'use client';

import { ApiTester } from '@/components/ApiTester';
import { Auth } from '@/components/shared/Auth';

export default function TestAuthPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Bearer Token Authentication Test
          </h1>
          <Auth />
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <p className="text-green-600 font-medium">
            ✅ You are logged in! The Bearer token authentication is working.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            This page is only accessible after logging in. API calls will now use Bearer tokens instead of cookies.
          </p>
        </div>

        <ApiTester />
        
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How it works:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Login screen blocks access until authenticated</li>
            <li>• Bearer tokens stored in localStorage (demo mode)</li>
            <li>• API calls include Authorization: Bearer &lt;token&gt; header</li>
            <li>• No cookies sent with requests (credentials: &apos;omit&apos;)</li>
            <li>• Backend validates Bearer tokens instead of sessions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}