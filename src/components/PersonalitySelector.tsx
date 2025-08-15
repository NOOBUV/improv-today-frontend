'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { useConversationStore, type Personality } from '@/store/conversationStore';

const PERSONALITIES: { value: Personality; label: string; description: string }[] = [
  { 
    value: 'friendly', 
    label: 'Friendly', 
    description: 'Warm and encouraging conversation partner' 
  },
  { 
    value: 'sassy', 
    label: 'Sassy', 
    description: 'Witty and playful with a bit of attitude' 
  },
  { 
    value: 'blunt', 
    label: 'Blunt', 
    description: 'Direct and honest, no sugar-coating' 
  },
];

interface PersonalitySelectorProps {
  disabled?: boolean;
}

export const PersonalitySelector = memo(function PersonalitySelector({ disabled = false }: PersonalitySelectorProps) {
  const { session, setPersonality } = useConversationStore();
  const { selectedPersonality } = session;

  const handlePersonalityChange = (personality: Personality) => {
    if (!disabled) {
      setPersonality(personality);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <h3 className="text-white/70 text-sm font-medium">Choose AI Personality</h3>
      <div className="flex gap-2">
        {PERSONALITIES.map((personality) => (
          <Button
            key={personality.value}
            onClick={() => handlePersonalityChange(personality.value)}
            variant={personality.value === selectedPersonality ? 'default' : 'outline'}
            disabled={disabled}
            className="relative group"
            title={personality.description}
          >
            {personality.label}
          </Button>
        ))}
      </div>
    </div>
  );
});