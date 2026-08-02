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

// Setup global mocks
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
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

  describe('Mood-Based Timing', () => {
    test('should apply excited mood timing', () => {
      const moodTiming = speechService.createMoodBasedTiming('excited', 7);

      expect(moodTiming.rhythmPattern).toBe('excited');
      expect(moodTiming.baseRate).toBeGreaterThan(1.0);
      expect(moodTiming.basePitch).toBeGreaterThan(1.0);
    });

    test('should apply calm mood timing', () => {
      const moodTiming = speechService.createMoodBasedTiming('calm', 3);

      expect(moodTiming.rhythmPattern).toBe('calm');
      expect(moodTiming.baseRate).toBeLessThan(1.0);
      expect(moodTiming.basePitch).toBeLessThan(1.0);
    });

    test('should apply BPM adjustment from HeartbeatIcon', () => {
      const fastBpm = speechService.createMoodBasedTiming('neutral', 5, 90);
      const slowBpm = speechService.createMoodBasedTiming('neutral', 5, 45);

      expect(fastBpm.baseRate).toBeGreaterThan(slowBpm.baseRate);
    });

    test('should clamp values within Web Speech API limits', () => {
      const extremeMood = speechService.createMoodBasedTiming('excited', 10, 120);

      expect(extremeMood.baseRate).toBeLessThanOrEqual(10);
      expect(extremeMood.baseRate).toBeGreaterThanOrEqual(0.1);
      expect(extremeMood.basePitch).toBeLessThanOrEqual(2);
      expect(extremeMood.basePitch).toBeGreaterThanOrEqual(0);
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

  describe('Residual Speech Markup', () => {
    test('strips markup before synthesis (Kokoro and browser fallback)', async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 });
      global.fetch = fetchMock as unknown as typeof fetch;

      speechService['isCurrentlySpeaking'] = true;
      speechService['speakChunk']('hey [pause:0.4s] there [volume:soft] friend', {});

      // Kokoro gets the cleaned text...
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).input).toBe('hey there friend');

      // ...and so does the browser fallback once Kokoro rejects.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(global.SpeechSynthesisUtterance).toHaveBeenCalledWith('hey there friend');

      global.fetch = originalFetch;
    });
  });

  describe('Speech State Management', () => {
    test('should track speaking state', () => {
      expect(speechService.isSpeaking()).toBe(false);
    });

    test('should stop speech and reset state', () => {
      speechService['isCurrentlySpeaking'] = true;
      speechService['speechQueue'] = ['test'];

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