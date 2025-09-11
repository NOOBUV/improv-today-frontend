'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export type EmotionalMood = 
  | 'neutral' 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'excited' 
  | 'calm' 
  | 'frustrated' 
  | 'surprised';

interface EmotionalBackdropProps {
  mood: EmotionalMood;
  intensity?: number; // 0-1, default 0.6
  transition?: boolean; // Enable smooth transitions, default true
}

interface MoodConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  animationType: 'pulse' | 'flow' | 'wave' | 'static';
  duration: number;
}

// Dedicated background gradient colors - separate from waveform colors
// These are optimized for subtle background gradients that complement the waveform
interface BackgroundGradientColors {
  primary: string;
  secondary: string; 
  accent: string;
}

const backgroundGradientConfigs: Record<EmotionalMood, BackgroundGradientColors> = {
  neutral: {
    primary: '#fafafa', // Very subtle warm white (center - lightest)
    secondary: '#f5f5f5', // Soft gray (middle)
    accent: '#eeeeee', // Light gray (edges - slightly brighter)
  },
  happy: {
    primary: '#fffef7', // Ultra-light golden cream (center - almost white)
    secondary: '#fff9e6', // Very soft golden tint (middle)
    accent: '#fff3cd', // Gentle golden accent (edges)
  },
  angry: {
    primary: '#fff5f5', // Very light pink-red tint (center - almost white)
    secondary: '#ffe6e6', // Soft warm pink (middle)
    accent: '#ffcccc', // Gentle red accent (edges)
  },
  sad: {
    primary: '#f8fcff', // Ultra-light cool blue tint (center - almost white)
    secondary: '#f0f8ff', // Very soft sky blue (middle)
    accent: '#e6f3ff', // Gentle blue accent (edges)
  },
  excited: {
    primary: '#fffafc', // Ultra-light magenta tint (center - almost white)
    secondary: '#fff0f6', // Very soft magenta pink (middle)
    accent: '#ffe6f2', // Gentle pink accent (edges)
  },
  calm: {
    primary: '#f9fdf9', // Ultra-light sage tint (center - almost white)
    secondary: '#f4fbf4', // Very soft sage green (middle)
    accent: '#eaf7ea', // Gentle green accent (edges)
  },
  frustrated: {
    primary: '#fffcf7', // Ultra-light peach tint (center - almost white)
    secondary: '#fff8f0', // Very soft warm peach (middle)
    accent: '#fff2e6', // Gentle orange accent (edges)
  },
  surprised: {
    primary: '#fefaff', // Ultra-light lavender tint (center - almost white)
    secondary: '#fcf4ff', // Very soft lavender (middle)
    accent: '#f8ebff', // Gentle purple accent (edges)
  },
};

const moodConfigs: Record<EmotionalMood, MoodConfig> = {
  neutral: {
    // Clean warm neutral base - no distracting colors
    primaryColor: '#f5f5f5', // Soft warm white
    secondaryColor: '#e8e8e8', // Very light warm gray
    accentColor: '#d0d0d0', // Light warm gray
    animationType: 'flow', // Gentle breathing
    duration: 12, // Calm breathing rhythm
  },
  happy: {
    // Radiant golden sunrise - pure joy and energy
    primaryColor: '#ff8f00', // Deep amber warmth
    secondaryColor: '#ffc107', // Golden yellow light
    accentColor: '#ffd93d', // Bright sunny highlight
    animationType: 'pulse',
    duration: 2.5, // Faster, more energetic
  },
  sad: {
    // Deep ocean melancholy - sophisticated blues with depth
    primaryColor: '#1565c0', // Deep ocean blue
    secondaryColor: '#2196f3', // Clear sky blue
    accentColor: '#4fc3f7', // Soft sky highlight
    animationType: 'flow',
    duration: 14, // Slower, more contemplative
  },
  angry: {
    // Passionate fire - warm reds with energy, not harsh
    primaryColor: '#c53030', // Rich burgundy
    secondaryColor: '#e55353', // Warm passionate red
    accentColor: '#ff6b6b', // Bright energetic red
    animationType: 'pulse',
    duration: 1.8, // Intense but controlled
  },
  excited: {
    // Electric magenta energy - vibrant and alive
    primaryColor: '#ad1457', // Deep fuchsia
    secondaryColor: '#e91e63', // Vibrant magenta
    accentColor: '#ff80ab', // Electric pink highlight
    animationType: 'wave',
    duration: 1.2, // High energy movement
  },
  calm: {
    // Natural forest serenity - living greens
    primaryColor: '#2e7d32', // Deep forest
    secondaryColor: '#4caf50', // Natural green
    accentColor: '#81c784', // Soft sage highlight
    animationType: 'flow',
    duration: 16, // Very peaceful rhythm
  },
  frustrated: {
    // Warm ember glow - orange fire with warmth
    primaryColor: '#f57c00', // Deep amber
    secondaryColor: '#ff9800', // Bright orange
    accentColor: '#ffab40', // Warm coral highlight
    animationType: 'pulse',
    duration: 2.2, // Restless energy
  },
  surprised: {
    // Mystical violet burst - wonder and magic
    primaryColor: '#6a1b9a', // Deep violet
    secondaryColor: '#9c27b0', // Rich purple
    accentColor: '#ba68c8', // Bright lavender
    animationType: 'wave',
    duration: 0.8, // Quick surprise burst
  },
};

export function EmotionalBackdrop({ 
  mood, 
  intensity = 0.6, 
  transition = true 
}: EmotionalBackdropProps) {
  // Use mood prop directly for immediate updates
  const currentMood = mood;
  const config = moodConfigs[currentMood] || moodConfigs.neutral;
  const backgroundColors = backgroundGradientConfigs[currentMood] || backgroundGradientConfigs.neutral;

  console.log('EmotionalBackdrop RENDER - mood prop:', mood, 'currentMood:', currentMood, 'backgroundColors:', backgroundColors);
  console.log('EmotionalBackdrop - gradient will be:', `radial-gradient(circle at 50% 50%, ${backgroundColors.primary} 0%, ${backgroundColors.secondary} 35%, ${backgroundColors.accent} 55%, transparent 75%)`);



  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: 1 }}
      data-testid="emotional-backdrop"
      data-mood={currentMood}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentMood}
          className="absolute inset-0"
          style={{
            // Radial gradient flowing from center (lightest) to edges (brighter)
            background: `radial-gradient(circle at 50% 50%, ${backgroundColors.primary} 0%, ${backgroundColors.secondary} 25%, ${backgroundColors.accent} 50%, ${backgroundColors.accent}cc 70%, transparent 85%)`,
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: intensity * 0.9, // Slightly increased intensity
            scale: [0.98, 1.02, 0.98], // Gentle breathing scale animation
            backgroundSize: ["100% 100%", "110% 110%", "100% 100%"], // Flowing outward effect
          }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </AnimatePresence>

      {/* Very subtle overlay for text readability */}
      <div className="absolute inset-0 bg-black/3" />
    </div>
  );
}