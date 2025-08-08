'use client';

// Export all stores and their types
export * from './conversationStore';

// Export combined store hooks for convenience
import { 
  useConversationStore,
  useConversationStatus,
  type ConversationStore 
} from './conversationStore';

// Combined store hook for getting all store states at once
export const useAllStores = () => ({
  conversation: useConversationStore(),
});

// Combined status hook for getting key status indicators - memoized to prevent infinite loops
export const useAppStatus = () => {
  const conversationStatus = useConversationStatus();
  return {
    conversation: conversationStatus,
  };
};

// Store type exports for TypeScript
export type { ConversationStore };

// Utility functions for store management
export const resetAllStores = () => {
  useConversationStore.getState().resetConversation();
};

export const getStoreDebugInfo = () => ({
  conversation: {
    currentState: useConversationStore.getState().currentState,
    messageCount: useConversationStore.getState().messages.length,
    sessionData: useConversationStore.getState().session,
  },
});