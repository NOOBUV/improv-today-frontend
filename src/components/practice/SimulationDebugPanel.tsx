'use client';

import React from 'react';
import { useConversationStore } from '@/store/conversationStore';

export const SimulationDebugPanel: React.FC = () => {
  const {
    showSimulationDebug,
    lastSimulationContext,
    lastPerformanceMetrics,
    setShowSimulationDebug,
  } = useConversationStore();

  if (!showSimulationDebug) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowSimulationDebug(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-md shadow-lg"
          title="Show simulation context debug info"
        >
          Debug
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-green-400 p-4 rounded-lg shadow-xl max-w-sm text-xs font-mono">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-white font-semibold">Simulation Context</h3>
        <button
          onClick={() => setShowSimulationDebug(false)}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      {lastSimulationContext ? (
        <div className="space-y-2">
          <div>
            <span className="text-gray-400">Mood:</span>{' '}
            <span className="text-yellow-400">
              {lastSimulationContext.global_mood || 'N/A'}/100
            </span>
          </div>
          <div>
            <span className="text-gray-400">Stress:</span>{' '}
            <span className="text-red-400">
              {lastSimulationContext.stress_level || 'N/A'}/100
            </span>
          </div>
          <div>
            <span className="text-gray-400">Events:</span>{' '}
            <span className="text-blue-400">
              {lastSimulationContext.recent_events_count || 0}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Emotion:</span>{' '}
            <span className="text-purple-400">
              {lastSimulationContext.conversation_emotion || 'N/A'}
            </span>
          </div>
          {lastSimulationContext.selected_content_types && (
            <div>
              <span className="text-gray-400">Content:</span>{' '}
              <span className="text-cyan-400">
                {lastSimulationContext.selected_content_types.join(', ')}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-500">No simulation context available</div>
      )}

      {lastPerformanceMetrics && (
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-gray-400 mb-1">Performance:</div>
          <div className="space-y-1">
            {lastPerformanceMetrics.total_response_time_ms && (
              <div>
                <span className="text-gray-400">Total:</span>{' '}
                <span
                  className={
                    lastPerformanceMetrics.total_response_time_ms > 1000
                      ? 'text-red-400'
                      : lastPerformanceMetrics.total_response_time_ms > 500
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }
                >
                  {Math.round(lastPerformanceMetrics.total_response_time_ms)}ms
                </span>
              </div>
            )}
            {lastPerformanceMetrics.context_gathering_ms && (
              <div>
                <span className="text-gray-400">Context:</span>{' '}
                <span className="text-blue-400">
                  {Math.round(lastPerformanceMetrics.context_gathering_ms)}ms
                </span>
              </div>
            )}
            {lastPerformanceMetrics.response_generation_ms && (
              <div>
                <span className="text-gray-400">Generation:</span>{' '}
                <span className="text-cyan-400">
                  {Math.round(lastPerformanceMetrics.response_generation_ms)}ms
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};