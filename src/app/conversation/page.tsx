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
import { BrowserSpeechService } from '@/lib/speech';
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
    getCurrentIntensityLevel
  } = useSentimentAnalysis();

  // Streaming conversation state
  const [, setIsStreaming] = useState(false);
  const [, setStreamingResponse] = useState('');

  // Progressive speech state using BrowserSpeechService
  const speechServiceRef = useRef<BrowserSpeechService | null>(null);
  const firstSpeechStartRef = useRef<number | null>(null);
  const requestSentTimeRef = useRef<number | null>(null);

  // Initialize BrowserSpeechService with callbacks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      speechServiceRef.current = new BrowserSpeechService();

      // Set up streaming callbacks
      speechServiceRef.current.setStreamingCallbacks({
        onSentenceQueued: (text) => {
          // Track first speech timing
          if (firstSpeechStartRef.current === null && requestSentTimeRef.current !== null) {
            firstSpeechStartRef.current = performance.now();
            const timeSinceRequest = firstSpeechStartRef.current - requestSentTimeRef.current;
            console.log(`🎤 FIRST SPEECH STARTED at ${timeSinceRequest.toFixed(0)}ms after request sent`);
          }

          setAISpeaking(true);
          console.log('🗣️ QUEUING SPEECH:', text);
        },
        onComplete: () => {
          setAISpeaking(false);

          // Auto-start listening after Clara finishes speaking
          setTimeout(() => {
            if (speechInterfaceRef.current?.handleToggle) {
              speechInterfaceRef.current.handleToggle();
            }
          }, config.aiSpeech.autoStartListeningDelay);
        }
      });
    }
  }, []);


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

    // Reset timing tracking for new conversation
    requestSentTimeRef.current = performance.now();
    firstSpeechStartRef.current = null;
    console.log('📤 MESSAGE SENT TO BACKEND');

    setProcessing(true);
    setIsStreaming(true);
    setStreamingResponse('');

    // Clear any existing speech for new conversation
    firstSpeechStartRef.current = null;
    requestSentTimeRef.current = performance.now();

    if (speechServiceRef.current) {
      speechServiceRef.current.stopSpeaking();
    }

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
      let accumulatedResponse = '';  // This will store the filtered message content only
      let accumulatedJson = '';  // This will store the raw JSON for parsing emotion
      let messageStarted = false;
      let insideMessage = false;
      let finalData: any = null;
      const streamStartTime = performance.now();
      let firstChunkReceived = false;
      let firstChunkTime: number | null = null;
      let lastChunkTime: number | null = null;
      let previousResponseLength = 0;  // Track previous length to detect new content

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
                // Track first chunk timing
                if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  firstChunkTime = performance.now();
                  console.log(`⚡ FIRST CHUNK RECEIVED at ${(firstChunkTime - streamStartTime).toFixed(0)}ms after request sent`);
                }

                // Track last chunk timing
                lastChunkTime = performance.now();

                // Accumulate raw JSON for emotion parsing
                accumulatedJson += eventData.chunk;

                // Filter JSON structure to extract only message content
                const rawChunk = eventData.chunk;

                // STATE 1: Looking for "message": " pattern
                if (!messageStarted) {
                  const messageFieldPattern = /"message"\s*:\s*"/;
                  if (messageFieldPattern.test(accumulatedJson)) {
                    messageStarted = true;
                    insideMessage = true;

                    // Extract content that's already accumulated after "message": "
                    const match = accumulatedJson.match(messageFieldPattern);
                    if (match) {
                      const patternEndIdx = (match.index || 0) + match[0].length;
                      const alreadyAccumulated = accumulatedJson.substring(patternEndIdx);
                      accumulatedResponse += alreadyAccumulated;
                    }
                  }
                } else if (insideMessage) {
                  // STATE 2: Inside message field - accumulate content unless it's the closing
                  if (rawChunk.includes('",') || (rawChunk.includes('"') && accumulatedJson.includes('"emotion"'))) {
                    insideMessage = false;
                    // Add content before the closing quote
                    const endIdx = rawChunk.indexOf('"');
                    if (endIdx > 0) {
                      accumulatedResponse += rawChunk.substring(0, endIdx);
                    }
                  } else {
                    // Regular message content - add as-is
                    accumulatedResponse += rawChunk;
                  }
                }

                setStreamingResponse(accumulatedResponse);

                // Stream only NEW content to BrowserSpeechService for processing
                if (speechServiceRef.current && accumulatedResponse.length > previousResponseLength) {
                  const newContent = accumulatedResponse.substring(previousResponseLength);
                  speechServiceRef.current.queueStreamingChunk(newContent);
                  previousResponseLength = accumulatedResponse.length;
                }
              }

              // Handle complete response
              if (eventData.response) {
                const completeTime = performance.now();
                const totalStreamTime = completeTime - streamStartTime;

                console.log(`✅ COMPLETE RESPONSE received`);
                if (lastChunkTime !== null) {
                  console.log(`⏱️  LAST CHUNK was at ${(lastChunkTime - streamStartTime).toFixed(0)}ms after request`);
                }
                console.log(`⏱️  TOTAL STREAM TIME: ${totalStreamTime.toFixed(0)}ms`);

                finalData = eventData;

                // Extract emotion from simulation_context
                if (eventData.simulation_context?.conversation_emotion) {
                  const backendEmotion = eventData.simulation_context.conversation_emotion;

                  // Map backend emotion to frontend EmotionalMood
                  const emotionMap: Record<string, EmotionalMood> = {
                    'calm': 'calm',
                    'happy': 'happy',
                    'sad': 'sad',
                    'stressed': 'frustrated',
                    'sassy': 'excited',
                    'neutral': 'calm'
                  };

                  const mappedMood = emotionMap[backendEmotion] || 'calm';

                  console.log(`🎭 Emotion from API: ${backendEmotion} → ${mappedMood}`);
                  setCurrentMood(mappedMood);
                  setLastApiMoodUpdate(Date.now());
                }
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

      // Flush any remaining buffered speech
      if (speechServiceRef.current) {
        speechServiceRef.current.flushStreamingBuffer();
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
    } finally {
      setProcessing(false);
      setIsStreaming(false);
      setStreamingResponse('');
    }
  };


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
      <div className="relative z-10 flex flex-col min-h-[100svh] supports-[min-height:100dvh]:min-h-[100dvh]">
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
          />
        </div>
      </div>
    </div>
  );
}
