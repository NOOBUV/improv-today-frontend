# Zustand Store Migration Guide

This guide explains how to migrate from the chaotic useState hooks to the new Zustand store architecture to eliminate race conditions and improve state management.

## Overview

The new architecture consists of three main stores:
1. **ConversationStore** - Manages conversation state machine, messages, and session data
2. **SpeechStore** - Handles speech synthesis and recognition
3. **UIStore** - Manages UI state, notifications, and user preferences

## State Machine Implementation

The conversation store implements a proper state machine with these states:
- `IDLE` - Ready to start conversation
- `LISTENING` - Currently listening to user input
- `PROCESSING` - Processing user input
- `AI_SPEAKING` - AI is currently speaking
- `PAUSED` - Conversation is paused
- `ERROR` - Error state

State transitions are validated to prevent invalid states and race conditions.

## Migration Steps

### 1. Replace useState hooks

**Before (chaotic useState):**
```typescript
const [isListening, setIsListening] = useState(false);
const [isAISpeaking, setIsAISpeaking] = useState(false);
const [isPaused, setIsPaused] = useState(false);
const [transcript, setTranscript] = useState('');
const [interimTranscript, setInterimTranscript] = useState('');
const [selectedPersonality, setSelectedPersonality] = useState<Personality>('friendly');
const [userName, setUserName] = useState<string>('');
const [showSettings, setShowSettings] = useState(false);
// ... 20+ more useState hooks
```

**After (Zustand stores):**
```typescript
import { 
  useConversationStore,
  useConversationStatus,
  useSessionData,
  useSpeechState 
} from '@/store/conversationStore';

const conversationStore = useConversationStore();
const conversationStatus = useConversationStatus();
const sessionData = useSessionData();
const speechState = useSpeechState();
```

### 2. Replace state updates

**Before:**
```typescript
const startListening = () => {
  setIsListening(true);
  setIsPaused(false);
  setIsAISpeaking(false);
  // Multiple state updates can cause race conditions
};
```

**After:**
```typescript
const startListening = () => {
  conversationStore.startListening(); // Single atomic operation
};
```

### 3. Use state machine transitions

**Before:**
```typescript
// Manual state management - error prone
if (isAISpeaking) {
  setIsAISpeaking(false);
  setIsListening(true);
}
```

**After:**
```typescript
// State machine enforces valid transitions
if (conversationStore.canTransitionTo(ConversationState.LISTENING, 'INTERRUPT_AI')) {
  conversationStore.transitionTo(ConversationState.LISTENING, 'INTERRUPT_AI');
}
```

### 4. Replace useEffect dependencies

**Before (problematic dependencies):**
```typescript
useEffect(() => {
  // Complex dependencies can change size between renders
  if (browserSpeech && !isAISpeaking && lastMessage) {
    // Handle speech...
  }
}, [browserSpeech, isAISpeaking, lastMessage, messages.length]); // Race condition prone
```

**After (stable selectors):**
```typescript
useEffect(() => {
  const lastMessage = messages[messages.length - 1];
  if (isSpeechReady && !conversationStatus.isAISpeaking && lastMessage?.role === 'assistant') {
    // Handle speech...
  }
}, [messages, isSpeechReady, conversationStatus.isAISpeaking]); // Stable dependencies
```

## Store Usage Examples

### Conversation Management

```typescript
// Start listening
conversationStore.startListening();

// Add message
conversationStore.addMessage({
  id: `msg-${Date.now()}`,
  role: 'user',
  content: 'Hello!',
  timestamp: new Date(),
});

// Update session data
conversationStore.setUserName('John');
conversationStore.setPersonality('friendly');
```

### Speech Control

```typescript
// Initialize speech
speechStore.initializeSpeech();

// Start speech recognition
speechStore.startRecognition({
  onResult: (result) => {
    conversationStore.updateTranscript(result.transcript, !result.isFinal);
  },
  onError: (error) => {
    conversationStore.setError(error);
  },
});

// Speak text
speechStore.speak('Hello there!', {
  onEnd: () => {
    conversationStore.autoStartListening();
  },
});
```

### UI Management

```typescript
// Show notifications
uiStore.addNotification({
  type: 'success',
  title: 'Connected',
  message: 'Successfully connected to server',
  duration: 3000,
});

// Manage modals
uiStore.openModal({
  type: 'settings',
  title: 'Settings',
  content: 'Configure your preferences',
});
```

## Key Benefits

### 1. Eliminates Race Conditions
- State machine prevents invalid state combinations
- Atomic state updates
- Proper state transition validation

### 2. Better Type Safety
- Full TypeScript support
- Strongly typed state and actions
- Compile-time error checking

### 3. Improved Developer Experience
- DevTools integration for debugging
- Centralized state management
- Predictable state updates

### 4. Performance Optimization
- Selective re-renders with granular selectors
- Optimized state subscriptions
- Reduced unnecessary useEffect calls

## WebSocket Integration

The new architecture includes WebSocket integration for real-time communication:

```typescript
import { useConversationWithStores } from '@/hooks/useWebSocketIntegration';

const { sendMessage, startSession } = useConversationWithStores();

// Send message via WebSocket with fallback to HTTP
sendMessage('Hello!', undefined, 'friendly');
```

## Testing

The new stores are easier to test:

```typescript
import { useConversationStore } from '@/store/conversationStore';

// Test state transitions
const store = useConversationStore.getState();
expect(store.canTransitionTo(ConversationState.LISTENING)).toBe(true);
store.startListening();
expect(store.currentState).toBe(ConversationState.LISTENING);
```

## Debugging

Use the debug utilities:

```typescript
import { getStoreDebugInfo } from '@/store';

console.log(getStoreDebugInfo());
// Outputs current state of all stores
```

## Migration Checklist

- [ ] Install Zustand and immer dependencies
- [ ] Create store files (conversationStore, speechStore, uiStore)
- [ ] Replace useState hooks with store selectors
- [ ] Update state update logic to use store actions
- [ ] Replace useEffect dependencies with stable selectors
- [ ] Implement WebSocket integration hook
- [ ] Update components to use new stores
- [ ] Test state transitions and error handling
- [ ] Remove old useState-based code
- [ ] Update tests to use new store architecture

## Performance Notes

- Use specific selectors instead of the entire store to minimize re-renders
- Leverage Zustand's built-in optimization features
- Consider using `subscribeWithSelector` for complex state subscriptions
- Use immer middleware for complex state updates

The new architecture provides a much more robust and maintainable solution for managing application state while eliminating the race conditions caused by multiple useState hooks.