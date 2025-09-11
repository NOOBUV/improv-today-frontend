'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { usePracticeStore, usePracticeCurrentSuggestion, VocabularySuggestion } from '@/store/practiceStore';
import { Auth } from '@/components/shared/Auth';
import { SpeechInterface } from '@/components/shared/SpeechInterface';
import { PersonalitySelector } from '@/components/practice/PersonalitySelector';
import { ConversationStatus } from '@/components/practice/ConversationStatus';
import { SuggestionPill } from '@/components/practice/suggestions/SuggestionPill';
import { RouteGuard } from '@/components/shared/RouteGuard';

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
    setSuggestion,
    clearSuggestion,
    updateSuggestionFeedback,
  } = usePracticeStore();
  
  const currentSuggestion = usePracticeCurrentSuggestion();

  // Initialize session on load
  useEffect(() => {
    const initSession = async () => {
      try {
        const resp = await apiClient.startSession({ 
          personality: session.selectedPersonality 
        });
        const sid = resp.data?.session_id;
        if (sid) setBackendSessionId(sid);
      } catch {
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
        
        // Handle new suggestion data
        if (response.data?.suggestion) {
          const newSuggestion: Partial<VocabularySuggestion> = {
            id: parseInt(response.data.suggestion.id),
            word: response.data.suggestion.word,
            definition: response.data.suggestion.definition,
            exampleSentence: response.data.suggestion.exampleSentence,
          };
          
          // Only include remediationFeedback if it exists and is not empty
          if (response.data.suggestion.remediationFeedback && response.data.suggestion.remediationFeedback.trim().length > 0) {
            newSuggestion.remediationFeedback = response.data.suggestion.remediationFeedback;
          }
          
          setSuggestion(newSuggestion as VocabularySuggestion);
        }
        
        // Handle remediation feedback for existing suggestion (AC: 5)
        if (response.data?.remediation_feedback && currentSuggestion) {
          updateSuggestionFeedback(currentSuggestion.id, response.data.remediation_feedback);
        }
        
        // Handle used suggestion (remove from display)
        if (response.data?.used_suggestion_id) {
          clearSuggestion(parseInt(response.data.used_suggestion_id.toString()));
        }
        
        // Add AI message
        const aiMessage: Record<string, unknown> = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: reply,
          timestamp: new Date(),
        };
        
        if (response.data?.feedback) {
          aiMessage.feedback = response.data.feedback;
        }
        
        addMessage(aiMessage as never);
        
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
  }, [session.selectedPersonality, session.backendSessionId, addMessage, setProcessing, setError, setSuggestion, clearSuggestion, updateSuggestionFeedback, currentSuggestion]);

  return (
    <RouteGuard 
      route="/practice" 
      disabled={true} 
      redirectTo="/conversation"
      disabledMessage="The practice system has been temporarily disabled. Please use the conversation system instead."
    >
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
      
      {/* Suggestion Display */}
      {currentSuggestion && (
        <div className="mt-6">
          <SuggestionPill suggestion={currentSuggestion} />
        </div>
      )}
      
      {/* Status */}
      <div className="mt-8">
        <ConversationStatus />
      </div>
    </div>
    </RouteGuard>
  );
}