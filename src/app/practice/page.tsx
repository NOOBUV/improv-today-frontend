'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import CircularWaveform from '@/components/WaveformVisual';
import { Settings, X } from 'lucide-react';

// Store imports
import {
  useConversationStore,
  useConversationStatus,
  useSessionData,
  useUIState,
  useSpeechState,
  useMessages,
  ConversationState,
  type Personality,
} from '@/store/conversationStore';
import {
  useSpeechStore,
  useVoiceOptions,
  useIsSpeechReady,
} from '@/store/speechStore';
import {
  useUIStore,
  useNotifications,
  useModal,
} from '@/store/uiStore';

// Hook imports
import { useConversationWithStores } from '@/hooks/useWebSocketIntegration';
import { useSpeechCoordinator } from '@/hooks/useSpeechCoordinator';

const personalities = {
  sassy: {
    name: 'Sassy English',
    description: 'Witty, charming British accent',
    prompt: 'You are a witty, sassy English conversation partner with a charming British accent in your responses. Be playful, slightly cheeky, but encouraging.',
    color: 'from-purple-500 to-pink-500'
  },
  blunt: {
    name: 'Blunt American', 
    description: 'Direct, no-nonsense American',
    prompt: 'You are a direct, no-nonsense American conversation partner. Be straightforward, honest, and practical in your responses while remaining supportive.',
    color: 'from-red-500 to-orange-500'
  },
  friendly: {
    name: 'Friendly Neutral',
    description: 'Warm, encouraging, patient',
    prompt: 'You are a warm, encouraging conversation partner. Be supportive, patient, and genuinely interested in the conversation.',
    color: 'from-blue-500 to-green-500'
  }
};

