export type SpeechListener = (result: { transcript: string; isFinal: boolean }) => void;

// Minimal DOM type guards for browsers that expose webkit speech recognition
type AnySpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export class SimpleSpeech {
  private recognition?: AnySpeechRecognition;
  private isSpeaking = false;
  private preferredVoice?: SpeechSynthesisVoice;

  constructor() {
    const SpeechRecognitionImpl: any =
      (typeof window !== 'undefined' && (window as any).SpeechRecognition) ||
      (typeof window !== 'undefined' && (window as any).webkitSpeechRecognition);
    if (SpeechRecognitionImpl) {
      const rec: AnySpeechRecognition = new SpeechRecognitionImpl();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      this.recognition = rec;
    }

    // Initialize voices and set default to Google UK English Female if available
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const setDefaultVoice = () => {
        const voices = window.speechSynthesis.getVoices() || [];
        this.preferredVoice = this.pickDefaultUkFemaleVoice(voices);
      };
      setDefaultVoice();
      window.speechSynthesis.onvoiceschanged = () => setDefaultVoice();
    }
  }

  public canListen(): boolean {
    return !!this.recognition;
  }

  public async speak(text: string): Promise<void> {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    await this.stopListening();
    this.isSpeaking = true;
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
        // Align language if voice is en-GB
        if (this.preferredVoice.lang && this.preferredVoice.lang.toLowerCase().startsWith('en-gb')) {
          utterance.lang = 'en-GB';
        }
      }
      utterance.onend = () => {
        this.isSpeaking = false;
        resolve();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  public async startListening(onResult: SpeechListener): Promise<void> {
    if (!this.recognition || this.isSpeaking) return;

    return new Promise((resolve, reject) => {
      if (!this.recognition) return reject(new Error('Speech recognition unavailable'));

      this.recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          const isFinal = event.results[i].isFinal;
          onResult({ transcript, isFinal });
        }
      };

      this.recognition.onerror = (e: any) => {
        reject(e);
      };

      this.recognition.onend = () => {
        resolve();
      };

      try {
        this.recognition.start();
      } catch (e) {
        // Some browsers throw if already started. Stop and retry once.
        try {
          this.recognition.stop();
          this.recognition.start();
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  public async stopListening(): Promise<void> {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {}
  }

  private pickDefaultUkFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
    if (!voices || voices.length === 0) return undefined;

    // 1) Exact common Chrome voice name
    let v = voices.find((vv) => vv.name === 'Google UK English Female');
    if (v) return v;

    // 2) Name contains Google + UK + Female
    v = voices.find((vv) => /google/i.test(vv.name) && /uk/i.test(vv.name) && /female/i.test(vv.name));
    if (v) return v;

    // 3) en-GB + Google
    v = voices.find((vv) => /^en-GB/i.test(vv.lang || '') && /google/i.test(vv.name));
    if (v) return v;

    // 4) Any en-GB
    v = voices.find((vv) => /^en-GB/i.test(vv.lang || ''));
    if (v) return v;

    // 5) Fallback first English voice
    v = voices.find((vv) => /^en-/i.test(vv.lang || ''));
    if (v) return v;

    // 6) Fallback to default
    return voices[0];
  }
}


