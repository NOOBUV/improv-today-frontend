'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';

interface UsageScoreDisplayProps {
  score: number;
  label?: string;
  description?: string;
  animated?: boolean;
  className?: string;
}

export default function UsageScoreDisplay({
  score,
  label = "Usage Quality Score",
  description = "How naturally you used vocabulary",
  animated = true,
  className = ''
}: UsageScoreDisplayProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setDisplayScore(score);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setDisplayScore(score);
    }
  }, [score, animated]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'from-green-500 to-emerald-500';
    if (score >= 80) return 'from-blue-500 to-cyan-500';
    if (score >= 70) return 'from-purple-500 to-pink-500';
    if (score >= 60) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Practice';
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className={`bg-gradient-to-r ${getScoreColor(score)} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{label}</h3>
            <p className="text-white/80 text-sm">{description}</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${animated ? 'transition-all duration-1000' : ''}`}>
              {displayScore}%
            </div>
            <div className="text-sm text-white/80">
              {getScoreLabel(displayScore)}
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full bg-white rounded-full transition-all duration-1500 ease-out ${
                animated ? 'transform' : ''
              }`}
              style={{ width: `${displayScore}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}