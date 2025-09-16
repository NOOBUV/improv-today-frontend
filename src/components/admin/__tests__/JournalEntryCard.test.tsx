import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { JournalEntryCard } from '../JournalEntryCard';
import { JournalEntry } from '@/types/journal';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const mockEntry: JournalEntry = {
  entry_id: '1',
  entry_date: '2025-09-17',
  content: 'This is a test journal entry content for testing purposes.',
  status: 'draft',
  created_at: '2025-09-17T10:00:00Z',
  updated_at: '2025-09-17T10:00:00Z',
  generated_at: '2025-09-17T10:00:00Z',
};

const mockOnUpdateStatus = jest.fn();

describe('JournalEntryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders journal entry information correctly', () => {
    render(<JournalEntryCard entry={mockEntry} onUpdateStatus={mockOnUpdateStatus} />);

    expect(screen.getByText('Wednesday, September 17, 2025')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText(/This is a test journal entry/)).toBeInTheDocument();
  });

  it('expands and collapses content when clicked', async () => {
    render(<JournalEntryCard entry={mockEntry} onUpdateStatus={mockOnUpdateStatus} />);

    const expandButton = screen.getByLabelText('Expand entry');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    const collapseButton = screen.getByLabelText('Collapse entry');
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });
  });

  it('copies content to clipboard when copy button is clicked', async () => {
    render(<JournalEntryCard entry={mockEntry} onUpdateStatus={mockOnUpdateStatus} />);

    // Expand the card first
    const expandButton = screen.getByLabelText('Expand entry');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockEntry.content);
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('calls onUpdateStatus when status is changed', async () => {
    render(<JournalEntryCard entry={mockEntry} onUpdateStatus={mockOnUpdateStatus} />);

    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'approved' } });

    await waitFor(() => {
      expect(mockOnUpdateStatus).toHaveBeenCalledWith('1', 'approved');
    });
  });

  it('displays correct status colors', () => {
    const approvedEntry = { ...mockEntry, status: 'approved' as const };
    const { rerender } = render(
      <JournalEntryCard entry={approvedEntry} onUpdateStatus={mockOnUpdateStatus} />
    );

    expect(screen.getByText('approved')).toHaveClass('bg-green-100', 'text-green-800');

    const postedEntry = { ...mockEntry, status: 'posted' as const };
    rerender(<JournalEntryCard entry={postedEntry} onUpdateStatus={mockOnUpdateStatus} />);

    expect(screen.getByText('posted')).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('shows updated date when entry was modified', () => {
    const modifiedEntry = {
      ...mockEntry,
      updated_at: '2025-09-18T10:00:00Z',
    };

    render(<JournalEntryCard entry={modifiedEntry} onUpdateStatus={mockOnUpdateStatus} />);

    // Expand to see the dates
    const expandButton = screen.getByLabelText('Expand entry');
    fireEvent.click(expandButton);

    expect(screen.getByText(/Updated: 9\/18\/2025/)).toBeInTheDocument();
  });
});