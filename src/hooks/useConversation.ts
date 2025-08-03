'use client';

import { useState, useCallback, useRef } from 'react';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  feedback?: ConversationFeedback;
}

interface ConversationFeedback {
  clarity: number; // 0-100
  fluency: number; // 0-100
  vocabularyUsage: string[];
  suggestions: string[];
  overallRating: number; // 0-5
}

interface ConversationState {
  messages: ConversationMessage[];
  isProcessing: boolean;
  currentTopic?: string;
  sessionDuration: number;
  error: string | null;
}

export const useConversation = () => {
  const [state, setState] = useState<ConversationState>({
    messages: [],
    isProcessing: false,
    sessionDuration: 0,
    error: null,
  });

  const sessionStartRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startSession = useCallback((topic?: string, skipWelcome?: boolean) => {
    sessionStartRef.current = Date.now();
    setState(prev => ({
      ...prev,
      currentTopic: topic,
      messages: [],
      sessionDuration: 0,
      error: null,
    }));

    // Only add welcome message if not skipped (for onboarding flow)
    if (!skipWelcome) {
      const welcomeMessage: ConversationMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: topic 
          ? `Great! Let's practice conversation about ${topic}. Feel free to start speaking whenever you're ready.`
          : `Hello! I'm here to help you practice conversational English. What would you like to talk about today?`,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        messages: [welcomeMessage],
      }));
    }

    // Start session timer
    intervalRef.current = setInterval(() => {
      setState(prev => ({
        ...prev,
        sessionDuration: Math.floor((Date.now() - sessionStartRef.current) / 1000),
      }));
    }, 1000);
  }, []);

  const sendMessage = useCallback(async (content: string, audioBlob?: Blob, personality?: string) => {
    const userMessage: ConversationMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: new Date(),
      audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : undefined,
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isProcessing: true,
      error: null,
    }));

    try {
      const requestBody = {
        message: content,
        target_vocabulary: [],
        session_type: 'daily',
        topic: state.currentTopic || '',
        personality: personality || 'friendly'
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
      
      const assistantMessage: ConversationMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        feedback: data.feedback,
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isProcessing: false,
      }));

    } catch (error) {
      // Generate personality-based fallback responses
      const personalityResponses = {
        sassy: [
          `Oh, "${content}"? How utterly fascinating, darling! Do tell me more - I'm positively riveted!`,
          `Right then, "${content}" - that's quite something, isn't it? Care to elaborate, love?`,
          `Well, well, "${content}" - you've certainly caught my attention! What's the story behind that?`
        ],
        blunt: [
          `"${content}" - okay, got it. What's your point exactly?`,
          `So you mentioned "${content}". What are you trying to say about it?`,
          `"${content}" - I hear you. But what's the real story here?`
        ],
        friendly: [
          `That's really interesting about "${content}"! I'd love to hear more about your experience with that.`,
          `"${content}" sounds fascinating! Could you share more details about what you think?`,
          `Thank you for sharing about "${content}". What made you think of that topic?`
        ]
      };
      
      const currentPersonality = personality || 'friendly';
      const responses = personalityResponses[currentPersonality as keyof typeof personalityResponses];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const fallbackResponse: ConversationMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: randomResponse,
        timestamp: new Date(),
        feedback: {
          clarity: Math.floor(Math.random() * 30) + 70,
          fluency: Math.floor(Math.random() * 30) + 70,
          vocabularyUsage: [],
          suggestions: ['Try to speak a bit slower', 'Great use of vocabulary!'],
          overallRating: Math.floor(Math.random() * 2) + 4,
        },
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, fallbackResponse],
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Connection error - using offline mode',
      }));
    }
  }, [state.currentTopic]);

  const endSession = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Clean up audio URLs
    state.messages.forEach(message => {
      if (message.audioUrl) {
        URL.revokeObjectURL(message.audioUrl);
      }
    });

    const sessionStats = {
      duration: state.sessionDuration,
      messageCount: state.messages.length,
      topic: state.currentTopic,
    };

    // Reset conversation state after collecting stats
    setState({
      messages: [],
      isProcessing: false,
      sessionDuration: 0,
      currentTopic: undefined,
      error: null,
    });

    return sessionStats;
  }, [state.messages, state.sessionDuration, state.currentTopic]);

  const clearConversation = useCallback(() => {
    // Clean up audio URLs
    state.messages.forEach(message => {
      if (message.audioUrl) {
        URL.revokeObjectURL(message.audioUrl);
      }
    });

    setState({
      messages: [],
      isProcessing: false,
      currentTopic: undefined,
      sessionDuration: 0,
      error: null,
    });
  }, [state.messages]);

  const getLastFeedback = useCallback(() => {
    const lastAssistantMessage = state.messages
      .filter(msg => msg.role === 'assistant')
      .pop();
    return lastAssistantMessage?.feedback;
  }, [state.messages]);

  return {
    ...state,
    startSession,
    sendMessage,
    endSession,
    clearConversation,
    getLastFeedback,
  };
};