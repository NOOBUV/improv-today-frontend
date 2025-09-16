export interface JournalEntry {
  entry_id: string;
  entry_date: string;
  content: string;
  status: 'draft' | 'approved' | 'posted';
  created_at: string;
  updated_at?: string;
  events_processed?: number;
  emotional_theme?: string;
  admin_notes?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  published_at?: string;
  character_count?: number;
  readability_score?: string;
  generated_at: string;
  metadata_json?: Record<string, unknown>;
}

export interface JournalEntryFilters {
  page?: number;
  limit?: number;
  status?: JournalEntry['status'] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface JournalCalendarData {
  date: string;
  entryCount: number;
  hasEntries: boolean;
}