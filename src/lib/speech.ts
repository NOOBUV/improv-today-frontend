'use client';

// Browser Speech API Types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechToTextResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

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
  pauseMultiplier?: number;
  rhythmPattern?: 'excited' | 'calm' | 'nervous' | 'neutral';
}

// PauseMarker interface for future enhancement
// interface PauseMarker {
//   type: 'pause' | 'breath' | 'thinking';
//   duration: number;
//   position: number;
// }

interface SpeechChunk {
  text: string;
  pauseAfter?: number;
  volume?: number;
}

// Main Browser Speech Service (simplified)
export class BrowserSpeechService {
  private recognition: SpeechRecognition | null = null;
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speechQueue: SpeechChunk[] = [];
  private isCurrentlySpeaking: boolean = false;

  // SSL streaming state machine
  private textBuffer: string = '';
  private tagBuffer: string = '';
  private insideBracket: boolean = false;
  private pendingPause: number = 0;
  private pendingVolume: number = 1.0;
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

  // Check if speech recognition is supported
  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check for both standard and webkit prefixed versions
    const hasSupport = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    
    // Additional check for mobile - sometimes the constructor exists but throws
    if (hasSupport) {
      try {
        const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
        new SpeechRecognitionConstructor();
        return true;
      } catch {
        // Speech recognition constructor failed
        return false;
      }
    }
    
