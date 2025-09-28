'use client';

import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { EmotionalMood } from '@/components/clara/EmotionalBackdrop';
import {
  HEARTBEAT_BPM_CONFIGS,
  HEARTBEAT_TIMING_SEQUENCE,
  calculateAnimationDuration,
  calculateScaleSequence,
  generateGlowEffect,
  COLOR_TRANSITION_CONFIG
} from '@/utils/heartbeat-utils';

interface HeartbeatIconProps {
  mood: EmotionalMood;
  conversationIntensity: 'low' | 'medium' | 'high';
  className?: string;
}

export const HeartbeatIcon = ({
  mood,
  conversationIntensity,
  className = ''
}: HeartbeatIconProps) => {
  const config = HEARTBEAT_BPM_CONFIGS[mood];

  // Calculate animation properties
  const animationDuration = calculateAnimationDuration(mood, conversationIntensity);
  const scaleSequence = calculateScaleSequence(conversationIntensity);
  const glowEffect = generateGlowEffect(mood, conversationIntensity);

  return (
    <motion.div
      className={`${className.includes('relative') ? className : `fixed top-4 right-4 z-50 ${className}`}`}
      style={{
        filter: glowEffect
      }}
      animate={{
        scale: scaleSequence
      }}
      transition={{
        duration: animationDuration,
        repeat: Infinity,
        ease: 'easeOut',
        times: HEARTBEAT_TIMING_SEQUENCE
      }}
      aria-label={`Clara's heartbeat - ${mood} mood, ${conversationIntensity} intensity`}
      role="img"
    >
      <Heart
        size={24}
        color={config.color}
        fill={config.color}
        data-testid="heart-icon"
        style={{
          transition: `color ${COLOR_TRANSITION_CONFIG.duration} ${COLOR_TRANSITION_CONFIG.easing}`
        }}
      />
    </motion.div>
  );
};