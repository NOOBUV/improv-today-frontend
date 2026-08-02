'use client';

interface TextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

// The backend no longer emits speech markup, but old history and stale replies still can —
// strip it before synthesis so tokens like [pause:0.4s] are never read aloud as words.
const SPEECH_MARKUP = /\[(?:pause|breath|thinking|volume)(?::[^\]]*)?\]/gi;

// Clara's stream is the model's raw output: usually {"message": "...", "emotion": "..."}, but
// the model sometimes answers in plain prose and the backend's fallback always does (it parses
// both — see _parse_llm_response). Pull the spoken text out of whatever shape arrived so far,
// so the TTS path never goes silent on a reply the transcript happily shows.
// ponytail: string scan, not a streaming JSON parser. One field, one quote to find.
export function spokenTextSoFar(raw: string): string {
  const field = raw.match(/"message"\s*:\s*"/);
  // No "message" yet: a plain-text stream speaks as-is, a JSON one just hasn't got there.
  if (!field) return raw.trimStart().startsWith('{') ? '' : raw;
  const after = raw.slice(field.index! + field[0].length);
  const closing = after.search(/(?<!\\)"/); // -1 while the value is still streaming
  return (closing === -1 ? after : after.slice(0, closing))
    .replace(/\\(.)/g, (_, c) => (c === 'n' ? ' ' : c));
}

// ponytail: hardcoded localhost, no cache. It's a dev-machine sidecar, not a service.
const VOICE_SERVER = 'http://localhost:8880';

// The voice server hands back raw little-endian int16 mono — no container, because a WAV header
// written before the length is known is a lie the client then has to un-believe.
export function pcmToFloat32(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(bytes.byteLength >> 1);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

// Qwen3 delivers a second of audio roughly every 0.86s — enough headroom to keep up, not enough
// to absorb a slow chunk. Playing the first chunk the instant it lands would let playback catch
// up with the generator mid-sentence and stutter; this lead-in costs a third of a second once
// per sentence and buys back the jitter.
const PLAYBACK_LEAD_S = 0.35;

// Text-to-speech service: local voice server first, browser speechSynthesis fallback.
export class BrowserSpeechService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private speechQueue: string[] = [];
  private isCurrentlySpeaking: boolean = false;

  // Web Audio playback of the streamed PCM.
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private playCursor = 0; // AudioContext time the next chunk should start at
  private scheduled = new Set<AudioBufferSourceNode>();
  // One controller per turn: stopSpeaking aborts it and every in-flight fetch, including a
  // prefetch, dies with it.
  private abortController = new AbortController();
  // At most one sentence read ahead. Deeper queueing just buys the voice server more work to
  // throw away when the user barges in.
  private prefetched: { text: string; res: Promise<Response> } | null = null;

  // Streaming sentence buffer
  private textBuffer: string = '';
  // Conditions the voice server's TTS. Set per turn from the stream's context_ready event,
  // which lands before the first chunk — so even the first sentence is spoken in character.
  private emotion: string = 'calm';
  // A drained queue only means the turn is over once the stream itself has ended. Mid-reply the
  // queue empties all the time (next sentence not extracted yet, or a slow TTS engine finishing
  // audio before the next chunk lands) — firing onComplete there stops Clara mid-reply and
  // re-arms the mic over her. 'ended' waits for the drain; 'idle' means onComplete already fired.
  private turnState: 'streaming' | 'ended' | 'idle' = 'idle';
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

  // Speak a single chunk: local voice server first, browser speechSynthesis if it can't.
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

    this.speakViaVoiceServer(clean, options.volume ?? 1.0)
      .then(() => onChunkEnd?.())
      .catch(() => {
        // stopSpeaking() aborted the fetch — that's a cancel, not a failure to speak.
        if (!this.isCurrentlySpeaking) return onChunkEnd?.();
        this.speakChunkWithBrowser(clean, options, onChunkEnd, onError);
      });
  }

  // POST the sentence to the local voice server and play it. Rejects on anything (server down,
  // non-200, playback refused) so the caller can fall back to the browser voice.
  private async speakViaVoiceServer(text: string, volume: number): Promise<void> {
    const res = await this.takeResponse(text);
    if (!res.ok) throw new Error(`Voice server responded ${res.status}`);
    if (!this.isCurrentlySpeaking) return; // stopSpeaking() ran while the audio was in flight

    // The server falls back to a whole Kokoro WAV when Qwen3 can't start in time.
    if (res.headers.get('Content-Type')?.includes('audio/wav')) return this.playWav(res, volume);
    return this.playPcmStream(res, volume);
  }

  private postSpeech(text: string): Promise<Response> {
    return fetch(`${VOICE_SERVER}/v1/audio/speech/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, emotion: this.emotion }),
      signal: this.abortController.signal,
    });
  }

  // Use the prefetched response if it's for this sentence — the queue is FIFO, so it always is
  // unless a stop cleared it.
  private takeResponse(text: string): Promise<Response> {
    const ready = this.prefetched;
    this.prefetched = null;
    return ready?.text === text ? ready.res : this.postSpeech(text);
  }

  // Start the next sentence's synthesis while this one plays: the voice server needs ~1.8s to
  // produce its first chunk, and it can spend that behind the current sentence instead of after.
  private prefetchNext() {
    const next = this.speechQueue[0];
    if (!next || this.prefetched) return;
    try {
      const res = this.postSpeech(next);
      res.catch(() => {}); // failures surface at play time; this only stops the unhandled reject
      this.prefetched = { text: next, res };
    } catch {
      // Reading ahead is an optimization — never let it break queuing. Play time retries.
    }
  }

  private audioContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    // Autoplay policy: the conversation always starts from a click, so this resolves silently.
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  // Read the PCM stream and hand each chunk to Web Audio back-to-back. Resolves when the last
  // scheduled chunk has finished playing — the caller's "still speaking" depends on it.
  private async playPcmStream(res: Response, volume: number): Promise<void> {
    if (!res.body) throw new Error('Voice server sent no body');
    const sampleRate = Number(res.headers.get('X-Sample-Rate')) || 24000;
    const ctx = this.audioContext();
    if (this.gain) this.gain.gain.value = volume;

    const reader = res.body.getReader();
    this.playCursor = Math.max(this.playCursor, ctx.currentTime + PLAYBACK_LEAD_S);
    let leftover = new Uint8Array(0); // a read can split an int16 down the middle
    let last: AudioBufferSourceNode | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!this.isCurrentlySpeaking) {
        void reader.cancel().catch(() => {});
        break;
      }
      let bytes = value as Uint8Array;
      if (leftover.length) {
        const joined = new Uint8Array(leftover.length + bytes.length);
        joined.set(leftover);
        joined.set(bytes, leftover.length);
        bytes = joined;
      }
      const usable = bytes.length - (bytes.length % 2);
      leftover = bytes.slice(usable); // at most one byte; a copy keeps it off the read's buffer
      if (usable) last = this.scheduleChunk(pcmToFloat32(bytes.subarray(0, usable)), sampleRate, ctx);
    }

    if (!last) return;
    // stop() also fires 'ended', so a barge-in resolves this instead of hanging the turn.
    await new Promise<void>((resolve) => { last!.onended = () => resolve(); });
  }

  private scheduleChunk(samples: Float32Array, sampleRate: number, ctx: AudioContext): AudioBufferSourceNode {
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain ?? ctx.destination);
    const startAt = Math.max(this.playCursor, ctx.currentTime);
    source.start(startAt);
    this.playCursor = startAt + samples.length / sampleRate;
    this.scheduled.add(source);
    source.addEventListener?.('ended', () => this.scheduled.delete(source));
    return source;
  }

  private stopScheduled() {
    for (const source of this.scheduled) {
      try { source.stop(); } catch { /* already ended */ }
    }
    this.scheduled.clear();
    this.playCursor = 0;
  }

  // Whole-WAV playback: the server's Kokoro fallback, and nothing else.
  private async playWav(res: Response, volume: number): Promise<void> {
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.volume = volume;
    this.currentAudio = audio;
    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onpause = () => resolve(); // stopSpeaking() pauses — mirrors synth's 'canceled'
        audio.onerror = () => reject(new Error('Voice server audio playback failed'));
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
    utterance.voice = this.getDefaultVoice();
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1.0;
    utterance.lang = 'en-GB';

    utterance.onend = () => onChunkEnd?.();

    utterance.onerror = (event) => {
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

  // Stop speaking with enhanced pause control
  stopSpeaking() {
    this.isCurrentlySpeaking = false;
    // The turn is over whatever the stream was doing — let the pending drain end it.
    if (this.turnState === 'streaming') this.turnState = 'ended';
    this.speechQueue = [];
    this.currentAudio?.pause(); // fires 'pause' → the fetch promise resolves like a cancel
    this.synth?.cancel();
    this.stopScheduled();
    this.abortController.abort(); // kills the reader and any prefetch in flight
    this.abortController = new AbortController();
    this.prefetched = null;
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
    } else {
      this.prefetchNext(); // queued behind the sentence being spoken — warm it now
    }
  }

  // Emotion for the turn being streamed. Unknown/absent values are the server's problem —
  // it falls back to its own default rather than guessing here.
  setEmotion(emotion: string) {
    this.emotion = emotion || 'calm';
  }

  // Buffer streamed text and queue each complete sentence
  queueStreamingChunk(chunk: string) {
    this.turnState = 'streaming';
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

  // Flush any remaining buffered text (call when stream completes — including an aborted or
  // errored one, so a turn that queued nothing still ends instead of sticking on "speaking").
  flushStreamingBuffer() {
    this.turnState = 'ended';
    if (this.textBuffer.trim().length > 0) {
      const tail = this.textBuffer;
      this.textBuffer = '';
      this.queueSentenceForSpeech(tail); // may drain synchronously and end the turn itself
    }
    this.endTurnIfDrained();
  }

  // onComplete fires once per turn: stream ended, queue empty, nothing playing.
  private endTurnIfDrained() {
    if (this.turnState !== 'ended' || this.isCurrentlySpeaking || this.speechQueue.length > 0) return;
    this.turnState = 'idle';
    this.streamingCallbacks.onComplete?.();
  }

  // Set streaming callbacks
  setStreamingCallbacks(callbacks: {
    onSentenceQueued?: (text: string) => void;
    onComplete?: () => void;
  }) {
    // Deliberately does not touch turnState: ConversationPageClient re-registers callbacks
    // whenever the speaking flag flips, i.e. mid-turn. queueStreamingChunk marks the turn live.
    this.streamingCallbacks = callbacks;
  }

  // Speak next chunk in queue
  private speakNextChunk() {
    if (this.speechQueue.length === 0 || !this.synth) {
      this.isCurrentlySpeaking = false;
      this.endTurnIfDrained(); // a gap mid-stream is not the end of the turn
      return;
    }

    this.isCurrentlySpeaking = true;
    const sentence = this.speechQueue.shift()!;
    this.prefetchNext();

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

}
