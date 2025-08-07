'use client';

import { BrowserSpeechService } from '@/lib/speech';

// ===== TYPES & INTERFACES =====

export type SpeechOperation = 'synthesis' | 'recognition' | 'idle';
export type SpeechPriority = 'high' | 'normal' | 'low';

export interface SpeechRequest {
  id: string;
  type: SpeechOperation;
  priority: SpeechPriority;
  payload: unknown;
  callback?: (result?: unknown, error?: string) => void;
  timestamp: number;
}

export interface SpeechSynthesisRequest {
  text: string;
  options?: {
    voice?: SpeechSynthesisVoice;
    rate?: number;
    pitch?: number;
    volume?: number;
    lang?: string;
  };
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface SpeechRecognitionRequest {
  onResult?: (result: { transcript: string; isFinal: boolean; confidence?: number }) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeechCoordinatorState {
  currentOperation: SpeechOperation;
  isLocked: boolean;
  lockOwner: string | null;
  queue: SpeechRequest[];
  activeRequest: SpeechRequest | null;
  errorCount: number;
  lastError: string | null;
}

// ===== MUTEX IMPLEMENTATION =====

class SpeechMutex {
  private locked: boolean = false;
  private owner: string | null = null;
  private queue: Array<{ resolve: () => void; id: string }> = [];

  async acquire(id: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        this.owner = id;
        resolve();
      } else {
        this.queue.push({ resolve, id });
      }
    });
  }

  release(id: string): void {
    if (this.owner !== id) {
      console.warn(`Mutex release attempted by non-owner: ${id} (owner: ${this.owner})`);
      return;
    }

    this.locked = false;
    this.owner = null;

    // Process next in queue
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.locked = true;
        this.owner = next.id;
        next.resolve();
      }
    }
  }

  isLockedBy(id: string): boolean {
    return this.locked && this.owner === id;
  }

  forceRelease(): void {
    this.locked = false;
    this.owner = null;
    
    // Clear queue and reject all waiting requests
    this.queue.forEach(({ resolve }) => resolve());
    this.queue = [];
  }

  getOwner(): string | null {
    return this.owner;
  }

  isLocked(): boolean {
    return this.locked;
  }
}

// ===== SPEECH COORDINATOR CLASS =====

export class SpeechCoordinator {
  private speechService: BrowserSpeechService;
  private mutex: SpeechMutex;
  private state: SpeechCoordinatorState;
  private requestIdCounter: number = 0;
  private stateListeners: Array<(state: SpeechCoordinatorState) => void> = [];
  private processQueueTimeout: NodeJS.Timeout | null = null;
  private emergencyTimeout: NodeJS.Timeout | null = null;

  constructor(speechService?: BrowserSpeechService) {
    this.speechService = speechService || new BrowserSpeechService();
    this.mutex = new SpeechMutex();
    this.state = {
      currentOperation: 'idle',
      isLocked: false,
      lockOwner: null,
      queue: [],
      activeRequest: null,
      errorCount: 0,
      lastError: null,
    };
  }

  // ===== STATE MANAGEMENT =====

  private updateState(updates: Partial<SpeechCoordinatorState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyStateListeners();
  }

