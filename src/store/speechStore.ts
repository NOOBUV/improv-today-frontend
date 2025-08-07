'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';

// ===== TYPES & INTERFACES =====

export interface SpeechSettings {
  selectedVoice: string;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  language: string;
}

export interface SpeechRecognitionSettings {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  silenceTimeout: number; // in milliseconds
}

export interface SpeechSynthesisState {
  isSupported: boolean;
  isAvailable: boolean;
  voices: SpeechSynthesisVoice[];
  currentVoice: SpeechSynthesisVoice | null;
  isSpeaking: boolean;
  isLoading: boolean;
  queue: string[];
}

export interface SpeechRecognitionState {
  isSupported: boolean;
  isAvailable: boolean;
  isActive: boolean;
  isListening: boolean;
  hasPermission: boolean;
  permissionState: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export interface SpeechError {
  type: 'recognition' | 'synthesis' | 'permission' | 'network';
  code: string;
  message: string;
  timestamp: Date;
}

// ===== STORE INTERFACE =====

export interface SpeechStore {
  // Settings
  settings: SpeechSettings;
  recognitionSettings: SpeechRecognitionSettings;
  
  // States
  synthesis: SpeechSynthesisState;
  recognition: SpeechRecognitionState;
  
  // Errors
  errors: SpeechError[];
  lastError: SpeechError | null;
  
  // Browser Speech Service Instance
  browserSpeech: any; // Will be set when loaded
  
  // Initialization
  initializeSpeech: () => Promise<void>;
  loadBrowserSpeech: () => Promise<void>;
  checkSupportAndPermissions: () => Promise<void>;
  
  // Voice management
  loadVoices: () => void;
  setVoice: (voice: SpeechSynthesisVoice | string) => void;
  setVoiceSettings: (settings: Partial<SpeechSettings>) => void;
  // Removed getRecommendedVoices method - now handled by selector
  
  // Speech synthesis control
  speak: (text: string, options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
  }) => void;
  stopSpeaking: () => void;
  pauseSpeaking: () => void;
  resumeSpeaking: () => void;
  clearSpeechQueue: () => void;
  
  // Speech recognition control
  requestMicrophonePermission: () => Promise<boolean>;
  startRecognition: (callbacks: {
    onResult?: (result: { transcript: string; isFinal: boolean; confidence?: number }) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
  }) => Promise<void>;
  stopRecognition: () => void;
  setRecognitionSettings: (settings: Partial<SpeechRecognitionSettings>) => void;
  
  // Error handling
  addError: (error: Omit<SpeechError, 'timestamp'>) => void;
  clearErrors: () => void;
  clearLastError: () => void;
  
  // Utility methods
  testVoice: (voice?: SpeechSynthesisVoice) => void;
  isFeatureSupported: (feature: 'recognition' | 'synthesis') => boolean;
  getDebugInfo: () => object;
}

// ===== DEFAULT VALUES =====

const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  selectedVoice: '',
  voiceRate: 0.9,
  voicePitch: 1.0,
  voiceVolume: 1.0,
  language: 'en-GB',
};

const DEFAULT_RECOGNITION_SETTINGS: SpeechRecognitionSettings = {
  language: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  silenceTimeout: 3000,
};

// ===== STORE IMPLEMENTATION =====

