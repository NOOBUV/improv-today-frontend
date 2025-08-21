'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  const [open, setOpen] = useState(false);

  return (
    <div className={`animate-in fade-in duration-300 flex justify-center ${className || ''}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Badge 
            variant="outline"
            className="bg-white/10 border-white/20 text-white transition-all duration-300 hover:bg-white/20 cursor-pointer text-center px-4 py-3"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(!open);
              }
            }}
          >
            <span>Try using: <strong className="font-bold">{suggestion.word}</strong></span>
          </Badge>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-4 bg-white/95 backdrop-blur-sm border border-white/20 text-slate-900"
          side="top"
          align="center"
        >
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-lg text-slate-800">{suggestion.word}</h4>
              <p className="text-sm text-slate-600 mt-1">{suggestion.definition}</p>
            </div>
            <div>
              <h5 className="font-medium text-sm text-slate-700 mb-1">Example:</h5>
              <p className="text-sm text-slate-600 italic leading-relaxed">&ldquo;{suggestion.exampleSentence}&rdquo;</p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}