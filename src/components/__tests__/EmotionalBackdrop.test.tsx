import { render } from '@testing-library/react';
import { EmotionalBackdrop } from '../EmotionalBackdrop';

// Mock Framer Motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

describe('EmotionalBackdrop', () => {
  it('renders without crashing', () => {
    const { container } = render(<EmotionalBackdrop mood="neutral" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies correct classes for backdrop container', () => {
    const { container } = render(<EmotionalBackdrop mood="happy" />);
    const backdrop = container.firstChild as HTMLElement;
    
    expect(backdrop).toHaveClass('absolute', 'inset-0', 'overflow-hidden', '-z-10');
  });

  it('renders overlay for text readability', () => {
    const { container } = render(<EmotionalBackdrop mood="sad" />);
    const overlay = container.querySelector('.bg-black\\/20');
    
    expect(overlay).toBeInTheDocument();
  });

  it('renders texture overlay', () => {
    const { container } = render(<EmotionalBackdrop mood="excited" />);
    const textureOverlay = container.querySelector('.opacity-10');
    
    expect(textureOverlay).toBeInTheDocument();
  });

  it('accepts different mood props', () => {
    const moods = ['neutral', 'happy', 'sad', 'angry', 'excited', 'calm'] as const;
    
    moods.forEach(mood => {
      const { container } = render(<EmotionalBackdrop mood={mood} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('accepts intensity prop', () => {
    const { container } = render(<EmotionalBackdrop mood="happy" intensity={0.8} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('accepts transition prop', () => {
    const { container } = render(<EmotionalBackdrop mood="calm" transition={false} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});