/**
 * Streaming Conversation Service for Story 3.3: Speech Optimization & Clara's Response Performance
 *
 * Handles Server-Sent Events (SSE) streaming from the backend to provide progressive
 * response delivery and reduced perceived latency.
 */

import { SimulationContext, VocabularySuggestion } from '@/store/conversationStore';

export interface StreamingEvent {
  type: 'processing_start' | 'context_ready' | 'consciousness_chunk' | 'analysis_ready' | 'suggestion_ready' | 'processing_complete' | 'error';
  data: any;
}

export interface StreamingCallbacks {
  onProcessingStart?: (data: { correlation_id: string; status: string; timestamp: string }) => void;
  onContextReady?: (data: { correlation_id: string; context_items: number; suggested_word: string | null; processing_time_ms: number }) => void;
  onConsciousnessChunk?: (data: { correlation_id: string; chunk: string; total_length: number; timestamp: string }) => void;
  onAnalysisReady?: (data: { correlation_id: string; vocabulary_tier: string; vocabulary_score: number; processing_time_ms: number }) => void;
  onSuggestionReady?: (data: { correlation_id: string; suggestion: VocabularySuggestion }) => void;
  onProcessingComplete?: (data: CompleteResponse) => void;
  onError?: (data: { correlation_id: string; error: string; timestamp: string }) => void;
}

export interface CompleteResponse {
  correlation_id: string;
  response: string;
  feedback: any;
  vocabulary_tier: any;
  usage_analysis: any;
  suggestion: VocabularySuggestion | null;
  used_suggestion_id: string | null;
  remediation_feedback: string | null;
  simulation_context: SimulationContext;
  selected_backstory_types: string[];
  performance_metrics: {
    total_time_ms: number;
    consciousness_time_ms: number;
    context_time_ms: number;
    analysis_time_ms: number;
    update_time_ms: number;
    chunks_delivered: number;
  };
  success: boolean;
  timestamp: string;
}

export interface ConversationRequest {
  message: string;
  session_id?: number;
  personality?: string;
  target_vocabulary?: any[];
  session_type?: string;
  topic?: string;
  last_ai_reply?: string;
}

export class StreamingConversationService {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl: string = '/api/backend/conversation') {
    this.baseUrl = baseUrl;
  }

  /**
   * Stream conversation response using Server-Sent Events.
   *
   * @param request - Conversation request parameters
   * @param callbacks - Event callbacks for handling streaming events
   * @param authToken - Authentication token for the request
   * @returns Promise that resolves when streaming is complete
   */
  async streamConversation(
    request: ConversationRequest,
    callbacks: StreamingCallbacks,
    authToken: string
  ): Promise<void> {
    // Cancel any existing stream
    this.cancelStream();

    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.baseUrl}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const streamStartTime = performance.now();

      try {
        while (true) {
          const readStartTime = performance.now();
          const { done, value } = await reader.read();
          const readEndTime = performance.now();

          console.log(`[STREAM TIMING] reader.read() took ${(readEndTime - readStartTime).toFixed(1)}ms, elapsed: ${(readEndTime - streamStartTime).toFixed(1)}ms`);

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim() === '') continue;

            try {
              // Parse SSE format
              if (line.startsWith('event: ')) {
                // Skip event type line for now
                continue;
              }

              if (line.startsWith('data: ')) {
                const eventData = line.substring(6).trim();
                const data = JSON.parse(eventData);

                // Route to appropriate callback based on event type
                await this.handleStreamEvent(data, callbacks);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE event:', line, parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Streaming conversation was cancelled');
        return;
      }

      console.error('Streaming conversation failed:', error);

      // Call error callback if available
      if (callbacks.onError) {
        callbacks.onError({
          correlation_id: 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }

      throw error;
    }
  }

  /**
   * Handle individual streaming events and route to appropriate callbacks.
   */
  private async handleStreamEvent(eventData: any, callbacks: StreamingCallbacks): Promise<void> {
    try {
      // Determine event type from data structure
      if (eventData.status === 'starting') {
        callbacks.onProcessingStart?.(eventData);
      } else if (eventData.context_items !== undefined) {
        callbacks.onContextReady?.(eventData);
      } else if (eventData.chunk !== undefined) {
        callbacks.onConsciousnessChunk?.(eventData);
      } else if (eventData.vocabulary_tier !== undefined && eventData.vocabulary_score !== undefined) {
        callbacks.onAnalysisReady?.(eventData);
      } else if (eventData.suggestion !== undefined) {
        callbacks.onSuggestionReady?.(eventData);
      } else if (eventData.response !== undefined && eventData.success !== undefined) {
        callbacks.onProcessingComplete?.(eventData as CompleteResponse);
      } else if (eventData.error !== undefined) {
        callbacks.onError?.(eventData);
      }
    } catch (error) {
      console.error('Error handling stream event:', error, eventData);
    }
  }

  /**
   * Cancel the current streaming request.
   */
  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if a stream is currently active.
   */
  isStreaming(): boolean {
    return this.abortController !== null;
  }
}

