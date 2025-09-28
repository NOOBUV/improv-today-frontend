import { renderHook, act } from '@testing-library/react';
import { useSentimentAnalysis } from './useSentimentAnalysis';
import { ClaraMessage } from '@/store/claraStore';

// Mock data for testing
const createMessage = (content: string, role: 'user' | 'assistant' = 'user', minutesAgo = 0): ClaraMessage => ({
  id: `test-${Date.now()}-${Math.random()}`,
  role,
  content,
  timestamp: new Date(Date.now() - minutesAgo * 60000)
});

describe('useSentimentAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment correctly', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const positiveText = "I love this amazing experience! It's wonderful and great!";
      const sentiment = result.current.analyzeSentiment(positiveText);

      expect(sentiment.sentiment).toBe('positive');
      expect(sentiment.intensity).toBeGreaterThan(0);
      expect(sentiment.emotionalKeywords).toContain('love');
      expect(sentiment.emotionalKeywords).toContain('amazing');
      expect(sentiment.emotionalKeywords).toContain('wonderful');
      expect(sentiment.emotionalKeywords).toContain('great');
    });

    it('should analyze negative sentiment correctly', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const negativeText = "I hate this terrible experience! It's awful and bad!";
      const sentiment = result.current.analyzeSentiment(negativeText);

      expect(sentiment.sentiment).toBe('negative');
      expect(sentiment.intensity).toBeGreaterThan(0);
      expect(sentiment.emotionalKeywords).toContain('hate');
      expect(sentiment.emotionalKeywords).toContain('terrible');
      expect(sentiment.emotionalKeywords).toContain('awful');
      expect(sentiment.emotionalKeywords).toContain('bad');
    });

    it('should analyze neutral sentiment correctly', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const neutralText = "The weather is okay today. Nothing special happening.";
      const sentiment = result.current.analyzeSentiment(neutralText);

      expect(sentiment.sentiment).toBe('neutral');
      expect(sentiment.intensity).toBeLessThanOrEqual(0.5);
    });

    it('should detect conversation intensity based on text characteristics', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const highIntensityText = "URGENT!!! I need help immediately! This is a crisis!!!";
      const sentiment = result.current.analyzeSentiment(highIntensityText);

      expect(sentiment.conversationIntensity).toBeGreaterThan(0.7);
    });

    it('should cache sentiment results', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      act(() => {
        const text = "This is a test message for caching";
        const firstAnalysis = result.current.analyzeSentiment(text);
        const secondAnalysis = result.current.analyzeSentiment(text);

        expect(firstAnalysis).toEqual(secondAnalysis);
        expect(result.current.sentimentCache).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getConversationIntensity', () => {
    it('should return low intensity for few messages', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const messages = [
        createMessage("Hello there")
      ];

      const intensity = result.current.getConversationIntensity(messages);
      expect(intensity.level).toBe('low');
    });

    it('should return high intensity for many recent messages', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const messages = [
        createMessage("Help me!", 'user', 0),
        createMessage("I'm here to help", 'assistant', 0),
        createMessage("This is urgent!", 'user', 0),
        createMessage("I understand", 'assistant', 0),
        createMessage("Please fix this quickly!", 'user', 0)
      ];

      const intensity = result.current.getConversationIntensity(messages);
      expect(intensity.level).toBe('high');
      expect(intensity.score).toBeGreaterThan(0.6);
    });

    it('should return medium intensity for moderate activity', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const messages = [
        createMessage("I need some help", 'user', 0),
        createMessage("Sure, what can I do?", 'assistant', 0),
        createMessage("Could you assist me?", 'user', 0)
      ];

      const intensity = result.current.getConversationIntensity(messages);
      expect(['medium', 'high']).toContain(intensity.level);
    });

    it('should ignore old messages in intensity calculation', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const messages = [
        createMessage("Old message 1", 'user', 15), // 15 minutes ago
        createMessage("Old message 2", 'user', 10), // 10 minutes ago
        createMessage("Recent message", 'user', 0)   // Now
      ];

      const intensity = result.current.getConversationIntensity(messages);
      expect(intensity.level).toBe('low'); // Should only consider recent message
    });
  });

  describe('getCurrentIntensityLevel', () => {
    it('should return consistent intensity levels', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const messages = [
        createMessage("Test message", 'user', 0)
      ];

      const intensity1 = result.current.getCurrentIntensityLevel(messages);
      const intensity2 = result.current.getCurrentIntensityLevel(messages);

      expect(intensity1).toEqual(intensity2);
    });
  });

  describe('updateUIState', () => {
    it('should update UI state and return conversation intensity', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const sentiment = {
        sentiment: 'positive' as const,
        intensity: 0.8,
        emotionalKeywords: ['happy', 'great'],
        conversationIntensity: 0.6
      };

      const messages = [
        createMessage("I'm really happy with this!")
      ];

      const intensity = result.current.updateUIState(sentiment, messages);

      expect(intensity.level).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(intensity.level);
      expect(intensity.score).toBeGreaterThanOrEqual(0);
      expect(intensity.score).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages array', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const intensity = result.current.getConversationIntensity([]);
      expect(intensity.level).toBe('low');
      expect(intensity.score).toBeLessThanOrEqual(0.3);
    });

    it('should handle empty text analysis', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const sentiment = result.current.analyzeSentiment("");
      expect(sentiment.sentiment).toBe('neutral');
      expect(sentiment.intensity).toBe(0);
      expect(sentiment.emotionalKeywords).toHaveLength(0);
    });

    it('should handle special characters and numbers', () => {
      const { result } = renderHook(() => useSentimentAnalysis());

      const sentiment = result.current.analyzeSentiment("@#$% 123 !@# amazing $$$ terrible");
      expect(sentiment.emotionalKeywords).toContain('amazing');
      expect(sentiment.emotionalKeywords).toContain('terrible');
    });
  });
});