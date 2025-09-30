/**
 * React hook for streaming conversations with integrated speech and state management.
 * Story 3.3: Speech Optimization & Clara's Response Performance
 */

import { useCallback, useRef, useState } from 'react';
import { useConversationStore } from '@/store/conversationStore';
import { BrowserSpeechService } from '@/lib/speech';
import { StreamingConversationClient, ConversationRequest, CompleteResponse } from '@/services/streamingConversationService';

export interface UseStreamingConversationOptions {
  enableProgressiveSpeech?: boolean; // Whether to speak chunks as they arrive
  speechOptions?: {
    rate?: number;
    pitch?: number;
    volume?: number;
  };
}

export interface StreamingConversationState {
  isStreaming: boolean;
  currentChunk: string;
  accumulatedResponse: string;
  chunksReceived: number;
  streamingStartTime: number | null;
  firstChunkTime: number | null;
}

export function useStreamingConversation(options: UseStreamingConversationOptions = {}) {
  const {
    enableProgressiveSpeech = true,
    speechOptions = {}
  } = options;

  // Zustand store hooks
  const {
    setProcessing,
    setAISpeaking,
    addMessage,
    setSuggestion,
    updateSimulationContext,
    session
  } = useConversationStore();

  // Local streaming state
  const [streamingState, setStreamingState] = useState<StreamingConversationState>({
    isStreaming: false,
    currentChunk: '',
    accumulatedResponse: '',
    chunksReceived: 0,
    streamingStartTime: null,
    firstChunkTime: null
  });

  // Services
  const streamingClient = useRef(new StreamingConversationClient());
  const speechService = useRef(new BrowserSpeechService());
  const pendingSpeechChunks = useRef<string[]>([]);
  const speechQueue = useRef<Promise<void>>(Promise.resolve());

  /**
   * Send a message using streaming conversation with progressive speech output.
   */
  const sendStreamingMessage = useCallback(async (
    message: string,
    authToken: string,
    requestOptions: Partial<ConversationRequest> = {}
  ) => {
    try {
      // Reset streaming state
      setStreamingState({
        isStreaming: true,
        currentChunk: '',
        accumulatedResponse: '',
        chunksReceived: 0,
        streamingStartTime: Date.now(),
        firstChunkTime: null
      });

      // Update conversation store state
      setProcessing(true);
      pendingSpeechChunks.current = [];

      // Prepare request
      const request: ConversationRequest = {
        message,
        personality: session.selectedPersonality,
        session_type: 'daily',
        ...requestOptions
      };

      // Only add session_id if it exists
      if (session.backendSessionId) {
        request.session_id = session.backendSessionId;
      }

      // Start streaming conversation
      await streamingClient.current.startConversation(request, authToken, {
        onChunk: (chunk: string, totalResponse: string) => {
          const now = Date.now();

          setStreamingState(prev => ({
            ...prev,
            currentChunk: chunk,
            accumulatedResponse: totalResponse,
            chunksReceived: prev.chunksReceived + 1,
            firstChunkTime: prev.firstChunkTime || now
          }));

          // Add chunk to speech queue if progressive speech is enabled
          if (enableProgressiveSpeech) {
            queueChunkForSpeech(chunk);
          }
        },

        onComplete: async (response: CompleteResponse) => {
          await handleStreamingComplete(response, message);
        },

        onError: (error: string) => {
          console.error('Streaming conversation error:', error);
          setProcessing(false);
          setStreamingState(prev => ({ ...prev, isStreaming: false }));
        }
      });

    } catch (error) {
      console.error('Failed to start streaming conversation:', error);
      setProcessing(false);
      setStreamingState(prev => ({ ...prev, isStreaming: false }));
      throw error;
    }
  }, [session, enableProgressiveSpeech, setProcessing]);

  /**
   * Queue a chunk for progressive speech synthesis.
   */
  const queueChunkForSpeech = useCallback((chunk: string) => {
    if (!enableProgressiveSpeech) return;

    // Add chunk to pending queue
    pendingSpeechChunks.current.push(chunk);

    // Process speech queue
    speechQueue.current = speechQueue.current.then(async () => {
      try {
        // Only speak if we have chunks and no speech is currently active
        if (pendingSpeechChunks.current.length > 0 && !speechService.current.isSpeaking()) {
          const textToSpeak = pendingSpeechChunks.current.join(' ');
          pendingSpeechChunks.current = [];

          setAISpeaking(true);

          await speechService.current.speak(textToSpeak, {
            rate: speechOptions.rate || 1.0,
            pitch: speechOptions.pitch || 1.0,
            volume: speechOptions.volume || 1.0,
            moodBasedTiming: {
              mood: 'neutral', // TODO: Get current mood from emotional state
              baseRate: 1.0,
              pauseMultiplier: 1.0
            }
          });

          setAISpeaking(false);
        }
      } catch (error) {
        console.error('Progressive speech error:', error);
        setAISpeaking(false);
      }
    });
  }, [enableProgressiveSpeech, speechOptions, setAISpeaking]);

  /**
   * Handle completion of streaming conversation.
   */
  const handleStreamingComplete = useCallback(async (
    response: CompleteResponse,
    userMessage: string
  ) => {
    try {
      // Create user message
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date()
      };

      // Create assistant message with streaming metadata
      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: response.response,
        timestamp: new Date(),
        feedback: response.feedback,
        simulation_context: response.simulation_context,
        selected_backstory_types: response.selected_backstory_types,
        performance_metrics: {
          total_response_time_ms: response.performance_metrics.total_time_ms,
          context_gathering_ms: response.performance_metrics.context_time_ms,
          response_generation_ms: response.performance_metrics.consciousness_time_ms
        },
        enhanced_mode: true
      };

      // Add messages to store
      addMessage(userMsg);
      addMessage(assistantMsg);

      // Update suggestion if available
      if (response.suggestion) {
        setSuggestion({
          id: response.suggestion.id,
          word: response.suggestion.word,
          definition: response.suggestion.definition,
          exampleSentence: response.suggestion.exampleSentence,
          remediationFeedback: response.remediation_feedback || ''
        });
      }

      // Update simulation context for debugging
      updateSimulationContext(
        response.simulation_context,
        {
          total_response_time_ms: response.performance_metrics.total_time_ms,
          context_gathering_ms: response.performance_metrics.context_time_ms,
          response_generation_ms: response.performance_metrics.consciousness_time_ms
        }
      );

      // If progressive speech is disabled, speak the complete response now
      if (!enableProgressiveSpeech) {
        setAISpeaking(true);

        await speechService.current.speak(response.response, {
          rate: speechOptions.rate || 1.0,
          pitch: speechOptions.pitch || 1.0,
          volume: speechOptions.volume || 1.0,
          moodBasedTiming: {
            mood: 'neutral', // TODO: Get current mood from emotional state
            baseRate: 1.0,
            pauseMultiplier: 1.0
          }
        });

        setAISpeaking(false);
      } else {
        // Wait for any remaining speech chunks to complete
        await speechQueue.current;
      }

      // Log performance metrics
      console.log('🎯 Streaming Performance:', {
        totalTime: response.performance_metrics.total_time_ms,
        firstChunkLatency: streamingState.firstChunkTime ?
          streamingState.firstChunkTime - (streamingState.streamingStartTime || 0) : 0,
        chunksDelivered: response.performance_metrics.chunks_delivered,
        avgChunkTime: response.performance_metrics.total_time_ms / response.performance_metrics.chunks_delivered
      });

    } catch (error) {
      console.error('Error handling streaming completion:', error);
    } finally {
      setProcessing(false);
      setStreamingState(prev => ({ ...prev, isStreaming: false }));
    }
  }, [
    addMessage,
    setSuggestion,
    updateSimulationContext,
    enableProgressiveSpeech,
    speechOptions,
    setAISpeaking,
    setProcessing,
    streamingState.firstChunkTime,
    streamingState.streamingStartTime
  ]);

  /**
   * Cancel the current streaming conversation.
   */
  const cancelStreaming = useCallback(() => {
    streamingClient.current.cancel();
    speechService.current.stopSpeaking();
    setProcessing(false);
    setAISpeaking(false);
    setStreamingState(prev => ({ ...prev, isStreaming: false }));
  }, [setProcessing, setAISpeaking]);

  /**
   * Toggle progressive speech on/off during conversation.
   */
  const toggleProgressiveSpeech = useCallback(() => {
    // Stop current speech if disabling
    if (enableProgressiveSpeech) {
      speechService.current.stopSpeaking();
      setAISpeaking(false);
    }
  }, [enableProgressiveSpeech, setAISpeaking]);

  /**
   * Get streaming performance metrics.
   */
  const getStreamingMetrics = useCallback(() => {
    const { streamingStartTime, firstChunkTime, chunksReceived } = streamingState;

    if (!streamingStartTime) return null;

    const now = Date.now();
    const totalStreamingTime = now - streamingStartTime;
    const firstChunkLatency = firstChunkTime ? firstChunkTime - streamingStartTime : null;

    return {
      totalStreamingTime,
      firstChunkLatency,
      chunksReceived,
      avgTimePerChunk: chunksReceived > 0 ? totalStreamingTime / chunksReceived : 0,
      isStreaming: streamingState.isStreaming
    };
  }, [streamingState]);

  return {
    // Actions
    sendStreamingMessage,
    cancelStreaming,
    toggleProgressiveSpeech,

    // State
    streamingState,
    isStreaming: streamingState.isStreaming,

    // Metrics
    getStreamingMetrics,

    // Speech control
    speechService: speechService.current
  };
}