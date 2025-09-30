import { BrowserSpeechService } from './speech';

// Mock Web Speech API
const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  getVoices: jest.fn(() => [
    { name: 'Google UK English Female', lang: 'en-GB', localService: false, default: false },
    { name: 'Microsoft Hazel - English (Great Britain)', lang: 'en-GB', localService: true, default: true }
  ])
};

const mockSpeechRecognition = jest.fn();

// Setup global mocks
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
  writable: true
});

Object.defineProperty(window, 'SpeechRecognition', {
  value: mockSpeechRecognition,
  writable: true
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: mockSpeechRecognition,
  writable: true
});

global.SpeechSynthesisUtterance = jest.fn().mockImplementation(() => ({
  text: '',
  voice: null,
  rate: 1,
  pitch: 1,
  volume: 1,
  lang: 'en-US',
  onend: null,
  onerror: null
}));

describe('BrowserSpeechService - Speech Enhancement', () => {
  let speechService: BrowserSpeechService;

  beforeEach(() => {
    jest.clearAllMocks();
    speechService = new BrowserSpeechService();
  });

  describe('Pause Marker Parsing', () => {
    test('should parse basic pause markers', () => {
      const text = 'Hello [pause:500ms] there [breath] how are you [thinking] today?';
      const chunks = speechService['parseTextWithPauses'](text);

      expect(chunks).toHaveLength(4);
      expect(chunks[0].text).toBe('Hello');
      expect(chunks[0].pauseAfter).toBe(500);
      expect(chunks[1].text).toBe('there');
      expect(chunks[1].pauseAfter).toBe(800); // breath default
      expect(chunks[2].text).toBe('how are you');
      expect(chunks[2].pauseAfter).toBe(1200); // thinking default
      expect(chunks[3].text).toBe('today?');
    });

    test('should handle text without pause markers', () => {
      const text = 'Hello there how are you today?';
      const chunks = speechService['parseTextWithPauses'](text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
      expect(chunks[0].pauseAfter).toBeUndefined();
    });

    test('should handle empty text', () => {
      const chunks = speechService['parseTextWithPauses']('');
      expect(chunks).toHaveLength(0);
    });

    test('should handle pause at beginning', () => {
      const text = '[pause:300ms] Hello there';
      const chunks = speechService['parseTextWithPauses'](text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].text).toBe('');
      expect(chunks[0].pauseAfter).toBe(300);
      expect(chunks[1].text).toBe('Hello there');
    });
  });

  describe('Mood-Based Timing', () => {
    test('should apply excited mood timing', () => {
      const moodTiming = speechService.createMoodBasedTiming('excited', 7);

      expect(moodTiming.rhythmPattern).toBe('excited');
      expect(moodTiming.baseRate).toBeGreaterThan(1.0);
      expect(moodTiming.basePitch).toBeGreaterThan(1.0);
      expect(moodTiming.pauseMultiplier).toBeLessThan(1.0);
    });

    test('should apply calm mood timing', () => {
      const moodTiming = speechService.createMoodBasedTiming('calm', 3);

      expect(moodTiming.rhythmPattern).toBe('calm');
      expect(moodTiming.baseRate).toBeLessThan(1.0);
      expect(moodTiming.basePitch).toBeLessThan(1.0);
      expect(moodTiming.pauseMultiplier).toBeGreaterThan(1.0);
    });

    test('should apply BPM adjustment from HeartbeatIcon', () => {
      const fastBpm = speechService.createMoodBasedTiming('neutral', 5, 90);
      const slowBpm = speechService.createMoodBasedTiming('neutral', 5, 45);

      expect(fastBpm.baseRate).toBeGreaterThan(slowBpm.baseRate);
      expect(fastBpm.pauseMultiplier).toBeLessThan(slowBpm.pauseMultiplier);
    });

    test('should clamp values within Web Speech API limits', () => {
      const extremeMood = speechService.createMoodBasedTiming('excited', 10, 120);

      expect(extremeMood.baseRate).toBeLessThanOrEqual(10);
      expect(extremeMood.baseRate).toBeGreaterThanOrEqual(0.1);
      expect(extremeMood.basePitch).toBeLessThanOrEqual(2);
      expect(extremeMood.basePitch).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pause Duration Calculation', () => {
    test('should calculate base pause durations', () => {
      const pauseDuration = speechService['calculatePauseDuration']('pause', null);
      const breathDuration = speechService['calculatePauseDuration']('breath', null);
      const thinkingDuration = speechService['calculatePauseDuration']('thinking', null);

      expect(pauseDuration).toBe(500);
      expect(breathDuration).toBe(800);
      expect(thinkingDuration).toBe(1200);
    });

    test('should use explicit duration when provided', () => {
      const explicitDuration = speechService['calculatePauseDuration']('pause', 750);
      expect(explicitDuration).toBe(750);
    });

    test('should apply mood-based adjustments', () => {
      const excitedTiming = { rhythmPattern: 'excited' as const, pauseMultiplier: 0.6 };
      const calmTiming = { rhythmPattern: 'calm' as const, pauseMultiplier: 1.4 };

      const excitedPause = speechService['calculatePauseDuration']('pause', null, excitedTiming);
      const calmPause = speechService['calculatePauseDuration']('pause', null, calmTiming);

      expect(excitedPause).toBeLessThan(500); // Shorter for excited
      expect(calmPause).toBeGreaterThan(500); // Longer for calm
    });

    test('should handle nervous irregular timing', () => {
      const nervousTiming = { rhythmPattern: 'nervous' as const, pauseMultiplier: 1.0 };

      const nervousThinking = speechService['calculatePauseDuration']('thinking', null, nervousTiming);
      const nervousPause = speechService['calculatePauseDuration']('pause', null, nervousTiming);

      expect(nervousThinking).toBeGreaterThan(1200 * 1.5); // Longer thinking
      expect(nervousPause).toBeLessThan(500); // Shorter regular pauses
    });

    test('should clamp duration within reasonable bounds', () => {
      const extremeTiming = { rhythmPattern: 'calm' as const, pauseMultiplier: 10.0 };
      const tinyTiming = { rhythmPattern: 'excited' as const, pauseMultiplier: 0.01 };

      const longPause = speechService['calculatePauseDuration']('pause', null, extremeTiming);
      const shortPause = speechService['calculatePauseDuration']('pause', null, tinyTiming);

      expect(longPause).toBeLessThanOrEqual(3000); // Max 3 seconds
      expect(shortPause).toBeGreaterThanOrEqual(100); // Min 100ms
    });
  });

  describe('Intelligent Pause Injection', () => {
    test('should inject pauses after sentences', () => {
      const text = 'Hello there. How are you? Great!';
      const enhanced = speechService.injectPauseMarkers(text, 'neutral');

      expect(enhanced).toContain('[breath]');
      expect(enhanced.split('[breath]')).toHaveLength(3); // Two sentences = 2 pauses
    });

    test('should inject thinking pauses before questions', () => {
      const text = 'I was wondering, how are you feeling today?';
      const enhanced = speechService.injectPauseMarkers(text, 'neutral');

      expect(enhanced).toContain('[thinking]');
      expect(enhanced.indexOf('[thinking]')).toBeLessThan(enhanced.indexOf('?'));
    });

    test('should adjust pauses based on emotional state', () => {
      const text = 'Hello there. How are you?';
      const excitedText = speechService.injectPauseMarkers(text, 'excited');
      const sadText = speechService.injectPauseMarkers(text, 'sad');

      // Excited should have shorter pauses
      expect(excitedText).toContain('[pause:400ms]');
      // Sad should have longer pauses
      expect(sadText).toContain('[pause:800ms]');
    });

    test('should add emphasis pauses around capitalized words', () => {
      const text = 'This is VERY important indeed';
      const enhanced = speechService.injectPauseMarkers(text, 'neutral');

      expect(enhanced).toContain('[pause:200ms] VERY [pause:200ms]');
    });

    test('should add thinking pauses before complex explanations', () => {
      const text = 'I think so because it makes sense';
      const enhanced = speechService.injectPauseMarkers(text, 'neutral');

      expect(enhanced).toContain('[thinking] because');
    });
  });

  describe('Mood-Based Speech Options', () => {
    test('should apply mood timing to speech options', () => {
      const baseOptions = {
        rate: 0.9,
        pitch: 1.0,
        moodBasedTiming: speechService.createMoodBasedTiming('excited', 6)
      };

      const enhancedOptions = speechService['applyMoodBasedTiming'](baseOptions);

      expect(enhancedOptions.rate).toBeGreaterThan(0.9);
      expect(enhancedOptions.pitch).toBeGreaterThan(1.0);
    });

    test('should preserve options without mood timing', () => {
      const baseOptions = { rate: 0.8, pitch: 1.1 };
      const enhancedOptions = speechService['applyMoodBasedTiming'](baseOptions);

      expect(enhancedOptions.rate).toBe(0.8);
      expect(enhancedOptions.pitch).toBe(1.1);
    });
  });

  describe('Speech State Management', () => {
    test('should track speaking state', () => {
      expect(speechService.isSpeaking()).toBe(false);
    });

    test('should stop speech and reset state', () => {
      speechService['isCurrentlySpeaking'] = true;
      speechService['speechQueue'] = [{ text: 'test' }];

      speechService.stopSpeaking();

      expect(speechService.isSpeaking()).toBe(false);
      expect(speechService['speechQueue']).toHaveLength(0);
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('Browser Compatibility', () => {
    test('should handle missing speech synthesis gracefully', () => {
      const originalSynth = window.speechSynthesis;
      delete (window as any).speechSynthesis;

      const speechServiceNoSynth = new BrowserSpeechService();

      // Should not throw when trying to speak
      expect(() => {
        speechServiceNoSynth.speak('test');
      }).not.toThrow();

      // Restore
      (window as any).speechSynthesis = originalSynth;
    });

    test('should provide fallback mechanisms', () => {
      // Mock scenario where voices are not immediately available
      mockSpeechSynthesis.getVoices.mockReturnValue([]);

      const speechServiceNoVoices = new BrowserSpeechService();
      const voices = speechServiceNoVoices.getVoices();

      expect(voices).toHaveLength(0); // Should handle gracefully
    });
  });
});