'use client';

import { useEffect, useRef, useState } from 'react';

interface CircularWaveformProps {
  isListening?: boolean;
  isAISpeaking?: boolean;
  onClick?: () => void;
  size?: number;
  className?: string;
}

export default function CircularWaveform({
  isListening = false,
  isAISpeaking = false,
  onClick,
  size = 200,
  className = '',
}: CircularWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Animation loop for dynamic waveform
  useEffect(() => {
    let active = true;

    const animate = () => {
      if (!active) return;

      setAnimationPhase(prev => prev + 0.1);
      animationRef.current = requestAnimationFrame(animate);
    };

    if (isListening || isAISpeaking) {
      animate();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      active = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isAISpeaking]);

  // Draw circular waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isClient) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size * 0.3;

    // Draw outer circle background
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius + 20, 0, 2 * Math.PI);
    ctx.fillStyle = isListening ? 'rgba(59, 130, 246, 0.1)' : 
                    isAISpeaking ? 'rgba(168, 85, 247, 0.1)' : 
                    'rgba(156, 163, 175, 0.1)';
    ctx.fill();

    // Draw animated waveform rings
    const ringCount = 12;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * 2 * Math.PI;
      
      // Calculate dynamic amplitude based on animation phase
      let amplitude = 0;
      if (isListening || isAISpeaking) {
        amplitude = Math.sin(animationPhase + i * 0.5) * 0.3 + 0.7;
        amplitude *= isListening ? 1.2 : 0.8; // Different intensity for listening vs speaking
      } else {
        amplitude = 0.4; // Static state
      }
      
      const radius = baseRadius + (amplitude * 15);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      // Draw waveform point
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      
      if (isListening) {
        ctx.fillStyle = `rgba(59, 130, 246, ${amplitude})`;
      } else if (isAISpeaking) {
        ctx.fillStyle = `rgba(168, 85, 247, ${amplitude})`;
      } else {
        ctx.fillStyle = `rgba(156, 163, 175, 0.6)`;
      }
      
      ctx.fill();
    }

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.6, 0, 2 * Math.PI);
    
    if (isListening) {
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.6);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
      ctx.fillStyle = gradient;
    } else if (isAISpeaking) {
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.6);
      gradient.addColorStop(0, 'rgba(168, 85, 247, 0.8)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.3)');
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = 'rgba(156, 163, 175, 0.4)';
    }
    
    ctx.fill();

    // Add glow effect when active
    if (isListening || isAISpeaking) {
      ctx.shadowColor = isListening ? '#3B82F6' : '#A855F7';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

  }, [size, animationPhase, isListening, isAISpeaking, isClient]);

  if (!isClient) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className={`cursor-pointer transition-transform hover:scale-105 ${
          onClick ? 'hover:opacity-80' : ''
        }`}
        onClick={onClick}
        style={{ width: size, height: size }}
      />
      
      {/* Status text overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center text-white">
          {isListening && (
            <div className="text-sm font-medium">
              Listening...
            </div>
          )}
          {isAISpeaking && (
            <div className="text-sm font-medium">
              Speaking...
            </div>
          )}
          {!isListening && !isAISpeaking && onClick && (
            <div className="text-sm font-medium opacity-70">
              Tap to speak
            </div>
          )}
        </div>
      </div>
    </div>
  );
}