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
}

// Main Browser Speech Service (simplified)
export class BrowserSpeechService {
  private recognition: SpeechRecognition | null = null;
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;

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

  // Speak text using Chrome Web Speech Synthesis
  speak(
    text: string, 
    options: TextToSpeechOptions = {},
    onEnd?: () => void,
    onError?: (error: string) => void
  ) {
    if (!text.trim() || !this.synth) return;

    // Chrome fix: Always cancel before speaking to fix Chrome 130 issues
    this.synth.cancel();
    
    // Wait a bit for cancel to take effect (Chrome needs this)
    setTimeout(() => this.speakNow(text, options, onEnd, onError), 100);
  }

  private speakNow(text: string, options: TextToSpeechOptions, onEnd?: () => void, onError?: (error: string) => void) {
    if (!text.trim() || !this.synth) return;

    // Check if voices are loaded
    if (this.voices.length === 0) {
      // No voices loaded, trying to reload
      this.loadVoices();
      setTimeout(() => {
        if (this.voices.length === 0) {
          // Still no voices available
          onError?.('No voices available');
          return;
        }
        this.speakNow(text, options, onEnd, onError);
      }, 500);
      return;
    }

    // Create utterance with settings
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = options.voice || this.selectedVoice || this.getDefaultVoice();
    utterance.voice = selectedVoice;
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1.0; // Max volume
    utterance.lang = options.lang ?? 'en-GB'; // Strict en-GB default
    
    // Voice settings configured

    utterance.onend = () => {
      // Speech completed successfully
      onEnd?.();
    };
    
    utterance.onerror = (event) => {
      // Speech error event
      if (event.error === 'canceled') {
        // Speech was canceled
        onEnd?.(); // Reset state even if canceled
        return;
      }
      // Speech synthesis error
      onError?.(`Speech error: ${event.error}`);
    };

    // Speak immediately
    try {
      // Speaking now
      this.synth.speak(utterance);
    } catch (error) {
      // Failed to start speech
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

  // Stop speaking
  stopSpeaking() {
    this.synth?.cancel();
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