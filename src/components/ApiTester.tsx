'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { apiClient } from '@/lib/api-client';

export function ApiTester() {
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (result: any) => {
    setResults(prev => [result, ...prev]);
  };

  const testStartSession = async () => {
    setIsLoading(true);
    try {
      console.log('🧪 Testing /start endpoint...');
      const result = await apiClient.startSession({
        session_type: 'practice',
        personality: 'friendly',
        topic: 'daily life'
      });
      addResult({ type: 'start', success: true, data: result });
      console.log('✅ /start test successful:', result);
    } catch (error: any) {
      console.error('❌ /start test failed:', error.message);
      addResult({ type: 'start', success: false, error: error.message });
    }
    setIsLoading(false);
  };

  const testConversation = async () => {
    setIsLoading(true);
    try {
      console.log('🧪 Testing /conversation endpoint...');
      const result = await apiClient.sendMessage({
        message: 'Hello, how are you today?',
        personality: 'friendly',
        session_type: 'practice'
      });
      addResult({ type: 'conversation', success: true, data: result });
      console.log('✅ /conversation test successful:', result);
    } catch (error: any) {
      console.error('❌ /conversation test failed:', error.message);
      addResult({ type: 'conversation', success: false, error: error.message });
    }
    setIsLoading(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">API Tester</h3>
      
      <div className="flex gap-2 mb-4">
        <Button 
          onClick={testStartSession}
          disabled={isLoading}
          size="sm"
        >
          Test /start
        </Button>
        <Button 
          onClick={testConversation}
          disabled={isLoading}
          size="sm"
        >
          Test /conversation
        </Button>
        <Button 
          onClick={clearResults}
          variant="outline"
          size="sm"
        >
          Clear
        </Button>
      </div>

      {isLoading && (
        <div className="text-sm text-blue-600 mb-2">Testing API...</div>
      )}

      <div className="space-y-2">
        {results.map((result, index) => (
          <div 
            key={index} 
            className={`p-3 rounded text-sm ${
              result.success 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}
          >
            <div className="font-semibold">
              {result.type.toUpperCase()} - {result.success ? 'SUCCESS' : 'ERROR'}
            </div>
            <pre className="mt-1 text-xs overflow-x-auto">
              {JSON.stringify(result.success ? result.data : result.error, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}