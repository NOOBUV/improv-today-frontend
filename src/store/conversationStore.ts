'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';

// ===== TYPES =====

export type Personality = 'sassy' | 'blunt' | 'friendly';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  feedback?: ConversationFeedback;
}

export interface ConversationFeedback {
  clarity: number; // 0-100
  fluency: number; // 0-100
  vocabularyUsage: string[];
  suggestions: string[];
  overallRating: number; // 0-5
}

export interface VocabularySuggestion {
  id: number;
  word: string;
  definition: string;
  exampleSentence: string;
  remediationFeedback?: string; // AC: 5 - Optional remediation feedback for incorrect usage
}

export interface SessionData {
  userName: string;
  selectedPersonality: Personality;
  conversationId?: string;
  backendSessionId?: number | null;
  sessionDuration: number;
  sessionStartTime: number;
}

// ===== STORE INTERFACE =====

export interface ConversationStore {
  // State
  isListening: boolean;
  isAISpeaking: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  
  // Data
  messages: ConversationMessage[];
  session: SessionData;
  currentSuggestion: VocabularySuggestion | null;
  
  // Simple actions
  setListening: (listening: boolean) => void;
  setAISpeaking: (speaking: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setTranscript: (transcript: string, isInterim?: boolean) => void;
  clearTranscript: () => void;
  setError: (error: string | null) => void;
  
  // Message actions
  addMessage: (message: ConversationMessage) => void;
  clearMessages: () => void;
  
  // Session actions
  setUserName: (name: string) => void;
  setPersonality: (personality: Personality) => void;
  setConversationId: (id: string) => void;
  setBackendSessionId: (id: number | null) => void;
  updateSessionDuration: () => void;
  
  // Suggestion actions
  setSuggestion: (suggestion: VocabularySuggestion | null) => void;
  clearSuggestion: (suggestionId?: number) => void;
  updateSuggestionFeedback: (suggestionId: number, feedback: string) => void;
  
  // High-level actions
  startListening: () => void;
  stopListening: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  startAISpeaking: () => void;
  stopAISpeaking: () => void;
  reset: () => void;
}

// ===== STORE IMPLEMENTATION =====

export const useConversationStore = create<ConversationStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      isListening: false,
      isAISpeaking: false,
      isProcessing: false,
      isPaused: false,
      transcript: '',
      interimTranscript: '',
      error: null,
      
      messages: [],
      currentSuggestion: null,
      
      session: {
        userName: '',
        selectedPersonality: 'friendly',
        backendSessionId: null,
        sessionDuration: 0,
        sessionStartTime: Date.now(),
      },
      
      // Simple state setters
      setListening: (listening: boolean) => {
        set((state) => {
          state.isListening = listening;
          if (listening) {
            state.isPaused = false;
            state.isAISpeaking = false;
          }
        });
      },
      
      setAISpeaking: (speaking: boolean) => {
        set((state) => {
          state.isAISpeaking = speaking;
          if (speaking) {
            state.isListening = false;
            state.isPaused = false;
            state.isProcessing = false;
          }
        });
      },
      
      setProcessing: (processing: boolean) => {
        set((state) => {
          state.isProcessing = processing;
          if (processing) {
            state.isListening = false;
            state.isPaused = false;
          }
        });
      },
      
      setPaused: (paused: boolean) => {
        set((state) => {
          state.isPaused = paused;
          if (paused) {
            state.isListening = false;
          }
        });
      },
      
      setTranscript: (transcript: string, isInterim = false) => {
        set((state) => {
          if (isInterim) {
            state.interimTranscript = transcript;
          } else {
            state.transcript = transcript;
            state.interimTranscript = '';
          }
        });
      },
      
      clearTranscript: () => {
        set((state) => {
          state.transcript = '';
          state.interimTranscript = '';
        });
      },
      
      setError: (error: string | null) => {
        set((state) => {
          state.error = error;
          if (error) {
            state.isListening = false;
            state.isAISpeaking = false;
            state.isProcessing = false;
          }
        });
      },
      
