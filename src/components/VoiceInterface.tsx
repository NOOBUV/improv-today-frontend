'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
// Removed useVoiceRecording - not needed for browser-only speech
import { useConversation } from '@/hooks/useConversation';
import { browserSpeech } from '@/lib/speech';

interface VoiceInterfaceProps {
  onTranscript?: (text: string) => void;
  onSpeechEnd?: (audioBlob: Blob, transcript: string) => void;
  onAIResponse?: (response: string) => void; // New prop to get AI response for speech
  disabled?: boolean;
  className?: string;
}

export default function VoiceInterface({
  onTranscript,
  onSpeechEnd,
  onAIResponse,
  disabled = false,
  className = '',
}: VoiceInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Use ref to always get current transcript value
  const transcriptRef = useRef(transcript);
  const handleTranscriptCompleteRef = useRef<((transcript: string) => Promise<void>) | null>(null);
  const restartListeningRef = useRef<(() => void) | null>(null);
  
  // Update ref whenever transcript changes
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Speech synthesis is now handled at the parent component level
  
  useEffect(() => {
    setIsClient(true);
    
    // Cleanup on unmount
    return () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [silenceTimer]);

  // Clear any existing silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }
    setCountdown(null);
  }, [silenceTimer]);

  // Start 8-second countdown for silence detection
  const startSilenceTimer = useCallback(() => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
    setCountdown(null);
    
    let timeLeft = 8;
    setCountdown(timeLeft);
    
    const countdownInterval = setInterval(() => {
      timeLeft--;
      setCountdown(timeLeft);
      
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        setCountdown(null);
      }
    }, 1000);
    
    const timer = setTimeout(() => {
      clearInterval(countdownInterval);
      setCountdown(null);
      // Force stop listening after 8 seconds of silence
      setIsListening(false);
      browserSpeech.stopListening();
      
      // Use ref to get the current transcript value at timeout
      const currentTranscript = transcriptRef.current;
      console.log('🕐 Silence timeout triggered. Current transcript:', currentTranscript);
      
      if (currentTranscript && currentTranscript.trim()) {
        handleTranscriptCompleteRef.current?.(currentTranscript);
      } else {
        console.log('⚠️ No transcript to send - transcript is empty');
      }
    }, 8000);
    
    setSilenceTimer(timer);
  }, [silenceTimer]);

  // Restart listening (separate function to avoid circular dependencies)
  const restartListening = useCallback(() => {
    if (!isClient) return;
    
    console.log('🔄 Restarting listening...');
    setIsListening(true);
    setTranscript('');
    setInterimTranscript('');
    
    // Use Chrome Web Speech API for transcription (FREE)
    browserSpeech.startListening(
      (result) => {
        if (result.isFinal) {
          // User has finished speaking a sentence
          const finalTranscript = result.transcript.trim();
          console.log('📝 Final transcript received:', finalTranscript);
          
          if (finalTranscript) {
            setTranscript(prev => {
              const newTranscript = prev ? prev + ' ' + finalTranscript : finalTranscript;
              console.log('💾 Updated transcript state:', newTranscript);
              return newTranscript;
            });
            setInterimTranscript('');
            onTranscript?.(finalTranscript);
            
            // Start silence timer - if user doesn't speak for 8 seconds, end session
            startSilenceTimer();
          }
        } else {
          // User is still speaking - reset silence timer
          clearSilenceTimer();
          setInterimTranscript(result.transcript);
        }
      },
      (error) => {
        console.error('Speech recognition error:', error);
        clearSilenceTimer();
        setIsListening(false);
      }
    );
  }, [isClient, onTranscript, startSilenceTimer, clearSilenceTimer]);

  // Handle completed transcript - send via the conversation hook
  const handleTranscriptComplete = useCallback(async (finalTranscript: string) => {
    console.log('🎯 Processing transcript via conversation hook:', finalTranscript);
    
    // Use the provided onSpeechEnd callback to integrate with conversation state
    if (onSpeechEnd) {
      onSpeechEnd(null as any, finalTranscript); // No audio blob needed for browser speech
      console.log('✅ Transcript sent to conversation hook');
    } else {
      console.log('⚠️ No onSpeechEnd callback provided');
    }
    
    // Don't automatically restart - let the AI response handling restart after speaking
  }, [onSpeechEnd]);

  // Update the ref whenever the function changes
  useEffect(() => {
    handleTranscriptCompleteRef.current = handleTranscriptComplete;
  }, [handleTranscriptComplete]);


  const handleStartListening = useCallback(async () => {
    if (!isClient) return;
    
    if (!browserSpeech.isAvailable()) {
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        alert('Speech recognition requires Chrome browser on Android or Safari on iOS. Please make sure you are using a supported browser.');
      } else {
        alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      }
      return;
    }

    // Note: Speech Recognition API will request permission automatically
    restartListening();
  }, [isClient, restartListening]);

  const handleStopListening = useCallback(() => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }
    setCountdown(null);
    setIsListening(false);
    browserSpeech.stopListening();
    
    const currentTranscript = transcriptRef.current;
    console.log('🛑 Manual stop. Current transcript:', currentTranscript);
    
    if (currentTranscript && currentTranscript.trim()) {
      // Send complete transcript for analysis
      handleTranscriptComplete(currentTranscript);
      onSpeechEnd?.(null as any, currentTranscript); // No audio blob needed
    }
  }, [onSpeechEnd, silenceTimer, handleTranscriptComplete]);

  const resetTranscript = useCallback(() => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }
    setCountdown(null);
    setTranscript('');
    setInterimTranscript('');
  }, [silenceTimer]);

  if (!isClient) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-gray-500 py-4">
          Loading voice interface...
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        {/* Main Controls */}
        <div className="flex items-center justify-center space-x-4">
          {!isListening ? (
            <Button
              onClick={handleStartListening}
              disabled={disabled}
              size="lg"
              className="w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-600"
            >
              <Mic className="w-6 h-6" />
            </Button>
          ) : (
            <Button
              onClick={handleStopListening}
              size="lg"
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600"
            >
              <MicOff className="w-6 h-6" />
            </Button>
          )}
        </div>

        {/* Status Indicators */}
        <div className="text-center space-y-2">
          {isListening && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">Listening...</span>
            </div>
          )}

          {isListening && countdown === null && (
            <div className="text-sm text-blue-600">
              🎤 Listening for speech...
            </div>
          )}

          {countdown !== null && (
            <div className="text-sm text-orange-600 font-medium">
              ⏱️ Silence detected. Ending in {countdown} seconds...
            </div>
          )}
        </div>

        {/* Transcript Display */}
        {(transcript || interimTranscript) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              What you said:
            </h3>
            <p className="text-gray-900">
              {transcript}
              {interimTranscript && (
                <span className="text-gray-500 italic">
                  {interimTranscript}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Instructions */}
        {!isListening && !transcript && (
          <div className="text-center text-sm text-gray-500">
            Click the microphone to start speaking
          </div>
        )}

        {/* Action Buttons */}
        {transcript && !isListening && (
          <div className="flex justify-center space-x-2">
            <Button
              onClick={resetTranscript}
              variant="outline"
              size="sm"
            >
              Clear
            </Button>
            <Button
              onClick={handleStartListening}
              variant="outline"
              size="sm"
            >
              Speak Again
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}