import { render, act } from '@testing-library/react';
import { HeartbeatAudio } from './HeartbeatAudio';
import { EmotionalMood } from './EmotionalBackdrop';

// Mock the audio manager
jest.mock('@/lib/audio-manager', () => ({
  getAudioManager: () => ({
    loadHeartbeatAudio: jest.fn().mockResolvedValue(undefined),
    setVolume: jest.fn(),
    setMuted: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
    playHeartbeat: jest.fn(),
    stopHeartbeat: jest.fn()
  })
}));

describe('HeartbeatAudio', () => {
  const defaultProps = {
    mood: 'neutral' as EmotionalMood,
    conversationIntensity: 'low' as const,
    isActive: true
  };

  it('renders without crashing', async () => {
    let container;
    await act(async () => {
      const result = render(<HeartbeatAudio {...defaultProps} />);
      container = result.container;
    });
    expect(container.firstChild).toBeNull(); // Component renders nothing
  });

  it('handles all mood types', async () => {
    const moods: EmotionalMood[] = [
      'neutral', 'happy', 'sad', 'angry', 'excited', 'calm', 'surprised', 'frustrated'
    ];

    for (const mood of moods) {
      await act(async () => {
        const { rerender } = render(
          <HeartbeatAudio {...defaultProps} mood={mood} />
        );
        expect(() => rerender(<HeartbeatAudio {...defaultProps} mood={mood} />)).not.toThrow();
      });
    }
  });

  it('handles all conversation intensity levels', async () => {
    const intensities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

    for (const intensity of intensities) {
      await act(async () => {
        const { rerender } = render(
          <HeartbeatAudio {...defaultProps} conversationIntensity={intensity} />
        );
        expect(() => rerender(
          <HeartbeatAudio {...defaultProps} conversationIntensity={intensity} />
        )).not.toThrow();
      });
    }
  });

  it('responds to isActive prop changes', async () => {
    await act(async () => {
      const { rerender } = render(<HeartbeatAudio {...defaultProps} isActive={false} />);
      expect(() => rerender(<HeartbeatAudio {...defaultProps} isActive={true} />)).not.toThrow();
    });
  });

  it('handles volume and muted props', async () => {
    await act(async () => {
      const { rerender } = render(
        <HeartbeatAudio {...defaultProps} volume={0.5} muted={false} />
      );
      expect(() => rerender(
        <HeartbeatAudio {...defaultProps} volume={0.8} muted={true} />
      )).not.toThrow();
    });
  });

  it('does not render any visual elements', async () => {
    let container;
    await act(async () => {
      const result = render(<HeartbeatAudio {...defaultProps} />);
      container = result.container;
    });
    expect(container.innerHTML).toBe('');
  });
});