  private notifyStateListeners(): void {
    this.stateListeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in speech coordinator state listener:', error);
      }
    });
  }

  public onStateChange(listener: (state: SpeechCoordinatorState) => void): () => void {
    this.stateListeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.stateListeners.indexOf(listener);
      if (index > -1) {
        this.stateListeners.splice(index, 1);
      }
    };
  }

  public getState(): SpeechCoordinatorState {
    return { ...this.state };
  }

  // ===== QUEUE MANAGEMENT =====

  private generateRequestId(): string {
    return `req-${Date.now()}-${++this.requestIdCounter}`;
  }

  private addToQueue(request: SpeechRequest): void {
    // Insert based on priority (high priority first)
    const index = this.state.queue.findIndex(
      item => this.getPriorityWeight(item.priority) < this.getPriorityWeight(request.priority)
    );
    
    if (index === -1) {
      this.state.queue.push(request);
    } else {
      this.state.queue.splice(index, 0, request);
    }

    this.updateState({ queue: [...this.state.queue] });
    this.scheduleQueueProcessing();
  }

  private getPriorityWeight(priority: SpeechPriority): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  private scheduleQueueProcessing(): void {
    if (this.processQueueTimeout) {
      clearTimeout(this.processQueueTimeout);
    }
    
    this.processQueueTimeout = setTimeout(() => {
      this.processQueue();
    }, 50); // Small delay to batch requests
  }

  private async processQueue(): Promise<void> {
    if (this.state.queue.length === 0 || this.state.isLocked) {
      return;
    }

    const nextRequest = this.state.queue.shift();
    if (!nextRequest) return;

    this.updateState({ 
      queue: [...this.state.queue],
      activeRequest: nextRequest 
    });

    try {
      await this.executeRequest(nextRequest);
    } catch (error) {
      console.error('Error executing speech request:', error);
      this.handleRequestError(nextRequest, error instanceof Error ? error.message : 'Unknown error');
    }

    // Process next request after current one completes
    if (this.state.queue.length > 0) {
      this.scheduleQueueProcessing();
    }
  }

  private async executeRequest(request: SpeechRequest): Promise<void> {
    const requestId = request.id;

    try {
      // Acquire mutex lock
      await this.mutex.acquire(requestId);
      
      this.updateState({
        isLocked: true,
        lockOwner: requestId,
        currentOperation: request.type,
      });

      // Set emergency timeout to prevent deadlocks
      this.setEmergencyTimeout(requestId);

      switch (request.type) {
        case 'synthesis':
          await this.executeSynthesisRequest(request);
          break;
        case 'recognition':
          await this.executeRecognitionRequest(request);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }
    } finally {
      this.clearEmergencyTimeout();
      this.releaseMutex(requestId);
    }
  }

  private setEmergencyTimeout(requestId: string): void {
    this.clearEmergencyTimeout();
    
    // Emergency timeout to prevent deadlocks (30 seconds)
    this.emergencyTimeout = setTimeout(() => {
      console.error(`Emergency timeout triggered for request ${requestId}`);
      this.forceReset();
    }, 30000);
  }

  private clearEmergencyTimeout(): void {
    if (this.emergencyTimeout) {
      clearTimeout(this.emergencyTimeout);
      this.emergencyTimeout = null;
    }
  }

  private releaseMutex(requestId: string): void {
    try {
      this.mutex.release(requestId);
      this.updateState({
        isLocked: false,
        lockOwner: null,
        currentOperation: 'idle',
        activeRequest: null,
      });
    } catch (error) {
      console.error('Error releasing mutex:', error);
    }
  }

  // ===== SPEECH SYNTHESIS WITH MUTEX =====

  public async speakWithMutex(
    text: string,
    options: SpeechSynthesisRequest['options'] = {},
    callbacks: Pick<SpeechSynthesisRequest, 'onStart' | 'onEnd' | 'onError'> = {},
    priority: SpeechPriority = 'normal'
  ): Promise<string> {
    const requestId = this.generateRequestId();

    return new Promise((resolve, reject) => {
      const request: SpeechRequest = {
        id: requestId,
        type: 'synthesis',
        priority,
        payload: { text, options, callbacks },
        callback: (result, error) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve(requestId);
          }
        },
        timestamp: Date.now(),
      };

      this.addToQueue(request);
    });
  }

  private async executeSynthesisRequest(request: SpeechRequest): Promise<void> {
    const payload = request.payload as { text: string; options?: any; callbacks?: any };
    const { text, options = {}, callbacks = {} } = payload;

    return new Promise<void>((resolve, reject) => {
      // Ensure any ongoing speech is stopped before starting new one
      this.speechService.stopSpeaking();

      // Add a small delay to ensure cleanup
      setTimeout(() => {
        try {
          callbacks?.onStart?.();

          this.speechService.speak(
            text,
            options,
            () => {
              callbacks?.onEnd?.();
              request.callback?.();
              resolve();
            },
            (error: string) => {
              callbacks?.onError?.(error);
              request.callback?.(undefined, error);
              reject(new Error(error));
            }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Speech synthesis failed';
          callbacks?.onError?.(errorMessage);
          request.callback?.(undefined, errorMessage);
          reject(error);
        }
      }, 100);
    });
  }

  // ===== SPEECH RECOGNITION WITH MUTEX =====

  public async listenWithMutex(
    callbacks: SpeechRecognitionRequest = {},
    priority: SpeechPriority = 'normal'
  ): Promise<string> {
    const requestId = this.generateRequestId();

    return new Promise((resolve, reject) => {
      const request: SpeechRequest = {
        id: requestId,
        type: 'recognition',
        priority,
        payload: callbacks,
        callback: (result, error) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve(requestId);
          }
        },
        timestamp: Date.now(),
      };

      this.addToQueue(request);
    });
  }

  private async executeRecognitionRequest(request: SpeechRequest): Promise<void> {
    const callbacks = request.payload as SpeechRecognitionRequest;

    return new Promise<void>((resolve, reject) => {
      // Ensure any ongoing speech synthesis is stopped
      this.speechService.stopSpeaking();

      // Add a small delay to ensure synthesis cleanup
      setTimeout(() => {
        try {
          callbacks.onStart?.();

          this.speechService.startListening(
            (result) => {
              callbacks.onResult?.(result);
              // Note: We don't resolve here because recognition is ongoing
              // The caller needs to call stopListening to end recognition
            },
            (error: string) => {
              callbacks.onError?.(error);
              request.callback?.(undefined, error);
              reject(new Error(error));
            }
          );

          // For recognition, we resolve immediately after starting
          // The actual results come through the onResult callback
          request.callback?.();
          resolve();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Speech recognition failed';
          callbacks.onError?.(errorMessage);
          request.callback?.(undefined, errorMessage);
          reject(error);
        }
      }, 100);
    });
  }

  // ===== STOP OPERATIONS =====

  public stopCurrentOperation(): void {
    // Stop both synthesis and recognition
    this.speechService.stopSpeaking();
    this.speechService.stopListening();

    // Force release mutex if locked
    if (this.state.isLocked && this.state.lockOwner) {
      this.releaseMutex(this.state.lockOwner);
    }
  }

  public stopSpeaking(): void {
    this.speechService.stopSpeaking();
    
    // If current operation is synthesis, release mutex
    if (this.state.currentOperation === 'synthesis' && this.state.lockOwner) {
      this.releaseMutex(this.state.lockOwner);
    }
  }

  public stopListening(): void {
    this.speechService.stopListening();
    
    // If current operation is recognition, release mutex
    if (this.state.currentOperation === 'recognition' && this.state.lockOwner) {
      this.releaseMutex(this.state.lockOwner);
    }
  }

  // ===== QUEUE CONTROL =====

  public clearQueue(): void {
    this.updateState({ queue: [] });
  }

  public cancelRequest(requestId: string): boolean {
    const index = this.state.queue.findIndex(req => req.id === requestId);
    if (index > -1) {
      const cancelledRequest = this.state.queue.splice(index, 1)[0];
      this.updateState({ queue: [...this.state.queue] });
      
      // Notify callback about cancellation
      cancelledRequest.callback?.(undefined, 'Request cancelled');
      return true;
    }
    return false;
  }

  public getQueueLength(): number {
    return this.state.queue.length;
  }

  public getQueuedRequests(): SpeechRequest[] {
    return [...this.state.queue];
  }

  // ===== ERROR HANDLING =====

  private handleRequestError(request: SpeechRequest, error: string): void {
    this.updateState({
      errorCount: this.state.errorCount + 1,
      lastError: error,
    });

    console.error(`Speech request ${request.id} failed:`, error);
    request.callback?.(undefined, error);
  }

  public forceReset(): void {
    console.warn('Force resetting speech coordinator');
    
    // Stop all speech operations
    this.speechService.stopSpeaking();
    this.speechService.stopListening();
    
    // Force release mutex
    this.mutex.forceRelease();
    
    // Clear timeouts
    this.clearEmergencyTimeout();
    if (this.processQueueTimeout) {
      clearTimeout(this.processQueueTimeout);
      this.processQueueTimeout = null;
    }
    
    // Reset state
    this.updateState({
      currentOperation: 'idle',
      isLocked: false,
      lockOwner: null,
      queue: [],
      activeRequest: null,
    });
  }

  // ===== UTILITY METHODS =====

  public isAvailable(): boolean {
    return this.speechService.isAvailable();
  }

  public getSpeechService(): BrowserSpeechService {
    return this.speechService;
  }

  public getDebugInfo() {
    return {
      state: this.getState(),
      mutexOwner: this.mutex.getOwner(),
      mutexLocked: this.mutex.isLocked(),
      speechServiceAvailable: this.speechService.isAvailable(),
      queueLength: this.getQueueLength(),
    };
  }

  // ===== CLEANUP =====

  public dispose(): void {
    this.forceReset();
    this.stateListeners = [];
  }
}

// ===== SINGLETON INSTANCE =====

let speechCoordinator: SpeechCoordinator | null = null;

export const getSpeechCoordinator = (): SpeechCoordinator => {
  if (!speechCoordinator) {
    speechCoordinator = new SpeechCoordinator();
  }
  return speechCoordinator;
};

export const resetSpeechCoordinator = (): void => {
  if (speechCoordinator) {
    speechCoordinator.dispose();
    speechCoordinator = null;
  }
};