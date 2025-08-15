'use client';

import { useConversationStore } from '@/store/conversationStore';

export function ConversationStatus() {
  const { session } = useConversationStore();
  
  return (
    <div className="text-center">
      <div className="text-white/70 text-sm">
        Session: {session.backendSessionId ?? '—'}
      </div>
    </div>
  );
}