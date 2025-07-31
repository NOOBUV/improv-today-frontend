'use client';

import { Brain, Target, TrendingUp } from 'lucide-react';

interface PhaseIndicatorProps {
  currentPhase: 'initial' | 'daily' | 'feedback';
  onPhaseChange?: (phase: 'initial' | 'daily' | 'feedback') => void;
  className?: string;
}

export default function PhaseIndicator({ 
  currentPhase, 
  onPhaseChange,
  className = '' 
}: PhaseIndicatorProps) {
  const phases = [
    { 
      id: 'initial' as const, 
      label: 'Initial Assessment', 
      icon: Brain, 
      color: 'blue',
      description: 'Start with basic conversation assessment'
    },
    { 
      id: 'daily' as const, 
      label: 'Daily Practice', 
      icon: Target, 
      color: 'purple',
      description: 'Practice with weekly vocabulary focus'
    },
    { 
      id: 'feedback' as const, 
      label: 'Weekly Review', 
      icon: TrendingUp, 
      color: 'green',
      description: 'Review progress and get detailed feedback'
    }
  ];

  const getColorClasses = (color: string, isActive: boolean, isCompleted: boolean) => {
    if (isActive) {
      switch(color) {
        case 'blue': return 'bg-blue-500 text-white shadow-lg shadow-blue-500/25';
        case 'purple': return 'bg-purple-500 text-white shadow-lg shadow-purple-500/25';
        case 'green': return 'bg-green-500 text-white shadow-lg shadow-green-500/25';
        default: return 'bg-gray-400 text-white';
      }
    }
    if (isCompleted) return 'bg-green-500 text-white';
    return 'bg-gray-200 text-gray-400 hover:bg-gray-300';
  };

  return (
    <div className={`flex justify-center mb-8 ${className}`}>
      <div className="flex space-x-8">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          const isActive = phase.id === currentPhase;
          const isCompleted = phases.findIndex(p => p.id === currentPhase) > index;
          
          return (
            <div key={phase.id} className="flex flex-col items-center group">
              <button
                onClick={() => onPhaseChange?.(phase.id)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
                  getColorClasses(phase.color, isActive, isCompleted)
                } ${isActive ? 'animate-pulse' : ''}`}
                disabled={!onPhaseChange}
              >
                <Icon size={20} />
              </button>
              
              <div className="text-center mt-2">
                <span className={`text-sm ${isActive ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                  {phase.label}
                </span>
                
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 absolute z-10 mt-2 p-2 bg-gray-800 text-white text-xs rounded-lg transform -translate-x-1/2 transition-opacity duration-200 pointer-events-none">
                  {phase.description}
                </div>
              </div>
              
              {/* Connection line */}
              {index < phases.length - 1 && (
                <div className="absolute top-6 left-1/2 w-8 h-0.5 bg-gray-300 transform translate-x-4 hidden md:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}