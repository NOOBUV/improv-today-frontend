import React from 'react'
import { render, screen, fireEvent, waitFor } from '../../../__tests__/test-utils'
import { mockFetchResponse, mockFetchError } from '../../../__tests__/test-utils'
import ConversationPage from '../page'

// Mock all the required dependencies
const mockAddMessage = jest.fn()
const mockSetProcessing = jest.fn()
const mockSetUserName = jest.fn()
const mockSetPersonality = jest.fn()

// Override the test-utils mock with our specific mock
jest.doMock('@/store/conversationStore', () => ({
  useConversationStore: jest.fn(() => ({
    addMessage: mockAddMessage,
    setProcessing: mockSetProcessing,
    setUserName: mockSetUserName,
    setPersonality: mockSetPersonality,
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

// Make sure the mock returns the expected object immediately
const mockStore = {
  useConversationStore: jest.fn(() => ({
    addMessage: mockAddMessage,
    setProcessing: mockSetProcessing,
    setUserName: mockSetUserName,
    setPersonality: mockSetPersonality,
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
}

jest.mock('@/components/SpeechInterface', () => ({
  SpeechInterface: React.forwardRef(({ onTranscriptComplete, disabled, aiResponse }: any, ref: any) => (
    <div data-testid="speech-interface" aria-hidden="true" className="sr-only">
      <button
        data-testid="speech-toggle"
        disabled={disabled}
        onClick={() => {
          // Simulate transcript completion
          if (onTranscriptComplete) {
            onTranscriptComplete('Test transcript')
          }
        }}
      >
        Speech Toggle
      </button>
      {aiResponse && <div data-testid="ai-response">{aiResponse}</div>}
    </div>
  )),
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

describe('ConversationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddMessage.mockClear()
    mockSetProcessing.mockClear()
    mockSetUserName.mockClear()
    mockSetPersonality.mockClear()
  })

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ConversationPage />)
      expect(screen.getByText('Conversation with Clara')).toBeInTheDocument()
    })

    it('renders header with session information', () => {
      render(<ConversationPage />)
      expect(screen.getByText('Conversation with Clara')).toBeInTheDocument()
      expect(screen.getByText('Personality: friendly • 0 messages')).toBeInTheDocument()
    })

    it('renders all main components', () => {
      render(<ConversationPage />)
      expect(screen.getByTestId('emotional-backdrop')).toBeInTheDocument()
      expect(screen.getByTestId('voice-waveform')).toBeInTheDocument()
      expect(screen.getByTestId('speech-interface')).toBeInTheDocument()
    })
  })

  describe('Session Management', () => {
    it('initializes session with default values', () => {
      const mockUseConversationStore = jest.requireMock('@/store/conversationStore').useConversationStore
      const mockSetUserName = jest.fn()
      const mockSetPersonality = jest.fn()

      mockUseConversationStore.mockReturnValue({
        addMessage: jest.fn(),
        setProcessing: jest.fn(),
        setUserName: mockSetUserName,
        setPersonality: mockSetPersonality,
      })

      render(<ConversationPage />)

      expect(mockSetUserName).toHaveBeenCalledWith('User')
      expect(mockSetPersonality).toHaveBeenCalledWith('friendly')
    })

    it('displays correct message count', () => {
      const mockUseMessages = jest.requireMock('@/store/conversationStore').useMessages
      mockUseMessages.mockReturnValue([
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
        { id: '2', role: 'assistant', content: 'Hi there', timestamp: new Date() },
      ])

      render(<ConversationPage />)
      expect(screen.getByText('Personality: friendly • 2 messages')).toBeInTheDocument()
    })
  })

  describe('API Integration', () => {
    it('handles successful API response', async () => {
      mockFetchResponse({
        message: 'Hello from Clara!',
        emotional_state: { mood: 'happy' },
      })

      // Use global mockAddMessage
      // Use global mockSetProcessing

      jest.requireMock('@/store/conversationStore').useConversationStore.mockReturnValue({
        addMessage: mockAddMessage,
        setProcessing: mockSetProcessing,
        setUserName: mockSetUserName,
        setPersonality: mockSetPersonality,
      })

      render(<ConversationPage />)

      // Trigger speech interface
      const speechButton = screen.getByTestId('speech-toggle')
      fireEvent.click(speechButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'user',
            content: 'Test transcript',
          })
        )
        expect(mockAddMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'assistant',
            content: 'Hello from Clara!',
          })
        )
      })
    })

    it('handles API error gracefully', async () => {
      mockFetchError('Network error')

      // Use global mockAddMessage
      // Use global mockSetProcessing

      jest.requireMock('@/store/conversationStore').useConversationStore.mockReturnValue({
        addMessage: mockAddMessage,
        setProcessing: mockSetProcessing,
        setUserName: mockSetUserName,
        setPersonality: mockSetPersonality,
      })

      render(<ConversationPage />)

      // Trigger speech interface
      const speechButton = screen.getByTestId('speech-toggle')
      fireEvent.click(speechButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'assistant',
            content: 'Sorry, I\'m having trouble responding right now. Please try again.',
          })
        )
      })
    })

    it('sets processing state correctly', async () => {
      mockFetchResponse({
        message: 'Test response',
        emotional_state: { mood: 'neutral' },
      })

      // Use global mockSetProcessing
      jest.requireMock('@/store/conversationStore').useConversationStore.mockReturnValue({
        addMessage: jest.fn(),
        setProcessing: mockSetProcessing,
        setUserName: jest.fn(),
        setPersonality: jest.fn(),
      })

      render(<ConversationPage />)

      const speechButton = screen.getByTestId('speech-toggle')
      fireEvent.click(speechButton)

      // Should set processing to true initially
      expect(mockSetProcessing).toHaveBeenCalledWith(true)

      await waitFor(() => {
        // Should set processing to false after API call
        expect(mockSetProcessing).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('Emotional Backdrop Integration', () => {
    it('updates emotional backdrop based on API response', async () => {
      mockFetchResponse({
        message: 'I\'m feeling excited!',
        emotional_state: { mood: 'excited' },
      })

      render(<ConversationPage />)

      const speechButton = screen.getByTestId('speech-toggle')
      fireEvent.click(speechButton)

      await waitFor(() => {
        const backdrop = screen.getByTestId('emotional-backdrop')
        expect(backdrop).toHaveAttribute('data-mood', 'excited')
      })
    })

    it('handles different emotional moods', async () => {
      const moods = ['happy', 'sad', 'angry', 'excited', 'calm']

      for (const mood of moods) {
        mockFetchResponse({
          message: `I'm feeling ${mood}!`,
          emotional_state: { mood },
        })

        const { rerender } = render(<ConversationPage />)

        const speechButton = screen.getByTestId('speech-toggle')
        fireEvent.click(speechButton)

        await waitFor(() => {
          const backdrop = screen.getByTestId('emotional-backdrop')
          expect(backdrop).toHaveAttribute('data-mood', mood)
        })

        rerender(<ConversationPage key={mood} />)
      }
    })

    it('defaults to neutral mood when no emotion provided', async () => {
      mockFetchResponse({
        message: 'Hello!',
        // No emotional_state provided
      })

      render(<ConversationPage />)

      const speechButton = screen.getByTestId('speech-toggle')
      fireEvent.click(speechButton)

      await waitFor(() => {
        const backdrop = screen.getByTestId('emotional-backdrop')
        expect(backdrop).toHaveAttribute('data-mood', 'neutral')
      })
    })
  })

  describe('Voice Waveform Integration', () => {
    it('passes correct props to VoiceWaveform', () => {
      const mockUseConversationState = jest.requireMock('@/store/conversationStore').useConversationState
      mockUseConversationState.mockReturnValue({
        isProcessing: true,
        isListening: true,
        isAISpeaking: false,
      })

      render(<ConversationPage />)

      const centralCircle = screen.getByTestId('central-circle')
      expect(centralCircle).toHaveAttribute('data-listening', 'true')
      expect(centralCircle).toHaveAttribute('disabled')
    })

    it('handles central circle click', () => {
      render(<ConversationPage />)

      const centralCircle = screen.getByTestId('central-circle')
      fireEvent.click(centralCircle)

      // The click should be handled by the onCentralCircleClick handler
      expect(centralCircle).toBeInTheDocument()
    })
  })

  describe('Speech Interface Integration', () => {
    it('passes correct props to SpeechInterface', () => {
      const mockUseConversationState = jest.requireMock('@/store/conversationStore').useConversationState
      mockUseConversationState.mockReturnValue({
        isProcessing: true,
        isListening: false,
        isAISpeaking: false,
      })

      render(<ConversationPage />)

      const speechButton = screen.getByTestId('speech-toggle')
      expect(speechButton).toBeDisabled()
    })

    it('passes AI response to SpeechInterface when available', () => {
      const mockUseMessages = jest.requireMock('@/store/conversationStore').useMessages
      mockUseMessages.mockReturnValue([
        {
          id: '1',
          role: 'assistant',
          content: 'Hello from Clara!',
          timestamp: new Date(),
        },
      ])

      render(<ConversationPage />)

      const aiResponse = screen.getByTestId('ai-response')
      expect(aiResponse).toHaveTextContent('Hello from Clara!')
    })
  })

  describe('State Management', () => {
    it('manages message state correctly', async () => {
      mockFetchResponse({
        message: 'Test response',
        emotional_state: { mood: 'happy' },
      })

      // Use global mockAddMessage
      jest.requireMock('@/store/conversationStore').useConversationStore.mockReturnValue({
        addMessage: mockAddMessage,
        setProcessing: jest.fn(),
        setUserName: jest.fn(),
        setPersonality: jest.fn(),
      })

      render(<ConversationPage />)

      const speechButton = screen.getByTestId('speech-toggle')
      fireEvent.click(speechButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledTimes(2) // User message + AI response
      })

      const calls = mockAddMessage.mock.calls
      expect(calls[0][0]).toMatchObject({
        role: 'user',
        content: 'Test transcript',
      })
      expect(calls[1][0]).toMatchObject({
        role: 'assistant',
        content: 'Test response',
      })
    })

    it('handles last spoken message tracking', async () => {
      mockFetchResponse({
        message: 'First response',
        emotional_state: { mood: 'happy' },
      })

      const mockUseMessages = jest.requireMock('@/store/conversationStore').useMessages
      mockUseMessages.mockReturnValue([
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'First response',
          timestamp: new Date(),
        },
      ])

      render(<ConversationPage />)

      // AI response should be passed to SpeechInterface
      const aiResponse = screen.getByTestId('ai-response')
      expect(aiResponse).toHaveTextContent('First response')
    })
  })

  describe('Error Handling', () => {
    it('handles malformed API response gracefully', async () => {
      mockFetchResponse({
        // Missing message field
        emotional_state: { mood: 'sad' },
      })

      // Use global mockAddMessage
      jest.requireMock('@/store/conversationStore').useConversationStore.mockReturnValue({
        addMessage: mockAddMessage,
        setProcessing: jest.fn(),
        setUserName: jest.fn(),
        setPersonality: jest.fn(),
      })

      render(<ConversationPage />)

      const speechButton = screen.getByTestId('speech-toggle')
      fireEvent.click(speechButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'assistant',
            content: 'Sorry, I didn\'t get a response.',
          })
        )
      })
    })

    it('handles network errors gracefully', async () => {
      mockFetchError('Network timeout')

      // Use global mockAddMessage
      jest.requireMock('@/store/conversationStore').useConversationStore.mockReturnValue({
        addMessage: mockAddMessage,
        setProcessing: jest.fn(),
        setUserName: jest.fn(),
        setPersonality: jest.fn(),
      })

      render(<ConversationPage />)

      const speechButton = screen.getByTestId('speech-toggle')
      fireEvent.click(speechButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'assistant',
            content: 'Sorry, I\'m having trouble responding right now. Please try again.',
          })
        )
      })
    })
  })

  describe('Component Lifecycle', () => {
    it('handles component unmounting gracefully', () => {
      const { unmount } = render(<ConversationPage />)
      expect(() => unmount()).not.toThrow()
    })

    it('maintains state consistency during re-renders', () => {
      const { rerender } = render(<ConversationPage />)

      expect(screen.getByText('Conversation with Clara')).toBeInTheDocument()

      rerender(<ConversationPage />)

      expect(screen.getByText('Conversation with Clara')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<ConversationPage />)
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent('Conversation with Clara')
    })

    it('provides descriptive status information', () => {
      render(<ConversationPage />)
      expect(screen.getByText(/Personality:/)).toBeInTheDocument()
      expect(screen.getByText(/\d+ messages/)).toBeInTheDocument()
    })
  })
})
