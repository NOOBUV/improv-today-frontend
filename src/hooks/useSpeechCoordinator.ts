'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { 
  SpeechCoordinator, 
  getSpeechCoordinator,
  type SpeechCoordinatorState,
  type SpeechPriority,
  type SpeechSynthesisRequest,
  type SpeechRecognitionRequest 
} from '@/services/speechCoordinator';
import { useSpeechStore } from '@/store/speechStore';
import { useConversationStore, ConversationState } from '@/store/conversationStore';

// ===== TYPES =====

export interface UseSpeechCoordinatorOptions {
  autoInitialize?: boolean;
  errorRetryAttempts?: number;
  debugMode?: boolean;
}

export interface SpeechCoordinatorActions {
  // Synthesis methods
  speak: (
    text: string,
    options?: SpeechSynthesisRequest['options'],
    callbacks?: Pick<SpeechSynthesisRequest, 'onStart' | 'onEnd' | 'onError'>,
    priority?: SpeechPriority
  ) => Promise<string>;
  
  // Recognition methods
  startListening: (
    callbacks?: SpeechRecognitionRequest,
    priority?: SpeechPriority
  ) => Promise<string>;
  
  // Control methods
  stopSpeaking: () => void;
  stopListening: () => void;
  stopAll: () => void;
  
  // Queue management
  clearQueue: () => void;
  cancelRequest: (requestId: string) => boolean;
  
  // Utility
  forceReset: () => void;
  isAvailable: () => boolean;
  getDebugInfo: () => object;
}

export interface UseSpeechCoordinatorReturn extends SpeechCoordinatorActions {
  state: SpeechCoordinatorState;
  isReady: boolean;
  hasError: boolean;
  lastError: string | null;
  queueLength: number;
  isOperating: boolean;
}

// ===== HOOK IMPLEMENTATION =====

