'use client';

import { useEffect, useRef, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { SimpleSpeech } from '@/lib/simpleSpeech';
import {
  useClaraStore,
  useClaraConversationState
} from '@/store/claraStore';
import { config } from '@/lib/config';

interface SpeechInterfaceProps {
  onTranscriptComplete: (transcript: string) => void;
  disabled?: boolean;
  aiResponse?: string; // When this changes, speak it and auto-restart listening
  onAudioStream?: (stream: MediaStream | null) => void; // Callback to get audio stream for visualization
  hidden?: boolean; // Hide the interface but keep it functional
}

interface SpeechInterfaceRef {
  handleToggle: () => void;
}

export const SpeechInterface = memo(forwardRef<SpeechInterfaceRef, SpeechInterfaceProps>(function SpeechInterface({ onTranscriptComplete, disabled = false, aiResponse, onAudioStream, hidden = false }, ref) {
  const speechRef = useRef<SimpleSpeech | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { isListening, isAISpeaking } = useClaraConversationState();
  const { 
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
  } = useClaraStore();

  useEffect(() => {
    speechRef.current = new SimpleSpeech();
  }, []);

  const stopSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(async () => {
    stopSilenceTimer();
    await speechRef.current?.stopListening();
    setListening(false);
    if (onAudioStream) {
      onAudioStream(null);
    }
  }, [stopSilenceTimer, setListening, onAudioStream]);

  const handleFinalTranscript = useCallback(async (text: string) => {
    await stopListening();
    if (text.trim()) {
      onTranscriptComplete(text.trim());
    }
  }, [onTranscriptComplete, stopListening]);

  const startListening = useCallback(async () => {
    setError(null);
    const speech = speechRef.current;
    if (!speech?.canListen()) {
      setError('Speech recognition not supported. Use Chrome/Edge.');
      return;
    }
    
    clearTranscript();
    setListening(true);
    
    try {
      // Get audio stream for visualization
      if (onAudioStream) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          onAudioStream(stream);
        } catch (e) {
          console.warn('Could not get audio stream for visualization:', e);
        }
      }
      
      await speech.startListening(({ transcript: t, isFinal }) => {
        if (isFinal) {
          const finalText = t.trim();
          setTranscript(finalText, false);
          stopSilenceTimer();
          silenceTimerRef.current = setTimeout(() => {
            handleFinalTranscript(finalText);
          }, config.speech.silenceTimeout);
        } else {
          setTranscript(t, true);
          stopSilenceTimer();
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start listening';
      setError(message);
      setListening(false);
      if (onAudioStream) {
        onAudioStream(null);
      }
    }
  }, [clearTranscript, setListening, setError, setTranscript, stopSilenceTimer, handleFinalTranscript, onAudioStream]);

  // Handle AI response - speak it and auto-restart listening
  const lastProcessedResponse = useRef<string>('');

  useEffect(() => {
    if (aiResponse && !disabled && aiResponse !== lastProcessedResponse.current) {
      lastProcessedResponse.current = aiResponse;

      const speakAndRestart = async () => {
        setAISpeaking(true);
        await speechRef.current?.speak(aiResponse);
        setAISpeaking(false);

        // Auto-start listening after AI finishes speaking
        setTimeout(() => {
          startListening();
        }, config.aiSpeech.autoStartListeningDelay);
      };

      speakAndRestart();
    }
  }, [aiResponse, disabled]);

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

  // Expose handleToggle to parent components
  useImperativeHandle(ref, () => ({
    handleToggle
  }));

  if (hidden) {
    return null; // Hide the interface but keep all functionality
  }

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
            &ldquo;{transcript || interimTranscript}&rdquo;
          </div>
        )}
        {error && <div className="text-red-300 mt-2">{error}</div>}
      </div>
    </div>
  );
}));