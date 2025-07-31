'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VoiceInterface from '@/components/VoiceInterface';
import VocabularyCard from '@/components/VocabularyCard';
import FeedbackPanel from '@/components/FeedbackPanel';
import WaveformVisual from '@/components/WaveformVisual';
import PhaseIndicator from '@/components/PhaseIndicator';
import UsageScoreDisplay from '@/components/UsageScoreDisplay';
import VoiceSettings from '@/components/VoiceSettings';
import { useConversation } from '@/hooks/useConversation';
import { useVocabularyTracking } from '@/hooks/useVocabularyTracking';
import { 
  MessageCircle, 
  BookOpen, 
  Target, 
  Settings,
  Play,
  Square,
  RotateCcw
} from 'lucide-react';

export default function PracticePage() {
  const [activeTab, setActiveTab] = useState('conversation');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [currentPhase, setCurrentPhase] = useState<'initial' | 'daily' | 'feedback'>('initial');
  const [usageScore, setUsageScore] = useState(75);
  
  const {
    messages,
    isProcessing,
    currentTopic,
    sessionDuration,
    error: conversationError,
    startSession,
    sendMessage,
    endSession,
    clearConversation,
    getLastFeedback,
  } = useConversation();

  const {
    weeklyWords,
    loading: vocabularyLoading,
    error: vocabularyError,
    updateWordUsage,
    markWordPracticed,
  } = useVocabularyTracking();

  const practiceTopics = [
    { id: 'daily-life', name: 'Daily Life', description: 'Talk about your routine, hobbies, and everyday activities' },
    { id: 'travel', name: 'Travel & Culture', description: 'Discuss places you\'ve been or want to visit' },
    { id: 'work', name: 'Work & Career', description: 'Professional conversations and career goals' },
    { id: 'technology', name: 'Technology', description: 'Modern tech, social media, and digital life' },
    { id: 'food', name: 'Food & Cooking', description: 'Favorite dishes, recipes, and dining experiences' },
    { id: 'free-choice', name: 'Free Choice', description: 'Choose your own topic to practice' },
  ];

  const handleStartSession = (topic?: string) => {
    startSession(topic);
    setSelectedTopic(topic || '');
  };

  const handleVoiceMessage = (audioBlob: Blob, transcript: string) => {
    sendMessage(transcript, audioBlob);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Improv.Today
          </h1>
          <p className="text-xl text-gray-600">
            Master English through intelligent conversation practice
          </p>
        </div>

        {/* Phase Indicator */}
        <PhaseIndicator 
          currentPhase={currentPhase} 
          onPhaseChange={setCurrentPhase}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="conversation" className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4" />
              <span>Conversation</span>
            </TabsTrigger>
            <TabsTrigger value="vocabulary" className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span>Vocabulary</span>
            </TabsTrigger>
            <TabsTrigger value="pronunciation" className="flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>Pronunciation</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Voice</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Practice Area */}
              <div className="lg:col-span-2 space-y-6">
                {/* Usage Score Display */}
                <UsageScoreDisplay 
                  score={usageScore}
                  animated={true}
                />
                {/* Session Controls */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Practice Session</h2>
                    <div className="flex items-center space-x-4">
                      {currentTopic && (
                        <span className="text-sm text-gray-600">
                          Duration: {formatDuration(sessionDuration)}
                        </span>
                      )}
                      
                      <div className="flex space-x-2">
                        {!currentTopic ? (
                          <Button onClick={() => handleStartSession()}>
                            <Play className="w-4 h-4 mr-2" />
                            Start Session
                          </Button>
                        ) : (
                          <>
                            <Button onClick={endSession} variant="outline">
                              <Square className="w-4 h-4 mr-2" />
                              End Session
                            </Button>
                            <Button onClick={clearConversation} variant="outline">
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reset
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Topic Selection */}
                  {!currentTopic && (
                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-700">Choose a practice topic:</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {practiceTopics.map((topic) => (
                          <Button
                            key={topic.id}
                            onClick={() => handleStartSession(topic.name)}
                            variant="outline"
                            className="h-auto p-4 text-left justify-start"
                          >
                            <div>
                              <div className="font-medium">{topic.name}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {topic.description}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Voice Interface */}
                  {currentTopic && (
                    <VoiceInterface
                      onSpeechEnd={handleVoiceMessage}
                      disabled={isProcessing}
                    />
                  )}
                </Card>

                {/* Conversation History */}
                {messages.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Conversation</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-4 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-blue-50 ml-8'
                              : 'bg-gray-50 mr-8'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-gray-900">{message.content}</p>
                              <span className="text-xs text-gray-500">
                                {message.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            {message.role === 'user' && (
                              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {isProcessing && (
                        <div className="flex items-center justify-center p-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                          <span className="ml-2 text-gray-600">Processing...</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Waveform Visualization */}
                <WaveformVisual
                  isRecording={false}
                  width={600}
                  height={80}
                />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Real-time Feedback */}
                <FeedbackPanel
                  feedback={getLastFeedback()}
                  isRealTime={!!currentTopic}
                />

                {/* Quick Vocabulary */}
                <Card className="p-4">
                  <h3 className="font-medium text-gray-700 mb-3">
                    Today's Vocabulary
                  </h3>
                  <div className="space-y-3">
                    {weeklyWords.slice(0, 3).map((word) => (
                      <VocabularyCard
                        key={word.id}
                        word={word}
                        compact
                        onWordUsed={updateWordUsage}
                        onMarkPracticed={markWordPracticed}
                      />
                    ))}
                  </div>
                </Card>

                {/* Session Stats */}
                {currentTopic && (
                  <Card className="p-4">
                    <h3 className="font-medium text-gray-700 mb-3">
                      Session Stats
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Topic:</span>
                        <span className="font-medium">{currentTopic}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Messages:</span>
                        <span className="font-medium">{messages.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-medium">
                          {formatDuration(sessionDuration)}
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vocabulary" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {vocabularyLoading ? (
                <div className="col-span-2 text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  <p className="mt-2 text-gray-600">Loading vocabulary...</p>
                </div>
              ) : (
                weeklyWords.map((word) => (
                  <VocabularyCard
                    key={word.id}
                    word={word}
                    onWordUsed={updateWordUsage}
                    onMarkPracticed={markWordPracticed}
                    showProgress
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="pronunciation" className="space-y-6">
            <Card className="p-6 text-center">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Pronunciation Practice
              </h3>
              <p className="text-gray-600 mb-4">
                Advanced pronunciation features coming soon!
              </p>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Configure Settings
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <VoiceSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}