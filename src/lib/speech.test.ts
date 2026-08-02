import { BrowserSpeechService, pcmToFloat32, spokenTextSoFar } from './speech';

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

// Minimal Web Audio stand-in: enough to see what got scheduled, when, and with what samples.
type FakeSource = {
  buffer: { getChannelData: () => Float32Array; duration: number } | null;
  onended: (() => void) | null;
  startedAt: number | null;
  connect: jest.Mock;
  addEventListener: jest.Mock;
  start: (t: number) => void;
  stop: jest.Mock;
};
const sources: FakeSource[] = [];
const fakeCtx = {
  currentTime: 0,
  state: 'running',
  destination: {},
  resume: jest.fn(),
  createGain: () => ({ gain: { value: 1 }, connect: jest.fn() }),
  createBuffer: (_ch: number, length: number, sampleRate: number) => {
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  },
  createBufferSource: () => {
    const src: FakeSource = {
      buffer: null,
      onended: null,
      startedAt: null,
      connect: jest.fn(),
      addEventListener: jest.fn(),
      start: (t: number) => { src.startedAt = t; },
      stop: jest.fn(() => src.onended?.()),
    };
    sources.push(src);
    return src;
  },
};
Object.defineProperty(window, 'AudioContext', { value: jest.fn(() => fakeCtx), writable: true });

// int16 mono, little-endian — what the voice server streams.
const pcm = (samples: number[]) => new Uint8Array(new Int16Array(samples).buffer);

const streamResponse = (chunks: Uint8Array[]) => {
  let i = 0;
  return {
    ok: true,
    headers: { get: (k: string) => (k === 'X-Sample-Rate' ? '24000' : 'application/octet-stream') },
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
        cancel: async () => {},
      }),
    },
  } as unknown as Response;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const requestedText = (m: jest.Mock) => m.mock.calls.map((c) => JSON.parse(c[1].body).input);

describe('Streamed PCM playback', () => {
  let speechService: BrowserSpeechService;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    sources.length = 0;
    speechService = new BrowserSpeechService();
    fetchMock = jest.fn(() => Promise.resolve(streamResponse([pcm(new Array(24000).fill(1000))])));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => { global.fetch = originalFetch; });

  test('decodes int16 to float32 at full scale', () => {
    const decoded = pcmToFloat32(pcm([0, 32767, -32768, -16384]));
    expect(Array.from(decoded).map((v) => Number(v.toFixed(3)))).toEqual([0, 1, -1, -0.5]);
  });

  test('schedules chunks back-to-back and finishes with the last one', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([pcm(new Array(24000).fill(16384)), pcm(new Array(12000).fill(-16384))])
    );
    const onEnd = jest.fn();
    speechService['isCurrentlySpeaking'] = true;
    speechService['speakChunk']('Hello there.', {}, onEnd);
    await flush();

    expect(sources).toHaveLength(2);
    expect(sources[0].startedAt).toBeCloseTo(0.35); // lead-in covers generation drift
    expect(sources[1].startedAt).toBeCloseTo(1.35); // gapless: exactly one second of audio later
    expect(sources[0].buffer!.getChannelData()[0]).toBeCloseTo(0.5);

    expect(onEnd).not.toHaveBeenCalled(); // still audible until the last chunk plays out
    sources[1].onended!();
    await flush();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('an odd byte split across reads is not dropped or misaligned', async () => {
    const bytes = pcm([32767, -32768, 16384]);
    fetchMock.mockResolvedValue(streamResponse([bytes.slice(0, 3), bytes.slice(3)]));
    speechService['isCurrentlySpeaking'] = true;
    speechService['speakChunk']('Hi.', {}, jest.fn());
    await flush();

    const decoded = sources.flatMap((s) => Array.from(s.buffer!.getChannelData()));
    expect(decoded.map((v) => Number(v.toFixed(3)))).toEqual([1, -1, 0.5]);
  });

  test('prefetches the next sentence while one plays, then reuses it', async () => {
    speechService.queueStreamingChunk('One. Two.');
    await flush();

    // "Two." was requested while "One." was still playing — in order, one in flight.
    expect(requestedText(fetchMock)).toEqual(['One.', 'Two.']);

    sources[0].onended!(); // "One." finishes
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2); // "Two." reused its prefetch instead of refetching
    expect(requestedText(fetchMock)).toEqual(['One.', 'Two.']);
  });

  test('stopSpeaking kills scheduled audio and the prefetch', async () => {
    speechService.queueStreamingChunk('One. Two.');
    await flush();
    expect(speechService['prefetched']).not.toBeNull();

    speechService.stopSpeaking();
    expect(sources[0].stop).toHaveBeenCalled();
    expect(speechService['prefetched']).toBeNull();
    expect(speechService['playCursor']).toBe(0);
  });

  // The server gives up on Qwen3 before the first chunk by answering with a whole Kokoro WAV.
  test('plays the server\'s Kokoro WAV fallback', async () => {
    const play = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'Audio', {
      value: jest.fn(() => ({ play, volume: 1, pause: jest.fn() })),
      writable: true,
    });
    global.URL.createObjectURL = jest.fn(() => 'blob:x');
    global.URL.revokeObjectURL = jest.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => 'audio/wav' },
      blob: async () => new Blob(),
    } as unknown as Response);

    speechService['isCurrentlySpeaking'] = true;
    speechService['speakChunk']('Hi.', {}, jest.fn());
    await flush();

    expect(play).toHaveBeenCalled();
    expect(sources).toHaveLength(0); // nothing went through the PCM scheduler
  });
});

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