    return false;
  }

  // Start listening with Chrome Web Speech API
  async startListening(
    onResult: (result: SpeechToTextResult) => void,
    onError: (error: string) => void
  ) {
    if (!this.isAvailable()) {
      onError('Speech recognition not supported. Please use Chrome or Edge.');
      return;
    }

    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError('Microphone access denied. Please allow microphone permission in your browser settings.');
      return;
    }

    try {
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionConstructor();

      // Mobile-friendly settings
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      this.recognition.continuous = !isMobile; // false on mobile, true on desktop
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          onResult({
            transcript: result[0].transcript,
            confidence: result[0].confidence || 0.8,
            isFinal: result.isFinal,
          });
          
          // On mobile, auto-restart if continuous is false and we got a final result
          if (isMobile && result.isFinal && !this.recognition?.continuous) {
            setTimeout(() => {
              if (this.recognition) {
                try {
                  this.recognition.start();
                } catch {
                  // Failed to restart recognition
                }
              }
            }, 100);
          }
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Handle specific errors differently
        if (event.error === 'not-allowed') {
          // Speech recognition error
          onError('Microphone access denied. Please allow microphone permission in your browser settings.');
        } else if (event.error === 'no-speech') {
          // Don't treat no-speech as a fatal error - just continue listening silently
          return; // Don't call onError or log, just continue
        } else if (event.error === 'audio-capture') {
          // Speech recognition error
          onError('Microphone not available. Please check your device settings.');
        } else if (event.error === 'network') {
          // Speech recognition error
          onError('Network error. Please check your internet connection.');
        } else {
          // Speech recognition error
          onError(`Speech recognition error: ${event.error}`);
        }
      };

      this.recognition.start();
    } catch (error) {
      onError(`Failed to start speech recognition: ${error}`);
    }
  }

  // Stop listening
  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  // Parse pause markers and volume tags from text and create speech chunks
  private parseTextWithPauses(text: string, moodTiming?: MoodBasedTiming): SpeechChunk[] {
    if (!text.trim()) return [];

    // Regex to find pause markers: [pause:0.4s], [pause:500ms], [breath], [thinking]
    // Also volume markers: [volume:soft], [volume:loud], [volume:normal]
    const markupRegex = /\[(pause|breath|thinking|volume)(?::([^\]]+))?\]/gi;
    const chunks: SpeechChunk[] = [];
    let lastIndex = 0;
    let match;
    let currentVolume = 1.0;

    while ((match = markupRegex.exec(text)) !== null) {
      // Add text before the marker
      if (match.index > lastIndex) {
        const textChunk = text.substring(lastIndex, match.index).trim();
        if (textChunk) {
          chunks.push({ text: textChunk, volume: currentVolume });
        }
      }

      const markerType = match[1].toLowerCase();
      const value = match[2];

      if (markerType === 'volume') {
        // Parse volume setting
        currentVolume = this.parseVolumeValue(value);
      } else {
        // Parse pause duration
        const pauseDuration = this.parsePauseDuration(markerType, value, moodTiming);

        // Add pause to the last chunk or create new chunk if none exists
        if (chunks.length > 0) {
          chunks[chunks.length - 1].pauseAfter = pauseDuration;
        } else {
          // Pause at the beginning - create empty chunk with pause
          chunks.push({ text: '', pauseAfter: pauseDuration, volume: currentVolume });
        }
      }

      lastIndex = markupRegex.lastIndex;
    }

    // Add remaining text after last marker
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex).trim();
      if (remainingText) {
        chunks.push({ text: remainingText, volume: currentVolume });
      }
    }

    // If no markers found, return original text as single chunk
    if (chunks.length === 0) {
      chunks.push({ text: text.trim(), volume: currentVolume });
    }

    return chunks;
  }

  // Parse volume value from string (soft, normal, loud)
  private parseVolumeValue(volumeStr: string | undefined): number {
    if (!volumeStr) return 1.0;

    const normalized = volumeStr.toLowerCase().trim();
    switch (normalized) {
      case 'soft':
      case 'quiet':
      case 'whisper':
        return 0.5;
      case 'loud':
      case 'emphasis':
      case 'strong':
        return 1.0;
      case 'normal':
      case 'medium':
      default:
        return 0.8;
    }
  }

  // Parse pause duration from marker
  private parsePauseDuration(
    pauseType: string,
    value: string | undefined,
    moodTiming?: MoodBasedTiming
  ): number {
    // Check for explicit duration: "0.4s" or "400ms"
    if (value) {
      if (value.endsWith('s') && !value.endsWith('ms')) {
        // Seconds: "0.4s" -> 400ms
        return parseFloat(value.replace('s', '')) * 1000;
      } else if (value.endsWith('ms')) {
        // Milliseconds: "400ms" -> 400ms
        return parseFloat(value.replace('ms', ''));
      }
    }

    // Fallback to type-based durations
    return this.calculatePauseDuration(pauseType, null, moodTiming);
  }

  // Calculate pause duration based on type and mood
  private calculatePauseDuration(
    pauseType: string,
    explicitDuration: number | null,
    moodTiming?: MoodBasedTiming
  ): number {
    // Base durations in milliseconds
    const baseDurations = {
      pause: 500,
      breath: 800,
      thinking: 1200
    };

    let duration = baseDurations[pauseType as keyof typeof baseDurations] || 500;

    // Use explicit duration if provided
    if (explicitDuration !== null) {
      duration = explicitDuration;
    }

    // Apply mood-based timing adjustments
    if (moodTiming) {
      const multiplier = moodTiming.pauseMultiplier || 1.0;

      // Adjust based on rhythm pattern
      switch (moodTiming.rhythmPattern) {
        case 'excited':
          duration *= 0.6; // Shorter pauses when excited
          break;
        case 'calm':
          duration *= 1.4; // Longer pauses when calm
          break;
        case 'nervous':
          // Irregular timing - vary by pause type
          duration *= pauseType === 'thinking' ? 1.8 : 0.4;
          break;
        case 'neutral':
        default:
          duration *= multiplier;
          break;
      }
    }

    return Math.max(100, Math.min(3000, duration)); // Clamp between 100ms and 3s
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

  // Enhanced speak method with pause control and mood-based timing
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
    setTimeout(() => this.speakWithPauses(text, options, onEnd, onError), 100);
  }

  // New method to handle speech with pause markers
  private async speakWithPauses(
    text: string,
    options: TextToSpeechOptions,
    onEnd?: () => void,
    onError?: (error: string) => void
  ) {
    if (!text.trim() || !this.synth) return;

    try {
      // Apply mood-based timing adjustments to options
      const enhancedOptions = this.applyMoodBasedTiming(options);

      // Parse text into chunks with pauses
      const speechChunks = this.parseTextWithPauses(text, options.moodBasedTiming);

      if (speechChunks.length === 0) {
        onEnd?.();
        return;
      }

      // Set speaking state
      this.isCurrentlySpeaking = true;
      this.speechQueue = speechChunks;

      // Start speaking the chunks sequentially
      await this.speakChunksSequentially(speechChunks, enhancedOptions, onEnd, onError);

    } catch (error) {
      this.isCurrentlySpeaking = false;
      onError?.(`Failed to process speech with pauses: ${error}`);
    }
  }

  // Speak chunks sequentially with pauses
  private async speakChunksSequentially(
    chunks: SpeechChunk[],
    options: TextToSpeechOptions,
    onEnd?: () => void,
    onError?: (error: string) => void
  ) {
    if (!this.synth) return;

    let currentIndex = 0;

    const speakNextChunk = () => {
      if (currentIndex >= chunks.length || !this.isCurrentlySpeaking) {
        this.isCurrentlySpeaking = false;
        onEnd?.();
        return;
      }

      const chunk = chunks[currentIndex];
      currentIndex++;

      // If chunk has text, speak it
      if (chunk.text.trim()) {
        this.speakChunk(chunk.text, options, () => {
          // After speaking, handle pause if needed
          if (chunk.pauseAfter && this.isCurrentlySpeaking) {
            setTimeout(speakNextChunk, chunk.pauseAfter);
          } else {
            speakNextChunk();
          }
        }, onError, chunk.volume);
      } else if (chunk.pauseAfter) {
        // Empty text with pause - just wait
        setTimeout(speakNextChunk, chunk.pauseAfter);
      } else {
        // Empty chunk, continue immediately
        speakNextChunk();
      }
    };

    speakNextChunk();
  }

  // Speak a single chunk of text
  private speakChunk(
    text: string,
    options: TextToSpeechOptions,
    onChunkEnd?: () => void,
    onError?: (error: string) => void,
    chunkVolume?: number
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
        this.speakChunk(text, options, onChunkEnd, onError, chunkVolume);
      }, 500);
      return;
    }

    // Create utterance with settings
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = options.voice || this.selectedVoice || this.getDefaultVoice();
    utterance.voice = selectedVoice;
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1;
    // Use chunk-specific volume if provided, otherwise use options volume
    utterance.volume = chunkVolume ?? options.volume ?? 1.0;
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

  // Inject intelligent pause markers based on content analysis
  injectPauseMarkers(text: string, emotionalState?: string): string {
    if (!text.trim()) return text;

    let enhancedText = text;

    // Add pauses after punctuation marks based on emotional state
    const pauseSettings = this.getPauseSettingsForEmotion(emotionalState);

    // Add breathing pauses after sentences
    enhancedText = enhancedText.replace(/([.!?])\s+/g, `$1 [${pauseSettings.sentencePause}] `);

    // Add thinking pauses before questions
    enhancedText = enhancedText.replace(/(\?\s*)/g, ` [${pauseSettings.questionPause}]$1`);

    // Add brief pauses after commas for natural rhythm
    enhancedText = enhancedText.replace(/(,)\s+/g, `$1 [${pauseSettings.commaPause}] `);

    // Add emphasis pauses around important words (words in caps or with emphasis)
    enhancedText = enhancedText.replace(/\b([A-Z]{2,})\b/g, `[pause:200ms] $1 [pause:200ms]`);

    // Add thinking pauses before complex explanations
    enhancedText = enhancedText.replace(/\b(because|however|meanwhile|therefore|consequently)\b/gi, `[${pauseSettings.thinkingPause}] $1`);

    return enhancedText;
  }

  // Get pause settings based on emotional state
  private getPauseSettingsForEmotion(emotionalState?: string) {
    const baseSettings = {
      sentencePause: 'breath',
      questionPause: 'thinking',
      commaPause: 'pause:300ms',
      thinkingPause: 'thinking'
    };

    switch (emotionalState?.toLowerCase()) {
      case 'excited':
      case 'happy':
        return {
          sentencePause: 'pause:400ms',
          questionPause: 'pause:600ms',
          commaPause: 'pause:200ms',
          thinkingPause: 'pause:500ms'
        };
      case 'calm':
      case 'relaxed':
        return {
          sentencePause: 'breath',
          questionPause: 'thinking',
          commaPause: 'pause:500ms',
          thinkingPause: 'thinking'
        };
      case 'nervous':
      case 'anxious':
        return {
          sentencePause: 'pause:300ms',
          questionPause: 'pause:800ms',
          commaPause: 'pause:150ms',
          thinkingPause: 'pause:1000ms'
        };
      case 'sad':
      case 'melancholy':
        return {
          sentencePause: 'pause:800ms',
          questionPause: 'pause:1200ms',
          commaPause: 'pause:600ms',
          thinkingPause: 'pause:1500ms'
        };
      default:
        return baseSettings;
    }
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
        rhythmPattern: 'excited' as const,
        pauseMultiplier: 0.7
      },
      excited: {
        baseRate: 1.2 + (normalizedIntensity - 5) * 0.15,
        basePitch: 1.2 + (normalizedIntensity - 5) * 0.1,
        rhythmPattern: 'excited' as const,
        pauseMultiplier: 0.5
      },
      calm: {
        baseRate: 0.8 - (normalizedIntensity - 5) * 0.05,
        basePitch: 0.95 - (normalizedIntensity - 5) * 0.02,
        rhythmPattern: 'calm' as const,
        pauseMultiplier: 1.5
      },
      sad: {
        baseRate: 0.7 - (normalizedIntensity - 5) * 0.08,
        basePitch: 0.9 - (normalizedIntensity - 5) * 0.05,
        rhythmPattern: 'calm' as const,
        pauseMultiplier: 1.8
      },
      angry: {
        baseRate: 1.1 + (normalizedIntensity - 5) * 0.12,
        basePitch: 1.05 + (normalizedIntensity - 5) * 0.08,
        rhythmPattern: 'nervous' as const,
        pauseMultiplier: 0.6
      },
      anxious: {
        baseRate: 1.05 + (normalizedIntensity - 5) * 0.08,
        basePitch: 1.08 + (normalizedIntensity - 5) * 0.06,
        rhythmPattern: 'nervous' as const,
        pauseMultiplier: 0.8
      },
      neutral: {
        baseRate: 0.9,
        basePitch: 1.0,
        rhythmPattern: 'neutral' as const,
        pauseMultiplier: 1.0
      },
      confused: {
        baseRate: 0.85 - (normalizedIntensity - 5) * 0.05,
        basePitch: 0.98 - (normalizedIntensity - 5) * 0.03,
        rhythmPattern: 'nervous' as const,
        pauseMultiplier: 1.3
      }
    };

    const config = moodConfigs[mood as keyof typeof moodConfigs] || moodConfigs.neutral;

    // Adjust timing based on BPM from HeartbeatIcon if available
    if (bpmFromHeartbeat) {
      const bpmFactor = bpmFromHeartbeat / 60; // Normalize to 60 BPM baseline
      config.baseRate *= Math.max(0.7, Math.min(1.5, bpmFactor));
      config.pauseMultiplier /= Math.max(0.8, Math.min(1.3, bpmFactor));
    }

    // Ensure values stay within Web Speech API limits
    config.baseRate = Math.max(0.1, Math.min(10, config.baseRate));
    config.basePitch = Math.max(0, Math.min(2, config.basePitch));

    return {
      mood: mood,
      baseRate: config.baseRate,
      basePitch: config.basePitch,
      rhythmPattern: config.rhythmPattern,
      pauseMultiplier: config.pauseMultiplier
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
    this.synth?.cancel();

    // Reset streaming state
    this.resetStreamingState();
  }

  // Reset streaming state machine
  private resetStreamingState() {
    this.textBuffer = '';
    this.tagBuffer = '';
    this.insideBracket = false;
    this.pendingPause = 0;
    this.pendingVolume = 1.0;
  }

  // Parse SSL tag from buffer
  private parseSSLTag(tag: string): { pause?: number; volume?: number } {
    const settings: { pause?: number; volume?: number } = {};

    // Parse [pause:0.3s] or [pause:300ms]
    const pauseMatch = tag.match(/pause:([\d.]+)(s|ms)/);
    if (pauseMatch) {
      const value = parseFloat(pauseMatch[1]);
      settings.pause = pauseMatch[2] === 's' ? value * 1000 : value;
    }

    // Parse [volume:soft|normal|loud]
    const volumeMatch = tag.match(/volume:(soft|normal|loud|quiet|whisper)/);
    if (volumeMatch) {
      const volumeMap: Record<string, number> = {
        soft: 0.5,
        quiet: 0.5,
        whisper: 0.5,
        normal: 0.8,
        loud: 1.0,
      };
      settings.volume = volumeMap[volumeMatch[1]] || 0.8;
    }

    return settings;
  }

  // Queue a sentence for speech with pending settings
  private queueSentenceForSpeech(text: string) {
    // Clean up text - remove newlines, JSON artifacts, and meaningless content
    let cleanedText = text
      .replace(/\\n/g, ' ')  // Remove literal \n
      .replace(/\n/g, ' ')   // Remove actual newlines
      .replace(/^["'}]+|["'}]+$/g, '')  // Remove leading/trailing quotes/braces
      .trim();

    // Skip if empty, only dots, or only whitespace
    if (!cleanedText || /^\.+$/.test(cleanedText)) return;

    // Create speech chunk with pending settings
    const chunk: SpeechChunk = {
      text: cleanedText,
    };

    if (this.pendingPause > 0) {
      chunk.pauseAfter = this.pendingPause;
      console.log('📌 Applying pause:', this.pendingPause, 'ms to:', text.trim().substring(0, 30));
    }

    if (this.pendingVolume !== 1.0) {
      chunk.volume = this.pendingVolume;
      console.log('🔊 Applying volume:', this.pendingVolume, 'to:', text.trim().substring(0, 30));
    }

    // Add to speech queue
    this.speechQueue.push(chunk);

    // Notify callback
    this.streamingCallbacks.onSentenceQueued?.(cleanedText);

    // Start speaking if not already
    if (!this.isCurrentlySpeaking && this.synth) {
      this.speakNextChunk();
    }

    // Reset pending settings
    this.pendingPause = 0;
    this.pendingVolume = 1.0;
  }

  // Process streaming chunk character by character (SSL state machine)
  queueStreamingChunk(chunk: string) {
    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];

      if (this.insideBracket) {
        // INSIDE BRACKET MODE - accumulate tag, ignore sentence endings
        if (char === ']') {
          // Tag complete - parse it
          const settings = this.parseSSLTag(this.tagBuffer);

          if (settings.pause !== undefined) {
            this.pendingPause = settings.pause;
          }
          if (settings.volume !== undefined) {
            this.pendingVolume = settings.volume;
          }

          this.tagBuffer = '';
          this.insideBracket = false;
        } else {
          this.tagBuffer += char;
        }
      } else {
        // OUTSIDE BRACKET MODE - look for sentence endings or new tags
        if (char === '[') {
          // Starting a new tag - queue current text buffer if it has content
          if (this.textBuffer.trim().length > 0) {
            this.queueSentenceForSpeech(this.textBuffer);
            this.textBuffer = '';
          }

          this.insideBracket = true;
          this.tagBuffer = '';
        } else {
          // Regular text - accumulate
          this.textBuffer += char;

          // Check for sentence endings: ., !, ?, or ...
          const endsWithSentence =
            this.textBuffer.endsWith('...') ||
            this.textBuffer.endsWith('.') ||
            this.textBuffer.endsWith('!') ||
            this.textBuffer.endsWith('?');

          if (endsWithSentence && this.textBuffer.trim().length > 3) {
            // Queue complete sentence
            this.queueSentenceForSpeech(this.textBuffer);
            this.textBuffer = '';
          }
        }
      }
    }
  }

  // Flush any remaining buffered text (call when stream completes)
  flushStreamingBuffer() {
    if (this.textBuffer.trim().length > 0) {
      this.queueSentenceForSpeech(this.textBuffer);
      this.textBuffer = '';
    }
    this.streamingCallbacks.onComplete?.();
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
      return;
    }

    this.isCurrentlySpeaking = true;
    const chunk = this.speechQueue.shift()!;

    // Apply pause before speaking if specified
    const speakChunk = () => {
      this.speakChunk(
        chunk.text,
        {
          volume: chunk.volume || 1.0,
          rate: 1.0,  // Normal speech rate
          pitch: 1.0
        },
        () => {
          // After chunk completes, check for pause after
          if (chunk.pauseAfter && chunk.pauseAfter > 0) {
            setTimeout(() => this.speakNextChunk(), chunk.pauseAfter);
          } else {
            this.speakNextChunk();
          }
        },
        (error) => {
          console.error('Speech chunk error:', error);
          this.speakNextChunk(); // Continue with next chunk
        },
        chunk.volume
      );
    };

    speakChunk();
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

  // Send transcript to backend for analysis and AI response
  async analyzeTranscript(transcript: string, targetVocabulary?: string[]): Promise<{
    aiResponse: string;
    analysis: unknown;
    feedback: {
      clarity: number;
      fluency: number;
      suggestions: string[];
    };
  }> {
    // Sending transcript to backend

    try {
      const requestBody = {
        message: transcript,
        target_vocabulary: targetVocabulary || [],
        session_type: 'daily'
      };

      // Request body prepared

      const response = await fetch(`/api/backend/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Response received

      if (!response.ok) {
        const errorText = await response.text();
        // API Error Response
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      // Successful API response

      return {
        aiResponse: data.response,
        analysis: data.usage_analysis,
        feedback: data.feedback
      };
    } catch (error) {
      // Backend analysis failed
      
      return {
        aiResponse: "That's interesting! Can you tell me more about that?",
        analysis: null,
        feedback: {
          clarity: 75,
          fluency: 70,
          suggestions: [`Backend error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }
      };
    }
  }
}

// Export single service instance
export const browserSpeech = new BrowserSpeechService();