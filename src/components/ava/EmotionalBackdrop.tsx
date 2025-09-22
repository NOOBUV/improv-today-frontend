'use client';

import { motion, AnimatePresence } from 'framer-motion';

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


export function EmotionalBackdrop({
  mood,
  intensity = 0.6
}: EmotionalBackdropProps) {
  // Use mood prop directly for immediate updates
  const currentMood = mood;
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