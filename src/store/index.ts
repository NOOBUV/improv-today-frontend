'use client';

// Export all stores and their types
export * from './conversationStore';
export * from './speechStore';
export * from './uiStore';

// Export combined store hooks for convenience
import { 
  useConversationStore,
  useConversationStatus,
  type ConversationStore 
} from './conversationStore';
import { 
  useSpeechStore,
  useIsSpeechReady,
  type SpeechStore 
} from './speechStore';
import { 
  useUIStore,
  useIsLoading,
  type UIStore 
} from './uiStore';

// Combined store hook for getting all store states at once
export const useAllStores = () => ({
  conversation: useConversationStore(),
  speech: useSpeechStore(),
  ui: useUIStore(),
});

// Combined status hook for getting key status indicators - memoized to prevent infinite loops
export const useAppStatus = () => {
  const conversationStatus = useConversationStatus();
  const speechReady = useIsSpeechReady();
  const loading = useIsLoading();
  
  // Return a stable object reference
  return {
    conversation: conversationStatus,
    isSpeechReady: speechReady,
    isLoading: loading,
  };
};

// Store type exports for TypeScript
export type {
  ConversationStore,
  SpeechStore,
  UIStore,
};

// Utility functions for store management
export const resetAllStores = () => {
  useConversationStore.getState().resetConversation();
  useSpeechStore.getState().clearErrors();
  useUIStore.getState().reset();
};

export const getStoreDebugInfo = () => ({
  conversation: {
    currentState: useConversationStore.getState().currentState,
    messageCount: useConversationStore.getState().messages.length,
    sessionData: useConversationStore.getState().session,
  },
  speech: useSpeechStore.getState().getDebugInfo(),
  ui: useUIStore.getState().exportState(),
});