'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSpeechStore } from '@/store/speechStore';

type SpeakPriority = 'low' | 'normal' | 'high';

interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

interface UseSpeechCoordinatorOptions {
  autoInitialize?: boolean;
}

export const useSpeechCoordinator = (options: UseSpeechCoordinatorOptions = {}) => {
  const { autoInitialize = false } = options;
  const speechStore = useSpeechStore();
  const queueRef = useRef<Array<{
    text: string;
    callbacks?: SpeakCallbacks;
    priority: SpeakPriority;
  }>>([]);
  const isSpeakingRef = useRef(false);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const selectFallbackVoice = useCallback((): SpeechSynthesisVoice | null => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;
    const byName = (name: string) => voices.find(v => v.name === name) || null;
    const contains = (substr: string) => voices.find(v => v.name.toLowerCase().includes(substr)) || null;
    const byLang = (langPrefix: string) => voices.find(v => (v.lang || '').toLowerCase().startsWith(langPrefix)) || null;
    return (
      byName('Google UK English Female') ||
      contains('google uk') ||
      (byLang('en-gb') && contains('google')) ||
      byName('Samantha') ||
      byName('Alex') ||
      byName('Google US English') ||
      byLang('en-gb') ||
      byLang('en-us') ||
      voices.find(v => v.default) ||
      voices[0] ||
      null
    );
  }, []);

  const ensureInitialized = useCallback(() => {
    if (!speechStore.isInitialized) {
      speechStore.setInitialized(true);
    }
  }, [speechStore]);

  const speakNow = useCallback((text: string, callbacks?: SpeakCallbacks) => {
    try {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
      if (!synth) {
        callbacks?.onError?.('Speech synthesis not available');
        isSpeakingRef.current = false;
        speechStore.setSpeaking(false);
        callbacks?.onEnd?.();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      // Choose a robust fallback voice if available
      if (!selectedVoiceRef.current) {
        selectedVoiceRef.current = selectFallbackVoice();
      }
      if (selectedVoiceRef.current) {
        utterance.voice = selectedVoiceRef.current;
        if ((selectedVoiceRef.current.lang || '').toLowerCase().startsWith('en-gb')) {
          utterance.lang = 'en-GB';
        }
      }
      callbacks?.onStart?.();
      utterance.onend = () => {
        isSpeakingRef.current = false;
        speechStore.setSpeaking(false);
        callbacks?.onEnd?.();
        // process next
        processQueue();
      };
      utterance.onerror = (e) => {
        isSpeakingRef.current = false;
        speechStore.setSpeaking(false);
        callbacks?.onError?.(e);
        processQueue();
      };
      // Cancel first for Chrome reliability
      synth.cancel();
      setTimeout(() => synth.speak(utterance), 50);
    } catch (e) {
      isSpeakingRef.current = false;
      speechStore.setSpeaking(false);
      callbacks?.onError?.(e);
      processQueue();
    }
  }, [speechStore, selectFallbackVoice]);

  const processQueue = useCallback(() => {
    if (isSpeakingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    isSpeakingRef.current = true;
    speechStore.setSpeaking(true);
    speakNow(next.text, next.callbacks);
  }, [speakNow, speechStore]);

  const speak = useCallback(async (
    text: string,
    _voice?: SpeechSynthesisVoice,
    callbacks?: SpeakCallbacks,
    priority: SpeakPriority = 'normal'
  ) => {
    ensureInitialized();
    // High priority goes to front of queue
    if (priority === 'high') {
      queueRef.current.unshift({ text, callbacks, priority });
    } else {
      queueRef.current.push({ text, callbacks, priority });
    }
    processQueue();
  }, [ensureInitialized, processQueue]);

  const stop = useCallback(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return;
    synth.cancel();
    isSpeakingRef.current = false;
    speechStore.setSpeaking(false);
    queueRef.current = [];
  }, [speechStore]);

  if (autoInitialize) {
    ensureInitialized();
  }

  // Initialize voices promptly and react to changes
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return;
    const handler = () => {
      if (!selectedVoiceRef.current) {
        selectedVoiceRef.current = selectFallbackVoice();
      }
    };
    // Attempt immediately and on voiceschanged
    handler();
    synth.addEventListener?.('voiceschanged', handler as EventListener);
    return () => {
      synth.removeEventListener?.('voiceschanged', handler as EventListener);
    };
  }, [selectFallbackVoice]);

  return {
    speak,
    stop,
  };
};


