'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';

interface WaveformVisualProps {
  audioData?: number[];
  isRecording?: boolean;
  isPlaying?: boolean;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

export default function WaveformVisual({
  audioData = [],
  isRecording = false,
  isPlaying = false,
  width = 400,
  height = 100,
  color = '#3B82F6',
  backgroundColor = '#F3F4F6',
  className = '',
}: WaveformVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [liveData, setLiveData] = useState<number[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Generate random data for recording visualization
  useEffect(() => {
    if (isRecording) {
      const generateLiveData = () => {
        setLiveData(prev => {
          const newData = [...prev];
          // Add new random amplitude
          newData.push(Math.random() * 0.8 + 0.1);
          // Keep only last 100 points
          if (newData.length > 100) {
            newData.shift();
          }
          return newData;
        });
        
        animationRef.current = requestAnimationFrame(generateLiveData);
      };
      
      generateLiveData();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setLiveData([]);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Choose data source
    const data = isRecording ? liveData : audioData;
    if (data.length === 0) return;

    // Calculate bar width
    const barWidth = width / data.length;
    const maxBarHeight = height * 0.8;
    const centerY = height / 2;

    // Draw waveform bars
    ctx.fillStyle = color;
    
    data.forEach((amplitude, index) => {
      const barHeight = amplitude * maxBarHeight;
      const x = index * barWidth;
      const y = centerY - barHeight / 2;
      
      // Add some variation for visual appeal
      const actualBarWidth = Math.max(2, barWidth - 1);
      
      // Create gradient for bars
      if (isRecording || isPlaying) {
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80'); // Add transparency
        ctx.fillStyle = gradient;
      }
      
      ctx.fillRect(x, y, actualBarWidth, barHeight);
    });

    // Add glow effect when recording
    if (isRecording) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.globalCompositeOperation = 'source-over';
    }

  }, [audioData, liveData, isRecording, isPlaying, width, height, color, backgroundColor]);

  // Modern Audio Visualizer (like the component you showed)
  const ModernAudioVisualizer = () => {
    return (
      <div className="flex items-center justify-center space-x-1 h-16">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`w-2 bg-gradient-to-t from-blue-400 to-purple-500 rounded-full transition-all duration-300 ${
              isRecording || isPlaying ? 'animate-pulse' : ''
            }`}
            style={{
              height: isRecording || isPlaying 
                ? `${Math.random() * 40 + 20}px` 
                : '20px',
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
    );
  };

  if (!isClient) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex justify-center items-center h-20 text-gray-400">
          Loading waveform...
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-3">
        {/* Modern Visualizer */}
        <div className="text-center">
          <ModernAudioVisualizer />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            {isRecording ? 'Recording' : isPlaying ? 'Playing' : 'Waveform'}
          </h3>
          
          {/* Status indicator */}
          <div className="flex items-center space-x-2">
            {isRecording && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-600">REC</span>
              </div>
            )}
            
            {isPlaying && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600">PLAY</span>
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="border border-gray-200 rounded-md"
            style={{ 
              width: `${width}px`, 
              height: `${height}px`,
              maxWidth: '100%',
            }}
          />
        </div>

        {/* Visualization Info */}
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            {isRecording 
              ? `${liveData.length} samples` 
              : `${audioData.length} data points`
            }
          </span>
          
          {audioData.length > 0 && !isRecording && (
            <span>
              Avg: {(audioData.reduce((a, b) => a + b, 0) / audioData.length).toFixed(2)}
            </span>
          )}
        </div>

        {/* Alternative visualization for no data */}
        {audioData.length === 0 && !isRecording && (
          <div className="flex justify-center items-center h-20 text-gray-400">
            <div className="text-center">
              <div className="flex space-x-1 mb-2">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-gray-300 rounded-full"
                    style={{ 
                      height: `${(i % 5 + 1) * 4 + 10}px`, // Deterministic height based on index
                      opacity: 0.3,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs">No audio data</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}