'use client';

import { useState, useRef, useCallback } from 'react';

interface VoiceRecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number;
  error: string | null;
}

export const useVoiceRecording = () => {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    audioBlob: null,
    audioUrl: null,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm;codecs=opus' 
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setState(prev => ({
          ...prev,
          isRecording: false,
          audioBlob,
          audioUrl,
        }));
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };
      
      startTimeRef.current = Date.now();
      mediaRecorder.start(100);
      
      setState(prev => ({
        ...prev,
        isRecording: true,
        error: null,
        audioBlob: null,
        audioUrl: null,
        duration: 0,
      }));
      
      intervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to access microphone',
        isRecording: false,
      }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [state.isRecording]);

  const resetRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    
    setState({
      isRecording: false,
      audioBlob: null,
      audioUrl: null,
      duration: 0,
      error: null,
    });
  }, [state.audioUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    resetRecording,
  };
};