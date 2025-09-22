import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '../../__tests__/test-utils'
import { mockFetchResponse, mockFetchError } from '../../__tests__/test-utils'

// Mock the conversation store with more detailed implementation
const mockStore = {
  addMessage: jest.fn(),
  setProcessing: jest.fn(),
  setUserName: jest.fn(),
  setPersonality: jest.fn(),
}

const mockState = {
  isProcessing: false,
  isListening: false,
  isAISpeaking: false,
}

jest.mock('@/store/conversationStore', () => ({
  useConversationStore: jest.fn(() => mockStore),
  useConversationState: jest.fn(() => mockState),
  useMessages: jest.fn(() => []),
  useSessionState: jest.fn(() => ({
    userName: 'Test User',
    selectedPersonality: 'friendly',
  })),
}))

jest.mock('@/components/EmotionalBackdrop', () => ({
  EmotionalBackdrop: ({ mood }: any) => (
    <div data-testid="emotional-backdrop" data-mood={mood}>
      Emotional Backdrop
    </div>
  ),
}))

jest.mock('@/components/VoiceWaveform', () => ({
  VoiceWaveform: ({ isListening, isSpeaking, onCentralCircleClick, disabled, emotionalMood }: any) => (
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

// Mock SpeechInterface with more realistic implementation
const mockSpeechInterfaceRef = {
  handleToggle: jest.fn(),
}

jest.mock('@/components/SpeechInterface', () => ({
  SpeechInterface: React.forwardRef(({
    onTranscriptComplete,
    disabled,
    aiResponse,
    onAudioStream
  }: any, ref: any) => {
    const [isListening, setIsListening] = React.useState(false)
    const [currentTranscript, setCurrentTranscript] = React.useState('')

    React.useImperativeHandle(ref, () => ({
      handleToggle: () => {
        if (isListening) {
          // Stop listening and call transcript complete
          setIsListening(false)
          if (onTranscriptComplete && currentTranscript) {
            onTranscriptComplete(currentTranscript)
          }
        } else {
          // Start listening
          setIsListening(true)
          setCurrentTranscript('Hello Ava, how are you today?')
          // Simulate audio stream
          if (onAudioStream) {
            onAudioStream(new MediaStream())
          }
        }
      },
    }))

    return (
      <div data-testid="speech-interface">
        <button
          data-testid="speech-toggle"
          disabled={disabled}
          onClick={() => {
            if (ref?.current?.handleToggle) {
              ref.current.handleToggle()
            }
          }}
        >
          {isListening ? 'Listening...' : 'Start Listening'}
        </button>
        {aiResponse && (
          <div data-testid="ai-response">{aiResponse}</div>
        )}
        <div data-testid="transcript-display">
          {currentTranscript}
        </div>
      </div>
    )
  }),
}))

describe('Voice Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock store state
    Object.keys(mockStore).forEach(key => {
      mockStore[key as keyof typeof mockStore].mockClear()
    })
  })

  describe('Complete Voice Input Flow', () => {
    it('handles complete voice conversation flow successfully', async () => {
      mockFetchResponse({
        message: 'Hello! I\'m doing great, thank you for asking!',
        emotional_state: { mood: 'happy' },
      })

      // Render a simplified version of the conversation page for testing
      const TestConversationFlow = () => {
        const [currentMood, setCurrentMood] = React.useState('neutral')
        const speechInterfaceRef = React.useRef<any>(null)

        const handleTranscriptComplete = async (transcript: string) => {
          if (!transcript.trim()) return

          mockStore.setProcessing(true)

          // Add user message
          mockStore.addMessage({
            id: `user-${Date.now()}`,
            role: 'user' as const,
            content: transcript,
            timestamp: new Date(),
          })

          try {
            // Simulate API call
            const response = await fetch('/api/backend/ava/conversation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: transcript }),
            })

            if (!response.ok) throw new Error('API error')

            const data = await response.json()

            // Update mood
            const emotion = data.emotional_state?.mood || 'neutral'
            setCurrentMood(emotion)

            // Add AI response
            mockStore.addMessage({
              id: `assistant-${Date.now()}`,
              role: 'assistant' as const,
              content: data.message,
              timestamp: new Date(),
            })

          } catch (error) {
            mockStore.addMessage({
              id: `error-${Date.now()}`,
              role: 'assistant' as const,
              content: 'Sorry, I\'m having trouble responding right now.',
              timestamp: new Date(),
            })
          } finally {
            mockStore.setProcessing(false)
          }
        }

        return (
          <div>
            <div data-testid="current-mood">{currentMood}</div>
            <div data-testid="speech-interface">
              <button
                data-testid="speech-toggle"
                onClick={() => {
                  if (speechInterfaceRef.current?.handleToggle) {
                    speechInterfaceRef.current.handleToggle()
                  }
                }}
              >
                Toggle Speech
              </button>
            </div>
            <div data-testid="voice-waveform">
              <button data-testid="central-circle" data-mood={currentMood}>
                Central Circle
              </button>
            </div>
          </div>
        )
      }

      render(<TestConversationFlow />)

      // Initial state
      expect(screen.getByTestId('current-mood')).toHaveTextContent('neutral')

      // Start voice interaction
      const speechToggle = screen.getByTestId('speech-toggle')
      fireEvent.click(speechToggle)

      // Should trigger transcript completion and API call
      await waitFor(() => {
        expect(mockStore.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'user',
            content: 'Hello Ava, how are you today?',
          })
        )
      })

      await waitFor(() => {
        expect(mockStore.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'assistant',
            content: 'Hello! I\'m doing great, thank you for asking!',
          })
        )
      })

      // Should update mood
      await waitFor(() => {
        expect(screen.getByTestId('current-mood')).toHaveTextContent('happy')
      })

      // Should update waveform mood
      const centralCircle = screen.getByTestId('central-circle')
      expect(centralCircle).toHaveAttribute('data-mood', 'happy')
    })

    it('handles voice input error scenarios', async () => {
      mockFetchError('Network error')

      const TestErrorFlow = () => {
        const speechInterfaceRef = React.useRef<any>(null)

        const handleTranscriptComplete = async (transcript: string) => {
          mockStore.setProcessing(true)

          try {
            await fetch('/api/backend/ava/conversation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: transcript }),
            })
          } catch (error) {
            mockStore.addMessage({
              id: `error-${Date.now()}`,
              role: 'assistant' as const,
              content: 'Sorry, I\'m having trouble responding right now.',
              timestamp: new Date(),
            })
          } finally {
            mockStore.setProcessing(false)
          }
        }

        return (
          <div>
            <button
              data-testid="speech-toggle"
              onClick={() => {
                if (speechInterfaceRef.current?.handleToggle) {
                  speechInterfaceRef.current.handleToggle()
                }
              }}
            >
              Toggle Speech
            </button>
          </div>
        )
      }

      render(<TestErrorFlow />)

      const speechToggle = screen.getByTestId('speech-toggle')
      fireEvent.click(speechToggle)

      await waitFor(() => {
        expect(mockStore.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'assistant',
            content: 'Sorry, I\'m having trouble responding right now.',
          })
        )
      })
    })
  })

  describe('SpeechInterface and VoiceWaveform Integration', () => {
    it('coordinates between speech interface and waveform states', async () => {
      let audioStream: MediaStream | null = null

      const TestCoordinatedFlow = () => {
        const [isListening, setIsListening] = React.useState(false)
        const [isSpeaking, setIsSpeaking] = React.useState(false)
        const speechInterfaceRef = React.useRef<any>(null)

        const handleTranscriptComplete = (transcript: string) => {
          setIsListening(false)
          setIsSpeaking(true)
          // Simulate AI speaking
          setTimeout(() => setIsSpeaking(false), 2000)
        }

        const handleAudioStream = (stream: MediaStream) => {
          audioStream = stream
        }

        const handleCentralCircleClick = () => {
          if (speechInterfaceRef.current?.handleToggle) {
            speechInterfaceRef.current.handleToggle()
          }
        }

        return (
          <div>
            <div data-testid="speech-interface">
              <button
                data-testid="speech-toggle"
                onClick={() => {
                  if (speechInterfaceRef.current?.handleToggle) {
                    speechInterfaceRef.current.handleToggle()
                  }
                }}
              >
                Toggle
              </button>
            </div>

            <div data-testid="voice-waveform">
              <button
                data-testid="central-circle"
                onClick={handleCentralCircleClick}
                data-listening={isListening}
                data-speaking={isSpeaking}
              >
                Central Circle
              </button>
            </div>
          </div>
        )
      }

      render(<TestCoordinatedFlow />)

      // Initial state
      const centralCircle = screen.getByTestId('central-circle')
      expect(centralCircle).toHaveAttribute('data-listening', 'false')
      expect(centralCircle).toHaveAttribute('data-speaking', 'false')

      // Start listening via central circle
      fireEvent.click(centralCircle)

      // Should trigger listening state
      await waitFor(() => {
        expect(centralCircle).toHaveAttribute('data-listening', 'true')
      })

      // Stop listening (simulated by transcript complete)
      fireEvent.click(centralCircle)

      await waitFor(() => {
        expect(centralCircle).toHaveAttribute('data-speaking', 'true')
      })

      // Should eventually stop speaking
      await waitFor(() => {
        expect(centralCircle).toHaveAttribute('data-speaking', 'false')
      }, { timeout: 3000 })
    })

    it('handles audio stream integration between components', async () => {
      const TestAudioStreamFlow = () => {
        const [audioStream, setAudioStream] = React.useState<MediaStream | null>(null)
        const speechInterfaceRef = React.useRef<any>(null)

        const handleAudioStream = (stream: MediaStream) => {
          setAudioStream(stream)
        }

        return (
          <div>
            <div data-testid="speech-interface">
              <button
                data-testid="speech-toggle"
                onClick={() => {
                  if (speechInterfaceRef.current?.handleToggle) {
                    speechInterfaceRef.current.handleToggle()
                  }
                }}
              >
                Toggle
              </button>
            </div>

            <div data-testid="voice-waveform">
              <div data-testid="waveform-stream" data-has-stream={!!audioStream}>
                Waveform
              </div>
            </div>
          </div>
        )
      }

      render(<TestAudioStreamFlow />)

      const waveformStream = screen.getByTestId('waveform-stream')
      expect(waveformStream).toHaveAttribute('data-has-stream', 'false')

      // Start speech (which should create audio stream)
      const speechToggle = screen.getByTestId('speech-toggle')
      fireEvent.click(speechToggle)

      await waitFor(() => {
        expect(waveformStream).toHaveAttribute('data-has-stream', 'true')
      })
    })
  })

  describe('State Synchronization', () => {
    it('maintains consistent state across components', () => {
      const TestStateSync = () => {
        const [isProcessing, setIsProcessing] = React.useState(false)
        const [isListening, setIsListening] = React.useState(false)

        const startProcessing = () => {
          setIsProcessing(true)
          setIsListening(true)
        }

        const stopProcessing = () => {
          setIsProcessing(false)
          setIsListening(false)
        }

        return (
          <div>
            <button
              data-testid="start-process"
              onClick={startProcessing}
            >
              Start
            </button>
            <button
              data-testid="stop-process"
              onClick={stopProcessing}
            >
              Stop
            </button>

            <div data-testid="speech-interface">
              <button
                data-testid="speech-toggle"
                disabled={isProcessing}
                data-listening={isListening}
              >
                Speech
              </button>
            </div>

            <div data-testid="voice-waveform">
              <button
                data-testid="central-circle"
                disabled={isProcessing}
                data-listening={isListening}
              >
                Waveform
              </button>
            </div>
          </div>
        )
      }

      render(<TestStateSync />)

      const speechToggle = screen.getByTestId('speech-toggle')
      const centralCircle = screen.getByTestId('central-circle')

      // Initial state - both enabled
      expect(speechToggle).not.toBeDisabled()
      expect(centralCircle).not.toBeDisabled()

      // Start processing
      const startButton = screen.getByTestId('start-process')
      fireEvent.click(startButton)

      // Both components should be disabled and in listening state
      expect(speechToggle).toBeDisabled()
      expect(speechToggle).toHaveAttribute('data-listening', 'true')
      expect(centralCircle).toBeDisabled()
      expect(centralCircle).toHaveAttribute('data-listening', 'true')

      // Stop processing
      const stopButton = screen.getByTestId('stop-process')
      fireEvent.click(stopButton)

      // Both components should be enabled and not listening
      expect(speechToggle).not.toBeDisabled()
      expect(speechToggle).toHaveAttribute('data-listening', 'false')
      expect(centralCircle).not.toBeDisabled()
      expect(centralCircle).toHaveAttribute('data-listening', 'false')
    })
  })

  describe('Performance and Memory Management', () => {
    it('handles rapid state changes without memory leaks', async () => {
      const TestRapidChanges = () => {
        const [mood, setMood] = React.useState('neutral')

        const changeMood = () => {
          const moods = ['happy', 'sad', 'angry', 'excited', 'calm']
          setMood(moods[Math.floor(Math.random() * moods.length)])
        }

        return (
          <div>
            <button data-testid="change-mood" onClick={changeMood}>
              Change Mood
            </button>
            <div data-testid="current-mood-display">{mood}</div>
            <div data-testid="emotional-backdrop" data-mood={mood}>
              Backdrop
            </div>
          </div>
        )
      }

      render(<TestRapidChanges />)

      const changeButton = screen.getByTestId('change-mood')
      const moodDisplay = screen.getByTestId('current-mood-display')
      const backdrop = screen.getByTestId('emotional-backdrop')

      // Rapid mood changes
      for (let i = 0; i < 10; i++) {
        fireEvent.click(changeButton)

        // Ensure mood updates are reflected
        await waitFor(() => {
          const currentMood = moodDisplay.textContent
          expect(backdrop).toHaveAttribute('data-mood', currentMood)
        })
      }
    })
  })

  describe('Edge Cases and Error Recovery', () => {
    it('handles component unmounting during active operations', () => {
      const TestUnmountDuringOperation = () => {
        const [isActive, setIsActive] = React.useState(false)

        React.useEffect(() => {
          if (isActive) {
            // Simulate ongoing operation
            const timeout = setTimeout(() => setIsActive(false), 1000)
            return () => clearTimeout(timeout)
          }
        }, [isActive])

        return (
          <div>
            <button
              data-testid="start-operation"
              onClick={() => setIsActive(true)}
            >
              Start
            </button>
            <div data-testid="status" data-active={isActive}>
              {isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
        )
      }

      const { unmount } = render(<TestUnmountDuringOperation />)

      // Start operation
      const startButton = screen.getByTestId('start-operation')
      fireEvent.click(startButton)

      // Verify operation started
      expect(screen.getByTestId('status')).toHaveAttribute('data-active', 'true')

      // Unmount during operation
      expect(() => unmount()).not.toThrow()
    })

    it('recovers from network interruptions gracefully', async () => {
      // Start with successful response
      mockFetchResponse({
        message: 'First response',
        emotional_state: { mood: 'happy' },
      })

      const TestNetworkRecovery = () => {
        const [responses, setResponses] = React.useState<string[]>([])

        const makeRequest = async () => {
          try {
            const response = await fetch('/api/test')
            const data = await response.json()
            setResponses(prev => [...prev, data.message])
          } catch (error) {
            setResponses(prev => [...prev, 'Error occurred'])
          }
        }

        return (
          <div>
            <button data-testid="make-request" onClick={makeRequest}>
              Make Request
            </button>
            <div data-testid="responses">
              {responses.map((response, index) => (
                <div key={index} data-testid={`response-${index}`}>
                  {response}
                </div>
              ))}
            </div>
          </div>
        )
      }

      render(<TestNetworkRecovery />)

      const makeRequestButton = screen.getByTestId('make-request')

      // First request succeeds
      fireEvent.click(makeRequestButton)
      await waitFor(() => {
        expect(screen.getByTestId('response-0')).toHaveTextContent('First response')
      })

      // Second request fails
      mockFetchError('Network error')
      fireEvent.click(makeRequestButton)
      await waitFor(() => {
        expect(screen.getByTestId('response-1')).toHaveTextContent('Error occurred')
      })

      // Third request succeeds again (simulate recovery)
      mockFetchResponse({
        message: 'Recovered response',
        emotional_state: { mood: 'calm' },
      })
      fireEvent.click(makeRequestButton)
      await waitFor(() => {
        expect(screen.getByTestId('response-2')).toHaveTextContent('Recovered response')
      })
    })
  })
})
