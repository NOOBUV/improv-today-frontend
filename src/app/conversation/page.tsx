'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  useAvaStore,
  useAvaConversationState,
  useAvaMessages,
  useAvaSessionState
} from '@/store/avaStore';
import { useShallow } from 'zustand/react/shallow';
import { SpeechInterface } from '@/components/shared/SpeechInterface';
import { EmotionalBackdrop, type EmotionalMood } from '@/components/ava/EmotionalBackdrop';
import { VoiceWaveform } from '@/components/ava/VoiceWaveform';
import { Auth } from '@/components/shared/Auth';

export default function ConversationPage() {
  // Use selective hooks consistently
  const { isProcessing, isListening, isAISpeaking } = useAvaConversationState();
  const session = useAvaSessionState();
  const messages = useAvaMessages();
  const { addMessage, setProcessing, setUserName, setPersonality } = useAvaStore(
    useShallow((state) => ({
      addMessage: state.addMessage,
      setProcessing: state.setProcessing,
      setUserName: state.setUserName,
      setPersonality: state.setPersonality,
    }))
  );
  
  const [currentMood, setCurrentMood] = useState<EmotionalMood>('happy');
  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string>('');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const speechInterfaceRef = useRef<{ handleToggle: () => void } | null>(null);

  // Debug: Log currentMood changes
  useEffect(() => {
    console.log('currentMood state updated to:', currentMood);
  }, [currentMood]);

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
  }, [isListening, isAISpeaking, isProcessing]);

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
    
    // Add user message to chat
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: transcript,
      timestamp: new Date(),
    };
    addMessage(userMessage);
    
    try {
      // Make API call to backend
      const response = await fetch('/api/backend/ava/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: transcript,
          personality: session.selectedPersonality,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Full API response:', data); // Debug log
      
      // Update emotional backdrop based on API response
      // Check for mood in nested emotional_state object or at top level
      const emotion = data.emotional_state?.mood || data.emotion || data.mood;
      console.log('Extracted emotion:', emotion); // Debug log
      if (emotion) {
        const moodMapping: Record<string, EmotionalMood> = {
          'happy': 'happy',
          'joy': 'happy',
          'excited': 'excited',
          'sad': 'sad',
          'melancholy': 'sad',
          'angry': 'angry',
          'frustrated': 'frustrated',
          'calm': 'calm',
          'peaceful': 'calm',
          'surprised': 'surprised',
          'shock': 'surprised',
          'neutral': 'neutral',
        };
        const mappedMood = moodMapping[emotion.toLowerCase()] || 'neutral';
        console.log('Setting mood from API:', emotion, '->', mappedMood); // Debug log
        console.log('Current mood before update:', currentMood);
        setCurrentMood(mappedMood);
        console.log('setCurrentMood called with:', mappedMood);
      }
      
      // Add Ava's response to chat
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: data.message || data.text_response || 'Sorry, I didn\'t get a response.',
        timestamp: new Date(),
      };
      addMessage(assistantMessage);
      
      // Mark this message for speaking
      setLastSpokenMessageId(assistantMessage.id);
      
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

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="p-4 bg-black/20 backdrop-blur-sm border-b border-white/10" role="banner">
          <div className="max-w-4xl mx-auto flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-white" id="main-heading">
                Conversation with Ava
              </h1>
              <p className="text-white/60 text-sm mt-1" aria-live="polite">
                Personality: {session.selectedPersonality} • {messages.length} messages
              </p>
            </div>
            <div className="flex-shrink-0">
              <Auth />
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
            />
          </div>

          {/* Hidden instructions for screen readers */}
          <div className="sr-only" id="voice-instructions">
            Use the central circle to start voice interaction. Press Ctrl+Space or use the interface controls.
            Current status: {isListening ? 'listening' : isAISpeaking ? 'Ava speaking' : isProcessing ? 'processing' : 'ready'}
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