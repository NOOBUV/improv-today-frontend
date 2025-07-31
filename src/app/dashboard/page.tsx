'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import ProgressViz from '@/components/ProgressViz';
import VocabularyCard from '@/components/VocabularyCard';
import { useVocabularyTracking } from '@/hooks/useVocabularyTracking';
import { 
  TrendingUp, 
  Calendar, 
  Target, 
  Award,
  BookOpen,
  MessageCircle,
  Clock,
  Star,
  ArrowRight,
  Activity,
} from 'lucide-react';

// Mock progress data - replace with real API calls
const mockProgressData = {
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString(),
    clarity: Math.floor(Math.random() * 30) + 70,
    fluency: Math.floor(Math.random() * 30) + 65,
    sessions: Math.floor(Math.random() * 3) + 1,
    duration: Math.floor(Math.random() * 60) + 15,
  })),
  weekly: Array.from({ length: 12 }, (_, i) => ({
    week: `Week ${i + 1}`,
    avgClarity: Math.floor(Math.random() * 20) + 75,
    avgFluency: Math.floor(Math.random() * 20) + 70,
    totalSessions: Math.floor(Math.random() * 15) + 10,
    totalDuration: Math.floor(Math.random() * 300) + 200,
    vocabularyLearned: Math.floor(Math.random() * 10) + 5,
  })),
  vocabulary: [
    { category: 'Business', learned: 25, total: 50, mastery: 85 },
    { category: 'Travel', learned: 30, total: 40, mastery: 75 },
    { category: 'Daily Life', learned: 45, total: 60, mastery: 90 },
    { category: 'Technology', learned: 18, total: 35, mastery: 65 },
    { category: 'Food', learned: 22, total: 30, mastery: 80 },
  ],
  achievements: [
    {
      id: '1',
      title: 'First Conversation',
      description: 'Completed your first practice session',
      dateEarned: '2024-01-15',
      type: 'bronze' as const,
    },
    {
      id: '2',
      title: 'Vocabulary Master',
      description: 'Learned 50 new words this month',
      dateEarned: '2024-01-20',
      type: 'silver' as const,
    },
    {
      id: '3',
      title: 'Consistency Champion',
      description: 'Practiced 7 days in a row',
      dateEarned: '2024-01-25',
      type: 'gold' as const,
    },
  ],
};

export default function DashboardPage() {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [progressData, setProgressData] = useState(mockProgressData);
  
  const {
    weeklyWords,
    stats,
    loading: vocabularyLoading,
    updateWordUsage,
    markWordPracticed,
  } = useVocabularyTracking();

  // Calculate recent performance
  const recentData = progressData.daily.slice(-7);
  const avgClarity = Math.round(recentData.reduce((sum, d) => d.clarity + sum, 0) / recentData.length);
  const avgFluency = Math.round(recentData.reduce((sum, d) => d.fluency + sum, 0) / recentData.length);
  const totalSessions = recentData.reduce((sum, d) => d.sessions + sum, 0);
  const totalDuration = recentData.reduce((sum, d) => d.duration + sum, 0);

  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-green-500' };
    if (score >= 80) return { label: 'Very Good', color: 'bg-blue-500' };
    if (score >= 70) return { label: 'Good', color: 'bg-yellow-500' };
    if (score >= 60) return { label: 'Fair', color: 'bg-orange-500' };
    return { label: 'Needs Work', color: 'bg-red-500' };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Progress Dashboard
          </h1>
          <p className="text-gray-600">
            Track your English speaking improvement over time
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overall Performance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((avgClarity + avgFluency) / 2)}%
                </p>
                <Badge 
                  className={`mt-1 text-xs ${getPerformanceLevel((avgClarity + avgFluency) / 2).color} text-white`}
                >
                  {getPerformanceLevel((avgClarity + avgFluency) / 2).label}
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Sessions This Week</p>
                <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round(totalDuration / 60)}h {totalDuration % 60}m total
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Words Learned</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progressData.vocabulary.reduce((sum, cat) => sum + cat.learned, 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.masteredWords} mastered
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Award className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Streak</p>
                <p className="text-2xl font-bold text-gray-900">{stats.practiceStreak}</p>
                <p className="text-xs text-gray-500 mt-1">days in a row</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <div className="lg:col-span-2">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Recent Activity</h3>
                    <Button variant="outline" size="sm">
                      View All
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {recentData.slice(-5).map((day, index) => (
                      <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            Practice Session - {day.sessions} conversations
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(day.date).toLocaleDateString()} • {day.duration} minutes
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">Clarity: {day.clarity}%</p>
                          <p className="text-sm text-gray-600">Fluency: {day.fluency}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Button className="w-full justify-start" size="sm">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Start Practice Session
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Review Vocabulary
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Target className="w-4 h-4 mr-2" />
                      Set Learning Goals
                    </Button>
                  </div>
                </Card>

                {/* Today's Goals */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Today's Goals</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-green-500 rounded-full" />
                      <span className="text-sm">Complete 1 practice session</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                      <span className="text-sm text-gray-600">Learn 3 new words</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                      <span className="text-sm text-gray-600">Practice for 15 minutes</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <ProgressViz data={progressData} timeframe={timeframe} />
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

          <TabsContent value="achievements" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {progressData.achievements.map((achievement) => (
                <Card key={achievement.id} className="p-6">
                  <div className="text-center space-y-4">
                    <div className="text-4xl">
                      {achievement.type === 'gold' && '🥇'}
                      {achievement.type === 'silver' && '🥈'}
                      {achievement.type === 'bronze' && '🥉'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {achievement.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {achievement.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        Earned {new Date(achievement.dateEarned).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={`
                      ${achievement.type === 'gold' ? 'bg-yellow-500' : ''}
                      ${achievement.type === 'silver' ? 'bg-gray-400' : ''}
                      ${achievement.type === 'bronze' ? 'bg-orange-600' : ''}
                      text-white
                    `}>
                      {achievement.type.charAt(0).toUpperCase() + achievement.type.slice(1)}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}