export const useSpeechCoordinator = (
  options: UseSpeechCoordinatorOptions = {}
): UseSpeechCoordinatorReturn => {
  const {
    autoInitialize = true,
    errorRetryAttempts = 3,
    debugMode = false,
  } = options;

  // State
  const [coordinator] = useState<SpeechCoordinator>(() => getSpeechCoordinator());
  const [coordinatorState, setCoordinatorState] = useState<SpeechCoordinatorState>(
    coordinator.getState()
  );
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Refs for callbacks
  const retryCountRef = useRef(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Store integration
  const speechStore = useSpeechStore();
  const conversationStore = useConversationStore();

  // ===== INITIALIZATION =====

  const initializeCoordinator = useCallback(async () => {
    try {
      if (debugMode) {
        console.log('Initializing speech coordinator...');
      }

      // Check if speech is available
      if (!coordinator.isAvailable()) {
        throw new Error('Speech services not available in this browser');
      }

      // Initialize speech store if not already done
      if (!speechStore.browserSpeech) {
        await speechStore.initializeSpeech();
      }

      setIsReady(true);
      setInitError(null);
      retryCountRef.current = 0;

      if (debugMode) {
        console.log('Speech coordinator initialized successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize speech coordinator';
      setInitError(errorMessage);
      setIsReady(false);

      if (retryCountRef.current < errorRetryAttempts) {
        retryCountRef.current++;
        if (debugMode) {
          console.log(`Retrying initialization (${retryCountRef.current}/${errorRetryAttempts})...`);
        }
        setTimeout(initializeCoordinator, 2000 * retryCountRef.current);
      } else {
        console.error('Failed to initialize speech coordinator after multiple attempts:', errorMessage);
      }
    }
  }, [coordinator, speechStore, errorRetryAttempts, debugMode]);

  // ===== STATE MONITORING =====

  useEffect(() => {
    // Subscribe to coordinator state changes
    const unsubscribe = coordinator.onStateChange((newState) => {
      setCoordinatorState(newState);
      
      // Sync with speech store
      speechStore.synthesis.isSpeaking = newState.currentOperation === 'synthesis';
      speechStore.recognition.isListening = newState.currentOperation === 'recognition';
      
      if (debugMode) {
        console.log('Speech coordinator state changed:', newState);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [coordinator, speechStore, debugMode]);

  // ===== INITIALIZATION EFFECT =====

  useEffect(() => {
    if (autoInitialize) {
      initializeCoordinator();
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [autoInitialize, initializeCoordinator]);

  // ===== SYNTHESIS ACTIONS =====

  const speak = useCallback(async (
    text: string,
    options: SpeechSynthesisRequest['options'] = {},
    callbacks: Pick<SpeechSynthesisRequest, 'onStart' | 'onEnd' | 'onError'> = {},
    priority: SpeechPriority = 'normal'
  ): Promise<string> => {
    if (!isReady) {
      throw new Error('Speech coordinator not ready');
    }

    if (debugMode) {
      console.log('Speaking with mutex:', { text: text.substring(0, 50), priority });
    }

    // Merge with current speech store settings
    const mergedOptions = {
      voice: speechStore.synthesis.currentVoice || undefined,
      rate: speechStore.settings.voiceRate,
      pitch: speechStore.settings.voicePitch,
      volume: speechStore.settings.voiceVolume,
      ...options,
    };

    // Enhanced callbacks with store integration
    const enhancedCallbacks = {
      onStart: () => {
        // Update conversation store state
        if (conversationStore.canTransitionTo(ConversationState.AI_SPEAKING, 'START_AI_SPEAKING')) {
          conversationStore.transitionTo(ConversationState.AI_SPEAKING, 'START_AI_SPEAKING');
        }
        callbacks.onStart?.();
      },
      onEnd: () => {
        // Update conversation store state
        if (conversationStore.canTransitionTo(ConversationState.IDLE, 'AI_FINISHED_STOP')) {
          conversationStore.transitionTo(ConversationState.IDLE, 'AI_FINISHED_STOP');
        }
        callbacks.onEnd?.();
      },
      onError: (error: string) => {
        // Update conversation store with error
        conversationStore.setError(`Speech synthesis error: ${error}`);
        callbacks.onError?.(error);
      },
    };

    return coordinator.speakWithMutex(text, mergedOptions, enhancedCallbacks, priority);
  }, [isReady, coordinator, speechStore, conversationStore, debugMode]);

  // ===== RECOGNITION ACTIONS =====

  const startListening = useCallback(async (
    callbacks: SpeechRecognitionRequest = {},
    priority: SpeechPriority = 'normal'
  ): Promise<string> => {
    if (!isReady) {
      throw new Error('Speech coordinator not ready');
    }

    if (debugMode) {
      console.log('Starting listening with mutex:', { priority });
    }

    // Enhanced callbacks with store integration
    const enhancedCallbacks = {
      onStart: () => {
        // Update conversation store state
        if (conversationStore.canTransitionTo(ConversationState.LISTENING, 'START_LISTENING')) {
          conversationStore.transitionTo(ConversationState.LISTENING, 'START_LISTENING');
        }
        callbacks.onStart?.();
      },
      onResult: (result: { transcript: string; isFinal: boolean; confidence?: number }) => {
        // Update conversation store with transcript
        if (result.isFinal) {
          conversationStore.updateTranscript(result.transcript, false);
        } else {
          conversationStore.updateTranscript(result.transcript, true);
        }
        callbacks.onResult?.(result);
      },
      onEnd: () => {
        // Update conversation store state
        if (conversationStore.canTransitionTo(ConversationState.IDLE, 'STOP_LISTENING')) {
          conversationStore.transitionTo(ConversationState.IDLE, 'STOP_LISTENING');
        }
        callbacks.onEnd?.();
      },
      onError: (error: string) => {
        // Update conversation store with error
        conversationStore.setError(`Speech recognition error: ${error}`);
        callbacks.onError?.(error);
      },
    };

    return coordinator.listenWithMutex(enhancedCallbacks, priority);
  }, [isReady, coordinator, conversationStore, debugMode]);

  // ===== CONTROL ACTIONS =====

  const stopSpeaking = useCallback(() => {
    coordinator.stopSpeaking();
    
    // Update conversation store
    if (conversationStore.currentState === ConversationState.AI_SPEAKING) {
      conversationStore.stopAISpeaking();
    }
  }, [coordinator, conversationStore]);

  const stopListening = useCallback(() => {
    coordinator.stopListening();
    
    // Update conversation store
    if (conversationStore.currentState === ConversationState.LISTENING) {
      conversationStore.stopListening();
    }
  }, [coordinator, conversationStore]);

  const stopAll = useCallback(() => {
    coordinator.stopCurrentOperation();
    
    // Reset conversation store to idle
    conversationStore.resetConversation();
  }, [coordinator, conversationStore]);

  // ===== QUEUE MANAGEMENT =====

  const clearQueue = useCallback(() => {
    coordinator.clearQueue();
  }, [coordinator]);

  const cancelRequest = useCallback((requestId: string): boolean => {
    return coordinator.cancelRequest(requestId);
  }, [coordinator]);

  // ===== UTILITY ACTIONS =====

  const forceReset = useCallback(() => {
    coordinator.forceReset();
    conversationStore.resetConversation();
    
    if (debugMode) {
      console.log('Speech coordinator force reset');
    }
  }, [coordinator, conversationStore, debugMode]);

  const isAvailable = useCallback(() => {
    return coordinator.isAvailable();
  }, [coordinator]);

  const getDebugInfo = useCallback(() => {
    return {
      coordinator: coordinator.getDebugInfo(),
      hook: {
        isReady,
        initError,
        retryCount: retryCountRef.current,
      },
      stores: {
        speech: speechStore.getDebugInfo(),
        conversation: {
          currentState: conversationStore.currentState,
          isListening: conversationStore.speech.isListening,
          isAISpeaking: conversationStore.speech.isAISpeaking,
        },
      },
    };
  }, [coordinator, isReady, initError, speechStore, conversationStore]);

  // ===== COMPUTED VALUES =====

  const hasError = Boolean(initError || coordinatorState.lastError);
  const lastError = initError || coordinatorState.lastError;
  const queueLength = coordinatorState.queue.length;
  const isOperating = coordinatorState.currentOperation !== 'idle';

  // ===== RETURN INTERFACE =====

  return {
    // State
    state: coordinatorState,
    isReady,
    hasError,
    lastError,
    queueLength,
    isOperating,
    
    // Actions
    speak,
    startListening,
    stopSpeaking,
    stopListening,
    stopAll,
    clearQueue,
    cancelRequest,
    forceReset,
    isAvailable,
    getDebugInfo,
  };
};

// ===== CONVENIENCE HOOKS =====

/**
 * Hook for simple speech synthesis with mutex protection
 */
export const useMutexSpeech = () => {
  const { speak, stopSpeaking, isReady, state } = useSpeechCoordinator();
  
  return {
    speak,
    stopSpeaking,
    isReady,
    isSpeaking: state.currentOperation === 'synthesis',
  };
};

/**
 * Hook for simple speech recognition with mutex protection
 */
export const useMutexRecognition = () => {
  const { startListening, stopListening, isReady, state } = useSpeechCoordinator();
  
  return {
    startListening,
    stopListening,
    isReady,
    isListening: state.currentOperation === 'recognition',
  };
};

/**
 * Hook for coordinated conversation (speech + recognition)
 */
export const useCoordinatedConversation = () => {
  const coordinator = useSpeechCoordinator();
  
  const speakThenListen = useCallback(async (
    text: string,
    speechOptions?: SpeechSynthesisRequest['options'],
    recognitionCallbacks?: SpeechRecognitionRequest
  ): Promise<void> => {
    // Speak first with high priority
    await coordinator.speak(text, speechOptions, {
      onEnd: () => {
        // Auto-start listening after speech ends
        setTimeout(() => {
          coordinator.startListening(recognitionCallbacks, 'high');
        }, 500);
      },
    }, 'high');
  }, [coordinator]);
  
  return {
    ...coordinator,
    speakThenListen,
  };
};