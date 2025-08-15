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

    console.log('🔥 API Client making request to:', `/api/backend/${path}`);
    console.log('🔑 Raw token from localStorage:', token);
    console.log('🔑 Authorization header will be:', `Bearer ${token}`);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    console.log('📤 Full request details:', {
      url: `/api/backend/${path}`,
      method: options.method || 'GET',
      headers: Object.fromEntries(Object.entries(headers)),
      credentials: 'omit'
    });

    const response = await fetch(`/api/backend/${path}`, {
      ...options,
      headers,
      credentials: 'omit', // Don't send cookies
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
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