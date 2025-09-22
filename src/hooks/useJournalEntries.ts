'use client';

import { useState, useEffect, useCallback } from 'react';
import { JournalEntry, JournalEntryFilters } from '@/types/journal';
import { journalApi } from '@/services/journalApi';

interface UseJournalEntriesResult {
  entries: JournalEntry[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  refreshEntries: () => Promise<void>;
  updateEntryStatus: (id: string, status: JournalEntry['status']) => Promise<void>;
}

export function useJournalEntries(filters: JournalEntryFilters = {}): UseJournalEntriesResult {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (currentFilters: JournalEntryFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await journalApi.getEntries(currentFilters);
      setEntries(response.entries);
      setTotal(response.total);
      setPage(response.page);
      // Calculate total pages from size and total
      setTotalPages(Math.ceil(response.total / (currentFilters.limit || 10)));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch journal entries';
      setError(errorMessage);
      console.error('Error fetching journal entries:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(filters);
  }, [fetchEntries, filters]);

  const refreshEntries = useCallback(async () => {
    await fetchEntries(filters);
  }, [fetchEntries, filters]);

  const updateEntryStatus = useCallback(async (id: string, status: JournalEntry['status']) => {
    try {
      await journalApi.updateEntryStatus(id, status);
      // Update the local state optimistically
      setEntries(prev => prev.map(entry =>
        entry.entry_id === id ? { ...entry, status } : entry
      ));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update entry status';
      setError(errorMessage);
      console.error('Error updating entry status:', err);
      throw err; // Re-throw to allow caller to handle
    }
  }, []);

  return {
    entries,
    total,
    page,
    totalPages,
    isLoading,
    error,
    refreshEntries,
    updateEntryStatus,
  };
}