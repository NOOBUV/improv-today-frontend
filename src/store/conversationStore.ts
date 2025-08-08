'use client';

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
// Removed shallow import for Zustand v5 compatibility

// ===== TYPES & INTERFACES =====

export enum ConversationState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  AI_SPEAKING = 'ai_speaking',
  PAUSED = 'paused',
  ERROR = 'error'
}

export type Personality = 'sassy' | 'blunt' | 'friendly';
export type OnboardingStep = 'welcome' | 'name' | 'day' | 'complete';

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

export interface SpeechState {
  isListening: boolean;
  isAISpeaking: boolean;
  isPaused: boolean;
  transcript: string;
  interimTranscript: string;
  silenceTimer: NodeJS.Timeout | null;
}

export interface SessionData {
  isFirstTime: boolean;
  userName: string;
  selectedPersonality: Personality;
  onboardingStep: OnboardingStep;
  conversationId?: string;
  backendSessionId?: number | null;
  sessionDuration: number;
  sessionStartTime: number;
}

export interface UIState {
  showSettings: boolean;
  selectedVoice: string;
  availableVoices: SpeechSynthesisVoice[];
  isProcessing: boolean;
  error: string | null;
}

// ===== STATE MACHINE TRANSITIONS =====

type StateTransition = {
  from: ConversationState[];
  to: ConversationState;
  action?: string;
};

const STATE_TRANSITIONS: StateTransition[] = [
  // Initial states
  { from: [ConversationState.IDLE], to: ConversationState.LISTENING, action: 'START_LISTENING' },
  { from: [ConversationState.IDLE], to: ConversationState.AI_SPEAKING, action: 'START_AI_SPEAKING' },
  
  // From listening
  { from: [ConversationState.LISTENING], to: ConversationState.PAUSED, action: 'PAUSE_LISTENING' },
  { from: [ConversationState.LISTENING], to: ConversationState.PROCESSING, action: 'PROCESS_TRANSCRIPT' },
  { from: [ConversationState.LISTENING], to: ConversationState.IDLE, action: 'STOP_LISTENING' },
  { from: [ConversationState.LISTENING], to: ConversationState.ERROR, action: 'SPEECH_ERROR' },
  
  // From paused
  { from: [ConversationState.PAUSED], to: ConversationState.LISTENING, action: 'RESUME_LISTENING' },
  { from: [ConversationState.PAUSED], to: ConversationState.IDLE, action: 'STOP_CONVERSATION' },
  
  // From processing
  { from: [ConversationState.PROCESSING], to: ConversationState.AI_SPEAKING, action: 'AI_RESPONSE_READY' },
  { from: [ConversationState.PROCESSING], to: ConversationState.ERROR, action: 'PROCESSING_ERROR' },
  { from: [ConversationState.PROCESSING], to: ConversationState.IDLE, action: 'PROCESSING_CANCELLED' },
  
  // From AI speaking
  { from: [ConversationState.AI_SPEAKING], to: ConversationState.LISTENING, action: 'AI_FINISHED_AUTO_LISTEN' },
  { from: [ConversationState.AI_SPEAKING], to: ConversationState.IDLE, action: 'AI_FINISHED_STOP' },
  { from: [ConversationState.AI_SPEAKING], to: ConversationState.LISTENING, action: 'INTERRUPT_AI' },
  { from: [ConversationState.AI_SPEAKING], to: ConversationState.ERROR, action: 'AI_SPEECH_ERROR' },
  
  // From error
  { from: [ConversationState.ERROR], to: ConversationState.IDLE, action: 'RESET_FROM_ERROR' },
  { from: [ConversationState.ERROR], to: ConversationState.LISTENING, action: 'RETRY_LISTENING' },
  
  // Emergency transitions (can be called from any state)
  { from: Object.values(ConversationState), to: ConversationState.IDLE, action: 'FORCE_RESET' },
  { from: Object.values(ConversationState), to: ConversationState.ERROR, action: 'FORCE_ERROR' },
];

// ===== STORE INTERFACE =====

export interface ConversationStore {
  // Current state
  currentState: ConversationState;
  
  // Sub-states
  speech: SpeechState;
  session: SessionData;
  ui: UIState;
  messages: ConversationMessage[];
  
  // State machine actions
  canTransitionTo: (targetState: ConversationState, action?: string) => boolean;
  transitionTo: (targetState: ConversationState, action?: string) => void;
  
  // Speech actions
  startListening: () => void;
  stopListening: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  updateTranscript: (transcript: string, isInterim?: boolean) => void;
  clearTranscript: () => void;
  setSilenceTimer: (timer: NodeJS.Timeout | null) => void;
  
  // AI speech actions
  startAISpeaking: () => void;
  stopAISpeaking: () => void;
  
