'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  useClaraStore,
  useClaraConversationState,
  useClaraMessages,
  useClaraSessionState
} from '@/store/claraStore';
import { useShallow } from 'zustand/react/shallow';
import { SpeechInterface } from '@/components/shared/SpeechInterface';
import { EmotionalBackdrop, type EmotionalMood } from '@/components/clara/EmotionalBackdrop';
import { VoiceWaveform } from '@/components/clara/VoiceWaveform';
import { Auth } from '@/components/shared/Auth';
import { useAuth } from '@/components/shared/AuthProvider';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSentimentAnalysis } from '@/hooks/useSentimentAnalysis';
import { sentimentToMoodMapping, HEARTBEAT_BPM_CONFIGS } from '@/utils/heartbeat-utils';
import { HeartbeatIcon } from '@/components/clara/HeartbeatIcon';
import { HeartbeatAudio } from '@/components/clara/HeartbeatAudio';
import { HeartbeatControls } from '@/components/clara/HeartbeatControls';
import { type HeartbeatConfiguration } from '@/components/clara/HeartbeatConfig';
import { getPerformanceMonitor } from '@/lib/heartbeat-performance';
import { config } from '@/lib/config';
import Link from 'next/link';

export default function ConversationPage() {
  // Use selective hooks consistently
  const { isProcessing, isListening, isAISpeaking } = useClaraConversationState();
  const session = useClaraSessionState();
  const messages = useClaraMessages();
  const { token, isAuthenticated } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { addMessage, setProcessing, setUserName, setPersonality, setAISpeaking } = useClaraStore(
    useShallow((state) => ({
      addMessage: state.addMessage,
      setProcessing: state.setProcessing,
      setUserName: state.setUserName,
      setPersonality: state.setPersonality,
      setAISpeaking: state.setAISpeaking,
    }))
  );
  
  const [currentMood, setCurrentMood] = useState<EmotionalMood>('happy');
  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string>('');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [conversationIntensity, setConversationIntensity] = useState<'low' | 'medium' | 'high'>('low');
  const [lastApiMoodUpdate, setLastApiMoodUpdate] = useState<number>(0);
  const [heartbeatConfig] = useState<HeartbeatConfiguration>({
    enabled: true,
    audioEnabled: true,
    visualEnabled: true,
    volume: 0.3,
    intensity: 1.0,
    reducedMotion: false
  });
  const [heartbeatMuted, setHeartbeatMuted] = useState(false);
  const speechInterfaceRef = useRef<{ handleToggle: () => void } | null>(null);
  const moodTransitionCacheRef = useRef<Map<string, { mood: EmotionalMood; timestamp: number }>>(new Map());
  const performanceMonitorRef = useRef(getPerformanceMonitor());

  // Initialize sentiment analysis hook
  const {
    analyzeSentiment,
    getCurrentIntensityLevel,
    updateUIState
  } = useSentimentAnalysis();

  // Streaming conversation state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');

  // Progressive speech state
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const spokenTextRef = useRef<string>('');
  const speechCompletedRef = useRef<boolean>(false);
  const totalSpeechSegmentsRef = useRef<number>(0);


  // Initialize speech synthesis with Clara's voice
  const [claraVoice, setClaraVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthRef.current = window.speechSynthesis;

      // Load Clara's preferred voice (same logic as BrowserSpeechService)
      const loadClaraVoice = () => {
        const voices = speechSynthRef.current?.getVoices() || [];
        if (voices.length === 0) return;

        // Priority 1: Google UK English Female (Clara's preferred voice)
        const googleUKFemale = voices.find(voice =>
          voice.name === 'Google UK English Female' ||
          (voice.name.toLowerCase().includes('google') &&
           voice.name.toLowerCase().includes('uk') &&
           voice.name.toLowerCase().includes('female'))
        );

        if (googleUKFemale) {
          setClaraVoice(googleUKFemale);
          return;
        }

        // Priority 2: Any UK English voices
        const ukVoices = voices.filter(voice =>
          voice.lang.toLowerCase() === 'en-gb' ||
          voice.lang.toLowerCase() === 'en_gb'
        );

        if (ukVoices.length > 0) {
          const qualityUkVoice = ukVoices.find(voice => {
            const voiceName = voice.name.toLowerCase();
            return ['google', 'microsoft', 'natural', 'neural', 'premium'].some(indicator =>
              voiceName.includes(indicator)
            );
          });
          setClaraVoice(qualityUkVoice || ukVoices[0]);
          return;
        }

        // Priority 3: Default English voice
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
        setClaraVoice(englishVoices[0] || null);
      };

      // Load voices
      if (speechSynthRef.current.getVoices().length > 0) {
        loadClaraVoice();
      } else {
        speechSynthRef.current.onvoiceschanged = loadClaraVoice;
      }
    }
  }, []);

  // Progressive speech processing
  useEffect(() => {
    if (speechQueue.length > 0 && !isSpeaking && speechSynthRef.current) {
      const nextText = speechQueue[0];
      setSpeechQueue(prev => prev.slice(1));

      const utterance = new SpeechSynthesisUtterance(nextText);
      utterance.voice = claraVoice; // Use Clara's preferred voice
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        console.log('🎤 SPEECH STARTED at', new Date().toISOString(), ':', nextText);
        setIsSpeaking(true);
        // Use setTimeout to avoid setState during render
        setTimeout(() => setAISpeaking(true), 0);
        currentUtteranceRef.current = utterance;
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        totalSpeechSegmentsRef.current -= 1;

        // Only proceed with final cleanup when all speech segments are complete
        setTimeout(() => {
          setSpeechQueue(currentQueue => {
            // Only trigger auto-listening when both queue is empty AND all expected segments are done
            if (currentQueue.length === 0 && totalSpeechSegmentsRef.current <= 0 && !speechCompletedRef.current) {
              speechCompletedRef.current = true;

              // Use setTimeout to avoid setState during render
              setTimeout(() => setAISpeaking(false), 0);

              // Auto-start listening after Clara finishes speaking (ONLY ONCE)
              setTimeout(() => {
                setTimeout(() => {
                  if (speechInterfaceRef.current?.handleToggle) {
                    speechInterfaceRef.current.handleToggle();
                  }
                }, 0);
              }, config.aiSpeech.autoStartListeningDelay);
            }
            return currentQueue;
          });
        }, 100);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        // Use setTimeout to avoid setState during render
        setTimeout(() => setAISpeaking(false), 0);
        currentUtteranceRef.current = null;
      };

      speechSynthRef.current.speak(utterance);
    }
  }, [speechQueue, isSpeaking]);

  // Function to add text to speech queue
  const queueSpeech = (text: string) => {
    if (text.trim()) {
      setSpeechQueue(prev => [...prev, text.trim()]);
      totalSpeechSegmentsRef.current += 1;
      speechCompletedRef.current = false;
    }
  };

  // Initialize performance monitoring
  useEffect(() => {
    const monitor = performanceMonitorRef.current;
    monitor.startMonitoring();

    return () => {
      monitor.stopMonitoring();
    };
  }, []);


  // Visual response mapping: Update mood based on conversation intensity and sentiment
  useEffect(() => {
    if (messages.length > 0) {
      const recentMessages = messages.slice(-3); // Analyze last 3 messages
      let totalSentimentScore = 0;
      let positiveCount = 0;
      let negativeCount = 0;

      recentMessages.forEach(message => {
        const sentiment = analyzeSentiment(message.content);
        totalSentimentScore += sentiment.intensity;

        if (sentiment.sentiment === 'positive') positiveCount++;
        if (sentiment.sentiment === 'negative') negativeCount++;
      });

      const avgIntensity = totalSentimentScore / recentMessages.length;

      // Map sentiment trends to mood changes (complement backend mood)
      let suggestedMood: EmotionalMood = currentMood;

      if (positiveCount > negativeCount) {
        suggestedMood = sentimentToMoodMapping('positive', avgIntensity);
      } else if (negativeCount > positiveCount) {
        suggestedMood = sentimentToMoodMapping('negative', avgIntensity);
      } else {
        suggestedMood = sentimentToMoodMapping('neutral', avgIntensity);
      }

      // Frontend caching for smooth transitions - only suggest mood changes if no recent API update
      const now = Date.now();
      const timeSinceApiUpdate = now - lastApiMoodUpdate;
      const API_PRIORITY_WINDOW = 5000; // 5 seconds

      if (suggestedMood !== currentMood && timeSinceApiUpdate > API_PRIORITY_WINDOW) {
        // Cache the frontend suggestion
        moodTransitionCacheRef.current.set('frontend_suggestion', { mood: suggestedMood, timestamp: now });

        console.log('Visual response mapping suggests mood change:', currentMood, '->', suggestedMood);
        console.log('Time since API update:', timeSinceApiUpdate, 'ms');

        // Apply frontend suggestion only if it's been stable for 2 seconds
        const previousSuggestion = moodTransitionCacheRef.current.get('frontend_suggestion');
        if (previousSuggestion && now - previousSuggestion.timestamp > 2000 && previousSuggestion.mood === suggestedMood) {
          console.log('Applying stable frontend mood suggestion:', suggestedMood);
          // Uncomment to enable frontend mood changes:
          // setCurrentMood(suggestedMood);
        }
      }
    }
  }, [messages, analyzeSentiment, currentMood, lastApiMoodUpdate]);

  const handleCentralCircleClick = () => {
    // We'll trigger the same logic as the SpeechInterface toggle
    if (isAISpeaking || isProcessing) return;

    if (isListening) {
      // Stop listening (pause)
      speechInterfaceRef.current?.handleToggle?.();
    } else {
      // Start listening
      speechInterfaceRef.current?.handleToggle?.();
    }
  };

  // Keyboard shortcuts for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Ctrl/Cmd + Space to toggle voice input
    if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
      event.preventDefault();
      handleCentralCircleClick();
    }
    // Escape to stop listening
    if (event.key === 'Escape' && isListening) {
      event.preventDefault();
      handleCentralCircleClick();
    }
  };

  // Add keyboard event listener
  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Space to toggle voice input
      if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
        event.preventDefault();
        handleCentralCircleClick();
      }
      // Escape to stop listening
      if (event.key === 'Escape' && isListening) {
        event.preventDefault();
        handleCentralCircleClick();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isListening, isAISpeaking, isProcessing, handleCentralCircleClick]);

  useEffect(() => {
    // Initialize session if needed
    if (!session.userName) {
      setUserName('User'); // Default name - could be from auth later
    }
    if (!session.selectedPersonality) {
      setPersonality('friendly');
    }
  }, [session.userName, session.selectedPersonality, setUserName, setPersonality]);

  const handleTranscriptComplete = async (transcript: string) => {
    if (!transcript.trim()) return;

    setProcessing(true);
    setIsStreaming(true);
    setStreamingResponse('');

    // Clear any existing speech queue for new conversation
    setSpeechQueue([]);
    spokenTextRef.current = '';
    speechCompletedRef.current = false;
    totalSpeechSegmentsRef.current = 0;
    if (speechSynthRef.current) {
      speechSynthRef.current.cancel();
    }
    setIsSpeaking(false);

    // Add user message to chat
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: transcript,
      timestamp: new Date(),
    };
    addMessage(userMessage);

    // Perform real-time sentiment analysis on user input
    analyzeSentiment(transcript);

    // Update conversation intensity based on user input
    const currentMessages = [...messages, userMessage];
    const intensityLevel = getCurrentIntensityLevel(currentMessages);
    setConversationIntensity(intensityLevel.level);

    try {
      // Check if user is authenticated
      if (!isAuthenticated || !token) {
        throw new Error('Authentication required');
      }

      // Use Clara's streaming endpoint
      const response = await fetch('/api/backend/clara/conversation/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: transcript,
          session_id: session.sessionId,
          personality: session.selectedPersonality,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`API error: ${response.status}`);
      }

      // Handle streaming response with proper SSE parsing for Clara's format
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedResponse = '';
      let finalData: any = null;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Skip event type line
            continue;
          }

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const eventData = JSON.parse(data);

              // Handle consciousness chunks for progressive display and speech
              if (eventData.chunk) {
                console.log('📦 CHUNK RECEIVED at', new Date().toISOString(), ':', eventData.chunk);
                accumulatedResponse += eventData.chunk;
                setStreamingResponse(accumulatedResponse);

                // Queue chunks for progressive speech
                // Find new text that hasn't been spoken yet
                const newText = accumulatedResponse.substring(spokenTextRef.current.length);

                // Look for sentence/phrase boundaries in new text
                if (newText.includes('.') || newText.includes('!') || newText.includes('?') ||
                    (newText.includes(',') && newText.length > 10) || newText.length > 30) {

                  // Find complete sentences/phrases to speak
                  const sentences = accumulatedResponse.match(/[^.!?]*[.!?]/g) || [];
                  const spokenSentences = spokenTextRef.current.match(/[^.!?]*[.!?]/g) || [];

                  // Get new sentences that haven't been spoken
                  const newSentences = sentences.slice(spokenSentences.length);

                  if (newSentences.length > 0) {
                    const textToSpeak = newSentences[0].trim();
                    if (textToSpeak.length > 3) {
                      console.log('🗣️ QUEUING SPEECH at', new Date().toISOString(), ':', textToSpeak);
                      queueSpeech(textToSpeak);
                      spokenTextRef.current += newSentences[0];
                    }
                  }
                }
              }

              // Handle complete response
              if (eventData.response) {
                console.log('✅ COMPLETE RESPONSE at', new Date().toISOString());
                finalData = eventData;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      // Use final complete response or accumulated response
      const finalResponse = finalData?.response || accumulatedResponse || 'Sorry, I didn\'t get a response.';

      // Add Clara's response to chat
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: finalResponse,
        timestamp: new Date(),
      };
      addMessage(assistantMessage);

      // Queue any remaining unsaid text for speech
      const remainingText = finalResponse.substring(spokenTextRef.current.length).trim();
      if (remainingText && remainingText.length > 3) {
        queueSpeech(remainingText);
      }

    } catch (error) {
      console.error('Conversation API error:', error);

      // Add error message
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant' as const,
        content: 'Sorry, I\'m having trouble responding right now. Please try again.',
        timestamp: new Date(),
      };
      addMessage(errorMessage);

      // Mark error message for speaking too
      setLastSpokenMessageId(errorMessage.id);
    } finally {
      setProcessing(false);
      setIsStreaming(false);
      setStreamingResponse('');

      // Safety: Clear AI speaking state after a delay if no speech is active
      setTimeout(() => {
        if (speechQueue.length === 0 && !isSpeaking) {
          setTimeout(() => setAISpeaking(false), 0);
        }
      }, 2000);
    }
  };

  // Get the latest assistant message for TTS - only if it hasn't been spoken yet
  const latestAssistantMessage = messages
    .filter(m => m.role === 'assistant')
    .pop();
  
  // Only pass aiResponse if this message hasn't been spoken yet
  const aiResponse = latestAssistantMessage && 
    latestAssistantMessage.id === lastSpokenMessageId ? 
    latestAssistantMessage.content : 
    undefined;
  
  // Clear spoken message ID after TTS completes
  useEffect(() => {
    if (aiResponse && !isProcessing) {
      // Clear after a delay to ensure TTS completes
      const clearTimer = setTimeout(() => {
        setLastSpokenMessageId('');
      }, 1000);
      return () => clearTimeout(clearTimer);
    }
    return undefined;
  }, [aiResponse, isProcessing]);

  return (
    <div className="relative min-h-screen flex flex-col" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Accessibility: Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-black px-4 py-2 rounded z-50"
      >
        Skip to main content
      </a>

      {/* Accessibility: Keyboard shortcuts help */}
      <div className="sr-only" aria-live="polite" id="keyboard-shortcuts">
        Voice interaction shortcuts: Ctrl+Space to toggle voice input, Escape to stop listening
      </div>

      {/* Dynamic Emotional Backdrop */}
      <EmotionalBackdrop key={`backdrop-${currentMood}`} mood={currentMood} />


      {/* Heartbeat Audio - plays when "Tap to Listen" is visible */}
      {heartbeatConfig.enabled && heartbeatConfig.audioEnabled && (
        <HeartbeatAudio
          mood={currentMood}
          conversationIntensity={conversationIntensity}
          isActive={!isListening && !isAISpeaking && !isProcessing}
          volume={heartbeatConfig.volume}
          muted={heartbeatMuted}
        />
      )}

      {/* Heartbeat Controls */}
      <HeartbeatControls
        showVolumeSlider={true}
        externalMuted={heartbeatMuted}
        onMuteChange={setHeartbeatMuted}
      />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="p-4 border-b border-white/20" role="banner">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <h1
                  className="text-2xl font-bold transition-colors duration-300 flex items-center gap-2"
                  id="main-heading"
                  style={{
                    color: HEARTBEAT_BPM_CONFIGS[currentMood].color
                  }}
                >
                  Clara
                  {/* Heartbeat Icon next to name */}
                  {heartbeatConfig.enabled && heartbeatConfig.visualEnabled && (
                    <HeartbeatIcon
                      mood={currentMood}
                      conversationIntensity={conversationIntensity}
                      className="relative top-0 right-0 z-auto"
                    />
                  )}
                </h1>
              </div>
              
              {/* Admin Navigation Button - Only visible to admins */}
              {isAdmin && (
                <Link
                  href="/admin/journal"
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 border border-white/20 hover:border-white/30"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Admin Panel</span>
                </Link>
              )}
            </div>
            
            <div className="flex-shrink-0">
              <Auth moodColor={HEARTBEAT_BPM_CONFIGS[currentMood].color} />
            </div>
          </div>
        </header>

        {/* Voice Waveform Visualization */}
        <main
          className="flex-1 flex items-center justify-center"
          id="main-content"
          role="main"
          aria-labelledby="main-heading"
          aria-describedby="voice-instructions"
        >
          <div className="w-full h-full max-w-4xl">
            <VoiceWaveform
              isListening={isListening}
              isSpeaking={isAISpeaking}
              audioStream={audioStream}
              onCentralCircleClick={handleCentralCircleClick}
              disabled={isProcessing}
              emotionalMood={currentMood}
              conversationIntensity={conversationIntensity}
            />
          </div>

          {/* Hidden instructions for screen readers */}
          <div className="sr-only" id="voice-instructions">
            Use the central circle to start voice interaction. Press Ctrl+Space or use the interface controls.
            Current status: {isListening ? 'listening' : isAISpeaking ? 'Clara speaking' : isProcessing ? 'processing' : 'ready'}
            Heartbeat audio is {(!isListening && !isAISpeaking && !isProcessing) ? 'playing' : 'paused'} to indicate Clara is alive and responsive.
          </div>
        </main>

        {/* Hidden Voice Interface - provides functionality only */}
        <div className="sr-only" aria-hidden="true">
          <SpeechInterface
            ref={speechInterfaceRef}
            onTranscriptComplete={handleTranscriptComplete}
            disabled={isProcessing}
            onAudioStream={setAudioStream}
            hidden={true}
            {...(aiResponse && { aiResponse })}
          />
        </div>
      </div>
    </div>
  );
}