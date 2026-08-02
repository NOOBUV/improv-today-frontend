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
  const manuallyStoppedRef = useRef(false);
  // Latest text heard this session (interim or final) + whether we already sent it.
  const lastHeardRef = useRef('');
  const finalizedRef = useRef(false);

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

  // Detect if user is on mobile device
  const isMobileDevice = useRef(
    typeof window !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2))
  ).current;

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

  // Single exit from a listening session: stop, then send if we heard anything.
  // Every finalize path (final result, silence watchdog, recognition ending) routes here.
  const handleFinalTranscript = useCallback(async (text: string) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    await stopListening();
    if (text.trim()) {
      onTranscriptComplete(text.trim());
    }
  }, [onTranscriptComplete, stopListening]);

  const armSilenceTimer = useCallback((text: string, delay: number) => {
    stopSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (!manuallyStoppedRef.current) {
        handleFinalTranscript(text);
      }
    }, delay);
  }, [stopSilenceTimer, handleFinalTranscript]);

  const startListening = useCallback(async () => {
    setError(null);
    const speech = speechRef.current;
    if (!speech?.canListen()) {
      setError('Speech recognition not supported. Use Chrome/Edge.');
      return;
    }
    
    clearTranscript();
    setListening(true);
    manuallyStoppedRef.current = false; // Reset flag when starting new listening session
    finalizedRef.current = false;
    lastHeardRef.current = '';

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
        // Skip if user already manually stopped (prevents double-send on mobile)
        if (manuallyStoppedRef.current) {
          return;
        }

        const text = t.trim();
        lastHeardRef.current = text;

        if (isFinal) {
          setTranscript(text, false);
          armSilenceTimer(text, config.speech.silenceTimeout);
        } else {
          setTranscript(t, true);
          // Watchdog: Chrome sometimes never marks a result final after the user goes
          // quiet, so nothing above ever fires and the UI sticks on "Listening...".
          armSilenceTimer(text, config.speech.interimSilenceTimeout);
        }
      });

      // Recognition ended on its own (Chrome stops after an utterance, or fired
      // 'no-speech'). Finalize what we heard — with nothing heard this just clears
      // isListening so the orb and button leave the listening state.
      if (!manuallyStoppedRef.current) {
        await handleFinalTranscript(lastHeardRef.current);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start listening';
      setError(message);
      setListening(false);
      if (onAudioStream) {
        onAudioStream(null);
      }
    }
  }, [clearTranscript, setListening, setError, setTranscript, armSilenceTimer, handleFinalTranscript, onAudioStream]);

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
      // On mobile: clicking while listening sends the transcript (manual stop & send)
      // On desktop: clicking while listening just pauses (auto-stop via silence detection works)
      if (isMobileDevice) {
        const currentTranscript = transcript || interimTranscript;

        // Set flag BEFORE stopping to prevent auto-stop from also firing
        manuallyStoppedRef.current = true;
        stopSilenceTimer(); // Cancel any pending auto-stop timer

        await stopListening();

        if (currentTranscript.trim()) {
          // Mobile: send transcript immediately
          onTranscriptComplete(currentTranscript.trim());
        } else {
          // No transcript, just pause
          setPaused(true);
        }
      } else {
        // Desktop: just pause. Flag it so the session-ended handler doesn't send.
        manuallyStoppedRef.current = true;
        await stopListening();
        setPaused(true);
      }
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