const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Vocabulary endpoints
  async getWeeklyVocabulary() {
    return this.request('/api/vocabulary/weekly');
  }

  async updateWordUsage(wordId: string, used: boolean) {
    return this.request(`/api/vocabulary/${wordId}/usage`, {
      method: 'POST',
      body: JSON.stringify({ used, timestamp: new Date().toISOString() }),
    });
  }

  async getVocabularyStats() {
    return this.request('/api/vocabulary/stats');
  }

  // Conversation endpoints
  async sendConversationMessage(message: string, audioBlob?: Blob, topic?: string) {
    const formData = new FormData();
    formData.append('message', message);
    if (topic) formData.append('topic', topic);
    if (audioBlob) formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await fetch(`${this.baseUrl}/api/conversation`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getConversationHistory(limit = 10) {
    return this.request(`/api/conversation/history?limit=${limit}`);
  }

  // Speech analysis removed - using browser APIs only

  // Progress tracking endpoints
  async getProgressData(timeframe: 'week' | 'month' | 'year' = 'week') {
    return this.request(`/api/progress?timeframe=${timeframe}`);
  }

  async saveSessionData(sessionData: {
    duration: number;
    messageCount: number;
    topic?: string;
    vocabularyUsed: string[];
    averageRating: number;
  }) {
    return this.request('/api/progress/session', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  // User profile endpoints
  async getUserProfile() {
    return this.request('/api/user/profile');
  }

  async updateUserProfile(profileData: {
    name?: string;
    level?: string;
    goals?: string[];
    preferences?: Record<string, unknown>;
  }) {
    return this.request('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }
}

export const apiClient = new ApiClient();

// Export individual methods for easier importing
export const {
  getWeeklyVocabulary,
  updateWordUsage,
  getVocabularyStats,
  sendConversationMessage,
  getConversationHistory,
  getProgressData,
  saveSessionData,
  getUserProfile,
  updateUserProfile,
} = apiClient;