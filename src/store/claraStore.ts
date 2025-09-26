'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';

// ===== TYPES =====

export type ClaraPersonality = 'friendly' | 'sassy' | 'blunt';

export interface ClaraMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ClaraSession {
  userName: string;
  selectedPersonality: ClaraPersonality;
  conversationId?: string;
  sessionId: number; // For conversation tracking
  sessionDuration: number;
  sessionStartTime: number;
}

// ===== STORE INTERFACE =====

export interface ClaraStore {
  // Conversation state
  isListening: boolean;
  isAISpeaking: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  
  // Data
  messages: ClaraMessage[];
  session: ClaraSession;
  
  // Simple actions
  setListening: (listening: boolean) => void;
  setAISpeaking: (speaking: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setTranscript: (transcript: string, isInterim?: boolean) => void;
  clearTranscript: () => void;
  setError: (error: string | null) => void;
  
  // Message actions
  addMessage: (message: ClaraMessage) => void;
  clearMessages: () => void;
  
  // Session actions
  setUserName: (name: string) => void;
  setPersonality: (personality: ClaraPersonality) => void;
  setConversationId: (id: string) => void;
  updateSessionDuration: () => void;
  
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

export const useClaraStore = create<ClaraStore>()(
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
      
      session: {
        userName: '',
        selectedPersonality: 'friendly',
        sessionId: Math.floor(Math.random() * 1000000), // Generate unique session ID
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
      addMessage: (message: ClaraMessage) => {
        set((state) => {
          state.messages.push(message);
        });
      },
      
      clearMessages: () => {
        set((state) => {
          state.messages = [];
        });
      },
      
      // Session actions
      setUserName: (name: string) => {
        set((state) => {
          state.session.userName = name;
        });
      },
      
      setPersonality: (personality: ClaraPersonality) => {
        set((state) => {
          state.session.selectedPersonality = personality;
        });
      },
      
      setConversationId: (id: string) => {
        set((state) => {
          state.session.conversationId = id;
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
          
          // Keep session data but clear messages
          state.messages = [];
        });
      },
    })),
    {
      name: 'clara-store',
    }
  )
);

// ===== SELECTORS =====

// Object selectors using useShallow to prevent infinite loops
export const useClaraConversationState = () => useClaraStore(
  useShallow((state) => ({
    isListening: state.isListening,
    isAISpeaking: state.isAISpeaking,
    isProcessing: state.isProcessing,
    isPaused: state.isPaused,
    error: state.error,
  }))
);

export const useClaraTranscriptState = () => useClaraStore(
  useShallow((state) => ({
    transcript: state.transcript,
    interimTranscript: state.interimTranscript,
  }))
);

// Primitive selectors don't need useShallow
export const useClaraSessionState = () => useClaraStore((state) => state.session);
export const useClaraMessages = () => useClaraStore((state) => state.messages);

// Status helpers
export const useClaraCanStartConversation = () => useClaraStore((state) => 
  !state.isListening && !state.isAISpeaking && !state.isProcessing
);