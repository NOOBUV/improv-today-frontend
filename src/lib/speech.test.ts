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

  describe('Streaming Buffer', () => {
    test('queues on sentence end, holds partial text, flushes the remainder', () => {
      const queued: string[] = [];
      speechService.setStreamingCallbacks({ onSentenceQueued: (t) => queued.push(t) });
      // Keep the queue from draining so we can assert on what was buffered.
      speechService['isCurrentlySpeaking'] = true;

      speechService.queueStreamingChunk('Hello there. And then');
      expect(queued).toEqual(['Hello there.']);

      speechService.flushStreamingBuffer();
      expect(queued).toEqual(['Hello there.', 'And then']);
    });

    test('does not split inside a residual [pause:0.4s] marker', () => {
      const queued: string[] = [];
      speechService.setStreamingCallbacks({ onSentenceQueued: (t) => queued.push(t) });
      speechService['isCurrentlySpeaking'] = true;

      speechService.queueStreamingChunk('Wait [pause:0.4s] for it!');
      expect(queued).toEqual(['Wait [pause:0.4s] for it!']);
    });
  });

  describe('Speech State Management', () => {
    test('should stop speech and reset state', () => {
      speechService['isCurrentlySpeaking'] = true;
      speechService['speechQueue'] = ['test'];

      speechService.stopSpeaking();

      expect(speechService['isCurrentlySpeaking']).toBe(false);
      expect(speechService['speechQueue']).toHaveLength(0);
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('Browser Compatibility', () => {
    test('should handle missing speech synthesis gracefully', () => {
      const originalSynth = window.speechSynthesis;
      delete (window as any).speechSynthesis;

      const speechServiceNoSynth = new BrowserSpeechService();

      // Should not throw when streaming text at a browser with no speechSynthesis
      expect(() => {
        speechServiceNoSynth.queueStreamingChunk('test.');
        speechServiceNoSynth.flushStreamingBuffer();
      }).not.toThrow();

      // Restore
      (window as any).speechSynthesis = originalSynth;
    });
  });
});