export const useSpeechStore = create<SpeechStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      settings: DEFAULT_SPEECH_SETTINGS,
      recognitionSettings: DEFAULT_RECOGNITION_SETTINGS,
      
      synthesis: {
        isSupported: false,
        isAvailable: false,
        voices: [],
        currentVoice: null,
        isSpeaking: false,
        isLoading: false,
        queue: [],
      },
      
      recognition: {
        isSupported: false,
        isAvailable: false,
        isActive: false,
        isListening: false,
        hasPermission: false,
        permissionState: 'unknown',
      },
      
      errors: [],
      lastError: null,
      browserSpeech: null,
      
      // Initialization methods
      initializeSpeech: async () => {
        await get().loadBrowserSpeech();
        await get().checkSupportAndPermissions();
        get().loadVoices();
      },
      
      loadBrowserSpeech: async () => {
        try {
          const { browserSpeech } = await import('@/lib/speech');
          set((state) => {
            state.browserSpeech = browserSpeech;
          });
        } catch (err) {
          get().addError({
            type: 'synthesis',
            code: 'IMPORT_ERROR',
            message: `Failed to load speech library: ${err}`,
          });
        }
      },
      
      checkSupportAndPermissions: async () => {
        set((state) => {
          // Check speech synthesis support
          state.synthesis.isSupported = 'speechSynthesis' in window;
          state.synthesis.isAvailable = state.synthesis.isSupported;
          
          // Check speech recognition support
          state.recognition.isSupported = 
            'SpeechRecognition' in window || 
            'webkitSpeechRecognition' in window;
          
          if (state.browserSpeech) {
            state.recognition.isAvailable = (state.browserSpeech as any).isAvailable();
          }
        });
        
        // Check microphone permission
        if (get().recognition.isSupported) {
          try {
            const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            set((state) => {
              state.recognition.permissionState = permission.state;
              state.recognition.hasPermission = permission.state === 'granted';
            });
            
            // Listen for permission changes
            permission.onchange = () => {
              set((state) => {
                state.recognition.permissionState = permission.state;
                state.recognition.hasPermission = permission.state === 'granted';
              });
            };
          } catch (error) {
            console.warn('Could not query microphone permission:', error);
          }
        }
      },
      
      // Voice management
      loadVoices: () => {
        if (!get().synthesis.isSupported) return;
        
        const loadVoicesImpl = () => {
          const voices = speechSynthesis.getVoices();
          set((state) => {
            state.synthesis.voices = voices;
            
            // Auto-select best voice if none selected
            if (!state.settings.selectedVoice && voices.length > 0) {
              const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
              if (englishVoices.length > 0) {
                // Prefer UK voices for the app
                const ukVoice = englishVoices.find(voice => 
                  voice.lang.includes('GB') || voice.name.toLowerCase().includes('samantha')
                );
                const selectedVoice = ukVoice || englishVoices[0];
                state.settings.selectedVoice = selectedVoice.name;
                state.synthesis.currentVoice = selectedVoice;
              }
            }
          });
        };
        
        // Load voices immediately
        loadVoicesImpl();
        
        // Also listen for voice loading event
        if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = loadVoicesImpl;
        }
      },
      
      setVoice: (voice: SpeechSynthesisVoice | string) => {
        set((state) => {
          if (typeof voice === 'string') {
            const foundVoice = state.synthesis.voices.find(v => v.name === voice);
            if (foundVoice) {
              state.settings.selectedVoice = voice;
              state.synthesis.currentVoice = foundVoice;
              
              // Update browser speech service
              if (state.browserSpeech) {
                (state.browserSpeech as any).setVoice(foundVoice);
              }
            }
          } else {
            state.settings.selectedVoice = voice.name;
            state.synthesis.currentVoice = voice;
            
            // Update browser speech service
            if (state.browserSpeech) {
              (state.browserSpeech as any).setVoice(voice);
            }
          }
        });
      },
      
      setVoiceSettings: (settings: Partial<SpeechSettings>) => {
        set((state) => {
          Object.assign(state.settings, settings);
        });
      },
      
      // Removed getRecommendedVoices method - now handled by selector to avoid method calls in selectors
      
      // Speech synthesis control
      speak: (text: string, options = {}) => {
        const { browserSpeech } = get();
        if (!browserSpeech) {
          get().addError({
            type: 'synthesis',
            code: 'NOT_INITIALIZED',
            message: 'Speech service not initialized',
          });
          return;
        }
        
        set((state) => {
          state.synthesis.isSpeaking = true;
        });
        
        (browserSpeech as any).speak(
          text,
          {
            voice: get().synthesis.currentVoice,
            rate: get().settings.voiceRate,
            pitch: get().settings.voicePitch,
            volume: get().settings.voiceVolume,
          },
          () => {
            set((state) => {
              state.synthesis.isSpeaking = false;
            });
            options.onEnd?.();
          },
          (error: string) => {
            set((state) => {
              state.synthesis.isSpeaking = false;
            });
            get().addError({
              type: 'synthesis',
              code: 'SPEECH_ERROR',
              message: error,
            });
            options.onError?.(error);
          }
        );
        
        options.onStart?.();
      },
      
      stopSpeaking: () => {
        const { browserSpeech } = get();
        if (browserSpeech) {
          (browserSpeech as any).stopSpeaking();
        }
        set((state) => {
          state.synthesis.isSpeaking = false;
          state.synthesis.queue = [];
        });
      },
      
      pauseSpeaking: () => {
        if (speechSynthesis.pause) {
          speechSynthesis.pause();
        }
      },
      
      resumeSpeaking: () => {
        if (speechSynthesis.resume) {
          speechSynthesis.resume();
        }
      },
      
      clearSpeechQueue: () => {
        set((state) => {
          state.synthesis.queue = [];
        });
      },
      
      // Speech recognition control
      requestMicrophonePermission: async () => {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          set((state) => {
            state.recognition.hasPermission = true;
            state.recognition.permissionState = 'granted';
          });
          return true;
        } catch (error) {
          set((state) => {
            state.recognition.hasPermission = false;
            state.recognition.permissionState = 'denied';
          });
          get().addError({
            type: 'permission',
            code: 'MIC_DENIED',
            message: 'Microphone permission denied',
          });
          return false;
        }
      },
      
      startRecognition: async (callbacks = {}) => {
        const { browserSpeech, recognition } = get();
        
        if (!browserSpeech) {
          get().addError({
            type: 'recognition',
            code: 'NOT_INITIALIZED',
            message: 'Speech service not initialized',
          });
          return;
        }
        
        if (!recognition.hasPermission) {
          const granted = await get().requestMicrophonePermission();
          if (!granted) return;
        }
        
        set((state) => {
          state.recognition.isActive = true;
          state.recognition.isListening = true;
        });
        
        (browserSpeech as any).startListening(
          (result: { transcript: string; isFinal: boolean; confidence?: number }) => {
            callbacks.onResult?.(result);
          },
          (error: string) => {
            set((state) => {
              state.recognition.isActive = false;
              state.recognition.isListening = false;
            });
            get().addError({
              type: 'recognition',
              code: 'RECOGNITION_ERROR',
              message: error,
            });
            callbacks.onError?.(error);
          }
        );
        
        callbacks.onStart?.();
      },
      
      stopRecognition: () => {
        const { browserSpeech } = get();
        if (browserSpeech) {
          (browserSpeech as any).stopListening();
        }
        set((state) => {
          state.recognition.isActive = false;
          state.recognition.isListening = false;
        });
      },
      
      setRecognitionSettings: (settings: Partial<SpeechRecognitionSettings>) => {
        set((state) => {
          Object.assign(state.recognitionSettings, settings);
        });
      },
      
      // Error handling
      addError: (error: Omit<SpeechError, 'timestamp'>) => {
        set((state) => {
          const newError: SpeechError = {
            ...error,
            timestamp: new Date(),
          };
          state.errors.push(newError);
          state.lastError = newError;
          
          // Keep only last 10 errors
          if (state.errors.length > 10) {
            state.errors = state.errors.slice(-10);
          }
        });
      },
      
      clearErrors: () => {
        set((state) => {
          state.errors = [];
          state.lastError = null;
        });
      },
      
      clearLastError: () => {
        set((state) => {
          state.lastError = null;
        });
      },
      
      // Utility methods
      testVoice: (voice?: SpeechSynthesisVoice) => {
        const testText = 'Hello, this is a test of the selected voice.';
        const voiceToTest = voice || get().synthesis.currentVoice;
        
        if (voiceToTest) {
          get().speak(testText);
        } else {
          get().speak(testText);
        }
      },
      
      isFeatureSupported: (feature: 'recognition' | 'synthesis') => {
        const state = get();
        return feature === 'recognition' 
          ? state.recognition.isSupported 
          : state.synthesis.isSupported;
      },
      
      getDebugInfo: () => {
        const state = get();
        return {
          synthesis: {
            isSupported: state.synthesis.isSupported,
            isAvailable: state.synthesis.isAvailable,
            voiceCount: state.synthesis.voices.length,
            currentVoice: state.synthesis.currentVoice?.name,
            isSpeaking: state.synthesis.isSpeaking,
          },
          recognition: {
            isSupported: state.recognition.isSupported,
            isAvailable: state.recognition.isAvailable,
            hasPermission: state.recognition.hasPermission,
            permissionState: state.recognition.permissionState,
            isListening: state.recognition.isListening,
          },
          settings: state.settings,
          errorCount: state.errors.length,
          lastError: state.lastError?.message,
        };
      },
    })),
    {
      name: 'speech-store',
    }
  )
);

