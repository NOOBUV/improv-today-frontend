'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { browserSpeech } from '@/lib/speech';
import { Volume2, Play } from 'lucide-react';

export default function VoiceSettings() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    // Load voices when component mounts
    const loadVoices = () => {
      const availableVoices = browserSpeech.getVoices();
      setVoices(availableVoices);
      setSelectedVoice(browserSpeech.getCurrentVoice());
    };

    loadVoices();
    
    // Some browsers load voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [isClient]);

  const handleVoiceChange = (voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
    browserSpeech.setVoice(voice);
  };

  const testVoice = (voice: SpeechSynthesisVoice) => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    browserSpeech.speak(
      "Hello! This is how I sound. Do you like this voice?",
      { voice },
      () => setIsPlaying(false),
      () => setIsPlaying(false)
    );
  };

  if (!isClient) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500 py-4">
          Loading voice settings...
        </div>
      </Card>
    );
  }

  const recommendedVoices = browserSpeech.getRecommendedVoices();
  const allVoices = voices;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Voice Settings</h3>
        </div>

        {recommendedVoices.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Recommended Voices (Better Quality)
            </h4>
            <div className="space-y-2">
              {recommendedVoices.map((voice, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedVoice?.name === voice.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleVoiceChange(voice)}
                >
                  <div>
                    <div className="font-medium">{voice.name}</div>
                    <div className="text-sm text-gray-500">{voice.lang}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      testVoice(voice);
                    }}
                    disabled={isPlaying}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            All Available Voices
          </h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {allVoices.map((voice, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 border rounded cursor-pointer transition-colors ${
                  selectedVoice?.name === voice.name
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleVoiceChange(voice)}
              >
                <div>
                  <div className="text-sm font-medium">{voice.name}</div>
                  <div className="text-xs text-gray-500">{voice.lang}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    testVoice(voice);
                  }}
                  disabled={isPlaying}
                >
                  <Play className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {voices.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            Loading voices...
          </div>
        )}
      </div>
    </Card>
  );
}