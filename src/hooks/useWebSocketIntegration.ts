'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useConversationStore, ConversationState } from '@/store/conversationStore';
import { useSpeechStore } from '@/store/speechStore';
import { useUIStore } from '@/store/uiStore';
import { useSpeechCoordinator } from '@/hooks/useSpeechCoordinator';

// ===== TYPES =====

interface WebSocketMessage {
  type: 'conversation_response' | 'conversation_started' | 'error' | 'session_ended' | 'feedback_update' | 'pong';
  data?: unknown;
  timestamp: string;
  conversationId?: string;
}

interface WebSocketConfig {
  url?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  autoReconnect?: boolean;
}

// ===== HOOK =====

export const useWebSocketIntegration = (config: WebSocketConfig = {}) => {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/ws',
    reconnectAttempts = 5,
    reconnectDelay = 3000,
    heartbeatInterval = 30000,
    autoReconnect = true,
  } = config;

  // Store references
  const conversationStore = useConversationStore();
  const speechStore = useSpeechStore();
  const uiStore = useUIStore();
  
  // Speech coordinator for mutex protection
  const speechCoordinator = useSpeechCoordinator({ autoInitialize: true });

  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);

  // Connection state
  const isConnectedRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Message handlers
  const handleConversationResponse = useCallback((data: { response: string; feedback?: any; conversationId?: string }) => {
    const { response, feedback, conversationId } = data;
    
    // Add AI message to store
    conversationStore.addMessage({
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      feedback: feedback as any,
    });

    // Update conversation ID if provided
    if (conversationId) {
      conversationStore.setConversationId(conversationId);
    }

    // Transition to AI speaking state
    if (conversationStore.canTransitionTo(ConversationState.AI_SPEAKING, 'AI_RESPONSE_READY')) {
      conversationStore.transitionTo(ConversationState.AI_SPEAKING, 'AI_RESPONSE_READY');
    }

    // Trigger speech synthesis with mutex protection
    speechCoordinator.speak(response, undefined, {
      onStart: () => {
        console.log('AI started speaking response');
      },
      onEnd: () => {
        console.log('AI finished speaking response');
        // Auto-start listening after AI finishes speaking
        setTimeout(() => {
          conversationStore.autoStartListening();
        }, 500);
      },
      onError: (error) => {
        console.error('Speech synthesis error:', error);
        uiStore.addNotification({
          type: 'error',
          title: 'Speech Error',
          message: 'Failed to speak AI response',
          duration: 3000,
        });
        // Still try to auto-start listening
        setTimeout(() => {
          conversationStore.autoStartListening();
        }, 500);
      },
    }, 'normal').catch((error) => {
      console.error('Failed to queue AI speech:', error);
      // Fallback to direct auto-start listening
      setTimeout(() => {
        conversationStore.autoStartListening();
      }, 500);
    });
  }, [conversationStore, speechCoordinator, uiStore]);

  const handleConversationStarted = useCallback((data: { conversationId: string; welcomeMessage?: string }) => {
    const { conversationId, welcomeMessage } = data;
    
    conversationStore.setConversationId(conversationId);
    
    if (welcomeMessage) {
      conversationStore.addMessage({
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date(),
      });
    }

    uiStore.addNotification({
      type: 'success',
      title: 'Connected',
      message: 'Conversation session started',
      duration: 2000,
    });
  }, [conversationStore, uiStore]);

  const handleError = useCallback((data: { message: string; code?: string }) => {
    const { message, code } = data;
    
    console.error('WebSocket error:', { message, code });
    
    conversationStore.setError(`WebSocket error: ${message}`);
    
    uiStore.addNotification({
      type: 'error',
      title: 'Connection Error',
      message: message || 'An error occurred',
      duration: 5000,
    });
  }, [conversationStore, uiStore]);

  const handleSessionEnded = useCallback((data: { reason?: string; stats?: unknown }) => {
    const { reason, stats } = data;
    
    console.log('Session ended:', { reason, stats });
    
    // Reset conversation state
    conversationStore.resetConversation();
    
    uiStore.addNotification({
      type: 'info',
      title: 'Session Ended',
      message: reason || 'Conversation session has ended',
      duration: 3000,
    });
  }, [conversationStore, uiStore]);

  const handleFeedbackUpdate = useCallback((data: { messageId: string; feedback: unknown }) => {
    const { messageId, feedback } = data;
    
    // Update message with new feedback
    // Note: This would require a method in the store to update existing messages
    console.log('Feedback update:', { messageId, feedback });
  }, []);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      console.log('WebSocket message received:', message);
      
      switch (message.type) {
        case 'conversation_response':
          handleConversationResponse(message.data as { response: string; feedback?: any; conversationId?: string });
          break;
        case 'conversation_started':
          handleConversationStarted(message.data as { conversationId: string; welcomeMessage?: string });
          break;
        case 'error':
          handleError(message.data as { message: string; code?: string });
          break;
        case 'session_ended':
          handleSessionEnded(message.data as { reason?: string; stats?: unknown });
          break;
        case 'feedback_update':
          handleFeedbackUpdate(message.data as { messageId: string; feedback: unknown });
          break;
        case 'pong':
          // Heartbeat response - no action needed
          console.log('Received heartbeat pong');
          break;
        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [
    handleConversationResponse,
    handleConversationStarted,
    handleError,
    handleSessionEnded,
    handleFeedbackUpdate,
  ]);

  // Send message via WebSocket
  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const wsMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };
      
      wsRef.current.send(JSON.stringify(wsMessage));
      return true;
    } else {
      console.warn('WebSocket not connected, cannot send message');
      uiStore.addNotification({
        type: 'warning',
        title: 'Connection Issue',
        message: 'Not connected to server. Trying to reconnect...',
        duration: 3000,
      });
      
      // Try to reconnect
      if (autoReconnect) {
        connect();
      }
      
      return false;
    }
  }, [uiStore, autoReconnect]);

  // Send conversation message
  const sendConversationMessage = useCallback((
    content: string,
    personality?: string,
    targetVocabulary?: string[]
  ) => {
    const { session } = conversationStore;
    
    return sendMessage({
      type: 'conversation_message',
      data: {
        message: content,
        personality: personality || session.selectedPersonality,
        target_vocabulary: targetVocabulary || [],
        session_type: 'daily',
        conversationId: session.conversationId,
        userName: session.userName,
      },
    });
  }, [conversationStore, sendMessage]);

  // Start conversation session
  const startConversationSession = useCallback((skipWelcome = false) => {
    const { session } = conversationStore;
    
    return sendMessage({
      type: 'start_conversation',
      data: {
        personality: session.selectedPersonality,
        skipWelcome,
        userName: session.userName,
        isFirstTime: session.isFirstTime,
        onboardingStep: session.onboardingStep,
      },
    });
  }, [conversationStore, sendMessage]);

  // Heartbeat functionality
  const startHeartbeat = useCallback(() => {
    const sendHeartbeat = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        heartbeatTimeoutRef.current = setTimeout(sendHeartbeat, heartbeatInterval);
      }
    };
    
    heartbeatTimeoutRef.current = setTimeout(sendHeartbeat, heartbeatInterval);
  }, [heartbeatInterval]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Connection management
  const connect = useCallback(() => {
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    isConnectingRef.current = true;
    
    try {
      console.log('Connecting to WebSocket:', url);
      
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        isConnectedRef.current = true;
        isConnectingRef.current = false;
        reconnectCountRef.current = 0;
        
        startHeartbeat();
        
        uiStore.addNotification({
          type: 'success',
          title: 'Connected',
          message: 'Connected to conversation server',
          duration: 2000,
        });
      };

      wsRef.current.onmessage = handleWebSocketMessage;

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        isConnectedRef.current = false;
        isConnectingRef.current = false;
        
        stopHeartbeat();
        
        if (autoReconnect && reconnectCountRef.current < reconnectAttempts) {
          console.log(`Attempting to reconnect... (${reconnectCountRef.current + 1}/${reconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connect();
          }, reconnectDelay);
          
          uiStore.addNotification({
            type: 'warning',
            title: 'Disconnected',
            message: `Connection lost. Reconnecting... (${reconnectCountRef.current + 1}/${reconnectAttempts})`,
            duration: 3000,
          });
        } else {
          uiStore.addNotification({
            type: 'error',
            title: 'Disconnected',
            message: 'Connection to server lost',
            duration: 5000,
          });
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnectingRef.current = false;
        
        uiStore.addNotification({
          type: 'error',
          title: 'Connection Error',
          message: 'Failed to connect to server',
          duration: 3000,
        });
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      isConnectingRef.current = false;
      
      uiStore.addNotification({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to establish connection',
        duration: 3000,
      });
    }
  }, [url, autoReconnect, reconnectAttempts, reconnectDelay, handleWebSocketMessage, startHeartbeat, stopHeartbeat, uiStore]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    isConnectedRef.current = false;
    isConnectingRef.current = false;
    reconnectCountRef.current = 0;
  }, [stopHeartbeat]);

  // Initialize connection on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []); // Empty dependency array to prevent reconnection loops

  // Return hook interface
  return {
    // Connection state
    isConnected: isConnectedRef.current,
    isConnecting: isConnectingRef.current,
    
    // Connection management
    connect,
    disconnect,
    
    // Message sending
    sendMessage,
    sendConversationMessage,
    startConversationSession,
    
    // Utility
    getConnectionState: () => ({
      isConnected: isConnectedRef.current,
      isConnecting: isConnectingRef.current,
      reconnectCount: reconnectCountRef.current,
      maxReconnectAttempts: reconnectAttempts,
    }),
  };
};

// ===== CONVERSATION HOOK REPLACEMENT =====

// Enhanced version of useConversation that uses the stores and WebSocket
export const useConversationWithStores = () => {
  const conversationStore = useConversationStore();
  const speechStore = useSpeechStore();
  const webSocket = useWebSocketIntegration();
  
  // Use the same speech coordinator instance from WebSocket hook
  const speechCoordinator = useSpeechCoordinator({ autoInitialize: true });

  const sendMessage = useCallback(async (
    content: string,
    audioBlob?: Blob,
    personality?: string
  ) => {
    // Add user message to store
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content,
      timestamp: new Date(),
      audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : undefined,
    };

    conversationStore.addMessage(userMessage);
    conversationStore.setProcessing(true);

    // Send via WebSocket if available, otherwise use HTTP fallback
    const sent = webSocket.sendConversationMessage(content, personality);
    
    if (!sent) {
      // HTTP fallback
      try {
        const requestBody = {
          message: content,
          target_vocabulary: [],
          session_type: 'daily',
          personality: personality || conversationStore.session.selectedPersonality,
        };

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/conversation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error('Failed to process conversation');
        }

        const data = await response.json();
        
        const assistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: data.response,
          timestamp: new Date(),
          feedback: data.feedback,
        };

        conversationStore.addMessage(assistantMessage);
        conversationStore.setProcessing(false);

        // Trigger speech synthesis with mutex protection
        speechCoordinator.speak(data.response, undefined, {
          onStart: () => {
            console.log('AI started speaking (HTTP fallback)');
          },
          onEnd: () => {
            console.log('AI finished speaking (HTTP fallback)');
            setTimeout(() => {
              conversationStore.autoStartListening();
            }, 500);
          },
          onError: (error) => {
            console.error('Speech synthesis error (HTTP fallback):', error);
          },
        }, 'normal').catch((error) => {
          console.error('Failed to queue AI speech (HTTP fallback):', error);
        });

      } catch (error) {
        conversationStore.setProcessing(false);
        conversationStore.setError(error instanceof Error ? error.message : 'Connection error');
        
        // Use fallback response
        const fallbackResponses = {
          sassy: `Oh, "${content}"? How utterly fascinating, darling! Do tell me more - I'm positively riveted!`,
          blunt: `"${content}" - okay, got it. What's your point exactly?`,
          friendly: `That's really interesting about "${content}"! I'd love to hear more about your experience with that.`,
        };
        
        const currentPersonality = personality || conversationStore.session.selectedPersonality;
        const fallbackResponse = fallbackResponses[currentPersonality as keyof typeof fallbackResponses] || fallbackResponses.friendly;
        
        const fallbackMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: fallbackResponse,
          timestamp: new Date(),
          feedback: {
            clarity: Math.floor(Math.random() * 30) + 70,
            fluency: Math.floor(Math.random() * 30) + 70,
            vocabularyUsage: [],
            suggestions: ['Try to speak a bit slower', 'Great use of vocabulary!'],
            overallRating: Math.floor(Math.random() * 2) + 4,
          },
        };

        conversationStore.addMessage(fallbackMessage);
        
        // Trigger speech synthesis for fallback with mutex protection
        speechCoordinator.speak(fallbackResponse, undefined, {
          onStart: () => {
            console.log('AI started speaking (fallback)');
          },
          onEnd: () => {
            console.log('AI finished speaking (fallback)');
            setTimeout(() => {
              conversationStore.autoStartListening();
            }, 500);
          },
          onError: (error) => {
            console.error('Speech synthesis error (fallback):', error);
          },
        }, 'normal').catch((error) => {
          console.error('Failed to queue AI speech (fallback):', error);
        });
      }
    }
  }, [conversationStore, speechCoordinator, webSocket]);

  const startSession = useCallback((topic?: string, skipWelcome?: boolean) => {
    conversationStore.clearMessages();
    conversationStore.updateSessionDuration();
    
    // Start session via WebSocket if available
    const sent = webSocket.startConversationSession(skipWelcome);
    
    if (!sent && !skipWelcome) {
      // HTTP fallback - add welcome message
      const welcomeMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant' as const,
        content: topic 
          ? `Great! Let's practice conversation about ${topic}. Feel free to start speaking whenever you're ready.`
          : `Hello! I'm here to help you practice conversational English. What would you like to talk about today?`,
        timestamp: new Date(),
      };

      conversationStore.addMessage(welcomeMessage);
    }
  }, [conversationStore, webSocket]);

  return {
    messages: conversationStore.messages,
    isProcessing: conversationStore.ui.isProcessing,
    sendMessage,
    startSession,
    endSession: () => conversationStore.resetConversation(),
    clearConversation: () => conversationStore.clearMessages(),
  };
};