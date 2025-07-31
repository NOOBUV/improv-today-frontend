'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Calendar, 
  Target, 
  Award,
  Clock,
  BookOpen,
  MessageCircle
} from 'lucide-react';

interface ProgressData {
  daily: {
    date: string;
    clarity: number;
    fluency: number;
    sessions: number;
    duration: number;
  }[];
  weekly: {
    week: string;
    avgClarity: number;
    avgFluency: number;
    totalSessions: number;
    totalDuration: number;
    vocabularyLearned: number;
  }[];
  vocabulary: {
    category: string;
    learned: number;
    total: number;
    mastery: number;
  }[];
  achievements: {
    id: string;
    title: string;
    description: string;
    dateEarned: string;
    type: 'bronze' | 'silver' | 'gold';
  }[];
}

interface ProgressVizProps {
  data: ProgressData;
  timeframe?: 'daily' | 'weekly' | 'monthly';
  className?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

export default function ProgressViz({
  data,
  timeframe = 'daily',
  className = '',
}: ProgressVizProps) {
  const formatTooltip = (value: any, name: string) => {
    if (name === 'duration') {
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return [`${hours}h ${minutes}m`, 'Duration'];
    }
    if (name === 'clarity' || name === 'fluency' || name === 'avgClarity' || name === 'avgFluency') {
      return [`${value}%`, name.charAt(0).toUpperCase() + name.slice(1)];
    }
    return [value, name];
  };

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case 'gold':
        return '🥇';
      case 'silver':
        return '🥈';
      case 'bronze':
        return '🥉';
      default:
        return '🏆';
    }
  };

  // Calculate summary stats
  const recentData = data.daily.slice(-7);
  const avgClarity = Math.round(recentData.reduce((sum, d) => sum + d.clarity, 0) / recentData.length);
  const avgFluency = Math.round(recentData.reduce((sum, d) => sum + d.fluency, 0) / recentData.length);
  const totalSessions = recentData.reduce((sum, d) => sum + d.sessions, 0);
  const totalDuration = recentData.reduce((sum, d) => sum + d.duration, 0);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Clarity</p>
              <p className="text-2xl font-bold text-gray-900">{avgClarity}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Fluency</p>
              <p className="text-2xl font-bold text-gray-900">{avgFluency}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Charts */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Over Time */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Performance Trends</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip formatter={formatTooltip} />
                  <Line 
                    type="monotone" 
                    dataKey="clarity" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="Clarity"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="fluency" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="Fluency"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Session Activity */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Activity</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip formatter={formatTooltip} />
                  <Area
                    type="monotone"
                    dataKey="duration"
                    stackId="1"
                    stroke="#8B5CF6"
                    fill="#8B5CF6"
                    fillOpacity={0.6}
                    name="Duration (min)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="vocabulary" className="space-y-6">
          {/* Vocabulary Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Vocabulary by Category</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.vocabulary}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, learned }) => `${category}: ${learned}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="learned"
                    >
                      {data.vocabulary.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Mastery Levels</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.vocabulary}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={formatTooltip} />
                    <Bar dataKey="mastery" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Vocabulary Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {data.vocabulary.map((category, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{category.category}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      {category.learned}/{category.total} learned
                    </span>
                    <Badge variant="outline">
                      {category.mastery}% mastery
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Achievements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-start space-x-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200"
                >
                  <div className="text-2xl">
                    {getAchievementIcon(achievement.type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {achievement.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {achievement.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Earned {new Date(achievement.dateEarned).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}