  // Conversation actions
  addMessage: (message: ConversationMessage) => void;
  clearMessages: () => void;
  setProcessing: (isProcessing: boolean) => void;
  
  // Session actions
  initializeSession: () => void;
  setUserName: (name: string) => void;
  setPersonality: (personality: Personality) => void;
  setOnboardingStep: (step: OnboardingStep) => void;
  completeOnboarding: () => void;
  updateSessionDuration: () => void;
  setConversationId: (id: string) => void;
  setBackendSessionId: (id: number | null) => void;
  
  // UI actions
  setShowSettings: (show: boolean) => void;
  setSelectedVoice: (voice: string) => void;
  setAvailableVoices: (voices: SpeechSynthesisVoice[]) => void;
  setError: (error: string | null) => void;
  
  // High-level actions
  handleWaveformClick: () => void;
  handleOnboardingFlow: () => void;
  autoStartListening: () => void;
  resetConversation: () => void;
}

// ===== STATE MACHINE HELPERS =====

const validateTransition = (
  currentState: ConversationState,
  targetState: ConversationState,
  action?: string
): boolean => {
  // If same state, allow (no-op)
  if (currentState === targetState) return true;
  
  // Find valid transitions
  const validTransitions = STATE_TRANSITIONS.filter(
    transition => 
      transition.to === targetState && 
      transition.from.includes(currentState) &&
      (!action || !transition.action || transition.action === action)
  );
  
  return validTransitions.length > 0;
};

// ===== STORE IMPLEMENTATION =====

