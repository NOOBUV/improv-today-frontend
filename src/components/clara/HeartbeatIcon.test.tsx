import { render, screen } from '@testing-library/react';
import { HeartbeatIcon } from './HeartbeatIcon';
import { EmotionalMood } from './EmotionalBackdrop';

// Mock Framer Motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}));

// Mock Lucide React
jest.mock('lucide-react', () => ({
  Heart: ({ size, color, fill, style }: any) => (
    <svg
      data-testid="heart-icon"
      width={size}
      height={size}
      style={{ color, fill, ...style }}
    >
      <path d="heart-path" />
    </svg>
  )
}));

describe('HeartbeatIcon', () => {
  const defaultProps = {
    mood: 'neutral' as EmotionalMood,
    conversationIntensity: 'low' as const
  };

  it('renders heart icon with correct size', () => {
    render(<HeartbeatIcon {...defaultProps} />);

    const heartIcon = screen.getByTestId('heart-icon');
    expect(heartIcon).toBeInTheDocument();
    expect(heartIcon).toHaveAttribute('width', '24');
    expect(heartIcon).toHaveAttribute('height', '24');
  });

  it('positions icon correctly with fixed positioning', () => {
    render(<HeartbeatIcon {...defaultProps} />);

    const container = screen.getByRole('img');
    expect(container).toHaveClass('fixed', 'top-4', 'right-4', 'z-50');
  });

  it('applies correct aria-label based on mood and intensity', () => {
    render(<HeartbeatIcon mood="happy" conversationIntensity="high" />);

    const container = screen.getByRole('img');
    expect(container).toHaveAttribute(
      'aria-label',
      "Clara's heartbeat - happy mood, high intensity"
    );
  });

  describe('mood-based styling', () => {
    const moods: EmotionalMood[] = [
      'neutral', 'happy', 'sad', 'angry', 'excited', 'calm', 'surprised', 'frustrated'
    ];

    moods.forEach(mood => {
      it(`renders successfully with ${mood} mood`, () => {
        const { container } = render(<HeartbeatIcon mood={mood} conversationIntensity="medium" />);

        // Verify the component renders without error
        expect(container.firstChild).toBeInTheDocument();

        // Verify the Heart icon is present
        const heartIcon = screen.getByTestId('heart-icon');
        expect(heartIcon).toBeInTheDocument();
      });
    });
  });

  describe('conversation intensity effects', () => {
    const intensities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

    intensities.forEach(intensity => {
      it(`renders correctly with ${intensity} conversation intensity`, () => {
        render(<HeartbeatIcon mood="excited" conversationIntensity={intensity} />);

        const container = screen.getByRole('img');
        expect(container).toBeInTheDocument();
        expect(container).toHaveAttribute(
          'aria-label',
          expect.stringContaining(`${intensity} intensity`)
        );
      });
    });
  });

  it('includes smooth color transition styling', () => {
    render(<HeartbeatIcon {...defaultProps} />);

    const heartIcon = screen.getByTestId('heart-icon');
    expect(heartIcon).toHaveStyle('transition: color 0.3s ease-in-out');
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-heartbeat-class';
    render(<HeartbeatIcon {...defaultProps} className={customClass} />);

    const container = screen.getByRole('img');
    expect(container).toHaveClass(customClass);
  });

  describe('different mood configurations', () => {
    it('renders angry mood with correct styling', () => {
      render(<HeartbeatIcon mood="angry" conversationIntensity="high" />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute(
        'aria-label',
        "Clara's heartbeat - angry mood, high intensity"
      );
    });

    it('renders calm mood with correct styling', () => {
      render(<HeartbeatIcon mood="calm" conversationIntensity="low" />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute(
        'aria-label',
        "Clara's heartbeat - calm mood, low intensity"
      );
    });

    it('renders excited mood with correct styling', () => {
      render(<HeartbeatIcon mood="excited" conversationIntensity="medium" />);

      const container = screen.getByRole('img');
      expect(container).toHaveAttribute(
        'aria-label',
        "Clara's heartbeat - excited mood, medium intensity"
      );
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA role', () => {
      render(<HeartbeatIcon {...defaultProps} />);

      const container = screen.getByRole('img');
      expect(container).toBeInTheDocument();
    });

    it('provides descriptive aria-label', () => {
      render(<HeartbeatIcon mood="surprised" conversationIntensity="high" />);

      const container = screen.getByRole('img');
      const ariaLabel = container.getAttribute('aria-label');
      expect(ariaLabel).toContain('Clara\'s heartbeat');
      expect(ariaLabel).toContain('surprised mood');
      expect(ariaLabel).toContain('high intensity');
    });
  });
});