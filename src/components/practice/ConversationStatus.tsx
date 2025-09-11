'use client';

import { memo } from 'react';
import { usePracticeStore } from '@/store/practiceStore';

export const ConversationStatus = memo(function ConversationStatus() {
  const { session } = usePracticeStore();
  
  return (
    <div className="text-center">
      <div className="text-white/70 text-sm">
        Session: {session.backendSessionId ?? '—'}
      </div>
    </div>
  );
});