'use client';

import { useCallback, useRef, useEffect } from 'react';
import { ClaraMessage } from '@/store/claraStore';

// Types for sentiment analysis
export interface SentimentAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  intensity: number; // 0-1
  emotionalKeywords: string[];
  conversationIntensity: number; // 0-1 based on message frequency and content
}

export interface ConversationIntensityLevel {
  level: 'low' | 'medium' | 'high';
  score: number; // 0-1
}

// Sentiment keyword mappings
const EMOTION_KEYWORDS = {
  positive: [
    'love', 'amazing', 'great', 'wonderful', 'fantastic', 'excellent', 'awesome',
    'happy', 'joy', 'excited', 'thrilled', 'delighted', 'pleased', 'satisfied',
    'perfect', 'brilliant', 'incredible', 'outstanding', 'superb', 'marvelous'
  ],
  negative: [
    'hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'disgusting',
    'angry', 'frustrated', 'sad', 'disappointed', 'upset', 'annoyed', 'furious',
    'depressed', 'miserable', 'devastated', 'heartbroken', 'stressed', 'worried'
  ],
  intensity: [
    'very', 'extremely', 'really', 'so', 'absolutely', 'completely', 'totally',
    'incredibly', 'unbelievably', 'tremendously', 'enormously', 'immensely',
    '!', '!!', '!!!', 'wow', 'omg', 'amazing', 'unreal'
  ]
};

// Conversation intensity analysis
const INTENSITY_INDICATORS = {
  high: [
    '!', '?', 'urgent', 'quickly', 'immediately', 'right now', 'asap',
    'emergency', 'crisis', 'problem', 'issue', 'help', 'stuck'
  ],
  medium: [
    'need', 'want', 'should', 'could', 'might', 'maybe', 'think',
    'hope', 'wish', 'prefer', 'would like'
  ]
};

export const useSentimentAnalysis = () => {
  const sentimentCacheRef = useRef<Map<string, SentimentAnalysisResult>>(new Map());
  const messageHistoryRef = useRef<Array<{ timestamp: number; content: string; sentiment?: SentimentAnalysisResult }>>([]);

  // Calculate conversation intensity from text characteristics
  const calculateConversationIntensity = useCallback((text: string, words: string[]): number => {
    let intensity = 0.3; // Base intensity

    // Message length factor
    const messageLength = text.length;
    if (messageLength > 100) intensity += 0.2;
    if (messageLength > 200) intensity += 0.2;

    // Punctuation intensity
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    intensity += Math.min(exclamationCount * 0.15, 0.4);
    intensity += Math.min(questionCount * 0.1, 0.3);

    // High intensity keywords
    const highIntensityFound = words.some(word =>
      INTENSITY_INDICATORS.high.includes(word)
    );
    if (highIntensityFound) intensity += 0.3;

    // Medium intensity keywords
    const mediumIntensityFound = words.some(word =>
      INTENSITY_INDICATORS.medium.includes(word)
    );
    if (mediumIntensityFound) intensity += 0.1;

    // Caps lock intensity
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.3) intensity += 0.2;

    return Math.min(intensity, 1);
  }, []);

  // Simple rule-based sentiment analysis for frontend
  const analyzeSentiment = useCallback((text: string): SentimentAnalysisResult => {
    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    const cached = sentimentCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    const words = text.toLowerCase().split(/\s+/);
    const emotionalKeywords: string[] = [];
    let positiveScore = 0;
    let negativeScore = 0;
    let intensityMultiplier = 1;

    // Count emotional keywords
    words.forEach(word => {
      if (EMOTION_KEYWORDS.positive.includes(word)) {
        positiveScore += 1;
        emotionalKeywords.push(word);
      }
      if (EMOTION_KEYWORDS.negative.includes(word)) {
        negativeScore += 1;
        emotionalKeywords.push(word);
      }
      if (EMOTION_KEYWORDS.intensity.includes(word) || word.includes('!')) {
        intensityMultiplier += 0.3;
      }
    });

    // Determine sentiment
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    let intensity = 0;

    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      intensity = Math.min(positiveScore * intensityMultiplier * 0.3, 1);
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      intensity = Math.min(negativeScore * intensityMultiplier * 0.3, 1);
    } else {
      intensity = Math.min((positiveScore + negativeScore) * intensityMultiplier * 0.2, 1);
    }

    // Calculate conversation intensity based on message characteristics
    const conversationIntensity = calculateConversationIntensity(text, words);

    const result: SentimentAnalysisResult = {
      sentiment,
      intensity,
      emotionalKeywords,
      conversationIntensity
    };

    // Cache the result
    sentimentCacheRef.current.set(cacheKey, result);

    return result;
  }, [calculateConversationIntensity]);

  // Get conversation intensity based on recent message history
  const getConversationIntensity = useCallback((messages: ClaraMessage[]): ConversationIntensityLevel => {
    const now = Date.now();
    const recentTimeWindow = 10000; // 10 seconds

    // Filter recent messages
    const recentMessages = messages.filter(msg =>
      now - msg.timestamp.getTime() < recentTimeWindow
    );

    // Calculate intensity based on recent activity
    let totalIntensity = 0;
    let messageFrequencyScore = 0;

    if (recentMessages.length === 0) {
      return { level: 'low', score: 0.2 };
    }

    // Message frequency scoring
    messageFrequencyScore = Math.min(recentMessages.length / 5, 1); // Max 5 messages in 10s = high intensity

    // Content intensity scoring
    recentMessages.forEach(msg => {
      const sentiment = analyzeSentiment(msg.content);
      totalIntensity += sentiment.conversationIntensity;
    });

    const avgContentIntensity = totalIntensity / recentMessages.length;
    const finalScore = (messageFrequencyScore * 0.4) + (avgContentIntensity * 0.6);

    // Determine intensity level
    let level: 'low' | 'medium' | 'high';
    if (finalScore >= 0.7) {
      level = 'high';
    } else if (finalScore >= 0.4) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { level, score: finalScore };
  }, [analyzeSentiment]);

  // Update UI state based on sentiment analysis
  const updateUIState = useCallback((sentiment: SentimentAnalysisResult, messages: ClaraMessage[]) => {
    // Update message history for conversation intensity tracking
    const now = Date.now();
    messageHistoryRef.current.push({
      timestamp: now,
      content: messages[messages.length - 1]?.content || '',
      sentiment
    });

    // Keep only recent history (last 30 seconds)
    messageHistoryRef.current = messageHistoryRef.current.filter(
      entry => now - entry.timestamp < 30000
    );

    // Return conversation intensity for UI updates
    return getConversationIntensity(messages);
  }, [getConversationIntensity]);

  // Clear cache periodically to prevent memory issues
  useEffect(() => {
    const interval = setInterval(() => {
      if (sentimentCacheRef.current.size > 100) {
        // Keep only the 50 most recent entries
        const entries = Array.from(sentimentCacheRef.current.entries());
        sentimentCacheRef.current.clear();
        entries.slice(-50).forEach(([key, value]) => {
          sentimentCacheRef.current.set(key, value);
        });
      }
    }, 60000); // Clean every minute

    return () => clearInterval(interval);
  }, []);

  // Get current conversation intensity level
  const getCurrentIntensityLevel = useCallback((messages: ClaraMessage[]): ConversationIntensityLevel => {
    return getConversationIntensity(messages);
  }, [getConversationIntensity]);

  return {
    analyzeSentiment,
    getConversationIntensity,
    updateUIState,
    getCurrentIntensityLevel,
    sentimentCache: sentimentCacheRef.current.size // For debugging
  };
};