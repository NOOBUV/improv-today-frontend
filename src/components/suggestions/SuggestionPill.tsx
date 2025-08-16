'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

export interface SuggestionData {
  id: number;
  word: string;
  definition?: string;
}

export interface SuggestionPillProps {
  suggestion: SuggestionData;
  className?: string;
}

export function SuggestionPill({ suggestion, className }: SuggestionPillProps) {
  return (
    <div className={`animate-in fade-in duration-300 flex justify-center ${className || ''}`}>
      <Badge 
        variant="outline"
        className="bg-white/10 border-white/20 text-white transition-all duration-300 hover:bg-white/20 text-center max-w-xs px-4 py-2"
      >
        Try using: <strong className="font-bold">{suggestion.word}</strong>
        {suggestion.definition && (
          <span className="text-white/80 ml-1">({suggestion.definition})</span>
        )}
      </Badge>
    </div>
  );
}