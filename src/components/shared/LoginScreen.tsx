'use client';

import { useState } from 'react';
import { Button } from '../ui/button';

export function LoginScreen() {
  const [isLogging, setIsLogging] = useState(false);

  const handleAuth0Login = () => {
    setIsLogging(true);
    window.location.href = '/auth/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ImprovToday</h1>
          <p className="text-gray-600">Practice English conversation with AI</p>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Please log in to access the conversation practice
            </p>
          </div>

          <Button 
            onClick={handleAuth0Login}
            disabled={isLogging}
            className="w-full"
            size="lg"
          >
            {isLogging ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Redirecting to Auth0...</span>
              </div>
            ) : (
              'Login with Auth0'
            )}
          </Button>

          <div className="text-center">
            <p className="text-xs text-gray-400 mt-4">
              Secure authentication powered by Auth0.<br/>
              You&apos;ll be redirected to complete the login.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}