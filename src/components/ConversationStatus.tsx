'use client';

import { memo } from 'react';
import { useConversationStore } from '@/store/conversationStore';

export const ConversationStatus = memo(function ConversationStatus() {
  const { session } = useConversationStore();
  
  return (
    <div className="text-center">
      <div className="text-white/70 text-sm">
        Session: {session.backendSessionId ?? '—'}
      </div>
    </div>
  );
});