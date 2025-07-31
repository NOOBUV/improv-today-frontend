'use client';

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Volume2, 
  BookOpen, 
  TrendingUp, 
  Star,
  Target,
  Clock,
  CheckCircle
} from 'lucide-react';

interface ConversationFeedback {
  clarity: number;
  fluency: number;
  vocabularyUsage: string[];
  suggestions: string[];
  overallRating: number;
  responseTime?: number;
  wordCount?: number;
  complexityScore?: number;
}

interface FeedbackPanelProps {
  feedback: ConversationFeedback | null;
  isRealTime?: boolean;
  className?: string;
}

export default function FeedbackPanel({
  feedback,
  isRealTime = false,
  className = '',
}: FeedbackPanelProps) {
  if (!feedback) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Start speaking to receive feedback</p>
        </div>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating 
            ? 'text-yellow-400 fill-current' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <Card className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {isRealTime ? 'Live Feedback' : 'Performance Feedback'}
        </h3>
        <div className="flex items-center space-x-1">
          {getRatingStars(feedback.overallRating)}
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clarity Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-700">Clarity</span>
            </div>
            <span className={`font-semibold ${getScoreColor(feedback.clarity)}`}>
              {feedback.clarity}%
            </span>
          </div>
          <Progress value={feedback.clarity} className="h-2" />
          <p className="text-sm text-gray-600">
            {getScoreLabel(feedback.clarity)}
          </p>
        </div>

        {/* Fluency Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-700">Fluency</span>
            </div>
            <span className={`font-semibold ${getScoreColor(feedback.fluency)}`}>
              {feedback.fluency}%
            </span>
          </div>
          <Progress value={feedback.fluency} className="h-2" />
          <p className="text-sm text-gray-600">
            {getScoreLabel(feedback.fluency)}
          </p>
        </div>
      </div>

      {/* Additional Metrics */}
      {(feedback.responseTime || feedback.wordCount || feedback.complexityScore) && (
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          {feedback.responseTime && (
            <div className="text-center">
              <Clock className="w-5 h-5 text-gray-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-gray-900">
                {feedback.responseTime}s
              </p>
              <p className="text-xs text-gray-600">Response Time</p>
            </div>
          )}
          
          {feedback.wordCount && (
            <div className="text-center">
              <MessageCircle className="w-5 h-5 text-gray-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-gray-900">
                {feedback.wordCount}
              </p>
              <p className="text-xs text-gray-600">Words</p>
            </div>
          )}
          
          {feedback.complexityScore && (
            <div className="text-center">
              <Target className="w-5 h-5 text-gray-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-gray-900">
                {feedback.complexityScore}%
              </p>
              <p className="text-xs text-gray-600">Complexity</p>
            </div>
          )}
        </div>
      )}

      {/* Vocabulary Usage */}
      {feedback.vocabularyUsage.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <BookOpen className="w-5 h-5 text-purple-600" />
            <h4 className="font-medium text-gray-700">Vocabulary Used</h4>
            <Badge variant="outline" className="text-xs">
              {feedback.vocabularyUsage.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {feedback.vocabularyUsage.map((word, index) => (
              <Badge
                key={index}
                className="bg-purple-100 text-purple-800 border-purple-200"
              >
                {word}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {feedback.suggestions.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-700">Suggestions</h4>
          </div>
          <ul className="space-y-2">
            {feedback.suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="flex items-start space-x-2 text-sm text-gray-600"
              >
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Overall Performance */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">Overall Performance</span>
          <div className="flex items-center space-x-2">
            <span className={`font-semibold ${getScoreColor((feedback.clarity + feedback.fluency) / 2)}`}>
              {Math.round((feedback.clarity + feedback.fluency) / 2)}%
            </span>
            <span className="text-sm text-gray-500">
              ({getScoreLabel((feedback.clarity + feedback.fluency) / 2)})
            </span>
          </div>
        </div>
      </div>

      {/* Real-time indicator */}
      {isRealTime && (
        <div className="flex items-center justify-center text-sm text-gray-500 pt-2 border-t">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
          Live analysis active
        </div>
      )}
    </Card>
  );
}