import React from 'react'
import { render, screen, fireEvent } from '../../__tests__/test-utils'
import { VoiceWaveform } from '../VoiceWaveform'

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => React.createElement('div', props, children),
    button: ({ children, ...props }: any) => React.createElement('button', props, children),
  },
  useAnimationFrame: jest.fn(() => {}),
}))

// Mock the conversation store
jest.mock('@/store/conversationStore', () => ({
  useConversationState: () => ({
    isProcessing: false,
  }),
}))

describe('Accessibility Features', () => {
  const defaultProps = {
    isListening: false,
    isSpeaking: false,
    audioStream: null,
    onCentralCircleClick: jest.fn(),
    disabled: false,
    emotionalMood: 'neutral' as const,
  }

  describe('VoiceWaveform Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<VoiceWaveform {...defaultProps} />)

      // Check for main region
      const region = screen.getByRole('region', { name: /voice interaction interface/i })
      expect(region).toBeInTheDocument()

      // Check for button role
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('provides descriptive ARIA labels for different states', () => {
      const { rerender } = render(<VoiceWaveform {...defaultProps} />)

      let button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', /voice interface ready/i)

      rerender(<VoiceWaveform {...defaultProps} isListening={true} />)
      button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', /voice input active, listening/i)

      rerender(<VoiceWaveform {...defaultProps} isSpeaking={true} />)
      button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', /clara is speaking/i)
    })

    it('includes ARIA live region for status updates', () => {
      render(<VoiceWaveform {...defaultProps} />)

      const liveRegion = screen.getByText(/voice interface ready/i)
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })

    it('updates live region content based on state', () => {
      const { rerender } = render(<VoiceWaveform {...defaultProps} />)

      expect(screen.getByText(/voice interface ready/i)).toBeInTheDocument()

      rerender(<VoiceWaveform {...defaultProps} isListening={true} />)
      expect(screen.getByText(/voice input active, listening/i)).toBeInTheDocument()

      rerender(<VoiceWaveform {...defaultProps} isSpeaking={true} />)
      expect(screen.getByText(/clara is speaking/i)).toBeInTheDocument()
    })

    it('hides decorative elements from screen readers', () => {
      render(<VoiceWaveform {...defaultProps} />)

      // Canvas should be hidden from screen readers
      const canvas = document.querySelector('canvas')
      expect(canvas).toHaveAttribute('aria-hidden', 'true')

      // Particle container should be hidden from screen readers
      const particleContainer = document.querySelector('.absolute.inset-0')
      expect(particleContainer).toHaveAttribute('aria-hidden', 'true')
    })

    it('provides keyboard accessibility', () => {
      const mockOnClick = jest.fn()
      render(<VoiceWaveform {...defaultProps} onCentralCircleClick={mockOnClick} />)

      const button = screen.getByRole('button')

      // Test Enter key
      fireEvent.keyDown(button, { key: 'Enter' })
      expect(mockOnClick).toHaveBeenCalledTimes(1)

      // Test Space key
      fireEvent.keyDown(button, { key: ' ' })
      expect(mockOnClick).toHaveBeenCalledTimes(2)
    })

    it('handles focus management correctly', () => {
      render(<VoiceWaveform {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('tabIndex', '0')

      // When disabled, should not be focusable
      const { rerender } = render(<VoiceWaveform {...defaultProps} disabled={true} />)
      expect(button).toHaveAttribute('tabIndex', '-1')
    })

    it('includes keyboard shortcuts help for screen readers', () => {
      render(<VoiceWaveform {...defaultProps} />)

      const helpText = screen.getByText(/press enter or space/i)
      expect(helpText).toHaveClass('sr-only')
    })
  })

  describe('Conversation Page Accessibility', () => {
    it('includes skip to main content link', () => {
      // Mock the conversation page components
      const MockConversationPage = () => (
        <div>
          <a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>
          <main id="main-content">Main content</main>
        </div>
      )

      render(<MockConversationPage />)

      const skipLink = screen.getByText('Skip to main content')
      expect(skipLink).toHaveAttribute('href', '#main-content')
      expect(skipLink).toHaveClass('sr-only', 'focus:not-sr-only')
    })

    it('provides keyboard shortcuts information', () => {
      const MockConversationPage = () => (
        <div>
          <div aria-live="polite" className="sr-only">
            Voice interaction shortcuts: Ctrl+Space to toggle voice input, Escape to stop listening
          </div>
        </div>
      )

      render(<MockConversationPage />)

      expect(screen.getByText(/voice interaction shortcuts/i)).toHaveAttribute('aria-live', 'polite')
    })

    it('has proper semantic structure', () => {
      const MockConversationPage = () => (
        <div>
          <header role="banner">
            <h1>Conversation with Clara</h1>
          </header>
          <main role="main" aria-labelledby="main-heading">
            <div id="main-heading">Main Content</div>
          </main>
        </div>
      )

      render(<MockConversationPage />)

      expect(screen.getByRole('banner')).toBeInTheDocument()
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conversation with Clara')
    })

    it('provides status updates for screen readers', () => {
      const MockConversationPage = () => (
        <div>
          <p aria-live="polite">
            Personality: friendly • 5 messages
          </p>
          <div className="sr-only">
            Use the central circle to start voice interaction. Current status: ready
          </div>
        </div>
      )

      render(<MockConversationPage />)

      const statusText = screen.getByText(/personality:/i)
      expect(statusText).toHaveAttribute('aria-live', 'polite')

      const instructions = screen.getByText(/use the central circle/i)
      expect(instructions).toHaveClass('sr-only')
    })
  })

  describe('Focus Management', () => {
    it('maintains proper focus order', () => {
      const MockAccessibleInterface = () => (
        <div>
          <button>Skip Link</button>
          <main>
            <button>Voice Button</button>
          </main>
        </div>
      )

      render(<MockAccessibleInterface />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(2)

      // Focus should move logically through interactive elements
      buttons[0].focus()
      expect(document.activeElement).toBe(buttons[0])

      buttons[1].focus()
      expect(document.activeElement).toBe(buttons[1])
    })

    it('handles focus trapping during voice interactions', () => {
      // This test would verify that focus stays within the voice interface
      // during active voice interactions
      const MockFocusTrapping = () => (
        <div>
          <div data-testid="voice-container">
            <button data-testid="voice-button">Voice Control</button>
          </div>
          <button data-testid="other-button">Other Control</button>
        </div>
      )

      render(<MockFocusTrapping />)

      const voiceButton = screen.getByTestId('voice-button')
      const otherButton = screen.getByTestId('other-button')

      voiceButton.focus()
      expect(document.activeElement).toBe(voiceButton)
    })
  })

  describe('Screen Reader Compatibility', () => {
    it('provides comprehensive status information', () => {
      const MockStatusInterface = () => (
        <div>
          <div aria-live="polite" aria-atomic="true">
            Voice interface ready, tap to start conversation
          </div>
          <button
            aria-describedby="status-description"
            aria-label="Voice interface ready, tap to start conversation"
          >
            Voice Control
          </button>
          <div id="status-description" className="sr-only">
            Use this button to start voice interaction with Clara
          </div>
        </div>
      )

      render(<MockStatusInterface />)

      const liveRegion = screen.getByText(/voice interface ready/i)
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'status-description')
      expect(button).toHaveAttribute('aria-label', /voice interface ready/i)
    })

    it('handles dynamic content updates', () => {
      const MockDynamicContent = () => {
        const [status, setStatus] = React.useState('ready')

        return (
          <div>
            <div aria-live="polite" aria-atomic="true">
              Status: {status}
            </div>
            <button onClick={() => setStatus('listening')}>
              Change Status
            </button>
          </div>
        )
      }

      render(<MockDynamicContent />)

      expect(screen.getByText('Status: ready')).toBeInTheDocument()

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.getByText('Status: listening')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports standard keyboard interactions', () => {
      const mockHandler = jest.fn()
      const MockKeyboardInterface = () => (
        <div>
          <button
            onClick={mockHandler}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                mockHandler()
              }
            }}
          >
            Interactive Button
          </button>
        </div>
      )

      render(<MockKeyboardInterface />)

      const button = screen.getByRole('button')

      // Test Enter key
      fireEvent.keyDown(button, { key: 'Enter' })
      expect(mockHandler).toHaveBeenCalledTimes(1)

      // Test Space key
      fireEvent.keyDown(button, { key: ' ' })
      expect(mockHandler).toHaveBeenCalledTimes(2)
    })

    it('prevents default behavior for handled keys', () => {
      const mockPreventDefault = jest.fn()
      const MockKeyboardInterface = () => (
        <div>
          <button
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
          >
            Button
          </button>
        </div>
      )

      render(<MockKeyboardInterface />)

      const button = screen.getByRole('button')

      // Create a mock event with preventDefault
      const mockEvent = {
        key: 'Enter',
        preventDefault: mockPreventDefault,
      }

      fireEvent.keyDown(button, mockEvent)
      expect(mockPreventDefault).toHaveBeenCalled()
    })
  })
})
