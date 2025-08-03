'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import CircularWaveform from '@/components/WaveformVisual';
import { useConversation } from '@/hooks/useConversation';
import { Settings, X } from 'lucide-react';

type Personality = 'sassy' | 'blunt' | 'friendly';
type OnboardingStep = 'welcome' | 'name' | 'day' | 'complete';

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
  const [selectedPersonality, setSelectedPersonality] = useState<Personality>('friendly');
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('welcome');
  const [userName, setUserName] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastAIResponse, setLastAIResponse] = useState<string>('');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [browserSpeech, setBrowserSpeech] = useState<{
    speak: (text: string, options?: Record<string, unknown>, onEnd?: () => void, onError?: (error: string) => void) => void;
    startListening: (onResult: (result: { isFinal: boolean; transcript: string }) => void, onError: (error: string) => void) => void;
    stopListening: () => void;
    stopSpeaking: () => void;
    isAvailable: () => boolean;
    getVoices: () => SpeechSynthesisVoice[];
    setVoice: (voice: SpeechSynthesisVoice | null) => void;
  } | null>(null);
  
  const {
    messages,
    isProcessing,
    sendMessage,
    startSession,
  } = useConversation();

  // Check first-time user status and load user data
  useEffect(() => {
    // Check localStorage for first-time status
    const hasVisited = localStorage.getItem('improv-today-visited');
    const storedUserName = sessionStorage.getItem('improv-today-username');
    
    if (hasVisited && storedUserName) {
      setIsFirstTime(false);
      setUserName(storedUserName);
      setOnboardingStep('complete');
    } else if (hasVisited) {
      setIsFirstTime(false);
      setOnboardingStep('complete');
    } else {
      setIsFirstTime(true);
      setOnboardingStep('welcome');
    }
  }, []);

  // Load browser speech dynamically
  useEffect(() => {
    import('@/lib/speech').then(({ browserSpeech }) => {
      setBrowserSpeech(browserSpeech);
      
      // Load available voices
      const loadVoices = () => {
        // Force voice loading by calling getVoices multiple times
        let voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
          // Try again after a delay
          setTimeout(() => {
            voices = speechSynthesis.getVoices();
            processVoices(voices);
          }, 100);
        } else {
          processVoices(voices);
        }
      };

      const processVoices = (voices: SpeechSynthesisVoice[]) => {
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
        
        // Curate best quality voices from your available system voices
        const curatedVoices = englishVoices.filter(voice => {
          const voiceName = voice.name.toLowerCase();
          
          // Exclude novelty/fun voices that have poor quality
          const noveltyVoices = ['bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'jester', 'organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'good news'];
          const isNovelty = noveltyVoices.some(novelty => voiceName.includes(novelty));
          
          // Exclude obvious male voices
          const maleIndicators = ['arthur', 'daniel', 'rishi', 'aaron', 'albert', 'fred', 'gordon', 'grandpa', 'junior', 'ralph', 'reed', 'rocko', 'sylvester'];
          const isMale = maleIndicators.some(name => voiceName.includes(name));
          
          return !isNovelty && !isMale;
        });
        
        // Sort to prioritize best voices
        curatedVoices.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          
          // Prioritize Samantha (top quality)
          if (aName.includes('samantha')) return -1;
          if (bName.includes('samantha')) return 1;
          
          // Then UK voices
          if (a.lang.includes('GB') && !b.lang.includes('GB')) return -1;
          if (b.lang.includes('GB') && !a.lang.includes('GB')) return 1;
          
          // Then specific good voices
          const goodVoices = ['flo', 'martha', 'sandy', 'shelley', 'catherine', 'karen', 'moira', 'tessa'];
          const aIsGood = goodVoices.some(good => aName.includes(good));
          const bIsGood = goodVoices.some(good => bName.includes(good));
          
          if (aIsGood && !bIsGood) return -1;
          if (bIsGood && !aIsGood) return 1;
          
          return 0;
        });
        
        
        // Use curated voices if available, otherwise show top 10 English voices
        const voicesToUse = curatedVoices.length > 0 ? curatedVoices : englishVoices.slice(0, 10);
        setAvailableVoices(voicesToUse);
        
        // Set default voice - prioritize Samantha, then UK female voices
        let defaultVoice = voicesToUse.find(voice => 
          voice.name.toLowerCase().includes('samantha')
        );
        
        if (!defaultVoice) {
          // Look for UK female voices
          defaultVoice = voicesToUse.find(voice => 
            voice.lang.includes('GB') && 
            (voice.name.toLowerCase().includes('flo') || 
             voice.name.toLowerCase().includes('martha') ||
             voice.name.toLowerCase().includes('sandy') ||
             voice.name.toLowerCase().includes('shelley'))
          );
        }
        
        if (!defaultVoice && voicesToUse.length > 0) {
          defaultVoice = voicesToUse[0];
        }
        
        if (defaultVoice) {
          setSelectedVoice(defaultVoice.name);
          browserSpeech.setVoice(defaultVoice);
        }
      };
      
      // Load voices immediately
      loadVoices();
      
      // Also listen for voice loading event (some browsers load voices asynchronously)
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    });
  }, []);

  // Get appropriate message based on onboarding step
  const getOnboardingMessage = (step: OnboardingStep): string => {
    switch (step) {
      case 'welcome':
        return "Hello! What's your name?";
      case 'name':
        return `Nice to meet you, ${userName}! How was your day?`;
      case 'day':
        return "Great! What would you like to talk about today?";
      default:
        return userName ? `Hi ${userName}! What would you like to talk about today?` : "What would you like to talk about today?";
    }
  };

  const startListening = useCallback(() => {
    console.log('startListening called');
    if (!browserSpeech || !browserSpeech.isAvailable()) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    console.log('Starting speech recognition...');
    setIsListening(true);
    setIsPaused(false);
    setTranscript('');
    setInterimTranscript('');
    
    browserSpeech.startListening(
      (result: { isFinal: boolean; transcript: string; confidence?: number }) => {
        console.log('Speech recognition result:', { isFinal: result.isFinal, transcript: result.transcript });
        if (result.isFinal) {
          const finalTranscript = result.transcript.trim();
          console.log('Final transcript received:', finalTranscript);
          if (finalTranscript) {
            setTranscript(prev => {
              const newTranscript = prev ? prev + ' ' + finalTranscript : finalTranscript;
              console.log('Updated transcript state to:', newTranscript);
              return newTranscript;
            });
            setInterimTranscript('');
            
            // Start silence timer
            startSilenceTimer();
          }
        } else {
          clearSilenceTimer();
          setInterimTranscript(result.transcript);
        }
      },
      () => {
        setIsListening(false);
        clearSilenceTimer();
      }
    );
  }, [browserSpeech]);

  // Stable auto-start listening function
  const autoStartListening = useCallback(() => {
    console.log('autoStartListening called, isPaused:', isPaused, 'isListening:', isListening);
    if (!isPaused && !isListening) {
      console.log('Auto-starting listening...');
      startListening();
    }
  }, [isPaused, isListening, startListening]);

  // Handle onboarding flow
  const handleOnboardingStep = useCallback(() => {
    if (!browserSpeech) return;
    
    let message = '';
    
    if (isFirstTime) {
      message = getOnboardingMessage(onboardingStep);
      
      // Mark as visited after first interaction
      if (onboardingStep === 'welcome') {
        localStorage.setItem('improv-today-visited', 'true');
      }
    } else {
      // Returning user
      message = getOnboardingMessage('complete');
      startSession(undefined, true); // Skip backend welcome message
    }
    
    // Speak message
    setIsAISpeaking(true);
    
    const timeout = setTimeout(() => {
      setIsAISpeaking(false);
    }, 10000);
    
    browserSpeech.speak(
      message,
      {},
      () => {
        clearTimeout(timeout);
        setIsAISpeaking(false);
        // Auto-start listening after AI finishes speaking
        console.log('Onboarding AI finished speaking, auto-starting listening...');
        setTimeout(() => {
          autoStartListening();
        }, 500);
      },
      () => {
        clearTimeout(timeout);
        setIsAISpeaking(false);
        // Auto-start listening even on error
        console.log('Onboarding AI speech error, auto-starting listening...');
        setTimeout(() => {
          autoStartListening();
        }, 500);
      }
    );
  }, [browserSpeech, isFirstTime, onboardingStep, userName, autoStartListening, startSession]);

  // Monitor messages for new AI responses to trigger speech synthesis
  useEffect(() => {
    if (!browserSpeech || isAISpeaking) return; // Prevent multiple simultaneous speech
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content !== lastAIResponse) {
      setLastAIResponse(lastMessage.content);
      
      setIsAISpeaking(true);
      
      // Fallback timeout to reset speaking state (in case onEnd doesn't fire)
      const fallbackTimeout = setTimeout(() => {
        setIsAISpeaking(false);
        // Fallback auto-start listening if onEnd doesn't fire
        autoStartListening();
      }, Math.max(lastMessage.content.length * 150, 15000)); // Longer estimate, min 15 seconds
      
      browserSpeech.speak(
        lastMessage.content,
        {},
        () => {
          clearTimeout(fallbackTimeout);
          setIsAISpeaking(false);
          // Auto-start listening after AI response
          console.log('AI finished speaking, auto-starting listening...');
          setTimeout(() => {
            autoStartListening();
          }, 500);
        },
        () => {
          clearTimeout(fallbackTimeout);
          setIsAISpeaking(false);
          // Auto-start listening even on error
          console.log('AI speech error, auto-starting listening...');
          setTimeout(() => {
            autoStartListening();
          }, 500);
        }
      );
    }
  }, [messages, lastAIResponse, browserSpeech, isAISpeaking, autoStartListening]);

  const handleWaveformClick = () => {
    if (!browserSpeech) return;
    
    // Handle onboarding flow for first-time users
    if (isFirstTime && onboardingStep !== 'complete') {
      if (!isListening && !isAISpeaking) {
        handleOnboardingStep();
        return;
      }
    }
    
    // Pause/Continue functionality
    if (isListening) {
      // Pause listening
      setIsPaused(true);
      setIsListening(false);
      browserSpeech.stopListening();
      clearSilenceTimer();
    } else if (isPaused) {
      // Continue listening
      setIsPaused(false);
      startListening();
    } else if (isAISpeaking) {
      // Interrupt AI speaking and start listening
      browserSpeech.stopSpeaking();
      setIsAISpeaking(false);
      startListening();
    } else {
      // Start conversation (for returning users)
      if (!isFirstTime) {
        handleOnboardingStep();
      }
    }
  };

  const stopListening = () => {
    if (!browserSpeech) return;
    
    console.log('stopListening called, transcript:', transcript);
    setIsListening(false);
    setIsPaused(false);
    browserSpeech.stopListening();
    clearSilenceTimer();
    
    if (transcript.trim()) {
      console.log('Processing transcript:', transcript.trim());
      // Handle onboarding steps
      if (isFirstTime && onboardingStep !== 'complete') {
        console.log('Handling onboarding response');
        handleOnboardingResponse(transcript.trim());
      } else {
        console.log('Sending message to backend');
        // Normal conversation
        sendMessage(transcript, undefined, selectedPersonality);
      }
      setTranscript('');
      setInterimTranscript('');
    } else {
      console.log('No transcript to process');
    }
  };

  // Process onboarding responses
  const handleOnboardingResponse = (response: string) => {
    switch (onboardingStep) {
      case 'welcome':
        // User provided their name
        const name = response.trim();
        setUserName(name);
        sessionStorage.setItem('improv-today-username', name);
        setOnboardingStep('name');
        
        // Give AI a moment, then ask about their day
        setTimeout(() => {
          handleOnboardingStep();
        }, 1000);
        break;
        
      case 'name':
        // User told about their day, now start normal conversation
        setOnboardingStep('day');
        setIsFirstTime(false);
        
        // Start the actual session without welcome message, and send the day info as first message
        startSession(undefined, true);
        sendMessage(`My name is ${userName}. ${response}`, undefined, selectedPersonality);
        break;
        
      default:
        // Shouldn't reach here, but handle gracefully
        sendMessage(response, undefined, selectedPersonality);
        break;
    }
  };

  const startSilenceTimer = () => {
    console.log('Starting silence timer (3 seconds)...');
    clearSilenceTimer();
    const timer = setTimeout(() => {
      console.log('Silence timer triggered - stopping listening');
      stopListening();
    }, 3000); // 3 seconds of silence
    setSilenceTimer(timer);
  };

  const clearSilenceTimer = () => {
    if (silenceTimer) {
      console.log('Clearing silence timer');
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4 relative">
      {/* Settings Icon - Top Right */}
      <div className="absolute top-6 right-6">
        <Button
          onClick={() => setShowSettings(true)}
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
          isListening={isListening}
          isAISpeaking={isAISpeaking}
          onClick={handleWaveformClick}
          size={250}
          className="mb-4"
        />
        
        {/* Status - Fixed height to prevent layout shift */}
        <div className="text-center text-white h-24 flex flex-col justify-center">
          {isFirstTime && onboardingStep === 'welcome' && !isAISpeaking && !isListening && !isPaused && (
            <div>
              <p className="text-blue-300 mb-2">👋 Welcome to Improv.Today!</p>
              <p className="text-gray-400 text-sm">Tap the waveform to begin</p>
            </div>
          )}
          {isFirstTime && onboardingStep === 'name' && !isAISpeaking && !isListening && !isPaused && (
            <div>
              <p className="text-blue-300 mb-2">Tell me about your day</p>
              <p className="text-gray-400 text-sm">Listening will start automatically</p>
            </div>
          )}
          {isAISpeaking && (
            <p className="text-purple-300">AI is speaking... Tap to interrupt</p>
          )}
          {isListening && (
            <div className="max-w-md mx-auto">
              <p className="text-blue-300">
                {isFirstTime && onboardingStep === 'welcome' ? 'What\'s your name?' :
                 isFirstTime && onboardingStep === 'name' ? 'Tell me about your day' :
                 'Listening... Tap to pause'}
              </p>
              <div className="min-h-[2rem] mt-2">
                {(transcript || interimTranscript) && (
                  <p className="text-gray-300 text-sm italic break-words">
                    &quot;{transcript}{interimTranscript && ` ${interimTranscript}`}&quot;
                  </p>
                )}
              </div>
            </div>
          )}
          {isPaused && (
            <div>
              <p className="text-yellow-300">Paused</p>
              <p className="text-gray-400 text-sm">Tap to continue listening</p>
            </div>
          )}
          {!isListening && !isAISpeaking && !isFirstTime && !isPaused && (
            <p className="text-gray-400">Tap the waveform to start conversation</p>
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
              onClick={() => setSelectedPersonality(key as Personality)}
              variant={selectedPersonality === key ? "default" : "outline"}
              className={`h-auto p-4 text-left justify-start transition-all ${
                selectedPersonality === key 
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
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Voice & Settings</h2>
              <Button
                onClick={() => setShowSettings(false)}
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
                  value={selectedVoice}
                  onChange={(e) => {
                    setSelectedVoice(e.target.value);
                    const voice = availableVoices.find(v => v.name === e.target.value);
                    if (voice && browserSpeech) {
                      browserSpeech.setVoice(voice);
                    }
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {availableVoices.length === 0 ? (
                    <option>Loading voices...</option>
                  ) : (
                    availableVoices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Available voices: {availableVoices.length}
                </p>
              </div>

              {/* Voice Test */}
              <Button
                onClick={() => {
                  if (browserSpeech) {
                    browserSpeech.speak('Hello, this is a test of the selected voice.');
                  }
                }}
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
                    onClick={() => setSelectedPersonality(key as Personality)}
                    variant={selectedPersonality === key ? "default" : "outline"}
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
              onClick={() => setShowSettings(false)}
              className="w-full"
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="mt-4 flex items-center space-x-2 text-white">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          <span className="text-sm">Processing...</span>
        </div>
      )}
    </div>
  );
}