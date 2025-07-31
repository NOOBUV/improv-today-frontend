'use client';

import { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
// Removed useVoiceRecording - not needed for browser-only speech
import { useConversation } from '@/hooks/useConversation';
import { browserSpeech } from '@/lib/speech';

interface VoiceInterfaceProps {
  onTranscript?: (text: string) => void;
  onSpeechEnd?: (audioBlob: Blob, transcript: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function VoiceInterface({
  onTranscript,
  onSpeechEnd,
  disabled = false,
  className = '',
}: VoiceInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  // Simplified state - no audio recording needed
  const [duration, setDuration] = useState(0);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle completed transcript - send to backend for analysis
  const handleTranscriptComplete = useCallback(async (finalTranscript: string) => {
    try {
      // STOP listening to prevent speech loop
      setIsListening(false);
      browserSpeech.stopListening();
      
      console.log('🎯 Sending to backend:', finalTranscript);
      
      // Send transcript to backend for vocabulary analysis and AI response
      const result = await browserSpeech.analyzeTranscript(finalTranscript);
      
      console.log('🤖 Backend response:', result);
      
      // Speak the AI response using Chrome Web Speech Synthesis
      if (result.aiResponse) {
        setTimeout(() => {
          browserSpeech.speak(result.aiResponse, {
            rate: 0.9,
            pitch: 1,
            volume: 0.8
          });
        }, 1000); // Longer delay to ensure speech recognition is fully stopped
      }
      
    } catch (error) {
      console.error('Backend analysis failed:', error);
      setIsListening(false);
      browserSpeech.stopListening();
    }
  }, []);

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

    setIsListening(true);
    setTranscript('');
    setInterimTranscript('');
    
    // Use Chrome Web Speech API for transcription (FREE)
    browserSpeech.startListening(
      (result) => {
        if (result.isFinal) {
          const finalTranscript = result.transcript;
          setTranscript(prev => prev + finalTranscript);
          setInterimTranscript('');
          onTranscript?.(finalTranscript);
          
          // Send transcript to backend for analysis and AI response
          handleTranscriptComplete(finalTranscript);
        } else {
          setInterimTranscript(result.transcript);
        }
      },
      (error) => {
        console.error('Speech recognition error:', error);
        setIsListening(false);
      }
    );
  }, [isClient, onTranscript, handleTranscriptComplete]);

  const handleStopListening = useCallback(() => {
    setIsListening(false);
    browserSpeech.stopListening();
    
    if (transcript) {
      onSpeechEnd?.(null as any, transcript); // No audio blob needed
    }
  }, [transcript, onSpeechEnd]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setDuration(0);
  }, []);

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

          {isListening && (
            <div className="text-sm text-blue-600">
              🎤 Listening for speech...
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