/**
 * React hook for using streaming conversation service with state management.
 */
export class StreamingConversationClient {
  private service: StreamingConversationService;
  private currentResponse: string = '';
  private currentEmotion: string = 'calm';  // Track current emotion from stream
  private accumulatedJson: string = '';  // Accumulate raw JSON for parsing
  private insideMessage: boolean = false;  // Track if we're inside "message" field
  private messageStarted: boolean = false;  // Track if we've found message field
  private onChunkCallback?: (chunk: string, totalResponse: string, emotion: string) => void;
  private onCompleteCallback?: (response: CompleteResponse) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(baseUrl?: string) {
    this.service = new StreamingConversationService(baseUrl);
  }

  /**
   * Filter JSON structure from raw chunks on-the-fly.
   * Extracts only the message content as chunks arrive and parses emotion.
   */
  private filterJsonChunk(rawChunk: string): string {
    this.accumulatedJson += rawChunk;

    // Extract emotion value if present in accumulated JSON
    this.extractEmotion();

    // STATE 1: Looking for "message": " pattern - wait until we have the opening quote
    if (!this.messageStarted) {
      // Check if we've found the complete "message": " pattern
      const messageFieldPattern = /"message"\s*:\s*"/;
      if (messageFieldPattern.test(this.accumulatedJson)) {
        this.messageStarted = true;
        this.insideMessage = true;

        // Find where actual message content starts (after "message": ")
        const match = this.accumulatedJson.match(messageFieldPattern);
        if (match) {
          const patternEndIdx = (match.index || 0) + match[0].length;
          const alreadyAccumulated = this.accumulatedJson.substring(patternEndIdx);

          // Return any content that's already accumulated after the opening quote
          return alreadyAccumulated;
        }
      }
      return ''; // Still waiting for message field to start
    }

    // STATE 2: Inside message field - return content unless it's the closing
    if (this.insideMessage) {
      // Check if message is ending (look for ",\n or ", followed by "emotion")
      if (rawChunk.includes('",') || (rawChunk.includes('"') && this.accumulatedJson.includes('"emotion"'))) {
        this.insideMessage = false;

        // Return content before the closing quote
        const endIdx = rawChunk.indexOf('"');
        if (endIdx > 0) {
          return rawChunk.substring(0, endIdx);
        }
        return '';
      }

      // Regular message content - return as-is
      return rawChunk;
    }

    // STATE 3: Outside message (JSON structure) - skip
    return '';
  }

  /**
   * Map backend emotion types to frontend EmotionalMood types.
   * Backend: calm, happy, sad, stressed, sassy
   * Frontend: neutral, happy, sad, angry, excited, calm, frustrated, surprised
   */
  private mapEmotionToMood(backendEmotion: string): string {
    const emotionMap: Record<string, string> = {
      'calm': 'calm',
      'happy': 'happy',
      'sad': 'sad',
      'stressed': 'frustrated',  // Map stressed -> frustrated
      'sassy': 'excited',        // Map sassy -> excited
      'neutral': 'calm',         // Map neutral -> calm
      'angry': 'angry',
      'excited': 'excited',
      'frustrated': 'frustrated',
      'surprised': 'surprised'
    };

    return emotionMap[backendEmotion.toLowerCase()] || 'calm';
  }

