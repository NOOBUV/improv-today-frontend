'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Volume2, BookOpen, Target, CheckCircle } from 'lucide-react';
import { browserSpeech } from '@/lib/speech';

interface VocabularyWord {
  id: string;
  word: string;
  definition: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  examples: string[];
  pronunciation?: string;
  usageCount: number;
  masteryLevel: number;
  lastUsed?: Date;
}

interface VocabularyCardProps {
  word: VocabularyWord;
  onWordUsed?: (wordId: string) => void;
  onMarkPracticed?: (wordId: string, score: number) => void;
  showProgress?: boolean;
  compact?: boolean;
  className?: string;
}

export default function VocabularyCard({
  word,
  onWordUsed,
  onMarkPracticed,
  showProgress = true,
  compact = false,
  className = '',
}: VocabularyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPronouncing, setIsPronouncing] = useState(false);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMasteryColor = (level: number) => {
    if (level >= 80) return 'bg-green-500';
    if (level >= 60) return 'bg-yellow-500';
    if (level >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const handlePronounce = async () => {
    setIsPronouncing(true);
    const textToSpeak = word.pronunciation || word.word;
    
    browserSpeech.speak(
      textToSpeak,
      { rate: 0.8, pitch: 1 },
      () => setIsPronouncing(false),
      (error) => {
        console.error('Pronunciation error:', error);
        setIsPronouncing(false);
      }
    );
  };

  const handleUseWord = () => {
    onWordUsed?.(word.id);
  };

  const handleMarkPracticed = (score: number) => {
    onMarkPracticed?.(word.id, score);
  };

  if (compact) {
    return (
      <Card className={`p-3 hover:shadow-md transition-shadow ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="font-semibold text-gray-900">{word.word}</h3>
              <p className="text-sm text-gray-600 truncate max-w-40">
                {word.definition}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge className={getDifficultyColor(word.difficulty)}>
              {word.difficulty}
            </Badge>
            
            <Button
              onClick={handlePronounce}
              variant="ghost"
              size="sm"
              disabled={isPronouncing}
            >
              <Volume2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showProgress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Mastery</span>
              <span>{word.masteryLevel}%</span>
            </div>
            <Progress 
              value={word.masteryLevel} 
              className="h-2"
              // className={`h-2 ${getMasteryColor(word.masteryLevel)}`}
            />
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className={`p-6 hover:shadow-lg transition-shadow ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{word.word}</h2>
              <Button
                onClick={handlePronounce}
                variant="ghost"
                size="sm"
                disabled={isPronouncing}
                className="text-blue-600 hover:text-blue-700"
              >
                <Volume2 className="w-5 h-5" />
              </Button>
            </div>
            
            {word.pronunciation && (
              <p className="text-sm text-gray-500 font-mono">
                /{word.pronunciation}/
              </p>
            )}
          </div>

          <div className="flex flex-col items-end space-y-2">
            <Badge className={getDifficultyColor(word.difficulty)}>
              {word.difficulty}
            </Badge>
            <Badge variant="outline">{word.category}</Badge>
          </div>
        </div>

        {/* Definition */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-gray-800 leading-relaxed">{word.definition}</p>
          </div>
        </div>

        {/* Examples */}
        {word.examples.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Examples:
            </h3>
            <ul className="space-y-2">
              {word.examples.slice(0, isExpanded ? undefined : 2).map((example, index) => (
                <li key={index} className="text-gray-600 pl-4 border-l-2 border-gray-200">
                  "{example}"
                </li>
              ))}
            </ul>
            
            {word.examples.length > 2 && (
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                variant="ghost"
                size="sm"
                className="mt-2 text-blue-600"
              >
                {isExpanded ? 'Show less' : `Show ${word.examples.length - 2} more examples`}
              </Button>
            )}
          </div>
        )}

        {/* Progress & Stats */}
        {showProgress && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Mastery Progress
                </span>
              </div>
              <span className="text-sm text-gray-600">
                {word.masteryLevel}%
              </span>
            </div>
            
            <Progress value={word.masteryLevel} className="h-3" />
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Used {word.usageCount} times</span>
              {word.lastUsed && (
                <span>
                  Last used: {new Date(word.lastUsed).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <Button
            onClick={handleUseWord}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Mark as Used</span>
          </Button>

          <div className="flex space-x-2">
            <Button
              onClick={() => handleMarkPracticed(10)}
              variant="outline"
              size="sm"
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              Easy
            </Button>
            <Button
              onClick={() => handleMarkPracticed(5)}
              variant="outline"
              size="sm"
              className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
            >
              Good
            </Button>
            <Button
              onClick={() => handleMarkPracticed(-5)}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Hard
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}