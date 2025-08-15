'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { useConversationStore } from '@/store/conversationStore';
import { Auth } from '@/components/Auth';
import { SpeechInterface } from '@/components/SpeechInterface';
import { PersonalitySelector } from '@/components/PersonalitySelector';
import { ConversationStatus } from '@/components/ConversationStatus';

export default function PracticePage() {
  const lastAIRef = useRef<string>('');
  const [aiResponse, setAIResponse] = useState<string>('');
  
  const {
    session,
    isProcessing,
    addMessage,
    setProcessing,
    setError,
    setBackendSessionId,
  } = useConversationStore();

  // Initialize session on load
  useEffect(() => {
    const initSession = async () => {
      try {
        const resp = await apiClient.startSession({ 
          personality: session.selectedPersonality 
        });
        const sid = resp.data?.session_id;
        if (sid) setBackendSessionId(sid);
      } catch (error) {
        // Ignore error - app will work with fallback mode
      }
    };
    
    initSession();
  }, [session.selectedPersonality, setBackendSessionId]);

  const handleTranscriptComplete = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    
    // Add user message
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content: transcript,
      timestamp: new Date(),
    };
    addMessage(userMessage);
    
    setProcessing(true);
    setError(null);
    
    try {
      const response = await apiClient.sendConversationMessage(
        transcript,
        undefined, // topic
        session.selectedPersonality,
        session.backendSessionId ?? undefined,
        lastAIRef.current || undefined
      );

      const reply = response.data?.response;
      if (reply) {
        lastAIRef.current = reply;
        
        // Add AI message
        const aiMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: reply,
          timestamp: new Date(),
          feedback: response.data?.feedback as any,
        };
        addMessage(aiMessage);
        
        // Trigger AI response (will auto-start listening after speaking)
        setAIResponse(reply);
      } else {
        setError('No response received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response';
      setError(errorMessage);
      
      // Fallback response
      const fallbackResponses = {
        sassy: `Oh, "${transcript}"? How utterly fascinating, darling! Do tell me more - I'm positively riveted!`,
        blunt: `"${transcript}" - okay, got it. What's your point exactly?`,
        friendly: `That's really interesting about "${transcript}"! I'd love to hear more about your experience with that.`,
      };
      
      const fallbackResponse = fallbackResponses[session.selectedPersonality] || fallbackResponses.friendly;
      lastAIRef.current = fallbackResponse;
      
      const fallbackMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant' as const,
        content: fallbackResponse,
        timestamp: new Date(),
      };
      addMessage(fallbackMessage);
      
      // Trigger fallback response
      setAIResponse(fallbackResponse);
    } finally {
      setProcessing(false);
    }
  }, [session.selectedPersonality, session.backendSessionId, addMessage, setProcessing, setError]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <Auth />
      </div>
      
      {/* Logo */}
      <div className="mb-8">
        <Image
          src="/improv-today-logo.png"
          alt="Improv.Today"
          width={200}
          height={80}
          className="h-20 w-auto"
          priority
        />
      </div>
      
      {/* Instructions */}
      <p className="text-white/70 mb-8 text-center">
        Tap → listen → silence → AI speaks → listen
      </p>
      
      {/* Personality Selector */}
      <div className="mb-8">
        <PersonalitySelector disabled={isProcessing} />
      </div>
      
      {/* Main Speech Interface */}
      <SpeechInterface 
        onTranscriptComplete={handleTranscriptComplete}
        disabled={isProcessing}
        aiResponse={aiResponse}
      />
      
      {/* Status */}
      <div className="mt-8">
        <ConversationStatus />
      </div>
    </div>
  );
}