import React from 'react'
import { render, RenderOptions } from '@testing-library/react'

// Mock implementations for complex browser APIs
export const mockCanvasContext = {
  clearRect: jest.fn(),
  fillStyle: '',
  fill: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  strokeStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  shadowBlur: 0,
  shadowColor: '',
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
}

export const mockCanvasElement = {
  width: 400,
  height: 400,
  getContext: jest.fn(() => mockCanvasContext),
  parentElement: {
    clientWidth: 400,
    clientHeight: 400,
  },
}

export const mockAudioContext = {
  createAnalyser: jest.fn(() => ({
    fftSize: 256,
    smoothingTimeConstant: 0.8,
    connect: jest.fn(),
    getByteFrequencyData: jest.fn(),
    frequencyBinCount: 128,
  })),
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
  })),
  close: jest.fn().mockResolvedValue(undefined),
  state: 'running',
}

export const mockMediaStream = {
  getTracks: jest.fn(() => []),
  addTrack: jest.fn(),
  removeTrack: jest.fn(),
}

// Mock browser APIs
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: jest.fn(() => mockAudioContext),
})

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: jest.fn(() => mockAudioContext),
})

Object.defineProperty(window, 'MediaStream', {
  writable: true,
  value: jest.fn(() => mockMediaStream),
})

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
  },
  writable: true,
})

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: jest.fn((cb) => setTimeout(cb, 16)),
})

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: jest.fn(),
})

// Mock Framer Motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement('div', props, children),
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement('button', props, children),
  },
  useAnimationFrame: jest.fn(() => {}),
  AnimatePresence: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement(React.Fragment, null, children),
}))

// Mock Zustand stores - only provide default implementations
// Individual test files can override these mocks as needed
jest.mock('@/store/conversationStore', () => ({
  useConversationStore: jest.fn(() => ({
    addMessage: jest.fn(),
    setProcessing: jest.fn(),
    setUserName: jest.fn(),
    setPersonality: jest.fn(),
  })),
  useConversationState: jest.fn(() => ({
    isProcessing: false,
    isListening: false,
    isAISpeaking: false,
  })),
  useMessages: jest.fn(() => []),
  useSessionState: jest.fn(() => ({
    userName: 'Test User',
    selectedPersonality: 'friendly',
  })),
}))

// Mock VoiceWaveform component
jest.mock('@/components/VoiceWaveform', () => ({
  VoiceWaveform: ({ isListening, isSpeaking, onCentralCircleClick, disabled, emotionalMood }: {
    isListening: boolean;
    isSpeaking: boolean;
    onCentralCircleClick: () => void;
    disabled: boolean;
    emotionalMood: string;
  }) => (
    <div data-testid="voice-waveform">
      <button
        data-testid="central-circle"
        disabled={disabled}
        onClick={onCentralCircleClick}
        data-listening={isListening}
        data-speaking={isSpeaking}
        data-mood={emotionalMood}
      >
        Central Circle
      </button>
    </div>
  ),
}))

// Mock SpeechInterface component
jest.mock('@/components/SpeechInterface', () => ({
  SpeechInterface: React.forwardRef<
    { handleToggle: () => void } | null,
    {
      onTranscriptComplete: (transcript: string) => void;
      disabled: boolean;
      aiResponse?: string;
      onAudioStream?: (stream: MediaStream | null) => void;
    }
  >(function SpeechInterface({ onTranscriptComplete, disabled, aiResponse }) {
    return (
    <div data-testid="speech-interface">
      <button
        data-testid="speech-toggle"
        disabled={disabled}
        onClick={() => {
          if (onTranscriptComplete) {
            onTranscriptComplete('Test transcript')
          }
        }}
      >
        Speech Toggle
      </button>
      {aiResponse && <div data-testid="ai-response">{aiResponse}</div>}
    </div>
    );
  }),
}))

// Mock EmotionalBackdrop component
jest.mock('@/components/EmotionalBackdrop', () => ({
  EmotionalBackdrop: ({ mood }: { mood: string }) => (
    <div data-testid="emotional-backdrop" data-mood={mood}>
      Emotional Backdrop
    </div>
  ),
}))

// Custom render function
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => {
  return render(ui, options)
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Utility functions for testing
export const createMockAudioData = (length: number = 128) => {
  const data = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    data[i] = Math.floor(Math.random() * 255)
  }
  return data
}

export const createMockCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  canvas.getContext = jest.fn(() => mockCanvasContext)
  return canvas
}

export const waitForAnimationFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve)
    })
  })

// Mock fetch for API testing
export const mockFetchResponse = (data: unknown, ok = true) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(data),
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Internal Server Error',
    } as Response),
  )
}

export const mockFetchError = (error: string) => {
  global.fetch = jest.fn(() => Promise.reject(new Error(error)))
}
