// Centralized configuration
export const config = {
  // API configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
    timeout: 30000, // 30 seconds
  },
  
  // Speech recognition configuration
  speech: {
    silenceTimeout: 1200, // ms after a final result before sending
    // Chrome sometimes stops emitting results after the user goes quiet without ever
    // marking one final. Watchdog: finalize the interim text after this much silence.
    interimSilenceTimeout: 1800, // ms of no new results while listening
    language: 'en-US',
    interimResults: true,
    continuous: false,
  },
  
  // AI speech configuration
  aiSpeech: {
    autoStartListeningDelay: 500, // ms after AI finishes speaking
    preferredVoice: 'Google UK English Female',
    fallbackVoices: [
      'Samantha',
      'Alex',
      'Google US English',
    ],
  },
  
  // Session configuration
  session: {
    defaultPersonality: 'friendly' as const,
    updateInterval: 1000, // ms for session duration updates
  },
  
  
  // UI configuration
  ui: {
    notificationDuration: 3000, // ms
    loadingStates: true,
  },
  
  // Environment flags
  env: {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },
} as const;

export type Config = typeof config;