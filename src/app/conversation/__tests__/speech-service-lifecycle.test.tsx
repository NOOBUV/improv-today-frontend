import React from 'react'
import { render } from '../../../__tests__/test-utils'

// One shared spy set: the constructor must fire once no matter how often the effect re-runs.
const constructed = jest.fn()
const setStreamingCallbacks = jest.fn()
const stopSpeaking = jest.fn()

jest.mock('@/lib/speech', () => ({
  ...jest.requireActual('@/lib/speech'),
  BrowserSpeechService: class {
    constructor() { constructed() }
    setStreamingCallbacks = setStreamingCallbacks
    stopSpeaking = stopSpeaking
    queueStreamingChunk = jest.fn()
    flushStreamingBuffer = jest.fn()
  },
}))

jest.mock('@/components/shared/AuthProvider', () => ({
  useAuth: () => ({ token: null, isAuthenticated: true }),
  DEV_AUTH_BYPASS: true,
}))

jest.mock('@/hooks/useAdminAuth', () => ({
  useAdminAuth: () => ({ isAdmin: false }),
}))

import ConversationPage from '../ConversationPageClient'

const conversationState = jest.requireMock('@/store/claraStore').useClaraConversationState

describe('BrowserSpeechService lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    conversationState.mockReturnValue({ isProcessing: false, isListening: false, isAISpeaking: false })
  })

  it('constructs the service once across speaking-flag flips, and stops it on unmount', () => {
    const { rerender, unmount } = render(<ConversationPage />)
    expect(constructed).toHaveBeenCalledTimes(1)

    // isAISpeaking flips mid-reply; autoStartListening changes identity, so the effect re-runs.
    conversationState.mockReturnValue({ isProcessing: false, isListening: false, isAISpeaking: true })
    rerender(<ConversationPage />)
    conversationState.mockReturnValue({ isProcessing: false, isListening: false, isAISpeaking: false })
    rerender(<ConversationPage />)

    expect(constructed).toHaveBeenCalledTimes(1) // one instance — no split-brain audio
    expect(setStreamingCallbacks.mock.calls.length).toBeGreaterThan(1) // callbacks still re-bound
    expect(stopSpeaking).not.toHaveBeenCalled() // a re-bind must not silence Clara mid-reply

    unmount()
    expect(stopSpeaking).toHaveBeenCalledTimes(1)
  })
})
