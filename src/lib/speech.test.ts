import { BrowserSpeechService, spokenTextSoFar } from './speech';

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

  // Regression: a plain-text stream used to extract to '' — the transcript showed the reply
  // and Clara never said it. Chunks below are real captures from the backend.
  describe('spokenTextSoFar', () => {
    test('reads a JSON-wrapped stream and stops at the closing quote', () => {
      expect(spokenTextSoFar('{\n    "message": "Hey. I\'m ahead of')).toBe("Hey. I'm ahead of");
      expect(spokenTextSoFar('{\n "message": "Hey. Done.",\n "emotion": "calm"\n}')).toBe('Hey. Done.');
    });

    test('speaks a plain-text stream as-is', () => {
      expect(spokenTextSoFar("It's been a lot today.")).toBe("It's been a lot today.");
    });

    test('waits rather than leaking JSON before the message field arrives', () => {
      expect(spokenTextSoFar('{')).toBe('');
    });

    test('unescapes without ending the value on an escaped quote', () => {
      expect(spokenTextSoFar('{"message": "He said \\"hi\\".\\nThen left.",')).toBe('He said "hi". Then left.');
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

  // Regression: onComplete used to fire whenever the queue transiently emptied. Mid-reply that
  // means setAISpeaking(false) + auto-restart of the mic while Clara is still talking.
  describe('Turn end', () => {
    test('a mid-reply gap does not end the turn; the drain after the stream ends does, once', () => {
      const onComplete = jest.fn();
      speechService.setStreamingCallbacks({ onComplete });
      speechService['isCurrentlySpeaking'] = true;

      speechService.queueStreamingChunk('First sentence.');
      // Audio finished before the next chunk arrived — the queue is empty but the stream isn't done.
      speechService['speechQueue'] = [];
      speechService['speakNextChunk']();
      expect(onComplete).not.toHaveBeenCalled();
      expect(speechService['isCurrentlySpeaking']).toBe(false);

      // Rest of the reply arrives and starts playing, then the stream ends.
      speechService['isCurrentlySpeaking'] = true;
      speechService.queueStreamingChunk('Second sentence.');
      speechService.flushStreamingBuffer();
      expect(onComplete).not.toHaveBeenCalled(); // still speaking

      speechService['speechQueue'] = [];
      speechService['speakNextChunk']();
      expect(onComplete).toHaveBeenCalledTimes(1);

      speechService['speakNextChunk'](); // a stray drain must not re-fire
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    test('an aborted stream that queued nothing still ends the turn', () => {
      const onComplete = jest.fn();
      speechService.setStreamingCallbacks({ onComplete });

      speechService.queueStreamingChunk(''); // turn started, then the stream errored out
      speechService.flushStreamingBuffer();

      expect(onComplete).toHaveBeenCalledTimes(1);
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