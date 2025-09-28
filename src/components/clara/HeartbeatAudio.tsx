'use client';

import { useEffect, useRef, useState } from 'react';
import { EmotionalMood } from './EmotionalBackdrop';
import { getAudioManager } from '@/lib/audio-manager';
import { calculateFinalBPM } from '@/utils/heartbeat-utils';

interface HeartbeatAudioProps {
  mood: EmotionalMood;
  conversationIntensity: 'low' | 'medium' | 'high';
  isActive: boolean; // Should play when "Tap to Listen" is visible
  volume?: number;
  muted?: boolean;
  onMuteChange?: (muted: boolean) => void;
}

export const HeartbeatAudio = ({
  mood,
  conversationIntensity,
  isActive,
  volume = 0.3,
  muted = false
}: HeartbeatAudioProps) => {
  const audioManagerRef = useRef(getAudioManager());
  const [, setIsLoaded] = useState(false);
  const [loadedMoods, setLoadedMoods] = useState<Set<EmotionalMood>>(new Set());

  // Initialize audio manager and load heartbeat audio
  useEffect(() => {
    const initializeAudio = async () => {
      const audioManager = audioManagerRef.current;

      // Load audio for current mood if not already loaded
      if (!loadedMoods.has(mood)) {
        try {
          await audioManager.loadHeartbeatAudio(mood);
          setLoadedMoods(prev => new Set(prev).add(mood));
          setIsLoaded(true);
        } catch (error) {
          console.error(`Failed to load heartbeat audio for ${mood}:`, error);
        }
      }
    };

    initializeAudio();
  }, [mood, loadedMoods]);

  // Update audio manager settings
  useEffect(() => {
    const audioManager = audioManagerRef.current;
    audioManager.setVolume(volume);
    audioManager.setMuted(muted);
  }, [volume, muted]);

  // Control heartbeat playback based on conversation state
  useEffect(() => {
    const audioManager = audioManagerRef.current;

    if (isActive && !muted && audioManager.isReady()) {
      // Calculate BPM using the same function as visual heartbeat
      const adjustedBpm = calculateFinalBPM(mood, conversationIntensity);

      // Stop any existing heartbeat first
      audioManager.stopHeartbeat();

      // Small delay to ensure clean restart
      setTimeout(() => {
        if (isActive && !muted && audioManager.isReady()) {
          audioManager.playHeartbeat(mood, adjustedBpm);
        }
      }, 50);
    } else {
      // Stop heartbeat audio
      audioManager.stopHeartbeat();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      audioManager.stopHeartbeat();
    };
  }, [isActive, mood, conversationIntensity, muted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioManagerRef.current.stopHeartbeat();
    };
  }, []);

  // This component doesn't render any UI - it's purely for audio management
  return null;
};