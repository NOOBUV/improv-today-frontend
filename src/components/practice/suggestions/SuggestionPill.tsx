'use client';

import React from 'react';

export interface SuggestionData {
  id: number;
  word: string;
  definition: string;
  exampleSentence: string;
  remediationFeedback?: string; // AC: 5 - Optional remediation feedback for incorrect usage
}

export interface SuggestionPillProps {
  suggestion: SuggestionData;
  className?: string;
}

export function SuggestionPill({ suggestion, className }: SuggestionPillProps) {
  const hasRemediationFeedback = suggestion.remediationFeedback && suggestion.remediationFeedback.trim().length > 0;
  
  return (
    <div className={`animate-in fade-in duration-300 ${className || ''}`}>
      <div className={`${
        hasRemediationFeedback 
          ? 'bg-amber-500/20 border-amber-400/30' 
          : 'bg-white/10 border-white/20'
      } backdrop-blur-sm rounded-lg px-3 py-2 text-center max-w-xs mx-auto`}>
        
        {/* Remediation feedback section - AC: 5 */}
        {hasRemediationFeedback && (
          <div className="mb-2 p-2 bg-amber-500/10 border border-amber-400/20 rounded text-xs">
            <div className="text-amber-200 font-medium mb-1">💡 Feedback</div>
            <div className="text-amber-100 leading-tight">
              {suggestion.remediationFeedback}
            </div>
          </div>
        )}
        
        {/* Compact header */}
        <div className="mb-1">
          <span className="text-xs text-white/70">
            {hasRemediationFeedback ? 'Try again: ' : 'Try: '}
          </span>
          <span className="text-sm font-bold text-white">{suggestion.word}</span>
        </div>
        
        {/* Definition in smaller text */}
        <div className="text-xs text-white/85 mb-1 leading-tight">
          {suggestion.definition}
        </div>
        
        {/* Example in even smaller text */}
        <div className="text-xs text-white/75 italic leading-tight">
          &ldquo;{suggestion.exampleSentence}&rdquo;
        </div>
      </div>
    </div>
  );
}