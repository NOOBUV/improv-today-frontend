'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { SimpleSpeech } from '@/lib/simpleSpeech';
import { Button } from '@/components/ui/button';
import { Auth } from '@/components/Auth';

type Personality = 'friendly' | 'sassy' | 'blunt';

export default function PracticePage() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [personality, setPersonality] = useState<Personality>('friendly');
  const [status, setStatus] = useState<string>('Tap to start');
  const [listening, setListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [aiSpeaking, setAISpeaking] = useState<boolean>(false);
  const lastAIRef = useRef<string>('');
  const speechRef = useRef<SimpleSpeech | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    speechRef.current = new SimpleSpeech();
    // Start session on load
    (async () => {
      const resp = await apiClient.startSession({ personality });
      const sid = resp.data?.session_id;
      if (sid) setSessionId(sid);
    })();
  }, [personality]);

  const stopSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const startListening = async () => {
    setError(null);
    const speech = speechRef.current;
    if (!speech?.canListen()) {
      setError('Speech recognition not supported. Use Chrome/Edge.');
      return;
    }
    setListening(true);
    setStatus('Listening...');
    setTranscript('');
    try {
      await speech.startListening(({ transcript: t, isFinal }) => {
        if (isFinal) {
          const finalText = t.trim();
          setTranscript(finalText);
          stopSilenceTimer();
          silenceTimerRef.current = setTimeout(() => {
            void handleFinalTranscript(finalText);
          }, 1200);
                  } else {
          // Show only the latest interim chunk to avoid duplication
          setTranscript(t);
          stopSilenceTimer();
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start listening';
      setError(message);
      setListening(false);
    }
  };

  const stopListening = async () => {
    stopSilenceTimer();
    setListening(false);
    await speechRef.current?.stopListening();
  };

  const speak = async (text: string) => {
    setAISpeaking(true);
    setStatus('AI speaking...');
    await speechRef.current?.speak(text);
    setAISpeaking(false);
  };

  const handleFinalTranscript = async (text: string) => {
    await stopListening();
    setStatus('Thinking...');
    try {
      const resp = await apiClient.sendConversationMessage(text, undefined, personality, sessionId ?? undefined, lastAIRef.current || undefined);
      const reply = resp.data?.response;
      if (reply) {
        lastAIRef.current = reply;
        await speak(reply);
        setStatus('Listening...');
        await startListening();
      } else {
        setStatus('No response');
      }
    } catch {
      setError('Failed to fetch response');
      setStatus('Error');
    }
  };

  const toggle = async () => {
    if (aiSpeaking) return;
    if (listening) {
      await stopListening();
      setStatus('Paused');
      return;
    }
    if (!sessionId) {
      const resp = await apiClient.startSession({ personality });
      const sid = resp.data?.session_id;
      if (sid) setSessionId(sid);
    }
    await startListening();
  };

  const onPersonality = async (p: Personality) => {
    setPersonality(p);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <Auth />
      </div>
      <div className="mb-4">
        <Image
          src="/improv-today-logo.png"
          alt="Improv.Today"
          width={200}
          height={80}
          className="h-20 w-auto"
          priority
        />
      </div>
      <p className="text-white/70 mb-8">Tap → listen → silence → AI speaks → listen</p>

      <div className="flex gap-2 mb-6">
        {(['friendly', 'sassy', 'blunt'] as Personality[]).map((p) => (
          <Button key={p} onClick={() => onPersonality(p)} variant={p === personality ? 'default' : 'outline'}>
            {p}
            </Button>
          ))}
      </div>

      <Button onClick={toggle} className="w-48 h-48 rounded-full text-lg">
        {aiSpeaking ? 'Speaking...' : listening ? 'Pause' : 'Tap to talk'}
              </Button>

      <div className="mt-6 text-center text-white/80 min-h-[3rem]">
        <div className="mb-2">{status}</div>
        {transcript && <div className="text-sm italic break-words max-w-md">“{transcript}”</div>}
        {error && <div className="text-red-300 mt-2">{error}</div>}
              </div>

      <div className="mt-6 text-white/70 text-sm">Session: {sessionId ?? '—'}</div>
    </div>
  );
}