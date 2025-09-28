'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Volume2, Heart, Zap } from 'lucide-react';

interface HeartbeatConfigProps {
  onConfigChange?: (config: HeartbeatConfiguration) => void;
  className?: string;
}

export interface HeartbeatConfiguration {
  enabled: boolean;
  audioEnabled: boolean;
  visualEnabled: boolean;
  volume: number;
  intensity: number;
  reducedMotion: boolean;
}

const DEFAULT_CONFIG: HeartbeatConfiguration = {
  enabled: true,
  audioEnabled: true,
  visualEnabled: true,
  volume: 0.3,
  intensity: 1.0,
  reducedMotion: false
};

export const HeartbeatConfig = ({
  onConfigChange,
  className = ''
}: HeartbeatConfigProps) => {
  const [config, setConfig] = useState<HeartbeatConfiguration>(DEFAULT_CONFIG);
  const [isOpen, setIsOpen] = useState(false);

  // Load configuration from localStorage
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('heartbeat-config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      }

      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        setConfig(prev => ({ ...prev, reducedMotion: true }));
      }
    } catch (error) {
      console.warn('Failed to load heartbeat configuration:', error);
    }
  }, []);

  // Save configuration to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('heartbeat-config', JSON.stringify(config));
      onConfigChange?.(config);
    } catch (error) {
      console.warn('Failed to save heartbeat configuration:', error);
    }
  }, [config, onConfigChange]);

  const updateConfig = (updates: Partial<HeartbeatConfiguration>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Configuration Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 bg-black/50 backdrop-blur-md rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Heartbeat settings"
        title="Configure heartbeat experience"
      >
        <Settings size={18} className="text-white/80" />
      </motion.button>

      {/* Configuration Panel */}
      {isOpen && (
        <motion.div
          className="absolute bottom-full right-0 mb-2 w-80 bg-black/80 backdrop-blur-md rounded-lg border border-white/20 p-4 shadow-xl"
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Heart size={16} className="text-red-400" />
            Heartbeat Settings
          </h3>

          <div className="space-y-4">
            {/* Enable/Disable Heartbeat */}
            <div className="flex items-center justify-between">
              <label className="text-white/90 text-sm">Enable Heartbeat</label>
              <motion.button
                onClick={() => updateConfig({ enabled: !config.enabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.enabled ? 'bg-green-500' : 'bg-white/20'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full"
                  animate={{ left: config.enabled ? '1.5rem' : '0.25rem' }}
                  transition={{ duration: 0.2 }}
                />
              </motion.button>
            </div>

            {config.enabled && (
              <>
                {/* Audio Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-white/90 text-sm flex items-center gap-2">
                    <Volume2 size={14} />
                    Audio Heartbeat
                  </label>
                  <motion.button
                    onClick={() => updateConfig({ audioEnabled: !config.audioEnabled })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      config.audioEnabled ? 'bg-blue-500' : 'bg-white/20'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      className="absolute top-1 w-4 h-4 bg-white rounded-full"
                      animate={{ left: config.audioEnabled ? '1.5rem' : '0.25rem' }}
                      transition={{ duration: 0.2 }}
                    />
                  </motion.button>
                </div>

                {/* Visual Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-white/90 text-sm flex items-center gap-2">
                    <Heart size={14} />
                    Visual Heartbeat
                  </label>
                  <motion.button
                    onClick={() => updateConfig({ visualEnabled: !config.visualEnabled })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      config.visualEnabled ? 'bg-pink-500' : 'bg-white/20'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      className="absolute top-1 w-4 h-4 bg-white rounded-full"
                      animate={{ left: config.visualEnabled ? '1.5rem' : '0.25rem' }}
                      transition={{ duration: 0.2 }}
                    />
                  </motion.button>
                </div>

                {/* Volume Slider */}
                {config.audioEnabled && (
                  <div>
                    <label className="text-white/90 text-sm block mb-2">
                      Audio Volume: {Math.round(config.volume * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.volume}
                      onChange={(e) => updateConfig({ volume: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${config.volume * 100}%, rgba(255,255,255,0.2) ${config.volume * 100}%, rgba(255,255,255,0.2) 100%)`
                      }}
                    />
                  </div>
                )}

                {/* Intensity Slider */}
                <div>
                  <label className="text-white/90 text-sm block mb-2 flex items-center gap-2">
                    <Zap size={14} />
                    Intensity: {Math.round(config.intensity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={config.intensity}
                    onChange={(e) => updateConfig({ intensity: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${((config.intensity - 0.1) / 1.9) * 100}%, rgba(255,255,255,0.2) ${((config.intensity - 0.1) / 1.9) * 100}%, rgba(255,255,255,0.2) 100%)`
                    }}
                  />
                </div>

                {/* Reduced Motion */}
                <div className="flex items-center justify-between">
                  <label className="text-white/90 text-sm">Reduced Motion</label>
                  <motion.button
                    onClick={() => updateConfig({ reducedMotion: !config.reducedMotion })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      config.reducedMotion ? 'bg-purple-500' : 'bg-white/20'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      className="absolute top-1 w-4 h-4 bg-white rounded-full"
                      animate={{ left: config.reducedMotion ? '1.5rem' : '0.25rem' }}
                      transition={{ duration: 0.2 }}
                    />
                  </motion.button>
                </div>
              </>
            )}

            {/* Reset Button */}
            <div className="pt-2 border-t border-white/10">
              <motion.button
                onClick={resetToDefaults}
                className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-md text-white/90 text-sm transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Reset to Defaults
              </motion.button>
            </div>
          </div>

          {/* Close Button */}
          <motion.button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-white/60 hover:text-white/90 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Close settings"
          >
            ×
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};