// Create the store with better React 18 compatibility
export const useConversationStore = create<ConversationStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        currentState: ConversationState.IDLE,
        
        speech: {
          isListening: false,
          isAISpeaking: false,
          isPaused: false,
          transcript: '',
          interimTranscript: '',
          silenceTimer: null,
        },
        
        session: {
          isFirstTime: true,
          userName: '',
          selectedPersonality: 'friendly',
          onboardingStep: 'welcome',
          backendSessionId: null,
          sessionDuration: 0,
          sessionStartTime: 0,
        },
        
        ui: {
          showSettings: false,
          selectedVoice: '',
          availableVoices: [],
          isProcessing: false,
          error: null,
        },
        
        messages: [],
        
        // State machine methods
        canTransitionTo: (targetState: ConversationState, action?: string) => {
          const currentState = get().currentState;
          return validateTransition(currentState, targetState, action);
        },
        
        transitionTo: (targetState: ConversationState, action?: string) => {
          set((state) => {
            const isValidTransition = validateTransition(state.currentState, targetState, action);
            
            if (!isValidTransition) {
              console.warn(
                `Invalid state transition: ${state.currentState} -> ${targetState}` +
                (action ? ` (action: ${action})` : '')
              );
              return;
            }
            
            console.log(
              `State transition: ${state.currentState} -> ${targetState}` +
              (action ? ` (action: ${action})` : '')
            );
            
            state.currentState = targetState;
            
            // Auto-update related flags based on state
            switch (targetState) {
              case ConversationState.LISTENING:
                state.speech.isListening = true;
                state.speech.isPaused = false;
                state.speech.isAISpeaking = false;
                state.ui.isProcessing = false;
                break;
                
              case ConversationState.PAUSED:
                state.speech.isListening = false;
                state.speech.isPaused = true;
                state.speech.isAISpeaking = false;
                break;
                
              case ConversationState.PROCESSING:
                state.speech.isListening = false;
                state.speech.isPaused = false;
                state.speech.isAISpeaking = false;
                state.ui.isProcessing = true;
                break;
                
              case ConversationState.AI_SPEAKING:
                state.speech.isListening = false;
                state.speech.isPaused = false;
                state.speech.isAISpeaking = true;
                state.ui.isProcessing = false;
                break;
                
              case ConversationState.IDLE:
                state.speech.isListening = false;
                state.speech.isPaused = false;
                state.speech.isAISpeaking = false;
                state.ui.isProcessing = false;
                break;
                
              case ConversationState.ERROR:
                state.speech.isListening = false;
                state.speech.isPaused = false;
                state.speech.isAISpeaking = false;
                state.ui.isProcessing = false;
                break;
            }
          });
        },
        
        // Speech actions
        startListening: () => {
          set((state) => {
            if (get().canTransitionTo(ConversationState.LISTENING, 'START_LISTENING')) {
              get().transitionTo(ConversationState.LISTENING, 'START_LISTENING');
              state.speech.transcript = '';
              state.speech.interimTranscript = '';
            }
          });
        },
        
        stopListening: () => {
          set((state) => {
            if (get().canTransitionTo(ConversationState.IDLE, 'STOP_LISTENING')) {
              get().transitionTo(ConversationState.IDLE, 'STOP_LISTENING');
              // Clear silence timer
              if (state.speech.silenceTimer) {
                clearTimeout(state.speech.silenceTimer);
                state.speech.silenceTimer = null;
              }
            }
          });
        },
        
        pauseListening: () => {
          set((state) => {
            if (get().canTransitionTo(ConversationState.PAUSED, 'PAUSE_LISTENING')) {
              get().transitionTo(ConversationState.PAUSED, 'PAUSE_LISTENING');
              // Clear silence timer
              if (state.speech.silenceTimer) {
                clearTimeout(state.speech.silenceTimer);
                state.speech.silenceTimer = null;
              }
            }
          });
        },
        
        resumeListening: () => {
          set(() => {
            if (get().canTransitionTo(ConversationState.LISTENING, 'RESUME_LISTENING')) {
              get().transitionTo(ConversationState.LISTENING, 'RESUME_LISTENING');
            }
          });
        },
        
        updateTranscript: (transcript: string, isInterim = false) => {
          set((state) => {
            if (isInterim) {
              state.speech.interimTranscript = transcript;
            } else {
              state.speech.transcript = state.speech.transcript 
                ? state.speech.transcript + ' ' + transcript 
                : transcript;
              state.speech.interimTranscript = '';
            }
          });
        },
        
        clearTranscript: () => {
          set((state) => {
            state.speech.transcript = '';
            state.speech.interimTranscript = '';
          });
        },
        
        setSilenceTimer: (timer: NodeJS.Timeout | null) => {
          set((state) => {
            // Clear existing timer
            if (state.speech.silenceTimer) {
              clearTimeout(state.speech.silenceTimer);
            }
            state.speech.silenceTimer = timer;
          });
        },
        
        // AI speech actions
        startAISpeaking: () => {
          set(() => {
            if (get().canTransitionTo(ConversationState.AI_SPEAKING, 'START_AI_SPEAKING')) {
              get().transitionTo(ConversationState.AI_SPEAKING, 'START_AI_SPEAKING');
            }
          });
        },
        
        stopAISpeaking: () => {
          set(() => {
            if (get().canTransitionTo(ConversationState.IDLE, 'AI_FINISHED_STOP')) {
              get().transitionTo(ConversationState.IDLE, 'AI_FINISHED_STOP');
            }
          });
        },
        
        // Conversation actions
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
        
        setProcessing: (isProcessing: boolean) => {
          set((state) => {
            if (isProcessing && get().canTransitionTo(ConversationState.PROCESSING, 'PROCESS_TRANSCRIPT')) {
              get().transitionTo(ConversationState.PROCESSING, 'PROCESS_TRANSCRIPT');
            } else if (!isProcessing && state.currentState === ConversationState.PROCESSING) {
              // Will be handled by AI response or error
            }
            state.ui.isProcessing = isProcessing;
          });
        },
        
        // Session actions
        initializeSession: () => {
          set((state) => {
            // Check localStorage for first-time status
            const hasVisited = localStorage.getItem('improv-today-visited');
            const storedUserName = sessionStorage.getItem('improv-today-username');
            
            if (hasVisited && storedUserName) {
              state.session.isFirstTime = false;
              state.session.userName = storedUserName;
              state.session.onboardingStep = 'complete';
            } else if (hasVisited) {
              state.session.isFirstTime = false;
              state.session.onboardingStep = 'complete';
            } else {
              state.session.isFirstTime = true;
              state.session.onboardingStep = 'welcome';
            }
            
            state.session.sessionStartTime = Date.now();
          });
        },
        
        setUserName: (name: string) => {
          set((state) => {
            state.session.userName = name;
            sessionStorage.setItem('improv-today-username', name);
          });
        },
        
        setPersonality: (personality: Personality) => {
          set((state) => {
            state.session.selectedPersonality = personality;
          });
        },
        
        setOnboardingStep: (step: OnboardingStep) => {
          set((state) => {
            state.session.onboardingStep = step;
          });
        },
        
        completeOnboarding: () => {
          set((state) => {
            state.session.onboardingStep = 'complete';
            state.session.isFirstTime = false;
            localStorage.setItem('improv-today-visited', 'true');
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
        
        setConversationId: (id: string) => {
          set((state) => {
            state.session.conversationId = id;
          });
        },
        
        // Backend session id setter
        setBackendSessionId: (id: number | null) => {
          set((state) => {
            state.session.backendSessionId = id;
          });
        },
        
        // UI actions
        setShowSettings: (show: boolean) => {
          set((state) => {
            state.ui.showSettings = show;
          });
        },
        
        setSelectedVoice: (voice: string) => {
          set((state) => {
            state.ui.selectedVoice = voice;
          });
        },
        
        setAvailableVoices: (voices: SpeechSynthesisVoice[]) => {
          set((state) => {
            state.ui.availableVoices = voices;
          });
        },
        
        setError: (error: string | null) => {
          set((state) => {
            state.ui.error = error;
            if (error && get().canTransitionTo(ConversationState.ERROR, 'FORCE_ERROR')) {
              get().transitionTo(ConversationState.ERROR, 'FORCE_ERROR');
            } else if (!error && state.currentState === ConversationState.ERROR) {
              get().transitionTo(ConversationState.IDLE, 'RESET_FROM_ERROR');
            }
          });
        },
        
        // High-level actions
        handleWaveformClick: () => {
          const state = get();
          const { currentState, session } = state;
          
          // Handle onboarding flow for first-time users
          if (session.isFirstTime && session.onboardingStep !== 'complete') {
            if (currentState === ConversationState.IDLE) {
              get().handleOnboardingFlow();
              return;
            }
          }
          
          // Handle different states
          switch (currentState) {
            case ConversationState.LISTENING:
              get().pauseListening();
              break;
              
            case ConversationState.PAUSED:
              get().resumeListening();
              break;
              
            case ConversationState.AI_SPEAKING:
              // Interrupt AI and start listening
              if (get().canTransitionTo(ConversationState.LISTENING, 'INTERRUPT_AI')) {
                get().transitionTo(ConversationState.LISTENING, 'INTERRUPT_AI');
              }
              break;
              
            case ConversationState.IDLE:
              if (!session.isFirstTime) {
                get().handleOnboardingFlow(); // For returning users
              } else {
                get().startListening();
              }
              break;
              
            default:
              // Try to force reset to idle
              if (get().canTransitionTo(ConversationState.IDLE, 'FORCE_RESET')) {
                get().transitionTo(ConversationState.IDLE, 'FORCE_RESET');
              }
              break;
          }
        },
        
        handleOnboardingFlow: () => {
          const state = get();
          // This will be called by components that handle the speech synthesis
          // The store just manages the state transitions
          get().startAISpeaking();
        },
        
        autoStartListening: () => {
          const state = get();
          if (!state.speech.isPaused && state.currentState !== ConversationState.LISTENING) {
            get().startListening();
          }
        },
        
        resetConversation: () => {
          set((state) => {
            // Force reset to idle
            get().transitionTo(ConversationState.IDLE, 'FORCE_RESET');
            
            // Clear all timers
            if (state.speech.silenceTimer) {
              clearTimeout(state.speech.silenceTimer);
              state.speech.silenceTimer = null;
            }
            
            // Clear transcript
            state.speech.transcript = '';
            state.speech.interimTranscript = '';
            
            // Clear error
            state.ui.error = null;
            
            // Keep session data and messages intact
          });
        },
      }))
    ),
    {
      name: 'conversation-store',
    }
  )
);

