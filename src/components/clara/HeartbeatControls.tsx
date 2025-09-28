'use client';

import { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAudioManager } from '@/lib/audio-manager';

interface HeartbeatControlsProps {
  className?: string;
  showVolumeSlider?: boolean;
  externalMuted?: boolean;
  onMuteChange?: (muted: boolean) => void;
}

export const HeartbeatControls = ({
  className = '',
  showVolumeSlider = false,
  externalMuted,
  onMuteChange
}: HeartbeatControlsProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [isVisible, setIsVisible] = useState(false);

  // Initialize state from audio manager
  useEffect(() => {
    const audioManager = getAudioManager();
    const initialMuted = externalMuted ?? audioManager.isMutedState();
    setIsMuted(initialMuted);
    setVolume(audioManager.getCurrentVolume());
  }, [externalMuted]);

  // Sync with external mute state
  useEffect(() => {
    if (externalMuted !== undefined) {
      setIsMuted(externalMuted);
    }
  }, [externalMuted]);

  // Toggle mute
  const handleMuteToggle = () => {
    const audioManager = getAudioManager();
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    audioManager.setMuted(newMutedState);

    // Notify parent component of mute state change
    onMuteChange?.(newMutedState);

    // Force audio restart if unmuting and should be active
    if (!newMutedState && audioManager.isReady()) {
      // Trigger a small delay to ensure audio context is ready
      setTimeout(() => {
        audioManager.setMuted(false);
      }, 100);
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    const audioManager = getAudioManager();
    setVolume(newVolume);
    audioManager.setVolume(newVolume);
  };

  // Show controls on hover/focus
  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);

  // Keyboard support
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleMuteToggle();
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2 border border-white/20"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: isVisible ? 1 : 0.6, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* Mute/Unmute Button */}
        <motion.button
          onClick={handleMuteToggle}
          onKeyDown={handleKeyDown}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          aria-label={isMuted ? 'Unmute heartbeat audio' : 'Mute heartbeat audio'}
          title={isMuted ? 'Unmute heartbeat audio' : 'Mute heartbeat audio'}
        >
          {isMuted ? (
            <VolumeX size={16} className="text-white/70" />
          ) : (
            <Volume2 size={16} className="text-white/90" />
          )}
        </motion.button>

        {/* Volume Slider (optional) */}
        {showVolumeSlider && (
          <motion.div
            className="flex items-center gap-2"
            initial={{ width: 0, opacity: 0 }}
            animate={{
              width: isVisible ? 'auto' : 0,
              opacity: isVisible ? 1 : 0
            }}
            transition={{ duration: 0.2 }}
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
              }}
              aria-label="Heartbeat audio volume"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
            <span className="text-xs text-white/60 min-w-[2rem]">
              {Math.round(volume * 100)}%
            </span>
          </motion.div>
        )}

        {/* Audio Status Indicator */}
        <div
          className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            isMuted ? 'bg-red-400' : 'bg-green-400'
          }`}
          aria-hidden="true"
        />
      </motion.div>

      {/* Accessibility: Screen reader status */}
      <div className="sr-only" aria-live="polite">
        Heartbeat audio is {isMuted ? 'muted' : `playing at ${Math.round(volume * 100)}% volume`}
      </div>
    </div>
  );
};