// ===== SELECTORS =====

export const useSpeechSettings = () => useSpeechStore(state => state.settings);
export const useSynthesisState = () => useSpeechStore(state => state.synthesis);
export const useRecognitionState = () => useSpeechStore(state => state.recognition);
export const useSpeechErrors = () => useSpeechStore(state => state.errors);
export const useLastSpeechError = () => useSpeechStore(state => state.lastError);

// Computed selectors
export const useIsSpeechReady = () => useSpeechStore(state => 
  state.synthesis.isAvailable && state.recognition.isAvailable && !!state.browserSpeech
);

export const useCanUseSpeech = () => useSpeechStore(state => 
  state.synthesis.isSupported && state.recognition.isSupported
);

// Voice options selector - split to avoid method calls in selector
export const useVoices = () => useSpeechStore(state => state.synthesis.voices);
export const useCurrentVoice = () => useSpeechStore(state => state.synthesis.currentVoice);
export const useSelectedVoice = () => useSpeechStore(state => state.settings.selectedVoice);

// Memoized recommended voices cache to prevent infinite loops
let cachedVoices: SpeechSynthesisVoice[] = [];
let cachedRecommendedVoices: SpeechSynthesisVoice[] = [];

const getRecommendedVoices = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] => {
  // Use cached result if voices haven't changed
  if (cachedVoices === voices || (cachedVoices.length === voices.length && 
      cachedVoices.every((voice, index) => voice === voices[index]))) {
    return cachedRecommendedVoices;
  }
  
  // Only calculate if voices are available to avoid unnecessary calculations
  if (voices.length === 0) {
    cachedVoices = voices;
    cachedRecommendedVoices = [];
    return cachedRecommendedVoices;
  }
  
  const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
  
  // Filter for high-quality voices
  const qualityVoices = englishVoices.filter(voice => {
    const name = voice.name.toLowerCase();
    
    // Exclude novelty voices
    const noveltyIndicators = ['bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'jester', 'organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'good news'];
    const isNovelty = noveltyIndicators.some(indicator => name.includes(indicator));
    
    // Exclude obvious male voices
    const maleIndicators = ['arthur', 'daniel', 'rishi', 'aaron', 'albert', 'fred', 'gordon', 'grandpa', 'junior', 'ralph', 'reed', 'rocko', 'sylvester'];
    const isMale = maleIndicators.some(indicator => name.includes(indicator));
    
    return !isNovelty && !isMale;
  });
  
  // Sort by quality and preference
  const result = qualityVoices.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    
    // Prioritize Samantha
    if (aName.includes('samantha')) return -1;
    if (bName.includes('samantha')) return 1;
    
    // Then UK voices
    if (a.lang.includes('GB') && !b.lang.includes('GB')) return -1;
    if (b.lang.includes('GB') && !a.lang.includes('GB')) return 1;
    
    // Then high-quality voices
    const qualityIndicators = ['google', 'microsoft', 'neural', 'premium'];
    const aIsQuality = qualityIndicators.some(indicator => aName.includes(indicator));
    const bIsQuality = qualityIndicators.some(indicator => bName.includes(indicator));
    
    if (aIsQuality && !bIsQuality) return -1;
    if (bIsQuality && !aIsQuality) return 1;
    
    return 0;
  });
  
  // Cache the result
  cachedVoices = voices;
  cachedRecommendedVoices = result;
  return result;
};

