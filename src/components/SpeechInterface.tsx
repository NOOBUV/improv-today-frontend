'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { SimpleSpeech } from '@/lib/simpleSpeech';
import { useConversationStore } from '@/store/conversationStore';

interface SpeechInterfaceProps {
  onTranscriptComplete: (transcript: string) => void;
  disabled?: boolean;
  aiResponse?: string; // When this changes, speak it and auto-restart listening
}

export function SpeechInterface({ onTranscriptComplete, disabled = false, aiResponse }: SpeechInterfaceProps) {
  const speechRef = useRef<SimpleSpeech | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    isListening,
    isAISpeaking,
    isPaused,
    transcript,
    interimTranscript,
    error,
    setListening,
    setPaused,
    setAISpeaking,
    setTranscript,
    setError,
    clearTranscript,
  } = useConversationStore();

  useEffect(() => {
    speechRef.current = new SimpleSpeech();
  }, []);

  // Handle AI response - speak it and auto-restart listening
  useEffect(() => {
    if (aiResponse && !disabled) {
      const speakAndRestart = async () => {
        setAISpeaking(true);
        await speechRef.current?.speak(aiResponse);
        setAISpeaking(false);
        
        // Auto-start listening after AI finishes speaking
        setTimeout(() => {
          startListening();
        }, 500);
      };
      
      speakAndRestart();
    }
  }, [aiResponse, disabled]);

  const stopSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const startListening = async () => {
    setError(null);
    const speech = speechRef.current;
    if (!speech?.canListen()) {
      setError('Speech recognition not supported. Use Chrome/Edge.');
      return;
    }
    
    clearTranscript();
    setListening(true);
    
    try {
      await speech.startListening(({ transcript: t, isFinal }) => {
        if (isFinal) {
          const finalText = t.trim();
          setTranscript(finalText, false);
          stopSilenceTimer();
          silenceTimerRef.current = setTimeout(() => {
            handleFinalTranscript(finalText);
          }, 1200);
        } else {
          setTranscript(t, true);
          stopSilenceTimer();
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start listening';
      setError(message);
      setListening(false);
    }
  };

  const stopListening = async () => {
    stopSilenceTimer();
    setListening(false);
    await speechRef.current?.stopListening();
  };

  const handleFinalTranscript = async (text: string) => {
    await stopListening();
    if (text.trim()) {
      onTranscriptComplete(text.trim());
    }
  };

  const handleToggle = async () => {
    if (disabled || isAISpeaking) return;
    
    if (isListening) {
      await stopListening();
      setPaused(true);
    } else if (isPaused) {
      setPaused(false);
      await startListening();
    } else {
      await startListening();
    }
  };

  const getButtonText = () => {
    if (isAISpeaking) return 'Speaking...';
    if (isListening) return 'Pause';
    if (isPaused) return 'Resume';
    return 'Tap to talk';
  };

  const getStatusText = () => {
    if (isAISpeaking) return 'AI speaking...';
    if (isListening) return 'Listening...';
    if (isPaused) return 'Paused';
    return 'Tap to start';
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <Button 
        onClick={handleToggle} 
        className="w-48 h-48 rounded-full text-lg"
        disabled={disabled || isAISpeaking}
      >
        {getButtonText()}
      </Button>

      <div className="text-center text-white/80 min-h-[3rem]">
        <div className="mb-2">{getStatusText()}</div>
        {(transcript || interimTranscript) && (
          <div className="text-sm italic break-words max-w-md">
            "{transcript || interimTranscript}"
          </div>
        )}
        {error && <div className="text-red-300 mt-2">{error}</div>}
      </div>
    </div>
  );
}