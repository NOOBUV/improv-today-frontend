/**
 * Tests for StreamingConversationService
 * Story 3.3: Speech Optimization & Clara's Response Performance
 */

import { StreamingConversationService, StreamingConversationClient } from './streamingConversationService';

// Mock Web APIs for testing environment
global.fetch = jest.fn();

// Mock ReadableStream for Node.js environment
global.ReadableStream = class ReadableStream {
  constructor(private source: any) {}

  getReader() {
    const encoder = new TextEncoder();
    const chunks = this.source.chunks || [];
    let index = 0;

    return {
      read: async () => {
        if (index < chunks.length) {
          const chunk = chunks[index++];
          return { done: false, value: encoder.encode(chunk) };
        }
        return { done: true, value: undefined };
      },
      releaseLock: () => {}
    };
  }
} as any;

// Mock TextEncoder for Node.js environment
global.TextEncoder = class TextEncoder {
  encode(text: string): Uint8Array {
    return new Uint8Array(Buffer.from(text));
  }
} as any;

// Mock TextDecoder for Node.js environment
global.TextDecoder = class TextDecoder {
  decode(data: Uint8Array): string {
    return Buffer.from(data).toString();
  }
} as any;

describe('StreamingConversationService', () => {
  let service: StreamingConversationService;

  beforeEach(() => {
    service = new StreamingConversationService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.cancelStream();
  });

  describe('constructor', () => {
    it('should initialize with default base URL', () => {
      const defaultService = new StreamingConversationService();
      expect(defaultService).toBeDefined();
    });

    it('should initialize with custom base URL', () => {
      const customService = new StreamingConversationService('/custom/api');
      expect(customService).toBeDefined();
    });
  });

  describe('isStreaming', () => {
    it('should return false when no stream is active', () => {
      expect(service.isStreaming()).toBe(false);
    });

    it('should return true when stream is active', async () => {
      const mockReadableStream = new ReadableStream({
        chunks: ['event: test\ndata: {"test": true}\n\n']
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      });

      const streamPromise = service.streamConversation(
        { message: 'test' },
        {},
        'test-token'
      );

      // Check if streaming is active
      expect(service.isStreaming()).toBe(true);

      await streamPromise;
    });
  });

  describe('cancelStream', () => {
    it('should cancel active stream', async () => {
      const mockReadableStream = new ReadableStream({
        chunks: ['event: test\ndata: {"test": true}\n\n']
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      });

      const streamPromise = service.streamConversation(
        { message: 'test' },
        {},
        'test-token'
      );

      expect(service.isStreaming()).toBe(true);

      service.cancelStream();

      expect(service.isStreaming()).toBe(false);

      // The promise should resolve without error due to cancellation
      await expect(streamPromise).resolves.toBeUndefined();
    });
  });

  describe('streamConversation', () => {
    it('should handle successful stream with multiple events', async () => {
      const mockEvents = [
        'event: processing_start\ndata: {"status": "starting", "correlation_id": "test-id"}\n\n',
        'event: consciousness_chunk\ndata: {"chunk": "Hello", "correlation_id": "test-id"}\n\n',
        'event: processing_complete\ndata: {"response": "Hello world", "success": true, "correlation_id": "test-id"}\n\n'
      ];

      const mockReadableStream = new ReadableStream({
        chunks: mockEvents
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      });

      const callbacks = {
        onProcessingStart: jest.fn(),
        onConsciousnessChunk: jest.fn(),
        onProcessingComplete: jest.fn(),
      };

      await service.streamConversation(
        { message: 'test' },
        callbacks,
        'test-token'
      );

      expect(fetch).toHaveBeenCalledWith('/api/backend/conversation/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ message: 'test' }),
        signal: expect.any(AbortSignal),
      });

      expect(callbacks.onProcessingStart).toHaveBeenCalledWith({
        status: 'starting',
        correlation_id: 'test-id'
      });

      expect(callbacks.onConsciousnessChunk).toHaveBeenCalledWith({
        chunk: 'Hello',
        correlation_id: 'test-id'
      });

      expect(callbacks.onProcessingComplete).toHaveBeenCalledWith({
        response: 'Hello world',
        success: true,
        correlation_id: 'test-id'
      });
    });

    it('should handle HTTP errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const callbacks = {
        onError: jest.fn(),
      };

      await expect(service.streamConversation(
        { message: 'test' },
        callbacks,
        'test-token'
      )).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const callbacks = {
        onError: jest.fn(),
      };

      await expect(service.streamConversation(
        { message: 'test' },
        callbacks,
        'test-token'
      )).rejects.toThrow('Network error');

      expect(callbacks.onError).toHaveBeenCalledWith({
        correlation_id: 'unknown',
        error: 'Network error',
        timestamp: expect.any(String)
      });
    });

    it('should handle malformed SSE data gracefully', async () => {
      const mockMalformedEvents = [
        'event: test\ndata: invalid-json\n\n',
        'event: test\ndata: {"valid": "json"}\n\n'
      ];

      const mockReadableStream = new ReadableStream({
        start(controller) {
          mockMalformedEvents.forEach(event => {
            controller.enqueue(new TextEncoder().encode(event));
          });
          controller.close();
        }
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      });

      const callbacks = {
        onProcessingStart: jest.fn(),
      };

      // Should not throw error due to malformed JSON
      await expect(service.streamConversation(
        { message: 'test' },
        callbacks,
        'test-token'
      )).resolves.toBeUndefined();
    });
  });
});

