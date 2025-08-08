'use client';

import { create } from 'zustand';

interface SpeechStoreState {
  isInitialized: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  setInitialized: (value: boolean) => void;
  setSpeaking: (value: boolean) => void;
  setListening: (value: boolean) => void;
}

export const useSpeechStore = create<SpeechStoreState>((set) => ({
  isInitialized: false,
  isSpeaking: false,
  isListening: false,
  setInitialized: (value) => set({ isInitialized: value }),
  setSpeaking: (value) => set({ isSpeaking: value }),
  setListening: (value) => set({ isListening: value }),
}));


