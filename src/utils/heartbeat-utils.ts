'use client';

import { EmotionalMood } from '@/components/clara/EmotionalBackdrop';

// BPM to cycle time mapping based on emotional moods
export interface HeartbeatConfig {
  bpm: number;
  cycleMs: number;
  color: string;
}

export interface ConversationIntensityEffects {
  scaleBonus: number;
  glowIntensity: number;
  bpmMultiplier: number;
}

// Scientifically-based BPM configurations for each emotional mood
export const HEARTBEAT_BPM_CONFIGS: Record<EmotionalMood, HeartbeatConfig> = {
  neutral: { bpm: 60, cycleMs: 1000, color: '#9ca3af' },     // Gray
  excited: { bpm: 90, cycleMs: 667, color: '#ec4899' },      // Pink
  calm: { bpm: 45, cycleMs: 1333, color: '#10b981' },        // Green
  angry: { bpm: 100, cycleMs: 600, color: '#ef4444' },       // Red
  happy: { bpm: 75, cycleMs: 800, color: '#f59e0b' },        // Golden
  sad: { bpm: 50, cycleMs: 1200, color: '#3b82f6' },         // Blue
  frustrated: { bpm: 85, cycleMs: 706, color: '#f97316' },   // Orange
  surprised: { bpm: 95, cycleMs: 632, color: '#8b5cf6' }     // Purple
};

// Conversation intensity effects on heartbeat
export const CONVERSATION_INTENSITY_EFFECTS: Record<'low' | 'medium' | 'high', ConversationIntensityEffects> = {
  low: { scaleBonus: 0, glowIntensity: 0, bpmMultiplier: 1.0 },
  medium: { scaleBonus: 0, glowIntensity: 0, bpmMultiplier: 1.1 },
  high: { scaleBonus: 0.1, glowIntensity: 0.3, bpmMultiplier: 1.3 } // Stronger pulse + glow
};

// Double-pulse heartbeat animation keyframes (realistic heartbeat pattern)
export const HEARTBEAT_SCALE_SEQUENCE = [1.0, 1.2, 1.0, 1.1, 1.0];
export const HEARTBEAT_TIMING_SEQUENCE = [0, 0.2, 0.3, 0.5, 1.0]; // Double-pulse timing

/**
 * Get heartbeat configuration for a given mood
 */
export const getHeartbeatConfig = (mood: EmotionalMood): HeartbeatConfig => {
  return HEARTBEAT_BPM_CONFIGS[mood];
};

/**
 * Get conversation intensity effects for heartbeat
 */
export const getIntensityEffects = (intensity: 'low' | 'medium' | 'high'): ConversationIntensityEffects => {
  return CONVERSATION_INTENSITY_EFFECTS[intensity];
};

/**
 * Calculate final BPM based on mood and conversation intensity (matches audio system)
 */
export const calculateFinalBPM = (
  mood: EmotionalMood,
  conversationIntensity: 'low' | 'medium' | 'high'
): number => {
  const baseBpm = HEARTBEAT_BPM_CONFIGS[mood].bpm;
  let intensityMultiplier = 1.0;

  switch (conversationIntensity) {
    case 'low':
      intensityMultiplier = 0.9;
      break;
    case 'medium':
      intensityMultiplier = 1.1;
      break;
    case 'high':
      intensityMultiplier = 1.3;
      break;
  }

  return Math.round(baseBpm * intensityMultiplier);
};

/**
 * Calculate final animation duration based on mood and conversation intensity
 */
export const calculateAnimationDuration = (
  mood: EmotionalMood,
  conversationIntensity: 'low' | 'medium' | 'high'
): number => {
  const finalBpm = calculateFinalBPM(mood, conversationIntensity);
  return 60 / finalBpm; // Convert BPM to seconds per beat
};

/**
 * Calculate heartbeat scale sequence with conversation intensity bonus
 */
export const calculateScaleSequence = (
  conversationIntensity: 'low' | 'medium' | 'high'
): number[] => {
  const effects = getIntensityEffects(conversationIntensity);

  return HEARTBEAT_SCALE_SEQUENCE.map((scale, index) => {
    if (index === 1) { // Main pulse
      return scale + effects.scaleBonus;
    }
    if (index === 3) { // Secondary pulse
      return scale + (effects.scaleBonus * 0.5);
    }
    return scale;
  });
};

/**
 * Generate glow effect CSS filter based on mood and conversation intensity
 */
export const generateGlowEffect = (
  mood: EmotionalMood,
  conversationIntensity: 'low' | 'medium' | 'high'
): string => {
  const config = getHeartbeatConfig(mood);
  const effects = getIntensityEffects(conversationIntensity);

  const baseDropShadow = '0 2px 4px rgba(0,0,0,0.2)';

  if (effects.glowIntensity > 0) {
    const glowOpacity = Math.round(effects.glowIntensity * 255).toString(16).padStart(2, '0');
    const glowEffect = ` drop-shadow(0 0 8px ${config.color}${glowOpacity})`;
    return `${baseDropShadow}${glowEffect}`;
  }

  return baseDropShadow;
};

/**
 * Convert conversation intensity score to level
 */
export const scoreToIntensityLevel = (score: number): 'low' | 'medium' | 'high' => {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
};

/**
 * Map sentiment to mood for UI updates
 */
export const sentimentToMoodMapping = (
  sentiment: 'positive' | 'negative' | 'neutral',
  intensity: number
): EmotionalMood => {
  if (sentiment === 'positive') {
    return intensity > 0.7 ? 'excited' : 'happy';
  }
  if (sentiment === 'negative') {
    return intensity > 0.7 ? 'angry' : 'sad';
  }
  return 'neutral';
};

/**
 * Smooth color transition configuration
 */
export const COLOR_TRANSITION_CONFIG = {
  duration: '0.3s',
  easing: 'ease-in-out'
};

