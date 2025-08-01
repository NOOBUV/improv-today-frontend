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
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
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
      } catch (e) {
        console.warn('Speech recognition constructor failed:', e);
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
    } catch (permissionError) {
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
                } catch (e) {
                  console.warn('Failed to restart recognition:', e);
                }
              }
            }, 100);
          }
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Handle specific errors differently
        if (event.error === 'not-allowed') {
          console.error('Speech recognition error:', event.error, event.message);
          onError('Microphone access denied. Please allow microphone permission in your browser settings.');
        } else if (event.error === 'no-speech') {
          // Don't treat no-speech as a fatal error - just continue listening silently
          return; // Don't call onError or log, just continue
        } else if (event.error === 'audio-capture') {
          console.error('Speech recognition error:', event.error, event.message);
          onError('Microphone not available. Please check your device settings.');
        } else if (event.error === 'network') {
          console.error('Speech recognition error:', event.error, event.message);
          onError('Network error. Please check your internet connection.');
        } else {
          console.error('Speech recognition error:', event.error, event.message);
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

    this.synth.cancel(); // Stop any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = options.voice || this.selectedVoice || this.getDefaultVoice();
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 0.8;
    utterance.lang = options.lang ?? 'en-GB'; // Default to UK English

    utterance.onend = () => onEnd?.();
    utterance.onerror = (event) => onError?.(`Speech error: ${event.error}`);

    this.synth.speak(utterance);
  }

  // Get default English voice (prefer UK female)
  private getDefaultVoice(): SpeechSynthesisVoice | null {
    const englishVoices = this.voices.filter(voice => voice.lang.startsWith('en'));
    
    // First priority: UK English female voices
    const ukFemalePriority = ['en-GB', 'en_GB'];
    for (const lang of ukFemalePriority) {
      const ukVoices = englishVoices.filter(voice => 
        voice.lang.toLowerCase().includes(lang.toLowerCase())
      );
      
      // Look for female-sounding names in UK voices
      const femaleNames = ['female', 'woman', 'kate', 'emma', 'sarah', 'alice', 'victoria', 'olivia'];
      const ukFemaleVoice = ukVoices.find(voice => 
        femaleNames.some(name => voice.name.toLowerCase().includes(name))
      );
      
      if (ukFemaleVoice) return ukFemaleVoice;
      
      // If no specific female voice found, take first UK voice
      if (ukVoices.length > 0) return ukVoices[0];
    }
    
    // Fallback to any English voice
    return englishVoices.find(voice => voice.default) || englishVoices[0] || null;
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

  // Get recommended voices (better quality)
  getRecommendedVoices(): SpeechSynthesisVoice[] {
    const voices = this.getVoices();
    return voices.filter(voice => 
      voice.name.includes('Google') || 
      voice.name.includes('Microsoft') ||
      voice.name.includes('Alex') ||
      voice.name.includes('Samantha') ||
      voice.name.includes('Karen')
    );
  }

  // Send transcript to backend for analysis and AI response
  async analyzeTranscript(transcript: string, targetVocabulary?: any[]): Promise<any> {
    console.log('🚀 Sending transcript to backend:', {
      transcript,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      endpoint: `${process.env.NEXT_PUBLIC_API_URL}/api/conversation`
    });

    try {
      const requestBody = {
        message: transcript,
        target_vocabulary: targetVocabulary || [],
        session_type: 'daily'
      };

      console.log('📤 Request body:', requestBody);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Successful API response:', data);

      return {
        aiResponse: data.response,
        analysis: data.usage_analysis,
        feedback: data.feedback
      };
    } catch (error) {
      console.error('❌ Backend analysis failed:', error);
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🔌 Network error - is the backend running?');
      }
      
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