      // Message actions
      addMessage: (message: ConversationMessage) => {
        set((state) => {
          state.messages.push(message);
        });
      },
      
      clearMessages: () => {
        set((state) => {
          // Clean up audio URLs
          state.messages.forEach(message => {
            if (message.audioUrl) {
              URL.revokeObjectURL(message.audioUrl);
            }
          });
          state.messages = [];
        });
      },
      
      // Session actions
      setUserName: (name: string) => {
        set((state) => {
          state.session.userName = name;
        });
      },
      
      setPersonality: (personality: Personality) => {
        set((state) => {
          state.session.selectedPersonality = personality;
        });
      },
      
      setConversationId: (id: string) => {
        set((state) => {
          state.session.conversationId = id;
        });
      },
      
      setBackendSessionId: (id: number | null) => {
        set((state) => {
          state.session.backendSessionId = id;
        });
      },
      
      updateSessionDuration: () => {
        set((state) => {
          if (state.session.sessionStartTime > 0) {
            state.session.sessionDuration = Math.floor(
              (Date.now() - state.session.sessionStartTime) / 1000
            );
          }
        });
      },
      
      // Suggestion actions
      setSuggestion: (suggestion: VocabularySuggestion | null) => {
        set((state) => {
          state.currentSuggestion = suggestion;
        });
      },
      
      clearSuggestion: (suggestionId?: number) => {
        set((state) => {
          // If specific ID provided, only clear if it matches current suggestion
          if (suggestionId !== undefined && state.currentSuggestion?.id !== suggestionId) {
            return; // Don't clear if IDs don't match
          }
          state.currentSuggestion = null;
        });
      },
      
      updateSuggestionFeedback: (suggestionId: number, feedback: string) => {
        set((state) => {
          // Only update if the feedback is for the current suggestion
          if (state.currentSuggestion?.id === suggestionId) {
            state.currentSuggestion.remediationFeedback = feedback;
          }
        });
      },
      
      // High-level actions
      startListening: () => {
        const { setListening, clearTranscript, setError } = get();
        setError(null);
        clearTranscript();
        setListening(true);
      },
      
      stopListening: () => {
        const { setListening } = get();
        setListening(false);
      },
      
      pauseListening: () => {
        const { setPaused } = get();
        setPaused(true);
      },
      
      resumeListening: () => {
        const { setPaused, setListening } = get();
        setPaused(false);
        setListening(true);
      },
      
      startAISpeaking: () => {
        const { setAISpeaking } = get();
        setAISpeaking(true);
      },
      
      stopAISpeaking: () => {
        const { setAISpeaking } = get();
        setAISpeaking(false);
      },
      
      reset: () => {
        set((state) => {
          state.isListening = false;
          state.isAISpeaking = false;
          state.isProcessing = false;
          state.isPaused = false;
          state.transcript = '';
          state.interimTranscript = '';
          state.error = null;
          
          // Keep session data but clear messages and suggestions
          state.messages.forEach(message => {
            if (message.audioUrl) {
              URL.revokeObjectURL(message.audioUrl);
            }
          });
          state.messages = [];
          state.currentSuggestion = null;
        });
      },
    })),
    {
      name: 'conversation-store',
    }
  )
);

// ===== SELECTORS =====

// Object selectors using useShallow to prevent infinite loops
export const useConversationState = () => useConversationStore(
  useShallow((state) => ({
    isListening: state.isListening,
    isAISpeaking: state.isAISpeaking,
    isProcessing: state.isProcessing,
    isPaused: state.isPaused,
    error: state.error,
  }))
);

export const useTranscriptState = () => useConversationStore(
  useShallow((state) => ({
    transcript: state.transcript,
    interimTranscript: state.interimTranscript,
  }))
);

// Primitive selectors don't need useShallow
export const useSessionState = () => useConversationStore((state) => state.session);
export const useMessages = () => useConversationStore((state) => state.messages);
export const useCurrentSuggestion = () => useConversationStore((state) => state.currentSuggestion);

// Status helpers
export const useCanStartConversation = () => useConversationStore((state) => 
  !state.isListening && !state.isAISpeaking && !state.isProcessing
);