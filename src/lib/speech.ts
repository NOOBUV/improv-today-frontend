'use client';

interface TextToSpeechOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  moodBasedTiming?: MoodBasedTiming;
}

interface MoodBasedTiming {
  mood?: string;
  baseRate?: number;
  basePitch?: number;
  rhythmPattern?: 'excited' | 'calm' | 'nervous' | 'neutral';
}

// The backend no longer emits speech markup, but old history and stale replies still can —
// strip it before synthesis so tokens like [pause:0.4s] are never read aloud as words.
const SPEECH_MARKUP = /\[(?:pause|breath|thinking|volume)(?::[^\]]*)?\]/gi;

// Text-to-speech service: Kokoro sidecar first, browser speechSynthesis fallback.
export class BrowserSpeechService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private speechQueue: string[] = [];
  private isCurrentlySpeaking: boolean = false;

  // Streaming sentence buffer
  private textBuffer: string = '';
  private streamingCallbacks: {
    onSentenceQueued?: (text: string) => void;
    onComplete?: () => void;
  } = {};

  constructor() {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis;
      this.loadVoices();
    }
  }

  // Apply mood-based speech rate and pitch adjustments
  private applyMoodBasedTiming(options: TextToSpeechOptions): TextToSpeechOptions {
    if (!options.moodBasedTiming) return options;

    const moodTiming = options.moodBasedTiming;
    const enhancedOptions = { ...options };

    // Apply base rate and pitch from mood
    if (moodTiming.baseRate !== undefined) {
      enhancedOptions.rate = moodTiming.baseRate;
    }
    if (moodTiming.basePitch !== undefined) {
      enhancedOptions.pitch = moodTiming.basePitch;
    }

    // Apply rhythm pattern adjustments
    switch (moodTiming.rhythmPattern) {
      case 'excited':
        enhancedOptions.rate = (enhancedOptions.rate || 0.9) * 1.2;
        enhancedOptions.pitch = (enhancedOptions.pitch || 1) * 1.1;
        break;
      case 'calm':
        enhancedOptions.rate = (enhancedOptions.rate || 0.9) * 0.85;
        enhancedOptions.pitch = (enhancedOptions.pitch || 1) * 0.95;
        break;
      case 'nervous':
        enhancedOptions.rate = (enhancedOptions.rate || 0.9) * 1.1;
        enhancedOptions.pitch = (enhancedOptions.pitch || 1) * 1.05;
        break;
      case 'neutral':
      default:
        // Keep existing values
        break;
    }

    // Ensure values stay within valid ranges
    enhancedOptions.rate = Math.max(0.1, Math.min(10, enhancedOptions.rate || 0.9));
    enhancedOptions.pitch = Math.max(0, Math.min(2, enhancedOptions.pitch || 1));

    return enhancedOptions;
  }

  // Load available voices
  private loadVoices(): void {
    if (!this.synth) return;
    
    this.voices = this.synth.getVoices();
    if (this.voices.length === 0) {
      this.synth.onvoiceschanged = () => {
        if (this.synth) {
          this.voices = this.synth.getVoices();
        }
      };
    }
  }

  // One-shot speak with mood-based rate/pitch
  speak(
    text: string,
    options: TextToSpeechOptions = {},
    onEnd?: () => void,
    onError?: (error: string) => void
  ) {
    if (!text.trim() || !this.synth) return;

    // Chrome fix: Always cancel before speaking to fix Chrome 130 issues
    this.synth.cancel();
    this.isCurrentlySpeaking = false;
    this.speechQueue = [];

    // Wait a bit for cancel to take effect (Chrome needs this)
    setTimeout(() => {
      this.isCurrentlySpeaking = true;
      this.speakChunk(text, this.applyMoodBasedTiming(options), () => {
        this.isCurrentlySpeaking = false;
        onEnd?.();
      }, onError);
    }, 100);
  }

  // Speak a single chunk: local Kokoro server first, browser speechSynthesis if it can't.
  private speakChunk(
    text: string,
    options: TextToSpeechOptions,
    onChunkEnd?: () => void,
    onError?: (error: string) => void
  ) {
    const clean = text.replace(SPEECH_MARKUP, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) {
      onChunkEnd?.();
      return;
    }

    this.speakViaKokoro(clean, options.volume ?? 1.0)
      .then(() => onChunkEnd?.())
      .catch(() => this.speakChunkWithBrowser(clean, options, onChunkEnd, onError));
  }

  // POST the sentence to the local Kokoro server and play the WAV. Rejects on anything
  // (server down, non-200, playback refused) so the caller can fall back.
  // ponytail: hardcoded localhost, no cache. It's a dev-machine sidecar, not a service.
  private async speakViaKokoro(text: string, volume: number): Promise<void> {
    const res = await fetch('http://localhost:8880/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text }),
    });
    if (!res.ok) throw new Error(`Kokoro responded ${res.status}`);
    if (!this.isCurrentlySpeaking) return; // stopSpeaking() ran while the audio was in flight

    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.volume = volume;
    this.currentAudio = audio;
    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onpause = () => resolve(); // stopSpeaking() pauses — mirrors synth's 'canceled'
        audio.onerror = () => reject(new Error('Kokoro audio playback failed'));
        audio.play().catch(reject);
      });
    } finally {
      this.currentAudio = null;
      URL.revokeObjectURL(url);
    }
  }

  // Speak a single chunk of text
  private speakChunkWithBrowser(
    text: string,
    options: TextToSpeechOptions,
    onChunkEnd?: () => void,
    onError?: (error: string) => void
  ) {
    if (!text.trim() || !this.synth) {
      onChunkEnd?.();
      return;
    }

    // Check if voices are loaded
    if (this.voices.length === 0) {
      this.loadVoices();
      setTimeout(() => {
        if (this.voices.length === 0) {
          onError?.('No voices available');
          return;
        }
        this.speakChunkWithBrowser(text, options, onChunkEnd, onError);
      }, 500);
      return;
    }

    // Create utterance with settings
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = options.voice || this.selectedVoice || this.getDefaultVoice();
    utterance.voice = selectedVoice;
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1.0;
    utterance.lang = options.lang ?? 'en-GB';

    this.currentUtterance = utterance;

    utterance.onend = () => {
      this.currentUtterance = null;
      onChunkEnd?.();
    };

    utterance.onerror = (event) => {
      this.currentUtterance = null;
      if (event.error === 'canceled') {
        onChunkEnd?.();
        return;
      }
      onError?.(`Speech error: ${event.error}`);
    };

    // Speak the chunk
    try {
      this.synth.speak(utterance);
    } catch (error) {
      this.currentUtterance = null;
      onError?.(`Failed to start speech: ${error}`);
    }
  }



  // Get curated list of premium high-quality voices
  private getPreferredVoices(): string[] {
    return [
      'Google UK English Female',
      'Samantha',
      'Google UK English Male', // backup Google option
      'Microsoft Hazel - English (Great Britain)',
      'Microsoft Susan - English (Great Britain)', 
      'Microsoft George - English (Great Britain)',
      'Microsoft Aria - English (United States)',
      'Microsoft Emma - English (Great Britain)',
      'Microsoft Libby - English (Great Britain)',
      'Alex', // High-quality macOS voice
      'Karen', // Quality system voice
      'Victoria', // Quality system voice
      'Google US English',
      'Google Polski', // fallback if available
    ];
  }

  // Get default English voice (prefer curated high-quality voices)
  private getDefaultVoice(): SpeechSynthesisVoice | null {
    const englishVoices = this.voices.filter(voice => voice.lang.startsWith('en'));
    if (englishVoices.length === 0) return null;
    
    const preferredVoiceNames = this.getPreferredVoices();
    
    // Priority 1: Find exact matches from preferred list
    for (const preferredName of preferredVoiceNames) {
      const exactMatch = englishVoices.find(voice => 
        voice.name === preferredName || 
        voice.name.toLowerCase().includes(preferredName.toLowerCase())
      );
      if (exactMatch) {
        return exactMatch;
      }
    }
    
    // Priority 2: UK English voices (en-GB) with quality indicators
    const ukVoices = englishVoices.filter(voice => 
      voice.lang.toLowerCase() === 'en-gb' || 
      voice.lang.toLowerCase() === 'en_gb'
    );
    
    if (ukVoices.length > 0) {
      // Look for high-quality indicators
      const qualityIndicators = ['google', 'microsoft', 'natural', 'neural', 'premium'];
      const qualityUkVoice = ukVoices.find(voice => {
        const voiceName = voice.name.toLowerCase();
        return qualityIndicators.some(indicator => voiceName.includes(indicator));
      });
      
      if (qualityUkVoice) return qualityUkVoice;
      
      // Exclude male voices and low-quality voices
      const maleIndicators = ['male', 'man', 'daniel', 'james', 'arthur', 'rishi', 'ryan', 'tom', 'david', 'george', 'alex', 'mark', 'oliver', 'thomas', 'brian', 'william'];
      const lowQualityIndicators = ['espeak', 'basic', 'simple'];
      
      const qualityUkVoices = ukVoices.filter(voice => {
        const voiceName = voice.name.toLowerCase();
        const isMale = maleIndicators.some(name => voiceName.includes(name));
        const isLowQuality = lowQualityIndicators.some(indicator => voiceName.includes(indicator));
        return !isMale && !isLowQuality;
      });
      
      if (qualityUkVoices.length > 0) return qualityUkVoices[0];
      return ukVoices[0]; // Fallback to any UK voice
    }
    
    // Priority 3: Local/system voices (better quality and volume)
    const localVoices = englishVoices.filter(voice => voice.localService);
    if (localVoices.length > 0) {
      // Prefer known high-quality local voices
      const qualityLocalVoice = localVoices.find(voice => {
        const voiceName = voice.name.toLowerCase();
        return ['samantha', 'alex', 'karen', 'victoria', 'susan'].some(name => voiceName.includes(name));
      });
      
      if (qualityLocalVoice) return qualityLocalVoice;
      return localVoices[0];
    }
    
    // Priority 4: Default voice
    const defaultVoice = englishVoices.find(voice => voice.default);
    if (defaultVoice) return defaultVoice;
    
    // Priority 5: Any remaining English voice
    return englishVoices[0];
  }

  // Create mood-based timing options for Clara's emotional state
  createMoodBasedTiming(
    mood: string,
    intensity: number = 5,
    bpmFromHeartbeat?: number
  ): MoodBasedTiming {
    const normalizedIntensity = Math.max(1, Math.min(10, intensity));

    // Base timing configurations for Clara's 8-mood system
    const moodConfigs = {
      happy: {
        baseRate: 1.0 + (normalizedIntensity - 5) * 0.1,
        basePitch: 1.1 + (normalizedIntensity - 5) * 0.05,
        rhythmPattern: 'excited' as const
      },
      excited: {
        baseRate: 1.2 + (normalizedIntensity - 5) * 0.15,
        basePitch: 1.2 + (normalizedIntensity - 5) * 0.1,
        rhythmPattern: 'excited' as const
      },
      calm: {
        baseRate: 0.8 - (normalizedIntensity - 5) * 0.05,
        basePitch: 0.95 - (normalizedIntensity - 5) * 0.02,
        rhythmPattern: 'calm' as const
      },
      sad: {
        baseRate: 0.7 - (normalizedIntensity - 5) * 0.08,
        basePitch: 0.9 - (normalizedIntensity - 5) * 0.05,
        rhythmPattern: 'calm' as const
      },
      angry: {
        baseRate: 1.1 + (normalizedIntensity - 5) * 0.12,
        basePitch: 1.05 + (normalizedIntensity - 5) * 0.08,
        rhythmPattern: 'nervous' as const
      },
      anxious: {
        baseRate: 1.05 + (normalizedIntensity - 5) * 0.08,
        basePitch: 1.08 + (normalizedIntensity - 5) * 0.06,
        rhythmPattern: 'nervous' as const
      },
      neutral: {
        baseRate: 0.9,
        basePitch: 1.0,
        rhythmPattern: 'neutral' as const
      },
      confused: {
        baseRate: 0.85 - (normalizedIntensity - 5) * 0.05,
        basePitch: 0.98 - (normalizedIntensity - 5) * 0.03,
        rhythmPattern: 'nervous' as const
      }
    };

    const config = moodConfigs[mood as keyof typeof moodConfigs] || moodConfigs.neutral;

    // Adjust timing based on BPM from HeartbeatIcon if available
    if (bpmFromHeartbeat) {
      const bpmFactor = bpmFromHeartbeat / 60; // Normalize to 60 BPM baseline
      config.baseRate *= Math.max(0.7, Math.min(1.5, bpmFactor));
    }

    // Ensure values stay within Web Speech API limits
    config.baseRate = Math.max(0.1, Math.min(10, config.baseRate));
    config.basePitch = Math.max(0, Math.min(2, config.basePitch));

    return {
      mood: mood,
      baseRate: config.baseRate,
      basePitch: config.basePitch,
      rhythmPattern: config.rhythmPattern
    };
  }

  // Check if currently speaking (for integration with conversation state)
  isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  // Get current utterance information
  getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  // Get speech queue status
  getSpeechQueueLength(): number {
    return this.speechQueue.length;
  }

  // Stop speaking with enhanced pause control
  stopSpeaking() {
    this.isCurrentlySpeaking = false;
    this.speechQueue = [];
    this.currentUtterance = null;
    this.currentAudio?.pause(); // fires 'pause' → the Kokoro promise resolves like a cancel
    this.synth?.cancel();
    this.textBuffer = '';
  }

  // Queue a sentence for speech
  private queueSentenceForSpeech(text: string) {
    // Clean up text - remove newlines, JSON artifacts, and meaningless content
    const cleanedText = text
      .replace(/\\n/g, ' ')  // Remove literal \n
      .replace(/\n/g, ' ')   // Remove actual newlines
      .replace(/^["'}]+|["'}]+$/g, '')  // Remove leading/trailing quotes/braces
      .trim();

    // Skip if empty, only dots, or only whitespace
    if (!cleanedText || /^\.+$/.test(cleanedText)) return;

    this.speechQueue.push(cleanedText);

    // Notify callback
    this.streamingCallbacks.onSentenceQueued?.(cleanedText);

    // Start speaking if not already
    if (!this.isCurrentlySpeaking && this.synth) {
      this.speakNextChunk();
    }
  }

  // Buffer streamed text and queue each complete sentence
  queueStreamingChunk(chunk: string) {
    for (const char of chunk) {
      this.textBuffer += char;

      // Check for sentence endings: ., !, ?, or ...
      const endsWithSentence =
        this.textBuffer.endsWith('...') ||
        this.textBuffer.endsWith('.') ||
        this.textBuffer.endsWith('!') ||
        this.textBuffer.endsWith('?');

      // Don't split inside a residual [pause:0.4s] — the '.' would cut the token in half
      // and survive the pre-synthesis strip. Unclosed '[' means we're mid-marker.
      const insideMarker = this.textBuffer.lastIndexOf('[') > this.textBuffer.lastIndexOf(']');

      if (endsWithSentence && !insideMarker && this.textBuffer.trim().length > 3) {
        // Queue complete sentence
        this.queueSentenceForSpeech(this.textBuffer);
        this.textBuffer = '';
      }
    }
  }

  // Flush any remaining buffered text (call when stream completes)
  flushStreamingBuffer() {
    if (this.textBuffer.trim().length > 0) {
      this.queueSentenceForSpeech(this.textBuffer);
      this.textBuffer = '';
    }
    // Note: onComplete now fires from speakNextChunk when queue is truly empty
  }

  // Set streaming callbacks
  setStreamingCallbacks(callbacks: {
    onSentenceQueued?: (text: string) => void;
    onComplete?: () => void;
  }) {
    this.streamingCallbacks = callbacks;
  }

  // Speak next chunk in queue
  private speakNextChunk() {
    if (this.speechQueue.length === 0 || !this.synth) {
      this.isCurrentlySpeaking = false;
      // Fire onComplete when queue is truly empty and all speech is done
      this.streamingCallbacks.onComplete?.();
      return;
    }

    this.isCurrentlySpeaking = true;
    const sentence = this.speechQueue.shift()!;

    this.speakChunk(
      sentence,
      { volume: 1.0, rate: 1.0, pitch: 1.0 },
      () => this.speakNextChunk(),
      (error) => {
        console.error('Speech chunk error:', error);
        this.speakNextChunk(); // Continue with next chunk
      }
    );
  }

  // Get available voices
  getVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(voice => voice.lang.startsWith('en'));
  }

  // Set selected voice
  setVoice(voice: SpeechSynthesisVoice | null) {
    this.selectedVoice = voice;
  }

  // Get current voice
  getCurrentVoice(): SpeechSynthesisVoice | null {
    return this.selectedVoice || this.getDefaultVoice();
  }

  // Get recommended voices (curated high-quality only)
  getRecommendedVoices(): SpeechSynthesisVoice[] {
    const voices = this.getVoices();
    const preferredVoiceNames = this.getPreferredVoices();
    
    // Filter voices to only include our curated high-quality list
    return voices.filter(voice => {
      return preferredVoiceNames.some(preferredName => 
        voice.name === preferredName || 
        voice.name.toLowerCase().includes(preferredName.toLowerCase()) ||
        // Additional quality indicators
        (voice.name.toLowerCase().includes('google') && voice.lang.startsWith('en')) ||
        (voice.name.toLowerCase().includes('microsoft') && voice.lang.startsWith('en')) ||
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('alex') ||
        voice.name.toLowerCase().includes('karen') ||
        voice.name.toLowerCase().includes('victoria')
      );
    }).filter(voice => {
      // Exclude low-quality and male voices
      const voiceName = voice.name.toLowerCase();
      const lowQualityIndicators = ['espeak', 'basic', 'simple', 'robotic'];
      const maleIndicators = ['male', 'man', 'daniel', 'james', 'arthur', 'rishi', 'ryan', 'tom', 'david', 'george', 'mark', 'oliver', 'thomas', 'brian', 'william'];
      
      const isLowQuality = lowQualityIndicators.some(indicator => voiceName.includes(indicator));
      const isMale = maleIndicators.some(name => voiceName.includes(name));
      
      return !isLowQuality && !isMale;
    });
  }

}
