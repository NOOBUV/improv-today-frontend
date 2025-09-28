'use client';

import { EmotionalMood } from '@/components/clara/EmotionalBackdrop';

// Audio manager for heartbeat and other audio functionality
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private activeHeartbeatNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isInitialized = false;
  private isMuted = false;
  private volume = 0.3; // Default volume

  constructor() {
    // Initialize on user interaction (required for Web Audio API)
    this.initializeOnUserInteraction();
  }

  private initializeOnUserInteraction() {
    const initAudio = () => {
      if (!this.isInitialized) {
        this.initialize();
        document.removeEventListener('click', initAudio);
        document.removeEventListener('keydown', initAudio);
        document.removeEventListener('touchstart', initAudio);
      }
    };

    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    document.addEventListener('touchstart', initAudio);
  }

  private initialize() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioContext.currentTime);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
      this.gracefulFallback();
    }
  }

  private gracefulFallback() {
    this.isInitialized = false;
  }

  // Generate synthetic heartbeat audio for different moods
  async loadHeartbeatAudio(mood: EmotionalMood): Promise<void> {
    if (!this.audioContext || !this.isInitialized) return;

    // Check if already loaded
    if (this.audioBuffers.has(mood)) return;

    // Generate synthetic heartbeat directly
    this.createSyntheticHeartbeat(mood);
  }

  // Create synthetic heartbeat audio using Web Audio API
  private createSyntheticHeartbeat(mood: EmotionalMood) {
    if (!this.audioContext) {
      return;
    }

    try {
      const sampleRate = this.audioContext.sampleRate;
      const duration = 1.5; // 1.5 seconds of heartbeat pattern for better looping
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
      const channelData = buffer.getChannelData(0);

      // Generate realistic heartbeat "lub-dub" pattern
      for (let i = 0; i < channelData.length; i++) {
        const time = i / sampleRate;
        let sample = 0;

        // First beat "LUB" - low frequency thump (0.0 to 0.12 seconds)
        if (time >= 0 && time < 0.12) {
          const beatTime = time / 0.12;
          const envelope = Math.sin(beatTime * Math.PI) * Math.exp(-beatTime * 8);
          // Mix low frequencies for thump sound
          sample = (
            Math.sin(2 * Math.PI * 40 * time) * 0.8 +
            Math.sin(2 * Math.PI * 80 * time) * 0.4 +
            Math.sin(2 * Math.PI * 120 * time) * 0.2
          ) * envelope;
        }

        // Second beat "DUB" - slightly higher, softer (0.18 to 0.28 seconds)
        else if (time >= 0.18 && time < 0.28) {
          const adjustedTime = time - 0.18;
          const beatTime = adjustedTime / 0.1;
          const envelope = Math.sin(beatTime * Math.PI) * Math.exp(-beatTime * 10);
          // Mix slightly higher frequencies for second beat
          sample = (
            Math.sin(2 * Math.PI * 50 * adjustedTime) * 0.6 +
            Math.sin(2 * Math.PI * 90 * adjustedTime) * 0.3 +
            Math.sin(2 * Math.PI * 130 * adjustedTime) * 0.15
          ) * envelope * 0.7; // Softer than first beat
        }

        channelData[i] = sample * 0.4; // Overall volume
      }

      this.audioBuffers.set(mood, buffer);
    } catch (error) {
      console.error(`Failed to create synthetic heartbeat for ${mood}:`, error);
    }
  }

  // Play heartbeat audio with BPM timing
  playHeartbeat(mood: EmotionalMood, bpm: number): void {
    if (!this.audioContext || !this.isInitialized || this.isMuted) return;

    this.stopHeartbeat(); // Stop any existing heartbeat

    // Ensure synthetic heartbeat exists for this mood
    if (!this.audioBuffers.has(mood)) {
      this.createSyntheticHeartbeat(mood);
    }

    const buffer = this.audioBuffers.get(mood);
    if (!buffer) {
      return;
    }

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      if (this.gainNode) {
        source.connect(this.gainNode);
      } else {
        source.connect(this.audioContext.destination);
      }

      // Calculate loop timing based on BPM
      const beatInterval = 60 / bpm; // seconds per beat
      source.loop = true;
      source.loopEnd = Math.min(buffer.duration, beatInterval);

      source.start(this.audioContext.currentTime);
      this.activeHeartbeatNode = source;
    } catch (error) {
      console.error('Failed to play heartbeat:', error);
    }
  }

  // Stop heartbeat audio
  stopHeartbeat(): void {
    if (this.activeHeartbeatNode) {
      try {
        this.activeHeartbeatNode.stop();
        this.activeHeartbeatNode.disconnect();
      } catch (error) {
        console.warn('Error stopping heartbeat:', error);
      }
      this.activeHeartbeatNode = null;
    }
  }

  // Set volume (0-1)
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volume,
        this.audioContext.currentTime,
        0.1
      );
    }
  }

  // Mute/unmute
  setMuted(muted: boolean): void {
    this.isMuted = muted;

    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(
        muted ? 0 : this.volume,
        this.audioContext.currentTime,
        0.1
      );
    }

    if (muted) {
      this.stopHeartbeat();
    }
  }

  // Get current state
  isMutedState(): boolean {
    return this.isMuted;
  }

  getCurrentVolume(): number {
    return this.volume;
  }

  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null;
  }

  // Cleanup
  dispose(): void {
    this.stopHeartbeat();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioBuffers.clear();
    this.gainNode = null;
    this.isInitialized = false;
  }
}

// Singleton instance
let audioManagerInstance: AudioManager | null = null;

export const getAudioManager = (): AudioManager => {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
};