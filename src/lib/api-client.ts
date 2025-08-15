export class ApiClient {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private async makeRequest(path: string, options: RequestInit = {}) {
    const token = this.getAuthToken();
    
    if (!token) {
      throw new Error('No authentication token found. Please log in.');
    }


    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };


    const response = await fetch(`/api/backend/${path}`, {
      ...options,
      headers,
      credentials: 'omit', // Don't send cookies
    });


    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async startSession(data: {
    session_type?: string;
    topic?: string;
    personality?: string;
  }) {
    return this.makeRequest('sessions/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendMessage(data: {
    message: string;
    session_id?: number;
    personality?: string;
    session_type?: string;
    topic?: string;
  }) {
    return this.makeRequest('conversation', {
      method: 'POST', 
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();