export default function PracticePage() {
  // Store hooks
  const conversationStore = useConversationStore();
  const speechStore = useSpeechStore();
  const uiStore = useUIStore();
  
  // Store selectors - memoized to prevent unnecessary re-renders
  const conversationStatus = useConversationStatus();
  const sessionData = useSessionData();
  const uiState = useUIState();
  const speechState = useSpeechState();
  const messages = useMessages();
  const voiceOptions = useVoiceOptions();
  const isSpeechReady = useIsSpeechReady();
  const notifications = useNotifications();
  const modal = useModal();
  
  // Memoize derived values to prevent recalculation
  const isFirstTimeWelcome = useMemo(() => {
    return sessionData?.isFirstTime && sessionData?.onboardingStep === 'welcome' && conversationStatus?.canStart;
  }, [sessionData?.isFirstTime, sessionData?.onboardingStep, conversationStatus?.canStart]);
  
  const isFirstTimeName = useMemo(() => {
    return sessionData?.isFirstTime && sessionData?.onboardingStep === 'name' && conversationStatus?.canStart;
  }, [sessionData?.isFirstTime, sessionData?.onboardingStep, conversationStatus?.canStart]);
  
  // Enhanced conversation hook with stores
  const { sendMessage, startSession } = useConversationWithStores();
  
  // Speech coordinator with mutex protection
  const speechCoordinator = useSpeechCoordinator({
    autoInitialize: true,
    debugMode: process.env.NODE_ENV === 'development',
  });

  // Initialize stores on mount - only run once
  useEffect(() => {
    conversationStore.initializeSession();
    speechStore.initializeSpeech();
  }, []); // Empty dependency array to run only once on mount

  // Get onboarding message based on step
  const getOnboardingMessage = useCallback((step: string): string => {
    switch (step) {
      case 'welcome':
        return "Hello! What's your name?";
      case 'name':
        return `Nice to meet you, ${sessionData?.userName}! How was your day?`;
      case 'day':
        return "Great! What would you like to talk about today?";
      default:
        return sessionData?.userName 
          ? `Hi ${sessionData.userName}! What would you like to talk about today?` 
          : "What would you like to talk about today?";
    }
  }, [sessionData?.userName]);

  // Define functions in dependency order to avoid circular references
  
  // First, define the simplest functions with no internal dependencies
  const clearSilenceTimer = useCallback(() => {
    if (speechState.silenceTimer) {
      console.log('Clearing silence timer');
      clearTimeout(speechState.silenceTimer);
      conversationStore.setSilenceTimer(null);
    }
  }, [speechState.silenceTimer, conversationStore]);

  // Define startListening first
  const startListening = useCallback(async () => {
    console.log('startListening called');
    
    if (!speechCoordinator.isReady) {
      uiStore.addNotification({
        type: 'error',
        title: 'Speech Not Available',
        message: 'Speech recognition is not supported in your browser. Please use Chrome or Edge.',
        duration: 5000,
      });
      return;
    }

    console.log('Starting speech recognition with mutex...');
    
    try {
      await speechCoordinator.startListening({
        onResult: (result) => {
          console.log('Speech recognition result:', result);
          if (result.isFinal) {
            const finalTranscript = result.transcript.trim();
            console.log('Final transcript received:', finalTranscript);
            if (finalTranscript) {
              conversationStore.updateTranscript(finalTranscript);
              // Call startSilenceTimer directly to avoid dependency issues
              console.log('Starting silence timer (3 seconds)...');
              
              // Clear existing timer first
              const currentTimer = conversationStore.speech.silenceTimer;
              if (currentTimer) {
                clearTimeout(currentTimer);
              }
              
              const timer = setTimeout(() => {
                console.log('Silence timer triggered - stopping listening');
                console.log('Current transcript in store:', conversationStore.speech.transcript);
                
                // Stop listening using coordinator to ensure proper mutex handling
                speechCoordinator.stopListening();
                
                // Also transition the store state to IDLE
                conversationStore.stopListening();
                
                const currentTranscript = conversationStore.speech.transcript.trim();
                console.log('Trimmed transcript:', currentTranscript, 'length:', currentTranscript.length);
                
                if (currentTranscript) {
                  console.log('Processing transcript:', currentTranscript);
                  
                  // Handle onboarding or normal conversation
                  if (conversationStore.session.isFirstTime && conversationStore.session.onboardingStep !== 'complete') {
                    console.log('Handling onboarding response');
                    // Handle onboarding response inline
                    switch (conversationStore.session.onboardingStep) {
                      case 'welcome':
                        // User provided their name
                        const name = currentTranscript.trim();
                        conversationStore.setUserName(name);
                        conversationStore.setOnboardingStep('name');
                        
                        // Give AI a moment, then ask about their day
                        setTimeout(async () => {
                          if (!speechCoordinator.isReady) return;
                          
                          const message = getOnboardingMessage('name');
                          
                          try {
                            await speechCoordinator.speak(message, undefined, {
                              onEnd: () => {
                                console.log('Onboarding AI finished speaking, auto-starting listening...');
                                setTimeout(() => {
                                  if (!speechState.isPaused && !conversationStatus.isListening) {
                                    startListening();
                                  }
                                }, 500);
                              },
                            }, 'high');
                          } catch (error) {
                            console.error('Failed to speak onboarding message:', error);
                          }
                        }, 1000);
                        break;
                        
                      case 'name':
                        // User told about their day, now start normal conversation
                        conversationStore.setOnboardingStep('day');
                        conversationStore.completeOnboarding();
                        
                        // Start the actual session without welcome message, and send the day info as first message
                        startSession(undefined, true);
                        sendMessage(`My name is ${conversationStore.session.userName}. ${currentTranscript}`, undefined, conversationStore.session.selectedPersonality);
                        break;
                        
                      default:
                        // Shouldn't reach here, but handle gracefully
                        sendMessage(currentTranscript, undefined, conversationStore.session.selectedPersonality);
                        break;
                    }
                  } else {
                    console.log('Sending message to backend');
                    sendMessage(currentTranscript, undefined, conversationStore.session.selectedPersonality);
                  }
                  
                  conversationStore.clearTranscript();
                }
              }, 3000); // 3 seconds of silence
              
              conversationStore.setSilenceTimer(timer);
            }
          } else {
            conversationStore.updateTranscript(result.transcript, true);
            clearSilenceTimer();
          }
        },
        onError: (error) => {
          console.error('Speech recognition error:', error);
          conversationStore.setError(`Speech recognition error: ${error}`);
          clearSilenceTimer();
        },
        onStart: () => {
          console.log('Speech recognition started');
        },
        onEnd: () => {
          console.log('Speech recognition ended');
        },
      }, 'high'); // High priority for user speech
    } catch (error) {
      console.error('Failed to start listening:', error);
      uiStore.addNotification({
        type: 'error',
        title: 'Speech Error',
        message: error instanceof Error ? error.message : 'Failed to start listening',
        duration: 3000,
      });
    }
  }, [speechCoordinator, conversationStore, uiStore, clearSilenceTimer, speechState.isPaused, conversationStatus.isListening, getOnboardingMessage, startSession, sendMessage]);

  // Define autoStartListening that uses startListening
  const autoStartListening = useCallback(() => {
    console.log('autoStartListening called', { 
      isPaused: speechState.isPaused, 
      isListening: conversationStatus.isListening 
    });
    
    if (!speechState.isPaused && !conversationStatus.isListening) {
      console.log('Auto-starting listening...');
      startListening();
    }
  }, [speechState.isPaused, conversationStatus.isListening, startListening]);

  // Handle onboarding flow with mutex protection - defined after dependencies
  const handleOnboardingStep = useCallback(async () => {
    if (!speechCoordinator.isReady) return;
    
    let message = '';
    
    if (sessionData?.isFirstTime) {
      message = getOnboardingMessage(sessionData.onboardingStep);
      
      // Mark as visited after first interaction
      if (sessionData.onboardingStep === 'welcome') {
        localStorage.setItem('improv-today-visited', 'true');
      }
    } else {
      // Returning user
      message = getOnboardingMessage('complete');
      startSession(undefined, true); // Skip backend welcome message
    }
    
    // Use speech coordinator with mutex protection
    try {
      await speechCoordinator.speak(message, undefined, {
        onStart: () => {
          console.log('Onboarding AI started speaking');
        },
        onEnd: () => {
          console.log('Onboarding AI finished speaking, auto-starting listening...');
          setTimeout(() => {
            autoStartListening();
          }, 500);
        },
        onError: (error) => {
          console.log('Onboarding AI speech error, auto-starting listening...');
          uiStore.addNotification({
            type: 'error',
            title: 'Speech Error',
            message: `Failed to speak: ${error}`,
            duration: 3000,
          });
          setTimeout(() => {
            autoStartListening();
          }, 500);
        },
      }, 'high'); // High priority for onboarding
    } catch (error) {
      console.error('Failed to speak onboarding message:', error);
      uiStore.addNotification({
        type: 'error',
        title: 'Speech Error',
        message: error instanceof Error ? error.message : 'Failed to speak',
        duration: 3000,
      });
      // Still try to auto-start listening
      setTimeout(() => {
        autoStartListening();
      }, 500);
    }
  }, [speechCoordinator, sessionData, getOnboardingMessage, startSession, uiStore, autoStartListening]);

  // Monitor messages for new AI responses to trigger speech synthesis
  useEffect(() => {
    if (!isSpeechReady || conversationStatus.isAISpeaking) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      // The speech synthesis is handled by the WebSocket integration hook
      // or the conversation hook, so we don't need to duplicate it here
      console.log('New AI message received:', lastMessage.content);
    }
  }, [messages, isSpeechReady, conversationStatus.isAISpeaking]);

  // Handle waveform click with state machine
  const handleWaveformClick = useCallback(() => {
    console.log('Waveform clicked, current state:', conversationStatus.currentState);
    console.log('IsAISpeaking before click:', conversationStatus.isAISpeaking);
    
    const state = conversationStore;
    const { currentState, session } = conversationStore;
    
    // Handle onboarding flow for first-time users
    if (session.isFirstTime && session.onboardingStep !== 'complete') {
      if (currentState === ConversationState.IDLE) {
        handleOnboardingStep();
        return;
      }
    }
    
    // Handle different states
    switch (currentState) {
      case ConversationState.LISTENING:
        conversationStore.pauseListening();
        break;
        
      case ConversationState.PAUSED:
        conversationStore.resumeListening();
        break;
        
      case ConversationState.AI_SPEAKING:
        // Interrupt AI and start listening
        if (conversationStore.canTransitionTo(ConversationState.LISTENING, 'INTERRUPT_AI')) {
          conversationStore.transitionTo(ConversationState.LISTENING, 'INTERRUPT_AI');
        }
        break;
        
      case ConversationState.IDLE:
        if (!session.isFirstTime) {
          handleOnboardingStep(); // For returning users
        } else {
          conversationStore.startListening();
        }
        break;
        
      default:
        // Try to force reset to idle
        if (conversationStore.canTransitionTo(ConversationState.IDLE, 'FORCE_RESET')) {
          conversationStore.transitionTo(ConversationState.IDLE, 'FORCE_RESET');
        }
        break;
    }
  }, [conversationStore, conversationStatus, handleOnboardingStep]);

  // Functions are now defined earlier to resolve dependency order

  // Handle voice selection
  const handleVoiceChange = useCallback((voiceName: string) => {
    const voice = voiceOptions.voices.find(v => v.name === voiceName);
    if (voice) {
      speechStore.setVoice(voice);
    }
  }, [voiceOptions.voices, speechStore]);

  // Test selected voice
  const testVoice = useCallback(() => {
    speechStore.testVoice();
  }, [speechStore]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4 relative">
      {/* Settings Icon - Top Right */}
      <div className="absolute top-6 right-6">
        <Button
          onClick={() => uiStore.openModal({ type: 'settings', title: 'Voice & Settings' })}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20 p-3"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
          Improv.Today
        </h1>
        <p className="text-gray-300 text-lg">
          Your AI conversation partner
        </p>
      </div>

      {/* Main Circular Waveform */}
      <div className="mb-8">
        <CircularWaveform
          isListening={conversationStatus.isListening}
          isAISpeaking={conversationStatus.isAISpeaking}
          onClick={handleWaveformClick}
          size={250}
          className="mb-4"
        />
        
        {/* Status - Fixed height to prevent layout shift */}
        <div className="text-center text-white h-24 flex flex-col justify-center">
          {isFirstTimeWelcome && (
            <div>
              <p className="text-blue-300 mb-2">👋 Welcome to Improv.Today!</p>
              <p className="text-gray-400 text-sm">Tap the waveform to begin</p>
            </div>
          )}
          {isFirstTimeName && (
            <div>
              <p className="text-blue-300 mb-2">Tell me about your day</p>
              <p className="text-gray-400 text-sm">Listening will start automatically</p>
            </div>
          )}
          {conversationStatus.isAISpeaking && (
            <p className="text-purple-300">AI is speaking... Tap to interrupt</p>
          )}
          {conversationStatus.isListening && (
            <div className="max-w-md mx-auto">
              <p className="text-blue-300">
                {sessionData.isFirstTime && sessionData.onboardingStep === 'welcome' ? 'What\'s your name?' :
                 sessionData.isFirstTime && sessionData.onboardingStep === 'name' ? 'Tell me about your day' :
                 'Listening... Tap to pause'}
              </p>
              <div className="min-h-[2rem] mt-2">
                {(speechState.transcript || speechState.interimTranscript) && (
                  <p className="text-gray-300 text-sm italic break-words">
                    &quot;{speechState.transcript}{speechState.interimTranscript && ` ${speechState.interimTranscript}`}&quot;
                  </p>
                )}
              </div>
            </div>
          )}
          {conversationStatus.isPaused && (
            <div>
              <p className="text-yellow-300">Paused</p>
              <p className="text-gray-400 text-sm">Tap to continue listening</p>
            </div>
          )}
          {conversationStatus.canStart && !sessionData.isFirstTime && (
            <p className="text-gray-400">Tap the waveform to start conversation</p>
          )}
          {conversationStatus.isError && uiState.error && (
            <div>
              <p className="text-red-300">Error occurred</p>
              <p className="text-gray-400 text-sm">{uiState.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Personality Selector */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 max-w-md w-full">
        <div className="mb-4">
          <h3 className="text-white text-lg font-semibold text-center">
            Choose Personality
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {Object.entries(personalities).map(([key, personality]) => (
            <Button
              key={key}
              onClick={() => conversationStore.setPersonality(key as Personality)}
              variant={sessionData.selectedPersonality === key ? "default" : "outline"}
              className={`h-auto p-4 text-left justify-start transition-all ${
                sessionData.selectedPersonality === key 
                  ? `bg-gradient-to-r ${personality.color} text-white hover:opacity-90`
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              <div>
                <div className="font-medium">{personality.name}</div>
                <div className="text-xs opacity-80 mt-1">
                  {personality.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Settings Modal */}
      {modal.isOpen && modal.type === 'settings' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Voice & Settings</h2>
              <Button
                onClick={() => uiStore.closeModal()}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Voice Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Voice Selection</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Choose Voice:</label>
                <select
                  value={voiceOptions.selected}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {voiceOptions.voices.length === 0 ? (
                    <option>Loading voices...</option>
                  ) : (
                    voiceOptions.voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Available voices: {voiceOptions.voices.length}
                </p>
              </div>

              {/* Voice Test */}
              <Button
                onClick={testVoice}
                className="mt-3 w-full"
                variant="outline"
              >
                Test Voice
              </Button>
            </div>

            {/* Personality Settings */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Personality</h3>
              <div className="space-y-3">
                {Object.entries(personalities).map(([key, personality]) => (
                  <Button
                    key={key}
                    onClick={() => conversationStore.setPersonality(key as Personality)}
                    variant={sessionData.selectedPersonality === key ? "default" : "outline"}
                    className="w-full text-left justify-start h-auto p-3"
                  >
                    <div className="w-full">
                      <div className="font-medium text-sm">{personality.name}</div>
                      <div className="text-xs opacity-70 mt-1 text-left">
                        {personality.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Close Button */}
            <Button
              onClick={() => uiStore.closeModal()}
              className="w-full"
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {conversationStatus.isProcessing && (
        <div className="mt-4 flex items-center space-x-2 text-white">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          <span className="text-sm">Processing...</span>
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.slice(-3).map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg shadow-lg max-w-sm ${
                notification.type === 'error' ? 'bg-red-500 text-white' :
                notification.type === 'warning' ? 'bg-yellow-500 text-white' :
                notification.type === 'success' ? 'bg-green-500 text-white' :
                'bg-blue-500 text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">{notification.title}</h4>
                  <p className="text-sm">{notification.message}</p>
                </div>
                <button
                  onClick={() => uiStore.removeNotification(notification.id)}
                  className="ml-2 text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}