  /**
   * Extract emotion value from accumulated JSON.
   * Looks for "emotion": "value" pattern.
   */
  private extractEmotion(): void {
    const emotionMatch = this.accumulatedJson.match(/"emotion"\s*:\s*"([^"]+)"/);
    if (emotionMatch && emotionMatch[1]) {
      const backendEmotion = emotionMatch[1];
      const mappedEmotion = this.mapEmotionToMood(backendEmotion);

      if (mappedEmotion !== this.currentEmotion) {
        console.log(`🎭 Emotion detected: ${this.currentEmotion} → ${mappedEmotion} (backend: ${backendEmotion})`);
        this.currentEmotion = mappedEmotion;
      }
    }
  }

  /**
   * Start streaming conversation with integrated chunk handling.
   */
  async startConversation(
    request: ConversationRequest,
    authToken: string,
    options: {
      onChunk?: (chunk: string, totalResponse: string, emotion: string) => void;
      onComplete?: (response: CompleteResponse) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<void> {
    // Reset state for new conversation
    this.currentResponse = '';
    this.currentEmotion = 'calm';
    this.accumulatedJson = '';
    this.insideMessage = false;
    this.messageStarted = false;

    if (options.onChunk) this.onChunkCallback = options.onChunk;
    if (options.onComplete) this.onCompleteCallback = options.onComplete;
    if (options.onError) this.onErrorCallback = options.onError;

    const callbacks: StreamingCallbacks = {
      onProcessingStart: (data) => {
        console.log('🚀 Processing started:', data.correlation_id);
      },

      onContextReady: (data) => {
        console.log('📚 Context ready:', {
          items: data.context_items,
          suggestedWord: data.suggested_word,
          time: data.processing_time_ms
        });
      },

      onConsciousnessChunk: (data) => {
        // ON-THE-FLY JSON FILTERING: Extract message content from raw JSON chunks
        const filteredChunk = this.filterJsonChunk(data.chunk);

        if (filteredChunk) {
          this.currentResponse += filteredChunk;
          // Pass emotion along with chunk
          this.onChunkCallback?.(filteredChunk, this.currentResponse, this.currentEmotion);
          console.log('🧠 Consciousness chunk received:', {
            rawChunk: data.chunk,
            filteredChunk: filteredChunk,
            emotion: this.currentEmotion,
            totalLength: this.currentResponse.length
          });
        }
      },

      onAnalysisReady: (data) => {
        console.log('📊 Analysis ready:', {
          tier: data.vocabulary_tier,
          score: data.vocabulary_score,
          time: data.processing_time_ms
        });
      },

      onSuggestionReady: (data) => {
        console.log('💡 Suggestion ready:', data.suggestion);
      },

      onProcessingComplete: (data) => {
        console.log('✅ Processing complete:', {
          correlationId: data.correlation_id,
          totalTime: data.performance_metrics.total_time_ms,
          chunks: data.performance_metrics.chunks_delivered
        });
        this.onCompleteCallback?.(data);
      },

      onError: (data) => {
        console.error('❌ Streaming error:', data.error);
        this.onErrorCallback?.(data.error);
      }
    };

    await this.service.streamConversation(request, callbacks, authToken);
  }

  /**
   * Cancel the current conversation stream.
   */
  cancel(): void {
    this.service.cancelStream();
  }

  /**
   * Check if streaming is active.
   */
  isActive(): boolean {
    return this.service.isStreaming();
  }

  /**
   * Get the current accumulated response.
   */
  getCurrentResponse(): string {
    return this.currentResponse;
  }

  /**
   * Get the current emotion extracted from the stream.
   */
  getCurrentEmotion(): string {
    return this.currentEmotion;
  }
}

// Export singleton instance for easy use
export const streamingConversationClient = new StreamingConversationClient();