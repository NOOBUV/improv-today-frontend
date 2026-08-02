import { render, screen, act, fireEvent } from '@testing-library/react';
import { SpeechInterface } from './SpeechInterface';
import { useClaraStore } from '@/store/claraStore';
import { config } from '@/lib/config';

// Fake SimpleSpeech: we drive the recognition callbacks by hand.
let mockEmit: (r: { transcript: string; isFinal: boolean }) => void = () => {};
let mockEndSession: () => void = () => {};

jest.mock('@/lib/simpleSpeech', () => ({
  SimpleSpeech: jest.fn().mockImplementation(() => ({
    canListen: () => true,
    stopListening: jest.fn().mockResolvedValue(undefined),
    startListening: (onResult: (r: { transcript: string; isFinal: boolean }) => void) => {
      mockEmit = onResult;
      // Resolves when the recognition session ends (Chrome's onend / 'no-speech').
      return new Promise<void>((resolve) => {
        mockEndSession = resolve;
      });
    },
  })),
}));

const startSession = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /tap to talk/i }));
  });
};

describe('SpeechInterface end-of-speech detection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useClaraStore.getState().reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('silence watchdog finalizes interim text when no final result ever arrives', async () => {
    const onTranscriptComplete = jest.fn();
    render(<SpeechInterface onTranscriptComplete={onTranscriptComplete} />);
    await startSession();

    // Chrome delivers interim results, then goes quiet without marking one final.
    act(() => mockEmit({ transcript: 'hello clara', isFinal: false }));
    expect(onTranscriptComplete).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(config.speech.interimSilenceTimeout);
    });

    expect(onTranscriptComplete).toHaveBeenCalledWith('hello clara');
    expect(useClaraStore.getState().isListening).toBe(false);
  });

  test('watchdog restarts while the user keeps talking', async () => {
    const onTranscriptComplete = jest.fn();
    render(<SpeechInterface onTranscriptComplete={onTranscriptComplete} />);
    await startSession();

    act(() => mockEmit({ transcript: 'hello', isFinal: false }));
    await act(async () => {
      jest.advanceTimersByTime(config.speech.interimSilenceTimeout - 200);
    });
    act(() => mockEmit({ transcript: 'hello clara', isFinal: false }));
    await act(async () => {
      jest.advanceTimersByTime(config.speech.interimSilenceTimeout - 200);
    });

    expect(onTranscriptComplete).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(onTranscriptComplete).toHaveBeenCalledTimes(1);
    expect(onTranscriptComplete).toHaveBeenCalledWith('hello clara');
  });

  test('recognition ending on its own sends once, and clears listening when nothing was heard', async () => {
    const onTranscriptComplete = jest.fn();
    render(<SpeechInterface onTranscriptComplete={onTranscriptComplete} />);
    await startSession();

    act(() => mockEmit({ transcript: 'goodbye', isFinal: false }));
    await act(async () => {
      mockEndSession();
    });

    expect(onTranscriptComplete).toHaveBeenCalledTimes(1);
    expect(onTranscriptComplete).toHaveBeenCalledWith('goodbye');

    // A pending watchdog must not fire a second send for the same session.
    await act(async () => {
      jest.advanceTimersByTime(config.speech.interimSilenceTimeout);
    });
    expect(onTranscriptComplete).toHaveBeenCalledTimes(1);
  });

  test("'no-speech' session end leaves the UI idle instead of stuck listening", async () => {
    const onTranscriptComplete = jest.fn();
    render(<SpeechInterface onTranscriptComplete={onTranscriptComplete} />);
    await startSession();

    await act(async () => {
      mockEndSession();
    });

    expect(onTranscriptComplete).not.toHaveBeenCalled();
    expect(useClaraStore.getState().isListening).toBe(false);
  });

  test('pausing does not send the transcript', async () => {
    const onTranscriptComplete = jest.fn();
    render(<SpeechInterface onTranscriptComplete={onTranscriptComplete} />);
    await startSession();

    act(() => mockEmit({ transcript: 'never mind', isFinal: false }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    });
    await act(async () => {
      mockEndSession();
      jest.advanceTimersByTime(config.speech.interimSilenceTimeout);
    });

    expect(onTranscriptComplete).not.toHaveBeenCalled();
    expect(useClaraStore.getState().isPaused).toBe(true);
  });
});