// ===== SELECTORS =====

// State selectors with proper stability
export const useCurrentState = () => useConversationStore(state => state.currentState);
export const useSpeechState = () => useConversationStore(state => state.speech);
export const useSessionData = () => useConversationStore(state => state.session);
export const useUIState = () => useConversationStore(state => state.ui);
export const useMessages = () => useConversationStore(state => state.messages);

// Computed selectors - using direct state comparison for better performance
export const useIsListening = () => useConversationStore(state => 
  state.currentState === ConversationState.LISTENING
);

export const useIsAISpeaking = () => useConversationStore(state => 
  state.currentState === ConversationState.AI_SPEAKING
);

export const useIsPaused = () => useConversationStore(state => 
  state.currentState === ConversationState.PAUSED
);

export const useIsProcessing = () => useConversationStore(state => 
  state.currentState === ConversationState.PROCESSING
);

export const useIsInError = () => useConversationStore(state => 
  state.currentState === ConversationState.ERROR
);

export const useCanStartConversation = () => useConversationStore(state => 
  state.currentState === ConversationState.IDLE
);

// Pre-computed conversation status objects to ensure referential stability
const conversationStatusCache = new Map<ConversationState, {
  currentState: ConversationState;
  isListening: boolean;
  isAISpeaking: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  isError: boolean;
  canStart: boolean;
}>();

// Initialize cache with all possible states
Object.values(ConversationState).forEach(state => {
  conversationStatusCache.set(state, {
    currentState: state,
    isListening: state === ConversationState.LISTENING,
    isAISpeaking: state === ConversationState.AI_SPEAKING,
    isPaused: state === ConversationState.PAUSED,
    isProcessing: state === ConversationState.PROCESSING,
    isError: state === ConversationState.ERROR,
    canStart: state === ConversationState.IDLE,
  });
});

// Stable selector that returns cached objects
const conversationStatusSelector = (state: ConversationStore) => {
  return conversationStatusCache.get(state.currentState)!;
};

export const useConversationStatus = () => useConversationStore(conversationStatusSelector);