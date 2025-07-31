'use client';

import { useState, useEffect, useCallback } from 'react';

interface VocabularyWord {
  id: string;
  word: string;
  definition: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  examples: string[];
  pronunciation?: string;
  usageCount: number;
  masteryLevel: number; // 0-100
  lastUsed?: Date;
}

interface VocabularyStats {
  totalWords: number;
  masteredWords: number;
  practiceStreak: number;
  weeklyProgress: number[];
}

export const useVocabularyTracking = () => {
  const [weeklyWords, setWeeklyWords] = useState<VocabularyWord[]>([]);
  const [stats, setStats] = useState<VocabularyStats>({
    totalWords: 0,
    masteredWords: 0,
    practiceStreak: 0,
    weeklyProgress: [0, 0, 0, 0, 0, 0, 0],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeeklyWords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vocabulary/weekly`);
      if (!response.ok) throw new Error('Failed to fetch weekly words');
      
      const data = await response.json();
      setWeeklyWords(data.words || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vocabulary');
      // Fallback to mock data for development
      setWeeklyWords([
        {
          id: '1',
          word: 'articulate',
          definition: 'Having or showing the ability to speak fluently and coherently',
          difficulty: 'medium',
          category: 'communication',
          examples: ['She was very articulate in her presentation'],
          usageCount: 0,
          masteryLevel: 0,
        },
        {
          id: '2',
          word: 'eloquent',
          definition: 'Fluent or persuasive in speaking or writing',
          difficulty: 'hard',
          category: 'communication',
          examples: ['His eloquent speech moved the audience'],
          usageCount: 0,
          masteryLevel: 0,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWordUsage = useCallback(async (wordId: string, used: boolean = true) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vocabulary/${wordId}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ used, timestamp: new Date().toISOString() }),
      });
      
      if (!response.ok) throw new Error('Failed to update word usage');
      
      setWeeklyWords(prev => prev.map(word => 
        word.id === wordId 
          ? { 
              ...word, 
              usageCount: word.usageCount + (used ? 1 : 0),
              lastUsed: used ? new Date() : word.lastUsed,
              masteryLevel: Math.min(100, word.masteryLevel + (used ? 5 : 0))
            }
          : word
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update word usage');
      // Update locally for development
      setWeeklyWords(prev => prev.map(word => 
        word.id === wordId 
          ? { 
              ...word, 
              usageCount: word.usageCount + (used ? 1 : 0),
              lastUsed: used ? new Date() : word.lastUsed,
              masteryLevel: Math.min(100, word.masteryLevel + (used ? 5 : 0))
            }
          : word
      ));
    }
  }, []);

  const getWordSuggestions = useCallback((difficulty?: string) => {
    if (!difficulty) return weeklyWords;
    return weeklyWords.filter(word => word.difficulty === difficulty);
  }, [weeklyWords]);

  const markWordPracticed = useCallback(async (wordId: string, score: number) => {
    await updateWordUsage(wordId, true);
    
    setWeeklyWords(prev => prev.map(word => 
      word.id === wordId 
        ? { 
            ...word, 
            masteryLevel: Math.min(100, Math.max(0, word.masteryLevel + score))
          }
        : word
    ));
  }, [updateWordUsage]);

  useEffect(() => {
    fetchWeeklyWords();
  }, [fetchWeeklyWords]);

  return {
    weeklyWords,
    stats,
    loading,
    error,
    updateWordUsage,
    getWordSuggestions,
    markWordPracticed,
    refreshWords: fetchWeeklyWords,
  };
};