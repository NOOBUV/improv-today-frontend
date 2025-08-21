'use client';

import React from 'react';

export interface SuggestionData {
  id: number;
  word: string;
  definition: string;
  exampleSentence: string;
}

export interface SuggestionPillProps {
  suggestion: SuggestionData;
  className?: string;
}

export function SuggestionPill({ suggestion, className }: SuggestionPillProps) {
  return (
    <div className={`animate-in fade-in duration-300 ${className || ''}`}>
      <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-lg px-3 py-2 text-center max-w-xs mx-auto">
        {/* Compact header */}
        <div className="mb-1">
          <span className="text-xs text-white/70">Try: </span>
          <span className="text-sm font-bold text-white">{suggestion.word}</span>
        </div>
        
        {/* Definition in smaller text */}
        <div className="text-xs text-white/85 mb-1 leading-tight">
          {suggestion.definition}
        </div>
        
        {/* Example in even smaller text */}
        <div className="text-xs text-white/75 italic leading-tight">
          "{suggestion.exampleSentence}"
        </div>
      </div>
    </div>
  );
}