describe('StreamingConversationClient', () => {
  let client: StreamingConversationClient;

  beforeEach(() => {
    client = new StreamingConversationClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    client.cancel();
  });

  describe('startConversation', () => {
    it('should accumulate response chunks correctly', async () => {
      const mockEvents = [
        'event: consciousness_chunk\ndata: {"chunk": "Hello ", "correlation_id": "test"}\n\n',
        'event: consciousness_chunk\ndata: {"chunk": "world!", "correlation_id": "test"}\n\n',
        'event: processing_complete\ndata: {"response": "Hello world!", "success": true, "correlation_id": "test"}\n\n'
      ];

      const mockReadableStream = new ReadableStream({
        chunks: mockEvents
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      });

      const chunkCallback = jest.fn();
      const completeCallback = jest.fn();

      await client.startConversation(
        { message: 'test' },
        'test-token',
        {
          onChunk: chunkCallback,
          onComplete: completeCallback
        }
      );

      expect(chunkCallback).toHaveBeenNthCalledWith(1, 'Hello ', 'Hello ');
      expect(chunkCallback).toHaveBeenNthCalledWith(2, 'world!', 'Hello world!');

      expect(completeCallback).toHaveBeenCalledWith({
        response: 'Hello world!',
        success: true,
        correlation_id: 'test'
      });

      expect(client.getCurrentResponse()).toBe('Hello world!');
    });

    it('should handle errors correctly', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const errorCallback = jest.fn();

      await client.startConversation(
        { message: 'test' },
        'test-token',
        {
          onError: errorCallback
        }
      );

      expect(errorCallback).toHaveBeenCalledWith('Connection failed');
    });

    it('should reset response state on new conversation', async () => {
      // Set initial response
      client['currentResponse'] = 'previous response';

      const mockReadableStream = new ReadableStream({
        chunks: ['event: consciousness_chunk\ndata: {"chunk": "New response", "correlation_id": "test"}\n\n']
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockReadableStream,
      });

      const chunkCallback = jest.fn();

      await client.startConversation(
        { message: 'test' },
        'test-token',
        { onChunk: chunkCallback }
      );

      expect(chunkCallback).toHaveBeenCalledWith('New response', 'New response');
      expect(client.getCurrentResponse()).toBe('New response');
    });
  });

  describe('cancel', () => {
    it('should cancel active conversation', () => {
      expect(() => client.cancel()).not.toThrow();
    });
  });

  describe('isActive', () => {
    it('should return correct streaming status', () => {
      expect(client.isActive()).toBe(false);
    });
  });

  describe('getCurrentResponse', () => {
    it('should return current accumulated response', () => {
      expect(client.getCurrentResponse()).toBe('');
    });
  });
});