// Cached selector to prevent infinite loops in useSyncExternalStore
const recommendedVoicesSelector = (state: SpeechStore): SpeechSynthesisVoice[] => {
  return getRecommendedVoices(state.synthesis.voices);
};

export const useRecommendedVoices = () => {
  return useSpeechStore(recommendedVoicesSelector);
};

// Cached voice options to prevent infinite loops
let cachedVoiceOptions: {
  voices: SpeechSynthesisVoice[];
  recommended: SpeechSynthesisVoice[];
  current: SpeechSynthesisVoice | null;
  selected: string;
} | null = null;

// Voice options selector that returns a stable object
const voiceOptionsSelector = (state: SpeechStore) => {
  const voices = state.synthesis.voices;
  const current = state.synthesis.currentVoice;
  const selected = state.settings.selectedVoice;
  const recommended = getRecommendedVoices(voices);
  
  // Return cached result if nothing has changed
  if (cachedVoiceOptions && 
      cachedVoiceOptions.voices === voices &&
      cachedVoiceOptions.current === current &&
      cachedVoiceOptions.selected === selected &&
      cachedVoiceOptions.recommended === recommended) {
    return cachedVoiceOptions;
  }
  
  // Create new cached result
  cachedVoiceOptions = {
    voices,
    recommended,
    current,
    selected,
  };
  
  return cachedVoiceOptions;
};

export const useVoiceOptions = () => {
  return useSpeechStore(voiceOptionsSelector);
};