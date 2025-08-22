// Consolidated API client - merging functionality from api.ts and api-client.ts
const API_BASE_URL = '';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token found. Please log in.');
      }

      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
        credentials: 'omit', // Don't send cookies - use Bearer token instead
        ...options,
      };

      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Session endpoints
  async startSession(params: { 
    personality?: string; 
    topic?: string; 
    session_type?: string; 
  } = {}): Promise<ApiResponse<{ session_id: number }>> {
    return this.request<{ session_id: number }>('/api/backend/sessions/start', {
      method: 'POST',
      body: JSON.stringify({
        session_type: params.session_type || 'practice',
        topic: params.topic ?? null,
        personality: params.personality ?? 'friendly',
      }),
    });
  }

  async endSession(sessionId: number) {
    return this.request('/api/backend/sessions/end', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  // Conversation endpoints
  async sendConversationMessage(
    message: string,
    topic?: string,
    personality?: string,
    sessionId?: number,
    lastAiReply?: string
  ): Promise<ApiResponse<{ 
    response: string; 
    feedback?: unknown; 
    suggestion?: { id: string; word: string; definition: string; exampleSentence: string; remediationFeedback?: string };
    used_suggestion_id?: number | string;
    remediation_feedback?: string; // AC: 4 - Include remediation feedback from backend
  }>> {
    return this.request<{ 
      response: string; 
      feedback?: unknown; 
      suggestion?: { id: string; word: string; definition: string; exampleSentence: string; remediationFeedback?: string };
      used_suggestion_id?: number | string;
      remediation_feedback?: string; // AC: 4 - Include remediation feedback from backend
    }>('/api/backend/conversation', {
      method: 'POST',
      body: JSON.stringify({ 
        message, 
        topic, 
        personality, 
        session_id: sessionId, 
        last_ai_reply: lastAiReply 
      }),
    });
  }

  async getConversationHistory(limit = 10) {
    return this.request(`/api/backend/conversation/history?limit=${limit}`);
  }

  // Vocabulary endpoints
  async getWeeklyVocabulary() {
    return this.request('/api/backend/vocabulary/weekly');
  }

  async updateWordUsage(wordId: string, used: boolean) {
    return this.request(`/api/backend/vocabulary/${wordId}/usage`, {
      method: 'POST',
      body: JSON.stringify({ used, timestamp: new Date().toISOString() }),
    });
  }

  async getVocabularyStats() {
    return this.request('/api/backend/vocabulary/stats');
  }

  // Progress tracking endpoints
  async getProgressData(timeframe: 'week' | 'month' | 'year' = 'week') {
    return this.request(`/api/backend/progress?timeframe=${timeframe}`);
  }

  async saveSessionData(sessionData: {
    duration: number;
    messageCount: number;
    topic?: string;
    vocabularyUsed: string[];
    averageRating: number;
  }) {
    return this.request('/api/backend/progress/session', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  // User profile endpoints
  async getUserProfile() {
    return this.request('/api/backend/user/profile');
  }

  async updateUserProfile(profileData: {
    name?: string;
    level?: string;
    goals?: string[];
    preferences?: Record<string, unknown>;
  }) {
    return this.request('/api/backend/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }
}

export const apiClient = new ApiClient();

// Export individual methods for easier importing
export const {
  startSession,
  endSession,
  sendConversationMessage,
  getConversationHistory,
  getWeeklyVocabulary,
  updateWordUsage,
  getVocabularyStats,
  getProgressData,
  saveSessionData,
  getUserProfile,
  updateUserProfile,
} = apiClient;