import '@testing-library/jest-dom'

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

// Mock AudioContext
global.AudioContext = class AudioContext {
  constructor() {}
  createAnalyser() {
    return {
      fftSize: 256,
      smoothingTimeConstant: 0.8,
      connect: jest.fn(),
      getByteFrequencyData: jest.fn(),
    }
  }
  createMediaStreamSource() {
    return {
      connect: jest.fn(),
    }
  }
  close() {
    return Promise.resolve()
  }
}

// Mock webkitAudioContext for Safari
global.webkitAudioContext = global.AudioContext

// Mock MediaStream
global.MediaStream = class MediaStream {}

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue(new MediaStream()),
  },
  writable: true,
})

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn().mockImplementation(cb => setTimeout(cb, 16))
global.cancelAnimationFrame = jest.fn().mockImplementation(id => clearTimeout(id))

// Mock Auth0
jest.mock('@auth0/nextjs-auth0', () => ({
  useUser: jest.fn(() => ({
    user: null,
    error: null,
    isLoading: false,
  })),
}))

// Mock Auth0 client
jest.mock('@auth0/nextjs-auth0/server', () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({})),
}))
