import { JournalEntry, JournalEntryFilters, JournalCalendarData } from '@/types/journal';

const API_BASE = '/api/backend';

// Helper function to get auth headers
async function getAuthHeaders() {
  // Get token from AuthProvider via the /auth/token endpoint
  let token = null;
  try {
    const response = await fetch('/auth/token');
    if (response.ok) {
      const data = await response.json();
      token = data.accessToken;
    }
  } catch (error) {
    console.error('Failed to get auth token:', error);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

interface JournalEntriesResponse {
  entries: JournalEntry[];
  total: number;
  page: number;
  size: number;
  has_next: boolean;
  has_prev: boolean;
}

export const journalApi = {
  async getEntries(filters: JournalEntryFilters = {}): Promise<JournalEntriesResponse> {
    const params = new URLSearchParams();

    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('size', filters.limit.toString());
    if (filters.status) params.append('status', filters.status);
    if (filters.dateFrom) params.append('start_date', filters.dateFrom);
    if (filters.dateTo) params.append('end_date', filters.dateTo);

    const response = await fetch(`${API_BASE}/admin/journal/entries?${params}`, {
      headers: await getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch journal entries: ${response.statusText}`);
    }

    return response.json();
  },

  async getEntryByDate(date: string): Promise<JournalEntry | null> {
    const response = await fetch(`${API_BASE}/admin/journal/entries/${date}`, {
      headers: await getAuthHeaders(),
      credentials: 'include',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch journal entry: ${response.statusText}`);
    }

    return response.json();
  },

  async updateEntryStatus(id: string, status: JournalEntry['status']): Promise<JournalEntry> {
    const response = await fetch(`${API_BASE}/admin/journal/entries/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update entry status: ${response.statusText}`);
    }

    return response.json();
  },

  async getCalendarData(year: number, month: number): Promise<JournalCalendarData[]> {
    const response = await fetch(`${API_BASE}/admin/journal/calendar?year=${year}&month=${month}`, {
      headers: await getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar data: ${response.statusText}`);
    }

    return response.json();
  },
};