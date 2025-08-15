'use client';

// Export all stores and their types
export * from './conversationStore';
export * from './uiStore';

// Re-export commonly used stores for convenience
export {
  useConversationStore,
  useConversationState,
  useTranscriptState,
  useSessionState,
  useMessages,
  useCanStartConversation,
  type ConversationStore,
  type ConversationMessage,
  type ConversationFeedback,
  type Personality,
} from './conversationStore';

export {
  useUIStore,
  type UINotification,
  type NotificationType,
} from './uiStore';