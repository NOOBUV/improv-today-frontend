'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, useAnimationFrame } from 'framer-motion';
import { useConversationState } from '@/store/conversationStore';

interface VoiceWaveformProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  audioStream?: MediaStream | null;
  onCentralCircleClick?: () => void;
  disabled?: boolean;
  emotionalMood?: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited' | 'calm' | 'surprised' | 'frustrated';
  conversationIntensity?: 'low' | 'medium' | 'high';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface FlowingWave {
  id: number;
  radius: number;
  targetRadius: number;
  opacity: number;
  targetOpacity: number;
  thickness: number;
  frequency: number;
  delay: number;
  phase: number;
  amplitude: number;
  segments: number;
}

// Helper function to convert hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export function VoiceWaveform({ isListening = false, isSpeaking = false, audioStream, onCentralCircleClick, disabled = false, emotionalMood = 'neutral' }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nextParticleIdRef = useRef(0);
  
  const [particles, setParticles] = useState<Particle[]>([]);
  const { isProcessing } = useConversationState();

  // Get emotional colors based on mood - ALIVE color palette using color theory
  const getEmotionalColors = (mood: string) => {
    switch (mood) {
      case 'angry':
        return {
          light: '#ff6b6b', // Warm passionate red
          medium: '#e55353', // Deep red with warmth
          dark: '#c53030', // Rich burgundy
          rgba: '229, 83, 83' // RGB values for rgba
        };
      case 'happy':
        return {
          light: '#ffd93d', // Bright sunny yellow
          medium: '#ffc107', // Golden yellow
          dark: '#ff8f00', // Deep amber
          rgba: '255, 193, 7'
        };
      case 'sad':
        return {
          light: '#4fc3f7', // Soft sky blue
          medium: '#2196f3', // Clear blue
          dark: '#1565c0', // Deep ocean blue
          rgba: '33, 150, 243'
        };
      case 'excited':
        return {
          light: '#ff80ab', // Electric pink
          medium: '#e91e63', // Vibrant magenta
          dark: '#ad1457', // Deep fuchsia
          rgba: '233, 30, 99'
        };
      case 'calm':
        return {
          light: '#81c784', // Soft sage green
          medium: '#4caf50', // Natural green
          dark: '#2e7d32', // Deep forest green
          rgba: '76, 175, 80'
        };
      case 'surprised':
        return {
          light: '#ba68c8', // Bright lavender
          medium: '#9c27b0', // Rich purple
          dark: '#6a1b9a', // Deep violet
          rgba: '156, 39, 176'
        };
      case 'frustrated':
        return {
          light: '#ffab40', // Warm coral
          medium: '#ff9800', // Bright orange
          dark: '#f57c00', // Deep amber
          rgba: '255, 152, 0'
        };
      default: // neutral - Clean warm neutral base
        return {
          light: '#f5f5f5', // Soft warm white
          medium: '#e0e0e0', // Warm light gray
          dark: '#bdbdbd', // Medium warm gray
          rgba: '224, 224, 224' // RGB values for rgba
        };
    }
  };

  // Create single flowing wave pattern
  const flowingWaves = useMemo<FlowingWave[]>(() => {
    const waves: FlowingWave[] = [];
    
    // Single wave ring - starts at central circle edge (100px radius)
    waves.push({
      id: 0,
      radius: 100, // Start at central circle edge
      targetRadius: 100,
      opacity: 0.6,
      targetOpacity: 0.6,
      thickness: 3,
      frequency: 0.01,
      delay: 0,
      phase: 0,
      amplitude: 15,
      segments: 128
    });
    
    return waves;
  }, []);

  // Initialize Web Audio API
  useEffect(() => {
    if (audioStream && isListening) {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(audioStream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      
      return () => {
        audioContext.close();
      };
    }
    return undefined;
  }, [audioStream, isListening]);

  // Create particles
  const createParticle = (x: number, y: number, intensity: number = 1): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 2 + 1) * intensity;
    
    return {
      id: nextParticleIdRef.current++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3 + 1,
      opacity: 0.8,
      life: 0,
      maxLife: Math.random() * 60 + 30
    };
  };

  // Update particles
  const updateParticles = () => {
    particlesRef.current = particlesRef.current
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        vx: particle.vx * 0.98,
        vy: particle.vy * 0.98,
        life: particle.life + 1,
        opacity: Math.max(0, particle.opacity - 0.01)
      }))
      .filter(particle => particle.life < particle.maxLife && particle.opacity > 0.1);

    // Add new particles when speaking or listening - emanating from rings
    if ((isListening || isSpeaking || isProcessing) && particlesRef.current.length < 30) {
      const canvas = canvasRef.current;
      if (canvas) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const intensity = isListening ? 1.5 : (isSpeaking || isProcessing) ? 2 : 1;
        
        // Create particles along the single flowing wave
        for (let i = 0; i < (isListening ? 3 : 1); i++) {
          const wave = flowingWaves[0]; // Single wave
          const angle = Math.random() * Math.PI * 2;
          
          // Add wave distortion to particle placement - only outward
          const waveOffset = Math.abs(Math.sin(angle * 3 + wave.phase)) * wave.amplitude * 0.6 +
                             Math.abs(Math.sin(angle * 7 + wave.phase * 1.3)) * wave.amplitude * 0.3;
          const particleRadius = wave.radius + waveOffset; // Only positive offset
          
          // Place particles on the wave circumference
          const particleX = centerX + Math.cos(angle) * particleRadius;
          const particleY = centerY + Math.sin(angle) * particleRadius;
          
          particlesRef.current.push(createParticle(particleX, particleY, intensity));
        }
      }
    }

    setParticles([...particlesRef.current]);
  };

  // Animation loop
  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update flowing waves based on audio data
    const time = Date.now();
    
    if (analyserRef.current && dataArrayRef.current && isListening) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Get average audio level for single wave
      const audioSum = Array.from(dataArrayRef.current).reduce((sum, val) => sum + val, 0);
      const audioAverage = audioSum / dataArrayRef.current.length;
      const wave = flowingWaves[0];
      
      wave.targetRadius = 100 + (audioAverage / 255) * 60; // Start at 100px (central circle edge)
      wave.targetOpacity = 0.6 + (audioAverage / 255) * 0.4;
      wave.amplitude = 15 + (audioAverage / 255) * 25;
      wave.phase = time * wave.frequency + wave.delay;
    } else if (isSpeaking || isProcessing) {
      // Animate single wave when speaking/processing
      const wave = flowingWaves[0];
      const pulseAmount = Math.sin(time * wave.frequency + wave.delay) * 40;
      
      wave.targetRadius = 100 + Math.abs(pulseAmount); // Ensure only outward movement
      wave.targetOpacity = 0.7 + Math.sin(time * wave.frequency + wave.delay) * 0.3;
      wave.amplitude = 20 + Math.sin(time * wave.frequency * 0.5) * 15;
      wave.phase = time * wave.frequency + wave.delay;
    } else {
      // Gentle idle animation for single wave
      const wave = flowingWaves[0];
      const gentlePulse = Math.sin(time * wave.frequency + wave.delay) * 20;
      
      wave.targetRadius = 100 + Math.abs(gentlePulse); // Ensure only outward movement
      wave.targetOpacity = 0.4 + Math.sin(time * wave.frequency + wave.delay) * 0.2;
      wave.amplitude = 12 + Math.sin(time * wave.frequency * 0.3) * 10;
      wave.phase = time * wave.frequency + wave.delay;
    }

    // Smooth wave transitions
    flowingWaves.forEach(wave => {
      wave.radius += (wave.targetRadius - wave.radius) * 0.15;
      wave.opacity += (wave.targetOpacity - wave.opacity) * 0.1;
    });

    // Get canvas center and emotional colors for consistent use throughout
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const emotionalColors = getEmotionalColors(emotionalMood);
    
    // Draw flowing wave patterns with emotional and speech state colors
    flowingWaves.forEach((wave) => {
      let strokeColor = '';
      
      if (isListening) {
        // Use the accent (lightest) color from current mood for empathetic listening
        const accentRgb = hexToRgb(emotionalColors.light);
        strokeColor = `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${wave.opacity * 0.7})`; // Softer, empathetic
      } else if (isSpeaking || isProcessing) {
        // Use emotional color when speaking/processing
        strokeColor = `rgba(${emotionalColors.rgba}, ${wave.opacity * 0.8})`;
      } else {
        // Use emotional color for idle state
        strokeColor = `rgba(${emotionalColors.rgba}, ${wave.opacity * 0.6})`;
      }
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = wave.thickness;
      ctx.globalAlpha = wave.opacity;
      
      // Add glow effect matching colors
      ctx.shadowBlur = isListening ? 25 : isSpeaking ? 30 : 15;
      ctx.shadowColor = strokeColor;
      
      // Draw flowing wave using sine wave perturbation
      ctx.beginPath();
      let firstPoint = true;
      
      for (let i = 0; i <= wave.segments; i++) {
        const angle = (i / wave.segments) * Math.PI * 2;
        
        // Create wave distortion using sine waves - only outward flow
        const waveOffset = Math.abs(Math.sin(angle * 3 + wave.phase)) * wave.amplitude * 0.6 +
                          Math.abs(Math.sin(angle * 7 + wave.phase * 1.3)) * wave.amplitude * 0.3 +
                          Math.abs(Math.sin(angle * 11 + wave.phase * 0.7)) * wave.amplitude * 0.1;
        
        const currentRadius = wave.radius + waveOffset; // Only adds positive offset
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        
        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });
    
    // Colors and center already declared above
    
    // Draw central circle with solid gradient and empathetic mood padding for listening
    const centralRadius = 100;
    
    // Add empathetic mood padding when listening
    if (isListening) {
      const lightRgb = hexToRgb(emotionalColors.light);
      const paddingGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, centralRadius + 8);
      paddingGradient.addColorStop(0, `rgba(${lightRgb.r}, ${lightRgb.g}, ${lightRgb.b}, 0.1)`);
      paddingGradient.addColorStop(0.85, `rgba(${lightRgb.r}, ${lightRgb.g}, ${lightRgb.b}, 0.2)`);
      paddingGradient.addColorStop(1, `rgba(${lightRgb.r}, ${lightRgb.g}, ${lightRgb.b}, 0.3)`);
      
      ctx.fillStyle = paddingGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, centralRadius + 8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Central circle with solid gradient using emotional colors
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, centralRadius);
    
    if (isListening) {
      // Use empathetic listening colors - lighter version of current mood
      const lightColor = emotionalColors.light;
      const mediumColor = emotionalColors.medium;
      const darkColor = emotionalColors.dark;
      
      // Create a softer, more empathetic version by mixing with white
      gradient.addColorStop(0, lightColor + '80'); // Very light, empathetic center
      gradient.addColorStop(0.7, mediumColor + '60'); // Softer middle  
      gradient.addColorStop(1, darkColor + '40'); // Subtle dark edge
    } else if (isSpeaking || isProcessing) {
      // Use emotional colors for speaking/processing
      gradient.addColorStop(0, emotionalColors.light); // Lighter emotional center
      gradient.addColorStop(0.7, emotionalColors.medium); // Main emotional color
      gradient.addColorStop(1, emotionalColors.dark); // Darker emotional edge
    } else {
      // Use emotional colors for idle state
      gradient.addColorStop(0, emotionalColors.light); // Lighter emotional center
      gradient.addColorStop(0.7, emotionalColors.medium); // Main emotional color
      gradient.addColorStop(1, emotionalColors.dark); // Darker emotional edge
    }
    
    // Fill with gradient
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, centralRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add subtle glow effect with emotional colors
    ctx.shadowBlur = isListening ? 20 : isSpeaking ? 25 : isProcessing ? 22 : 12;
    ctx.shadowColor = isListening ? emotionalColors.light : emotionalColors.medium;
    ctx.beginPath();
    ctx.arc(centerX, centerY, centralRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Update and draw particles
    updateParticles();
  });

  // Canvas resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!disabled && onCentralCircleClick) {
        onCentralCircleClick()
      }
    }
  }

  // Determine current status for screen readers
  const getCurrentStatus = () => {
    if (isListening) return 'Voice input active, listening for speech'
    if (isSpeaking) return 'Clara is speaking'
    if (isProcessing) return 'Processing your request'
    return 'Voice interface ready, tap to start conversation'
  }

  return (
    <div className="relative w-full h-full min-h-[200px]" role="region" aria-label="Voice interaction interface">
      {/* ARIA Live Region for status updates */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="voice-status"
      >
        {getCurrentStatus()}
      </div>

      {/* Canvas for waveform and particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'transparent' }}
        aria-hidden="true"
      />

      {/* Animated particles using Framer Motion with emotional colors */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {particles.map((particle) => {
          const emotionalColors = getEmotionalColors(emotionalMood);
          return (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                left: particle.x,
                top: particle.y,
                background: isListening
                  ? `radial-gradient(circle, ${emotionalColors.light}, transparent)`
                  : `radial-gradient(circle, ${emotionalColors.medium}, transparent)`,
              }}
              animate={{
                opacity: particle.opacity,
                scale: [1, 1.5, 1],
              }}
              transition={{
                scale: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
            />
          );
        })}
      </div>

      {/* Central status indicator - clickable with keyboard support */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <motion.button
          className={`flex flex-col items-center justify-center w-48 h-48 rounded-full transition-colors ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:bg-white/5 active:bg-white/10 focus:outline-none focus:ring-4 focus:ring-white/20'
          }`}
          onClick={disabled ? undefined : onCentralCircleClick}
          onKeyDown={handleKeyDown}
          whileHover={disabled ? {} : { scale: 1.05 }}
          whileTap={disabled ? {} : { scale: 0.95 }}
          transition={{ duration: 0.2 }}
          disabled={disabled}
          aria-describedby="voice-status"
          aria-label={getCurrentStatus()}
          tabIndex={disabled ? -1 : 0}
          role="button"
        >
        <motion.div
          className="flex flex-col items-center justify-center"
          animate={{
            scale: isListening ? 1.02 : isSpeaking ? 1.05 : 1,
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Clean status text with emotional colors */}
          <motion.span
            className="text-white text-lg font-semibold text-center px-6 py-3 rounded-full border-2 backdrop-blur-sm"
            style={{
              backgroundColor: isListening
                ? `${getEmotionalColors(emotionalMood).light}30`
                : `rgba(${getEmotionalColors(emotionalMood).rgba}, 0.2)`,
              borderColor: isListening
                ? `${getEmotionalColors(emotionalMood).medium}50`
                : `rgba(${getEmotionalColors(emotionalMood).rgba}, 0.4)`,
            }}
            animate={{
              opacity: isListening || isSpeaking || isProcessing ? [1, 0.7, 1] : 1,
            }}
            transition={{
              duration: 1.5,
              repeat: isListening || isSpeaking || isProcessing ? Infinity : 0,
              ease: "easeInOut"
            }}
            aria-hidden="true" // Screen readers get status from button aria-label
          >
            {isListening ? 'Listening...' :
             isSpeaking ? 'Clara Speaking...' :
             isProcessing ? 'Thinking...' :
             'Tap to Talk'}
          </motion.span>
        </motion.div>
        </motion.button>
      </div>

      {/* Hidden keyboard shortcuts help */}
      <div className="sr-only" id="keyboard-help">
        Press Enter or Space to activate voice interaction
      </div>
    </div>
  );
}